import { attachReferral, consumeRateLock, consumeWaiver, findUsableWaiver, reopenMoneyRequestOf, resolveRateLock, restoreWaiverOf, revokeReferrerRewardOf, rewardReferrerOnFirstTransfer, settleLinkedMoneyRequest } from './growth.core';

/** Mini base en mémoire : juste ce dont growth.core a besoin. */
function fakeDb(seed: { uses?: any[]; users?: any[]; rewards?: any[]; locks?: any[]; config?: any; transactions?: any[]; requests?: any[]; refCurrency?: string } = {}) {
  const requests = seed.requests ?? [];
  const users = seed.users ?? [];
  const rewards = seed.rewards ?? [];
  const uses = seed.uses ?? [];
  const locks = seed.locks ?? [];
  const notifications: any[] = [];
  const transactions = seed.transactions ?? [];
  const match = (row: any, where: any): boolean =>
    Object.entries(where ?? {}).every(([k, v]: [string, any]) => {
      if (k === 'OR') return v.some((w: any) => match(row, w));
      if (v && typeof v === 'object' && !(v instanceof Date)) {
        if ('gt' in v) return row[k] > v.gt;
        if ('lte' in v) return row[k] <= v.lte;
        if ('gte' in v) return row[k] >= v.gte;
        if ('not' in v) return row[k] !== v.not;
        if ('notIn' in v) return !v.notIn.includes(row[k]);
        if ('in' in v) return v.in.includes(row[k]);
        return true;
      }
      return row[k] === v;
    });
  const db: any = {
    users, rewards, uses, locks, notifications, requests,
    referralConfig: { findUnique: async () => seed.config ?? null },
    user: {
      findFirst: async ({ where }: any) => users.find((u) => match(u, where)) ?? null,
      findUnique: async ({ where }: any) => users.find((u) => u.id === where.id) ?? null,
      updateMany: async ({ where, data }: any) => { const rows = users.filter((u) => match(u, where)); rows.forEach((r) => Object.assign(r, data)); return { count: rows.length }; },
    },
    referralReward: {
      create: async ({ data }: any) => {
        if (rewards.some((r) => r.userId === data.userId && r.kind === data.kind && r.sourceUserId === data.sourceUserId)) throw Object.assign(new Error('dup'), { code: 'P2002' });
        const row = { id: `rw${rewards.length + 1}`, status: 'AVAILABLE', createdAt: new Date(), usedAt: null, transactionId: null, ...data };
        rewards.push(row); return row;
      },
      findFirst: async ({ where }: any) => rewards.filter((r) => match(r, where)).sort((a, b) => a.expiresAt - b.expiresAt)[0] ?? null,
      count: async ({ where }: any) => rewards.filter((r) => match(r, where)).length,
      deleteMany: async ({ where }: any) => { const rows = rewards.filter((r) => match(r, where)); rows.forEach((r) => rewards.splice(rewards.indexOf(r), 1)); return { count: rows.length }; },
      updateMany: async ({ where, data }: any) => {
        const rows = rewards.filter((r) => match(r, where));
        rows.forEach((r) => { for (const [k, v] of Object.entries<any>(data)) { if (v && typeof v === 'object' && 'decrement' in v) r[k] -= v.decrement; else if (v && typeof v === 'object' && 'increment' in v) r[k] += v.increment; else r[k] = v; } });
        return { count: rows.length };
      },
    },
    referralRewardUse: {
      create: async ({ data }: any) => { if (uses.some((u) => u.transactionId === data.transactionId)) throw Object.assign(new Error('dup'), { code: 'P2002' }); const row = { id: `u${uses.length + 1}`, ...data }; uses.push(row); return row; },
      findUnique: async ({ where }: any) => uses.find((u) => u.transactionId === where.transactionId) ?? null,
      deleteMany: async ({ where }: any) => { const rows = uses.filter((u) => match(u, where)); rows.forEach((u) => uses.splice(uses.indexOf(u), 1)); return { count: rows.length }; },
      count: async ({ where }: any) => uses.filter((u) => match(u, where)).length,
    },
    client: { findUnique: async () => ({ defaultCurrency: seed.refCurrency ?? 'EUR' }) },
    moneyRequest: {
      findFirst: async ({ where }: any) => requests.find((r) => match(r, where)) ?? null,
      updateMany: async ({ where, data }: any) => { const rows = requests.filter((r) => match(r, where)); rows.forEach((r) => Object.assign(r, data)); return { count: rows.length }; },
    },
    notification: { create: async ({ data }: any) => { notifications.push(data); return data; } },
    transaction: { count: async ({ where }: any) => transactions.filter((t) => match(t, where)).length },
    rateLock: {
      findUnique: async ({ where }: any) => locks.find((l) => l.id === where.id) ?? null,
      updateMany: async ({ where, data }: any) => { const rows = locks.filter((l) => match(l, where)); rows.forEach((r) => Object.assign(r, data)); return { count: rows.length }; },
    },
  };
  return db;
}

