// apps/backend/src/transactions/transactions.refunds.spec.ts
// Phase 6 (v4.24) — annulations et B2B : statut réservé + remboursement atomique, bon wallet, bon type.
import 'reflect-metadata';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { TransactionStatus as S, TransactionType as T } from '@prisma/client';
import { TransactionsService } from './transactions.service';

type Row = Record<string, any>;

/** Mini base en mémoire : une transaction, des wallets, un journal de crédits. */
function setup(row: Row, opts: { agencyWallet?: boolean; superAdminClientId?: number | null } = {}) {
  const state = { tx: { ...row }, credits: [] as any[], withdrawalUpdates: 0 };

  const txClient: any = {
    transaction: {
      updateMany: jest.fn().mockImplementation(async ({ where, data }: any) => {
        const t = state.tx;
        if (where.id !== t.id) return { count: 0 };
        if (where.status?.in && !where.status.in.includes(t.status)) return { count: 0 };
        if (typeof where.status === 'string' && where.status !== t.status) return { count: 0 };
        if (where.type && where.type !== t.type) return { count: 0 };
        Object.assign(t, data);
        return { count: 1 };
      }),
      findUniqueOrThrow: jest.fn().mockImplementation(async () => ({ ...state.tx })),
    },
    withdrawal: { updateMany: jest.fn().mockImplementation(async () => { state.withdrawalUpdates++; return { count: 1 }; }) },
  };

  const prisma: any = {
    transaction: {
      findUnique: jest.fn().mockImplementation(async () => ({ ...state.tx, sender: { id: state.tx.senderId } })),
    },
    user: { findUnique: jest.fn().mockImplementation(async ({ where }: any) =>
      where.id === 'sa'
        ? { id: 'sa', role: 'SUPER_ADMIN', clientId: opts.superAdminClientId === undefined ? 1 : opts.superAdminClientId, email: null }
        : { id: where.id, role: 'COMPANY_ADMIN', clientId: 5, email: null }) },
    wallet: { findFirst: jest.fn().mockImplementation(async () => (opts.agencyWallet ? { id: 'agency-wallet' } : null)) },
    $transaction: jest.fn().mockImplementation((fn: any) => fn(txClient)),
  };

  const wallets: any = {
    getOrCreateWallet: jest.fn().mockImplementation(async (p: any) => ({ id: p.clientId !== undefined ? `company-wallet-${p.clientId}` : `user-wallet-${p.userId}` })),
    creditInTx: jest.fn().mockImplementation(async (_db: any, walletId: string, amount: number, desc: string) => { state.credits.push({ walletId, amount, desc }); }),
  };
  const none: any = { notifyTransferReceived: jest.fn().mockResolvedValue(undefined), notifyB2BTransferValidated: jest.fn().mockResolvedValue(undefined), notifyB2BRejected: jest.fn().mockResolvedValue(undefined) };

  const service = new (TransactionsService as any)(
    prisma, {}, {}, wallets, none, {}, {}, {}, {}, {}, {}, {}, {}, none, {},
  ) as TransactionsService;
  return { service, state, prisma, wallets };
}

const transfer = (over: Row = {}): Row => ({
  id: 't1', reference: '123456789', type: T.TRANSFER, status: S.VALIDATED, senderId: 'u1', agencyId: null,
  clientId: 5, currency: 'XOF', amount: 10000, fees: 150, total: 10150, ...over,
});

