//apps/backend/src/limits/limits.module.ts
import { Module } from '@nestjs/common';
import { LimitsController } from './limits.controller';
import { LimitsService } from './limits.service';
import { PrismaModule } from '../prisma/prisma.module';
import { TenantsModule } from '../tenants/tenants.module'; // ✅ AJOUT
import { AuthModule } from '../auth/auth.module';           // ✅ AJOUT
import { TransferLimitsModule } from '../transfer-limits/transfer-limits.module'; // v2.0 : plafonds réels

@Module({
  imports: [
    PrismaModule,
    TenantsModule, // ✅ obligatoire pour TenantGuard
    AuthModule,    // ✅ obligatoire pour JwtAuthGuard
    TransferLimitsModule, // TransferLimitsService (plafonds appliqués)
  ],
  controllers: [LimitsController],
  providers: [LimitsService],
})
export class LimitsModule {}