const now = new Date('2026-11-19T10:00:00Z');
const cfg = { isActive: true, refereeWaivers: 2, referrerWaivers: 1, minFirstTransfer: 20, rewardValidityDays: 30, maxRewardsPerMonth: 1 };
const base = () => [
  { id: 'p', clientId: 1, isActive: true, referralCode: 'AB12CD', referredById: null, firstName: 'Parrain' },
  { id: 'f', clientId: 1, isActive: true, referralCode: 'ZZ99ZZ', referredById: null, firstName: 'Filleul' },
  { id: 'o', clientId: 2, isActive: true, referralCode: 'OTHER1', referredById: null, firstName: 'Autre société' },
];

describe('attachReferral', () => {
  it('rattache le filleul et lui offre ses envois sans frais quand le programme est actif', async () => {
    const db = fakeDb({ users: base(), config: cfg });
    expect(await attachReferral(db, { clientId: 1, newUserId: 'f', rawCode: ' ab12cd ', now })).toBe(true);
    expect(db.users.find((u: any) => u.id === 'f').referredById).toBe('p');
    expect(db.rewards).toHaveLength(1);
    expect(db.rewards[0]).toMatchObject({ userId: 'f', kind: 'REFEREE_WELCOME', remaining: 2 });
    expect(db.notifications).toHaveLength(1);
  });

  it('programme désactivé : rattache sans récompense', async () => {
    const db = fakeDb({ users: base(), config: { ...cfg, isActive: false } });
    expect(await attachReferral(db, { clientId: 1, newUserId: 'f', rawCode: 'AB12CD', now })).toBe(true);
    expect(db.rewards).toHaveLength(0);
  });

  it('ignore un code inconnu, celui d’une autre société, ou son propre code', async () => {
    const db = fakeDb({ users: base(), config: cfg });
    expect(await attachReferral(db, { clientId: 1, newUserId: 'f', rawCode: 'NOPE00', now })).toBe(false);
    expect(await attachReferral(db, { clientId: 1, newUserId: 'f', rawCode: 'OTHER1', now })).toBe(false);
    expect(await attachReferral(db, { clientId: 1, newUserId: 'p', rawCode: 'AB12CD', now })).toBe(false);
    expect(db.rewards).toHaveLength(0);
  });

  it('ne change jamais de parrain', async () => {
    const users = base(); users[1]!.referredById = 'x';
    const db = fakeDb({ users, config: cfg });
    expect(await attachReferral(db, { clientId: 1, newUserId: 'f', rawCode: 'AB12CD', now })).toBe(false);
    expect(db.users[1].referredById).toBe('x');
  });

  it('ne lève jamais d’erreur, même si la base tombe', async () => {
    const db = fakeDb({ users: base() });
    db.user.findFirst = async () => { throw new Error('boom'); };
    await expect(attachReferral(db, { clientId: 1, newUserId: 'f', rawCode: 'AB12CD', now })).resolves.toBe(false);
  });
});

describe('envoi sans frais', () => {
  const reward = (over: any = {}) => ({ id: 'r1', userId: 'f', kind: 'REFEREE_WELCOME', status: 'AVAILABLE', remaining: 2, expiresAt: new Date('2026-12-01T00:00:00Z'), ...over });

  it('prend la récompense qui expire le plus tôt, ignore les expirées et les épuisées', async () => {
    const db = fakeDb({ rewards: [reward({ id: 'late', expiresAt: new Date('2026-12-30T00:00:00Z') }), reward({ id: 'soon' }), reward({ id: 'old', expiresAt: new Date('2026-11-01T00:00:00Z') }), reward({ id: 'empty', remaining: 0 })] });
    expect((await findUsableWaiver(db, 'f', now))?.id).toBe('soon');
    expect(await findUsableWaiver(db, 'zz', now)).toBeNull();
  });

  it('chaque envoi en consomme un ; à zéro la récompense passe en USED ; plus rien à consommer ensuite', async () => {
    const db = fakeDb({ rewards: [reward()] });
    await consumeWaiver(db, 'r1', 't1', now);
    expect(db.rewards[0]).toMatchObject({ remaining: 1, status: 'AVAILABLE', transactionId: 't1' });
    await consumeWaiver(db, 'r1', 't2', now);
    expect(db.rewards[0]).toMatchObject({ remaining: 0, status: 'USED' });
    await expect(consumeWaiver(db, 'r1', 't3', now)).rejects.toThrow(/déjà|utilisé/i);
  });
});

