import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { ReconciliationController } from './reconciliation.controller';
import { ReconciliationService } from './reconciliation.service';

// PrismaModule est global ; AuthModule fournit le JwtService utilisé par JwtAuthGuard.
@Module({
  imports: [AuthModule],
  controllers: [ReconciliationController],
  providers: [ReconciliationService],
  exports: [ReconciliationService],
})
export class ReconciliationModule {}
