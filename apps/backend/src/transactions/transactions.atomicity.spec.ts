// apps/backend/src/transactions/transactions.atomicity.spec.ts
// Phase 6 (v4.27) — envoi, dépôt agent et recharge d'agence : transaction + débit + crédits dans UNE transaction SQL.
// La base simulée annule tout (état restauré) quand le callback de $transaction échoue.
import 'reflect-metadata';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { TransactionsService } from './transactions.service';

type Json = Record<string, any>;

function setup(opts: { sender?: Json; failCreditOn?: string; limitsFail?: boolean } = {}) {
  const state = {
    balances: { 'w-sender': 1_000_000, 'w-recipient': 0, 'w-company': 0, 'w-agency': 500_000, 'w-admin': 0, 'w-client': 0 } as Record<string, number>,
    rows: [] as Json[],
    ledger: [] as Json[],
  };
  const inTx = { value: false };
  const snapshot = () => JSON.stringify(state);
  let seq = 0;

  const tx: Json = {
    transaction: {
      create: jest.fn().mockImplementation(async ({ data }: Json) => {
        if (!inTx.value) throw new Error('écriture de la Transaction HORS transaction SQL');
        const row = { id: `t${++seq}`, ...data };
        state.rows.push(row);
        return row;
      }),
    },
  };

  const prisma: Json = {
    transaction: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(async () => { throw new Error('transaction.create appelé hors $transaction'); }),
    },
    user: {
      findUnique: jest.fn().mockImplementation(async ({ where }: Json) => {
        if (where.id === 'sender') return opts.sender ?? { id: 'sender', clientId: 7, role: 'USER', agencyId: null, firstName: 'A', lastName: 'B', email: null, wallets: [{ id: 'w-sender', currency: 'XOF', balance: 1_000_000, reservedBalance: 0 }] };
        if (where.id === 'admin') return { id: 'admin', role: 'COMPANY_ADMIN', clientId: 7 };
        if (where.id === 'agent') return { id: 'agent', clientId: 7, agencyId: 'ag1', email: null, firstName: 'G', lastName: 'H', wallets: [] };
        return null;
      }),
      findFirst: jest.fn().mockResolvedValue({ id: 'recipient', clientId: 7, role: 'USER', primaryCurrency: 'XOF', firstName: 'R', lastName: 'S', email: null, isSuspended: false, phone: '+224600', wallets: [] }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    beneficiary: { findFirst: jest.fn().mockResolvedValue(null) },
    wallet: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([{ id: 'w-agency', currency: 'XOF', balance: 500_000, reservedBalance: 0, isDefault: true }]),
      findUnique: jest.fn().mockImplementation(async ({ where }: Json) => ({ id: where.id, currency: 'XOF', balance: state.balances[where.id] ?? 0, reservedBalance: 0 })),
    },
    agency: { findUnique: jest.fn().mockResolvedValue({ id: 'ag1', name: 'Agence 1', clientId: 7 }) },
    $transaction: jest.fn().mockImplementation(async (fn: any) => {
      const before = snapshot();
      inTx.value = true;
      try {
        return await fn(tx);
      } catch (e) {
        const restored = JSON.parse(before);
        state.balances = restored.balances; state.rows = restored.rows; state.ledger = restored.ledger;
        throw e;
      } finally {
        inTx.value = false;
      }
    }),
  };

  const wallets: Json = {
    getOrCreateWallet: jest.fn().mockImplementation(async (p: Json) => {
      if (p.userId === 'recipient') return { id: 'w-recipient', currency: p.currency };
      if (p.agencyId) return { id: 'w-agency', currency: p.currency };
      if (p.clientId !== undefined) return { id: p.clientId === 7 && opts.failCreditOn === 'company' ? 'w-company' : 'w-company', currency: p.currency };
      if (p.userId) return { id: 'w-client', currency: p.currency };
      return { id: 'w-admin', currency: p.currency };
    }),
    debit: jest.fn(),
    credit: jest.fn(),
    debitInTx: jest.fn().mockImplementation(async (_db: any, id: string, amount: number, desc: string, txId?: string) => {
      if (!inTx.value) throw new Error('débit HORS transaction SQL');
      if ((state.balances[id] ?? 0) < amount) throw new BadRequestException('Solde insuffisant');
      state.balances[id] -= amount;
      state.ledger.push({ id, type: 'DEBIT', amount, txId, desc });
    }),
    creditInTx: jest.fn().mockImplementation(async (_db: any, id: string, amount: number, desc: string, txId?: string) => {
      if (!inTx.value) throw new Error('crédit HORS transaction SQL');
      if (opts.failCreditOn && id === opts.failCreditOn) throw new Error('panne pendant le crédit');
      state.balances[id] = (state.balances[id] ?? 0) + amount;
      state.ledger.push({ id, type: 'CREDIT', amount, txId, desc });
    }),
  };

  const feeSchedule: Json = { quote: jest.fn().mockResolvedValue({ fees: 1000 }) };
  const rates: Json = { convert: jest.fn().mockImplementation(async (a: number) => a) };
  const none: Json = new Proxy({}, { get: () => jest.fn().mockResolvedValue(undefined) });
  const thresholds: Json = { thresholdFor: jest.fn().mockResolvedValue(500_000) };
  const limits: Json = {
    assertWithinLimits: jest.fn().mockImplementation(async (db: any) => {
      if (opts.limitsFail) throw new ForbiddenException({ code: 'LIMIT_EXCEEDED', message: 'Plafond dépassé' });
      void db;
    }),
  };

  const service = new (TransactionsService as any)(
    prisma, rates, feeSchedule, wallets, none, none, none, none, none, none, none, none, none, none, none, thresholds, limits,
  ) as TransactionsService;
  return { service, state, prisma, wallets, limits };
}

