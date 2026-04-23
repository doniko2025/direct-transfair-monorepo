//apps/backend/src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { TenantGuard } from './tenants/tenant.guard';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  // ✅ AJOUT DU PRÉFIXE GLOBAL
  app.setGlobalPrefix('api');

  // Validation globale des DTO
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  // ✅ CORS BLINDÉ ET DYNAMIQUE
  app.enableCors({
    origin: (origin, callback) => {
      // 1. Autoriser les requêtes sans origine (ex: Postman, App mobile native)
      if (!origin) return callback(null, true);

      // 2. Liste blanche stricte
      const allowedOrigins = [
        'http://localhost:8081',
        'http://localhost:5173',
        'http://localhost:3000',
        'https://direct-transfair-monorepo-production.up.railway.app',
        'https://direct-transfair-monorepo-backend.vercel.app',
        'https://direct-transfair-monorepo-direct-tr.vercel.app',
      ];

      // 3. Validation dynamique : Accepte si dans la liste OU si c'est un sous-domaine Vercel
      if (allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
        return callback(null, true);
      }

      // 4. Blocage avec log explicite pour t'aider à débugger côté serveur
      console.error(`🚨 CORS BLOQUÉ POUR L'ORIGINE : ${origin}`);
      return callback(null, false);
    },
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'x-tenant-id',
      'Accept',
      'Origin',
      'X-Requested-With'
    ],
    exposedHeaders: ['Authorization'],
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
  SwaggerModule.setup('swagger', app, document);

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, '0.0.0.0');

  console.log(`🚀 Backend running: http://localhost:${port}/api`);
}

void bootstrap();