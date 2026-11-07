// apps/backend/src/kyc/counter.spec.ts
// Envoi au comptoir : fiche du client de passage, pièce déjà connue sous une autre identité, plafonds cumulés par personne,
// et blocage « identité non vérifiée » des clients wallet.
import 'reflect-metadata';
import { BadRequestException, ForbiddenException } from '@nestjs/common';

import { TransferLimitsService } from '../transfer-limits/transfer-limits.service';
import { defaultLimits } from '../transfer-limits/transfer-limit-defaults';
import { CounterCustomersService } from './counter-customers.service';
import { KycGuardService } from './kyc-guard.service';

type J = Record<string, any>;

const jpg = (extra = 0) => `data:image/jpeg;base64,${Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(9000 + extra, 7)]).toString('base64')}`;

const input = (over: J = {}) => ({
  senderFirstName: 'Moussa', senderLastName: 'Diallo', senderPhone: '+33612345678',
  senderBirthDate: '1990-05-14', senderIdType: 'PASSPORT', senderIdNumber: 'ab 123-456', senderIdExpiry: '2099-01-01', senderIdFront: jpg(), ...over,
});

function store(initial: J[] = []) {
  const rows: J[] = initial.map((r) => ({ createdAt: new Date('2026-01-01'), ...r }));
  const files: J[] = [];
  const audits: J[] = [];
  let n = 0;
  const db: J = {
    counterCustomer: {
      findUnique: jest.fn(async ({ where }: J) => rows.find((r) => r.clientId === where.clientId_idNumber.clientId && r.idNumber === where.clientId_idNumber.idNumber) ?? null),
      findFirst: jest.fn(async ({ where }: J) => rows.find((r) => r.clientId === where.clientId && r.phone === where.phone && r.idNumber !== where.idNumber.not) ?? null),
      findMany: jest.fn(async ({ where }: J) => rows.filter((r) => r.clientId === where.clientId && where.OR.some((c: J) => (c.phone && r.phone === c.phone) || (c.idNumber && r.idNumber === c.idNumber))).map((r) => ({ id: r.id }))),
      create: jest.fn(async ({ data }: J) => { const row = { id: `c${++n}`, createdAt: new Date(), ...data }; rows.push(row); return row; }),
      update: jest.fn(async ({ where, data }: J) => { const row = rows.find((r) => r.id === where.id)!; Object.assign(row, data); return row; }),
    },
    counterIdFile: {
      findMany: jest.fn(async ({ where }: J) => files.filter((f) => f.counterCustomerId === where.counterCustomerId).map((f) => ({ kind: f.kind }))),
      upsert: jest.fn(async ({ where, create, update }: J) => {
        const k = where.counterCustomerId_kind;
        const i = files.findIndex((f) => f.counterCustomerId === k.counterCustomerId && f.kind === k.kind);
        if (i >= 0) Object.assign(files[i], update); else files.push({ ...create });
      }),
    },
    auditLog: { create: jest.fn(async ({ data }: J) => { audits.push(data); return data; }) },
  };
  return { db, rows, files, audits, service: new CounterCustomersService(db as any) };
}

