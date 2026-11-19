// apps/backend/src/compliance/compliance.module.ts
import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { ComplianceController } from './compliance.controller';
import { ComplianceService } from './compliance.service';
import { OfficialListsScheduler } from './official-lists.scheduler';
import { OfficialListsService } from './official-lists.service';

// PrismaModule est global ; AuthModule fournit le JwtService de JwtAuthGuard ; TransactionsModule exporte TransactionsService
// (débloquer / rejeter un envoi bloqué passe par le même chemin d'annulation + remboursement que toute annulation).
@Module({
  imports: [AuthModule, TransactionsModule],
  controllers: [ComplianceController],
  providers: [ComplianceService, OfficialListsService, OfficialListsScheduler],
  exports: [ComplianceService],
})
export class ComplianceModule {}
