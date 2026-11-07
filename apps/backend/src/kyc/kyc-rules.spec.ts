// apps/backend/src/kyc/kyc-rules.spec.ts
import 'reflect-metadata';
import {
  EXPIRY_NOTICE_DAYS, MAX_REMINDERS, daysUntilExpiry, decodeUpload, enforcementEnabled, expiryNoticeDue, identityExpiry, identityLapsed, isExpired, levelFromDocs, maxLevel, missingForBasic, mustBeVerified, overallStatus, reminderDue, sniffMime,
} from './kyc-rules';
import { parseCounterSender, sameIdentity } from './counter-rules';

const NOW = new Date('2026-11-07T10:00:00Z');
const doc = (type: string, status = 'APPROVED', expiryDate: Date | null = null) => ({ type, status, expiryDate });

// Petites « photos » valides pour les tests : en-têtes réels + remplissage au-delà de la taille minimale.
const jpeg = (n = 20_000) => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(n, 1)]);
const png = () => Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(20_000, 2)]);

describe('niveau KYC à partir des pièces validées', () => {
  it('identité + selfie validés → LEVEL_1', () => {
    expect(levelFromDocs([doc('NATIONAL_ID'), doc('SELFIE')], NOW)).toBe('LEVEL_1');
  });
  it('identité seule, ou selfie seul → LEVEL_0', () => {
    expect(levelFromDocs([doc('PASSPORT')], NOW)).toBe('LEVEL_0');
    expect(levelFromDocs([doc('SELFIE')], NOW)).toBe('LEVEL_0');
  });
  it('+ justificatif de domicile (ou relevé bancaire) → LEVEL_2', () => {
    expect(levelFromDocs([doc('NATIONAL_ID'), doc('SELFIE'), doc('PROOF_OF_ADDRESS')], NOW)).toBe('LEVEL_2');
    expect(levelFromDocs([doc('PASSPORT'), doc('SELFIE'), doc('BANK_STATEMENT')], NOW)).toBe('LEVEL_2');
  });
  it('une pièce EN ATTENTE, REFUSÉE ou EXPIRÉE ne compte pas', () => {
    expect(levelFromDocs([doc('NATIONAL_ID', 'PENDING'), doc('SELFIE')], NOW)).toBe('LEVEL_0');
    expect(levelFromDocs([doc('NATIONAL_ID', 'REJECTED'), doc('SELFIE')], NOW)).toBe('LEVEL_0');
    expect(levelFromDocs([doc('NATIONAL_ID', 'APPROVED', new Date('2026-11-06')), doc('SELFIE')], NOW)).toBe('LEVEL_0');
  });
  it('une pièce valable jusqu\'à aujourd\'hui inclus est encore valable', () => {
    expect(isExpired(new Date('2026-11-07'), NOW)).toBe(false);
    expect(isExpired(new Date('2026-11-06'), NOW)).toBe(true);
  });
  it('maxLevel ne fait jamais baisser un niveau', () => {
    expect(maxLevel('LEVEL_3', 'LEVEL_1')).toBe('LEVEL_3');
    expect(maxLevel('LEVEL_0', 'LEVEL_2')).toBe('LEVEL_2');
  });
});

describe('statut du dossier et pièces manquantes', () => {
  it('rien d\'envoyé → NOT_SUBMITTED, il manque pièce + selfie', () => {
    expect(overallStatus('LEVEL_0', [], NOW)).toBe('NOT_SUBMITTED');
    expect(missingForBasic([], NOW)).toEqual(['NATIONAL_ID', 'SELFIE']);
  });
  it('pièce déposée → PENDING ; il ne manque plus que le selfie', () => {
    const d = [doc('NATIONAL_ID', 'PENDING')];
    expect(overallStatus('LEVEL_0', d, NOW)).toBe('PENDING');
    expect(missingForBasic(d, NOW)).toEqual(['SELFIE']);
  });
  it('refus sans nouvel envoi → REJECTED ; niveau ≥ 1 → APPROVED ; pièce validée expirée → EXPIRED', () => {
    expect(overallStatus('LEVEL_0', [doc('NATIONAL_ID', 'REJECTED')], NOW)).toBe('REJECTED');
    expect(overallStatus('LEVEL_1', [], NOW)).toBe('APPROVED');
    expect(overallStatus('LEVEL_0', [doc('NATIONAL_ID', 'APPROVED', new Date('2026-01-01'))], NOW)).toBe('EXPIRED');
  });
});

describe('garde des opérations', () => {
  it('seuls les clients (USER) de niveau 0 sont bloqués', () => {
    expect(mustBeVerified({ role: 'USER', kycLevel: 'LEVEL_0' })).toBe(true);
    expect(mustBeVerified({ role: 'USER', kycLevel: 'LEVEL_1' })).toBe(false);
    expect(mustBeVerified({ role: 'AGENT', kycLevel: 'LEVEL_0' })).toBe(false);
    expect(mustBeVerified({ role: 'COMPANY_ADMIN', kycLevel: 'LEVEL_0' })).toBe(false);
  });
  it('KYC_ENFORCEMENT=off désactive, toute autre valeur active', () => {
    expect(enforcementEnabled({ KYC_ENFORCEMENT: 'off' } as any)).toBe(false);
    expect(enforcementEnabled({ KYC_ENFORCEMENT: ' OFF ' } as any)).toBe(false);
    expect(enforcementEnabled({} as any)).toBe(true);
    expect(enforcementEnabled({ KYC_ENFORCEMENT: 'on' } as any)).toBe(true);
  });
});

