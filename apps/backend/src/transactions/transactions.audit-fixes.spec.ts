// apps/backend/src/transactions/transactions.audit-fixes.spec.ts
// Audit backend (v4.29) — FAILED remboursé, retrait clos → transaction close + remboursée, B2B via debitInTx,
// idempotence (envoi, dépôt, recharge d'agence), audit des décisions.
import 'reflect-metadata';
import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { Prisma, TransactionStatus as S, TransactionType as T, WithdrawalStatus as W } from '@prisma/client';
import { TransactionsService } from './transactions.service';
import { findIdempotent, isIdempotencyConflict, parseIdempotencyKey } from './idempotency';

type Row = Record<string, any>;

function setup(row: Row) {
  const state = { tx: { ...row }, credits: [] as any[], debits: [] as any[], withdrawalStatuses: [] as any[], audits: [] as any[] };

  const txClient: any = {
    transaction: {
      updateMany: jest.fn().mockImplementation(async ({ where, data }: any) => {
        const t = state.tx;
        if (where.id !== t.id) return { count: 0 };
        if (where.status?.in && !where.status.in.includes(t.status)) return { count: 0 };
        Object.assign(t, data);
        return { count: 1 };
      }),
      findUniqueOrThrow: jest.fn().mockImplementation(async () => ({ ...state.tx })),
    },
    withdrawal: { updateMany: jest.fn().mockImplementation(async ({ data }: any) => { state.withdrawalStatuses.push(data.status); return { count: 1 }; }) },
  };

  const prisma: any = {
    transaction: {
      findUnique: jest.fn().mockImplementation(async () => ({ ...state.tx })),
      findFirst: jest.fn().mockImplementation(async ({ where }: any) =>
        (where.id === state.tx.id && (where.clientId === undefined || where.clientId === state.tx.clientId)) ? { ...state.tx } : null),
    },
    user: { findUnique: jest.fn().mockResolvedValue({ id: 'admin1', role: 'COMPANY_ADMIN', clientId: 5, email: null }) },
    wallet: { findFirst: jest.fn().mockResolvedValue(null) },
    auditLog: { create: jest.fn().mockImplementation(async ({ data }: any) => { state.audits.push(data); return data; }) },
    $transaction: jest.fn().mockImplementation((fn: any) => fn(txClient)),
  };
  const wallets: any = {
    getOrCreateWallet: jest.fn().mockImplementation(async (p: any) => ({ id: p.clientId !== undefined ? `company-wallet-${p.clientId}` : `user-wallet-${p.userId}` })),
    creditInTx: jest.fn().mockImplementation(async (_db: any, walletId: string, amount: number, desc: string) => { state.credits.push({ walletId, amount, desc }); }),
    debitInTx: jest.fn().mockImplementation(async (_db: any, walletId: string, amount: number, desc: string) => { state.debits.push({ walletId, amount, desc }); }),
  };
  const none: any = {};
  const service = new (TransactionsService as any)(prisma, {}, {}, wallets, none, {}, {}, {}, {}, {}, {}, {}, {}, none, {}) as TransactionsService;
  return { service, state, prisma, wallets, txClient };
}

const transfer = (over: Row = {}): Row => ({
  id: 't1', reference: '123456789', type: T.TRANSFER, status: S.VALIDATED, senderId: 'u1', agencyId: null,
  clientId: 5, currency: 'XOF', amount: 10000, fees: 150, total: 10150, ...over,
});

