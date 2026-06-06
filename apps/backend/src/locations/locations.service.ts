// apps/backend/src/locations/locations.service.ts
// =========================================================
// LOCATIONS SERVICE v1.0 — Direct Transf'air
// ✅ Endpoint PUBLIC — aucune donnée sensible exposée
//    (pas de solde, pas de clientId, pas d'infos admin)
// ✅ Retourne uniquement les agences actives
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
   * Retourne toutes les agences actives avec uniquement les champs publics.
   * Aucun solde, aucune donnée financière ou administrative n'est exposé.
   */
  async findPublic(): Promise<PublicLocationDto[]> {
    const agencies = await this.prisma.agency.findMany({
      where: { isActive: true },
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

    return agencies;
  }
}