// apps/backend/src/rates-admin/rates-admin.module.ts
import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { RatesModule } from '../rates/rates.module';
import { RatesAdminController } from './rates-admin.controller';
import { RatesAdminService } from './rates-admin.service';

// PrismaModule est global ; RatesModule exporte RatesService (taux de secours) ;
// AuthModule fournit le JwtService utilisé par JwtAuthGuard.
@Module({
  imports: [AuthModule, RatesModule],
  controllers: [RatesAdminController],
  providers: [RatesAdminService],
})
export class RatesAdminModule {}
