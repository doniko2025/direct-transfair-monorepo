// apps/backend/src/growth/growth.module.ts
import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { RatesModule } from '../rates/rates.module';
import { GrowthController } from './growth.controller';
import { GrowthService } from './growth.service';

// PrismaModule et NotificationsModule sont globaux ; AuthModule fournit le JwtService de JwtAuthGuard.
@Module({
  imports: [AuthModule, RatesModule],
  controllers: [GrowthController],
  providers: [GrowthService],
})
export class GrowthModule {}
