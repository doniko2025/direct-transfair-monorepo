// apps/backend/src/fee-schedule/fee-schedule.module.ts
import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { RatesModule } from '../rates/rates.module';
import { FeeScheduleController } from './fee-schedule.controller';
import { FeeScheduleService } from './fee-schedule.service';

// PrismaModule est global ; RatesModule exporte RatesService (conversions) ; AuthModule fournit JwtService au JwtAuthGuard.
@Module({
  imports: [AuthModule, RatesModule],
  controllers: [FeeScheduleController],
  providers: [FeeScheduleService],
  exports: [FeeScheduleService],
})
export class FeeScheduleModule {}
