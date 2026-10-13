// apps/backend/src/scheduled-transfers/scheduled-transfers.spec.ts
// Phase 6 (v4.4) — exécution d'un virement programmé : une seule fois, atomique, frais, seuil, plafonds.
import 'reflect-metadata';
import { BadRequestException, ForbiddenException, ValidationPipe } from '@nestjs/common';
import { ScheduledTransfersService } from './scheduled-transfers.service';
import { CreateScheduledTransferDto } from './dto/create-scheduled-transfer.dto';

type Json = Record<string, any>;

function setup(opts: { fees?: number; threshold?: number; limitsFail?: boolean; failDebit?: boolean; pushFails?: boolean; user?: Json } = {}) {
  const state = {
    sched: { id: 'sch1', status: 'ACTIVE', nextExecutionAt: new Date('2026-10-12T10:00:00Z'), executionCount: 0, failureCount: 0, failureReason: null as string | null },
    balance: 1_000_000,
    rows: [] as Json[],
  };
  const dbTx: Json = {
    scheduledTransfer: {
      updateMany: jest.fn().mockImplementation(async ({ where, data }: Json) => {
        const s = state.sched;
        if (where.id !== s.id || where.status !== s.status || +where.nextExecutionAt !== +s.nextExecutionAt) return { count: 0 };
        Object.assign(s, data, data.nextExecutionAt === undefined ? {} : {});
        return { count: 1 };
      }),
    },
    transaction: { create: jest.fn().mockImplementation(async ({ data }: Json) => { const r = { id: `t${state.rows.length + 1}`, ...data }; state.rows.push(r); return r; }) },
  };
  const prisma: Json = {
    scheduledTransfer: { updateMany: dbTx.scheduledTransfer.updateMany },
    $transaction: jest.fn().mockImplementation(async (fn: any) => {
      const before = JSON.stringify({ s: state.sched, b: state.balance, r: state.rows });
      try { return await fn(dbTx); } catch (e) {
        const o = JSON.parse(before);
        state.sched = { ...o.s, nextExecutionAt: new Date(o.s.nextExecutionAt) }; state.balance = o.b; state.rows = o.r;
        throw e;
      }
    }),
  };
  const wallets: Json = {
    debitInTx: jest.fn().mockImplementation(async (_d: any, _id: string, amount: number) => {
      if (opts.failDebit) throw new BadRequestException('Solde insuffisant');
      state.balance -= amount;
    }),
  };
  const push: Json = {
    notifyScheduledTransferExecuted: jest.fn().mockImplementation(async () => { if (opts.pushFails) throw new Error('FCM down'); }),
    notifyScheduledTransferFailed: jest.fn().mockResolvedValue(undefined),
  };
  const mail: Json = { sendEmail: jest.fn().mockResolvedValue(undefined) };
  const feeSchedule: Json = { quote: jest.fn().mockResolvedValue({ fees: opts.fees ?? 1500 }) };
  const thresholds: Json = { thresholdFor: jest.fn().mockResolvedValue(opts.threshold ?? 500_000) };
  const limits: Json = { assertWithinLimits: jest.fn().mockImplementation(async () => { if (opts.limitsFail) throw new ForbiddenException('Plafond dépassé'); }) };
  const rates: Json = { convert: jest.fn().mockImplementation(async (a: number) => a) };
  const service = new (ScheduledTransfersService as any)(prisma, wallets, rates, push, mail, feeSchedule, thresholds, limits) as any;

  const transfer = (): Json => ({
    id: 'sch1', clientId: 7, userId: 'u1', amount: 100_000, currency: 'XOF', targetCurrency: null, payoutMethod: 'CASH_PICKUP',
    frequency: 'WEEKLY', nextExecutionAt: new Date('2026-10-12T10:00:00Z'), executionCount: 0, maxExecutions: null, failureCount: 0,
    beneficiaryId: 'b1', beneficiary: { fullName: 'Awa', country: 'GN' }, note: null,
    user: opts.user ?? { id: 'u1', email: null, isActive: true, isSuspended: false, deletedAt: null, wallets: [{ id: 'w1', currency: 'XOF', isActive: true, balance: 1_000_000 }] },
  });
  return { service, state, prisma, wallets, push, feeSchedule, thresholds, limits, transfer };
}