const walletSend = { amount: 100_000, currency: 'XOF', payoutMethod: 'WALLET', beneficiaryId: 'recipient' } as any;

describe('TransactionsService.create — atomique', () => {
  it('écrit transaction, débit, crédit destinataire et commission dans la même transaction SQL', async () => {
    const { service, state, wallets } = setup();
    const t: any = await service.create('sender', walletSend);
    expect(state.rows).toHaveLength(1);
    expect(state.balances['w-sender']).toBe(1_000_000 - 101_000);
    expect(state.balances['w-recipient']).toBe(100_000);
    expect(state.balances['w-company']).toBe(1_000);
    expect(state.ledger.every((l) => l.txId === t.id)).toBe(true);
    expect(wallets.debit).not.toHaveBeenCalled();
    expect(wallets.credit).not.toHaveBeenCalled();
  });

  it('une panne au crédit du destinataire annule tout : pas de débit, pas de ligne Transaction', async () => {
    const { service, state } = setup({ failCreditOn: 'w-recipient' });
    await expect(service.create('sender', walletSend)).rejects.toThrow('panne pendant le crédit');
    expect(state.rows).toHaveLength(0);
    expect(state.balances['w-sender']).toBe(1_000_000);
    expect(state.balances['w-recipient']).toBe(0);
    expect(state.ledger).toHaveLength(0);
  });

  it('une panne au crédit de la commission annule aussi le débit et le crédit du destinataire', async () => {
    const { service, state } = setup({ failCreditOn: 'w-company' });
    await expect(service.create('sender', walletSend)).rejects.toThrow();
    expect(state.rows).toHaveLength(0);
    expect(state.balances['w-sender']).toBe(1_000_000);
    expect(state.balances['w-recipient']).toBe(0);
  });

  it('un plafond dépassé détecté sous verrou annule le débit et la ligne Transaction', async () => {
    const { service, state, limits } = setup();
    // 1er appel (avant frais) passe, 2e appel (sous verrou) refuse : deux envois simultanés
    limits.assertWithinLimits.mockImplementationOnce(async () => undefined).mockImplementationOnce(async () => {
      throw new ForbiddenException({ code: 'LIMIT_EXCEEDED', message: 'Plafond dépassé' });
    });
    await expect(service.create('sender', walletSend)).rejects.toBeInstanceOf(ForbiddenException);
    expect(state.rows).toHaveLength(0);
    expect(state.balances['w-sender']).toBe(1_000_000);
  });

  it('le contrôle sous verrou exclut l\'envoi qui vient d\'être créé du cumul', async () => {
    const { service, limits } = setup();
    const t: any = await service.create('sender', walletSend);
    const calls = limits.assertWithinLimits.mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls[0][1].excludeTransactionId).toBeUndefined();
    expect(calls[1][1].excludeTransactionId).toBe(t.id);
  });

  it('plafond dépassé dès le contrôle initial : rien n\'est écrit', async () => {
    const { service, state } = setup({ limitsFail: true });
    await expect(service.create('sender', walletSend)).rejects.toBeInstanceOf(ForbiddenException);
    expect(state.rows).toHaveLength(0);
  });
});