describe('audit point 2 — un envoi FAILED est remboursé', () => {
  it('FAILED par un admin : statut FAILED + remboursement du total + retrait FAILED, dans la même transaction SQL', async () => {
    const { service, state, prisma } = setup(transfer());
    const res = await service.adminUpdateStatusForAdmin('admin1', 't1', { status: S.FAILED } as any);
    expect(res.status).toBe(S.FAILED);
    expect(state.tx.failedAt).toBeInstanceOf(Date);
    expect(state.credits).toEqual([{ walletId: 'user-wallet-u1', amount: 10150, desc: 'Remboursement échec 123456789' }]);
    expect(state.withdrawalStatuses).toEqual([W.FAILED]);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('un second FAILED est refusé et ne rembourse pas deux fois', async () => {
    const { service, state } = setup(transfer());
    await service.adminUpdateStatusForAdmin('admin1', 't1', { status: S.FAILED } as any);
    await expect(service.adminUpdateStatusForAdmin('admin1', 't1', { status: S.FAILED } as any)).rejects.toBeDefined();
    expect(state.credits).toHaveLength(1);
  });

  it('FAILED sur une opération non remboursable (recharge d\'agence) : statut changé, aucun crédit', async () => {
    const { service, state } = setup(transfer({ type: T.AGENCY_REFILL }));
    await service.adminUpdateStatusForAdmin('admin1', 't1', { status: S.FAILED } as any);
    expect(state.credits).toHaveLength(0);
    expect(state.tx.status).toBe(S.FAILED);
  });

  it('la décision est inscrite au journal d\'audit', async () => {
    const { service, state } = setup(transfer());
    await service.adminUpdateStatusForAdmin('admin1', 't1', { status: S.FAILED } as any);
    expect(state.audits).toHaveLength(1);
    expect(state.audits[0]).toMatchObject({ userId: 'admin1', clientId: 5, action: 'TRANSACTION_UPDATE', entity: 'Transaction', entityId: 't1' });
    expect(state.audits[0].details).toMatchObject({ from: S.VALIDATED, to: S.FAILED, refunded: 10150 });
  });

  it('le passage manuel à PAID est lui aussi journalisé', async () => {
    const { service, state, prisma } = setup(transfer());
    prisma.transaction.updateMany = jest.fn().mockResolvedValue({ count: 1 });
    prisma.transaction.findUniqueOrThrow = jest.fn().mockResolvedValue({ ...state.tx, status: S.PAID });
    await service.adminUpdateStatusForAdmin('admin1', 't1', { status: S.PAID } as any);
    expect(state.audits[0].details).toMatchObject({ to: S.PAID, manual: true });
  });

  it('une panne du journal d\'audit ne fait pas échouer l\'opération', async () => {
    const { service, prisma } = setup(transfer());
    prisma.auditLog.create.mockRejectedValue(new Error('db down'));
    await expect(service.adminUpdateStatusForAdmin('admin1', 't1', { status: S.FAILED } as any)).resolves.toMatchObject({ status: S.FAILED });
  });
});

describe('audit point 4 — closeFromWithdrawal', () => {
  it.each([[W.REJECTED, S.CANCELLED], [W.CANCELLED, S.CANCELLED], [W.EXPIRED, S.CANCELLED], [W.FAILED, S.FAILED]])(
    'retrait %s → transaction %s, expéditeur remboursé, statut du retrait conservé', async (wStatus, txStatus) => {
      const { service, state } = setup(transfer());
      const res = await service.closeFromWithdrawal(5, 'admin1', 't1', wStatus);
      expect(res.status).toBe(txStatus);
      expect(state.credits).toHaveLength(1);
      expect(state.credits[0]).toMatchObject({ walletId: 'user-wallet-u1', amount: 10150 });
      expect(state.withdrawalStatuses).toEqual([wStatus]);
      expect(state.audits).toHaveLength(1);
    });

  it('transaction déjà payée → 409, aucun remboursement', async () => {
    const { service, state } = setup(transfer({ status: S.PAID }));
    await expect(service.closeFromWithdrawal(5, 'admin1', 't1', W.REJECTED)).rejects.toBeInstanceOf(ConflictException);
    expect(state.credits).toHaveLength(0);
  });

  it('transaction d\'une autre société → introuvable', async () => {
    const { service, state } = setup(transfer({ clientId: 99 }));
    await expect(service.closeFromWithdrawal(5, 'admin1', 't1', W.REJECTED)).rejects.toBeDefined();
    expect(state.credits).toHaveLength(0);
  });

  it('course avec le paiement : l\'agent passe le code à PAID entre la lecture et la réservation → 409, pas de remboursement', async () => {
    const { service, state, prisma } = setup(transfer());
    const snapshot = { ...state.tx };
    prisma.transaction.findFirst.mockImplementationOnce(async () => snapshot);
    state.tx.status = S.PAID;
    await expect(service.closeFromWithdrawal(5, 'admin1', 't1', W.REJECTED)).rejects.toBeInstanceOf(ConflictException);
    expect(state.credits).toHaveLength(0);
  });
});

describe('audit point 5 — declareBankTransfer passe par WalletsService.debitInTx', () => {
  it('débite via debitInTx (même verrou que le reste), avec le transactionId, sans verrou à part', async () => {
    const created = { id: 'b1', reference: 'BILL-1' };
    const txClient: any = { transaction: { create: jest.fn().mockResolvedValue(created) }, $executeRawUnsafe: jest.fn() };
    const prisma: any = {
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'adm', clientId: 5, email: null, firstName: 'A', lastName: 'B' }), findFirst: jest.fn().mockResolvedValue(null) },
      wallet: { findUnique: jest.fn().mockResolvedValue({ id: 'cw', balance: new Prisma.Decimal(1000), reservedBalance: new Prisma.Decimal(0) }) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn().mockImplementation((fn: any) => fn(txClient)),
    };
    const wallets: any = {
      getOrCreateWallet: jest.fn().mockResolvedValue({ id: 'cw' }),
      debitInTx: jest.fn().mockResolvedValue({}),
    };
    const none: any = { notifyB2BTransferSent: jest.fn().mockResolvedValue(undefined), notifyNewB2BRequest: jest.fn().mockResolvedValue(undefined) };
    const service = new (TransactionsService as any)(prisma, {}, {}, wallets, none, {}, {}, {}, none, {}, {}, {}, {}, none, none) as TransactionsService;

    await service.declareBankTransfer('adm', 500, 'REF-BANQUE', 'XOF');
    expect(wallets.debitInTx).toHaveBeenCalledWith(txClient, 'cw', 500, 'Virement B2B REF-BANQUE', 'b1');
    expect(txClient.$executeRawUnsafe).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);
  });

  it('solde insuffisant détecté sous verrou → 403 (comme avant), jamais un solde négatif', async () => {
    const txClient: any = { transaction: { create: jest.fn().mockResolvedValue({ id: 'b1' }) } };
    const prisma: any = {
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'adm', clientId: 5, email: null }) },
      wallet: { findUnique: jest.fn().mockResolvedValue({ id: 'cw', balance: new Prisma.Decimal(1000), reservedBalance: new Prisma.Decimal(0) }) },
      $transaction: jest.fn().mockImplementation((fn: any) => fn(txClient)),
    };
    const wallets: any = {
      getOrCreateWallet: jest.fn().mockResolvedValue({ id: 'cw' }),
      debitInTx: jest.fn().mockRejectedValue(new BadRequestException('Solde insuffisant: 200 XOF')),
    };
    const service = new (TransactionsService as any)(prisma, {}, {}, wallets, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}) as TransactionsService;
    await expect(service.declareBankTransfer('adm', 500, 'REF', 'XOF')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('pré-contrôle : solde disponible insuffisant → 403 sans ouvrir de transaction', async () => {
    const prisma: any = {
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'adm', clientId: 5 }) },
      wallet: { findUnique: jest.fn().mockResolvedValue({ id: 'cw', balance: new Prisma.Decimal(100), reservedBalance: new Prisma.Decimal(40) }) },
      $transaction: jest.fn(),
    };
    const wallets: any = { getOrCreateWallet: jest.fn().mockResolvedValue({ id: 'cw' }) };
    const service = new (TransactionsService as any)(prisma, {}, {}, wallets, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}) as TransactionsService;
    await expect(service.declareBankTransfer('adm', 61, 'REF', 'XOF')).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe('audit point 3 — idempotence', () => {
  it('parseIdempotencyKey : absent → null ; valide → trim ; invalide → 400', () => {
    expect(parseIdempotencyKey(undefined)).toBeNull();
    expect(parseIdempotencyKey('   ')).toBeNull();
    expect(parseIdempotencyKey(' 0b8c1f62-9a7d-4c1e-8f55-2a1d3c9e7b10 ')).toBe('0b8c1f62-9a7d-4c1e-8f55-2a1d3c9e7b10');
    expect(() => parseIdempotencyKey('court')).toThrow(BadRequestException);
    expect(() => parseIdempotencyKey('a'.repeat(129))).toThrow(BadRequestException);
    expect(() => parseIdempotencyKey('clé avec espaces et accents é')).toThrow(BadRequestException);
  });

  it('isIdempotencyConflict ne reconnaît que le P2002 portant sur la clé', () => {
    expect(isIdempotencyConflict({ code: 'P2002', meta: { target: ['senderId', 'idempotencyKey'] } })).toBe(true);
    expect(isIdempotencyConflict({ code: 'P2002', meta: { target: 'transactions_senderId_idempotencyKey_key' } })).toBe(true);
    expect(isIdempotencyConflict({ code: 'P2002', meta: { target: ['reference'] } })).toBe(false);
    expect(isIdempotencyConflict(new Error('x'))).toBe(false);
  });

  it('findIdempotent : même clé et même opération → l\'existante ; autre montant / devise / type → 409', async () => {
    const existing = { id: 't1', type: T.TRANSFER, amount: new Prisma.Decimal(1000), currency: 'XOF' };
    const db: any = { transaction: { findFirst: jest.fn().mockResolvedValue(existing) } };
    expect(await findIdempotent(db, 'u1', 'key-12345678', { type: T.TRANSFER, amount: 1000, currency: 'XOF' })).toBe(existing);
    await expect(findIdempotent(db, 'u1', 'key-12345678', { type: T.TRANSFER, amount: 2000, currency: 'XOF' })).rejects.toBeInstanceOf(ConflictException);
    await expect(findIdempotent(db, 'u1', 'key-12345678', { type: T.TRANSFER, amount: 1000, currency: 'EUR' })).rejects.toBeInstanceOf(ConflictException);
    await expect(findIdempotent(db, 'u1', 'key-12345678', { type: T.DEPOSIT, amount: 1000, currency: 'XOF' })).rejects.toBeInstanceOf(ConflictException);
    // devise non comparée quand elle est dérivée côté serveur
    expect(await findIdempotent(db, 'u1', 'key-12345678', { type: T.TRANSFER, amount: 1000 })).toBe(existing);
    expect(db.transaction.findFirst).toHaveBeenCalledWith({ where: { senderId: 'u1', idempotencyKey: 'key-12345678' } });
  });

  it('findIdempotent : clé inconnue → null', async () => {
    const db: any = { transaction: { findFirst: jest.fn().mockResolvedValue(null) } };
    expect(await findIdempotent(db, 'u1', 'key-12345678', { type: T.TRANSFER, amount: 1 })).toBeNull();
  });

  const existingTransfer = { id: 't1', type: T.TRANSFER, amount: new Prisma.Decimal(1000), currency: 'XOF', reference: 'R1' };

  it('create() avec une clé déjà utilisée : renvoie l\'envoi existant, ne lit ni ne débite rien', async () => {
    const { service, prisma, wallets } = setup(transfer());
    prisma.transaction.findFirst = jest.fn().mockResolvedValue(existingTransfer);
    const res = await service.create('u1', { amount: 1000, currency: 'xof', payoutMethod: 'CASH_PICKUP' } as any, 'key-12345678');
    expect(res).toBe(existingTransfer);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(wallets.debitInTx).not.toHaveBeenCalled();
  });

  it('create() : même clé avec un autre montant → 409, rien n\'est débité', async () => {
    const { service, prisma, wallets } = setup(transfer());
    prisma.transaction.findFirst = jest.fn().mockResolvedValue(existingTransfer);
    await expect(service.create('u1', { amount: 5000, currency: 'XOF', payoutMethod: 'CASH_PICKUP' } as any, 'key-12345678'))
      .rejects.toBeInstanceOf(ConflictException);
    expect(wallets.debitInTx).not.toHaveBeenCalled();
  });

  it('deposit() avec une clé déjà utilisée : renvoie le dépôt existant sans rien rejouer', async () => {
    const { service, prisma, wallets } = setup(transfer());
    const existing = { id: 'd1', type: T.DEPOSIT, amount: new Prisma.Decimal(500), currency: 'XOF' };
    prisma.transaction.findFirst = jest.fn().mockResolvedValue(existing);
    const res = await service.deposit('agent1', { amount: 500, userPhone: '+224600000000' } as any, 'key-12345678');
    expect(res).toBe(existing);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(wallets.debitInTx).not.toHaveBeenCalled();
  });

  it('refillAgency() avec une clé déjà utilisée : renvoie le résultat de la première recharge, sans second débit', async () => {
    const { service, prisma, wallets } = setup(transfer());
    const existing = { id: 'r1', type: T.AGENCY_REFILL, amount: new Prisma.Decimal(100000), currency: 'XOF', reference: 'REFILL-1' };
    prisma.transaction.findFirst = jest.fn().mockResolvedValue(existing);
    prisma.wallet.findFirst = jest.fn().mockResolvedValue({ id: 'agency-wallet' });
    const res: any = await service.refillAgency('admin1', 'ag1', 100000, 'XOF', 'key-12345678');
    expect(res).toMatchObject({ status: 'SUCCESS', sent: 100000, currency: 'XOF', agencyId: 'ag1', txRef: 'REFILL-1', replayed: true });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(wallets.debitInTx).not.toHaveBeenCalled();
  });
});
