// apps/backend/src/clients/clients.module.ts
import { Module } from '@nestjs/common';

// ✅ CORRECTION CHIRURGICALE : Import de AuthModule pour que JwtAuthGuard puisse fonctionner
import { AuthModule } from '../auth/auth.module';
// ✅ Optimisation : On importe le module complet au lieu du service isolé (comme dans tes autres fichiers)
import { PrismaModule } from '../prisma/prisma.module';

import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';

@Module({
  imports: [
    PrismaModule,
    AuthModule, // <-- C'est lui qui règle ton erreur "JwtService at index [0] is available"
  ],
  controllers: [ClientsController],
  providers: [ClientsService], // PrismaService retiré d'ici car il est fourni par PrismaModule
  exports: [ClientsService],
})
export class ClientsModule {}