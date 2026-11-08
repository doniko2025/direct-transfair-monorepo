// apps/backend/src/merchants/merchants.module.ts
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

import { AuthModule } from '../auth/auth.module';
import { KycModule } from '../kyc/kyc.module';
import { MailModule } from '../mail/mail.module';
import { PushModule } from '../push/push.module';
import { RatesModule } from '../rates/rates.module';
import { TransferLimitsModule } from '../transfer-limits/transfer-limits.module';
import { WalletsModule } from '../wallets/wallets.module';
import { MerchantAlertsService } from './merchant-alerts.service';
import { MerchantComplianceService } from './merchant-compliance.service';
import { MerchantExpiryService } from './merchant-expiry.service';
import { MerchantLogoService } from './merchant-logo.service';
import { MerchantNotifierService } from './merchant-notifier.service';
import { MerchantPaymentsController } from './merchant-payments.controller';
import { MerchantPaymentsService } from './merchant-payments.service';
import { MerchantPayoutsService } from './merchant-payouts.service';
import { MerchantReportsService } from './merchant-reports.service';
import { MerchantStaffService } from './merchant-staff.service';
import { MerchantsAdminController } from './merchants-admin.controller';
import { MerchantReceiptsController } from './merchant-receipts.controller';
import { MerchantReceiptsService } from './merchant-receipts.service';
import { MerchantsController } from './merchants.controller';
import { MerchantsExtrasController } from './merchants-extras.controller';
import { MerchantsService } from './merchants.service';
import { PinVerifierService } from './pin-verifier.service';

// PrismaModule et CompanySettingsModule sont globaux ; AuthModule fournit le JwtService de JwtAuthGuard.
@Module({
  imports: [ScheduleModule.forRoot(), AuthModule, MailModule, PushModule, KycModule, WalletsModule, TransferLimitsModule, RatesModule],
  controllers: [MerchantsController, MerchantsExtrasController, MerchantPaymentsController, MerchantsAdminController, MerchantReceiptsController],
  providers: [
    PinVerifierService,
    MerchantNotifierService,
    MerchantAlertsService,
    MerchantComplianceService,
    MerchantsService,
    MerchantLogoService,
    MerchantStaffService,
    MerchantReportsService,
    MerchantReceiptsService,
    MerchantPaymentsService,
    MerchantPayoutsService,
    MerchantExpiryService,
  ],
  exports: [MerchantsService, PinVerifierService],
})
export class MerchantsModule {}
