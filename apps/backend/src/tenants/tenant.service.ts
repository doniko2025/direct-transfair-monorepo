// apps/backend/src/tenants/tenant.service.ts
import { Injectable } from '@nestjs/common';
import type { Client } from '@prisma/client';

import { ClientsService } from '../clients/clients.service';
import type { RequestWithTenant } from './tenant.middleware';

const DEFAULT_TENANT_CODE = 'DONIKO';

@Injectable()
export class TenantService {
  constructor(private readonly clientsService: ClientsService) {}

  async getCurrentClient(req: RequestWithTenant): Promise<Client> {
    const fromContext = req.tenantContext?.code;

    const fromLegacy =
      typeof req.tenantCode === 'string'
        ? req.tenantCode.trim().toUpperCase()
        : undefined;

    const code = (fromContext ?? fromLegacy ?? DEFAULT_TENANT_CODE)
      .trim()
      .toUpperCase();

    return this.clientsService.findByCode(code);
  }
}
