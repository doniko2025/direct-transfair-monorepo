// src/transactions/transactions.module.ts
import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { TenantsModule } from '../tenants/tenants.module';
import { AuthModule } from '../auth/auth.module';

import { TransactionsController } from './transactions.controller';
import { AdminTransactionsController } from './admin-transactions.controller';
import { TransactionsService } from './transactions.service';

@Module({
  imports: [
    PrismaModule,
    TenantsModule,
    AuthModule,
  ],
  controllers: [
    TransactionsController,
    AdminTransactionsController, // 👈 OBLIGATOIRE
  ],
  providers: [TransactionsService],
  exports: [TransactionsService],
})
export class TransactionsModule {}
