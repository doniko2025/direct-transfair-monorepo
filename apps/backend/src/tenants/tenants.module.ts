// apps/backend/src/tenants/tenants.module.ts
import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { ClientsModule } from '../clients/clients.module';
import { PlatformModule } from '../platform/platform.module';
import { AuthModule } from '../auth/auth.module';

import { TenantService } from './tenant.service';
import { TenantResolverService } from './tenant-resolver.service';
import { TenantGuard } from './tenant.guard';

import { TenantProvisioningService } from './tenant-provisioning.service';
import { AdminTenantsController } from './admin-tenants.controller';

@Module({
  imports: [PrismaModule, ClientsModule, PlatformModule, AuthModule],
  controllers: [AdminTenantsController],
  providers: [TenantService, TenantResolverService, TenantGuard, TenantProvisioningService],
  exports: [TenantService, TenantResolverService, TenantGuard, TenantProvisioningService],
})
export class TenantsModule {}