describe('ScheduledTransfersService.executeTransfer', () => {
  it('exécute : frais du barème, débit du total, envoi créé, échéance avancée — le tout ensemble', async () => {
    const { service, state, transfer, wallets } = setup({ fees: 1500 });
    await service.executeTransfer(transfer());
    expect(state.rows).toHaveLength(1);
    expect(state.rows[0]).toMatchObject({ type: 'SCHEDULED', fees: expect.anything(), status: 'VALIDATED', senderId: 'u1', clientId: 7, scheduledTransferId: 'sch1' });
    expect(Number(state.rows[0].fees)).toBe(1500);
    expect(Number(state.rows[0].total)).toBe(101_500);
    expect(state.balance).toBe(1_000_000 - 101_500);
    expect(wallets.debitInTx).toHaveBeenCalledWith(expect.anything(), 'w1', 101_500, expect.any(String), 't1');
    expect(state.sched.executionCount).toBe(1);
    expect(state.sched.nextExecutionAt.toISOString()).toBe('2026-10-19T10:00:00.000Z');
  });

  it('au-dessus du seuil réglé par la société : envoi en attente de validation', async () => {
    const { service, state, transfer, thresholds } = setup({ threshold: 50_000 });
    await service.executeTransfer(transfer());
    expect(thresholds.thresholdFor).toHaveBeenCalledWith(7, 'XOF');
    expect(state.rows[0].status).toBe('PENDING');
  });

  it('un second passage simultané sur la même échéance ne débite pas une 2ᵉ fois', async () => {
    const { service, state, transfer } = setup();
    const t = transfer();
    await Promise.all([service.executeTransfer(t), service.executeTransfer({ ...t })]);
    expect(state.rows).toHaveLength(1);
    expect(state.balance).toBe(1_000_000 - 101_500);
    expect(state.sched.executionCount).toBe(1);
  });

  it('un échec du débit annule la réservation de l\'échéance et la ligne Transaction', async () => {
    const { service, state, transfer } = setup({ failDebit: true });
    await service.executeTransfer(transfer());
    expect(state.rows).toHaveLength(0);
    expect(state.balance).toBe(1_000_000);
    expect(state.sched.executionCount).toBe(0);
    // l'échec est noté sur l'échéancier
    expect(state.sched.failureCount).toBe(1);
    expect(state.sched.failureReason).toMatch(/Solde insuffisant/);
  });

  it('un plafond dépassé annule tout et compte comme un échec', async () => {
    const { service, state, transfer } = setup({ limitsFail: true });
    await service.executeTransfer(transfer());
    expect(state.rows).toHaveLength(0);
    expect(state.balance).toBe(1_000_000);
    expect(state.sched.failureCount).toBe(1);
  });

  it('une notification qui échoue après le succès ne fait pas passer le virement pour un échec', async () => {
    const { service, state, transfer } = setup({ pushFails: true });
    await service.executeTransfer(transfer());
    expect(state.rows).toHaveLength(1);
    expect(state.sched.failureCount).toBe(0);
    expect(state.sched.executionCount).toBe(1);
    expect(state.sched.nextExecutionAt.toISOString()).toBe('2026-10-19T10:00:00.000Z'); // avancée une seule fois
  });

  it('un compte suspendu échoue proprement, sans débit', async () => {
    const { service, state, transfer } = setup({ user: { id: 'u1', email: null, isActive: true, isSuspended: true, deletedAt: null, wallets: [{ id: 'w1', currency: 'XOF', isActive: true }] } });
    await service.executeTransfer(transfer());
    expect(state.rows).toHaveLength(0);
    expect(state.sched.failureReason).toMatch(/suspendu/);
  });

  it('un virement ONCE passe à COMPLETED', async () => {
    const { service, state, transfer } = setup();
    await service.executeTransfer({ ...transfer(), frequency: 'ONCE' });
    expect(state.sched.status).toBe('COMPLETED');
  });
});

describe('CreateScheduledTransferDto', () => {
  const pipe = new ValidationPipe({ whitelist: true, transform: true });
  const meta = { type: 'body' as const, metatype: CreateScheduledTransferDto };
  const base = { beneficiaryId: 'b1', amount: 5000, currency: 'XOF', frequency: 'WEEKLY' };
  const ok = (body: any) => pipe.transform(body, meta);

  it('accepte un corps valide, sans date de départ', async () => {
    await expect(ok(base)).resolves.toMatchObject({ amount: 5000 });
  });
  it('refuse montant négatif ou nul, devise ou fréquence inconnues, mode de retrait autre que cash', async () => {
    await expect(ok({ ...base, amount: -5 })).rejects.toBeInstanceOf(BadRequestException);
    await expect(ok({ ...base, amount: 0 })).rejects.toBeInstanceOf(BadRequestException);
    await expect(ok({ ...base, currency: 'ABC' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(ok({ ...base, frequency: 'HOURLY' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(ok({ ...base, payoutMethod: 'WALLET' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(ok({ ...base, beneficiaryId: '' })).rejects.toBeInstanceOf(BadRequestException);
  });
});
