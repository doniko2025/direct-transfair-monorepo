// apps/backend/src/kyc/kyc-reminders.spec.ts
// Rappels de vérification d'identité, expiration des pièces, rappel aux administrateurs.
import 'reflect-metadata';
import { KycRemindersService } from './kyc-reminders.service';
import { KycNotifierService, emailHtml } from './kyc-notifier.service';

type J = Record<string, any>;
const NOW = new Date('2026-11-07T10:00:00Z');
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

function setup(opts: { users?: J[]; claim?: number[]; stale?: J[]; docsAfter?: J[]; pending?: J[] } = {}) {
  const claims = [...(opts.claim ?? [])];
  const prisma: J = {
    user: {
      findMany: jest.fn().mockResolvedValue(opts.users ?? []),
      updateMany: jest.fn(async () => ({ count: claims.length ? claims.shift()! : 1 })),
      update: jest.fn().mockResolvedValue({}),
    },
    kycDocument: {
      findMany: jest.fn().mockImplementation(async ({ where }: J) => {
        if (where?.status === 'APPROVED') return opts.stale ?? [];
        if (where?.status === 'PENDING') return opts.pending ?? [];
        return opts.docsAfter ?? [];
      }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
  };
  const notifier: J = { notifyUser: jest.fn().mockResolvedValue(undefined), notifyCompanyAdmins: jest.fn().mockResolvedValue(2) };
  return { service: new KycRemindersService(prisma as any, notifier as any), prisma, notifier };
}

const client = (over: J = {}) => ({
  id: 'u1', email: 'a@x.com', firstName: 'Awa', createdAt: daysAgo(3), kycLevel: 'LEVEL_0', kycReminderCount: 0, kycLastReminderAt: null, kyc: [], ...over,
});

describe('KycRemindersService.sendDueReminders', () => {
  afterEach(() => { delete process.env.KYC_ENFORCEMENT; });

  it('rappelle un client non vérifié : compteur incrémenté (compare-and-set) puis notification', async () => {
    const { service, prisma, notifier } = setup({ users: [client()] });
    expect(await service.sendDueReminders(NOW)).toBe(1);
    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: { id: 'u1', kycReminderCount: 0, kycLastReminderAt: null },
      data: { kycReminderCount: { increment: 1 }, kycLastReminderAt: NOW },
    });
    expect(notifier.notifyUser).toHaveBeenCalledWith(expect.objectContaining({ id: 'u1' }), expect.objectContaining({ kind: 'REMINDER', title: 'Vérifiez votre identité' }));
  });

  it('ne sélectionne que les clients actifs, non vérifiés, sans dossier en attente, inscrits depuis plus de 24 h', async () => {
    const { service, prisma } = setup();
    await service.sendDueReminders(NOW);
    const where = prisma.user.findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({ role: 'USER', isActive: true, isSuspended: false, deletedAt: null, kycLevel: 'LEVEL_0', kyc: { none: { status: 'PENDING' } } });
    expect(where.createdAt.lte).toEqual(daysAgo(1));
  });

  it('pas encore dû (dernier rappel trop récent) : rien n\'est envoyé', async () => {
    const { service, prisma, notifier } = setup({ users: [client({ kycReminderCount: 1, kycLastReminderAt: daysAgo(1) })] });
    expect(await service.sendDueReminders(NOW)).toBe(0);
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
    expect(notifier.notifyUser).not.toHaveBeenCalled();
  });

  it('deux instances en même temps : celle qui perd le compare-and-set n\'envoie rien', async () => {
    const { service, notifier } = setup({ users: [client()], claim: [0] });
    expect(await service.sendDueReminders(NOW)).toBe(0);
    expect(notifier.notifyUser).not.toHaveBeenCalled();
  });

  it('après un refus, le rappel reprend le motif', async () => {
    const { service, notifier } = setup({ users: [client({ kyc: [{ type: 'NATIONAL_ID', status: 'REJECTED', expiryDate: null, rejectionReason: 'Photo floue' }] })] });
    await service.sendDueReminders(NOW);
    expect(notifier.notifyUser.mock.calls[0][1].body).toContain('Photo floue');
  });

  it('KYC_ENFORCEMENT=off : aucun rappel', async () => {
    process.env.KYC_ENFORCEMENT = 'off';
    const { service, prisma } = setup({ users: [client()] });
    expect(await service.sendDueReminders(NOW)).toBe(0);
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });
});

