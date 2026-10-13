// apps/backend/src/tenants/admin-tenants.controller.ts
import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { TenantProvisioningService } from './tenant-provisioning.service';
import { TenantGuard } from './tenant.guard';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

type ProvisionTenantDto = {
  code: string;
  name: string;
  databaseUrl: string;
  createDatabase?: boolean;
};

type SetActiveDto = {
  code: string;
  isActive: boolean;
};

// ✅ phase 6 (passe 2) : réservé au SUPER_ADMIN. Avant, AdminGuard laissait passer l'admin de n'importe quelle
// société : il pouvait lister les sociétés avec l'adresse de leur base (identifiants compris), en désactiver une,
// ou provisionner un « tenant » vers une base de son choix (connexion pg + `prisma migrate deploy` dessus).
@UseGuards(TenantGuard, JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
@Controller('admin/tenants')
export class AdminTenantsController {
  constructor(private readonly provisioning: TenantProvisioningService) {}

  @Get()
  async list() {
    return this.provisioning.listTenants();
  }

  @Post('provision')
  async provision(@Body() dto: ProvisionTenantDto) {
    return this.provisioning.provisionTenant(dto);
  }

  @Patch('active')
  async setActive(@Body() dto: SetActiveDto) {
    await this.provisioning.setTenantActive(dto.code, dto.isActive);
    return { ok: true };
  }
}
