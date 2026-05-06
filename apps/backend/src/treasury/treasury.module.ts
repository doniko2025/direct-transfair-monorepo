// apps/backend/src/treasury/treasury.module.ts
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

import { TreasuryService } from './treasury.service';
import { TreasuryController } from './treasury.controller';
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
  controllers: [TreasuryController],
  providers: [TreasuryService],
  exports: [TreasuryService],
})
export class TreasuryModule {}