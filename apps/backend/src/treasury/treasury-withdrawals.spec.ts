import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { TreasuryWithdrawalsService } from './treasury-withdrawals.service';
import { whyCannotCancel, whyCannotDecide } from './withdrawal-rules';

type Row = Record<string, any>;

function build(row?: Row, opts: { debitFails?: boolean } = {}) {
  const state: Row = { row: row ? { ...row } : null, debits: [] as any[], audits: [] as any[], notifs: [] as any[] };
  const matches = (r: Row, where: Row) =>
    (where.id === undefined || where.id === r.id) && (where.status === undefined || where.status === r.status)
    && (!where.requestedBy?.not || where.requestedBy.not !== r.requestedBy) && (!where.expiresAt?.gt || r.expiresAt > where.expiresAt.gt)
    && (where.requestedBy === undefined || typeof where.requestedBy !== 'string' || where.requestedBy === r.requestedBy);
  const model = {
    findUnique: jest.fn().mockImplementation(async () => (state.row ? { ...state.row } : null)),
    count: jest.fn().mockResolvedValue(0),
    create: jest.fn().mockImplementation(async (a: any) => { state.row = { id: 'r1', status: 'PENDING', ...a.data }; return { ...state.row }; }),
    updateMany: jest.fn().mockImplementation(async (a: any) => {
      if (!state.row || !matches(state.row, a.where)) return { count: 0 };
      Object.assign(state.row, a.data); return { count: 1 };
    }),
  };
  const tx: any = { treasuryWithdrawalRequest: model };
  const prisma: any = {
    treasuryWithdrawalRequest: model,
    auditLog: { create: jest.fn().mockImplementation(async (a: any) => { state.audits.push(a.data); return a; }) },
    notification: { create: jest.fn().mockImplementation(async (a: any) => { state.notifs.push(a.data); return a; }) },
    user: { findMany: jest.fn().mockResolvedValue([{ id: 'adm2' }]) },
    // Vrai comportement transactionnel : si le débit échoue, la prise en charge est annulée.
    $transaction: jest.fn().mockImplementation(async (fn: any) => { const snap = { ...state.row }; try { return await fn(tx); } catch (e) { state.row = snap; throw e; } }),
  };
  const wallets: any = {
    getOrCreateWallet: jest.fn().mockResolvedValue({ id: 'cw1', currency: 'XOF' }),
    debitInTx: jest.fn().mockImplementation(async (_t: any, id: string, amount: number) => {
      if (opts.debitFails) throw new ForbiddenException('Solde insuffisant');
      state.debits.push({ id, amount });
    }),
  };
  return { service: new TreasuryWithdrawalsService(prisma, wallets), state, wallets };
}

const pending = (over: Row = {}): Row => ({ id: 'r1', clientId: 7, currency: 'XOF', amount: 50000, reason: null, status: 'PENDING', requestedBy: 'adm1', expiresAt: new Date(Date.now() + 3_600_000), ...over });
const admin = (id: string, clientId = 7): any => ({ id, sub: id, role: 'COMPANY_ADMIN', clientId });

describe('double validation des retraits (audit argent I4)', () => {
  it('la demande ne débite rien, prévient les autres admins et laisse une trace', async () => {
    const { service, state, wallets } = build();
    const res = await service.request(admin('adm1'), { currency: 'XOF', amount: 50000, reason: 'Fournisseur' });
    expect(res.status).toBe('PENDING');
    expect(wallets.debitInTx).not.toHaveBeenCalled();
    expect(state.audits[0].entityId).toBe('TREASURY_WITHDRAW_REQUEST');
    expect(state.notifs).toHaveLength(1);
  });

  it('le demandeur ne peut pas approuver sa propre demande', async () => {
    const { service, wallets } = build(pending());
    await expect(service.approve(admin('adm1'), 'r1')).rejects.toBeInstanceOf(ForbiddenException);
    expect(wallets.debitInTx).not.toHaveBeenCalled();
  });

  it('un autre admin de la société approuve : le retrait est exécuté une seule fois', async () => {
    const { service, state } = build(pending());
    await service.approve(admin('adm2'), 'r1');
    expect(state.debits).toEqual([{ id: 'cw1', amount: 50000 }]);
    expect(state.row.status).toBe('APPROVED');
    await expect(service.approve(admin('adm3'), 'r1')).rejects.toBeInstanceOf(ConflictException);
    expect(state.debits).toHaveLength(1);
  });

  it('le super admin peut approuver (société à un seul administrateur)', async () => {
    const { service, state } = build(pending());
    await service.approve({ id: 'sa', sub: 'sa', role: 'SUPER_ADMIN', clientId: 1 } as any, 'r1');
    expect(state.debits).toHaveLength(1);
  });

  it('un admin d’une autre société ne voit pas la demande (404)', async () => {
    const { service } = build(pending());
    await expect(service.approve(admin('x', 99), 'r1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('demande expirée : refusée et marquée expirée', async () => {
    const { service, state, wallets } = build(pending({ expiresAt: new Date(Date.now() - 1000) }));
    await expect(service.approve(admin('adm2'), 'r1')).rejects.toBeInstanceOf(ConflictException);
    expect(state.row.status).toBe('EXPIRED');
    expect(wallets.debitInTx).not.toHaveBeenCalled();
  });

  it('solde insuffisant : rien n’est débité, la demande reste en attente avec la cause', async () => {
    const { service, state } = build(pending(), { debitFails: true });
    await expect(service.approve(admin('adm2'), 'r1')).rejects.toBeInstanceOf(ForbiddenException);
    expect(state.row.status).toBe('PENDING');
    expect(String(state.row.failureReason)).toContain('insuffisant');
  });

  it('refus puis plus de décision possible ; seul le demandeur annule', async () => {
    const a = build(pending());
    await a.service.reject(admin('adm2'), 'r1', 'Montant trop élevé');
    expect(a.state.row.status).toBe('REJECTED');
    await expect(a.service.approve(admin('adm3'), 'r1')).rejects.toBeInstanceOf(ConflictException);
    const b = build(pending());
    await expect(b.service.cancel(admin('adm2'), 'r1')).rejects.toBeInstanceOf(ForbiddenException);
    await b.service.cancel(admin('adm1'), 'r1');
    expect(b.state.row.status).toBe('CANCELLED');
  });

  it('règles pures', () => {
    const r = { clientId: 7, requestedBy: 'a', status: 'PENDING', expiresAt: new Date(Date.now() + 1000) };
    expect(whyCannotDecide({ id: 'a', role: 'COMPANY_ADMIN', clientId: 7 }, r)).toBe('OWN_REQUEST');
    expect(whyCannotDecide({ id: 'b', role: 'AGENT', clientId: 7 }, r)).toBe('ROLE');
    expect(whyCannotDecide({ id: 'b', role: 'COMPANY_ADMIN', clientId: 7 }, r)).toBeNull();
    expect(whyCannotCancel({ id: 'a', role: 'COMPANY_ADMIN' }, r)).toBeNull();
  });
});
