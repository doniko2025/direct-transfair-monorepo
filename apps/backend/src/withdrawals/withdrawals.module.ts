// apps/backend/src/withdrawals/withdrawals.module.ts
import { Module } from '@nestjs/common';
import { WithdrawalsService } from './withdrawals.service';
import { WithdrawalsController } from './withdrawals.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { WalletsModule } from '../wallets/wallets.module';

// ✅ CORRECTION CHIRURGICALE : Import du module Tenants pour fournir le TenantResolverService au TenantGuard
import { TenantsModule } from '../tenants/tenants.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    WalletsModule, // ✅ Requis pour WalletsService (débit wallet)
    TenantsModule, // <-- C'est l'ajout qui résout ton erreur de dépendance
  ],
  controllers: [WithdrawalsController],
  providers: [WithdrawalsService],
  exports: [WithdrawalsService],
})
export class WithdrawalsModule {}