describe('récompense du parrain', () => {
  const users = () => { const u = base(); u[1]!.referredById = 'p'; return u; };

  it('premier envoi d’un filleul assez élevé → le parrain gagne un envoi sans frais, une seule fois', async () => {
    const db = fakeDb({ users: users(), config: cfg });
    await rewardReferrerOnFirstTransfer(db, { clientId: 1, senderId: 'f', transactionId: 't1', amount: 50, now });
    expect(db.rewards).toHaveLength(1);
    expect(db.rewards[0]).toMatchObject({ userId: 'p', kind: 'REFERRER_BONUS', sourceUserId: 'f', remaining: 1 });
    await rewardReferrerOnFirstTransfer(db, { clientId: 1, senderId: 'f', transactionId: 't1', amount: 50, now });
    expect(db.rewards).toHaveLength(1);
  });

  it('rien si montant sous le minimum, programme inactif, pas de parrain, ou ce n’est pas le premier envoi', async () => {
    const low = fakeDb({ users: users(), config: cfg });
    await rewardReferrerOnFirstTransfer(low, { clientId: 1, senderId: 'f', transactionId: 't1', amount: 10, now });
    expect(low.rewards).toHaveLength(0);

    const off = fakeDb({ users: users(), config: { ...cfg, isActive: false } });
    await rewardReferrerOnFirstTransfer(off, { clientId: 1, senderId: 'f', transactionId: 't1', amount: 50, now });
    expect(off.rewards).toHaveLength(0);

    const none = fakeDb({ users: base(), config: cfg });
    await rewardReferrerOnFirstTransfer(none, { clientId: 1, senderId: 'f', transactionId: 't1', amount: 50, now });
    expect(none.rewards).toHaveLength(0);

    const second = fakeDb({ users: users(), config: cfg, transactions: [{ id: 't0', senderId: 'f', type: 'TRANSFER', status: 'PAID', deletedAt: null }] });
    await rewardReferrerOnFirstTransfer(second, { clientId: 1, senderId: 'f', transactionId: 't1', amount: 50, now });
    expect(second.rewards).toHaveLength(0);
  });

  it('un envoi annulé auparavant ne compte pas comme premier envoi', async () => {
    const db = fakeDb({ users: users(), config: cfg, transactions: [{ id: 't0', senderId: 'f', type: 'TRANSFER', status: 'CANCELLED', deletedAt: null }] });
    await rewardReferrerOnFirstTransfer(db, { clientId: 1, senderId: 'f', transactionId: 't1', amount: 50, now });
    expect(db.rewards).toHaveLength(1);
  });

  it('le minimum s\'exprime dans la devise de la société : l\'envoi d\'une autre devise y est converti avant comparaison', async () => {
    // minimum 20 EUR ; 50 000 GNF ≈ 4,77 EUR → trop bas ; 500 000 GNF ≈ 47,7 EUR → suffisant
    const convert = async (a: number) => a / 10_479;
    const low = fakeDb({ users: users(), config: cfg, refCurrency: 'EUR' });
    await rewardReferrerOnFirstTransfer(low, { clientId: 1, senderId: 'f', transactionId: 't1', amount: 50_000, currency: 'GNF', convert, now });
    expect(low.rewards).toHaveLength(0);
    const ok = fakeDb({ users: users(), config: cfg, refCurrency: 'EUR' });
    await rewardReferrerOnFirstTransfer(ok, { clientId: 1, senderId: 'f', transactionId: 't1', amount: 500_000, currency: 'GNF', convert, now });
    expect(ok.rewards).toHaveLength(1);
  });

  it('même devise que la société : comparé tel quel ; devise différente sans conversion possible : pas de récompense', async () => {
    const same = fakeDb({ users: users(), config: cfg, refCurrency: 'EUR' });
    await rewardReferrerOnFirstTransfer(same, { clientId: 1, senderId: 'f', transactionId: 't1', amount: 25, currency: 'EUR', now });
    expect(same.rewards).toHaveLength(1);
    const noRate = fakeDb({ users: users(), config: cfg, refCurrency: 'EUR' });
    await rewardReferrerOnFirstTransfer(noRate, { clientId: 1, senderId: 'f', transactionId: 't1', amount: 500_000, currency: 'GNF', now });
    expect(noRate.rewards).toHaveLength(0);
  });

  it('un envoi seulement EN ATTENTE auparavant ne bloque pas : seul un envoi déjà PAYÉ fait que ce n\'est plus le premier', async () => {
    const db = fakeDb({ users: users(), config: cfg, transactions: [{ id: 't0', senderId: 'f', type: 'TRANSFER', status: 'PENDING', deletedAt: null }] });
    await rewardReferrerOnFirstTransfer(db, { clientId: 1, senderId: 'f', transactionId: 't1', amount: 50, now });
    expect(db.rewards).toHaveLength(1);
  });

  it('respecte le plafond mensuel du parrain', async () => {
    const u = users(); u.push({ id: 'f2', clientId: 1, isActive: true, referredById: 'p', firstName: 'Deux' });
    const db = fakeDb({ users: u, config: cfg });
    await rewardReferrerOnFirstTransfer(db, { clientId: 1, senderId: 'f', transactionId: 't1', amount: 50, now });
    await rewardReferrerOnFirstTransfer(db, { clientId: 1, senderId: 'f2', transactionId: 't2', amount: 50, now });
    expect(db.rewards).toHaveLength(1);
  });
});

