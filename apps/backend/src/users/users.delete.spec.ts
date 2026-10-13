// apps/backend/src/users/users.delete.spec.ts
// Phase 6 — un compte qui a encore un solde ou des fonds réservés ne se supprime pas.
import 'reflect-metadata';
import { ConflictException } from '@nestjs/common';
import { UsersService } from './users.service';

function make(wallets: any[], user: any = { id: 'u1', deletedAt: null, email: 'a@x.com' }) {
  const tx: any = {
    wallet: { findMany: jest.fn().mockResolvedValue(wallets) },
    user: { update: jest.fn().mockResolvedValue({ id: 'u1', email: 'deleted_x', deletedAt: new Date(), isActive: false }) },
  };
  const prisma: any = {
    user: { findUnique: jest.fn().mockResolvedValue(user) },
    $transaction: jest.fn(async (fn: any) => fn(tx)),
  };
  return { service: new UsersService(prisma), tx };
}

describe('UsersService.softDelete — solde', () => {
  it('refuse (409 BALANCE_NOT_EMPTY) si un wallet a un solde', async () => {
    const { service, tx } = make([{ currency: 'XOF', balance: 12000, reservedBalance: 0 }]);
    const err: any = await service.softDelete('u1').catch((e) => e);
    expect(err).toBeInstanceOf(ConflictException);
    expect(err.getResponse()).toMatchObject({ code: 'BALANCE_NOT_EMPTY', balances: [{ currency: 'XOF', balance: 12000, reserved: 0 }] });
    expect(err.message).toContain('12000 XOF');
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it('refuse aussi quand seuls des fonds sont réservés', async () => {
    const { service, tx } = make([{ currency: 'EUR', balance: 0, reservedBalance: 50 }]);
    await expect(service.softDelete('u1')).rejects.toBeInstanceOf(ConflictException);
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it('supprime quand tous les wallets sont à zéro, et libère email et téléphone', async () => {
    const { service, tx } = make([
      { currency: 'XOF', balance: 0, reservedBalance: 0 },
      { currency: 'EUR', balance: 0, reservedBalance: 0 },
    ]);
    const r: any = await service.softDelete('u1');
    expect(r.deleted).toBe(true);
    expect(r.email).toBe('a@x.com');
    const data = tx.user.update.mock.calls[0][0].data;
    expect(data).toMatchObject({ isActive: false, isSuspended: true, phone: null });
    expect(data.email).toMatch(/^deleted_\d+_a@x\.com$/);
  });

  it('compte sans wallet : suppression possible', async () => {
    const { service, tx } = make([]);
    await service.softDelete('u1');
    expect(tx.user.update).toHaveBeenCalledTimes(1);
  });

  it('compte déjà supprimé : réponse inchangée, aucune vérification', async () => {
    const { service, tx } = make([{ currency: 'XOF', balance: 5, reservedBalance: 0 }], { id: 'u1', deletedAt: new Date(), email: 'x' });
    const r: any = await service.softDelete('u1');
    expect(r.deleted).toBe(true);
    expect(tx.wallet.findMany).not.toHaveBeenCalled();
  });
});