describe('KycRemindersService.expireDocuments', () => {
  const stale = (kycLevel = 'LEVEL_1') => [{ id: 'd1', userId: 'u1', type: 'NATIONAL_ID', expiryDate: new Date('2026-11-01'), user: { id: 'u1', email: 'a@x.com', firstName: 'Awa', clientId: 7, kycLevel } }];

  it('pièce expirée et plus aucune preuve d\'identité : EXPIRED, retour au niveau 0, client prévenu, journal', async () => {
    const { service, prisma, notifier } = setup({ stale: stale(), docsAfter: [{ type: 'SELFIE', status: 'APPROVED', expiryDate: null }] });
    expect(await service.expireDocuments(NOW)).toBe(1);
    expect(prisma.kycDocument.updateMany).toHaveBeenCalledWith({ where: { id: 'd1', status: 'APPROVED' }, data: { status: 'EXPIRED' } });
    expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ kycLevel: 'LEVEL_0' }) }));
    expect(notifier.notifyUser).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ title: "Pièce d'identité expirée" }));
    expect(prisma.auditLog.create.mock.calls[0][0].data.details).toMatchObject({ expired: true, levelDropped: true });
  });

  it('une autre pièce valide prouve encore l\'identité : le niveau est conservé, pas de message alarmant', async () => {
    const { service, prisma, notifier } = setup({
      stale: stale(),
      docsAfter: [{ type: 'PASSPORT', status: 'APPROVED', expiryDate: new Date('2040-01-01') }, { type: 'SELFIE', status: 'APPROVED', expiryDate: null }],
    });
    await service.expireDocuments(NOW);
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(notifier.notifyUser).not.toHaveBeenCalled();
  });

  it('une pièce déjà traitée par une autre instance n\'est pas comptée', async () => {
    const { service, prisma } = setup({ stale: stale() });
    prisma.kycDocument.updateMany.mockResolvedValue({ count: 0 });
    expect(await service.expireDocuments(NOW)).toBe(0);
  });
});

describe('KycRemindersService.remindAdmins', () => {
  it('un message par société, avec le nombre de clients en attente depuis plus de 24 h', async () => {
    const { service, notifier } = setup({
      pending: [
        { userId: 'a', user: { clientId: 7 } }, { userId: 'b', user: { clientId: 7 } }, { userId: 'a', user: { clientId: 7 } },
        { userId: 'c', user: { clientId: 9 } },
      ],
    });
    await service.remindAdmins(NOW);
    expect(notifier.notifyCompanyAdmins).toHaveBeenCalledTimes(2);
    expect(notifier.notifyCompanyAdmins).toHaveBeenCalledWith(7, expect.objectContaining({ body: expect.stringContaining('2 clients attendent') }));
    expect(notifier.notifyCompanyAdmins).toHaveBeenCalledWith(9, expect.objectContaining({ body: expect.stringContaining('1 client attend') }));
  });
});

describe('KycNotifierService — les trois canaux, sans que l\'un bloque les autres', () => {
  function build(fail: { push?: boolean; mail?: boolean; notif?: boolean } = {}) {
    const prisma: J = { notification: { create: jest.fn(async () => { if (fail.notif) throw new Error('db'); return {}; }) }, user: { findMany: jest.fn().mockResolvedValue([{ id: 'adm', email: 'adm@x.com', firstName: 'Ad' }]) } };
    const push: J = { sendToUser: jest.fn(async () => { if (fail.push) throw new Error('fcm'); }) };
    const mail: J = { sendEmail: jest.fn(async () => { if (fail.mail) throw new Error('smtp'); }) };
    return { svc: new KycNotifierService(prisma as any, push as any, mail as any), prisma, push, mail };
  }
  const msg = { kind: 'REMINDER' as const, title: 'T', body: 'Corps <b>x</b>', actionUrl: '/profile/kyc', actionLabel: 'Vérification' };

  it('notification + push + e-mail', async () => {
    const { svc, prisma, push, mail } = build();
    await svc.notifyUser({ id: 'u1', email: 'a@x.com', firstName: 'Awa' }, msg);
    expect(prisma.notification.create.mock.calls[0][0].data).toMatchObject({ channels: ['IN_APP', 'PUSH', 'EMAIL'], groupKey: 'kyc', actionUrl: '/profile/kyc' });
    expect(push.sendToUser).toHaveBeenCalledTimes(1);
    expect(mail.sendEmail).toHaveBeenCalledTimes(1);
  });

  it('une panne de push, d\'e-mail ou de notification n\'empêche pas les autres canaux', async () => {
    const { svc, push, mail, prisma } = build({ push: true, mail: true, notif: true });
    await expect(svc.notifyUser({ id: 'u1', email: 'a@x.com', firstName: 'Awa' }, msg)).resolves.toBeUndefined();
    expect(prisma.notification.create).toHaveBeenCalled();
    expect(push.sendToUser).toHaveBeenCalled();
    expect(mail.sendEmail).toHaveBeenCalled();
  });

  it('sans e-mail enregistré : pas de tentative d\'e-mail', async () => {
    const { svc, mail } = build();
    await svc.notifyUser({ id: 'u1', email: null, firstName: 'Awa' }, msg);
    expect(mail.sendEmail).not.toHaveBeenCalled();
  });

  it('le contenu inséré dans l\'e-mail est échappé', () => {
    const html = emailHtml('<script>', msg);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;b&gt;x&lt;/b&gt;');
  });

  it('prévenir les administrateurs : notification + push, sans e-mail', async () => {
    const { svc, mail, push } = build();
    expect(await svc.notifyCompanyAdmins(7, msg)).toBe(1);
    expect(push.sendToUser).toHaveBeenCalled();
    expect(mail.sendEmail).not.toHaveBeenCalled();
  });
});

