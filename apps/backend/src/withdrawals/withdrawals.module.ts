// apps/backend/src/withdrawals/withdrawals.module.ts
// =========================================================
// WITHDRAWALS MODULE v2.0
// ✅ v1.0 : PrismaModule, AuthModule, WalletsModule, TenantsModule
// ✅ v2.0 : NotificationsModule ajouté explicitement
//   WithdrawalsService injecte WalletNotifierService et
//   AgentNotifierService (fournis par NotificationsModule).
//   NotificationsModule est @Global() mais on l'importe
//   explicitement pour garantir la résolution des dépendances
//   quel que soit l'ordre de chargement dans AppModule.
// =========================================================

import { Module } from '@nestjs/common';
import { WithdrawalsService }    from './withdrawals.service';
import { WithdrawalsController } from './withdrawals.controller';
import { PrismaModule }          from '../prisma/prisma.module';
import { AuthModule }            from '../auth/auth.module';
import { WalletsModule }         from '../wallets/wallets.module';
import { TenantsModule }         from '../tenants/tenants.module';
import { NotificationsModule }   from '../notifications/notifications.module'; // ✅ v2.0
import { RatesService }          from '../rates/rates.service';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    WalletsModule,        // WalletsService (débit/crédit)
    TenantsModule,        // TenantGuard
    NotificationsModule,  // ✅ WalletNotifierService + AgentNotifierService
  ],
  controllers: [WithdrawalsController],
  providers:   [WithdrawalsService, RatesService],
  exports:     [WithdrawalsService],
})
export class WithdrawalsModule {}