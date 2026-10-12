// apps/backend/src/fees-admin/fees-admin.module.ts
import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { CommissionsModule } from '../commissions/commissions.module';
import { FeesAdminController } from './fees-admin.controller';
import { FeesAdminService } from './fees-admin.service';

// PrismaModule est global ; CommissionsModule exporte CommissionsService (écriture de la ligne de frais) ;
// AuthModule fournit le JwtService utilisé par JwtAuthGuard.
@Module({
  imports: [AuthModule, CommissionsModule],
  controllers: [FeesAdminController],
  providers: [FeesAdminService],
})
export class FeesAdminModule {}
