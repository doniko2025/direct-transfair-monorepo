// apps/backend/src/merchants/merchants.service.spec.ts
// Fiche marchand : activation, changement de destination (code secret + délai de sécurité + notification), suspension, accès.
import 'reflect-metadata';
import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';

import { defaultSettings } from '../company-settings/company-settings.logic';
import { normalizeProfileInput } from './merchant-rules';
import { MERCHANT_REQUIRED_CODE, MERCHANT_SUSPENDED_CODE, MerchantsService } from './merchants.service';

type J = Record<string, any>;
const me = { id: 'mer', sub: 'mer', role: 'USER', clientId: 7 } as any;
const admin = { id: 'adm', role: 'COMPANY_ADMIN', clientId: 7 } as any;
const VALID_IBAN = 'FR14 2004 1010 0505 0001 3M02 606';

function setup(profile: J | null = { id: 'p1', userId: 'mer', clientId: 7, businessName: 'Boutique', orangeMoneyPhone: '+224620000001', bankIban: null, bankBic: null, bankHolderName: null, destinationChangedAt: null, status: 'ACTIVE', suspendedReason: null, category: null, address: null, city: null, createdAt: new Date() }, merchantEnabled = true) {
  const row: J | null = profile && { ...profile };
  const audits: J[] = [];
  const prisma: J = {
    user: { findUnique: jest.fn(async () => ({ id: 'mer', email: 'm@x.fr', firstName: 'Awa', accountType: row ? 'MERCHANT' : 'PERSONAL', clientId: 7 })), update: jest.fn(async () => ({})) },
    merchantProfile: {
      findUnique: jest.fn(async () => row),
      findFirst: jest.fn(async () => row && { ...row, user: { id: 'mer', firstName: 'Awa', lastName: 'D', email: 'm@x.fr', phone: '+224620000001', kycLevel: 'LEVEL_2', isSuspended: false } }),
      create: jest.fn(async ({ data }: J) => data),
      update: jest.fn(async ({ data }: J) => { Object.assign(row!, data); return row; }),
    },
    paymentRequest: { updateMany: jest.fn(async () => ({ count: 2 })), findMany: jest.fn(async () => []) },
    merchantPayout: { findMany: jest.fn(async () => []) },
    auditLog: { create: jest.fn(async ({ data }: J) => { audits.push(data); return data; }) },
    $transaction: jest.fn(async (fn: any) => fn(prisma)),
  };
  const s = defaultSettings();
  s.merchant.enabled = merchantEnabled;
  const settings = { forClient: jest.fn(async () => s) };
  const pins = { assertPin: jest.fn(async () => undefined) };
  const notifier = { notifyUser: jest.fn(async () => undefined) };
  const service = new MerchantsService(prisma as any, settings as any, pins as any, notifier as any);
  return { service, prisma, pins, notifier, audits, row };
}

describe('normalizeProfileInput', () => {
  it('nettoie les champs et valide le numéro Orange Money', () => {
    expect(normalizeProfileInput({ businessName: '  Chez   Awa ', city: ' Conakry ', orangeMoneyPhone: '+224 620 00 00 01' })).toEqual({
      businessName: 'Chez Awa', category: null, address: null, city: 'Conakry', orangeMoneyPhone: '+224620000001',
    });
  });
  it('refuse nom absent ou trop court, numéro sans indicatif', () => {
    expect(() => normalizeProfileInput({ orangeMoneyPhone: '+224620000001' })).toThrow(BadRequestException);
    expect(() => normalizeProfileInput({ businessName: 'A', orangeMoneyPhone: '+224620000001' })).toThrow(BadRequestException);
    expect(() => normalizeProfileInput({ businessName: 'Awa', orangeMoneyPhone: '0620000001' })).toThrow(BadRequestException);
  });
});

