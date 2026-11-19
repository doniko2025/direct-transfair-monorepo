// Audit argent (I5) — on ne désactive ni une agence ni une société qui détient encore de l'argent.
import 'reflect-metadata';
import { ConflictException } from '@nestjs/common';
import { AgenciesService } from './agencies.service';
import { ClientsService } from '../clients/clients.service';

function agencyMake(funds: any[]) {
  const tx: any = {
    wallet: { findMany: jest.fn().mockResolvedValue(funds), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    otpLog: { deleteMany: jest.fn() }, userDevice: { deleteMany: jest.fn() }, userSession: { updateMany: jest.fn() },
    user: { updateMany: jest.fn(), findMany: jest.fn().mockResolvedValue([]), update: jest.fn() },
    agency: { update: jest.fn().mockResolvedValue({ id: 'a1', isActive: false }) },
  };
  const prisma: any = {
    agency: { findFirst: jest.fn().mockResolvedValue({ id: 'a1', clientId: 7, agents: [{ id: 'ag1' }], wallets: [] }) },
    $transaction: jest.fn(async (fn: any) => fn(tx)),
  };
  const service: any = new (AgenciesService as any)(prisma, {}, {});
  service.serializeAgency = (a: any) => a;
  return { service: service as AgenciesService, tx };
}

function clientMake(funds: any[]) {
  const tx: any = {
    wallet: { findMany: jest.fn().mockResolvedValue(funds), updateMany: jest.fn() },
    otpLog: { deleteMany: jest.fn() }, userDevice: { deleteMany: jest.fn() }, userSession: { updateMany: jest.fn() },
    user: { updateMany: jest.fn(), update: jest.fn() }, agency: { updateMany: jest.fn() },
    client: { update: jest.fn().mockResolvedValue({ id: 7 }) },
  };
  const prisma: any = {
    client: { findUnique: jest.fn().mockResolvedValue({ id: 7, code: 'ACME', deletedAt: null, wallets: [] }) },
    user: { findMany: jest.fn().mockResolvedValue([{ id: 'u1', email: 'a@x.com' }]) },
    agency: { findMany: jest.fn().mockResolvedValue([{ id: 'a1' }]) },
    $transaction: jest.fn(async (fn: any) => fn(tx)),
  };
  return { service: new (ClientsService as any)(prisma, {}) as ClientsService, tx };
}

describe('désactivation d’une agence', () => {
  it('refusée (409) si la caisse ou un agent détient de l’argent : rien n’est désactivé', async () => {
    const { service, tx } = agencyMake([{ currency: 'XOF', balance: 25000, reservedBalance: 0 }]);
    const err: any = await service.remove('a1', 7).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ConflictException);
    expect(err.getResponse()).toMatchObject({ code: 'BALANCE_NOT_EMPTY' });
    expect(tx.agency.update).not.toHaveBeenCalled();
    expect(tx.wallet.updateMany).not.toHaveBeenCalled();
  });

  it('autorisée quand tout est à zéro', async () => {
    const { service, tx } = agencyMake([{ currency: 'XOF', balance: 0, reservedBalance: 0 }]);
    await service.remove('a1', 7);
    expect(tx.agency.update).toHaveBeenCalled();
  });
});

describe('désactivation d’une société', () => {
  it('refusée (409) si un portefeuille détient de l’argent', async () => {
    const { service, tx } = clientMake([{ currency: 'EUR', balance: 12, reservedBalance: 0 }]);
    const err: any = await service.remove(7).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ConflictException);
    expect(err.getResponse()).toMatchObject({ code: 'BALANCE_NOT_EMPTY' });
    expect(tx.client.update).not.toHaveBeenCalled();
  });

  it('autorisée quand tout est à zéro', async () => {
    const { service, tx } = clientMake([]);
    await service.remove(7);
    expect(tx.client.update).toHaveBeenCalled();
  });
});
