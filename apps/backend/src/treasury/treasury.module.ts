// apps/backend/src/treasury/treasury.module.ts
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

import { TreasuryService } from './treasury.service';
import { TreasuryController } from './treasury.controller';
import { TreasuryWithdrawalsController } from './treasury-withdrawals.controller';
import { TreasuryWithdrawalsService } from './treasury-withdrawals.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { RatesModule } from '../rates/rates.module';
import { WalletsModule } from '../wallets/wallets.module'; // ✅ REQUIS

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    RatesModule,
    WalletsModule, // ✅ Injecte WalletsService dans TreasuryService
  ],
  controllers: [TreasuryController, TreasuryWithdrawalsController],
  providers: [TreasuryService, TreasuryWithdrawalsService],
  exports: [TreasuryService],
})
export class TreasuryModule {}