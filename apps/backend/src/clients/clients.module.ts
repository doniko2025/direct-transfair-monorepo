//apps/backend/src/clients/clients.module.ts
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';
import { BrandingController } from './branding.controller'; // ✅ Import manquant

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [ClientsController, BrandingController], // ✅ Fonctionne maintenant
  providers: [ClientsService],
  exports: [ClientsService],
})
export class ClientsModule {}