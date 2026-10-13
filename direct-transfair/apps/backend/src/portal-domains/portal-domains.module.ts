// apps/backend/src/portal-domains/portal-domains.module.ts
// v1.0 — domaines des portails de sociétés (lot C). Module isolé : aucun module existant n'est modifié, hormis son import.
import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PortalDomainsController } from './portal-domains.controller';
import { PortalDomainsScheduler } from './portal-domains.scheduler';
import { PortalDomainsService } from './portal-domains.service';
import { CloudflareClient } from './providers/cloudflare.client';
import { VercelClient } from './providers/vercel.client';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [PortalDomainsController],
  providers: [PortalDomainsService, PortalDomainsScheduler, CloudflareClient, VercelClient],
  exports: [PortalDomainsService],
})
export class PortalDomainsModule {}
