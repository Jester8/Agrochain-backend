export default () => ({
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
    brevoApiKey: process.env.BREVO_API_KEY ?? '',
    // "Name <address>" or a bare address.
    from: process.env.MAIL_FROM ?? 'AgroChain <hello@agrochain.africa>',
    // Brevo contact list that newsletter / waitlist sign-ups are added to (optional).
    waitlistListId: process.env.BREVO_WAITLIST_LIST_ID ? parseInt(process.env.BREVO_WAITLIST_LIST_ID, 10) : undefined,
    // Receives offers on listings that don't have a registered seller account yet.
    opsEmail: process.env.OPS_EMAIL ?? 'info@agrochain.africa',
  },

  // Public website URL, used for links inside emails.
  appUrl: process.env.APP_URL ?? 'https://agrochain.africa',

  otp: {
    ttlSeconds: parseInt(process.env.OTP_TTL_SECONDS ?? '600', 10),
  },
});