describe('TransactionsService.cancel — remboursement unique et atomique', () => {
  it('rembourse le total au wallet du client une seule fois', async () => {
    const { service, state } = setup(transfer());
    const res = await service.cancel('u1', 't1');
    expect(res.status).toBe(S.CANCELLED);
    expect(state.credits).toEqual([{ walletId: 'user-wallet-u1', amount: 10150, desc: 'Remboursement annulation 123456789' }]);
    expect(state.withdrawalUpdates).toBe(1);
  });

  it('un second appel (double clic) est refusé et ne rembourse pas deux fois', async () => {
    const { service, state } = setup(transfer());
    await service.cancel('u1', 't1');
    await expect(service.cancel('u1', 't1')).rejects.toBeInstanceOf(ConflictException);
    expect(state.credits).toHaveLength(1);
  });

  it('deux appels simultanés : un seul remboursement', async () => {
    const { service, state } = setup(transfer());
    const results = await Promise.allSettled([service.cancel('u1', 't1'), service.cancel('u1', 't1')]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(state.credits).toHaveLength(1);
  });

  it('course avec le paiement en agence : si le code vient d\'être payé, pas de remboursement', async () => {
    const { service, state, prisma } = setup(transfer());
    // L'annulation lit la transaction VALIDATED ; l'agent la passe à PAID avant que le statut soit réservé.
    const snapshot = { ...state.tx, sender: {} };
    prisma.transaction.findUnique.mockImplementationOnce(async () => snapshot);
    state.tx.status = S.PAID;
    await expect(service.cancel('u1', 't1')).rejects.toBeInstanceOf(ConflictException);
    expect(state.credits).toHaveLength(0);
  });

  it('un envoi fait par un agent est remboursé sur la CAISSE de l\'agence, pas sur son wallet personnel', async () => {
    const { service, state } = setup(transfer({ agencyId: 'ag1' }), { agencyWallet: true });
    await service.cancel('u1', 't1');
    expect(state.credits[0].walletId).toBe('agency-wallet');
  });

  it('agent dont l\'agence n\'a pas de caisse dans la devise : retombe sur son wallet (comme au débit)', async () => {
    const { service, state } = setup(transfer({ agencyId: 'ag1' }), { agencyWallet: false });
    await service.cancel('u1', 't1');
    expect(state.credits[0].walletId).toBe('user-wallet-u1');
  });

  it.each([T.DEPOSIT, T.SERVICE_PAYMENT, T.AGENCY_REFILL, T.AGENCY_REMITTANCE])(
    'refuse d\'annuler une opération de type %s (aucun argent à rendre)', async (type) => {
      const { service, state } = setup(transfer({ type }));
      await expect(service.cancel('u1', 't1')).rejects.toBeInstanceOf(ConflictException);
      expect(state.credits).toHaveLength(0);
      expect(state.tx.status).toBe(S.VALIDATED);
    });

  it('accepte un virement programmé (SCHEDULED)', async () => {
    const { service, state } = setup(transfer({ type: T.SCHEDULED }));
    await service.cancel('u1', 't1');
    expect(state.credits).toHaveLength(1);
  });

  it('refuse l\'annulation par un autre utilisateur', async () => {
    const { service, state } = setup(transfer());
    await expect(service.cancel('intrus', 't1')).rejects.toBeInstanceOf(ForbiddenException);
    expect(state.credits).toHaveLength(0);
  });

  it('refuse un transfert déjà payé ou déjà annulé / échoué', async () => {
    for (const status of [S.PAID, S.CANCELLED, S.FAILED, S.REFUNDED, S.ON_HOLD, S.EXPIRED]) {
      const { service, state } = setup(transfer({ status }));
      await expect(service.cancel('u1', 't1')).rejects.toBeInstanceOf(Error);
      expect(state.credits).toHaveLength(0);
    }
  });
});

describe('TransactionsService.adminUpdateStatusForAdmin', () => {
  it('annulation admin : même remboursement atomique, une seule fois', async () => {
    const { service, state } = setup(transfer({ status: S.PENDING }));
    await service.adminUpdateStatusForAdmin('admin1', 't1', { status: S.CANCELLED } as any);
    await expect(service.adminUpdateStatusForAdmin('admin1', 't1', { status: S.CANCELLED } as any)).rejects.toBeDefined();
    expect(state.credits).toHaveLength(1);
  });

  it('annuler une recharge en attente (DEPOSIT) ne rembourse rien', async () => {
    const { service, state } = setup(transfer({ type: T.DEPOSIT, status: S.VALIDATED }));
    const res = await service.adminUpdateStatusForAdmin('admin1', 't1', { status: S.CANCELLED } as any);
    expect(res.status).toBe(S.CANCELLED);
    expect(state.credits).toHaveLength(0);
  });

  it('annuler une déclaration B2B rembourse le MONTANT au wallet de la société', async () => {
    const { service, state } = setup(transfer({ type: T.SERVICE_PAYMENT, status: S.PENDING, total: 50000, amount: 50000 }));
    await service.adminUpdateStatusForAdmin('admin1', 't1', { status: S.CANCELLED } as any);
    expect(state.credits).toEqual([{ walletId: 'company-wallet-5', amount: 50000, desc: 'Remboursement annulation B2B 123456789' }]);
  });
});

describe('TransactionsService — B2B (Super Admin)', () => {
  const b2b = (over: Row = {}) => transfer({ type: T.SERVICE_PAYMENT, status: S.PENDING, total: 50000, amount: 50000, clientId: 5, ...over });

  it('validate : un double clic ne crédite qu\'une fois', async () => {
    const { service, state } = setup(b2b());
    await service.validateBankTransfer('sa', 't1');
    await expect(service.validateBankTransfer('sa', 't1')).rejects.toBeInstanceOf(ConflictException);
    expect(state.credits).toEqual([{ walletId: 'company-wallet-1', amount: 50000, desc: 'Validation B2B t1' }]);
    expect(state.tx.status).toBe(S.PAID);
  });

  it('validate : refuse un Super Admin sans société (le wallet serait cherché avec clientId = null)', async () => {
    const { service, state, wallets } = setup(b2b(), { superAdminClientId: null });
    await expect(service.validateBankTransfer('sa', 't1')).rejects.toBeInstanceOf(ConflictException);
    expect(wallets.getOrCreateWallet).not.toHaveBeenCalled();
    expect(state.credits).toHaveLength(0);
  });

  it('reject : rembourse le wallet de la SOCIÉTÉ (celui débité à la déclaration)', async () => {
    const { service, state } = setup(b2b());
    await service.rejectBankTransfer('sa', 't1');
    expect(state.credits).toEqual([{ walletId: 'company-wallet-5', amount: 50000, desc: 'Remboursement B2B rejeté' }]);
    expect(state.tx.status).toBe(S.CANCELLED);
  });

  it('reject : un second rejet ne rembourse pas deux fois', async () => {
    const { service, state } = setup(b2b());
    await service.rejectBankTransfer('sa', 't1');
    await expect(service.rejectBankTransfer('sa', 't1')).rejects.toBeInstanceOf(ConflictException);
    expect(state.credits).toHaveLength(1);
  });

  it('reject : ne s\'applique qu\'aux factures B2B, pas à un transfert en attente', async () => {
    const { service, state } = setup(transfer({ status: S.PENDING }));
    await expect(service.rejectBankTransfer('sa', 't1')).rejects.toBeInstanceOf(ConflictException);
    expect(state.credits).toHaveLength(0);
  });
});

describe('TransactionsService — références', () => {
  it('generateReference : 9 chiffres, jamais de 0 en tête', () => {
    const { service } = setup(transfer());
    for (let i = 0; i < 500; i++) expect((service as any).generateReference()).toMatch(/^[1-9]\d{8}$/);
  });

  it('stampedReference : préfixe + horodatage + suffixe aléatoire (deux appels différents)', () => {
    const { service } = setup(transfer());
    const a = (service as any).stampedReference('DEP');
    const b = (service as any).stampedReference('DEP');
    expect(a).toMatch(/^DEP-\d{13}-[0-9a-f]{6}$/);
    expect(a).not.toBe(b);
  });

  it('uniqueReference : saute une référence déjà prise', async () => {
    const { service, prisma } = setup(transfer());
    prisma.transaction.findFirst = jest.fn().mockResolvedValueOnce({ id: 'x' }).mockResolvedValueOnce(null);
    const ref = await (service as any).uniqueReference();
    expect(ref).toMatch(/^\d{9}$/);
    expect(prisma.transaction.findFirst).toHaveBeenCalledTimes(2);
  });
});
