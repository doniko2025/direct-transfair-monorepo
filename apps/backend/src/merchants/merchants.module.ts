// apps/backend/src/merchants/merchants.module.ts
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

import { AuthModule } from '../auth/auth.module';
import { KycModule } from '../kyc/kyc.module';
import { MailModule } from '../mail/mail.module';
import { PushModule } from '../push/push.module';
import { WalletsModule } from '../wallets/wallets.module';
import { MerchantExpiryService } from './merchant-expiry.service';
import { MerchantNotifierService } from './merchant-notifier.service';
import { MerchantPaymentsController } from './merchant-payments.controller';
import { MerchantPaymentsService } from './merchant-payments.service';
import { MerchantPayoutsService } from './merchant-payouts.service';
import { MerchantsAdminController } from './merchants-admin.controller';
import { MerchantsController } from './merchants.controller';
import { MerchantsService } from './merchants.service';
import { PinVerifierService } from './pin-verifier.service';

// PrismaModule et CompanySettingsModule sont globaux ; AuthModule fournit le JwtService de JwtAuthGuard.
@Module({
  imports: [ScheduleModule.forRoot(), AuthModule, MailModule, PushModule, KycModule, WalletsModule],
  controllers: [MerchantsController, MerchantPaymentsController, MerchantsAdminController],
  providers: [PinVerifierService, MerchantNotifierService, MerchantsService, MerchantPaymentsService, MerchantPayoutsService, MerchantExpiryService],
  exports: [MerchantsService, PinVerifierService],
})
export class MerchantsModule {}
