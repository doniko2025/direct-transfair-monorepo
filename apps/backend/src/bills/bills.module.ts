// apps/backend/src/bills/bills.module.ts
import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { KycModule } from '../kyc/kyc.module';
import { MailModule } from '../mail/mail.module';
import { MerchantsModule } from '../merchants/merchants.module';
import { PushModule } from '../push/push.module';
import { RatesModule } from '../rates/rates.module';
import { WalletsModule } from '../wallets/wallets.module';
import { BillsAdminController } from './bills-admin.controller';
import { BillsAdminService } from './bills-admin.service';
import { BillsReconcileService } from './bills-reconcile.service';
import { BillsWebhookController } from './bills-webhook.controller';
import { BillsWebhookService } from './bills-webhook.service';
import { BillsController } from './bills.controller';
import { BillConnectorsService } from './bills.connectors';
import { BillsNotifierService } from './bills-notifier.service';
import { BillsRecurringService } from './bills-recurring.service';
import { BillsService } from './bills.service';
import { BillsSettlementService } from './bills-settlement.service';

// PrismaModule et CompanySettingsModule sont globaux ; AuthModule fournit le JwtService de JwtAuthGuard ;
// MerchantsModule exporte PinVerifierService (même code secret que pour les paiements marchands).
@Module({
  imports: [AuthModule, MailModule, PushModule, KycModule, WalletsModule, RatesModule, MerchantsModule],
  controllers: [BillsController, BillsAdminController, BillsWebhookController],
  providers: [BillConnectorsService, BillsNotifierService, BillsSettlementService, BillsService, BillsRecurringService, BillsAdminService, BillsReconcileService, BillsWebhookService],
  exports: [BillsService, BillConnectorsService],
})
export class BillsModule {}
