// apps/backend/src/commission-rules/commission-rules.module.ts
import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { CommissionRulesController } from './commission-rules.controller';
import { CommissionRulesService } from './commission-rules.service';

// PrismaModule est global ; AuthModule fournit JwtService au JwtAuthGuard.
@Module({
  imports: [AuthModule],
  controllers: [CommissionRulesController],
  providers: [CommissionRulesService],
})
export class CommissionRulesModule {}
