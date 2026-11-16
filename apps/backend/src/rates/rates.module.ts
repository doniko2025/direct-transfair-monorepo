//apps/backend/src/rates/rates.module.ts
// ✅ v2.1 : plus de contrôleur — l'ancienne route POST /rates (jamais appelée) est supprimée ; l'administration des taux
//   passe par /rates-admin (historique, audit, garde-fou de variation). Ce module ne fournit plus que RatesService.
import { Module } from '@nestjs/common';
import { RatesService } from './rates.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [RatesService],
  exports: [RatesService],
})
export class RatesModule {}
