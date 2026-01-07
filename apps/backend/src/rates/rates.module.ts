//apps/backend/src/rates/rates.module.ts
import { Module } from '@nestjs/common';
import { RatesService } from './rates.service';
import { RatesController } from './rates.controller';
import { PrismaModule } from '../prisma/prisma.module';
// ✅ 1. Import du module Auth
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    PrismaModule, 
    AuthModule // ✅ 2. Ajout ici pour que le Guard fonctionne
  ],
  controllers: [RatesController],
  providers: [RatesService],
  exports: [RatesService],
})
export class RatesModule {}