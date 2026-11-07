// apps/backend/src/kyc/kyc.service.spec.ts
// Vérification d'identité : envoi, décision de l'administrateur, niveau, cloisonnement entre sociétés, relecture des pièces.
import 'reflect-metadata';
import { BadRequestException, ConflictException, ForbiddenException, HttpException, NotFoundException } from '@nestjs/common';
import { KycService } from './kyc.service';

type J = Record<string, any>;

const jpeg = (n = 20_000) => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(n, 1)]).toString('base64');

function setup(opts: { users?: J[]; docs?: J[] } = {}) {
  const users: J[] = opts.users ?? [{ id: 'u1', role: 'USER', clientId: 7, kycLevel: 'LEVEL_0', kycVerifiedAt: null, firstName: 'Awa', lastName: 'Diop', email: 'a@x.com', isActive: true, deletedAt: null, createdAt: new Date('2026-10-01') }];
  const docs: J[] = (opts.docs ?? []).map((d) => ({ createdAt: new Date(), version: 1, documentNumber: null, issuedCountry: null, backUrl: null, reviewedAt: null, reviewedById: null, rejectionReason: null, expiryDate: null, ...d }));
  const files: J[] = [];
  const audits: J[] = [];
  const notifications: J[] = [];
  const userOf = (id: string) => users.find((u) => u.id === id);

  const matches = (d: J, where: J = {}): boolean =>
    Object.entries(where).every(([k, v]) => {
      if (k === 'createdAt' && v && typeof v === 'object') return d.createdAt >= (v as J).gte;
      if (v && typeof v === 'object' && 'in' in (v as J)) return (v as J).in.includes(d[k]);
      return d[k] === v;
    });

  const kycDocument: J = {
    findMany: jest.fn(async ({ where }: J = {}) => docs.filter((d) => matches(d, where)).sort((a, b) => b.createdAt - a.createdAt)),
    findFirst: jest.fn(async ({ where }: J = {}) => docs.filter((d) => matches(d, where)).sort((a, b) => b.version - a.version)[0] ?? null),
    findUnique: jest.fn(async ({ where }: J) => {
      const d = docs.find((x) => x.id === where.id);
      if (!d) return null;
      const u = userOf(d.userId)!;
      return { ...d, user: { id: u.id, clientId: u.clientId, kycLevel: u.kycLevel, firstName: u.firstName, lastName: u.lastName, email: u.email } };
    }),
    count: jest.fn(async ({ where }: J = {}) => docs.filter((d) => matches(d, where)).length),
    deleteMany: jest.fn(async ({ where }: J) => { const before = docs.length; for (let i = docs.length - 1; i >= 0; i--) if (matches(docs[i], where)) docs.splice(i, 1); return { count: before - docs.length }; }),
    create: jest.fn(async ({ data }: J) => {
      const { files: f, ...row } = data;
      const d = { createdAt: new Date(), rejectionReason: null, reviewedAt: null, reviewedById: null, ...row };
      docs.push(d);
      for (const x of f?.create ?? []) files.push({ documentId: d.id, ...x });
      return d;
    }),
    updateMany: jest.fn(async ({ where, data }: J) => {
      const hit = docs.filter((d) => d.id === where.id && d.status === where.status);
      hit.forEach((d) => Object.assign(d, data));
      return { count: hit.length };
    }),
  };
  const prisma: J = {
    user: {
      findUnique: jest.fn(async ({ where }: J) => userOf(where.id) ?? null),
      findFirst: jest.fn(async ({ where }: J) => users.find((u) => u.id === where.id && u.role === (where.role ?? u.role)) ?? null),
      update: jest.fn(async ({ where, data }: J) => Object.assign(userOf(where.id)!, data)),
      findMany: jest.fn(async () => [{ id: 'adm', email: 'adm@x.com', firstName: 'Ad' }]),
    },
    kycDocument,
    kycFile: {
      findUnique: jest.fn(async ({ where }: J) => files.find((f) => f.documentId === where.documentId_kind.documentId && f.kind === where.documentId_kind.kind) ?? null),
    },
    notification: { create: jest.fn(async ({ data }: J) => { notifications.push(data); return data; }) },
    auditLog: {
      create: jest.fn(async ({ data }: J) => { audits.push({ createdAt: new Date(), ...data }); return data; }),
      findMany: jest.fn(async ({ where }: J) =>
        audits.filter((a) => a.userId === where.userId && a.action === where.action && a.entity === where.entity && a.entityId === where.entityId && a.createdAt >= where.createdAt.gte).map((a) => ({ details: a.details }))),
    },
    $transaction: jest.fn(async (fn: any) => fn(prisma)),
  };
  const notifier: J = {
    notifyUser: jest.fn().mockResolvedValue(undefined),
    notifyCompanyAdmins: jest.fn().mockResolvedValue(1),
  };
  return { service: new KycService(prisma as any, notifier as any), prisma, docs, files, users, audits, notifications, notifier };
}