describe('garantie de taux', () => {
  const lock = { id: 'L1', userId: 'u1', currency: 'EUR', targetCurrency: 'GNF', amount: 100, rate: 9500, receivedAmount: 950000, expiresAt: new Date('2026-11-19T10:10:00Z'), consumedAt: null };
  const ask = { lockId: 'L1', userId: 'u1', currency: 'EUR', targetCurrency: 'GNF', amount: 100, now };

  it('renvoie le taux et le montant garantis', async () => {
    const db = fakeDb({ locks: [{ ...lock }] });
    expect(await resolveRateLock(db, ask)).toEqual({ id: 'L1', rate: 9500, receivedAmount: 950000 });
  });

  it('refuse : inconnue, expirée, autre montant, autre client', async () => {
    const db = fakeDb({ locks: [{ ...lock }] });
    await expect(resolveRateLock(db, { ...ask, lockId: 'nope' })).rejects.toThrow();
    await expect(resolveRateLock(db, { ...ask, now: new Date('2026-11-19T10:11:00Z') })).rejects.toThrow(/expiré/);
    await expect(resolveRateLock(db, { ...ask, amount: 120 })).rejects.toThrow(/ne correspond plus/);
    await expect(resolveRateLock(db, { ...ask, userId: 'u2' })).rejects.toThrow();
  });

  it('ne sert qu’une fois', async () => {
    const db = fakeDb({ locks: [{ ...lock }] });
    await consumeRateLock(db, 'L1', 't1', now);
    expect(db.locks[0].transactionId).toBe('t1');
    await expect(consumeRateLock(db, 'L1', 't2', now)).rejects.toThrow(/déjà servi/);
    await expect(resolveRateLock(db, ask)).rejects.toThrow(/déjà servi/);
  });
});

