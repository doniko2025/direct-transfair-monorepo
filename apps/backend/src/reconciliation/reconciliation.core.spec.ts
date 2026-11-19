import { computeReconciliation, describeRow, statusOf } from './reconciliation.core';

// $queryRaw reçoit un Prisma.Sql : on route les 3 requêtes d'après leur texte.
function fakeDb(agg: any[], bad: any[], transit: any[]) {
  return {
    $queryRaw: jest.fn().mockImplementation(async (q: any) => {
      const text = String(q?.strings?.join(' ') ?? q?.sql ?? q ?? '');
      if (text.includes('FROM transactions')) return transit;
      if (text.includes('GROUP BY w.cid')) return agg;
      return bad;
    }),
  } as any;
}

describe('réconciliation (audit argent I3)', () => {
  it('tout est cohérent : OK', async () => {
    const db = fakeDb(
      [{ cid: 5, currency: 'XOF', wallets: 3, balance: '1500000.0000', ledger: '1500000.0000', drift_wallets: 0, negative_wallets: 0, reserved_issues: 0 }],
      [],
      [{ cid: 5, currency: 'XOF', n: 2, amount: '30000.0000' }],
    );
    const rows = await computeReconciliation(db);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ clientId: 5, currency: 'XOF', status: 'OK', drift: 0, inTransitCount: 2, inTransitAmount: 30000, problems: [] });
  });

  it('un portefeuille en écart : ALERT, avec le détail', async () => {
    const db = fakeDb(
      [{ cid: 5, currency: 'EUR', wallets: 2, balance: '120.0000', ledger: '100.0000', drift_wallets: 1, negative_wallets: 0, reserved_issues: 0 }],
      [{ id: 'w9', cid: 5, currency: 'EUR', owner: 'USER', balance: '120.0000', reserved: '0', journal: '100.0000' }],
      [],
    );
    const [r] = await computeReconciliation(db);
    expect(r.status).toBe('ALERT');
    expect(r.drift).toBe(20);
    expect(r.problems[0]).toMatchObject({ walletId: 'w9', drift: 20, issues: ['DRIFT'], owner: 'USER' });
    expect(describeRow(r)).toContain('1 portefeuille(s)');
  });

  it('solde négatif et réservé incohérent sont signalés même sans écart de journal', async () => {
    const db = fakeDb(
      [{ cid: 0, currency: 'GNF', wallets: 1, balance: '-50.0000', ledger: '-50.0000', drift_wallets: 0, negative_wallets: 1, reserved_issues: 1 }],
      [{ id: 'w1', cid: 0, currency: 'GNF', owner: 'OTHER', balance: '-50.0000', reserved: '10.0000', journal: '-50.0000' }],
      [],
    );
    const [r] = await computeReconciliation(db);
    expect(r.status).toBe('ALERT');
    expect(r.problems[0].issues).toEqual(['NEGATIVE', 'RESERVED']);
  });

  it('des écarts qui se compensent (somme nulle) restent signalés', () => {
    expect(statusOf({ driftWallets: 2, negativeWallets: 0, reservedIssues: 0 })).toBe('ALERT');
    expect(statusOf({ driftWallets: 0, negativeWallets: 0, reservedIssues: 0 })).toBe('OK');
  });

  it('limite le nombre de portefeuilles détaillés par ligne', async () => {
    const bad = Array.from({ length: 30 }, (_, i) => ({ id: `w${i}`, cid: 5, currency: 'XOF', owner: 'USER', balance: '10', reserved: '0', journal: '0' }));
    const db = fakeDb([{ cid: 5, currency: 'XOF', wallets: 30, balance: '300', ledger: '0', drift_wallets: 30, negative_wallets: 0, reserved_issues: 0 }], bad, []);
    const [r] = await computeReconciliation(db, 0.01, 20);
    expect(r.problems).toHaveLength(20);
  });
});
