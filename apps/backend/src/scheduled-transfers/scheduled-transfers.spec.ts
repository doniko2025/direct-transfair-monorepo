// apps/backend/src/scheduled-transfers/scheduled-transfers.spec.ts
// v4.8 — exécution d'un virement programmé : chaque échéance passe par TransactionsService.create() (type SCHEDULED, clé
// d'idempotence virement + échéance). On vérifie : une seule exécution, code de retrait dans l'e-mail, échecs comptés,
// reprise après plantage sans double débit, et le contrôle du corps de POST /scheduled-transfers.
import 'reflect-metadata';
import { BadRequestException, ForbiddenException, ValidationPipe } from '@nestjs/common';
import { ScheduledTransfersService } from './scheduled-transfers.service';
import { CreateScheduledTransferDto } from './dto/create-scheduled-transfer.dto';

type Json = Record<string, any>;

function setup(opts: { createFails?: Error; pushFails?: boolean; user?: Json } = {}) {
  const state = {
    sched: { id: 'sch1', status: 'ACTIVE', nextExecutionAt: new Date('2026-10-12T10:00:00Z'), executionCount: 0, failureCount: 0, failureReason: null as string | null },
    // envois par clé d'idempotence : rejouer la même clé renvoie le même envoi (comme TransactionsService.create)
    byKey: new Map<string, Json>(),
    debits: 0,
  };
  const prisma: Json = {
    scheduledTransfer: {
      updateMany: jest.fn().mockImplementation(async ({ where, data }: Json) => {
        const s = state.sched;
        if (where.id !== s.id || where.status !== s.status || +where.nextExecutionAt !== +s.nextExecutionAt) return { count: 0 };
        Object.assign(s, data);
        return { count: 1 };
      }),
    },
  };
  const transactions: Json = {
    create: jest.fn().mockImplementation(async (senderId: string, dto: Json, key: string, options: Json) => {
      if (opts.createFails) throw opts.createFails;
      const known = state.byKey.get(key);
      if (known) return known;
      state.debits++;
      const row = { id: `t${state.byKey.size + 1}`, reference: '482916375', senderId, ...dto, ...options };
      state.byKey.set(key, row);
      return row;
    }),
  };
  const push: Json = {
    notifyScheduledTransferExecuted: jest.fn().mockImplementation(async () => { if (opts.pushFails) throw new Error('FCM down'); }),
    notifyScheduledTransferFailed: jest.fn().mockResolvedValue(undefined),
  };
  const mail: Json = { sendEmail: jest.fn().mockResolvedValue(undefined) };
  const service = new (ScheduledTransfersService as any)(prisma, push, mail, transactions) as any;

  const transfer = (): Json => ({
    id: 'sch1', clientId: 7, userId: 'u1', amount: 100_000, currency: 'XOF', targetCurrency: null, payoutMethod: 'CASH_PICKUP',
    frequency: 'WEEKLY', nextExecutionAt: new Date('2026-10-12T10:00:00Z'), executionCount: 0, maxExecutions: null, failureCount: 0,
    beneficiaryId: 'b1', beneficiary: { fullName: 'Awa', country: 'GN' }, note: 'Loyer',
    user: opts.user ?? { id: 'u1', email: 'a@b.c', isActive: true, isSuspended: false, deletedAt: null },
  });
  return { service, state, prisma, transactions, push, mail, transfer };
}

