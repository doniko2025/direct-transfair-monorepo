// apps/backend/src/locations/locations.service.ts
// =========================================================
// ✅ v1.2 (phase 7) : l'alias historique « 10 » et le code de la société système viennent de la configuration plateforme (plus de « DONIKO » en dur).
// LOCATIONS SERVICE v1.3 — Direct Transf'air
// ✅ v1.3 : findForClient() — agences de la société d'un utilisateur connecté, avec l'email de contact (route GET /locations/contacts).
// ✅ Endpoint PUBLIC — aucune donnée sensible exposée
//    (pas de solde, pas de clientId, pas d'infos admin)
// ✅ Retourne uniquement les agences actives
// ✅ v1.1 (phase 6, passe 2) : une seule société (code reçu dans x-tenant-id) ; agences supprimées exclues.
// =========================================================

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { platform } from '../common/platform.config';

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

/** Version « connecté » : ajoute l'email de contact de l'agence. */
export interface LocationContactDto extends PublicLocationDto {
  email: string | null;
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
      where: { code: platform.canonicalCode(code), isActive: true, deletedAt: null },
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

  /**
   * ✅ v1.3 — Agences de la société d'un utilisateur CONNECTÉ, avec l'email de contact de l'agence.
   * Pourquoi une route à part : l'email d'une agence est aussi l'identifiant de connexion de son responsable. La liste publique
   * (findPublic) ne le sert donc toujours pas ; seule une personne authentifiée, et seulement pour SA société (clientId du jeton,
   * jamais un paramètre), peut le lire.
   */
  async findForClient(clientId?: number | null): Promise<LocationContactDto[]> {
    if (!clientId) return [];
    return this.prisma.agency.findMany({
      where: { clientId, isActive: true, deletedAt: null },
      select: {
        id: true, name: true, address: true, city: true, country: true,
        primaryCurrency: true, isActive: true, phone: true, email: true,
      },
      orderBy: [{ country: 'asc' }, { city: 'asc' }, { name: 'asc' }],
    });
  }
}
