// apps/backend/src/payments/payments.module.ts
import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { TenantsModule } from '../tenants/tenants.module';
import { WalletsModule } from '../wallets/wallets.module'; // ✅ v1.1 (nouveau) — requis par RechargeService

import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PaymentMethodsService } from './payment-methods.service';
import { OrangeMoneyService } from './orange-money.service';
import { SendwaveService } from './sendwave.service';
import { RechargeService } from './recharge.service'; // ✅ v1.1 (nouveau)

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    TenantsModule, // ✅ obligatoire pour TenantGuard
    WalletsModule, // ✅ v1.1 — requis par RechargeService (crédite le wallet)
  ],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    PaymentMethodsService,
    OrangeMoneyService,
    SendwaveService,
    RechargeService, // ✅ v1.1
  ],
  exports: [PaymentsService, PaymentMethodsService, RechargeService],
})
export class PaymentsModule {}