describe('ScheduledTransfersService.executeTransfer', () => {
  it('crée l\'envoi via TransactionsService (type SCHEDULED, clé d\'idempotence) puis avance l\'échéance', async () => {
    const { service, state, transfer, transactions } = setup();
    await service.executeTransfer(transfer());
    expect(transactions.create).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ amount: 100_000, currency: 'XOF', payoutMethod: 'CASH_PICKUP', beneficiaryId: 'b1', note: 'Loyer' }),
      `sched:sch1:${new Date('2026-10-12T10:00:00Z').getTime()}`,
      { type: 'SCHEDULED', scheduledTransferId: 'sch1' },
    );
    expect(state.debits).toBe(1);
    expect(state.sched.executionCount).toBe(1);
    expect(state.sched.nextExecutionAt.toISOString()).toBe('2026-10-19T10:00:00.000Z');
  });

  it('l\'e-mail d\'exécution contient le code de retrait à 9 chiffres', async () => {
    const { service, transfer, mail } = setup();
    await service.executeTransfer(transfer());
    expect(mail.sendEmail).toHaveBeenCalledWith('a@b.c', expect.any(String), expect.stringContaining('482916375'));
  });

  it('un second passage simultané sur la même échéance ne débite pas une 2ᵉ fois et ne notifie qu\'une fois', async () => {
    const { service, state, transfer, push } = setup();
    const t = transfer();
    await Promise.all([service.executeTransfer(t), service.executeTransfer({ ...t })]);
    expect(state.debits).toBe(1);
    expect(state.sched.executionCount).toBe(1);
    expect(push.notifyScheduledTransferExecuted).toHaveBeenCalledTimes(1);
  });

  it('reprise après plantage entre la création et l\'avancement : l\'envoi existant est retrouvé, pas de 2ᵉ débit', async () => {
    const { service, state, transfer, prisma } = setup();
    const real = prisma.scheduledTransfer.updateMany.getMockImplementation();
    prisma.scheduledTransfer.updateMany.mockRejectedValueOnce(new Error('connexion perdue'));
    await service.executeTransfer(transfer()); // l'envoi est créé, l'avancement échoue
    expect(state.debits).toBe(1);
    prisma.scheduledTransfer.updateMany.mockImplementation(real);
    await service.executeTransfer(transfer()); // nouveau passage
    expect(state.debits).toBe(1);
    expect(state.sched.executionCount).toBe(1);
  });

  it('un refus de l\'envoi (solde, plafond, bénéficiaire sans compte…) compte comme un échec, sans avancer l\'échéance', async () => {
    const { service, state, transfer, push } = setup({ createFails: new ForbiddenException('Solde XOF insuffisant.') });
    await service.executeTransfer(transfer());
    expect(state.debits).toBe(0);
    expect(state.sched.executionCount).toBe(0);
    expect(state.sched.failureCount).toBe(1);
    expect(state.sched.failureReason).toMatch(/Solde XOF insuffisant/);
    expect(push.notifyScheduledTransferFailed).toHaveBeenCalled();
  });

  it('trois échecs consécutifs mettent le virement en FAILED', async () => {
    const { service, state, transfer } = setup({ createFails: new BadRequestException('Aucun compte') });
    await service.executeTransfer({ ...transfer(), failureCount: 2 });
    expect(state.sched.status).toBe('FAILED');
  });

  it('une notification qui échoue après le succès ne fait pas passer le virement pour un échec', async () => {
    const { service, state, transfer } = setup({ pushFails: true });
    await service.executeTransfer(transfer());
    expect(state.debits).toBe(1);
    expect(state.sched.failureCount).toBe(0);
    expect(state.sched.executionCount).toBe(1);
  });

  it('un compte suspendu échoue proprement, sans envoi', async () => {
    const { service, state, transfer, transactions } = setup({ user: { id: 'u1', email: null, isActive: true, isSuspended: true, deletedAt: null } });
    await service.executeTransfer(transfer());
    expect(transactions.create).not.toHaveBeenCalled();
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

  it('accepte un corps valide, sans date de départ, et les modes cash / wallet / Mobile Money', async () => {
    await expect(ok(base)).resolves.toMatchObject({ amount: 5000 });
    await expect(ok({ ...base, payoutMethod: 'WALLET' })).resolves.toMatchObject({ payoutMethod: 'WALLET' });
    await expect(ok({ ...base, payoutMethod: 'MOBILE_MONEY' })).resolves.toMatchObject({ payoutMethod: 'MOBILE_MONEY' });
  });
  it('refuse montant négatif ou nul, devise ou fréquence inconnues, virement bancaire', async () => {
    await expect(ok({ ...base, amount: -5 })).rejects.toBeInstanceOf(BadRequestException);
    await expect(ok({ ...base, amount: 0 })).rejects.toBeInstanceOf(BadRequestException);
    await expect(ok({ ...base, currency: 'ABC' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(ok({ ...base, frequency: 'HOURLY' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(ok({ ...base, payoutMethod: 'BANK_DEPOSIT' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(ok({ ...base, beneficiaryId: '' })).rejects.toBeInstanceOf(BadRequestException);
  });
});