describe('fichiers envoyés', () => {
  it('reconnaît le type RÉEL d\'après les premiers octets', () => {
    expect(sniffMime(jpeg())).toBe('image/jpeg');
    expect(sniffMime(png())).toBe('image/png');
    expect(sniffMime(Buffer.concat([Buffer.from('%PDF-1.7'), Buffer.alloc(100)]))).toBe('application/pdf');
    expect(sniffMime(Buffer.from('<html><script>alert(1)</script></html>'))).toBeNull();
  });
  it('accepte une photo valide, avec ou sans préfixe data:', () => {
    const b64 = jpeg().toString('base64');
    expect(decodeUpload(b64).mimeType).toBe('image/jpeg');
    expect(decodeUpload(`data:image/jpeg;base64,${b64}`).sha256).toHaveLength(64);
  });
  it('refuse : vide, base64 invalide, trop petit, trop gros, type non autorisé (HTML/SVG/exécutable)', () => {
    expect(() => decodeUpload('')).toThrow(/manquant/);
    expect(() => decodeUpload('***pas du base64***')).toThrow(/illisible/);
    expect(() => decodeUpload(jpeg(100).toString('base64'))).toThrow(/trop petit/);
    expect(() => decodeUpload(jpeg(7 * 1024 * 1024).toString('base64'))).toThrow(/dépasse/);
    expect(() => decodeUpload(Buffer.concat([Buffer.from('<svg xmlns="http://www.w3.org/2000/svg">'), Buffer.alloc(20_000, 32)]).toString('base64'))).toThrow(/JPEG, PNG, WEBP/);
    // Un fichier qui se DIT jpeg dans le préfixe mais n'en est pas un est refusé : seul le contenu compte.
    expect(() => decodeUpload(`data:image/jpeg;base64,${Buffer.concat([Buffer.from('MZ'), Buffer.alloc(20_000)]).toString('base64')}`)).toThrow(/JPEG, PNG, WEBP/);
  });
});

describe('calendrier des rappels', () => {
  const created = new Date('2026-11-01T08:00:00Z');
  const at = (days: number, from = created) => new Date(from.getTime() + days * 86_400_000);
  it('premier rappel 24 h après la création du compte, pas avant', () => {
    expect(reminderDue({ count: 0, lastAt: null, createdAt: created, now: at(0.5) })).toBe(false);
    expect(reminderDue({ count: 0, lastAt: null, createdAt: created, now: at(1) })).toBe(true);
  });
  it('puis 2 jours, 4 jours, puis chaque semaine', () => {
    const last = at(1);
    expect(reminderDue({ count: 1, lastAt: last, createdAt: created, now: at(1.9, last) })).toBe(false);
    expect(reminderDue({ count: 1, lastAt: last, createdAt: created, now: at(2, last) })).toBe(true);
    expect(reminderDue({ count: 2, lastAt: last, createdAt: created, now: at(3.9, last) })).toBe(false);
    expect(reminderDue({ count: 2, lastAt: last, createdAt: created, now: at(4, last) })).toBe(true);
    expect(reminderDue({ count: 3, lastAt: last, createdAt: created, now: at(6.9, last) })).toBe(false);
    expect(reminderDue({ count: 3, lastAt: last, createdAt: created, now: at(7, last) })).toBe(true);
    expect(reminderDue({ count: 9, lastAt: last, createdAt: created, now: at(7, last) })).toBe(true);
  });
  it('arrêt après le nombre maximal de rappels', () => {
    expect(reminderDue({ count: MAX_REMINDERS, lastAt: at(1), createdAt: created, now: at(400) })).toBe(false);
  });
});

describe('client de passage (envoi au comptoir)', () => {
  const ok = {
    senderFirstName: 'Awa', senderLastName: 'Diop', senderPhone: '+33 6 12 34 56 78', senderBirthDate: '1990-05-12',
    senderIdType: 'passport', senderIdNumber: 'ab-123 456', senderIdExpiry: '2099-01-01',
  };
  it('saisie complète : numéro de pièce normalisé, téléphone nettoyé', () => {
    const r = parseCounterSender(ok, NOW);
    expect(r.errors).toEqual([]);
    expect(r.sender).toMatchObject({ idType: 'PASSPORT', idNumber: 'AB123456', phone: '+33612345678' });
  });
  it('chaque champ manquant est signalé', () => {
    const r = parseCounterSender({}, NOW);
    expect(r.sender).toBeNull();
    expect(r.errors.length).toBeGreaterThanOrEqual(6);
  });
  it('refuse pièce expirée, mineur, date de naissance absurde, type de pièce hors liste', () => {
    expect(parseCounterSender({ ...ok, senderIdExpiry: '2026-11-06' }, NOW).errors.join()).toMatch(/expirée/);
    expect(parseCounterSender({ ...ok, senderBirthDate: '2012-01-01' }, NOW).errors.join()).toMatch(/18 ans/);
    expect(parseCounterSender({ ...ok, senderBirthDate: '1800-01-01' }, NOW).errors.join()).toMatch(/invalide/);
    expect(parseCounterSender({ ...ok, senderIdType: 'SELFIE' }, NOW).errors.join()).toMatch(/Type de pièce/);
  });
  it('même personne = même nom de famille (sans accents ni casse) et même date de naissance', () => {
    const s = parseCounterSender(ok, NOW).sender!;
    expect(sameIdentity({ lastName: 'DIOP', birthDate: new Date('1990-05-12') }, s)).toBe(true);
    expect(sameIdentity({ lastName: 'Sow', birthDate: new Date('1990-05-12') }, s)).toBe(false);
    expect(sameIdentity({ lastName: 'Diop', birthDate: new Date('1991-05-12') }, s)).toBe(false);
  });
});

