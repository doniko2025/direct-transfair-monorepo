// apps/backend/src/agent-desk/agent-desk.module.ts
import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { FeeScheduleModule } from '../fee-schedule/fee-schedule.module';
import { RatesModule } from '../rates/rates.module';
import { ValidationThresholdsModule } from '../validation-thresholds/validation-thresholds.module';
import { AgentDeskController } from './agent-desk.controller';
import { AgentDeskService } from './agent-desk.service';

// PrismaModule est global ; FeeScheduleModule exporte FeeScheduleService ; RatesModule exporte RatesService ;
// ValidationThresholdsModule exporte le service du seuil de validation.
@Module({
  imports: [AuthModule, FeeScheduleModule, RatesModule, ValidationThresholdsModule],
  controllers: [AgentDeskController],
  providers: [AgentDeskService],
})
export class AgentDeskModule {}
