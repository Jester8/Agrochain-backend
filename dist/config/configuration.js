"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = () => ({
    port: parseInt(process.env.PORT ?? '4000', 10),
    nodeEnv: process.env.NODE_ENV ?? 'development',
    database: {
        url: process.env.DATABASE_URL,
    },
    redis: {
        url: process.env.REDIS_URL,
    },
    jwt: {
        accessSecret: process.env.JWT_ACCESS_SECRET,
        accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
        refreshSecret: process.env.JWT_REFRESH_SECRET,
        refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '30d',
        resetSecret: process.env.JWT_RESET_SECRET,
        resetExpiresIn: process.env.JWT_RESET_EXPIRES_IN ?? '10m',
    },
    mail: {
        resendApiKey: process.env.RESEND_API_KEY ?? '',
        from: process.env.MAIL_FROM ?? 'AgroChain <onboarding@resend.dev>',
    },
    otp: {
        ttlSeconds: parseInt(process.env.OTP_TTL_SECONDS ?? '600', 10),
    },
});
//# sourceMappingURL=configuration.js.map