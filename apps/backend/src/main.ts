// apps/backend/src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { TenantGuard } from './tenants/tenant.guard';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  // ✅ AJOUT DU PRÉFIXE GLOBAL (Indispensable pour correspondre au mobile)
  app.setGlobalPrefix('api');

  // Validation globale des DTO
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  // CORS
  app.enableCors({
    origin: true,
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders:
      'Content-Type, Authorization, x-tenant-id, Accept, Origin, X-Requested-With',
  });

  // ✅ Guard tenant GLOBAL
  app.useGlobalGuards(app.get(TenantGuard));

  // 🔐 Swagger
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
  // On rend swagger accessible sur /swagger (sans le préfixe /api)
  SwaggerModule.setup('swagger', app, document);

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, '0.0.0.0');

  console.log(`🚀 Backend running: http://localhost:${port}/api`);
  console.log(`📑 Swagger: http://localhost:${port}/swagger`);
}

void bootstrap();