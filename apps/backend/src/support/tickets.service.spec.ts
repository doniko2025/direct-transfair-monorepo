// apps/backend/src/support/tickets.service.spec.ts
// Demandes et litiges : plafond de demandes ouvertes, contestation de ses seules opérations, cloisonnement par société,
// décision de litige soumise à DISPUTES_RESOLVE, notes internes invisibles du client.
import 'reflect-metadata';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';

import { MAX_OPEN_PER_USER, statusAfterClientReply, statusAfterStaffReply, TicketsService } from './tickets.service';

type J = Record<string, any>;

const client = { id: 'u1', role: 'USER', clientId: 7 } as any;
const supportTickets = { id: 's1', role: 'SUPPORT', clientId: 7, permissions: ['TICKETS_HANDLE'] } as any;
const supportDisputes = { id: 's2', role: 'SUPPORT', clientId: 7, permissions: ['TICKETS_HANDLE', 'DISPUTES_RESOLVE', 'TRANSACTIONS_VIEW'] } as any;
const otherCompanySupport = { id: 's3', role: 'SUPPORT', clientId: 9, permissions: ['TICKETS_HANDLE'] } as any;

function ticket(over: J = {}): J {
  return {
    id: 't1', userId: 'u1', clientId: 7, subject: 'Envoi bloqué', message: 'Mon envoi ne part pas', category: 'transaction', status: 'OPEN', priority: 'HIGH',
    transactionId: null, assignedTo: null, outcome: null, resolutionNote: null, resolvedAt: null, closedAt: null, createdAt: new Date(), updatedAt: new Date(),
    user: { id: 'u1', firstName: 'Awa', lastName: 'Diop', email: 'awa@x.fr', phone: '+33600000000' }, ...over,
  };
}

function setup(t: J | null = ticket(), over: { open?: number; tx?: J | null } = {}) {
  const audits: J[] = [];
  const notifier = { notifyUser: jest.fn(async () => undefined), notifyDeciders: jest.fn(async () => 1) };
  const prisma: J = {
    supportTicket: {
      count: jest.fn(async ({ where }: J) => (where.transactionId ? 0 : over.open ?? 0)),
      create: jest.fn(async ({ data }: J) => ticket({ ...data, id: 'new1' })),
      findFirst: jest.fn(async ({ where }: J) => (t && where.id === t.id && (where.userId === undefined || where.userId === t.userId) && (where.clientId === undefined || where.clientId === t.clientId) ? t : null)),
      findMany: jest.fn(async () => (t ? [t] : [])),
      update: jest.fn(async ({ data }: J) => ({ ...t, ...data })),
      groupBy: jest.fn(async () => []),
    },
    supportTicketReply: { create: jest.fn(async ({ data }: J) => data), findMany: jest.fn(async () => []) },
    transaction: { findFirst: jest.fn(async () => (over.tx === undefined ? { id: 'tx1', reference: 'TR-1', type: 'TRANSFER', status: 'PENDING', amount: 100, fees: 5, total: 105, currency: 'EUR', payoutMethod: 'CASH_PICKUP', createdAt: new Date() } : over.tx)) },
    refundRequest: { findMany: jest.fn(async () => []) },
    user: { findMany: jest.fn(async () => []) },
    auditLog: { create: jest.fn(async ({ data }: J) => { audits.push(data); return data; }) },
    $transaction: jest.fn(async (ops: any[]) => Promise.all(ops)),
  };
  return { service: new TicketsService(prisma as any, notifier as any), prisma, notifier, audits };
}

describe('règles de statut', () => {
  it('réponse du support : on attend le client, sauf note interne ou ticket traité', () => {
    expect(statusAfterStaffReply('OPEN', false)).toBe('WAITING_USER');
    expect(statusAfterStaffReply('IN_PROGRESS', false)).toBe('WAITING_USER');
    expect(statusAfterStaffReply('OPEN', true)).toBe('OPEN');
    expect(statusAfterStaffReply('RESOLVED', false)).toBe('RESOLVED');
  });
  it('réponse du client : retour dans la file, ticket clos refusé', () => {
    expect(statusAfterClientReply('WAITING_USER')).toBe('OPEN');
    expect(statusAfterClientReply('RESOLVED')).toBe('OPEN');
    expect(statusAfterClientReply('IN_PROGRESS')).toBe('IN_PROGRESS');
    expect(statusAfterClientReply('CLOSED')).toBeNull();
  });
});

