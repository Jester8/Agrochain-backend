import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.use(helmet());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());

  const isProduction = process.env.NODE_ENV === 'production';
  const corsOrigins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  // The Expo app itself isn't subject to browser CORS - this only matters for
  // a future browser-based client (e.g. an admin dashboard). Dev mode allows
  // any origin for convenience; production requires an explicit allowlist.
  app.enableCors({
    origin: isProduction ? corsOrigins : true,
    credentials: true,
  });

  // Needed so req.ip (used by the rate limiter) reflects the real client IP
  // when deployed behind a reverse proxy (Render, Railway, Fly.io, etc.).
  if (isProduction) {
    app.set('trust proxy', 1);
  }

  const port = process.env.PORT ? Number(process.env.PORT) : 4000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`AgroChain backend listening on http://localhost:${port}`);
}

bootstrap();
