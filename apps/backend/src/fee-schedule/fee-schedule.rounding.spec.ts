// apps/backend/src/fee-schedule/fee-schedule.rounding.spec.ts
// Phase 6 (v1.1) — le tarif plat et le taux par défaut sont arrondis à l'unité de la devise, comme le barème.
import 'reflect-metadata';
import { FeeScheduleService } from './fee-schedule.service';
import { defaultSettings, mergeSettings } from '../company-settings/company-settings.logic';

function make(flat: any | null, settings: any = defaultSettings(), convert: jest.Mock = jest.fn(), currencyOfCompany = 'GNF') {
  const prisma: any = {
    user: { findUnique: jest.fn().mockResolvedValue({ country: 'FR', agency: null }) },
    feeRule: { findMany: jest.fn().mockResolvedValue([]) },
    commissionConfig: { findFirst: jest.fn().mockResolvedValue(flat) },
    client: { findUnique: jest.fn().mockResolvedValue({ defaultCurrency: currencyOfCompany }) },
  };
  return new FeeScheduleService(prisma, { convert } as any, { forClient: jest.fn().mockResolvedValue(settings) } as any);
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

describe('FeeScheduleService.quote — réglages de la société (v1.2)', () => {
  const base = { clientId: 1, senderId: 'u', amount: 10_000, currency: 'XOF', receiveCountry: 'SN' };

  it('par défaut seul wallet → wallet est gratuit : Mobile Money est facturé', async () => {
    const mm = await make(null).quote({ ...base, payoutMethod: 'MOBILE_MONEY' });
    expect(mm.source).toBe('DEFAULT');
    expect(mm.fees).toBe(150);
    const w = await make(null).quote({ ...base, payoutMethod: 'WALLET' });
    expect(w).toMatchObject({ fees: 0, source: 'FREE' });
  });

  it('la société peut déclarer Mobile Money gratuit… ou rendre le wallet payant', async () => {
    const s1 = mergeSettings({ fees: { freeMethods: ['WALLET', 'MOBILE_MONEY'] } });
    expect((await make(null, s1).quote({ ...base, payoutMethod: 'MOBILE_MONEY' })).fees).toBe(0);
    const s2 = mergeSettings({ fees: { freeMethods: [] } });
    expect((await make(null, s2).quote({ ...base, payoutMethod: 'WALLET' })).fees).toBe(150);
  });

  it('le taux de repli est celui de la société', async () => {
    const s = mergeSettings({ fees: { fallbackFeeRatePct: 2.5 } });
    const q = await make(null, s).quote({ ...base, payoutMethod: 'CASH_PICKUP' });
    expect(q).toMatchObject({ fees: 250, feeRatePct: 2.5, source: 'DEFAULT' });
  });

  it('frais fixe du tarif plat en devise de la société → converti dans la devise de l\'envoi', async () => {
    const convert = jest.fn(async (v: number) => v / 10); // 1 EUR-société = 10 unités… ici : 200 GNF → 20 XOF
    const q = await make({ feeRate: 1, fixedFee: 200 }, defaultSettings(), convert, 'GNF').quote({ ...base, payoutMethod: 'CASH_PICKUP' });
    expect(convert).toHaveBeenCalledWith(200, 'GNF', 'XOF');
    expect(q.fixedFee).toBe(20);
    expect(q.fixedFeeOriginal).toEqual({ amount: 200, currency: 'GNF' });
    expect(q.fees).toBe(120); // 1 % de 10 000 + 20
  });

  it('taux de change indisponible pour le frais fixe → 503 plutôt que des frais faux', async () => {
    const convert = jest.fn().mockRejectedValue(new Error('pas de taux'));
    await expect(make({ feeRate: 1, fixedFee: 200 }, defaultSettings(), convert, 'GNF').quote({ ...base, payoutMethod: 'CASH_PICKUP' }))
      .rejects.toMatchObject({ status: 503 });
  });

  it('devise de la société = devise de l\'envoi : aucune conversion', async () => {
    const convert = jest.fn();
    const q = await make({ feeRate: 1, fixedFee: 200 }, defaultSettings(), convert, 'XOF').quote({ ...base, payoutMethod: 'CASH_PICKUP' });
    expect(convert).not.toHaveBeenCalled();
    expect(q.fees).toBe(300);
  });
});