describe('accès marchand', () => {
  it('pas de fiche : 403 MERCHANT_REQUIRED ; suspendu : 403 MERCHANT_SUSPENDED avec le motif', async () => {
    const a: any = await setup(null).service.assertActiveMerchant('mer').catch((e) => e);
    expect(a.getResponse().code).toBe(MERCHANT_REQUIRED_CODE);
    const b: any = await setup({ status: 'SUSPENDED', suspendedReason: 'Fraude suspectée' } as J).service.assertActiveMerchant('mer').catch((e) => e);
    expect(b.getResponse()).toMatchObject({ code: MERCHANT_SUSPENDED_CODE });
    expect(b.getResponse().message).toContain('Fraude suspectée');
  });
  it('société qui ferme les comptes marchands : 403', async () => {
    await expect(setup(undefined, false).service.assertActiveMerchant('mer')).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('activation', () => {
  const input = { pin: '486213', businessName: 'Chez Awa', orangeMoneyPhone: '+224620000001' };
  it('code secret vérifié, fiche créée, utilisateur passé MERCHANT, journal et notification', async () => {
    const { service, pins, prisma, audits, notifier } = setup(null);
    prisma.merchantProfile.findUnique.mockResolvedValueOnce(null).mockResolvedValue({ userId: 'mer', businessName: 'Chez Awa', status: 'ACTIVE', orangeMoneyPhone: '+224620000001', createdAt: new Date(), destinationChangedAt: null });
    await service.activate(me, input);
    expect(pins.assertPin).toHaveBeenCalledWith('mer', '486213');
    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 'mer' }, data: { accountType: 'MERCHANT' } });
    expect(prisma.merchantProfile.create.mock.calls[0][0].data).toMatchObject({ userId: 'mer', clientId: 7, businessName: 'Chez Awa' });
    expect(audits[0]).toMatchObject({ action: 'MERCHANT_CREATE' });
    expect(notifier.notifyUser).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ kind: 'MERCHANT_ACTIVATED' }));
  });
  it('déjà marchand : 409 sans demander le code ; société fermée : 403 ; non client : 403', async () => {
    const a = setup();
    await expect(a.service.activate(me, input)).rejects.toBeInstanceOf(ConflictException);
    expect(a.pins.assertPin).not.toHaveBeenCalled();
    await expect(setup(null, false).service.activate(me, input)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(setup(null).service.activate({ ...me, role: 'AGENT' }, input)).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('changement de destination', () => {
  it('code secret exigé, date de changement posée, notification d’alerte avec e-mail, journal masqué', async () => {
    const { service, pins, row, notifier, audits } = setup();
    await service.changeDestination(me, { pin: '486213', orangeMoneyPhone: '+224 621 11 11 11' });
    expect(pins.assertPin).toHaveBeenCalledWith('mer', '486213');
    expect(row!.orangeMoneyPhone).toBe('+224621111111');
    expect(row!.destinationChangedAt).toBeInstanceOf(Date);
    expect(notifier.notifyUser).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ kind: 'DESTINATION_CHANGED', type: 'WARNING', email: true }));
    expect(JSON.stringify(audits[0].details)).not.toContain('621111111');
    expect(audits[0]).toMatchObject({ action: 'MERCHANT_DESTINATION_CHANGE' });
  });
  it('mauvais code secret : rien n’est modifié', async () => {
    const { service, pins, row } = setup();
    pins.assertPin.mockRejectedValueOnce(new ForbiddenException({ code: 'PIN_INVALID' }));
    await expect(service.changeDestination(me, { pin: '000000', orangeMoneyPhone: '+224621111111' })).rejects.toBeInstanceOf(ForbiddenException);
    expect(row!.orangeMoneyPhone).toBe('+224620000001');
    expect(row!.destinationChangedAt).toBeNull();
  });
  it('identique, vide ou numéro invalide : 400, aucun délai de sécurité déclenché', async () => {
    const { service, row } = setup();
    await expect(service.changeDestination(me, { pin: '486213', orangeMoneyPhone: '+224620000001' })).rejects.toThrow(/identique/);
    await expect(service.changeDestination(me, { pin: '486213' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.changeDestination(me, { pin: '486213', orangeMoneyPhone: '0621111111' })).rejects.toBeInstanceOf(BadRequestException);
    expect(row!.destinationChangedAt).toBeNull();
  });
  it('compte bancaire : IBAN contrôlé, titulaire obligatoire, retrait possible avec une chaîne vide', async () => {
    const { service, row } = setup();
    await expect(service.changeDestination(me, { pin: '486213', bankIban: 'FR14 2004 1010 0505 0001 3M02 607', bankHolderName: 'Awa' })).rejects.toThrow(/clé de contrôle/);
    await expect(service.changeDestination(me, { pin: '486213', bankIban: VALID_IBAN })).rejects.toThrow(/titulaire/);
    await service.changeDestination(me, { pin: '486213', bankIban: VALID_IBAN, bankHolderName: 'Awa Diallo', bankBic: 'bnpafrpp' });
    expect(row).toMatchObject({ bankIban: 'FR1420041010050500013M02606', bankHolderName: 'Awa Diallo', bankBic: 'BNPAFRPP' });
    await service.changeDestination(me, { pin: '486213', bankIban: '' });
    expect(row!.bankIban).toBeNull();
  });
  it('la vue du marchand ne contient jamais l’IBAN en clair', async () => {
    const { service } = setup();
    await service.changeDestination(me, { pin: '486213', bankIban: VALID_IBAN, bankHolderName: 'Awa Diallo' });
    const view = await service.getMine(me);
    expect(JSON.stringify(view)).not.toContain('FR1420041010050500013M02606');
    expect(view.profile!.bank!.ibanMasked).toBe('FR14 •••• 2606');
    expect(view.profile!.payoutLockedUntil).not.toBeNull();
  });
});

describe('suspension par l’administrateur', () => {
  it('motif obligatoire ; suspend, annule les QR ouverts, prévient ; la réactivation rétablit', async () => {
    const { service, row, prisma, notifier } = setup();
    await expect(service.setSuspended(admin, 'mer', true, '')).rejects.toBeInstanceOf(BadRequestException);
    await service.setSuspended(admin, 'mer', true, 'Fraude suspectée');
    expect(row).toMatchObject({ status: 'SUSPENDED', suspendedReason: 'Fraude suspectée' });
    expect(prisma.paymentRequest.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { payeeId: 'mer', status: 'PENDING' } }));
    expect(notifier.notifyUser).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ kind: 'MERCHANT_SUSPENDED', email: true }));
    await expect(service.setSuspended(admin, 'mer', true, 'encore')).rejects.toBeInstanceOf(ConflictException);
    await service.setSuspended(admin, 'mer', false);
    expect(row).toMatchObject({ status: 'ACTIVE', suspendedReason: null });
  });
  it('super admin : société obligatoire', async () => {
    await expect(setup().service.setSuspended({ id: 's', role: 'SUPER_ADMIN' } as any, 'mer', true, 'x motif')).rejects.toBeInstanceOf(BadRequestException);
  });
});
