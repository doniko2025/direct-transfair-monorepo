// apps/backend/src/payments/payments.module.ts
import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { TenantsModule } from '../tenants/tenants.module';

import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PaymentMethodsService } from './payment-methods.service';
import { OrangeMoneyService } from './orange-money.service';
import { SendwaveService } from './sendwave.service';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    TenantsModule, // ✅ obligatoire pour TenantGuard
  ],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    PaymentMethodsService,
    OrangeMoneyService,
    SendwaveService,
  ],
  exports: [PaymentsService, PaymentMethodsService],
})
export class PaymentsModule {}