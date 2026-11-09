// apps/backend/src/transactions/transactions.recall.spec.ts
// v4.34 — rappel d'un envoi wallet → wallet, wallet remboursé lu dans le journal, trace du cash à rendre au comptoir.
import 'reflect-metadata';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { TransactionStatus as S, TransactionType as T } from '@prisma/client';
import { TransactionsService } from './transactions.service';

type Row = Record<string, any>;

const NOW = new Date();
const day = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

/** Envoi XOF → GNF payé sur le wallet de u2 : 10 000 XOF + 150 de frais ; u2 a reçu 99 000 GNF ; la société a reçu 150 XOF de frais. */
function paidWalletTransfer(over: Row = {}): Row {
  return {
    id: 't1', reference: '123456789', type: T.TRANSFER, status: S.PAID, payoutMethod: 'WALLET', senderId: 'u1', recipientId: 'u2',
    clientId: 5, agencyId: null, counterCustomerId: null, currency: 'XOF', targetCurrency: 'GNF',
    amount: 10_000, fees: 150, total: 10_150, receivedAmount: 99_000, paidAt: day(3), createdAt: day(3), ...over,
  };
}

const LEDGER = (): Row[] => [
  { id: 'l1', walletId: 'w-sender', type: 'DEBIT', amount: 10_150, createdAt: day(3), wallet: { userId: 'u1', clientId: null, agencyId: null, merchantId: null } },
  { id: 'l2', walletId: 'w-recipient', type: 'CREDIT', amount: 99_000, createdAt: day(3), wallet: { userId: 'u2', clientId: null, agencyId: null, merchantId: null } },
  { id: 'l3', walletId: 'w-company', type: 'CREDIT', amount: 150, createdAt: day(3), wallet: { userId: null, clientId: 5, agencyId: null, merchantId: null } },
];

function setup(row: Row, opts: {
  ledger?: Row[]; balances?: Record<string, number>; refunds?: Partial<{ returnMerchantCommission: boolean; returnFeesOnRecall: boolean; recallWindowDays: number }>;
  counterName?: { firstName: string; lastName: string } | null; debitedWalletId?: string | null;
} = {}) {
  const state = {
    tx: { ...row },
    balances: { 'w-sender': 0, 'w-recipient': 99_000, 'w-company': 1_000, 'w-personal': 0, 'agency-wallet': 0, ...(opts.balances ?? {}) } as Record<string, number>,
    moves: [] as { kind: 'debit' | 'credit'; walletId: string; amount: number; desc: string }[],
    audits: [] as Row[],
    notifications: [] as any[],
  };
  const snapshot = () => JSON.stringify({ t: state.tx, b: state.balances, m: state.moves });

  const txClient: any = {
    transaction: {
      updateMany: jest.fn(async ({ where, data }: any) => {
        const t = state.tx;
        if (where.id !== t.id) return { count: 0 };
        const st = where.status;
        if (st?.in ? !st.in.includes(t.status) : typeof st === 'string' && st !== t.status) return { count: 0 };
        Object.assign(t, data);
        return { count: 1 };
      }),
      findUniqueOrThrow: jest.fn(async () => ({ ...state.tx })),
    },
    withdrawal: { updateMany: jest.fn(async () => ({ count: 1 })) },
  };
  const prisma: any = {
    transaction: {
      findFirst: jest.fn(async () => ({ ...state.tx })),
      findUnique: jest.fn(async () => ({ ...state.tx, sender: { id: state.tx.senderId } })),
    },
    ledgerEntry: {
      findFirst: jest.fn(async () => (opts.debitedWalletId ? { walletId: opts.debitedWalletId } : null)),
      findMany: jest.fn(async () => opts.ledger ?? LEDGER()),
    },
    wallet: {
      findUnique: jest.fn(async ({ where }: any) => ({ id: where.id, balance: state.balances[where.id] ?? 0, reservedBalance: 0, isFrozen: false })),
      findFirst: jest.fn(async () => ({ id: 'agency-wallet' })),
    },
    counterCustomer: { findUnique: jest.fn(async () => (opts.counterName === undefined ? null : opts.counterName)) },
    auditLog: { create: jest.fn(async ({ data }: any) => { state.audits.push(data); return data; }) },
    $transaction: jest.fn(async (fn: any) => {
      const snap = snapshot();
      try { return await fn(txClient); } catch (e) {
        const o = JSON.parse(snap); state.tx = o.t; state.balances = o.b; state.moves = o.m; throw e;
      }
    }),
  };
  const wallets: any = {
    getOrCreateWallet: jest.fn(async (p: any) => ({ id: `user-wallet-${p.userId ?? p.clientId}` })),
    debitInTx: jest.fn(async (_db: any, walletId: string, amount: number, desc: string) => {
      if ((state.balances[walletId] ?? 0) < amount) throw new BadRequestException(`Solde insuffisant: ${state.balances[walletId] ?? 0}`);
      state.balances[walletId] -= amount; state.moves.push({ kind: 'debit', walletId, amount, desc });
    }),
    creditInTx: jest.fn(async (_db: any, walletId: string, amount: number, desc: string) => {
      state.balances[walletId] = (state.balances[walletId] ?? 0) + amount; state.moves.push({ kind: 'credit', walletId, amount, desc });
    }),
  };
  const notifications: any = { create: jest.fn(async (...a: any[]) => { state.notifications.push(a); }) };
  const settings: any = {
    forClient: jest.fn(async () => ({ refunds: { returnMerchantCommission: false, returnFeesOnRecall: true, recallWindowDays: 30, ...(opts.refunds ?? {}) } })),
  };
  const none: any = {};
  // ordre du constructeur : prisma, rates, feeSchedule, wallets, push, sms, walletMail, agentMail, companyMail, adminMail,
  // notifications, walletNotifier, agentNotifier, companyNotifier, adminNotifier, thresholds, transferLimits, settings…
  const service = new (TransactionsService as any)(
    prisma, none, none, wallets, none, none, none, none, none, none, notifications, none, none, none, none, none, none, settings, none, none,
  ) as TransactionsService;
  return { service, state, prisma, wallets };
}