describe('CounterCustomersService.resolve', () => {
  it('crée la fiche avec le numéro de pièce normalisé', async () => {
    const { service, rows } = store();
    const r = await service.resolve(7, 'agent1', input());
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ clientId: 7, idNumber: 'AB123456', firstName: 'Moussa', lastName: 'Diallo', createdById: 'agent1' });
    expect(r.relatedIds).toEqual([r.id]);
    expect(r.notes).toEqual([]);
  });

  it('pièce absente ou incomplète : 400 COUNTER_ID_REQUIRED, rien n\'est créé', async () => {
    const { service, rows } = store();
    const err = await service.resolve(7, 'agent1', input({ senderIdNumber: '', senderBirthDate: undefined })).catch((e) => e);
    expect(err).toBeInstanceOf(BadRequestException);
    expect(err.getResponse()).toMatchObject({ code: 'COUNTER_ID_REQUIRED' });
    expect(rows).toHaveLength(0);
  });

  it('mineur ou pièce expirée : refusés', async () => {
    const { service } = store();
    await expect(service.resolve(7, 'a', input({ senderBirthDate: '2015-01-01' }))).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.resolve(7, 'a', input({ senderIdExpiry: '2020-01-01' }))).rejects.toBeInstanceOf(BadRequestException);
  });

  it('même pièce, mêmes nom et naissance : la fiche existante est réutilisée (même cumul)', async () => {
    const { service, rows } = store();
    const a = await service.resolve(7, 'agent1', input());
    const b = await service.resolve(7, 'agent2', input({ senderIdNumber: 'AB123456', senderPhone: '+33699999999' }));
    expect(b.id).toBe(a.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ phone: '+33699999999', updatedById: 'agent2' });
  });

  it('même pièce mais autre nom ou autre date de naissance : 403 COUNTER_ID_MISMATCH', async () => {
    const { service } = store();
    await service.resolve(7, 'agent1', input());
    for (const other of [{ senderLastName: 'Bah' }, { senderBirthDate: '1991-05-14' }]) {
      const err = await service.resolve(7, 'agent2', input(other)).catch((e) => e);
      expect(err).toBeInstanceOf(ForbiddenException);
      expect(err.getResponse()).toMatchObject({ code: 'COUNTER_ID_MISMATCH' });
    }
  });

  it('une fiche d\'une autre société ne compte pas : la même pièce peut exister dans deux sociétés', async () => {
    const { service, rows } = store();
    await service.resolve(7, 'agent1', input());
    await service.resolve(8, 'agent9', input({ senderLastName: 'Autre' }));
    expect(rows).toHaveLength(2);
  });

  it('même téléphone avec une autre pièce : accepté, signalé à la conformité, et les deux fiches sont cumulées', async () => {
    const { service } = store();
    const first = await service.resolve(7, 'agent1', input());
    const second = await service.resolve(7, 'agent1', input({ senderIdNumber: 'ZZ999999', senderIdType: 'NATIONAL_ID', senderIdBack: jpg(1) }));
    expect(second.id).not.toBe(first.id);
    expect(second.notes).toEqual(["Même téléphone déjà utilisé avec une autre pièce d'identité"]);
    expect(second.relatedIds.sort()).toEqual([first.id, second.id].sort());
  });
});

