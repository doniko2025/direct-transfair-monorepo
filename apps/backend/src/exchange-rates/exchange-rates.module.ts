// apps/backend/src/exchange-rates/exchange-rates.module.ts
import { Module }                    from '@nestjs/common';
import { ExchangeRatesController }   from './exchange-rates.controller';
import { ExchangeRatesService }      from './exchange-rates.service';
import { PrismaModule }              from '../prisma/prisma.module';

@Module({
  imports:     [PrismaModule],
  controllers: [ExchangeRatesController],
  providers:   [ExchangeRatesService],
  exports:     [ExchangeRatesService],
})
export class ExchangeRatesModule {}