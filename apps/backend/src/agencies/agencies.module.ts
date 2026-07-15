// apps/backend/src/agencies/agencies.module.ts
// =========================================================
// AGENCIES MODULE v4.4
// ✅ v4.3 : Ajout de UsersModule — nécessaire pour injecter
//   UsersService dans AgenciesService (synchronisation
//   téléphone/nom du responsable d'agence, voir agencies.service.ts).
//
//   ⚠️ HYPOTHÈSE : ce fichier suppose que ton module s'appelle
//   `UsersModule`, se trouve à `../users/users.module`, et exporte
//   `UsersService` dans son tableau `exports`. C'est quasi certain
//   (AuthService injecte déjà UsersService dans son constructeur, ce
//   qui n'est possible que si UsersModule l'exporte déjà) — mais si
//   le nom de fichier/classe diffère chez toi, adapte l'import
//   ci-dessous en conséquence.
//
// ✅ v4.4 : 🚨 FIX — MailModule manquant
//
//   PROBLÈME RÉSOLU (juillet 2026) :
//   agencies.service.ts v4.4 a injecté MailService dans son
//   constructeur (pour envoyer le mot de passe temporaire généré à la
//   création d'une agence — voir son changelog, correctif du mot de
//   passe en dur '123456'). Ce module n'importait aucun module mail :
//   sans MailModule ici, Nest ne peut pas résoudre les dépendances
//   d'AgenciesService et l'application plante au démarrage avec
//   "Can't resolve dependencies of AgenciesService (?, UsersService,
//   MailService)".
//   CORRECTIF : import de MailModule ajouté.
//   ⚠️ HYPOTHÈSE (même nature que celle sur UsersModule ci-dessus) :
//   ce fichier suppose que le module qui fournit MailService s'appelle
//   `MailModule`, se trouve à `../mail/mail.module`, et l'exporte.
//   C'est la convention de nommage strictement suivie par TOUS les
//   autres modules vus dans ce projet (PrismaModule/prisma.module,
//   AuthModule/auth.module, UsersModule/users.module, RatesModule/
//   rates.module, WalletsModule/wallets.module...), donc une
//   inférence à haute confiance — mais non vérifiée directement,
//   n'ayant pas eu ce fichier précis sous les yeux. Si le nom diffère
//   chez toi, adapte l'import.
// =========================================================

import { Module } from '@nestjs/common';
import { AgenciesService } from './agencies.service';
import { AgenciesController } from './agencies.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module'; // ✅ v4.3
import { MailModule } from '../mail/mail.module';     // ✅ v4.4

@Module({
  imports: [
    PrismaModule,
    AuthModule,  // ✅ Requis pour JwtAuthGuard
    UsersModule, // ✅ v4.3 — Requis pour la synchronisation responsable
    MailModule,  // ✅ v4.4 — Requis pour l'email du mot de passe temporaire
  ],
  controllers: [AgenciesController],
  providers: [AgenciesService],
  exports: [AgenciesService],
})
export class AgenciesModule {}