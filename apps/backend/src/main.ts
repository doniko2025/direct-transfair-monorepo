// apps/backend/src/main.ts

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { AppModule } from './app.module';
import { TenantGuard } from './tenants/tenant.guard';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  // =========================================================
  // 🔥 GLOBAL PREFIX
  // =========================================================

  app.setGlobalPrefix('api');

  // =========================================================
  // 🔥 VALIDATION
  // =========================================================

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  // =========================================================
  // 🔥 CORS CONFIG
  // =========================================================

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      const allowedOrigins = [
        'http://localhost:3000',
        'http://localhost:5173',
        'http://localhost:8081',

        // Frontend Vercel
        'https://direct-transfair-monorepo-direct-tr.vercel.app',

        // Backend Railway
        'https://direct-transfair-monorepo-production.up.railway.app',
      ];

      const isAllowed =
        !origin ||
        allowedOrigins.includes(origin) ||
        origin?.endsWith('.vercel.app') ||
        origin?.endsWith('.railway.app');

      if (isAllowed) {
        callback(null, true);
      } else {
        callback(new Error(`CORS blocked for origin: ${origin}`));
      }
    },

    methods: [
      'GET',
      'HEAD',
      'PUT',
      'PATCH',
      'POST',
      'DELETE',
      'OPTIONS',
    ],

    credentials: true,

    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'x-tenant-id',
    ],
  });

  // =========================================================
  // 🔥 SECURITY
  // =========================================================

  app.enableShutdownHooks();

  // =========================================================
  // 🔥 GLOBAL GUARDS
  // =========================================================

  app.useGlobalGuards(app.get(TenantGuard));

  // =========================================================
  // 🔥 SWAGGER
  // =========================================================

  const swaggerConfig = new DocumentBuilder()
    .setTitle("Direct Transf'air API")
    .setDescription(
      'Documentation officielle du backend Direct Transf’air',
    )
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        in: 'header',
      },
      'access-token',
    )
    .addApiKey(
      {
        type: 'apiKey',
        name: 'x-tenant-id',
        in: 'header',
      },
      'x-tenant-id',
    )
    .build();

  const swaggerDocument = SwaggerModule.createDocument(
    app,
    swaggerConfig,
  );

  SwaggerModule.setup('swagger', app, swaggerDocument);

  // =========================================================
  // 🔥 START SERVER
  // =========================================================

  const port = Number(process.env.PORT ?? 3000);

  await app.listen(port, '0.0.0.0');

  console.log(`🚀 Backend running on port ${port}`);
  console.log(
    `📚 Swagger available on http://localhost:${port}/swagger`,
  );
}

void bootstrap();