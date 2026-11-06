// apps/backend/src/transfer-limits/transfer-limits.deposit.spec.ts
// Audit argent (v1.1) — plafond des dépôts en espèces : mêmes plafonds KYC que l'envoi, cumul des dépôts du client.
import 'reflect-metadata';
import { ForbiddenException } from '@nestjs/common';
import { PaymentMethod, TransactionStatus, TransactionType } from '@prisma/client';
import { TransferLimitsService } from './transfer-limits.service';
import { defaultLimits } from './transfer-limit-defaults';

function setup(opts: { role?: string; kyc?: string; row?: any; sums?: [number, number, number] } = {}) {
  const sums = opts.sums ?? [0, 0, 0];
  let call = 0;
  const db: any = {
    user: { findFirst: jest.fn().mockResolvedValue({ role: opts.role ?? 'USER', kycLevel: opts.kyc ?? 'LEVEL_1' }) },
    transferLimit: { findUnique: jest.fn().mockResolvedValue(opts.row ?? null) },
    transaction: {
      aggregate: jest.fn().mockImplementation(async () => ({ _sum: { amount: sums[call++ % 3] } })),
    },
  };
  return { svc: new TransferLimitsService({} as any), db };
}

const args = (amount: number, over: any = {}) => ({ clientId: 5, recipientUserId: 'client1', currency: 'XOF', amount, ...over });

describe('assertDepositWithinLimits', () => {
  const L1 = defaultLimits('LEVEL_1', 'XOF'); // 500 € par dépôt = 325 000 XOF

  it('dépôt sous tous les plafonds : accepté', async () => {
    const { svc, db } = setup();
    await expect(svc.assertDepositWithinLimits(db, args(100_000))).resolves.toBeUndefined();
  });

  it('dépôt au-dessus du plafond par dépôt : 403 DEPOSIT_LIMIT_EXCEEDED', async () => {
    const { svc, db } = setup();
    const err: any = await svc.assertDepositWithinLimits(db, args((L1.perTransaction as number) + 1)).catch((e) => e);
    expect(err).toBeInstanceOf(ForbiddenException);
    expect(err.getResponse()).toMatchObject({ code: 'DEPOSIT_LIMIT_EXCEEDED', limit: 'perTransaction', max: L1.perTransaction });
    expect(err.getResponse().message).toMatch(/par dépôt/);
  });

  it('cumul du jour : les dépôts déjà reçus comptent', async () => {
    const { svc, db } = setup({ sums: [(L1.daily as number) - 50_000, 0, 0] });
    const err: any = await svc.assertDepositWithinLimits(db, args(100_000)).catch((e) => e);
    expect(err.getResponse()).toMatchObject({ code: 'DEPOSIT_LIMIT_EXCEEDED', limit: 'daily', remaining: 50_000 });
  });

  it('seuls les dépôts EN ESPÈCES payés du client comptent (pas les recharges carte, pas les annulés)', async () => {
    const { svc, db } = setup();
    await svc.assertDepositWithinLimits(db, args(10_000, { excludeTransactionId: 'dep-new' }));
    const where = db.transaction.aggregate.mock.calls[0][0].where;
    expect(where).toMatchObject({
      clientId: 5, recipientId: 'client1', currency: 'XOF',
      type: TransactionType.DEPOSIT, paymentMethod: PaymentMethod.CASH, status: TransactionStatus.PAID,
      id: { not: 'dep-new' },
    });
  });

  it('plafond réglé par la société pour ce niveau : il remplace les valeurs par défaut', async () => {
    const { svc, db } = setup({ row: { perTransaction: 20_000, daily: null, monthly: null, yearly: null } });
    await expect(svc.assertDepositWithinLimits(db, args(25_000))).rejects.toBeInstanceOf(ForbiddenException);
    await expect(svc.assertDepositWithinLimits(db, args(15_000))).resolves.toBeUndefined();
  });

  it('un destinataire qui n\'est pas un client (rôle USER) n\'est pas contrôlé ici', async () => {
    const { svc, db } = setup({ role: 'AGENT' });
    await expect(svc.assertDepositWithinLimits(db, args(999_999_999))).resolves.toBeUndefined();
  });
});
