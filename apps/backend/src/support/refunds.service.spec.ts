// apps/backend/src/support/refunds.service.spec.ts
// Remboursements : règle des quatre yeux, réservation atomique de la décision, échec propre si l'envoi a été payé, reprise après panne.
import 'reflect-metadata';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';

import { canDecideOwn, RefundsService } from './refunds.service';

type J = Record<string, any>;

const sup1 = { id: 'sup1', role: 'SUPPORT', clientId: 7, permissions: ['REFUNDS_DECIDE', 'DISPUTES_RESOLVE'] } as any;
const sup2 = { id: 'sup2', role: 'SUPPORT', clientId: 7, permissions: ['REFUNDS_DECIDE'] } as any;
const admin = { id: 'adm', role: 'COMPANY_ADMIN', clientId: 7 } as any;

function setup(over: { tx?: J | null; reqRow?: J | null; claim?: number; refund?: () => Promise<any>; pendingExists?: number } = {}) {
  const audits: J[] = [];
  const tx = over.tx === undefined ? { id: 'tx1', reference: 'TR-1', type: 'TRANSFER', status: 'PENDING', total: 105, currency: 'EUR', sender: { id: 'cust', email: 'c@x.fr', firstName: 'Awa' } } : over.tx;
  const reqRow = over.reqRow === undefined ? { id: 'r1', clientId: 7, transactionId: 'tx1', ticketId: null, amount: 105, currency: 'EUR', reason: 'Doublon', status: 'PENDING', requestedById: 'sup1', createdAt: new Date() } : over.reqRow;
  const prisma: J = {
    transaction: { findFirst: jest.fn(async () => tx), findUnique: jest.fn(async () => tx), findMany: jest.fn(async () => []) },
    refundRequest: {
      count: jest.fn(async () => over.pendingExists ?? 0),
      create: jest.fn(async ({ data }: J) => ({ id: 'r1', createdAt: new Date(), status: 'PENDING', ...data })),
      findFirst: jest.fn(async () => reqRow),
      updateMany: jest.fn(async () => ({ count: over.claim ?? 1 })),
      update: jest.fn(async ({ data }: J) => ({ ...reqRow, ...data })),
      findUniqueOrThrow: jest.fn(async () => ({ ...reqRow, status: 'APPROVED', createdAt: new Date() })),
    },
    supportTicket: { findFirst: jest.fn(async () => ({ id: 'tk1' })) },
    user: { findUnique: jest.fn(async () => ({ id: 'sup1', email: 's@x.fr', firstName: 'Sup' })), findMany: jest.fn(async () => []) },
    auditLog: { create: jest.fn(async ({ data }: J) => { audits.push(data); return data; }) },
  };
  const transactions = { refundOnSupportDecision: jest.fn(over.refund ?? (async () => ({ id: 'tx1' }))) };
  const notifier = { notifyUser: jest.fn(async () => undefined), notifyDeciders: jest.fn(async () => 1) };
  return { service: new RefundsService(prisma as any, transactions as any, notifier as any), prisma, transactions, notifier, audits };
}

