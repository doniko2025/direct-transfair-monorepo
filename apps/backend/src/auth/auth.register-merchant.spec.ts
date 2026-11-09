// Lot 11 — inscription « Je suis marchand » : la fiche du commerce naît avec le compte, dans la même transaction.
import 'reflect-metadata';
import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';

import { AuthService } from './auth.service';

const register = (AuthService.prototype as any).register as (...a: any[]) => Promise<any>;

function ctx(opts: { merchantEnabled?: boolean; rccmTaken?: boolean } = {}) {
  const merchantCreate = jest.fn(async () => ({}));
  const userUpdate = jest.fn(async ({ data }: any) => ({ id: 'u1', email: 'a@x.fr', role: 'USER', clientId: 7, ...data }));
  const userCreate = jest.fn(async () => ({ id: 'u1', email: 'a@x.fr', role: 'USER', clientId: 7, accountType: 'PERSONAL' }));
  const tx: any = { user: { create: userCreate, update: userUpdate }, wallet: { create: jest.fn(async () => ({})) }, merchantProfile: { create: merchantCreate } };
  const prisma: any = {
    user: { findUnique: jest.fn(async ({ where }: any) => (where.email ? null : { id: 'u1', email: 'a@x.fr', role: 'USER', clientId: 7, accountType: 'MERCHANT', ...shop, wallets: [] })), findFirst: jest.fn(async () => null), update: jest.fn(async () => ({})) },
    client: { findUnique: jest.fn(async () => ({ id: 7, isActive: true, code: 'DT' })) },
    merchantProfile: { findFirst: jest.fn(async () => (opts.rccmTaken ? { id: 'autre' } : null)) },
    companySetting: { findUnique: jest.fn(async () => (opts.merchantEnabled === false ? { data: { merchant: { enabled: false } } } : null)) },
    $transaction: jest.fn(async (fn: any) => fn(tx)),
    userSession: { create: jest.fn(async () => ({})) },
  };
  const self: any = {
    prisma,
    logger: { warn: jest.fn() },
    audit: jest.fn(async () => undefined),
    mail: { sendEmail: jest.fn(async () => undefined) },
    sendOtpInternal: jest.fn(async () => undefined),
    generateTokens: jest.fn(async () => ({ access_token: 'a', refresh_token: 'r' })),
    createSession: jest.fn(async () => undefined),
    toPublicUser: (u: any) => u,
  };
  return { self, merchantCreate, userUpdate, userCreate, prisma };
}

const base = { firstName: 'Awa', lastName: 'Diallo', email: 'a@x.fr', password: '486213', phone: '+224620000009', country: 'GN' };
// Adresse et ville du COMMERCE : obligatoires (le reste de la fiche est facultatif).
const shop = { businessAddress: 'Rue KA-023, Kaloum', businessCity: 'Conakry' };

