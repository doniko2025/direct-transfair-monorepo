// apps/backend/src/transactions/transactions.atomicity.spec.ts
// Phase 6 (v4.27) — envoi, dépôt agent et recharge d'agence : transaction + débit + crédits dans UNE transaction SQL.
// La base simulée annule tout (état restauré) quand le callback de $transaction échoue.
import 'reflect-metadata';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { defaultSettings } from '../company-settings/company-settings.logic';
import { KycGuardService } from '../kyc/kyc-guard.service';
import { CounterCustomersService } from '../kyc/counter-customers.service';

type Json = Record<string, any>;

function setup(opts: { sender?: Json; failCreditOn?: string; limitsFail?: boolean; depositLimitFail?: boolean; counterLimitFail?: boolean; agencyWallet?: boolean } = {}) {
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
        if (where.id === 'sender') return opts.sender ?? { id: 'sender', clientId: 7, role: 'USER', kycLevel: 'LEVEL_1', agencyId: null, firstName: 'A', lastName: 'B', email: null, wallets: [{ id: 'w-sender', currency: 'XOF', balance: 1_000_000, reservedBalance: 0 }] };
        if (where.id === 'admin') return { id: 'admin', role: 'COMPANY_ADMIN', clientId: 7 };
        if (where.id === 'agent') return { id: 'agent', clientId: 7, agencyId: 'ag1', email: null, firstName: 'G', lastName: 'H', wallets: [] };
        return null;
      }),
      findFirst: jest.fn().mockResolvedValue({ id: 'recipient', clientId: 7, role: 'USER', primaryCurrency: 'XOF', firstName: 'R', lastName: 'S', email: null, isSuspended: false, phone: '+224600', wallets: [] }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    beneficiary: { findFirst: jest.fn().mockResolvedValue(null) },
    kycDocument: { findMany: jest.fn().mockResolvedValue([]) },
    counterCustomer: {
      store: [] as Json[],
      findUnique: jest.fn().mockImplementation(async ({ where }: Json) => prisma.counterCustomer.store.find((c: Json) => c.idNumber === where.clientId_idNumber.idNumber) ?? null),
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockImplementation(async () => prisma.counterCustomer.store.map((c: Json) => ({ id: c.id }))),
      create: jest.fn().mockImplementation(async ({ data }: Json) => { const row = { id: `cc${prisma.counterCustomer.store.length + 1}`, createdAt: new Date(), ...data }; prisma.counterCustomer.store.push(row); return row; }),
      update: jest.fn().mockImplementation(async ({ where, data }: Json) => Object.assign(prisma.counterCustomer.store.find((c: Json) => c.id === where.id), data)),
    },
    counterIdFile: { findMany: jest.fn().mockResolvedValue([]), upsert: jest.fn().mockResolvedValue({}) },
    wallet: {
      findFirst: jest.fn().mockResolvedValue(opts.agencyWallet ? { id: 'w-agency', currency: 'XOF', balance: 500_000, reservedBalance: 0, agencyId: 'ag1' } : null),
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
    // ✅ v4.33 — plafond de dépôt (contrôlé dans la transaction SQL du dépôt).
    assertDepositWithinLimits: jest.fn().mockImplementation(async () => {
      if (opts.depositLimitFail) throw new ForbiddenException({ code: 'DEPOSIT_LIMIT_EXCEEDED', message: 'Plafond de dépôt dépassé' });
    }),
    // lot 7 — plafond des envois au comptoir (par personne)
    assertCounterWithinLimits: jest.fn().mockImplementation(async () => {
      if (opts.counterLimitFail) throw new ForbiddenException({ code: 'COUNTER_LIMIT_EXCEEDED', message: 'Plafond comptoir dépassé' });
    }),
  };

  const service = new (TransactionsService as any)(
    prisma, rates, feeSchedule, wallets, none, none, none, none, none, none, none, none, none, none, none, thresholds, limits,
    { forClient: jest.fn().mockResolvedValue(defaultSettings()) },
    new KycGuardService(prisma as any),
    new CounterCustomersService(prisma as any),
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

  it('dépassement du plafond de dépôt du client : tout est annulé (caisse intacte, client non crédité, aucune transaction)', async () => {
    const { service, state, limits } = setup({ depositLimitFail: true });
    await expect(service.deposit('agent', { amount: 50_000, userPhone: '+224600' } as any)).rejects.toMatchObject({ response: { code: 'DEPOSIT_LIMIT_EXCEEDED' } });
    expect(limits.assertDepositWithinLimits).toHaveBeenCalledTimes(1);
    expect(state.balances['w-agency']).toBe(500_000);
    expect(state.balances['w-recipient'] ?? 0).toBe(0);
    expect(state.rows).toHaveLength(0);
    expect(state.ledger).toHaveLength(0);
  });

  it('le plafond est contrôlé avec le client destinataire, la devise de la caisse et le montant, en excluant le dépôt créé', async () => {
    const { service, limits } = setup();
    const t: any = await service.deposit('agent', { amount: 50_000, userPhone: '+224600' } as any);
    const arg = limits.assertDepositWithinLimits.mock.calls[0][1];
    expect(arg).toMatchObject({ amount: 50_000, excludeTransactionId: t.id });
    expect(arg.recipientUserId).toBeDefined();
    expect(arg.currency).toBeDefined();
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


// ✅ lot 7 — identité vérifiée exigée pour un client ; pièce d'identité exigée pour un envoi au comptoir
describe('TransactionsService.create — KYC (lot 7)', () => {
  const unverified = { id: 'sender', clientId: 7, role: 'USER', kycLevel: 'LEVEL_0', agencyId: null, firstName: 'A', lastName: 'B', email: null, wallets: [{ id: 'w-sender', currency: 'XOF', balance: 1_000_000, reservedBalance: 0 }] };

  it('client non vérifié : 403 KYC_REQUIRED, rien n\'est débité ni écrit', async () => {
    const { service, state } = setup({ sender: unverified });
    const err: any = await service.create('sender', walletSend).catch((e) => e);
    expect(err).toBeInstanceOf(ForbiddenException);
    expect(err.getResponse()).toMatchObject({ code: 'KYC_REQUIRED', kycStatus: 'NOT_SUBMITTED' });
    expect(state.rows).toHaveLength(0);
    expect(state.balances['w-sender']).toBe(1_000_000);
  });

  it('dossier déposé mais pas encore validé : le message l\'indique (PENDING)', async () => {
    const { service, prisma } = setup({ sender: unverified });
    prisma.kycDocument.findMany.mockResolvedValue([{ type: 'NATIONAL_ID', status: 'PENDING', expiryDate: null }]);
    const err: any = await service.create('sender', walletSend).catch((e) => e);
    expect(err.getResponse()).toMatchObject({ code: 'KYC_REQUIRED', kycStatus: 'PENDING' });
    expect(err.getResponse().message).toMatch(/en cours de vérification/);
  });

  it('KYC_ENFORCEMENT=off : le blocage est levé (recette)', async () => {
    process.env.KYC_ENFORCEMENT = 'off';
    try {
      const { service, state } = setup({ sender: unverified });
      await service.create('sender', walletSend);
      expect(state.rows).toHaveLength(1);
    } finally { delete process.env.KYC_ENFORCEMENT; }
  });

  const agent = { id: 'sender', clientId: 7, role: 'AGENT', kycLevel: 'LEVEL_1', agencyId: 'ag1', firstName: 'G', lastName: 'H', email: null, wallets: [] };
  const photo = (extra = 0) => `data:image/jpeg;base64,${Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(9000 + extra, 7)]).toString('base64')}`;
  const counterSend = { amount: 100_000, currency: 'XOF', payoutMethod: 'WALLET', beneficiaryId: 'recipient' } as any;
  const idFields = {
    senderFirstName: 'Awa', senderLastName: 'Diop', senderPhone: '+33612345678', senderBirthDate: '1990-05-12',
    senderIdType: 'NATIONAL_ID', senderIdNumber: 'ab 123-456', senderIdExpiry: '2099-01-01',
    senderIdFront: photo(), senderIdBack: photo(1),
  };

  it('envoi au comptoir SANS pièce d\'identité : 400 COUNTER_ID_REQUIRED, rien n\'est débité', async () => {
    const { service, state } = setup({ sender: agent, agencyWallet: true });
    const err: any = await service.create('sender', { ...counterSend, senderFirstName: 'Awa', senderLastName: 'Diop', senderPhone: '+33612345678' }).catch((e) => e);
    expect(err.getResponse()).toMatchObject({ code: 'COUNTER_ID_REQUIRED' });
    expect(state.rows).toHaveLength(0);
    expect(state.balances['w-agency']).toBe(500_000);
  });

  it('envoi au comptoir avec pièce valide : fiche créée, transaction rattachée, plafond contrôlé sous verrou', async () => {
    const { service, state, prisma, limits } = setup({ sender: agent, agencyWallet: true });
    await service.create('sender', { ...counterSend, ...idFields });
    expect(prisma.counterCustomer.store).toHaveLength(1);
    expect(prisma.counterCustomer.store[0]).toMatchObject({ idNumber: 'AB123456', lastName: 'Diop', clientId: 7, createdById: 'sender' });
    expect(state.rows[0].counterCustomerId).toBe('cc1');
    const calls = limits.assertCounterWithinLimits.mock.calls;
    expect(calls).toHaveLength(2); // avant, puis sous verrou dans la transaction SQL
    expect(calls[1][1]).toMatchObject({ lock: true, excludeTransactionId: state.rows[0].id });
  });

  it('plafond du comptoir dépassé : rien n\'est débité ni écrit', async () => {
    const { service, state } = setup({ sender: agent, agencyWallet: true, counterLimitFail: true });
    await expect(service.create('sender', { ...counterSend, ...idFields })).rejects.toMatchObject({ response: { code: 'COUNTER_LIMIT_EXCEEDED' } });
    expect(state.rows).toHaveLength(0);
    expect(state.balances['w-agency']).toBe(500_000);
  });

  it('même pièce sous un autre nom / une autre date de naissance : 403 COUNTER_ID_MISMATCH', async () => {
    const { service, prisma } = setup({ sender: agent, agencyWallet: true });
    await service.create('sender', { ...counterSend, ...idFields });
    const err: any = await service.create('sender', { ...counterSend, ...idFields, senderLastName: 'Sow', senderIdNumber: 'AB123456' }).catch((e) => e);
    expect(err.getResponse()).toMatchObject({ code: 'COUNTER_ID_MISMATCH' });
    expect(prisma.counterCustomer.store).toHaveLength(1);
  });

  it('pièce expirée ou expéditeur mineur : refusé', async () => {
    const { service } = setup({ sender: agent, agencyWallet: true });
    await expect(service.create('sender', { ...counterSend, ...idFields, senderIdExpiry: '2020-01-01' })).rejects.toMatchObject({ response: { code: 'COUNTER_ID_REQUIRED' } });
    await expect(service.create('sender', { ...counterSend, ...idFields, senderBirthDate: '2015-01-01' })).rejects.toMatchObject({ response: { code: 'COUNTER_ID_REQUIRED' } });
  });
});