const admin = { id: 'adm', sub: 'adm', role: 'COMPANY_ADMIN', clientId: 7 } as any;
const otherAdmin = { id: 'adm2', sub: 'adm2', role: 'COMPANY_ADMIN', clientId: 9 } as any;
const superAdmin = { id: 'sa', sub: 'sa', role: 'SUPER_ADMIN' } as any;
const idDto = { type: 'NATIONAL_ID', front: jpeg(), back: jpeg(), documentNumber: 'AB 123456', expiryDate: '2040-01-01' };

describe('KycService.submit', () => {
  it('enregistre la pièce EN ATTENTE avec ses photos, journalise et prévient les administrateurs', async () => {
    const { service, docs, files, audits, notifier } = setup();
    const r: any = await service.submit('u1', idDto as any);
    expect(docs).toHaveLength(1);
    expect(docs[0]).toMatchObject({ userId: 'u1', type: 'NATIONAL_ID', status: 'PENDING', version: 1 });
    expect(files.map((f) => f.kind).sort()).toEqual(['BACK', 'FRONT']);
    expect(files.every((f) => f.mimeType === 'image/jpeg' && f.sha256.length === 64)).toBe(true);
    expect(audits[0]).toMatchObject({ action: 'KYC_SUBMIT', clientId: 7 });
    expect(notifier.notifyCompanyAdmins).toHaveBeenCalledWith(7, expect.objectContaining({ kind: 'ADMIN_NEW' }));
    expect(r.status).toBe('PENDING');
    expect(r.missing).toEqual(['SELFIE']);
  });

  it('refuse : verso manquant, date d\'expiration absente ou passée, numéro absent, fichier non image', async () => {
    const { service, docs } = setup();
    await expect(service.submit('u1', { ...idDto, back: undefined } as any)).rejects.toThrow(/verso/);
    await expect(service.submit('u1', { ...idDto, expiryDate: undefined } as any)).rejects.toThrow(/expiration/);
    await expect(service.submit('u1', { ...idDto, expiryDate: '2020-01-01' } as any)).rejects.toThrow(/expirée/);
    await expect(service.submit('u1', { ...idDto, documentNumber: ' ' } as any)).rejects.toThrow(/numéro/);
    await expect(service.submit('u1', { ...idDto, front: Buffer.alloc(30_000, 65).toString('base64') } as any)).rejects.toBeInstanceOf(BadRequestException);
    expect(docs).toHaveLength(0);
  });

  it('le selfie n\'a besoin ni de verso, ni de numéro, ni de date', async () => {
    const { service, docs } = setup();
    await service.submit('u1', { type: 'SELFIE', front: jpeg() } as any);
    expect(docs[0]).toMatchObject({ type: 'SELFIE', status: 'PENDING' });
  });

  it('un nouvel envoi remplace la pièce du même type encore en attente (version suivante)', async () => {
    const { service, docs } = setup();
    await service.submit('u1', idDto as any);
    await service.submit('u1', idDto as any);
    expect(docs.filter((d) => d.status === 'PENDING')).toHaveLength(1);
  });

  it('pièce déjà validée et valide : 409 ; réservé aux clients wallet ; au plus 12 envois par jour', async () => {
    const a = setup({ docs: [{ id: 'd0', userId: 'u1', type: 'NATIONAL_ID', status: 'APPROVED', expiryDate: new Date('2040-01-01') }] });
    await expect(a.service.submit('u1', idDto as any)).rejects.toBeInstanceOf(ConflictException);

    const b = setup({ users: [{ id: 'ag', role: 'AGENT', clientId: 7, kycLevel: 'LEVEL_1', isActive: true, deletedAt: null }] });
    await expect(b.service.submit('ag', idDto as any)).rejects.toBeInstanceOf(ForbiddenException);

    const many = Array.from({ length: 12 }, (_, i) => ({ id: `r${i}`, userId: 'u1', type: 'PROOF_OF_ADDRESS', status: 'REJECTED' }));
    const c = setup({ docs: many });
    const err: any = await c.service.submit('u1', idDto as any).catch((e) => e);
    expect(err).toBeInstanceOf(HttpException);
    expect(err.getStatus()).toBe(429);
  });
});