describe('expiration de la pièce d\'identité (lot 8)', () => {
  const day = (n: number) => new Date(NOW.getTime() + n * 86_400_000);
  const sel = doc('SELFIE');

  it('jours restants : le jour d\'expiration compte encore comme valable', () => {
    expect(daysUntilExpiry(new Date('2026-11-07'), NOW)).toBe(1);
    expect(daysUntilExpiry(new Date('2026-11-08'), NOW)).toBe(2);
    expect(daysUntilExpiry(new Date('2026-12-07'), NOW)).toBe(31);
  });

  it('identityExpiry : rien au-delà de 30 jours, échéance annoncée en dessous', () => {
    expect(identityExpiry([doc('PASSPORT', 'APPROVED', day(120)), sel], NOW)).toBeNull();
    expect(identityExpiry([doc('PASSPORT', 'APPROVED', day(20)), sel], NOW)).toMatchObject({ type: 'PASSPORT', expired: false });
  });

  it('identityExpiry : la pièce la plus durable fait foi ; une pièce sans date ne peut pas expirer', () => {
    expect(identityExpiry([doc('PASSPORT', 'APPROVED', day(5)), doc('NATIONAL_ID', 'APPROVED', day(400)), sel], NOW)).toBeNull();
    expect(identityExpiry([doc('PASSPORT', 'APPROVED', day(5)), doc('NATIONAL_ID', 'APPROVED', null), sel], NOW)).toBeNull();
  });

  it('identityLapsed : seule une pièce périmée, sans remplaçante valable, bloque', () => {
    const old = new Date('2026-01-01');
    expect(identityLapsed([doc('PASSPORT', 'APPROVED', old), sel], NOW)).toBe(true);
    expect(identityLapsed([doc('PASSPORT', 'EXPIRED', old)], NOW)).toBe(true);
    expect(identityLapsed([doc('PASSPORT', 'APPROVED', old), doc('NATIONAL_ID', 'APPROVED', day(300)), sel], NOW)).toBe(false);
    expect(identityLapsed([doc('PASSPORT', 'APPROVED', day(3)), sel], NOW)).toBe(false);
    expect(identityLapsed([], NOW)).toBe(false);
    expect(identityLapsed([doc('PASSPORT', 'REJECTED', old)], NOW)).toBe(false); // un refus n'est pas une expiration
  });

  it('le jour même de la date d\'expiration la pièce est encore valable, le lendemain elle est bloquante', () => {
    expect(identityLapsed([doc('PASSPORT', 'APPROVED', new Date('2026-11-07')), sel], NOW)).toBe(false);
    expect(identityLapsed([doc('PASSPORT', 'APPROVED', new Date('2026-11-06')), sel], NOW)).toBe(true);
  });

  it('overallStatus : niveau 1 mais pièce périmée → EXPIRED sans attendre le job de nuit', () => {
    expect(overallStatus('LEVEL_1', [doc('PASSPORT', 'APPROVED', new Date('2026-01-01')), sel], NOW)).toBe('EXPIRED');
    expect(overallStatus('LEVEL_1', [doc('PASSPORT', 'APPROVED', day(200)), sel], NOW)).toBe('APPROVED');
  });

  it('seuils d\'alerte 30 puis 7 jours : chacun une seule fois', () => {
    expect(EXPIRY_NOTICE_DAYS).toEqual([30, 7]);
    expect(expiryNoticeDue(day(31), null, NOW)).toBeNull();
    expect(expiryNoticeDue(day(29), null, NOW)).toBe(30);
    expect(expiryNoticeDue(day(29), 30, NOW)).toBeNull();
    expect(expiryNoticeDue(day(6), 30, NOW)).toBe(7);
    expect(expiryNoticeDue(day(6), 7, NOW)).toBeNull();
    expect(expiryNoticeDue(day(5), null, NOW)).toBe(7); // validée tard : on n'envoie que le seuil le plus proche
    expect(expiryNoticeDue(new Date('2026-11-06'), null, NOW)).toBeNull(); // expirée : c'est le job d'expiration qui prévient
  });
});
