// apps/backend/src/treasury/treasury.passe3.spec.ts
// Phase 6, passe 3 — trésorerie : snapshots réservés aux administrateurs, audit des mouvements,
// montants bornés, snapshot global sans doublon.
import 'reflect-metadata';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { TreasuryController } from './treasury.controller';
import { TreasuryService } from './treasury.service';
import { GetSnapshotsQueryDto, InjectFundsDto } from './dto/treasury.dto';

const req = (role: string, clientId: number | undefined = 7): any => ({ user: { id: 'u1', role, clientId } });

describe('TreasuryController — rôles', () => {
  const svc: any = { getSnapshots: jest.fn().mockResolvedValue([]), audit: jest.fn(), injectFunds: jest.fn().mockResolvedValue({ ok: true }), withdrawFunds: jest.fn().mockResolvedValue({ ok: true }), selfFundAll: jest.fn().mockResolvedValue({ results: [{ currency: 'EUR', credited: 10, walletId: 'w' }] }), transferBetweenWallets: jest.fn().mockResolvedValue({ ok: true }) };
  const ctrl = new TreasuryController(svc);

  it('GET /treasury/snapshots : refusé à un client et à un agent', async () => {
    for (const role of ['USER', 'AGENT']) {
      await expect(ctrl.getSnapshots(req(role), {} as any)).rejects.toBeInstanceOf(ForbiddenException);
    }
    expect(svc.getSnapshots).not.toHaveBeenCalled();
  });

  it("GET /treasury/snapshots : l'admin de société ne voit que sa société, le super admin sa propre trésorerie", async () => {
    await ctrl.getSnapshots(req('COMPANY_ADMIN', 7), {} as any);
    expect(svc.getSnapshots).toHaveBeenLastCalledWith(expect.objectContaining({ clientId: 7 }));
    await ctrl.getSnapshots(req('SUPER_ADMIN', 1), {} as any);
    expect(svc.getSnapshots).toHaveBeenLastCalledWith(expect.objectContaining({ clientId: 1 }));
  });

  it('inject / inject-all / withdraw / transfer laissent une trace dans le journal', async () => {
    await ctrl.injectFunds(req('COMPANY_ADMIN'), { currency: 'EUR', amount: 50 } as any);
    await ctrl.injectAll(req('COMPANY_ADMIN'), { amounts: { EUR: 10 } } as any);
    await ctrl.withdrawFunds(req('COMPANY_ADMIN'), { currency: 'EUR', amount: 5 } as any);
    await ctrl.transferBetweenWallets(req('SUPER_ADMIN'), { fromWalletId: 'a', toWalletId: 'b', amount: 3 } as any);
    expect(svc.audit.mock.calls.map((c: any[]) => c[1])).toEqual(['TREASURY_INJECT', 'TREASURY_SELF_FUND', 'TREASURY_WITHDRAW', 'TREASURY_TRANSFER']);
    expect(svc.audit.mock.calls[0][2]).toEqual({ currency: 'EUR', amount: 50 });
  });
});

describe('TreasuryService', () => {
  function make(extra: any = {}) {
    const prisma: any = {
      auditLog: { create: jest.fn().mockResolvedValue({}) },
      client: { findUnique: jest.fn().mockResolvedValue({ id: 7, subscriptionStatus: 'ACTIVE' }), findMany: jest.fn().mockResolvedValue([]) },
      wallet: { aggregate: jest.fn().mockResolvedValue({ _sum: { balance: 100 } }) },
      transaction: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 10, fees: 1, platformCommission: 0 }, _count: { id: 2 } }),
        findMany: jest.fn().mockResolvedValue([{ senderId: 'a' }]),
      },
      treasurySnapshot: { findFirst: jest.fn(), create: jest.fn().mockResolvedValue({}), update: jest.fn().mockResolvedValue({}), upsert: jest.fn().mockResolvedValue({}) },
      ...extra,
    };
    const wallets: any = { getOrCreateWallet: jest.fn(async ({ currency }: any) => ({ id: `w-${currency}` })), credit: jest.fn().mockResolvedValue({}) };
    return { service: new TreasuryService(prisma, {} as any, wallets), prisma, wallets };
  }

  it("audit() écrit BALANCE_ADJUSTMENT avec l'auteur, et n'échoue jamais l'opération", async () => {
    const { service, prisma } = make();
    await service.audit({ id: 'u1', clientId: 7 }, 'TREASURY_INJECT', { currency: 'EUR', amount: 5 });
    expect(prisma.auditLog.create.mock.calls[0][0].data).toMatchObject({ userId: 'u1', clientId: 7, action: 'BALANCE_ADJUSTMENT', entityId: 'TREASURY_INJECT' });
    prisma.auditLog.create.mockRejectedValueOnce(new Error('db'));
    await expect(service.audit({ id: 'u1', clientId: 7 }, 'TREASURY_WITHDRAW', {})).resolves.toBeUndefined();
  });

  it('selfFundAll : ignore les devises vides / à zéro, refuse les valeurs absurdes', async () => {
    const { service, wallets } = make();
    const r = await service.selfFundAll({ clientId: 7, amounts: { EUR: '25' as any, XOF: 0, USD: '' as any } });
    expect(r.results).toHaveLength(1);
    expect(wallets.credit).toHaveBeenCalledWith('w-EUR', 25, expect.any(String));
    await expect(service.selfFundAll({ clientId: 7, amounts: { EUR: 1e30 } })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.selfFundAll({ clientId: 7, amounts: { EUR: 'abc' as any } })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.selfFundAll({ clientId: 7, amounts: { EUR: 0 } })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('snapshot GLOBAL : cherche la ligne du jour (clientId null) et la met à jour au lieu de créer un doublon', async () => {
    const { service, prisma } = make();
    prisma.treasurySnapshot.findFirst.mockResolvedValueOnce({ id: 's1' }).mockResolvedValue(null);
    await (service as any).createSnapshotForDate(null, new Date('2026-10-11'), new Date('2026-10-12'));
    expect(prisma.treasurySnapshot.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ clientId: null, currency: 'XOF' }) }));
    expect(prisma.treasurySnapshot.update).toHaveBeenCalledTimes(1); // XOF : déjà là
    expect(prisma.treasurySnapshot.create).toHaveBeenCalledTimes(4); // 4 autres devises : créées
    expect(prisma.treasurySnapshot.upsert).not.toHaveBeenCalled();
  });

  it('snapshot société : upsert sur la clé (société, devise, date)', async () => {
    const { service, prisma } = make();
    await (service as any).createSnapshotForDate(7, new Date('2026-10-11'), new Date('2026-10-12'));
    expect(prisma.treasurySnapshot.upsert).toHaveBeenCalledTimes(5);
    expect(prisma.treasurySnapshot.upsert.mock.calls[0][0].where.clientId_currency_date.clientId).toBe(7);
  });
});

describe('DTO trésorerie', () => {
  it('montant plafonné, dates ISO', async () => {
    expect((await validate(plainToInstance(InjectFundsDto, { currency: 'eur', amount: 1e30 }))).map((e) => e.property)).toContain('amount');
    expect(await validate(plainToInstance(InjectFundsDto, { currency: 'eur', amount: 1000 }))).toEqual([]);
    expect((await validate(plainToInstance(GetSnapshotsQueryDto, { from: 'pas une date' }))).map((e) => e.property)).toContain('from');
    expect(await validate(plainToInstance(GetSnapshotsQueryDto, { from: '2026-01-01', to: '2026-01-31', limit: '10' }))).toEqual([]);
  });
});
