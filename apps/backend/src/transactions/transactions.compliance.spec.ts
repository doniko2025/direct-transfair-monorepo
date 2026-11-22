// apps/backend/src/transactions/transactions.compliance.spec.ts
// Lot 17 — conformité : règles AML par société (dossier ouvert, pays à risque, seuil réglé) et décisions sur un envoi bloqué (ON_HOLD).
import 'reflect-metadata';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { TransactionStatus as S, TransactionType as T } from '@prisma/client';
import { TransactionsService } from './transactions.service';

type Row = Record<string, any>;

function heldSetup(row: Row) {
  const state = { tx: { ...row }, credits: [] as any[], audits: [] as any[] };
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
    withdrawal: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    referralReward: { updateMany: jest.fn(async () => ({ count: 0 })), findFirst: jest.fn(async () => null), deleteMany: jest.fn(async () => ({ count: 0 })) }, // lot 18 : envoi sans frais rendu, récompense du parrain retirée
    referralRewardUse: { findUnique: jest.fn(async () => null), deleteMany: jest.fn(async () => ({ count: 0 })), count: jest.fn(async () => 0) },
    moneyRequest: { updateMany: jest.fn(async () => ({ count: 0 })) }, // lot 18 : demande d'argent rouverte au rappel
  };
  const prisma: any = {
    ledgerEntry: { findFirst: jest.fn().mockResolvedValue(null) },
    counterCustomer: { findUnique: jest.fn().mockResolvedValue(null) },
    auditLog: { create: jest.fn().mockImplementation(async (a: any) => { state.audits.push(a.data); return a; }) },
    transaction: {
      findFirst: jest.fn().mockImplementation(async ({ where }: any) => (where.id === state.tx.id && where.clientId === state.tx.clientId ? { ...state.tx } : null)),
      findUniqueOrThrow: jest.fn().mockImplementation(async () => ({ ...state.tx })),
      updateMany: jest.fn().mockImplementation(async ({ where, data }: any) => {
        if (where.id !== state.tx.id || where.clientId !== state.tx.clientId || where.status !== state.tx.status) return { count: 0 };
        Object.assign(state.tx, data);
        return { count: 1 };
      }),
    },
    wallet: { findFirst: jest.fn().mockResolvedValue(null) },
    $transaction: jest.fn().mockImplementation((fn: any) => fn(txClient)),
  };
  const wallets: any = {
    getOrCreateWallet: jest.fn().mockImplementation(async (p: any) => ({ id: `user-wallet-${p.userId}` })),
    creditInTx: jest.fn().mockImplementation(async (_db: any, walletId: string, amount: number, desc: string) => { state.credits.push({ walletId, amount, desc }); }),
  };
  const none: any = {};
  const service = new (TransactionsService as any)(prisma, {}, {}, wallets, none, {}, {}, {}, {}, {}, {}, {}, {}, none, {}) as TransactionsService;
  return { service, state };
}

const held = (over: Row = {}): Row => ({
  id: 't1', reference: '555', type: T.TRANSFER, status: S.ON_HOLD, senderId: 'u1', agencyId: null, clientId: 5, currency: 'XOF', amount: 10000, fees: 150, total: 10150, ...over,
});

describe('envoi bloqué par la conformité', () => {
  it('rejet : annulé ET remboursé du total, une seule fois, avec trace', async () => {
    const { service, state } = heldSetup(held());
    const res = await service.rejectHeld(5, 'admin1', 't1');
    expect(res.status).toBe(S.CANCELLED);
    expect(state.credits).toEqual([{ walletId: 'user-wallet-u1', amount: 10150, desc: 'Remboursement annulation 555' }]);
    expect(state.audits.some((a) => a.action === 'TRANSACTION_CANCEL' && String(a.details?.via).includes('conformité'))).toBe(true);
    await expect(service.rejectHeld(5, 'admin1', 't1')).rejects.toBeInstanceOf(ConflictException);
    expect(state.credits).toHaveLength(1);
  });

  it("rejet : un envoi qui n'est pas bloqué n'est jamais annulé par cette voie", async () => {
    const { service, state } = heldSetup(held({ status: S.VALIDATED }));
    await expect(service.rejectHeld(5, 'admin1', 't1')).rejects.toBeInstanceOf(ConflictException);
    expect(state.credits).toHaveLength(0);
  });

  it('rejet : cloisonné par société', async () => {
    const { service } = heldSetup(held());
    await expect(service.rejectHeld(99, 'admin1', 't1')).rejects.toThrow('Transaction introuvable');
  });

  it("déblocage : l'envoi reprend son statut d'avant, une seule fois", async () => {
    const { service, state } = heldSetup(held());
    const res = await service.releaseHeld(5, 'admin1', 't1', S.VALIDATED);
    expect(res.status).toBe(S.VALIDATED);
    await expect(service.releaseHeld(5, 'admin1', 't1', S.VALIDATED)).rejects.toBeInstanceOf(ConflictException);
    expect(state.credits).toHaveLength(0);
  });

  it('déblocage : refuse un statut de reprise invalide (PAID, CANCELLED…)', async () => {
    const { service, state } = heldSetup(held());
    await expect(service.releaseHeld(5, 'admin1', 't1', S.PAID)).rejects.toBeInstanceOf(BadRequestException);
    expect(state.tx.status).toBe(S.ON_HOLD);
  });
});

