// apps/backend/src/commissions/commissions.ledger.spec.ts
// Lot 2c (v5.2) — journal des commissions paginé, totaux calculés sur toute la période.
import 'reflect-metadata';
import { CommissionsService, normalizePaging } from './commissions.service';

const entry = (id: string, walletId: string, amount: number) => ({
  id, createdAt: new Date('2026-10-01T10:00:00Z'), amount, currency: 'XOF', description: 'Commission paiement X',
  balanceAfter: 1000, transactionId: `t-${id}`, walletId,
  transaction: { reference: `R-${id}`, amount: 10_000, fees: 500, sender: null, beneficiary: { fullName: 'Bénéficiaire' } },
});

function make(opts: { entries: any[]; groups: any[]; agencyWallets?: any[]; companyWallets?: any[] }) {
  const prisma: any = {
    wallet: {
      findMany: jest.fn().mockImplementation(({ where }: any) =>
        Promise.resolve(where.agencyId !== undefined ? (opts.agencyWallets ?? [{ id: 'wa' }]) : (opts.companyWallets ?? [{ id: 'wc' }])),
      ),
    },
    agency: { findMany: jest.fn().mockResolvedValue([{ id: 'ag1', name: 'Agence 1' }]) },
    ledgerEntry: {
      findMany: jest.fn().mockResolvedValue(opts.entries),
      groupBy: jest.fn().mockResolvedValue(opts.groups),
    },
  };
  return { service: new CommissionsService(prisma), prisma };
}

describe('normalizePaging', () => {
  it('valeurs par défaut et bornes', () => {
    expect(normalizePaging(undefined, undefined)).toEqual({ page: 1, limit: 100 });
    expect(normalizePaging('0', '-5')).toEqual({ page: 1, limit: 100 });
    expect(normalizePaging('abc', '99999')).toEqual({ page: 1, limit: 500 });
    expect(normalizePaging('3', '20')).toEqual({ page: 3, limit: 20 });
  });
});

describe('CommissionsService — journal paginé', () => {
  it('agent : demande limit+1 écritures avec skip, totaux issus de groupBy (pas de la page)', async () => {
    const { service, prisma } = make({
      entries: [entry('1', 'wa', 100), entry('2', 'wa', 100), entry('3', 'wa', 100)],
      groups: [{ walletId: 'wa', currency: 'XOF', _sum: { amount: 12_345 }, _count: { _all: 250 } }],
    });
    const r: any = await service.getMyLedgerCommissions(5, 'ag1', 'all', '2', '2');
    const call = prisma.ledgerEntry.findMany.mock.calls[0][0];
    expect(call.skip).toBe(2);
    expect(call.take).toBe(3);
    expect(r.entries).toHaveLength(2);
    expect(r.hasMore).toBe(true);
    expect(r.count).toBe(250);
    expect(r.totalsByCurrency).toEqual([{ currency: 'XOF', total: 12_345 }]);
    expect(r.page).toBe(2);
  });

  it('agent : dernière page → hasMore faux', async () => {
    const { service } = make({ entries: [entry('1', 'wa', 100)], groups: [{ walletId: 'wa', currency: 'XOF', _sum: { amount: 100 }, _count: { _all: 1 } }] });
    const r: any = await service.getMyLedgerCommissions(5, 'ag1', 'day');
    expect(r.hasMore).toBe(false);
    expect(r.entries).toHaveLength(1);
  });

  it('agent sans caisse → réponse vide, aucune requête sur le journal', async () => {
    const { service, prisma } = make({ entries: [], groups: [], agencyWallets: [] });
    const r: any = await service.getMyLedgerCommissions(5, 'ag1', 'day');
    expect(r).toMatchObject({ count: 0, entries: [], hasMore: false });
    expect(prisma.ledgerEntry.findMany).not.toHaveBeenCalled();
  });

  it('société : une seule liste, scope platform / agency, totaux société et par agence', async () => {
    const { service, prisma } = make({
      entries: [entry('1', 'wc', 400), entry('2', 'wa', 200)],
      groups: [
        { walletId: 'wc', currency: 'XOF', _sum: { amount: 4000 }, _count: { _all: 10 } },
        { walletId: 'wa', currency: 'XOF', _sum: { amount: 2000 }, _count: { _all: 5 } },
      ],
      agencyWallets: [{ id: 'wa', agencyId: 'ag1' }],
    });
    const r: any = await service.getCompanyLedgerCommissions(5, 'month');
    expect(prisma.ledgerEntry.findMany).toHaveBeenCalledTimes(1);
    expect(r.entries.map((e: any) => e.scope)).toEqual(['platform', 'agency']);
    expect(r.platform).toEqual({ totalsByCurrency: [{ currency: 'XOF', total: 4000 }], count: 10 });
    expect(r.agencies).toEqual([{ agencyId: 'ag1', name: 'Agence 1', count: 5, totalsByCurrency: [{ currency: 'XOF', total: 2000 }] }]);
    expect(r.entries[1].origin).toBe('Agence 1');
  });
});
