// apps/backend/src/wallets/wallets.module.ts
import { Module } from '@nestjs/common';

import { WalletsService } from './wallets.service';
import { WalletsController } from './wallets.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { RatesModule } from '../rates/rates.module';

@Module({
  imports: [PrismaModule, AuthModule, RatesModule],
  controllers: [WalletsController],
  providers: [WalletsService],
  exports: [WalletsService],
})
export class WalletsModule {}