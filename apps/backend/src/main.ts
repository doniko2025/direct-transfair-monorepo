// apps/backend/src/main.ts
// =========================================================
// MAIN v2.0
// ✅ v1.0 : ValidationPipe, CORS, Swagger, TenantGuard
// ✅ v2.0 : Helmet (en-têtes HTTP sécurité)
//   Prérequis : npm install helmet
//   Active : X-Content-Type-Options, X-Frame-Options,
//            X-XSS-Protection, Strict-Transport-Security,
//            Content-Security-Policy, et autres.
// =========================================================

import { ValidationPipe } from '@nestjs/common';
import { NestFactory }    from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet'; // ✅ v2.0 — npm install helmet

import { AppModule }    from './app.module';
import { TenantGuard }  from './tenants/tenant.guard';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  // =========================================================
  // ✅ v2.0 : HELMET — En-têtes HTTP sécurité
  // Doit être le premier middleware appliqué
  // =========================================================
  app.use(
    helmet({
      // CSP permissif pour Swagger UI
      contentSecurityPolicy: {
        directives: {
          defaultSrc:  ["'self'"],
          scriptSrc:   ["'self'", "'unsafe-inline'", 'cdn.jsdelivr.net'],
          styleSrc:    ["'self'", "'unsafe-inline'", 'cdn.jsdelivr.net', 'fonts.googleapis.com'],
          imgSrc:      ["'self'", 'data:', 'cdn.jsdelivr.net'],
          connectSrc:  ["'self'"],
          fontSrc:     ["'self'", 'fonts.gstatic.com', 'data:'],
        },
      },
      // HSTS — force HTTPS pendant 1 an
      hsts: {
        maxAge:            31_536_000,
        includeSubDomains: true,
        preload:           true,
      },
      // Masquer "X-Powered-By: Express"
      hidePoweredBy: true,
    }),
  );

  // =========================================================
  // GLOBAL PREFIX
  // =========================================================
  app.setGlobalPrefix('api');

  // =========================================================
  // VALIDATION
  // =========================================================
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist:           true,
      transform:           true,
      forbidNonWhitelisted: false,
    }),
  );

  // =========================================================
  // CORS
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
        'https://direct-transfair-monorepo-direct-tr.vercel.app',
        'https://direct-transfair-backend-production.up.railway.app',
      ];

      const isAllowed =
        !origin ||
        allowedOrigins.includes(origin) ||
        origin?.endsWith('.vercel.app')  ||
        origin?.endsWith('.railway.app');

      if (isAllowed) callback(null, true);
      else callback(new Error(`CORS blocked: ${origin}`));
    },
    methods:        ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    credentials:    true,
    allowedHeaders: [
      'Origin', 'X-Requested-With', 'Content-Type',
      'Accept', 'Authorization', 'x-tenant-id',
    ],
  });

  // =========================================================
  // GLOBAL GUARDS
  // =========================================================
  app.enableShutdownHooks();
  app.useGlobalGuards(app.get(TenantGuard));

  // =========================================================
  // SWAGGER
  // =========================================================
  const swaggerConfig = new DocumentBuilder()
    .setTitle("Direct Transf'air API")
    .setDescription("Documentation officielle du backend Direct Transf'air")
    .setVersion('1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT', in: 'header' }, 'access-token')
    .addApiKey({ type: 'apiKey', name: 'x-tenant-id', in: 'header' }, 'x-tenant-id')
    .build();

  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('swagger',     app, swaggerDocument);
  SwaggerModule.setup('api/swagger', app, swaggerDocument);

  // =========================================================
  // START
  // =========================================================
  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, '0.0.0.0');

  console.log(`🚀 Backend démarré sur le port ${port}`);
  console.log(`📚 Swagger : http://localhost:${port}/swagger`);
}

void bootstrap();