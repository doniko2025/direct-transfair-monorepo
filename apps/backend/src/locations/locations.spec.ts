// apps/backend/src/locations/locations.spec.ts
// Passe 2 (phase 6) — GET /locations ne renvoie que les agences de la société de l'en-tête x-tenant-id.
import 'reflect-metadata';
import { LocationsService } from './locations.service';

function make(client: any = { id: 7 }) {
  const prisma: any = {
    client: { findFirst: jest.fn().mockResolvedValue(client) },
    agency: { findMany: jest.fn().mockResolvedValue([{ id: 'a1' }]) },
  };
  return { service: new LocationsService(prisma), prisma };
}

describe('LocationsService.findPublic', () => {
  it('filtre sur la société du code reçu, agences actives et non supprimées', async () => {
    const { service, prisma } = make();
    expect(await service.findPublic(' doniko ')).toEqual([{ id: 'a1' }]);
    expect(prisma.client.findFirst.mock.calls[0][0].where).toMatchObject({ code: 'DONIKO', isActive: true, deletedAt: null });
    expect(prisma.agency.findMany.mock.calls[0][0].where).toEqual({ clientId: 7, isActive: true, deletedAt: null });
  });

  it('sans en-tête : liste vide, aucune requête sur les agences', async () => {
    const { service, prisma } = make();
    expect(await service.findPublic(undefined)).toEqual([]);
    expect(await service.findPublic('  ')).toEqual([]);
    expect(prisma.agency.findMany).not.toHaveBeenCalled();
  });

  it('société inconnue ou inactive : liste vide', async () => {
    const { service, prisma } = make(null);
    expect(await service.findPublic('INCONNUE')).toEqual([]);
    expect(prisma.agency.findMany).not.toHaveBeenCalled();
  });
});
