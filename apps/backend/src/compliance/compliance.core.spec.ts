import { preScreenSend, screenCustomerBase, screenTransaction } from './compliance.core';
import { invalidateOfficialIndex } from './official-index';

type Row = Record<string, any>;

function build(opts: { settings?: Row | null; entries?: Row[]; tx?: Row; duplicate?: boolean; official?: Row[]; users?: Row[] } = {}) {
  const cases: any[] = [];
  const alerts: any[] = [];
  const notifs: any[] = [];
  const txUpdates: any[] = [];
  const tx = {
    id: 't1', reference: 'REF1', clientId: 5, amount: 150000, currency: 'XOF', status: 'PENDING', senderId: 'u1', isFlagged: false, riskScore: 10,
    sender: { firstName: 'Aminata', lastName: 'Sow' }, recipient: null, beneficiary: { fullName: 'Ibrahima Sory Condé' }, counterCustomer: null,
    ...(opts.tx ?? {}),
  };
  const db: any = {
    transaction: {
      findUnique: jest.fn().mockResolvedValue(tx),
      updateMany: jest.fn().mockImplementation(async (a: any) => { txUpdates.push(a); return { count: a.where.status === tx.status ? 1 : 0 }; }),
      update: jest.fn().mockImplementation(async (a: any) => { txUpdates.push(a); return a; }),
    },
    complianceSettings: { findUnique: jest.fn().mockResolvedValue(opts.settings === undefined ? null : opts.settings) },
    watchlistEntry: { findMany: jest.fn().mockResolvedValue(opts.entries ?? [{ id: 'w1', clientId: 5, kind: 'SANCTION', fullName: 'Ibrahima Sory Conde', aliases: [], reference: 'LST-1' }]) },
    complianceCase: {
      create: jest.fn().mockImplementation(async (a: any) => {
        if (opts.duplicate) throw Object.assign(new Error('unique'), { code: 'P2002' });
        cases.push(a.data); return { id: 'case1' };
      }),
    },
    alert: { create: jest.fn().mockImplementation(async (a: any) => { alerts.push(a.data); return a; }) },
    officialListEntry: { findMany: jest.fn().mockResolvedValue(opts.official ?? []) },
    user: { findMany: jest.fn().mockImplementation(async (a: any) => (a?.where?.role === 'USER' ? (opts.users ?? []) : [{ id: 'admin1' }])) },
    notification: { create: jest.fn().mockImplementation(async (a: any) => { notifs.push(a.data); return a; }) },
  };
  return { db, cases, alerts, notifs, txUpdates };
}

const STRONG = { sanctionsEnabled: true, matchThreshold: 88, strongMatchThreshold: 96, holdOnStrongMatch: true, officialLists: [], amlThresholdXof: null, amlFlagScore: null, highRiskCountries: [], structuringCount: 3, fanInSenders: 3 };

describe('screenTransaction', () => {
  it('correspondance forte + blocage voulu : dossier CRITIQUE, envoi bloqué, alerte et administrateurs prévenus', async () => {
    const { db, cases, alerts, notifs, txUpdates } = build({ settings: STRONG });
    const out = await screenTransaction(db, 't1');
    expect(out).toEqual({ matches: 1, caseId: 'case1', held: true });
    expect(cases[0]).toMatchObject({ kind: 'SANCTION_MATCH', severity: 'CRITICAL', dedupeKey: 'SANCTION:t1', clientId: 5, transactionId: 't1' });
    expect(cases[0].details.heldFrom).toBe('PENDING');
    expect(txUpdates[0].data.status).toBe('ON_HOLD');
    expect(alerts[0]).toMatchObject({ type: 'SANCTION_MATCH', severity: 'CRITICAL', clientId: 5 });
    expect(notifs).toHaveLength(1);
  });

  it('sans option de blocage : dossier + alerte, l’envoi continue (jamais bloqué par défaut)', async () => {
    const { db, txUpdates } = build({ settings: null });
    const out = await screenTransaction(db, 't1');
    expect(out.matches).toBe(1);
    expect(out.held).toBe(false);
    expect(txUpdates.every((u) => u.data.status === undefined)).toBe(true);
  });

  it("un envoi déjà payé n'est jamais bloqué, mais le dossier est ouvert", async () => {
    const { db, cases } = build({ settings: STRONG, tx: { status: 'PAID' } });
    const out = await screenTransaction(db, 't1');
    expect(out.held).toBe(false);
    expect(cases).toHaveLength(1);
  });

  it('personne ne correspond : rien', async () => {
    const { db, cases } = build({ settings: STRONG, tx: { beneficiary: { fullName: 'Mariama Camara' } } });
    expect(await screenTransaction(db, 't1')).toEqual({ matches: 0, caseId: null, held: false });
    expect(cases).toHaveLength(0);
  });

  it('filtrage désactivé ou aucune liste : rien', async () => {
    expect((await screenTransaction(build({ settings: { ...STRONG, sanctionsEnabled: false } }).db, 't1')).matches).toBe(0);
    expect((await screenTransaction(build({ entries: [] }).db, 't1')).matches).toBe(0);
  });

  it('dossier déjà ouvert pour cet envoi (clé unique) : pas de doublon, pas d’erreur', async () => {
    const { db, alerts } = build({ settings: STRONG, duplicate: true });
    const out = await screenTransaction(db, 't1');
    expect(out.caseId).toBeNull();
    expect(alerts).toHaveLength(0);
  });

  it('ne lève jamais, même si la base tombe', async () => {
    const { db } = build({ settings: STRONG });
    db.transaction.findUnique.mockRejectedValue(new Error('base indisponible'));
    await expect(screenTransaction(db, 't1')).resolves.toEqual({ matches: 0, caseId: null, held: false });
  });
});

