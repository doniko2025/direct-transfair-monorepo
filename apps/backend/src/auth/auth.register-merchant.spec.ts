// Lot 11 — inscription « Je suis marchand » : la fiche du commerce naît avec le compte, dans la même transaction.
import 'reflect-metadata';
import { BadRequestException, ForbiddenException } from '@nestjs/common';

import { AuthService } from './auth.service';

const register = (AuthService.prototype as any).register as (...a: any[]) => Promise<any>;

function ctx(opts: { merchantEnabled?: boolean } = {}) {
  const merchantCreate = jest.fn(async () => ({}));
  const userUpdate = jest.fn(async ({ data }: any) => ({ id: 'u1', email: 'a@x.fr', role: 'USER', clientId: 7, ...data }));
  const userCreate = jest.fn(async () => ({ id: 'u1', email: 'a@x.fr', role: 'USER', clientId: 7, accountType: 'PERSONAL' }));
  const tx: any = { user: { create: userCreate, update: userUpdate }, wallet: { create: jest.fn(async () => ({})) }, merchantProfile: { create: merchantCreate } };
  const prisma: any = {
    user: { findUnique: jest.fn(async ({ where }: any) => (where.email ? null : { id: 'u1', email: 'a@x.fr', role: 'USER', clientId: 7, accountType: 'MERCHANT', wallets: [] })), findFirst: jest.fn(async () => null), update: jest.fn(async () => ({})) },
    client: { findUnique: jest.fn(async () => ({ id: 7, isActive: true, code: 'DT' })) },
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

describe('register — compte marchand', () => {
  it('crée la fiche et passe le compte en MERCHANT dans la même transaction', async () => {
    const { self, merchantCreate, userUpdate } = ctx();
    await register.call(self, { ...base, accountType: 'MERCHANT', businessName: ' Chez  Awa ', businessCategory: 'Boutique', businessCity: 'Conakry', orangeMoneyPhone: '+224 620 00 00 01' }, null);
    expect(merchantCreate.mock.calls[0][0].data).toMatchObject({ userId: 'u1', clientId: 7, businessName: 'Chez Awa', category: 'Boutique', city: 'Conakry', orangeMoneyPhone: '+224620000001' });
    expect(userUpdate).toHaveBeenCalledWith({ where: { id: 'u1' }, data: { accountType: 'MERCHANT' } });
  });

  it('fiche incomplète ou numéro sans indicatif : refusé AVANT toute écriture', async () => {
    const a = ctx();
    await expect(register.call(a.self, { ...base, accountType: 'MERCHANT', orangeMoneyPhone: '+224620000001' }, null)).rejects.toBeInstanceOf(BadRequestException);
    const b = ctx();
    await expect(register.call(b.self, { ...base, accountType: 'MERCHANT', businessName: 'Chez Awa', orangeMoneyPhone: '0620000001' }, null)).rejects.toBeInstanceOf(BadRequestException);
    for (const c of [a, b]) {
      expect(c.userCreate).not.toHaveBeenCalled();
      expect(c.prisma.$transaction).not.toHaveBeenCalled();
    }
  });

  it('société qui ferme les comptes marchands : 403, rien créé', async () => {
    const { self, userCreate } = ctx({ merchantEnabled: false });
    await expect(register.call(self, { ...base, accountType: 'MERCHANT', businessName: 'Chez Awa', orangeMoneyPhone: '+224620000001' }, null)).rejects.toBeInstanceOf(ForbiddenException);
    expect(userCreate).not.toHaveBeenCalled();
  });

  it('compte client (défaut) : aucune fiche marchand', async () => {
    const { self, merchantCreate, userUpdate } = ctx();
    await register.call(self, { ...base }, null);
    expect(merchantCreate).not.toHaveBeenCalled();
    expect(userUpdate).not.toHaveBeenCalled();
  });
});