describe('demande d\'argent réglée par l\'envoi qui lui est lié', () => {
  const request = (over: any = {}) => ({
    id: 'r1', clientId: 1, requesterId: 'req', payerId: 'pay', amount: 5_000, currency: 'GNF', status: 'PENDING',
    createdAt: new Date('2026-11-22T00:00:00Z'), expiresAt: new Date('2026-11-29T00:00:00Z'), paidTransactionId: null, respondedAt: null, ...over,
  });
  const tx = { id: 't1', currency: 'EUR', amount: 4.77, targetCurrency: 'GNF', receivedAmount: 49_985 };
  const at = new Date('2026-11-22T00:19:00Z');
  const run = (db: any, over: any = {}) => settleLinkedMoneyRequest(db, { requestId: 'r1', clientId: 1, payerId: 'pay', requesterId: 'req', transaction: tx, now: at, ...over });

  it('règle la demande liée, et rapporte le montant réellement reçu (supérieur au montant demandé)', async () => {
    const db = fakeDb({ requests: [request()] });
    const res = await run(db);
    expect(res).toMatchObject({ id: 'r1', requesterId: 'req', asked: 5_000, got: 49_985, currency: 'GNF', transactionId: 't1' });
    expect(db.requests[0]).toMatchObject({ status: 'PAID', paidTransactionId: 't1' });
  });

  it('ne règle rien : mauvais payeur, mauvais destinataire, autre société, demande échue, déjà réglée, montant insuffisant', async () => {
    for (const [over, label] of [
      [{ payerId: 'autre' }, 'payeur'], [{ requesterId: 'autre' }, 'destinataire'], [{ clientId: 2 }, 'société'],
      [{ now: new Date('2026-12-01T00:00:00Z') }, 'échue'], [{ transaction: { ...tx, receivedAmount: 4_000 } }, 'insuffisant'],
    ] as Array<[any, string]>) {
      const db = fakeDb({ requests: [request()] });
      expect(await run(db, over)).toBeNull();
      expect({ label, status: db.requests[0].status }).toEqual({ label, status: 'PENDING' });
    }
    const paid = fakeDb({ requests: [request({ status: 'PAID' })] });
    expect(await run(paid)).toBeNull();
  });

  it('une demande inconnue n\'est pas un problème : l\'envoi reste un envoi normal', async () => {
    expect(await run(fakeDb(), { requestId: 'nope' })).toBeNull();
  });
});


describe('restoreWaiverOf — un envoi sans frais n\'est pas perdu quand l\'envoi est annulé', () => {
  const reward = (over: any = {}) => ({ id: 'w1', userId: 'u', kind: 'REFEREE_WELCOME', status: 'USED', remaining: 0, expiresAt: new Date('2026-12-30T00:00:00Z'), transactionId: 't1', ...over });
  const use = (transactionId: string, rewardId = 'w1') => ({ id: `use-${transactionId}`, rewardId, transactionId });

  it('rend l\'envoi consommé par cet envoi : récompense de nouveau disponible', async () => {
    const db = fakeDb({ rewards: [reward()], uses: [use('t1')] });
    expect(await restoreWaiverOf(db, 't1')).toBe(true);
    expect(db.rewards[0]).toMatchObject({ status: 'AVAILABLE', remaining: 1, transactionId: null });
    expect(db.uses).toHaveLength(0);
    expect((await findUsableWaiver(db, 'u', new Date('2026-11-22T00:00:00Z')))?.id).toBe('w1');
  });

  it('récompense à plusieurs envois : on rend l\'envoi du bon envoi, même s\'il n\'est pas le dernier', async () => {
    // 3 envois offerts, 3 utilisés par t1, t2, t3 (t3 = dernier). t1 est annulé.
    const db = fakeDb({ rewards: [reward({ remaining: 0, transactionId: 't3' })], uses: [use('t1'), use('t2'), use('t3')] });
    expect(await restoreWaiverOf(db, 't1')).toBe(true);
    expect(db.rewards[0]).toMatchObject({ status: 'AVAILABLE', remaining: 1, transactionId: 't3' }); // le « dernier envoi » n'a pas bougé
    expect(db.uses.map((u: any) => u.transactionId)).toEqual(['t2', 't3']);
    expect(await restoreWaiverOf(db, 't2')).toBe(true);
    expect(db.rewards[0].remaining).toBe(2);
  });

  it('un envoi qui n\'a consommé aucune récompense, ou une récompense expirée : rien ne change', async () => {
    const db = fakeDb({ rewards: [reward(), reward({ id: 'w2', transactionId: 't9', status: 'EXPIRED' })], uses: [use('t1'), use('t9', 'w2')] });
    expect(await restoreWaiverOf(db, 'autre')).toBe(false);
    await restoreWaiverOf(db, 't9');
    expect(db.rewards[1]).toMatchObject({ status: 'EXPIRED', remaining: 0 });
  });

  it('idempotent : un second appel ne rend pas deux fois', async () => {
    const db = fakeDb({ rewards: [reward()], uses: [use('t1')] });
    await restoreWaiverOf(db, 't1');
    expect(await restoreWaiverOf(db, 't1')).toBe(false);
    expect(db.rewards[0].remaining).toBe(1);
  });

  it('consumeWaiver enregistre chaque utilisation ; consommer puis rendre revient à l\'état de départ', async () => {
    const db = fakeDb({ rewards: [reward({ status: 'AVAILABLE', remaining: 2, transactionId: null })] });
    await consumeWaiver(db, 'w1', 'tA', now);
    await consumeWaiver(db, 'w1', 'tB', now);
    expect(db.uses.map((u: any) => u.transactionId)).toEqual(['tA', 'tB']);
    expect(db.rewards[0]).toMatchObject({ status: 'USED', remaining: 0 });
    await restoreWaiverOf(db, 'tA');
    expect(db.rewards[0]).toMatchObject({ status: 'AVAILABLE', remaining: 1 });
  });
});