describe('register — compte marchand', () => {
  it('crée la fiche et passe le compte en MERCHANT dans la même transaction', async () => {
    const { self, merchantCreate, userUpdate } = ctx();
    await register.call(self, { ...base, accountType: 'MERCHANT', ...shop, businessRccm: 'GN.TCC.2019.B.12345', businessName: ' Chez  Awa ', businessCategory: 'Boutique', businessCity: 'Conakry', orangeMoneyPhone: '+224 620 00 00 01' }, null);
    expect(merchantCreate.mock.calls[0][0].data).toMatchObject({ userId: 'u1', clientId: 7, businessName: 'Chez Awa', category: 'Boutique', city: 'Conakry', rccm: 'GN.TCC.2019.B.12345', orangeMoneyPhone: '+224620000001' });
    expect(userUpdate).toHaveBeenCalledWith({ where: { id: 'u1' }, data: { accountType: 'MERCHANT' } });
  });

  it('coordonnées du commerce : adresse + ville obligatoires, code postal / quartier / pays / téléphone / NIF facultatifs, tout est enregistré', async () => {
    const { self, merchantCreate } = ctx();
    await register.call(self, {
      ...base, accountType: 'MERCHANT', businessRccm: 'GN.TCC.2019.B.12345', businessName: 'Chez Awa', orangeMoneyPhone: '+224620000001',
      businessAddress: ' Rue KA-023, Kaloum ', businessCity: 'Conakry', businessDistrict: 'Kaloum', businessPostalCode: '1001', businessCountry: 'Guinée',
      businessPhone: '+224 621 11 11 11', businessTaxId: 'nif 123 456',
    }, null);
    expect(merchantCreate.mock.calls[0][0].data).toMatchObject({
      address: 'Rue KA-023, Kaloum', city: 'Conakry', district: 'Kaloum', postalCode: '1001', country: 'Guinée', businessPhone: '+224621111111', taxId: 'NIF 123 456',
    });
  });

  it('ISOLATION : sans ville de commerce, la ville PERSONNELLE du client n\'est pas reprise (400, rien créé) ; sans adresse aussi', async () => {
    const noCity = ctx();
    await expect(register.call(noCity.self, { ...base, city: 'Paris', accountType: 'MERCHANT', businessRccm: 'GN.TCC.2019.B.12345', businessName: 'Chez Awa', businessAddress: 'Rue KA-023', businessCity: undefined, orangeMoneyPhone: '+224620000001' }, null)).rejects.toBeInstanceOf(BadRequestException);
    const noAddr = ctx();
    await expect(register.call(noAddr.self, { ...base, accountType: 'MERCHANT', businessRccm: 'GN.TCC.2019.B.12345', businessName: 'Chez Awa', businessAddress: undefined, orangeMoneyPhone: '+224620000001' }, null)).rejects.toBeInstanceOf(BadRequestException);
    for (const c of [noCity, noAddr]) expect(c.userCreate).not.toHaveBeenCalled();
  });

  it('RCCM obligatoire : absent ou invalide → 400 AVANT toute écriture ; déjà utilisé → 409', async () => {
    const ok = { ...base, accountType: 'MERCHANT', ...shop, businessName: 'Chez Awa', orangeMoneyPhone: '+224620000001' };
    for (const bad of [undefined, '', '  ', 'AB']) {
      const c = ctx();
      await expect(register.call(c.self, { ...ok, businessRccm: bad }, null)).rejects.toBeInstanceOf(BadRequestException);
      expect(c.userCreate).not.toHaveBeenCalled();
    }
    const taken = ctx({ rccmTaken: true });
    await expect(register.call(taken.self, { ...ok, businessRccm: 'GN.TCC.2019.B.12345' }, null)).rejects.toBeInstanceOf(ConflictException);
    expect(taken.userCreate).not.toHaveBeenCalled();
    expect(taken.prisma.merchantProfile.findFirst.mock.calls[0][0].where).toEqual({ rccm: 'GN.TCC.2019.B.12345' });
  });

  it('fiche incomplète ou numéro sans indicatif : refusé AVANT toute écriture', async () => {
    const a = ctx();
    await expect(register.call(a.self, { ...base, accountType: 'MERCHANT', ...shop, businessRccm: 'GN.TCC.2019.B.12345', orangeMoneyPhone: '+224620000001' }, null)).rejects.toBeInstanceOf(BadRequestException);
    const b = ctx();
    await expect(register.call(b.self, { ...base, accountType: 'MERCHANT', ...shop, businessRccm: 'GN.TCC.2019.B.12345', businessName: 'Chez Awa', orangeMoneyPhone: '0620000001' }, null)).rejects.toBeInstanceOf(BadRequestException);
    for (const c of [a, b]) {
      expect(c.userCreate).not.toHaveBeenCalled();
      expect(c.prisma.$transaction).not.toHaveBeenCalled();
    }
  });

  it("BARRAGE : un compte ouvert en euros ne peut pas enregistrer un numéro Orange guinéen — refusé avant toute écriture", async () => {
    const { self, userCreate, prisma } = ctx();
    const fr = { ...base, country: 'France', phone: '+33751244722' };
    const err: any = await register.call(self, { ...fr, accountType: 'MERCHANT', ...shop, businessRccm: 'GN.TCC.2019.B.12345', businessName: 'Chez Awa', orangeMoneyPhone: '+224 620 00 00 01' }, null).catch((e: any) => e);
    expect(err).toBeInstanceOf(BadRequestException);
    expect(err.getResponse()).toMatchObject({ code: 'ORANGE_NOT_AVAILABLE' });
    expect(userCreate).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('compte en euros : le commerce naît sans Orange Money (retraits par IBAN plus tard)', async () => {
    const { self, merchantCreate } = ctx();
    await register.call(self, { ...base, country: 'France', phone: '+33751244722', accountType: 'MERCHANT', ...shop, businessRccm: 'GN.TCC.2019.B.12345', businessName: 'Chez Awa' }, null);
    expect(merchantCreate.mock.calls[0][0].data).toMatchObject({ businessName: 'Chez Awa', orangeMoneyPhone: null });
  });

  it('compte guinéen (GNF) : numéro Orange guinéen obligatoire — un numéro étranger est refusé avant toute écriture', async () => {
    const { self, userCreate } = ctx();
    await expect(register.call(self, { ...base, accountType: 'MERCHANT', ...shop, businessRccm: 'GN.TCC.2019.B.12345', businessName: 'Chez Awa', orangeMoneyPhone: '+33 7 51 24 47 22' }, null)).rejects.toMatchObject({ response: { code: 'ORANGE_COUNTRY_MISMATCH' } });
    await expect(register.call(self, { ...base, accountType: 'MERCHANT', ...shop, businessRccm: 'GN.TCC.2019.B.12345', businessName: 'Chez Awa' }, null)).rejects.toBeInstanceOf(BadRequestException);
    expect(userCreate).not.toHaveBeenCalled();
  });

  it('société qui ferme les comptes marchands : 403, rien créé', async () => {
    const { self, userCreate } = ctx({ merchantEnabled: false });
    await expect(register.call(self, { ...base, accountType: 'MERCHANT', ...shop, businessRccm: 'GN.TCC.2019.B.12345', businessName: 'Chez Awa', orangeMoneyPhone: '+224620000001' }, null)).rejects.toBeInstanceOf(ForbiddenException);
    expect(userCreate).not.toHaveBeenCalled();
  });

  it('compte client (défaut) : aucune fiche marchand', async () => {
    const { self, merchantCreate, userUpdate } = ctx();
    await register.call(self, { ...base }, null);
    expect(merchantCreate).not.toHaveBeenCalled();
    expect(userUpdate).not.toHaveBeenCalled();
  });
});