describe('TicketsService — client', () => {
  it('ouvre une demande simple et prévient le service client', async () => {
    const { service, notifier, audits } = setup();
    const r = await service.create(client, { subject: 'Question', message: 'Comment changer mon numéro ?' });
    expect(r).toMatchObject({ isDispute: false, status: 'OPEN' });
    expect(notifier.notifyDeciders).toHaveBeenCalledWith(7, expect.objectContaining({ title: 'Nouvelle demande client' }), 'TICKETS_HANDLE');
    expect(audits[0]).toMatchObject({ action: 'SUPPORT_TICKET_CREATE' });
  });

  it(`refuse au-delà de ${MAX_OPEN_PER_USER} demandes ouvertes`, async () => {
    const { service } = setup(ticket(), { open: MAX_OPEN_PER_USER });
    await expect(service.create(client, { subject: 'Encore', message: 'Une de plus svp merci' })).rejects.toBeInstanceOf(ConflictException);
  });

  it('un litige ne porte que sur SON opération (404 sinon) et passe en priorité haute', async () => {
    const { service, prisma } = setup(ticket(), { tx: null });
    await expect(service.create(client, { subject: 'Litige', message: 'Je conteste cet envoi', transactionId: 'txAutre' })).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.transaction.findFirst.mock.calls[0][0].where).toMatchObject({ clientId: 7, OR: [{ senderId: 'u1' }, { recipientId: 'u1' }] });

    const ok = setup();
    const r = await ok.service.create(client, { subject: 'Litige', message: 'Je conteste cet envoi', transactionId: 'tx1' });
    expect(r).toMatchObject({ isDispute: true, priority: 'HIGH', transactionId: 'tx1' });
  });

  it("le client ne voit que ses demandes, jamais les notes internes", async () => {
    const { service, prisma } = setup();
    await service.getMine(client, 't1');
    expect(prisma.supportTicketReply.findMany.mock.calls[0][0].where).toMatchObject({ ticketId: 't1', isInternal: false });
    await expect(service.getMine({ ...client, id: 'u2' }, 't1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('répondre sur un ticket clos est refusé ; sur un ticket résolu il est rouvert', async () => {
    await expect(setup(ticket({ status: 'CLOSED' })).service.replyMine(client, 't1', { message: 'merci' })).rejects.toBeInstanceOf(ConflictException);
    const { service, prisma } = setup(ticket({ status: 'RESOLVED' }));
    await service.replyMine(client, 't1', { message: 'Toujours pas reçu' });
    expect(prisma.supportTicket.update.mock.calls[0][0].data).toMatchObject({ status: 'OPEN', resolvedAt: null });
  });
});

describe('TicketsService — service client', () => {
  it('cloisonné par société : un support d\'une autre société ne trouve pas le ticket', async () => {
    const { service } = setup();
    await expect(service.detail(otherCompanySupport, 't1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('répondre : statut « en attente du client », client prévenu, action tracée ; note interne : rien envoyé', async () => {
    const a = setup();
    await a.service.reply(supportTickets, 't1', { message: 'Pouvez-vous préciser ?' });
    expect(a.prisma.supportTicket.update.mock.calls[0][0].data).toMatchObject({ status: 'WAITING_USER', assignedTo: 's1' });
    expect(a.notifier.notifyUser).toHaveBeenCalledTimes(1);
    expect(a.audits[0]).toMatchObject({ action: 'SUPPORT_TICKET_REPLY', details: { internal: false } });

    const b = setup();
    await b.service.reply(supportTickets, 't1', { message: 'À vérifier avec la compta', internal: true });
    expect(b.notifier.notifyUser).not.toHaveBeenCalled();
    expect(b.prisma.supportTicket.update.mock.calls[0][0].data.status).toBe('OPEN');
  });

  it('régler un LITIGE exige DISPUTES_RESOLVE ; une demande simple se clôt avec INFO seulement', async () => {
    const dispute = ticket({ transactionId: 'tx1' });
    await expect(setup(dispute).service.resolve(supportTickets, 't1', { outcome: 'ACCEPTED', note: 'Vous avez raison' })).rejects.toBeInstanceOf(ForbiddenException);

    const ok = setup(dispute);
    const r = await ok.service.resolve(supportDisputes, 't1', { outcome: 'ACCEPTED', note: 'Vous avez raison' });
    expect(ok.prisma.supportTicket.update.mock.calls[0][0].data).toMatchObject({ status: 'RESOLVED', outcome: 'ACCEPTED', resolvedById: 's2' });
    expect(ok.audits[0]).toMatchObject({ action: 'SUPPORT_TICKET_RESOLVE', details: { outcome: 'ACCEPTED', dispute: true } });
    expect(ok.notifier.notifyUser).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ kind: 'TICKET_RESOLVED', type: 'SUCCESS' }));
    expect(r).toBeDefined();

    await expect(setup().service.resolve(supportTickets, 't1', { outcome: 'REJECTED', note: 'Refusé sans objet' })).rejects.toBeInstanceOf(BadRequestException);
    await setup().service.resolve(supportTickets, 't1', { outcome: 'INFO', note: 'Voici la marche à suivre' });
  });

  it('un ticket déjà traité ne se règle pas deux fois ; un litige ne se clôt qu\'une fois réglé', async () => {
    await expect(setup(ticket({ status: 'RESOLVED' })).service.resolve(supportTickets, 't1', { outcome: 'INFO', note: 'Déjà fait ok' })).rejects.toBeInstanceOf(ConflictException);
    await expect(setup(ticket({ transactionId: 'tx1' })).service.close(supportDisputes, 't1')).rejects.toBeInstanceOf(ConflictException);
    await setup(ticket({ transactionId: 'tx1', status: 'RESOLVED' })).service.close(supportDisputes, 't1');
  });
});
