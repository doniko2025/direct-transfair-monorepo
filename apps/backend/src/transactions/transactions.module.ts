// src/transactions/transactions.module.ts
import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { TenantsModule } from '../tenants/tenants.module';
import { AuthModule } from '../auth/auth.module';
// ✅ IMPORT DU MODULE DE TAUX (Indispensable pour la conversion)
import { RatesModule } from '../rates/rates.module';

import { TransactionsController } from './transactions.controller';
import { AdminTransactionsController } from './admin-transactions.controller';
import { TransactionsService } from './transactions.service';

@Module({
  imports: [
    PrismaModule,
    TenantsModule,
    AuthModule,
    RatesModule, // ✅ AJOUTÉ ICI : Rend RatesService accessible à TransactionsService
  ],
  controllers: [
    TransactionsController,
    AdminTransactionsController,
  ],
  providers: [TransactionsService],
  exports: [TransactionsService],
})
export class TransactionsModule {}