describe('TransactionsService.create — garde-fous destinataire (v4.31)', () => {
  const beneficiary = { id: 'b1', userId: 'sender', clientId: 7, phone: '+224699999999', country: 'GN', fullName: 'Inconnu' };

  it('Wallet vers un numéro SANS compte : refusé AVANT tout débit, message explicite', async () => {
    const { service, state, prisma } = setup();
    prisma.beneficiary.findFirst.mockResolvedValue(beneficiary);
    prisma.user.findFirst.mockResolvedValue(null); // aucun compte avec ce numéro
    await expect(service.create('sender', { ...walletSend, beneficiaryId: 'b1' })).rejects.toThrow(/Aucun compte n'existe avec ce numéro/);
    await expect(service.create('sender', { ...walletSend, beneficiaryId: 'b1' })).rejects.toBeInstanceOf(BadRequestException);
    expect(state.rows).toHaveLength(0);
    expect(state.ledger).toHaveLength(0);
    expect(state.balances['w-sender']).toBe(1_000_000);
  });

  it('Mobile Money vers un numéro sans compte : même refus, aucun débit', async () => {
    const { service, state, prisma } = setup();
    prisma.beneficiary.findFirst.mockResolvedValue(beneficiary);
    prisma.user.findFirst.mockResolvedValue(null);
    await expect(service.create('sender', { ...walletSend, payoutMethod: 'MOBILE_MONEY', beneficiaryId: 'b1' })).rejects.toBeInstanceOf(BadRequestException);
    expect(state.balances['w-sender']).toBe(1_000_000);
    expect(state.rows).toHaveLength(0);
  });

  it('envoi à soi-même refusé, aucun débit', async () => {
    const { service, state, prisma } = setup();
    prisma.user.findFirst.mockResolvedValue({ id: 'sender', clientId: 7, role: 'USER', primaryCurrency: 'XOF', firstName: 'A', lastName: 'B', email: null, phone: '+224600', wallets: [] });
    await expect(service.create('sender', walletSend)).rejects.toThrow(/vous envoyer de l'argent à vous-même/);
    expect(state.balances['w-sender']).toBe(1_000_000);
    expect(state.rows).toHaveLength(0);
  });
});

describe('TransactionsService.deposit — atomique', () => {
  it('débite la caisse, crédite le client et écrit la transaction ensemble', async () => {
    const { service, state } = setup();
    const t: any = await service.deposit('agent', { amount: 50_000, userPhone: '+224600' } as any);
    expect(state.balances['w-agency']).toBe(450_000);
    expect(state.balances['w-recipient']).toBe(50_000);
    expect(state.rows).toHaveLength(1);
    expect(state.ledger.map((l) => l.txId)).toEqual([t.id, t.id]);
  });

  it('une panne au crédit du client rend la caisse intacte et ne laisse aucune transaction', async () => {
    const { service, state } = setup({ failCreditOn: 'w-recipient' });
    await expect(service.deposit('agent', { amount: 50_000, userPhone: '+224600' } as any)).rejects.toThrow('panne pendant le crédit');
    expect(state.balances['w-agency']).toBe(500_000);
    expect(state.rows).toHaveLength(0);
    expect(state.ledger).toHaveLength(0);
  });
});

describe('TransactionsService.refillAgency — atomique', () => {
  it('débite la société, crédite la caisse et écrit la transaction ensemble', async () => {
    const { service, state } = setup();
    state.balances['w-company'] = 800_000; // le wallet de la société de l'admin
    await service.refillAgency('admin', 'ag1', 100_000, 'XOF');
    expect(state.balances['w-company']).toBe(700_000);
    expect(state.balances['w-agency']).toBe(600_000);
    expect(state.rows).toHaveLength(1);
    expect(state.rows[0]).toMatchObject({ type: 'AGENCY_REFILL', agencyId: 'ag1' });
  });

  it('une panne au crédit de la caisse annule le débit de la société', async () => {
    const { service, state } = setup({ failCreditOn: 'w-agency' });
    state.balances['w-company'] = 800_000;
    await expect(service.refillAgency('admin', 'ag1', 100_000, 'XOF')).rejects.toThrow('panne pendant le crédit');
    expect(state.balances['w-company']).toBe(800_000);
    expect(state.balances['w-agency']).toBe(500_000);
    expect(state.rows).toHaveLength(0);
  });
});
