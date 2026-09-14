import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { MailService } from '../mail/mail.service';
import { generateOtp, sha256 } from './auth.utils';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { ConfirmEmailDto } from './dto/confirm-email.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { VerifyResetOtpDto } from './dto/verify-reset-otp.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';

const MAX_OTP_ATTEMPTS = 5;

function otpKey(purpose: 'signup' | 'password-reset', email: string) {
  return `otp:${purpose}:${email.toLowerCase()}`;
}

function otpAttemptsKey(purpose: 'signup' | 'password-reset', email: string) {
  return `otp:attempts:${purpose}:${email.toLowerCase()}`;
}

function usedResetTokenKey(tokenHash: string) {
  return `resettoken:used:${tokenHash}`;
}

function publicUser(user: { id: string; firstName: string; lastName: string; email: string; phone: string | null; isVerified: boolean; trustScore: number }) {
  const { id, firstName, lastName, email, phone, isVerified, trustScore } = user;
  return { id, firstName, lastName, email, phone, isVerified, trustScore };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly mail: MailService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  private async issueOtp(purpose: 'signup' | 'password-reset', email: string) {
    const code = generateOtp();
    const ttl = this.config.get<number>('otp.ttlSeconds')!;
    await this.redis.set(otpKey(purpose, email), code, 'EX', ttl);
    await this.redis.del(otpAttemptsKey(purpose, email));
    await this.mail.sendOtp(email, code, purpose);
  }

  // A 4-digit code only has 10,000 combinations, so it must never be checked
  // without a hard cap on attempts - otherwise it's brute-forceable in seconds.
  private async consumeOtp(purpose: 'signup' | 'password-reset', email: string, code: string) {
    const key = otpKey(purpose, email);
    const attemptsKey = otpAttemptsKey(purpose, email);

    const stored = await this.redis.get(key);
    if (!stored) {
      throw new BadRequestException('This code has expired. Please request a new one.');
    }

    if (stored !== code) {
      const attempts = await this.redis.incr(attemptsKey);
      if (attempts === 1) {
        const ttl = await this.redis.ttl(key);
        await this.redis.expire(attemptsKey, ttl > 0 ? ttl : this.config.get<number>('otp.ttlSeconds')!);
      }
      if (attempts >= MAX_OTP_ATTEMPTS) {
        await this.redis.del(key, attemptsKey);
        throw new BadRequestException('Too many incorrect attempts. Please request a new code.');
      }
      throw new BadRequestException('Invalid verification code.');
    }

    await this.redis.del(key, attemptsKey);
  }

  private async issueTokenPair(userId: string, email: string) {
    const accessToken = await this.jwt.signAsync(
      { sub: userId, email },
      {
        secret: this.config.get<string>('jwt.accessSecret'),
        expiresIn: this.config.get<string>('jwt.accessExpiresIn'),
      },
    );

    const refreshToken = await this.jwt.signAsync(
      { sub: userId, email },
      {
        secret: this.config.get<string>('jwt.refreshSecret'),
        expiresIn: this.config.get<string>('jwt.refreshExpiresIn'),
      },
    );

    const decoded = this.jwt.decode(refreshToken) as { exp: number };
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: sha256(refreshToken),
        expiresAt: new Date(decoded.exp * 1000),
      },
    });

    return { accessToken, refreshToken };
  }

  async signup(dto: SignupDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });

    if (existing?.isVerified) {
      throw new ConflictException('An account with this email already exists.');
    }

    const passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });

    const user = existing
      ? await this.prisma.user.update({
          where: { id: existing.id },
          data: {
            firstName: dto.firstName,
            lastName: dto.lastName,
            phone: dto.phone,
            dateOfBirth: new Date(dto.dateOfBirth),
            passwordHash,
            farmProfile: {
              upsert: {
                create: {
                  farmName: dto.farmName,
                  farmSizeHectares: dto.farmSizeHectares,
                  primaryCrop: dto.primaryCrop,
                  state: dto.state,
                  lga: dto.lga,
                },
                update: {
                  farmName: dto.farmName,
                  farmSizeHectares: dto.farmSizeHectares,
                  primaryCrop: dto.primaryCrop,
                  state: dto.state,
                  lga: dto.lga,
                },
              },
            },
          },
        })
      : await this.prisma.user.create({
          data: {
            firstName: dto.firstName,
            lastName: dto.lastName,
            email: dto.email,
            phone: dto.phone,
            dateOfBirth: new Date(dto.dateOfBirth),
            passwordHash,
            farmProfile: {
              create: {
                farmName: dto.farmName,
                farmSizeHectares: dto.farmSizeHectares,
                primaryCrop: dto.primaryCrop,
                state: dto.state,
                lga: dto.lga,
              },
            },
          },
        });

    await this.issueOtp('signup', user.email);

    return { userId: user.id, email: user.email };
  }

  async confirmEmail(dto: ConfirmEmailDto) {
    await this.consumeOtp('signup', dto.email, dto.code);

    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) {
      throw new NotFoundException('Account not found.');
    }

    const verifiedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: { isVerified: true },
    });

    const tokens = await this.issueTokenPair(verifiedUser.id, verifiedUser.email);
    return { user: publicUser(verifiedUser), ...tokens };
  }

  async resendOtp(dto: ResendOtpDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) {
      throw new NotFoundException('Account not found.');
    }
    if (dto.purpose === 'signup' && user.isVerified) {
      throw new BadRequestException('This account is already verified.');
    }

    await this.issueOtp(dto.purpose, dto.email);
    return { success: true };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) {
      throw new UnauthorizedException('Incorrect email or password.');
    }

    const passwordMatches = await argon2.verify(user.passwordHash, dto.password);
    if (!passwordMatches) {
      throw new UnauthorizedException('Incorrect email or password.');
    }

    if (!user.isVerified) {
      throw new ForbiddenException('Please verify your email before logging in.');
    }

    const tokens = await this.issueTokenPair(user.id, user.email);
    return { user: publicUser(user), ...tokens };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    // Always return the same response whether or not the account exists, so
    // this endpoint can't be used to check which emails are registered.
    if (user) {
      await this.issueOtp('password-reset', dto.email);
    }
    return { success: true };
  }

  async verifyResetOtp(dto: VerifyResetOtpDto) {
    await this.consumeOtp('password-reset', dto.email, dto.code);

    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) {
      throw new NotFoundException('Account not found.');
    }

    const resetToken = await this.jwt.signAsync(
      { sub: user.id, email: user.email, purpose: 'reset' },
      {
        secret: this.config.get<string>('jwt.resetSecret'),
        expiresIn: this.config.get<string>('jwt.resetExpiresIn'),
      },
    );

    return { resetToken };
  }

  async resetPassword(dto: ResetPasswordDto) {
    let payload: { sub: string; email: string; purpose: string; exp: number };
    try {
      payload = await this.jwt.verifyAsync(dto.resetToken, {
        secret: this.config.get<string>('jwt.resetSecret'),
      });
    } catch {
      throw new BadRequestException('This reset link has expired. Please start over.');
    }

    if (payload.purpose !== 'reset') {
      throw new BadRequestException('Invalid reset token.');
    }

    // A resetToken is meant to be used exactly once. Without this check, a
    // token intercepted in transit could be replayed to reset the password
    // again at any point before it expires.
    const tokenHash = sha256(dto.resetToken);
    const alreadyUsed = await this.redis.get(usedResetTokenKey(tokenHash));
    if (alreadyUsed) {
      throw new BadRequestException('This reset link has already been used.');
    }

    const passwordHash = await argon2.hash(dto.newPassword, { type: argon2.argon2id });

    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: payload.sub }, data: { passwordHash } }),
      // Force re-login on every device after a password reset.
      this.prisma.refreshToken.updateMany({
        where: { userId: payload.sub, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    const remainingTtl = Math.max(payload.exp - Math.floor(Date.now() / 1000), 60);
    await this.redis.set(usedResetTokenKey(tokenHash), '1', 'EX', remainingTtl);

    return { success: true };
  }

  async refreshTokens(dto: RefreshTokenDto) {
    let payload: { sub: string; email: string };
    try {
      payload = await this.jwt.verifyAsync(dto.refreshToken, {
        secret: this.config.get<string>('jwt.refreshSecret'),
      });
    } catch {
      throw new UnauthorizedException('Session expired. Please log in again.');
    }

    const tokenHash = sha256(dto.refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Session expired. Please log in again.');
    }

    // Rotate: the old refresh token is single-use.
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokenPair(payload.sub, payload.email);
  }

  async logout(dto: RefreshTokenDto) {
    const tokenHash = sha256(dto.refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { success: true };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { farmProfile: true },
    });
    if (!user) {
      throw new NotFoundException('Account not found.');
    }
    return { ...publicUser(user), farmProfile: user.farmProfile };
  }
}