describe('KycService.approve', () => {
  const pending = (id: string, type: string, extra: J = {}) => ({ id, userId: 'u1', type, status: 'PENDING', ...extra });

  it('pièce d\'identité seule validée : le niveau reste 0 (il manque le selfie) et le client est prévenu', async () => {
    const { service, users, notifier } = setup({ docs: [pending('d1', 'NATIONAL_ID', { expiryDate: new Date('2040-01-01') }), pending('d2', 'SELFIE')] });
    await service.approve(admin, 'd1');
    expect(users[0].kycLevel).toBe('LEVEL_0');
    expect(notifier.notifyUser).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ kind: 'PARTIAL' }));
  });

  it('pièce + selfie validés : niveau 1, date de validation, compteur de rappels remis à zéro, journal', async () => {
    const { service, users, audits, notifier } = setup({ docs: [pending('d1', 'NATIONAL_ID', { expiryDate: new Date('2040-01-01') }), pending('d2', 'SELFIE')] });
    users[0].kycReminderCount = 4;
    await service.approve(admin, 'd1');
    await service.approve(admin, 'd2', 'visage conforme');
    expect(users[0]).toMatchObject({ kycLevel: 'LEVEL_1', kycReminderCount: 0 });
    expect(users[0].kycVerifiedAt).toBeInstanceOf(Date);
    expect(audits.filter((a) => a.action === 'KYC_APPROVE')).toHaveLength(2);
    expect(audits[audits.length - 1].details).toMatchObject({ levelBefore: 'LEVEL_0', levelAfter: 'LEVEL_1', note: 'visage conforme' });
    expect(notifier.notifyUser).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ kind: 'APPROVED' }));
  });

  it('une pièce déjà traitée ne l\'est pas deux fois (409), le niveau ne bouge pas', async () => {
    const { service, users } = setup({ docs: [{ id: 'd1', userId: 'u1', type: 'SELFIE', status: 'APPROVED' }] });
    await expect(service.approve(admin, 'd1')).rejects.toBeInstanceOf(ConflictException);
    expect(users[0].kycLevel).toBe('LEVEL_0');
  });

  it('un niveau accordé à la main (LEVEL_3) n\'est jamais abaissé par une validation', async () => {
    const { service, users } = setup({ docs: [pending('d1', 'NATIONAL_ID', { expiryDate: new Date('2040-01-01') })] });
    users[0].kycLevel = 'LEVEL_3';
    await service.approve(admin, 'd1');
    expect(users[0].kycLevel).toBe('LEVEL_3');
  });

  it('refuse de valider une pièce expirée', async () => {
    const { service } = setup({ docs: [pending('d1', 'NATIONAL_ID', { expiryDate: new Date('2020-01-01') })] });
    await expect(service.approve(admin, 'd1')).rejects.toThrow(/expirée/);
  });

  it('cloisonnement : l\'administrateur d\'une autre société ne voit pas le dossier (404) ; un client ne peut pas décider', async () => {
    const { service, docs } = setup({ docs: [pending('d1', 'SELFIE')] });
    await expect(service.approve(otherAdmin, 'd1')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.approve({ id: 'u1', role: 'USER', clientId: 7 } as any, 'd1')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.approve({ id: 'ag', role: 'AGENT', clientId: 7 } as any, 'd1')).rejects.toBeInstanceOf(ForbiddenException);
    expect(docs[0].status).toBe('PENDING');
    await expect(service.approve(superAdmin, 'd1')).resolves.toBeDefined();
  });
});

