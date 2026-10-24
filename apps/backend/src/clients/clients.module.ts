//apps/backend/src/clients/clients.module.ts
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';
import { BrandingController } from './branding.controller'; // ✅ Import manquant
import { ContractsModule } from '../contracts/contracts.module'; // ✅ v4.16 : contrat émis à la création

@Module({
  imports: [PrismaModule, AuthModule, ContractsModule],
  controllers: [ClientsController, BrandingController], // ✅ Fonctionne maintenant
  providers: [ClientsService],
  exports: [ClientsService],
})
export class ClientsModule {}