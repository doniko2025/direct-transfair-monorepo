// apps/backend/src/validation-thresholds/validation-thresholds.module.ts
import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { ValidationThresholdsController } from './validation-thresholds.controller';
import { ValidationThresholdsService } from './validation-thresholds.service';

// PrismaModule est global ; AuthModule fournit JwtService au JwtAuthGuard.
// Le service est exporté : TransactionsModule et AgentDeskModule lisent le seuil à l'envoi.
@Module({
  imports: [AuthModule],
  controllers: [ValidationThresholdsController],
  providers: [ValidationThresholdsService],
  exports: [ValidationThresholdsService],
})
export class ValidationThresholdsModule {}
