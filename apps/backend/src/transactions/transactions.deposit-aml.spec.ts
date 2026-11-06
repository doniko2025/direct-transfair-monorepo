// apps/backend/src/transactions/transactions.deposit-aml.spec.ts
// Audit argent (v4.33) — scoring anti-blanchiment du dépôt, avec les taux ENREGISTRÉS (plus de table en dur).
import 'reflect-metadata';
import { TransactionStatus as S, TransactionType as T } from '@prisma/client';
import { TransactionsService } from './transactions.service';

function build(opts: { recent?: Array<{ amount: number; currency: string }>; convert?: jest.Mock; userCreatedAt?: Date } = {}) {
  const flags: any[] = [];
  const updates: any[] = [];
  const prisma: any = {
    transaction: {
      findMany: jest.fn().mockResolvedValue(opts.recent ?? []),
      update: jest.fn().mockImplementation(async (a: any) => { updates.push(a); return a; }),
    },
    user: { findUnique: jest.fn().mockResolvedValue({ createdAt: opts.userCreatedAt ?? new Date('2020-01-01') }) },
    amlFlag: { create: jest.fn().mockImplementation(async (a: any) => { flags.push(a.data); return a; }) },
  };
  const rates: any = { convert: opts.convert ?? jest.fn(async (v: number, from: string) => (from === 'EUR' ? v * 656 : v)) };
  const none: any = {};
  const service = new (TransactionsService as any)(prisma, rates, {}, {}, none, {}, {}, {}, {}, {}, {}, {}, {}, none, {}) as TransactionsService;
  return { service, prisma, rates, flags, updates };
}

describe('scoreAml — dépôt en agence', () => {
  it('le sujet est le CLIENT qui reçoit le cash : on compte ses dépôts payés des dernières 24 h', async () => {
    const { service, prisma } = build();
    await service.scoreAml('dep1', 'client1', 50_000, 'XOF', 'DEPOSIT');
    const where = prisma.transaction.findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({ recipientId: 'client1', type: T.DEPOSIT, status: S.PAID, id: { not: 'dep1' } });
    expect(where.senderId).toBeUndefined();
  });

  it('gros dépôt + compte récent + rafale : signalé (AmlFlag au nom du client, libellé « Dépôt en agence »)', async () => {
    const recent = Array.from({ length: 6 }, () => ({ amount: 400_000, currency: 'XOF' }));
    const { service, flags, updates } = build({ recent, userCreatedAt: new Date(Date.now() - 2 * 86_400_000) });
    await service.scoreAml('dep1', 'client1', 3_000_000, 'XOF', 'DEPOSIT');
    expect(updates[0].data).toMatchObject({ isFlagged: true });
    expect(flags).toHaveLength(1);
    expect(flags[0]).toMatchObject({ userId: 'client1', transactionId: 'dep1' });
    expect(flags[0].reason).toMatch(/^Dépôt en agence — /);
  });

  it('petit dépôt, compte ancien : pas de signalement', async () => {
    const { service, flags, updates } = build();
    await service.scoreAml('dep1', 'client1', 50_000, 'XOF', 'DEPOSIT');
    expect(updates[0].data).toMatchObject({ riskScore: 0, isFlagged: false });
    expect(flags).toHaveLength(0);
  });

  it('un montant en EUR est converti avec le taux enregistré (5 000 € ≈ 3,28 M XOF > seuil)', async () => {
    const { service, rates, updates } = build();
    await service.scoreAml('dep1', 'client1', 5_000, 'EUR', 'DEPOSIT');
    expect(rates.convert).toHaveBeenCalledWith(5_000, 'EUR', 'XOF');
    expect(updates[0].data.riskScore).toBeGreaterThanOrEqual(40);
  });

  it('taux indisponible : rien n\'est deviné, l\'opération est signalée pour revue manuelle', async () => {
    const convert = jest.fn().mockRejectedValue(new Error('pas de taux'));
    const { service, flags } = build({ convert });
    await service.scoreAml('dep1', 'client1', 5_000, 'EUR', 'DEPOSIT');
    expect(flags).toHaveLength(1);
    expect(flags[0].reason).toMatch(/Taux de change indisponible/);
  });

  it('le mode envoi (par défaut) continue de compter les envois de l\'expéditeur', async () => {
    const { service, prisma } = build();
    await service.scoreAml('t1', 'sender1', 10_000, 'XOF');
    const where = prisma.transaction.findMany.mock.calls[0][0].where;
    expect(where.senderId).toBe('sender1');
    expect(where.recipientId).toBeUndefined();
  });
});
