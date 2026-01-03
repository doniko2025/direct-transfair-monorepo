// apps/backend/src/tenants/admin-tenants.controller.ts
import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { TenantProvisioningService } from './tenant-provisioning.service';
import { TenantGuard } from './tenant.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';

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

@UseGuards(TenantGuard, JwtAuthGuard, AdminGuard)
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