describe('CounterCustomersService.resolve — photo de la pièce (lot 8)', () => {
  it('1er envoi sans photo : 400 COUNTER_ID_PHOTO_REQUIRED, aucune fiche n\'est créée', async () => {
    const { service, rows } = store();
    const err = await service.resolve(7, 'agent1', input({ senderIdFront: undefined })).catch((e) => e);
    expect(err).toBeInstanceOf(BadRequestException);
    expect(err.getResponse()).toMatchObject({ code: 'COUNTER_ID_PHOTO_REQUIRED' });
    expect(rows).toHaveLength(0);
  });

  it('carte d\'identité : le verso est exigé aussi ; un passeport n\'en a pas besoin', async () => {
    const { service } = store();
    const err = await service.resolve(7, 'a', input({ senderIdType: 'NATIONAL_ID' })).catch((e) => e);
    expect(err.getResponse()).toMatchObject({ code: 'COUNTER_ID_PHOTO_REQUIRED', fields: ['Photo du verso de la pièce'] });
    await expect(service.resolve(7, 'a', input({ senderIdType: 'NATIONAL_ID', senderIdBack: jpg(1) }))).resolves.toBeDefined();
  });

  it('photos enregistrées (recto + verso), date de prise de vue posée, consultation journalisée KYC_COUNTER_ID', async () => {
    const { service, rows, files, audits } = store();
    await service.resolve(7, 'agent1', input({ senderIdType: 'NATIONAL_ID', senderIdBack: jpg(1) }));
    expect(files.map((f) => f.kind).sort()).toEqual(['BACK', 'FRONT']);
    expect(files[0]).toMatchObject({ mimeType: 'image/jpeg', capturedById: 'agent1' });
    expect(files[0].sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(rows[0].idPhotoAt).toBeInstanceOf(Date);
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({ action: 'KYC_COUNTER_ID', userId: 'agent1', clientId: 7, entity: 'CounterCustomer' });
  });

  it('envoi suivant avec la même pièce : pas besoin de la rephotographier', async () => {
    const { service, files } = store();
    await service.resolve(7, 'agent1', input());
    await expect(service.resolve(7, 'agent2', input({ senderIdFront: undefined }))).resolves.toBeDefined();
    expect(files).toHaveLength(1);
  });

  it('pièce renouvelée (autre date d\'expiration) : nouvelle photo exigée, puis remplacée', async () => {
    const { service, files } = store();
    await service.resolve(7, 'agent1', input());
    const err = await service.resolve(7, 'agent1', input({ senderIdExpiry: '2100-01-01', senderIdFront: undefined })).catch((e) => e);
    expect(err.getResponse()).toMatchObject({ code: 'COUNTER_ID_PHOTO_REQUIRED' });
    await service.resolve(7, 'agent1', input({ senderIdExpiry: '2100-01-01', senderIdFront: jpg(5) }));
    expect(files).toHaveLength(1);
    expect(files[0].sizeBytes).toBe(4 + 9005);
  });

  it('fichier illisible, trop petit ou pas une image : 400 COUNTER_ID_PHOTO_INVALID', async () => {
    const { service, rows } = store();
    for (const bad of ['pas du base64 !!', `data:image/jpeg;base64,${Buffer.alloc(9000, 1).toString('base64')}`, `data:image/jpeg;base64,${Buffer.from([0xff, 0xd8, 0xff]).toString('base64')}`]) {
      const err = await service.resolve(7, 'a', input({ senderIdFront: bad })).catch((e) => e);
      expect(err.getResponse()).toMatchObject({ code: 'COUNTER_ID_PHOTO_INVALID' });
    }
    expect(rows).toHaveLength(0);
  });
});

describe('TransferLimitsService.assertCounterWithinLimits', () => {
  const lvl1 = defaultLimits('LEVEL_1', 'EUR'); // jour 1 000 €
  function build(used: { day: number; month: number; year: number }, row: J | null = null) {
    const prisma: J = {
      transferLimit: { findUnique: jest.fn().mockResolvedValue(row) },
      transaction: {
        aggregate: jest.fn(async ({ where }: J) => {
          const since = where.createdAt.gte as Date;
          const age = Date.now() - since.getTime();
          // période la plus courte d'abord : jour < mois < année
          const v = age < 1.1 * 86_400_000 ? used.day : age < 32 * 86_400_000 ? used.month : used.year;
          return { _sum: { amount: v } };
        }),
      },
      $executeRaw: jest.fn().mockResolvedValue(1),
    };
    return { service: new TransferLimitsService(prisma as any), prisma };
  }

  it('dans les plafonds du niveau 1 : passe', async () => {
    const { service, prisma } = build({ day: 200, month: 200, year: 200 });
    await expect(service.assertCounterWithinLimits(prisma as any, { clientId: 7, customerIds: ['c1'], currency: 'EUR', amount: 300 })).resolves.toBeUndefined();
  });

  it('le cumul de la personne dépasse le plafond du jour : 403 COUNTER_LIMIT_EXCEEDED avec le reste disponible', async () => {
    const { service, prisma } = build({ day: (lvl1.daily as number) - 100, month: (lvl1.daily as number) - 100, year: (lvl1.daily as number) - 100 });
    const err = await service.assertCounterWithinLimits(prisma as any, { clientId: 7, customerIds: ['c1', 'c2'], currency: 'EUR', amount: 300 }).catch((e) => e);
    expect(err).toBeInstanceOf(ForbiddenException);
    expect(err.getResponse()).toMatchObject({ code: 'COUNTER_LIMIT_EXCEEDED', limit: 'daily', remaining: 100, currency: 'EUR' });
    // le cumul porte sur toutes les fiches de la personne
    expect(prisma.transaction.aggregate.mock.calls[0][0].where.counterCustomerId).toEqual({ in: ['c1', 'c2'] });
  });

  it('un envoi au-dessus du plafond par envoi est refusé même sans historique', async () => {
    const { service, prisma } = build({ day: 0, month: 0, year: 0 });
    const over = (lvl1.perTransaction as number) + 1;
    const err = await service.assertCounterWithinLimits(prisma as any, { clientId: 7, customerIds: ['c1'], currency: 'EUR', amount: over }).catch((e) => e);
    expect(err.getResponse()).toMatchObject({ code: 'COUNTER_LIMIT_EXCEEDED', limit: 'perTransaction' });
  });

  it('verrou par personne pris dans la transaction (lock) : même clé quel que soit l\'ordre des fiches', async () => {
    const { service, prisma } = build({ day: 0, month: 0, year: 0 });
    await service.assertCounterWithinLimits(prisma as any, { clientId: 7, customerIds: ['b', 'a'], currency: 'EUR', amount: 10, lock: true });
    await service.assertCounterWithinLimits(prisma as any, { clientId: 7, customerIds: ['a', 'b'], currency: 'EUR', amount: 10, lock: true });
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(2);
    expect(prisma.$executeRaw.mock.calls[0].slice(1)).toEqual(prisma.$executeRaw.mock.calls[1].slice(1));
  });

  it('plafonds de la société enregistrés pour le niveau 1 : ils priment sur les valeurs par défaut', async () => {
    const { service, prisma } = build({ day: 0, month: 0, year: 0 }, { perTransaction: 50, daily: 100, monthly: null, yearly: null });
    const err = await service.assertCounterWithinLimits(prisma as any, { clientId: 7, customerIds: ['c1'], currency: 'EUR', amount: 60 }).catch((e) => e);
    expect(err.getResponse()).toMatchObject({ limit: 'perTransaction', max: 50 });
  });

  it('personne identifiée : rien à contrôler', async () => {
    const { service, prisma } = build({ day: 0, month: 0, year: 0 });
    await expect(service.assertCounterWithinLimits(prisma as any, { clientId: 7, customerIds: [], currency: 'EUR', amount: 1e9 })).resolves.toBeUndefined();
    expect(prisma.transferLimit.findUnique).not.toHaveBeenCalled();
  });
});

describe('KycGuardService.assertVerified', () => {
  const guard = (docs: J[] = []) => {
    const prisma: J = { kycDocument: { findMany: jest.fn().mockResolvedValue(docs) } };
    return { guard: new KycGuardService(prisma as any), prisma };
  };
  afterEach(() => { delete process.env.KYC_ENFORCEMENT; });

  it('client niveau 0 sans pièce : 403 KYC_REQUIRED, statut NOT_SUBMITTED', async () => {
    const { guard: g } = guard();
    const err = await g.assertVerified({ id: 'u1', role: 'USER', kycLevel: 'LEVEL_0' }).catch((e) => e);
    expect(err).toBeInstanceOf(ForbiddenException);
    expect(err.getResponse()).toMatchObject({ code: 'KYC_REQUIRED', kycStatus: 'NOT_SUBMITTED', kycLevel: 'LEVEL_0' });
  });

  it('dossier en cours d\'examen : le message l\'indique', async () => {
    const { guard: g } = guard([{ type: 'PASSPORT', status: 'PENDING', expiryDate: null }]);
    const err = await g.assertVerified({ id: 'u1', role: 'USER', kycLevel: 'LEVEL_0' }).catch((e) => e);
    expect(err.getResponse()).toMatchObject({ kycStatus: 'PENDING' });
    expect(err.getResponse().message).toContain('en cours de vérification');
  });

  it('agent ou administrateur : passe sans requête', async () => {
    const { guard: g, prisma } = guard();
    await g.assertVerified({ id: 'a1', role: 'AGENT', kycLevel: 'LEVEL_0' });
    await g.assertVerified({ id: 'a2', role: 'COMPANY_ADMIN', kycLevel: 'LEVEL_0' });
    expect(prisma.kycDocument.findMany).not.toHaveBeenCalled();
  });

  it('client vérifié avec une pièce en cours de validité : passe', async () => {
    const { guard: g } = guard([{ type: 'PASSPORT', status: 'APPROVED', expiryDate: new Date('2099-01-01') }, { type: 'SELFIE', status: 'APPROVED', expiryDate: null }]);
    await expect(g.assertVerified({ id: 'u1', role: 'USER', kycLevel: 'LEVEL_1' })).resolves.toBeUndefined();
  });

  it('client vérifié dont la pièce a expiré (job de nuit pas encore passé) : 403 KYC_REQUIRED, statut EXPIRED', async () => {
    const { guard: g } = guard([{ type: 'PASSPORT', status: 'APPROVED', expiryDate: new Date('2020-01-01') }, { type: 'SELFIE', status: 'APPROVED', expiryDate: null }]);
    const err = await g.assertVerified({ id: 'u1', role: 'USER', kycLevel: 'LEVEL_1' }).catch((e) => e);
    expect(err).toBeInstanceOf(ForbiddenException);
    expect(err.getResponse()).toMatchObject({ code: 'KYC_REQUIRED', kycStatus: 'EXPIRED' });
  });

  it('pièce expirée mais une autre pièce valide existe : passe', async () => {
    const { guard: g } = guard([
      { type: 'PASSPORT', status: 'APPROVED', expiryDate: new Date('2020-01-01') },
      { type: 'NATIONAL_ID', status: 'APPROVED', expiryDate: new Date('2099-01-01') },
      { type: 'SELFIE', status: 'APPROVED', expiryDate: null },
    ]);
    await expect(g.assertVerified({ id: 'u1', role: 'USER', kycLevel: 'LEVEL_1' })).resolves.toBeUndefined();
  });

  it('pièce expirée mais KYC_ENFORCEMENT=off : passe', async () => {
    process.env.KYC_ENFORCEMENT = 'off';
    const { guard: g } = guard([{ type: 'PASSPORT', status: 'APPROVED', expiryDate: new Date('2020-01-01') }]);
    await expect(g.assertVerified({ id: 'u1', role: 'USER', kycLevel: 'LEVEL_1' })).resolves.toBeUndefined();
  });

  it('KYC_ENFORCEMENT=off : le blocage est suspendu', async () => {
    process.env.KYC_ENFORCEMENT = 'off';
    const { guard: g } = guard();
    await expect(g.assertVerified({ id: 'u1', role: 'USER', kycLevel: 'LEVEL_0' })).resolves.toBeUndefined();
  });
});