// ── scoreAml avec les réglages de la société ──────────────

function amlBuild(settings: Row | null, beneficiaryCountry: string | null) {
  const flags: any[] = [];
  const cases: any[] = [];
  const updates: any[] = [];
  const prisma: any = {
    transaction: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue({ clientId: 9, reference: 'REF1', recipientId: null, beneficiary: { country: beneficiaryCountry, phone: null } }),
      update: jest.fn().mockImplementation(async (a: any) => { updates.push(a); return a; }),
    },
    user: { findUnique: jest.fn().mockResolvedValue({ createdAt: new Date('2020-01-01') }) },
    amlFlag: { create: jest.fn().mockImplementation(async (a: any) => { flags.push(a.data); return a; }) },
    complianceSettings: { findUnique: jest.fn().mockResolvedValue(settings) },
    complianceCase: { create: jest.fn().mockImplementation(async (a: any) => { cases.push(a.data); return { id: 'case1' }; }) },
    alert: { create: jest.fn().mockResolvedValue({}) },
  };
  const rates: any = { convert: jest.fn(async (v: number) => v) };
  const none: any = {};
  const service = new (TransactionsService as any)(prisma, rates, {}, {}, none, {}, {}, {}, {}, {}, {}, {}, {}, none, {}) as TransactionsService;
  return { service, flags, cases, updates };
}

const SETTINGS = { sanctionsEnabled: true, matchThreshold: 88, strongMatchThreshold: 96, holdOnStrongMatch: false, amlThresholdXof: null, amlFlagScore: null, highRiskCountries: ['IR'], structuringCount: 3, fanInSenders: 3 };

describe('scoreAml — réglages de la société (lot 17)', () => {
  it('pays à risque : +25 points, signalement et dossier AML ouvert avec la règle', async () => {
    // 2 000 000 XOF = seuil → +40 ; pays à risque +25 → 65 ≥ 60.
    const { service, flags, cases } = amlBuild(SETTINGS, 'ir');
    await service.scoreAml('tx1', 'u1', 2_000_000, 'XOF', 'SEND');
    expect(flags).toHaveLength(1);
    expect(flags[0].riskScore).toBe(65);
    expect(cases).toHaveLength(1);
    expect(cases[0]).toMatchObject({ kind: 'AML_RULE', dedupeKey: 'AML:tx1', clientId: 9, transactionId: 'tx1' });
    expect(cases[0].details.rules).toEqual(['HIGH_RISK_COUNTRY']);
  });

  it('même envoi vers un autre pays : 40 points seulement, rien de signalé', async () => {
    const { service, flags, cases } = amlBuild(SETTINGS, 'GN');
    await service.scoreAml('tx1', 'u1', 2_000_000, 'XOF', 'SEND');
    expect(flags).toHaveLength(0);
    expect(cases).toHaveLength(0);
  });

  it('score de signalement réglé à 90 : le même envoi (65) n’est plus signalé', async () => {
    const { service, flags } = amlBuild({ ...SETTINGS, amlFlagScore: 90 }, 'IR');
    await service.scoreAml('tx1', 'u1', 2_000_000, 'XOF', 'SEND');
    expect(flags).toHaveLength(0);
  });

  it('seuil réglé à 10 000 000 : un envoi de 2 000 000 devient ordinaire', async () => {
    const { service, flags } = amlBuild({ ...SETTINGS, amlThresholdXof: 10_000_000, highRiskCountries: [] }, 'GN');
    await service.scoreAml('tx1', 'u1', 2_000_000, 'XOF', 'SEND');
    expect(flags).toHaveLength(0);
  });

  it('sans réglages enregistrés : comportement de la plateforme inchangé', async () => {
    const { service, flags } = amlBuild(null, 'IR');
    await service.scoreAml('tx1', 'u1', 2_000_000, 'XOF', 'SEND');
    expect(flags).toHaveLength(0); // 40 points, pays à risque non configuré
  });
});
