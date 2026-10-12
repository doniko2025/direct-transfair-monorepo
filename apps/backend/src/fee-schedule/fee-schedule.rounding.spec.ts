// apps/backend/src/fee-schedule/fee-schedule.rounding.spec.ts
// Phase 6 (v1.1) — le tarif plat et le taux par défaut sont arrondis à l'unité de la devise, comme le barème.
import 'reflect-metadata';
import { FeeScheduleService } from './fee-schedule.service';

function make(flat: any | null) {
  const prisma: any = {
    user: { findUnique: jest.fn().mockResolvedValue({ country: 'FR', agency: null }) },
    feeRule: { findMany: jest.fn().mockResolvedValue([]) },
    commissionConfig: { findFirst: jest.fn().mockResolvedValue(flat) },
  };
  return new FeeScheduleService(prisma, { convert: jest.fn() } as any);
}

describe('FeeScheduleService.quote — arrondi du tarif plat', () => {
  it('taux par défaut 1,5 % sur 12 345 XOF → 185 XOF (et non 185,175)', async () => {
    const q = await make(null).quote({ clientId: 1, senderId: 'u', payoutMethod: 'CASH_PICKUP', amount: 12345, currency: 'XOF', receiveCountry: 'SN' });
    expect(q.source).toBe('DEFAULT');
    expect(q.fees).toBe(185);
    expect(q.total).toBe(12530);
  });

  it('tarif plat du mode : 2 % + 200 sur 12 345 GNF → 447 GNF', async () => {
    const q = await make({ feeRate: 2, fixedFee: 200 }).quote({ clientId: 1, senderId: 'u', payoutMethod: 'CASH_PICKUP', amount: 12345, currency: 'GNF', receiveCountry: 'GN' });
    expect(q.source).toBe('METHOD');
    expect(q.fees).toBe(447);
  });

  it('devise à 2 décimales : 1,5 % sur 33,33 EUR → 0,5 EUR (arrondi commercial au centime)', async () => {
    const q = await make(null).quote({ clientId: 1, senderId: 'u', payoutMethod: 'CASH_PICKUP', amount: 33.33, currency: 'EUR', receiveCountry: 'SN' });
    expect(q.fees).toBe(0.5);
  });

  it('modes gratuits inchangés', async () => {
    const q = await make(null).quote({ clientId: 1, senderId: 'u', payoutMethod: 'WALLET', amount: 12345, currency: 'XOF', receiveCountry: 'SN' });
    expect(q.fees).toBe(0);
    expect(q.source).toBe('FREE');
  });
});