describe('KycRemindersService.remindExpiring (lot 8)', () => {
  afterEach(() => { delete process.env.KYC_ENFORCEMENT; });
  const inDays = (n: number) => new Date(NOW.getTime() + n * 86_400_000);
  const idDoc = (over: J = {}) => ({ id: 'd1', userId: 'u1', type: 'PASSPORT', expiryDate: inDays(25), expiryNoticeDays: null, user: { id: 'u1', email: 'a@x.com', firstName: 'Awa' }, ...over });
  function build(docs: J[], others: J[] = [], claim = 1) {
    const s = setup();
    s.prisma.kycDocument.findMany.mockImplementation(async ({ where }: J) => (where?.id?.not ? others : docs));
    s.prisma.kycDocument.updateMany.mockResolvedValue({ count: claim });
    return s;
  }

  it('pièce qui expire dans 25 jours : alerte « 30 jours » envoyée une fois, seuil mémorisé (compare-and-set)', async () => {
    const { service, prisma, notifier } = build([idDoc()]);
    expect(await service.remindExpiring(NOW)).toBe(1);
    expect(prisma.kycDocument.updateMany).toHaveBeenCalledWith({ where: { id: 'd1', status: 'APPROVED', expiryNoticeDays: null }, data: { expiryNoticeDays: 30 } });
    const [user, msg] = notifier.notifyUser.mock.calls[0];
    expect(user.id).toBe('u1');
    expect(msg).toMatchObject({ kind: 'EXPIRING', actionUrl: '/profile/kyc' });
    expect(msg.body).toContain('encore 26 jours'); // le jour d'expiration compte encore comme valable
  });

  it('seuil déjà envoyé : rien ; 6 jours avant : alerte urgente « 7 jours »', async () => {
    const a = build([idDoc({ expiryNoticeDays: 30 })]);
    expect(await a.service.remindExpiring(NOW)).toBe(0);
    const b = build([idDoc({ expiryDate: inDays(6), expiryNoticeDays: 30 })]);
    expect(await b.service.remindExpiring(NOW)).toBe(1);
    expect(b.notifier.notifyUser.mock.calls[0][1]).toMatchObject({ priority: 'HIGH' });
    expect(b.prisma.kycDocument.updateMany.mock.calls[0][0].data).toEqual({ expiryNoticeDays: 7 });
  });

  it('une autre instance a déjà pris le seuil (compare-and-set perdu) : pas de doublon', async () => {
    const { service, notifier } = build([idDoc()], [], 0);
    expect(await service.remindExpiring(NOW)).toBe(0);
    expect(notifier.notifyUser).not.toHaveBeenCalled();
  });

  it('nouvelle pièce déjà déposée en attente, ou autre pièce valable plus longtemps : pas d\'alerte', async () => {
    const pending = build([idDoc()], [{ status: 'PENDING', expiryDate: null }]);
    expect(await pending.service.remindExpiring(NOW)).toBe(0);
    const longer = build([idDoc()], [{ status: 'APPROVED', expiryDate: inDays(900) }]);
    expect(await longer.service.remindExpiring(NOW)).toBe(0);
  });

  it('un client n\'est prévenu qu\'une fois par passage, même avec deux pièces proches de l\'échéance', async () => {
    const { service, notifier } = build([idDoc(), idDoc({ id: 'd2', type: 'NATIONAL_ID', expiryDate: inDays(26) })]);
    expect(await service.remindExpiring(NOW)).toBe(1);
    expect(notifier.notifyUser).toHaveBeenCalledTimes(1);
  });

  it('KYC_ENFORCEMENT=off : aucune alerte', async () => {
    process.env.KYC_ENFORCEMENT = 'off';
    const { service, prisma } = build([idDoc()]);
    expect(await service.remindExpiring(NOW)).toBe(0);
    expect(prisma.kycDocument.findMany).not.toHaveBeenCalled();
  });

  it('la tâche de 10 h appelle aussi les alertes d\'expiration', async () => {
    const { service } = build([idDoc()]);
    const spy = jest.spyOn(service, 'remindExpiring');
    await service.dailyReminders();
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
