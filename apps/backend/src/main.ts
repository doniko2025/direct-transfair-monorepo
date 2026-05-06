// apps/backend/src/main.ts

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { TenantGuard } from './tenants/tenant.guard';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  // 🔥 PREFIX API
  app.setGlobalPrefix('api');

  // 🔥 VALIDATION
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  // =========================================================
  // 🔥 CORS FIX VERCEL (ULTRA IMPORTANT)
  // =========================================================

  // ✅ Middleware manuel (gère OPTIONS / preflight)
  app.use((req: any, res: any, next: any) => {
    const origin = req.headers.origin;

    // 👉 Autorise ton frontend + dev + previews Vercel
    const allowedOrigins = [
      'http://localhost:8081',
      'http://localhost:5173',
      'http://localhost:3000',
      'https://direct-transfair-monorepo-direct-tr.vercel.app',
      'https://direct-transfair-monorepo-production.up.railway.app',
    ];

    if (
      !origin ||
      allowedOrigins.includes(origin) ||
      origin.endsWith('.vercel.app') ||
      origin.endsWith('.railway.app')
    ) {
      res.header('Access-Control-Allow-Origin', origin || '*');
    }

    res.header('Access-Control-Allow-Credentials', 'true');
    res.header(
      'Access-Control-Allow-Headers',
      'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-tenant-id',
    );
    res.header(
      'Access-Control-Allow-Methods',
      'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    );

    // 🔥 CRUCIAL POUR VERCEL
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }

    next();
  });

  // ✅ CORS NestJS (simple et stable)
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // =========================================================
  // 🔥 GUARDS
  // =========================================================
  app.useGlobalGuards(app.get(TenantGuard));

  // =========================================================
  // 🔥 SWAGGER
  // =========================================================
  const config = new DocumentBuilder()
    .setTitle("Direct Transf'air API")
    .setDescription('Documentation officielle du backend Direct Transf’air')
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', in: 'header' },
      'access-token',
    )
    .addApiKey(
      { type: 'apiKey', name: 'x-tenant-id', in: 'header' },
      'x-tenant-id',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('swagger', app, document);

  // =========================================================
  // 🔥 START SERVER
  // =========================================================
  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, '0.0.0.0');

  console.log(`🚀 Backend running on port ${port}`);
}

void bootstrap();