describe('KycService.reject', () => {
  it('motif obligatoire ; la pièce est refusée avec son motif et le client prévenu par tous les canaux', async () => {
    const { service, docs, notifier, audits } = setup({ docs: [{ id: 'd1', userId: 'u1', type: 'NATIONAL_ID', status: 'PENDING' }] });
    await expect(service.reject(admin, 'd1', '  ')).rejects.toBeInstanceOf(BadRequestException);
    await service.reject(admin, 'd1', 'Photo floue, numéro illisible');
    expect(docs[0]).toMatchObject({ status: 'REJECTED', rejectionReason: 'Photo floue, numéro illisible', reviewedById: 'adm' });
    expect(notifier.notifyUser).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ kind: 'REJECTED', body: expect.stringContaining('Photo floue') }));
    expect(audits[0]).toMatchObject({ action: 'KYC_REJECT' });
  });

  it('révocation d\'une pièce déjà validée : le niveau retombe à ce que prouvent les pièces restantes', async () => {
    const { service, users } = setup({
      docs: [
        { id: 'd1', userId: 'u1', type: 'NATIONAL_ID', status: 'APPROVED', expiryDate: new Date('2040-01-01') },
        { id: 'd2', userId: 'u1', type: 'SELFIE', status: 'APPROVED' },
      ],
    });
    users[0].kycLevel = 'LEVEL_1';
    await service.reject(admin, 'd1', 'Pièce falsifiée suspectée');
    expect(users[0].kycLevel).toBe('LEVEL_0');
  });

  it('une pièce déjà refusée ne se refuse pas deux fois', async () => {
    const { service } = setup({ docs: [{ id: 'd1', userId: 'u1', type: 'SELFIE', status: 'REJECTED' }] });
    await expect(service.reject(admin, 'd1', 'motif valable')).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('KycService.getFile — qui peut relire une pièce', () => {
  const base = { docs: [{ id: 'd1', userId: 'u1', type: 'NATIONAL_ID', status: 'PENDING' }] };
  async function withFile() {
    const s = setup(base);
    s.prisma.kycDocument.findUnique.mockImplementation(async ({ where }: J) => (where.id === 'd1' ? { id: 'd1', userId: 'u1', type: 'NATIONAL_ID', user: { clientId: 7 } } : null));
    s.files.push({ documentId: 'd1', kind: 'FRONT', mimeType: 'image/jpeg', sha256: 'x', data: Buffer.from('img') });
    return s;
  }
  it('le propriétaire, l\'administrateur de sa société et le super administrateur : oui', async () => {
    const { service } = await withFile();
    for (const who of [{ id: 'u1', role: 'USER', clientId: 7 }, admin, superAdmin]) {
      await expect(service.getFile(who as any, 'd1', 'front')).resolves.toMatchObject({ mimeType: 'image/jpeg' });
    }
  });
  it('un autre client, un agent, l\'administrateur d\'une autre société : 404 (existence non confirmée)', async () => {
    const { service } = await withFile();
    for (const who of [{ id: 'u2', role: 'USER', clientId: 7 }, { id: 'ag', role: 'AGENT', clientId: 7 }, otherAdmin]) {
      await expect(service.getFile(who as any, 'd1', 'front')).rejects.toBeInstanceOf(NotFoundException);
    }
  });
});

describe('KycService.submit — renouvellement avant l\'échéance (lot 8)', () => {
  const inDays = (n: number) => new Date(Date.now() + n * 86_400_000);
  const base = (expiryDate: Date) => ({ users: [{ id: 'u1', role: 'USER', clientId: 7, kycLevel: 'LEVEL_1', kycVerifiedAt: new Date(), firstName: 'Awa', lastName: 'Diop', email: 'a@x.com', isActive: true, deletedAt: null }], docs: [{ id: 'old', userId: 'u1', type: 'NATIONAL_ID', status: 'APPROVED', expiryDate }, { id: 'sel', userId: 'u1', type: 'SELFIE', status: 'APPROVED' }] });

  it('pièce valable encore 10 jours : une pièce de remplacement est acceptée, l\'ancienne reste valable', async () => {
    const { service, docs } = setup(base(inDays(10)));
    const r: J = await service.submit('u1', idDto as any);
    expect(r.document).toMatchObject({ type: 'NATIONAL_ID', status: 'PENDING', version: 2 });
    expect(docs.find((d) => d.id === 'old')!.status).toBe('APPROVED');
    expect(r).toMatchObject({ status: 'APPROVED', verified: true, canTransact: true });
  });

  it('pièce valable encore plusieurs mois : toujours 409 ; un selfie validé n\'est jamais renouvelable avant terme', async () => {
    const far = setup(base(inDays(200)));
    await expect(far.service.submit('u1', idDto as any)).rejects.toBeInstanceOf(ConflictException);
    const selfie = setup(base(inDays(10)));
    await expect(selfie.service.submit('u1', { type: 'SELFIE', front: jpeg() } as any)).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('journalisation des consultations (lot 8)', () => {
  const base = { docs: [{ id: 'd1', userId: 'u1', type: 'NATIONAL_ID', status: 'PENDING' }] };
  async function withFiles() {
    const s = setup(base);
    s.prisma.kycDocument.findUnique.mockImplementation(async ({ where }: J) => (where.id === 'd1' ? { id: 'd1', userId: 'u1', type: 'NATIONAL_ID', user: { clientId: 7 } } : null));
    s.files.push({ documentId: 'd1', kind: 'FRONT', mimeType: 'image/jpeg', sha256: 'x', data: Buffer.from('img') }, { documentId: 'd1', kind: 'BACK', mimeType: 'image/jpeg', sha256: 'y', data: Buffer.from('img2') });
    return s;
  }
  const views = (audits: J[]) => audits.filter((a) => a.action === 'KYC_VIEW');

  it('l\'administrateur qui ouvre le recto puis le verso laisse deux lignes KYC_VIEW (auteur, société, côté)', async () => {
    const { service, audits } = await withFiles();
    await service.getFile(admin, 'd1', 'front');
    await service.getFile(admin, 'd1', 'back');
    expect(views(audits)).toHaveLength(2);
    expect(views(audits)[0]).toMatchObject({ userId: 'adm', clientId: 7, entity: 'KycDocument', entityId: 'd1', details: { what: 'front', subjectId: 'u1' }, successful: true });
    expect(views(audits)[1].details).toMatchObject({ what: 'back' });
  });

  it('la même consultation répétée dans les 10 minutes n\'ajoute pas de ligne', async () => {
    const { service, audits } = await withFiles();
    await service.getFile(admin, 'd1', 'front');
    await service.getFile(admin, 'd1', 'front');
    await service.getFile(superAdmin, 'd1', 'front'); // un autre administrateur, lui, est journalisé
    expect(views(audits)).toHaveLength(2);
    expect(views(audits).map((v) => v.userId)).toEqual(['adm', 'sa']);
  });

  it('le client qui relit sa propre pièce n\'est pas journalisé ; un refus (404) non plus', async () => {
    const { service, audits } = await withFiles();
    await service.getFile({ id: 'u1', role: 'USER', clientId: 7 } as any, 'd1', 'front');
    await service.getFile(otherAdmin, 'd1', 'front').catch(() => undefined);
    expect(views(audits)).toHaveLength(0);
  });

  it('une panne du journal ne bloque pas la consultation', async () => {
    const { service, prisma } = await withFiles();
    prisma.auditLog.findMany.mockRejectedValue(new Error('db down'));
    await expect(service.getFile(admin, 'd1', 'front')).resolves.toMatchObject({ mimeType: 'image/jpeg' });
  });

  it('l\'ouverture du dossier d\'un client est journalisée', async () => {
    const { service, audits } = setup();
    await service.adminDossier(admin, 'u1').catch(() => undefined);
    expect(views(audits)[0]).toMatchObject({ userId: 'adm', entity: 'KycDossier', entityId: 'u1', details: { what: 'dossier' } });
  });

  it('un client vérifié dont la pièce a expiré peut être relancé ; un client vraiment vérifié ne peut pas l\'être', async () => {
    const lapsed = setup({ users: [{ id: 'u1', role: 'USER', clientId: 7, kycLevel: 'LEVEL_1', email: 'a@x.com', firstName: 'Awa', deletedAt: null, kycLastReminderAt: null, kycReminderCount: 0 }], docs: [{ id: 'd1', userId: 'u1', type: 'PASSPORT', status: 'APPROVED', expiryDate: new Date('2020-01-01') }] });
    lapsed.prisma.user.updateMany = jest.fn().mockResolvedValue({ count: 1 });
    await expect(lapsed.service.adminRemind(admin, 'u1')).resolves.toEqual({ sent: true });
    expect(lapsed.notifier.notifyUser.mock.calls[0][1]).toMatchObject({ title: "Pièce d'identité expirée" });

    const ok = setup({ users: [{ id: 'u1', role: 'USER', clientId: 7, kycLevel: 'LEVEL_1', email: 'a@x.com', firstName: 'Awa', deletedAt: null, kycLastReminderAt: null, kycReminderCount: 0 }], docs: [{ id: 'd1', userId: 'u1', type: 'PASSPORT', status: 'APPROVED', expiryDate: new Date('2099-01-01') }] });
    await expect(ok.service.adminRemind(admin, 'u1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('une relance manuelle est journalisée KYC_REMIND', async () => {
    const { service, audits, prisma } = setup();
    prisma.user.findFirst.mockResolvedValue({ id: 'u1', clientId: 7, email: 'a@x.com', firstName: 'Awa', kycLevel: 'LEVEL_0', kycLastReminderAt: null, kycReminderCount: 2 });
    prisma.user.updateMany = jest.fn().mockResolvedValue({ count: 1 });
    await service.adminRemind(admin, 'u1');
    expect(audits.find((a) => a.action === 'KYC_REMIND')).toMatchObject({ userId: 'adm', clientId: 7, entity: 'User', entityId: 'u1', details: { manual: true, reminderNumber: 3 } });
  });
});

describe('KycService.getMyStatus', () => {
  it('rien envoyé : NOT_SUBMITTED, opérations sortantes interdites, pièces à fournir', async () => {
    const { service } = setup();
    expect(await service.getMyStatus('u1')).toMatchObject({ status: 'NOT_SUBMITTED', verified: false, canTransact: false, missing: ['NATIONAL_ID', 'SELFIE'] });
  });
  it('vérifié : APPROVED, opérations permises, possibilité de monter au niveau 2', async () => {
    const { service, users } = setup();
    users[0].kycLevel = 'LEVEL_1';
    expect(await service.getMyStatus('u1')).toMatchObject({ status: 'APPROVED', verified: true, canTransact: true, canUpgrade: true, missing: [] });
  });
  it('pièce valide qui expire dans moins de 30 jours : vérifié, mais l\'échéance est annoncée', async () => {
    const soon = new Date(Date.now() + 12 * 86_400_000);
    const { service } = setup({ users: [{ id: 'u1', role: 'USER', clientId: 7, kycLevel: 'LEVEL_1', kycVerifiedAt: new Date() }], docs: [{ id: 'd1', userId: 'u1', type: 'PASSPORT', status: 'APPROVED', expiryDate: soon }, { id: 'd2', userId: 'u1', type: 'SELFIE', status: 'APPROVED' }] });
    const st: J = await service.getMyStatus('u1');
    expect(st).toMatchObject({ status: 'APPROVED', verified: true, canTransact: true });
    expect(st.expiry).toMatchObject({ type: 'PASSPORT', expired: false });
    expect(st.expiry.daysLeft).toBeGreaterThanOrEqual(12);
    expect(st.expiry.daysLeft).toBeLessThanOrEqual(13);
  });
  it('pièce expirée alors que le niveau n\'est pas encore redescendu : EXPIRED, opérations sensibles bloquées', async () => {
    const { service } = setup({ users: [{ id: 'u1', role: 'USER', clientId: 7, kycLevel: 'LEVEL_1', kycVerifiedAt: new Date() }], docs: [{ id: 'd1', userId: 'u1', type: 'PASSPORT', status: 'APPROVED', expiryDate: new Date('2020-01-01') }, { id: 'd2', userId: 'u1', type: 'SELFIE', status: 'APPROVED' }] });
    const st: J = await service.getMyStatus('u1');
    expect(st).toMatchObject({ status: 'EXPIRED', verified: false, canTransact: false, canUpgrade: false });
    expect(st.expiry).toMatchObject({ expired: true });
    expect(st.missing.length).toBeGreaterThan(0);
  });
});
