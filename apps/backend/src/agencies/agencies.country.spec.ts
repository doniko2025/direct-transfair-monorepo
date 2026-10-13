// apps/backend/src/agencies/agencies.country.spec.ts
// Phase 6 — changer le pays d'une agence = devise locale + caisse correspondante.
import 'reflect-metadata';
import { BadRequestException } from '@nestjs/common';
import { AgenciesService } from './agencies.service';

function make(existingWallet: any = null) {
  const tx: any = {
    agency: { update: jest.fn().mockImplementation(async ({ data }: any) => ({ id: 'a1', clientId: 5, ...data })) },
    wallet: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findUnique: jest.fn().mockResolvedValue(existingWallet),
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
    },
    user: { findFirst: jest.fn(), update: jest.fn() },
  };
  const prisma: any = {
    agency: { findFirst: jest.fn().mockResolvedValue({ id: 'a1', clientId: 5, email: 'a@x.com', manager: null, agents: [] }) },
    $transaction: jest.fn(async (fn: any) => fn(tx)),
  };
  const service = new (AgenciesService as any)(prisma, { update: jest.fn() }, { sendEmail: jest.fn() }) as AgenciesService;
  return { service, prisma, tx };
}

describe('AgenciesService.update — changement de pays', () => {
  it('prend la devise locale et crée la caisse principale dans cette devise', async () => {
    const { service, tx } = make(null);
    await service.update('a1', 5, { country: 'GN' } as any);
    const data = tx.agency.update.mock.calls[0][0].data;
    expect(data).toMatchObject({ country: 'GN', primaryCurrency: 'GNF' });
    expect(tx.wallet.updateMany).toHaveBeenCalledWith({
      where: { agencyId: 'a1', currency: { not: 'GNF' }, isDefault: true },
      data: { isDefault: false },
    });
    expect(tx.wallet.create).toHaveBeenCalledWith({
      data: { agencyId: 'a1', currency: 'GNF', balance: 0, isDefault: true, isActive: true },
    });
  });

  it('accepte le nom du pays (« Guinée » donnait XOF avant) et le normalise en code', async () => {
    const { service, tx } = make(null);
    await service.update('a1', 5, { country: 'Guinée' } as any);
    expect(tx.agency.update.mock.calls[0][0].data).toMatchObject({ country: 'GN', primaryCurrency: 'GNF' });
  });

  it('caisse déjà existante mais désactivée ou non principale : réactivée et passée principale, rien de recréé', async () => {
    const { service, tx } = make({ id: 'w9', isDefault: false, isActive: false });
    await service.update('a1', 5, { country: 'FR' } as any);
    expect(tx.wallet.create).not.toHaveBeenCalled();
    expect(tx.wallet.update).toHaveBeenCalledWith({ where: { id: 'w9' }, data: { isDefault: true, isActive: true } });
  });

  it('pays inconnu → 400, aucune écriture', async () => {
    const { service, prisma } = make();
    await expect(service.update('a1', 5, { country: 'Atlantide' } as any)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('sans pays dans la requête : aucune caisse touchée', async () => {
    const { service, tx } = make();
    await service.update('a1', 5, { name: 'Nouveau nom' } as any);
    expect(tx.wallet.updateMany).not.toHaveBeenCalled();
    expect(tx.wallet.create).not.toHaveBeenCalled();
  });
});
