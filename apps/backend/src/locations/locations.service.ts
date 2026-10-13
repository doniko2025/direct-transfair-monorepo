// apps/backend/src/locations/locations.service.ts
// =========================================================
// LOCATIONS SERVICE v1.1 — Direct Transf'air
// ✅ Endpoint PUBLIC — aucune donnée sensible exposée
//    (pas de solde, pas de clientId, pas d'infos admin)
// ✅ Retourne uniquement les agences actives
// ✅ v1.1 (phase 6, passe 2) : une seule société (code reçu dans x-tenant-id) ; agences supprimées exclues.
// =========================================================

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface PublicLocationDto {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  country: string | null;
  primaryCurrency: string | null;
  isActive: boolean;
  phone: string | null;
}

@Injectable()
export class LocationsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Agences actives d'UNE société, avec uniquement les champs publics.
   * Aucun solde, aucune donnée financière ou administrative n'est exposé.
   */
  async findPublic(tenantRaw?: string): Promise<PublicLocationDto[]> {
    const code = String(tenantRaw ?? '').trim().toUpperCase();
    if (!code) return [];

    const client = await this.prisma.client.findFirst({
      where: { code: code === '10' ? 'DONIKO' : code, isActive: true, deletedAt: null },
      select: { id: true },
    });
    if (!client) return [];

    return this.prisma.agency.findMany({
      where: { clientId: client.id, isActive: true, deletedAt: null },
      select: {
        id:              true,
        name:            true,
        address:         true,
        city:            true,
        country:         true,
        primaryCurrency: true,
        isActive:        true,
        phone:           true,
      },
      orderBy: [
        { country: 'asc' },
        { city:    'asc' },
        { name:    'asc' },
      ],
    });
  }
}
