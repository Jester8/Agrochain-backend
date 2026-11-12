import * as Joi from 'joi';

// Fails fast at boot with a clear message if a required secret or connection
// string is missing, instead of an obscure runtime error later.
export const validationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(4000),

  DATABASE_URL: Joi.string().uri().required(),
  REDIS_URL: Joi.string().uri().required(),

  JWT_ACCESS_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_SECRET: Joi.string().min(32).required(),
  JWT_RESET_SECRET: Joi.string().min(32).required(),
  JWT_ACCESS_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('30d'),
  JWT_RESET_EXPIRES_IN: Joi.string().default('10m'),

  RESEND_API_KEY: Joi.string().allow('').default(''),
  MAIL_FROM: Joi.string().default('AgroChain <onboarding@resend.dev>'),

  OTP_TTL_SECONDS: Joi.number().default(600),

  // Comma-separated list of allowed origins for browser clients (e.g. a future
  // admin dashboard). Not needed for the Expo app itself - CORS only applies
  // to browsers. Left empty, dev mode allows all origins and production allows none.
  CORS_ORIGINS: Joi.string().allow('').default(''),
});