describe('listes officielles', () => {
  const OFF = [{ id: 'o1', fullName: 'Ibrahim Sori Konde', aliases: ['Ibrahima Sory Conde'], country: 'GN', reference: 'QDi.042' }];
  beforeEach(() => invalidateOfficialIndex());

  it('envoi : une liste officielle activée suffit (aucune liste propre à la société), la source figure dans le dossier', async () => {
    const { db, cases } = build({ settings: { ...STRONG, officialLists: ['UN'], holdOnStrongMatch: false }, entries: [], official: OFF });
    const out = await screenTransaction(db, 't1');
    expect(out.matches).toBe(1);
    expect(cases[0].reason).toContain('liste officielle UN');
    expect(cases[0].details.matches[0]).toMatchObject({ source: 'UN', entryId: 'OFF:o1', reference: 'QDi.042' });
  });

  it('une liste officielle NON activée par la société est ignorée', async () => {
    const { db } = build({ settings: { ...STRONG, officialLists: [] }, entries: [], official: OFF });
    expect((await screenTransaction(db, 't1')).matches).toBe(0);
    expect(db.officialListEntry.findMany).not.toHaveBeenCalled();
  });

  it('liste officielle illisible : le filtrage continue avec les listes de la société', async () => {
    const { db } = build({ settings: { ...STRONG, officialLists: ['OFAC'], holdOnStrongMatch: false } });
    db.officialListEntry.findMany.mockRejectedValue(new Error('table absente'));
    expect((await screenTransaction(db, 't1')).matches).toBe(1);
  });

  it('clientèle : un dossier par client et par fiche, sans doublon au second passage', async () => {
    const users = [{ id: 'c1', firstName: 'Ibrahim', lastName: 'Sori Konde' }, { id: 'c2', firstName: 'Mariama', lastName: 'Camara' }];
    const { db, cases } = build({ settings: { ...STRONG, officialLists: ['UN'] }, entries: [], official: OFF, users });
    const first = await screenCustomerBase(db, 5);
    expect(first).toEqual({ checked: 2, cases: 1 });
    expect(cases[0]).toMatchObject({ userId: 'c1', clientId: 5, dedupeKey: 'SANCTION_USER:c1:OFF:o1' });
    db.complianceCase.create.mockRejectedValue(Object.assign(new Error('unique'), { code: 'P2002' }));
    expect(await screenCustomerBase(db, 5)).toEqual({ checked: 2, cases: 0 });
  });

  it('clientèle : aucune liste → rien à contrôler', async () => {
    const { db } = build({ settings: null, entries: [] });
    expect(await screenCustomerBase(db, 5)).toEqual({ checked: 0, cases: 0 });
  });
});


describe('preScreenSend (audit argent I2 — avant débit)', () => {
  const base = { clientId: 5, senderId: 'u1', amount: 50000, currency: 'XOF', sender: { firstName: 'Aminata', lastName: 'Sow' }, recipient: { firstName: 'Ibrahima Sory', lastName: 'Conde' }, beneficiaryName: null };

  it('correspondance forte + blocage voulu : refus, dossier sans transaction, administrateurs prévenus', async () => {
    const { db, cases, alerts, notifs } = build({ settings: STRONG });
    const out = await preScreenSend(db, base);
    expect(out).toEqual({ blocked: true, caseId: 'case1' });
    expect(cases[0]).toMatchObject({ kind: 'SANCTION_MATCH', clientId: 5, userId: 'u1' });
    expect(cases[0].transactionId).toBeUndefined();
    expect(String(cases[0].dedupeKey)).toMatch(/^SANCTION_PRESEND:u1:w1:\d{4}-\d{2}-\d{2}$/);
    expect(alerts).toHaveLength(1);
    expect(notifs).toHaveLength(1);
  });

  it('sans option de blocage : jamais refusé (le filtrage a posteriori signale seulement)', async () => {
    const { db, cases } = build({ settings: null });
    expect(await preScreenSend(db, base)).toEqual({ blocked: false, caseId: null });
    expect(cases).toHaveLength(0);
  });

  it('personne ne correspond : envoi autorisé', async () => {
    const { db } = build({ settings: STRONG });
    const out = await preScreenSend(db, { ...base, recipient: { firstName: 'Mariama', lastName: 'Camara' } });
    expect(out.blocked).toBe(false);
  });

  it('refus même si le dossier du jour existe déjà (doublon) : l’envoi reste refusé', async () => {
    const { db } = build({ settings: STRONG, duplicate: true });
    expect((await preScreenSend(db, base)).blocked).toBe(true);
  });

  it('panne du filtrage : n’empêche pas l’envoi', async () => {
    const { db } = build({ settings: STRONG });
    db.watchlistEntry.findMany.mockRejectedValue(new Error('boom'));
    expect((await preScreenSend(db, base)).blocked).toBe(false);
  });
});
