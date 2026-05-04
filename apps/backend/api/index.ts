// apps/backend/api/index.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { ValidationPipe } from '@nestjs/common';

let app: any;

export default async function handler(req: any, res: any) {
  if (!app) {
    app = await NestFactory.create(AppModule);
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.enableCors({
      origin: (origin: string, callback: Function) => {
        if (!origin || origin.endsWith('.vercel.app')) {
          return callback(null, true);
        }
        return callback(null, false);
      },
      credentials: true,
    });
    await app.init();
  }

  const expressApp = app.getHttpAdapter().getInstance();
  return expressApp(req, res);
}