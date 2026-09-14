import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { Controller, Get } from '@nestjs/common';
import configuration from './config/configuration';
import { validationSchema } from './config/validation.schema';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { MailModule } from './mail/mail.module';
import { AuthModule } from './auth/auth.module';

@Controller()
class HealthController {
  @Get('health')
  health() {
    return { status: 'ok' };
  }
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration], validationSchema }),
    // Default rate limit for every route; sensitive auth routes set stricter
    // per-route limits with @Throttle(). In-memory storage is fine for the
    // single-instance free-tier deploy this POC targets - swap in a
    // Redis-backed ThrottlerStorage before running more than one instance.
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 30 }]),
    PrismaModule,
    RedisModule,
    MailModule,
    AuthModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
