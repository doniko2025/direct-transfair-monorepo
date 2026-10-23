// apps/backend/src/withdrawals/withdrawals.module.ts
// =========================================================
// WITHDRAWALS MODULE v2.1
// ✅ v2.1 : TransactionsModule importé — un retrait rejeté / annulé / échoué ferme la transaction et rembourse
//   l'expéditeur (TransactionsService.closeFromWithdrawal). Pas de cycle : TransactionsModule n'importe pas WithdrawalsModule.
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
import { TransactionsModule }    from '../transactions/transactions.module'; // ✅ v2.1

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    WalletsModule,        // WalletsService (débit/crédit)
    TenantsModule,        // TenantGuard
    NotificationsModule,  // ✅ WalletNotifierService + AgentNotifierService
    TransactionsModule,   // ✅ v2.1 — TransactionsService (clôture + remboursement)
  ],
  controllers: [WithdrawalsController],
  providers:   [WithdrawalsService, RatesService],
  exports:     [WithdrawalsService],
})
export class WithdrawalsModule {}