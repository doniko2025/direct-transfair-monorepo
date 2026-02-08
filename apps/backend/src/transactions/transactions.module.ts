// src/transactions/transactions.module.ts
import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { TenantsModule } from '../tenants/tenants.module';
import { AuthModule } from '../auth/auth.module';
import { RatesModule } from '../rates/rates.module';
// ✅ Import nécessaire pour l'injection dans TransactionsService
import { CommissionsModule } from '../commissions/commissions.module';

import { TransactionsController } from './transactions.controller';
import { AdminTransactionsController } from './admin-transactions.controller';
import { TransactionsService } from './transactions.service';

@Module({
  imports: [
    PrismaModule,
    TenantsModule,
    AuthModule,
    RatesModule,
    CommissionsModule, // ✅ INDISPENSABLE
  ],
  controllers: [
    TransactionsController,
    AdminTransactionsController,
  ],
  providers: [TransactionsService],
  exports: [TransactionsService],
})
export class TransactionsModule {}