import { ReconciliationService } from './reconciliation.service';

function build(opts: { alertOpen?: boolean } = {}) {
  const reports: any[] = [];
  const alerts: any[] = [];
  const notifs: any[] = [];
  const agg = [
    { cid: 5, currency: 'XOF', wallets: 2, balance: '100', ledger: '100', drift_wallets: 0, negative_wallets: 0, reserved_issues: 0 },
    { cid: 5, currency: 'EUR', wallets: 2, balance: '120', ledger: '100', drift_wallets: 1, negative_wallets: 0, reserved_issues: 0 },
  ];
  const prisma: any = {
    $queryRaw: jest.fn().mockImplementation(async (q: any) => {
      const text = String(q?.strings?.join(' ') ?? '');
      if (text.includes('FROM transactions')) return [];
      if (text.includes('GROUP BY w.cid')) return agg;
      return [{ id: 'w9', cid: 5, currency: 'EUR', owner: 'USER', balance: '120', reserved: '0', journal: '100' }];
    }),
    reconciliationReport: { upsert: jest.fn().mockImplementation(async (a: any) => { reports.push(a); return a; }), findMany: jest.fn() },
    alert: {
      findMany: jest.fn().mockResolvedValue(opts.alertOpen ? [{ id: 'a0', metadata: { currency: 'EUR' } }] : []),
      create: jest.fn().mockImplementation(async (a: any) => { alerts.push(a.data); return a; }),
    },
    user: { findMany: jest.fn().mockResolvedValue([{ id: 'admin1' }]) },
    notification: { create: jest.fn().mockImplementation(async (a: any) => { notifs.push(a.data); return a; }) },
  };
  return { service: new ReconciliationService(prisma), prisma, reports, alerts, notifs };
}

describe('ReconciliationService (audit argent I3)', () => {
  it('enregistre un rapport par devise et alerte seulement sur l’écart', async () => {
    const { service, reports, alerts, notifs } = build();
    const res = await service.run();
    expect(reports).toHaveLength(2);
    expect(reports.find((r) => r.create.currency === 'EUR').create.status).toBe('ALERT');
    expect(reports.find((r) => r.create.currency === 'XOF').create.status).toBe('OK');
    expect(res.alerts).toBe(1);
    expect(alerts[0]).toMatchObject({ type: 'RECONCILIATION_GAP', clientId: 5, severity: 'CRITICAL' });
    expect(notifs.length).toBeGreaterThanOrEqual(1);
  });

  it('pas de nouvelle alerte tant que celle de la même devise est ouverte', async () => {
    const { service, alerts } = build({ alertOpen: true });
    const res = await service.run();
    expect(res.alerts).toBe(0);
    expect(alerts).toHaveLength(0);
  });

  it('relancer le jour même met à jour (upsert), sans doublon', async () => {
    const { service, prisma } = build();
    await service.run();
    expect(prisma.reconciliationReport.upsert.mock.calls[0][0].where.runDate_clientId_currency).toBeDefined();
  });

  it('un COMPANY_ADMIN ne lit que sa société', async () => {
    const { service, prisma } = build();
    prisma.reconciliationReport.findMany.mockResolvedValue([]);
    await service.overview({ id: 'a', sub: 'a', role: 'COMPANY_ADMIN', clientId: 7 } as any);
    expect(prisma.reconciliationReport.findMany.mock.calls[0][0].where.clientId).toBe(7);
  });
});
