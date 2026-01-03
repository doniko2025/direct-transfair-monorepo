// apps/backend/src/payments/payments.module.ts
import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { TenantsModule } from '../tenants/tenants.module';

import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
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
    OrangeMoneyService,
    SendwaveService,
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