const recall = (service: TransactionsService) => service.refundOnSupportDecision(5, 'sup2', 't1', 'rr1');

describe('rappel d\'un envoi wallet → wallet', () => {
  it('reprend la somme au destinataire, rend montant + frais à l\'expéditeur ; argent conservé dans chaque devise', async () => {
    const { service, state } = setup(paidWalletTransfer());
    const before = { ...state.balances };
    const res = await recall(service);
    expect(res.status).toBe(S.REFUNDED);
    expect(state.balances['w-recipient']).toBe(before['w-recipient'] - 99_000); // GNF repris
    expect(state.balances['w-company']).toBe(before['w-company'] - 150);          // frais rendus
    expect(state.balances['w-sender']).toBe(before['w-sender'] + 10_150);         // XOF : montant + frais
    expect(state.audits.some((a) => a.details?.decision === 'TRANSFER_RECALLED' && a.details?.feesReturned === 150)).toBe(true);
    expect(state.notifications[0][0]).toBe('u2'); // le destinataire est prévenu
  });

  it('réglage « frais rendus » fermé : seul le montant est rendu, la société garde les frais', async () => {
    const { service, state } = setup(paidWalletTransfer(), { refunds: { returnFeesOnRecall: false } });
    await recall(service);
    expect(state.balances['w-sender']).toBe(10_000);
    expect(state.balances['w-company']).toBe(1_000);
  });

  it('portefeuille de la société insuffisant : le rappel aboutit, les frais restent acquis', async () => {
    const { service, state } = setup(paidWalletTransfer(), { balances: { 'w-company': 20 } });
    const res = await recall(service);
    expect(res.status).toBe(S.REFUNDED);
    expect(state.balances['w-sender']).toBe(10_000);
    expect(state.balances['w-company']).toBe(20);
  });

  it('destinataire qui a déjà dépensé : 409, rien ne bouge, l\'envoi reste payé', async () => {
    const { service, state } = setup(paidWalletTransfer(), { balances: { 'w-recipient': 5_000 } });
    await expect(recall(service)).rejects.toBeInstanceOf(ConflictException);
    await expect(recall(service)).rejects.toThrow(/hors plateforme/);
    expect(state.tx.status).toBe(S.PAID);
    expect(state.balances['w-recipient']).toBe(5_000);
    expect(state.balances['w-sender']).toBe(0);
    expect(state.moves).toHaveLength(0);
  });

  it('rappel fermé (délai 0), délai dépassé, ou envoi cash retiré : refusé sans rien déplacer', async () => {
    const closed = setup(paidWalletTransfer(), { refunds: { recallWindowDays: 0 } });
    await expect(recall(closed.service)).rejects.toThrow(/fermé/);
    const late = setup(paidWalletTransfer({ paidAt: day(45), createdAt: day(45) }));
    await expect(recall(late.service)).rejects.toThrow(/30 jours/);
    const cash = setup(paidWalletTransfer({ payoutMethod: 'CASH_PICKUP', recipientId: null }));
    await expect(recall(cash.service)).rejects.toThrow(/déjà retiré/);
    for (const x of [closed, late, cash]) expect(x.state.moves).toHaveLength(0);
  });

  it('un seul rappel : le second (ou deux simultanés) ne rend rien de plus', async () => {
    const { service, state } = setup(paidWalletTransfer());
    const r = await Promise.allSettled([recall(service), recall(service)]);
    expect(r.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
    expect(state.balances['w-sender']).toBe(10_150);
  });

  it('journal incomplet : refus clair, rien n\'est modifié', async () => {
    const { service, state } = setup(paidWalletTransfer(), { ledger: LEDGER().slice(1) });
    await expect(recall(service)).rejects.toThrow(/journal/);
    expect(state.tx.status).toBe(S.PAID);
  });

  it('assessRecallFor : même réponse à l\'ouverture de la demande et à l\'exécution', async () => {
    const { service } = setup(paidWalletTransfer());
    expect(await service.assessRecallFor(5, paidWalletTransfer() as any)).toEqual({ ok: true, refundAmount: 10_150, refundsFees: true });
  });
});

describe('remboursement : le wallet crédité est celui du DÉBIT (journal)', () => {
  const pending = (over: Row = {}): Row => ({ ...paidWalletTransfer(), status: S.VALIDATED, payoutMethod: 'CASH_PICKUP', recipientId: null, targetCurrency: 'GNF', ...over });

  it('agent débité sur son wallet perso alors qu\'une caisse d\'agence existe : remboursé sur le wallet perso', async () => {
    const { service, state } = setup(pending({ agencyId: 'ag1' }), { debitedWalletId: 'w-personal' });
    await service.cancel('u1', 't1');
    expect(state.moves).toEqual([{ kind: 'credit', walletId: 'w-personal', amount: 10_150, desc: 'Remboursement annulation 123456789' }]);
  });

  it('sans écriture au journal (anciennes données) : repli sur la règle (caisse d\'agence)', async () => {
    const { service, state } = setup(pending({ agencyId: 'ag1' }));
    await service.cancel('u1', 't1');
    expect(state.moves[0].walletId).toBe('agency-wallet');
  });
});

describe('annulation d\'un envoi fait au comptoir : le cash à rendre est tracé', () => {
  const counterSend = (): Row => ({ ...paidWalletTransfer(), status: S.VALIDATED, payoutMethod: 'CASH_PICKUP', recipientId: null, agencyId: 'ag1', counterCustomerId: 'cc1' });

  it('renvoie à l\'agent le montant en espèces à remettre et l\'inscrit au journal d\'audit', async () => {
    const { service, state } = setup(counterSend(), { counterName: { firstName: 'Awa', lastName: 'Barry' } });
    const res: any = await service.cancel('u1', 't1');
    expect(res.status).toBe(S.CANCELLED);
    expect(res.cashToReturn).toEqual({ amount: 10_150, currency: 'XOF', reference: '123456789', customer: 'Awa Barry' });
    const trace = state.audits.find((a) => a.details?.decision === 'COUNTER_CASH_TO_RETURN');
    expect(trace).toMatchObject({ action: 'TRANSACTION_REFUND', entityId: 't1', userId: 'u1' });
    expect(trace.details).toMatchObject({ amount: 10_150, counterCustomerId: 'cc1', agencyId: 'ag1' });
  });

  it('envoi d\'un client wallet (sans client de passage) : aucune trace de cash', async () => {
    const { service, state } = setup({ ...counterSend(), counterCustomerId: null, agencyId: null });
    const res: any = await service.cancel('u1', 't1');
    expect(res.cashToReturn).toBeUndefined();
    expect(state.audits.some((a) => a.details?.decision === 'COUNTER_CASH_TO_RETURN')).toBe(false);
    // l'annulation elle-même est désormais journalisée
    expect(state.audits.some((a) => a.action === 'TRANSACTION_CANCEL')).toBe(true);
  });
});

describe('répartition des frais figée à l\'envoi (v4.34)', () => {
  const build = (prismaOver: Row) => {
    const none: any = {};
    const prisma: any = { ...prismaOver };
    return new (TransactionsService as any)(prisma, none, none, none, none, none, none, none, none, none, none, none, none, none, none, none, none, none, none, none) as any;
  };
  const fallback = { payerShare: 40, senderShare: 20, platformShare: 40 };

  it('agent d\'une agence partenaire : source PARTNER, parts de la règle la plus récente, repli par défaut pour l\'autre type', async () => {
    const findMany = jest.fn(async () => [{ destType: 'SUBSIDIARY', payerShare: 55, senderShare: 15, platformShare: 30 }]);
    const svc = build({ agency: { findFirst: jest.fn(async () => ({ type: 'PARTNER' })) }, commissionConfig: { findMany } });
    const snap = await svc.snapshotCommissionSplit(5, 'ag1', fallback);
    expect(snap.source).toBe('PARTNER');
    expect(snap.shares.SUBSIDIARY).toEqual({ payerShare: 55, senderShare: 15, platformShare: 30 });
    expect(snap.shares.PARTNER).toEqual(fallback);
    expect(findMany.mock.calls[0][0]).toMatchObject({ where: { clientId: 5, payoutMethod: null, sourceType: 'PARTNER' }, orderBy: { updatedAt: 'desc' } });
  });

  it('client wallet (sans agence) : source WALLET, aucune lecture d\'agence', async () => {
    const agencyFind = jest.fn();
    const svc = build({ agency: { findFirst: agencyFind }, commissionConfig: { findMany: jest.fn(async () => []) } });
    const snap = await svc.snapshotCommissionSplit(5, null, fallback);
    expect(snap.source).toBe('WALLET');
    expect(agencyFind).not.toHaveBeenCalled();
  });

  it('lecture impossible : aucun snapshot, l\'envoi n\'est pas bloqué', async () => {
    const svc = build({ agency: { findFirst: jest.fn(async () => { throw new Error('base indisponible'); }) } });
    await expect(svc.snapshotCommissionSplit(5, 'ag1', fallback)).resolves.toBeUndefined();
  });
});
