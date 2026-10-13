// apps/backend/src/transfer-limits/transfer-limits.module.ts
import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { TransferLimitsController } from './transfer-limits.controller';
import { TransferLimitsService } from './transfer-limits.service';

// PrismaModule est global ; AuthModule fournit JwtService au JwtAuthGuard.
// Le service est exporté : TransactionsModule (contrôle à l'envoi) et LimitsModule (écran « Mes plafonds »).
@Module({
  imports: [AuthModule],
  controllers: [TransferLimitsController],
  providers: [TransferLimitsService],
  exports: [TransferLimitsService],
})
export class TransferLimitsModule {}
