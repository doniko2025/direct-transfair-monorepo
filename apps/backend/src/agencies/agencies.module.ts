// apps/backend/src/agencies/agencies.module.ts
// =========================================================
// AGENCIES MODULE v4.3
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
// =========================================================

import { Module } from '@nestjs/common';
import { AgenciesService } from './agencies.service';
import { AgenciesController } from './agencies.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module'; // ✅ v4.3

@Module({
  imports: [
    PrismaModule,
    AuthModule,  // ✅ Requis pour JwtAuthGuard
    UsersModule, // ✅ v4.3 — Requis pour la synchronisation responsable
  ],
  controllers: [AgenciesController],
  providers: [AgenciesService],
  exports: [AgenciesService],
})
export class AgenciesModule {}