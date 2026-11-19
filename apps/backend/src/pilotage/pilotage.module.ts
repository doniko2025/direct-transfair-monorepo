// apps/backend/src/pilotage/pilotage.module.ts
import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { PilotageController } from './pilotage.controller';
import { PilotageScheduler } from './pilotage.scheduler';
import { PilotageService } from './pilotage.service';

// PrismaModule, NotificationsModule et MailModule sont globaux ; AuthModule fournit le JwtService de JwtAuthGuard.
@Module({
  imports: [AuthModule],
  controllers: [PilotageController],
  providers: [PilotageService, PilotageScheduler],
})
export class PilotageModule {}
