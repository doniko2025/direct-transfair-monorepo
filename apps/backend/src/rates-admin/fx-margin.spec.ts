// apps/backend/src/rates-admin/fx-margin.spec.ts
// Marge de change par société (v7.8) : règles pures, conversion « pour un client » et réglage par l'administrateur.
import { BadRequestException } from '@nestjs/common';

import { RatesAdminService } from './rates-admin.service';
import { RatesService } from '../rates/rates.service';
import { assertValidFxMargin, fxFactor, fxMarginGain, MAX_FX_MARGIN_PCT } from './rate-rules';

describe('règles de la marge de change', () => {
  it('facteur : 1 − marge/100 ; 1 si absente, nulle ou invalide ; plafonné', () => {
    expect(fxFactor(2)).toBeCloseTo(0.98, 9);
    expect(fxFactor('1.5')).toBeCloseTo(0.985, 9);
    expect(fxFactor(0)).toBe(1);
    expect(fxFactor(null)).toBe(1);
    expect(fxFactor('abc')).toBe(1);
    expect(fxFactor(-3)).toBe(1);
    expect(fxFactor(99)).toBeCloseTo(1 - MAX_FX_MARGIN_PCT / 100, 9);
  });
  it('validation : 0 à 10 %, 2 décimales, virgule acceptée', () => {
    expect(assertValidFxMargin(0)).toBe(0);
    expect(assertValidFxMargin('1,5')).toBe(1.5);
    expect(assertValidFxMargin(2.345)).toBe(2.35);
    expect(() => assertValidFxMargin(-1)).toThrow(BadRequestException);
    expect(() => assertValidFxMargin(10.01)).toThrow(BadRequestException);
    expect(() => assertValidFxMargin('x')).toThrow(BadRequestException);
    expect(() => assertValidFxMargin(NaN)).toThrow(BadRequestException);
  });
  it('gain estimé : montant × marge (devise d\'envoi)', () => {
    expect(fxMarginGain(1000, 2)).toBe(20);
    expect(fxMarginGain(4.78, 2)).toBe(0.1);
    expect(fxMarginGain(1000, 0)).toBe(0);
    expect(fxMarginGain(0, 2)).toBe(0);
    expect(fxMarginGain(1000, null)).toBe(0);
  });
  it('cas réel : marché 10 700, marge 2 % → le client a 10 486, la société garde 214 GNF par euro', () => {
    const net = 10700 * fxFactor(2);
    expect(net).toBeCloseTo(10486, 6);
    expect(10700 - net).toBeCloseTo(214, 6);
  });
});

describe('RatesService.convertForCustomer', () => {
  const build = (rate: number, margin: unknown) => {
    const prisma: any = {
      exchangeRate: { findMany: jest.fn().mockResolvedValue([{ pair: 'EUR_GNF', rate, updatedAt: new Date() }]) },
      client: { findUnique: jest.fn().mockResolvedValue({ fxMarginPct: margin }) },
    };
    return { svc: new RatesService(prisma), prisma };
  };
  it('retient la marge sur une vraie conversion et la renvoie', async () => {
    const { svc } = build(10700, 2);
    const r = await svc.convertForCustomer(100, 'EUR', 'GNF', 5);
    expect(r.converted).toBeCloseTo(100 * 10486, 4);
    expect(r.marginPct).toBe(2);
  });
  it('même devise : aucune marge, aucune lecture', async () => {
    const { svc, prisma } = build(10700, 2);
    await expect(svc.convertForCustomer(100, 'EUR', 'eur', 5)).resolves.toEqual({ converted: 100, marginPct: 0 });
    expect(prisma.client.findUnique).not.toHaveBeenCalled();
  });
  it('marge absente ou nulle : taux publié tel quel', async () => {
    const a = build(10700, 0);
    expect((await a.svc.convertForCustomer(1, 'EUR', 'GNF', 5)).converted).toBe(10700);
    const b = build(10700, null);
    expect((await b.svc.convertForCustomer(1, 'EUR', 'GNF', 5)).marginPct).toBe(0);
  });
  it('convert() reste BRUT (limites, frais, trésorerie : jamais de marge)', async () => {
    const { svc } = build(10700, 2);
    await expect(svc.convert(1, 'EUR', 'GNF', 5)).resolves.toBe(10700);
  });
});

describe('RatesAdminService — réglage de la marge', () => {
  const build = (current: number) => {
    const audit = jest.fn().mockResolvedValue({});
    const update = jest.fn().mockResolvedValue({});
    const prisma: any = {
      client: { findUnique: jest.fn().mockResolvedValue({ fxMarginPct: current }) },
      $transaction: jest.fn(async (fn: any) => fn({ client: { update }, auditLog: { create: audit } })),
    };
    return { svc: new RatesAdminService(prisma, {} as any), update, audit, prisma };
  };
  const user: any = { id: 'u1', clientId: 5 };

  it('enregistre, journalise et renvoie la nouvelle marge', async () => {
    const { svc, update, audit } = build(0);
    await expect(svc.setMargin(user, 5, '2,5')).resolves.toEqual({ fxMarginPct: 2.5, maxFxMarginPct: MAX_FX_MARGIN_PCT });
    expect(update).toHaveBeenCalledWith({ where: { id: 5 }, data: { fxMarginPct: 2.5 } });
    expect(audit).toHaveBeenCalledWith({ data: expect.objectContaining({ action: 'FX_MARGIN_UPDATE', clientId: 5, details: { from: 0, to: 2.5 } }) });
  });
  it('une valeur identique ne réécrit ni ne journalise', async () => {
    const { svc, prisma } = build(2);
    await svc.setMargin(user, 5, 2);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it('refuse une marge négative ou au-delà du plafond, sans rien écrire', async () => {
    const { svc, prisma } = build(1);
    await expect(svc.setMargin(user, 5, -1)).rejects.toThrow(BadRequestException);
    await expect(svc.setMargin(user, 5, 11)).rejects.toThrow(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