describe('RefundsService.create', () => {
  it('ouvre la demande pour le TOTAL débité, prévient les décideurs (sauf le demandeur) et trace', async () => {
    const { service, notifier, audits, prisma } = setup();
    const r = await service.create(sup1, { transactionId: 'tx1', reason: 'Doublon constaté' });
    expect(r).toMatchObject({ amount: 105, currency: 'EUR', status: 'PENDING', reference: 'TR-1' });
    expect(prisma.refundRequest.create.mock.calls[0][0].data).toMatchObject({ clientId: 7, requestedById: 'sup1' });
    expect(notifier.notifyDeciders).toHaveBeenCalledWith(7, expect.anything(), 'REFUNDS_DECIDE', 'sup1');
    expect(audits[0]).toMatchObject({ action: 'REFUND_REQUEST' });
  });

  it('refuse : envoi payé, autre type, déjà une demande en attente, opération d\'une autre société', async () => {
    await expect(setup({ tx: { id: 'tx1', reference: 'R', type: 'TRANSFER', status: 'PAID', total: 1, currency: 'EUR' } }).service.create(sup1, { transactionId: 'tx1', reason: 'motif ok' })).rejects.toThrow(/hors plateforme/);
    await expect(setup({ tx: { id: 'tx1', reference: 'R', type: 'DEPOSIT', status: 'PENDING', total: 1, currency: 'EUR' } }).service.create(sup1, { transactionId: 'tx1', reason: 'motif ok' })).rejects.toBeInstanceOf(ConflictException);
    await expect(setup({ pendingExists: 1 }).service.create(sup1, { transactionId: 'tx1', reason: 'motif ok' })).rejects.toBeInstanceOf(ConflictException);
    await expect(setup({ tx: null }).service.create(sup1, { transactionId: 'txAutre', reason: 'motif ok' })).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('RefundsService.decide', () => {
  it('quatre yeux : le support ne décide pas sa propre demande, l\'admin le peut', async () => {
    expect(canDecideOwn('SUPPORT')).toBe(false);
    expect(canDecideOwn('COMPANY_ADMIN')).toBe(true);
    const a = setup();
    await expect(a.service.decide(sup1, 'r1', { approve: true })).rejects.toBeInstanceOf(ForbiddenException);
    expect(a.prisma.refundRequest.updateMany).not.toHaveBeenCalled();
    expect(a.transactions.refundOnSupportDecision).not.toHaveBeenCalled();

    const b = setup();
    await b.service.decide(admin, 'r1', { approve: true });
    expect(b.transactions.refundOnSupportDecision).toHaveBeenCalledWith(7, 'adm', 'tx1', 'r1');
  });

  it('accepter : réserve la décision (PENDING → APPROVED), rembourse, trace, prévient demandeur et client', async () => {
    const { service, prisma, transactions, audits, notifier } = setup();
    await service.decide(sup2, 'r1', { approve: true, note: 'OK' });
    expect(prisma.refundRequest.updateMany.mock.calls[0][0]).toMatchObject({ where: { id: 'r1', status: 'PENDING' }, data: { status: 'APPROVED', decidedById: 'sup2' } });
    expect(transactions.refundOnSupportDecision).toHaveBeenCalledTimes(1);
    expect(audits[0]).toMatchObject({ action: 'REFUND_DECIDE', details: { decision: 'APPROVED' } });
    expect(notifier.notifyUser).toHaveBeenCalledTimes(2); // demandeur + client
  });

  it('deux décideurs simultanés : le second perd la réservation et ne rembourse rien', async () => {
    const { service, transactions } = setup({ claim: 0 });
    await expect(service.decide(sup2, 'r1', { approve: true })).rejects.toBeInstanceOf(ConflictException);
    expect(transactions.refundOnSupportDecision).not.toHaveBeenCalled();
  });

  it('refuser exige un motif et ne touche pas à l\'argent', async () => {
    const a = setup();
    await expect(a.service.decide(sup2, 'r1', { approve: false })).rejects.toBeInstanceOf(BadRequestException);
    const b = setup();
    await b.service.decide(sup2, 'r1', { approve: false, note: 'Envoi conforme' });
    expect(b.transactions.refundOnSupportDecision).not.toHaveBeenCalled();
    expect(b.prisma.refundRequest.updateMany.mock.calls[0][0].data).toMatchObject({ status: 'REJECTED' });
  });

  it('envoi payé entre-temps : la demande passe en FAILED (hors plateforme), rien n\'est remboursé', async () => {
    const { service, prisma, audits } = setup({ refund: async () => { throw new ConflictException('Le bénéficiaire a déjà retiré l\'argent'); } });
    await service.decide(sup2, 'r1', { approve: true });
    expect(prisma.refundRequest.update.mock.calls[0][0].data).toMatchObject({ status: 'FAILED' });
    expect(audits[0].details).toMatchObject({ decision: 'FAILED' });
  });

  it('panne technique : la demande redevient décidable et l\'erreur remonte', async () => {
    const { service, prisma } = setup({ refund: async () => { throw new Error('connexion perdue'); } });
    await expect(service.decide(sup2, 'r1', { approve: true })).rejects.toThrow('connexion perdue');
    expect(prisma.refundRequest.update.mock.calls[0][0].data).toMatchObject({ status: 'PENDING', decidedById: null });
  });

  it('demande déjà traitée ou introuvable', async () => {
    await expect(setup({ reqRow: null }).service.decide(sup2, 'zz', { approve: true })).rejects.toBeInstanceOf(NotFoundException);
    await expect(setup({ reqRow: { id: 'r1', status: 'APPROVED', requestedById: 'x' } }).service.decide(sup2, 'r1', { approve: true })).rejects.toBeInstanceOf(ConflictException);
  });
});