describe('revokeReferrerRewardOf — le premier envoi du filleul est rappelé : le parrain perd sa récompense', () => {
  const users = () => [
    { id: 'p', clientId: 1, isActive: true, referralCode: 'AB12CD', referredById: null, firstName: 'Parrain' },
    { id: 'f', clientId: 1, isActive: true, referralCode: 'ZZ99ZZ', referredById: 'p', firstName: 'Filleul' },
  ];
  const grant = async (db: any, transactionId = 'tF') => rewardReferrerOnFirstTransfer(db, { clientId: 1, senderId: 'f', transactionId, amount: 50, currency: 'EUR', now });

  it('la récompense garde l\'envoi qui l\'a déclenchée', async () => {
    const db = fakeDb({ users: users(), config: cfg });
    await grant(db);
    expect(db.rewards[0]).toMatchObject({ userId: 'p', kind: 'REFERRER_BONUS', grantedByTransactionId: 'tF' });
  });

  it('récompense intacte : supprimée ; le prochain premier envoi payé du filleul la redonne', async () => {
    const db = fakeDb({ users: users(), config: cfg });
    await grant(db);
    expect(await revokeReferrerRewardOf(db, 'tF')).toBe(true);
    expect(db.rewards).toHaveLength(0);
    await grant(db, 'tG');
    expect(db.rewards[0]).toMatchObject({ grantedByTransactionId: 'tG' });
  });

  it('déjà en partie utilisée : les envois restants sont retirés, ceux utilisés restent acquis', async () => {
    const db = fakeDb({ users: users(), config: { ...cfg, referrerWaivers: 3 } });
    await grant(db);
    await consumeWaiver(db, db.rewards[0].id, 'tP1', now);
    expect(await revokeReferrerRewardOf(db, 'tF')).toBe(true);
    expect(db.rewards[0]).toMatchObject({ remaining: 0, status: 'USED' });
    expect(db.uses).toHaveLength(1);
  });

  it('un autre envoi, ou une récompense du filleul (pas du parrain) : rien ne change', async () => {
    const db = fakeDb({ users: users(), config: cfg });
    await grant(db);
    expect(await revokeReferrerRewardOf(db, 'autre')).toBe(false);
    expect(db.rewards).toHaveLength(1);
  });
});

describe('reopenMoneyRequestOf — la demande réglée par un envoi rappelé redevient ouverte', () => {
  const request = (over: any = {}) => ({ id: 'r1', status: 'PAID', paidTransactionId: 't1', respondedAt: new Date('2026-11-22T00:00:00Z'), expiresAt: new Date('2026-11-29T00:00:00Z'), ...over });
  const at = new Date('2026-11-23T00:00:00Z');

  it('encore valable : de nouveau en attente, plus liée à l\'envoi', async () => {
    const db = fakeDb({ requests: [request()] });
    expect(await reopenMoneyRequestOf(db, 't1', at)).toBe(true);
    expect(db.requests[0]).toMatchObject({ status: 'PENDING', paidTransactionId: null, respondedAt: null });
  });

  it('échue entre-temps : expirée, jamais « payée »', async () => {
    const db = fakeDb({ requests: [request({ expiresAt: new Date('2026-11-22T12:00:00Z') })] });
    expect(await reopenMoneyRequestOf(db, 't1', at)).toBe(true);
    expect(db.requests[0]).toMatchObject({ status: 'EXPIRED', paidTransactionId: null });
  });

  it('un autre envoi, ou une demande non payée : rien ne change', async () => {
    const db = fakeDb({ requests: [request(), request({ id: 'r2', status: 'PENDING', paidTransactionId: null })] });
    expect(await reopenMoneyRequestOf(db, 'autre', at)).toBe(false);
    expect(db.requests.map((r: any) => r.status)).toEqual(['PAID', 'PENDING']);
  });
});
