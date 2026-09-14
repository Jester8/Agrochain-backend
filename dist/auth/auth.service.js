"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const jwt_1 = require("@nestjs/jwt");
const argon2 = __importStar(require("argon2"));
const prisma_service_1 = require("../prisma/prisma.service");
const redis_service_1 = require("../redis/redis.service");
const mail_service_1 = require("../mail/mail.service");
const auth_utils_1 = require("./auth.utils");
const MAX_OTP_ATTEMPTS = 5;
function otpKey(purpose, email) {
    return `otp:${purpose}:${email.toLowerCase()}`;
}
function otpAttemptsKey(purpose, email) {
    return `otp:attempts:${purpose}:${email.toLowerCase()}`;
}
function usedResetTokenKey(tokenHash) {
    return `resettoken:used:${tokenHash}`;
}
function publicUser(user) {
    const { id, firstName, lastName, email, phone, isVerified, trustScore } = user;
    return { id, firstName, lastName, email, phone, isVerified, trustScore };
}
let AuthService = class AuthService {
    constructor(prisma, redis, mail, jwt, config) {
        this.prisma = prisma;
        this.redis = redis;
        this.mail = mail;
        this.jwt = jwt;
        this.config = config;
    }
    async issueOtp(purpose, email) {
        const code = (0, auth_utils_1.generateOtp)();
        const ttl = this.config.get('otp.ttlSeconds');
        await this.redis.set(otpKey(purpose, email), code, 'EX', ttl);
        await this.redis.del(otpAttemptsKey(purpose, email));
        await this.mail.sendOtp(email, code, purpose);
    }
    async consumeOtp(purpose, email, code) {
        const key = otpKey(purpose, email);
        const attemptsKey = otpAttemptsKey(purpose, email);
        const stored = await this.redis.get(key);
        if (!stored) {
            throw new common_1.BadRequestException('This code has expired. Please request a new one.');
        }
        if (stored !== code) {
            const attempts = await this.redis.incr(attemptsKey);
            if (attempts === 1) {
                const ttl = await this.redis.ttl(key);
                await this.redis.expire(attemptsKey, ttl > 0 ? ttl : this.config.get('otp.ttlSeconds'));
            }
            if (attempts >= MAX_OTP_ATTEMPTS) {
                await this.redis.del(key, attemptsKey);
                throw new common_1.BadRequestException('Too many incorrect attempts. Please request a new code.');
            }
            throw new common_1.BadRequestException('Invalid verification code.');
        }
        await this.redis.del(key, attemptsKey);
    }
    async issueTokenPair(userId, email) {
        const accessToken = await this.jwt.signAsync({ sub: userId, email }, {
            secret: this.config.get('jwt.accessSecret'),
            expiresIn: this.config.get('jwt.accessExpiresIn'),
        });
        const refreshToken = await this.jwt.signAsync({ sub: userId, email }, {
            secret: this.config.get('jwt.refreshSecret'),
            expiresIn: this.config.get('jwt.refreshExpiresIn'),
        });
        const decoded = this.jwt.decode(refreshToken);
        await this.prisma.refreshToken.create({
            data: {
                userId,
                tokenHash: (0, auth_utils_1.sha256)(refreshToken),
                expiresAt: new Date(decoded.exp * 1000),
            },
        });
        return { accessToken, refreshToken };
    }
    async signup(dto) {
        const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
        if (existing?.isVerified) {
            throw new common_1.ConflictException('An account with this email already exists.');
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
    async confirmEmail(dto) {
        await this.consumeOtp('signup', dto.email, dto.code);
        const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
        if (!user) {
            throw new common_1.NotFoundException('Account not found.');
        }
        const verifiedUser = await this.prisma.user.update({
            where: { id: user.id },
            data: { isVerified: true },
        });
        const tokens = await this.issueTokenPair(verifiedUser.id, verifiedUser.email);
        return { user: publicUser(verifiedUser), ...tokens };
    }
    async resendOtp(dto) {
        const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
        if (!user) {
            throw new common_1.NotFoundException('Account not found.');
        }
        if (dto.purpose === 'signup' && user.isVerified) {
            throw new common_1.BadRequestException('This account is already verified.');
        }
        await this.issueOtp(dto.purpose, dto.email);
        return { success: true };
    }
    async login(dto) {
        const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
        if (!user) {
            throw new common_1.UnauthorizedException('Incorrect email or password.');
        }
        const passwordMatches = await argon2.verify(user.passwordHash, dto.password);
        if (!passwordMatches) {
            throw new common_1.UnauthorizedException('Incorrect email or password.');
        }
        if (!user.isVerified) {
            throw new common_1.ForbiddenException('Please verify your email before logging in.');
        }
        const tokens = await this.issueTokenPair(user.id, user.email);
        return { user: publicUser(user), ...tokens };
    }
    async forgotPassword(dto) {
        const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
        if (user) {
            await this.issueOtp('password-reset', dto.email);
        }
        return { success: true };
    }
    async verifyResetOtp(dto) {
        await this.consumeOtp('password-reset', dto.email, dto.code);
        const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
        if (!user) {
            throw new common_1.NotFoundException('Account not found.');
        }
        const resetToken = await this.jwt.signAsync({ sub: user.id, email: user.email, purpose: 'reset' }, {
            secret: this.config.get('jwt.resetSecret'),
            expiresIn: this.config.get('jwt.resetExpiresIn'),
        });
        return { resetToken };
    }
    async resetPassword(dto) {
        let payload;
        try {
            payload = await this.jwt.verifyAsync(dto.resetToken, {
                secret: this.config.get('jwt.resetSecret'),
            });
        }
        catch {
            throw new common_1.BadRequestException('This reset link has expired. Please start over.');
        }
        if (payload.purpose !== 'reset') {
            throw new common_1.BadRequestException('Invalid reset token.');
        }
        const tokenHash = (0, auth_utils_1.sha256)(dto.resetToken);
        const alreadyUsed = await this.redis.get(usedResetTokenKey(tokenHash));
        if (alreadyUsed) {
            throw new common_1.BadRequestException('This reset link has already been used.');
        }
        const passwordHash = await argon2.hash(dto.newPassword, { type: argon2.argon2id });
        await this.prisma.$transaction([
            this.prisma.user.update({ where: { id: payload.sub }, data: { passwordHash } }),
            this.prisma.refreshToken.updateMany({
                where: { userId: payload.sub, revokedAt: null },
                data: { revokedAt: new Date() },
            }),
        ]);
        const remainingTtl = Math.max(payload.exp - Math.floor(Date.now() / 1000), 60);
        await this.redis.set(usedResetTokenKey(tokenHash), '1', 'EX', remainingTtl);
        return { success: true };
    }
    async refreshTokens(dto) {
        let payload;
        try {
            payload = await this.jwt.verifyAsync(dto.refreshToken, {
                secret: this.config.get('jwt.refreshSecret'),
            });
        }
        catch {
            throw new common_1.UnauthorizedException('Session expired. Please log in again.');
        }
        const tokenHash = (0, auth_utils_1.sha256)(dto.refreshToken);
        const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });
        if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
            throw new common_1.UnauthorizedException('Session expired. Please log in again.');
        }
        await this.prisma.refreshToken.update({
            where: { id: stored.id },
            data: { revokedAt: new Date() },
        });
        return this.issueTokenPair(payload.sub, payload.email);
    }
    async logout(dto) {
        const tokenHash = (0, auth_utils_1.sha256)(dto.refreshToken);
        await this.prisma.refreshToken.updateMany({
            where: { tokenHash, revokedAt: null },
            data: { revokedAt: new Date() },
        });
        return { success: true };
    }
    async me(userId) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            include: { farmProfile: true },
        });
        if (!user) {
            throw new common_1.NotFoundException('Account not found.');
        }
        return { ...publicUser(user), farmProfile: user.farmProfile };
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        redis_service_1.RedisService,
        mail_service_1.MailService,
        jwt_1.JwtService,
        config_1.ConfigService])
], AuthService);
//# sourceMappingURL=auth.service.js.map