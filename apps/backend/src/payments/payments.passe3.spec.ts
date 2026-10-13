// apps/backend/src/payments/payments.passe3.spec.ts
// Phase 6, passe 3 — paiements : /payments/initiate fermé, interrupteur des recharges simulées, moyens de paiement.
import 'reflect-metadata';
import { BadRequestException, ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';

import { PaymentMethodsService } from './payment-methods.service';
import { PaymentsService } from './payments.service';
import { RechargeService } from './recharge.service';
import { InitiateRechargeDto } from './dto/initiate-recharge.dto';
import { LinkMobileWalletDto } from './dto/link-mobile-wallet.dto';

const ENV = ['ALLOW_SIMULATED_PAYMENTS', 'BLOCK_SIMULATED_RECHARGES'] as const;
const saved: Record<string, string | undefined> = {};
beforeEach(() => ENV.forEach((k) => { saved[k] = process.env[k]; delete process.env[k]; }));
afterEach(() => ENV.forEach((k) => { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }));

describe('PaymentsService.initiate', () => {
  const prisma: any = { transaction: { findFirst: jest.fn().mockResolvedValue(null), updateMany: jest.fn() } };
  const service = new PaymentsService(prisma, {} as any, {} as any);

  it("est refusé par défaut : l'expéditeur ne peut pas marquer son envoi « payé »", async () => {
    for (const method of ['WALLET', 'ORANGE_MONEY', 'SENDWAVE']) {
      await expect(service.initiate(1, 'u1', { transactionId: 't1', paymentMethod: method as any })).rejects.toBeInstanceOf(ForbiddenException);
    }
    expect(prisma.transaction.findFirst).not.toHaveBeenCalled();
    expect(prisma.transaction.updateMany).not.toHaveBeenCalled();
  });

  it('se rouvre avec ALLOW_SIMULATED_PAYMENTS=true (dev) : on arrive jusqu’à la recherche de la transaction', async () => {
    process.env.ALLOW_SIMULATED_PAYMENTS = 'true';
    await expect(service.initiate(1, 'u1', { transactionId: 't1', paymentMethod: 'WALLET' as any })).rejects.toThrow('Transaction not found');
    expect(prisma.transaction.findFirst).toHaveBeenCalled();
  });
});

describe('RechargeService — BLOCK_SIMULATED_RECHARGES', () => {
  const prisma: any = { user: { findUnique: jest.fn() }, transaction: { create: jest.fn() } };
  const service = new RechargeService(prisma, {} as any, {} as any, {} as any);
  const card: any = { amount: 100, currency: 'EUR', cardholderName: 'A B', cardNumber: '4242424242424242', expiry: '12/30' };

  it('ouvertes par défaut (décision : on garde les recharges simulées en phase de test)', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(service.rechargeByCard('u1', card)).rejects.toThrow('Utilisateur introuvable');
  });

  it('fermées (503) quand la variable est à true — carte, Orange Money et Sendwave', async () => {
    process.env.BLOCK_SIMULATED_RECHARGES = 'true';
    prisma.user.findUnique.mockClear();
    await expect(service.rechargeByCard('u1', card)).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(service.rechargeByOrangeMoney('u1', { ...card, momoPhone: '+224600000000' })).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(service.rechargeBySendwave('u1', card)).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(prisma.transaction.create).not.toHaveBeenCalled();
  });
});

describe('DTO recharge / wallet mobile', () => {
  const errorsOf = async (cls: any, plain: object) => (await validate(plainToInstance(cls, plain))).map((e) => e.property);

  it('refuse un montant énorme, négatif ou à plus de 2 décimales', async () => {
    expect(await errorsOf(InitiateRechargeDto, { amount: 1e30, currency: 'EUR' })).toContain('amount');
    expect(await errorsOf(InitiateRechargeDto, { amount: -5, currency: 'EUR' })).toContain('amount');
    expect(await errorsOf(InitiateRechargeDto, { amount: 10.123, currency: 'EUR' })).toContain('amount');
    expect(await errorsOf(InitiateRechargeDto, { amount: 10.5, currency: 'EUR' })).toEqual([]);
  });

  it('numéro Mobile Money : format contrôlé, null = délier', async () => {
    expect(await errorsOf(LinkMobileWalletDto, { provider: 'ORANGE_MONEY', number: 'x'.repeat(5000) })).toContain('number');
    expect(await errorsOf(LinkMobileWalletDto, { provider: 'ORANGE_MONEY', number: '+224 622 00 00 00' })).toEqual([]);
    expect(await errorsOf(LinkMobileWalletDto, { provider: 'ORANGE_MONEY', number: null })).toEqual([]);
  });
});

describe('PaymentMethodsService', () => {
  function make(cards: any[] = [], wallets: any[] = []) {
    const tx: any = {
      userCard: {
        count: jest.fn().mockResolvedValue(cards.length),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        create: jest.fn(async ({ data }: any) => ({ id: 'c-new', ...data })),
      },
      userMobileWallet: {
        deleteMany: jest.fn().mockResolvedValue({ count: wallets.length }),
        upsert: jest.fn(async ({ create }: any) => ({ id: 'w-new', ...create })),
      },
    };
    const prisma: any = { $transaction: jest.fn(async (fn: any) => fn(tx)) };
    return { service: new PaymentMethodsService(prisma), tx };
  }
  const dto: any = { cardNumber: '4242424242424242', expiry: '12/30' };

  it('première carte = carte par défaut', async () => {
    const { service, tx } = make([]);
    const r: any = await service.addCard('u1', dto);
    expect(r.isDefault).toBe(true);
    expect(r.last4).toBe('4242');
    expect(tx.userCard.updateMany).toHaveBeenCalled();
  });

  it('une carte ajoutée « par défaut » retire ce statut aux autres ; sinon elles sont laissées', async () => {
    const a = make([{}, {}]);
    await a.service.addCard('u1', { ...dto, isDefault: true });
    expect(a.tx.userCard.updateMany).toHaveBeenCalledWith({ where: { userId: 'u1', isDefault: true }, data: { isDefault: false } });
    const b = make([{}, {}]);
    const r: any = await b.service.addCard('u1', dto);
    expect(r.isDefault).toBe(false);
    expect(b.tx.userCard.updateMany).not.toHaveBeenCalled();
  });

  it('10 cartes au plus', async () => {
    const { service, tx } = make(Array.from({ length: 10 }, () => ({})));
    await expect(service.addCard('u1', dto)).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.userCard.create).not.toHaveBeenCalled();
  });

  it("lier un nouveau numéro retire l'ancien numéro du même opérateur", async () => {
    const { service, tx } = make([], [{ number: '+224600000000' }]);
    const r: any = await service.linkMobileWallet('u1', { provider: 'ORANGE_MONEY' as any, number: ' +224622000000 ' });
    expect(tx.userMobileWallet.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'u1', provider: 'ORANGE_MONEY', number: { not: '+224622000000' } },
    });
    expect(r.number).toBe('+224622000000');
  });
});
