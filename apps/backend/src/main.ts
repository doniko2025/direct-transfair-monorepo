// apps/backend/src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  // Validation globale des DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Supprime les champs qui ne sont pas dans le DTO
      transform: true, // Convertit automatiquement les types (ex: string "10" -> number 10)
    }),
  );

  // ✅ ACTIVATION CORS ROBUSTE (Corrige le problème du bouton qui ne réagit pas)
  app.enableCors({
    origin: true, // Autorise dynamiquement l'origine de la requête (localhost:8081, IP mobile, etc.)
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    // On autorise explicitement tous les headers nécessaires, y compris x-tenant-id
    allowedHeaders: 'Content-Type, Authorization, x-tenant-id, Accept, Origin, X-Requested-With',
  });

  // Configuration Swagger (Documentation API)
  const config = new DocumentBuilder()
    .setTitle("Direct Transf'air API")
    .setDescription('Documentation officielle du backend Direct Transf’air')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('swagger', app, document);

  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  
  // Écoute sur 0.0.0.0 pour être accessible depuis le réseau local (téléphone réel)
  await app.listen(port, '0.0.0.0');

  // eslint-disable-next-line no-console
  console.log(`🚀 Backend running: http://localhost:${port}`);
  // eslint-disable-next-line no-console
  console.log(`📑 Swagger: http://localhost:${port}/swagger`);
}

void bootstrap();