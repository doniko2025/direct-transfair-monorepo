// apps/backend/src/tenants/tenant.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
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

    const client = await this.clientsService.findByCode(code);

    // ✅ CORRECTION : Si aucun client n'est trouvé, on bloque ici.
    if (!client) {
        throw new NotFoundException(`Tenant introuvable avec le code : ${code}`);
    }

    return client;
  }
}