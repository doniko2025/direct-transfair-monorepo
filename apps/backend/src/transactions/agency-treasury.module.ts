// apps/backend/src/transactions/agency-treasury.module.ts
// =========================================================
// AGENCY TREASURY MODULE v1.0 — Direct Transf'air
// Fichier indépendant — n'ajoute rien à transactions.module.ts
// existant, qui reste strictement inchangé.
//
// ⚠️ SEULE ACTION MANUELLE RESTANTE : enregistrer ce module dans
// app.module.ts (2 lignes) :
//
//   import { AgencyTreasuryModule } from './transactions/agency-treasury.module';
//   // ... dans le tableau imports: [...]
//   AgencyTreasuryModule,
//
// Je n'ai pas le contenu de app.module.ts, donc je ne peux pas te
// livrer ce fichier en remplacement complet sans risquer d'écraser
// d'autres modules déjà enregistrés — envoie-le moi si tu veux que
// je fasse cette dernière étape moi-même.
// =========================================================

import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { WalletsModule } from '../wallets/wallets.module';
import { MailModule } from '../mail/mail.module';
import { NotificationsModule } from '../notifications/notifications.module';

import { AgencyTreasuryController } from './agency-treasury.controller';
import { AgencyTreasuryService } from './agency-treasury.service';
import { TreasuryMailService } from '../mail/channels/treasury-mail.service';
import { TreasuryNotifierService } from '../notifications/channels/treasury-notifier.service';

@Module({
  imports: [PrismaModule, AuthModule, WalletsModule, MailModule, NotificationsModule],
  controllers: [AgencyTreasuryController],
  providers: [AgencyTreasuryService, TreasuryMailService, TreasuryNotifierService],
  exports: [AgencyTreasuryService],
})
export class AgencyTreasuryModule {}