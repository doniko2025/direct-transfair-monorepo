import {
  addDays, applyLockMargin, fitDesiredReceived, lockRateFactor, judgeLock, lockMarginPct, lockMinutes, normalizeReferralCode, parseReferralSettings, parseRequestAmount, paidInRequestCurrency, paymentSettlesRequest,
  requestDays, rewardExpiry, startOfMonthUtc, DEFAULT_REFERRAL,
} from './growth.rules';

const now = new Date('2026-11-19T10:00:00Z');
const lock = { userId: 'u1', currency: 'EUR', targetCurrency: 'GNF', amount: 100, expiresAt: new Date('2026-11-19T10:10:00Z'), consumedAt: null };
const ask = { userId: 'u1', currency: 'EUR', targetCurrency: 'GNF', amount: 100 };

describe('garantie de taux', () => {
  it('durée bornée entre 2 et 30 minutes, 10 par défaut', () => {
    expect(lockMinutes(undefined)).toBe(5);
    expect(lockMinutes('abc')).toBe(5);
    expect(lockMinutes('1')).toBe(2);
    expect(lockMinutes('90')).toBe(30);
    expect(lockMinutes('15')).toBe(15);
  });

  it('verdict : valide, expirée, déjà utilisée, autre montant ou devise, autre client', () => {
    expect(judgeLock(lock, ask, now)).toBe('OK');
    expect(judgeLock({ ...lock, expiresAt: now }, ask, now)).toBe('EXPIRED');
    expect(judgeLock({ ...lock, consumedAt: now }, ask, now)).toBe('USED');
    expect(judgeLock(lock, { ...ask, amount: 101 }, now)).toBe('MISMATCH');
    expect(judgeLock(lock, { ...ask, targetCurrency: 'XOF' }, now)).toBe('MISMATCH');
    expect(judgeLock(lock, { ...ask, userId: 'u2' }, now)).toBe('FOREIGN');
  });
});

describe('demandes d’argent', () => {
  it('durée et montant', () => {
    expect(requestDays(undefined)).toBe(7);
    expect(requestDays('0')).toBe(1);
    expect(requestDays('99')).toBe(30);
    expect(parseRequestAmount('12,5')).toBe(12.5);
    expect(() => parseRequestAmount(0)).toThrow();
    expect(() => parseRequestAmount(-3)).toThrow();
    expect(() => parseRequestAmount('x')).toThrow();
  });

  const req = { clientId: 1, requesterId: 'r', payerId: 'p', amount: 50, currency: 'EUR', createdAt: new Date('2026-11-19T09:00:00Z') };
  const pay = { senderId: 'p', recipientId: 'r', clientId: 1, status: 'PAID', currency: 'EUR', amount: 50, targetCurrency: 'EUR', receivedAmount: 50, createdAt: new Date('2026-11-19T09:30:00Z'), deletedAt: null };

  it('un envoi du payeur vers le demandeur, abouti, qui couvre le montant, règle la demande', () => {
    expect(paymentSettlesRequest(req, pay)).toBe(true);
    expect(paymentSettlesRequest(req, { ...pay, amount: 80, receivedAmount: 80 })).toBe(true);
  });

  it('refuse un mauvais sens, une autre société, un envoi non abouti, antérieur ou insuffisant', () => {
    expect(paymentSettlesRequest(req, { ...pay, senderId: 'r', recipientId: 'p' })).toBe(false);
    expect(paymentSettlesRequest(req, { ...pay, clientId: 2 })).toBe(false);
    expect(paymentSettlesRequest(req, { ...pay, status: 'PENDING' })).toBe(false);
    expect(paymentSettlesRequest(req, { ...pay, createdAt: new Date('2026-11-18T09:00:00Z') })).toBe(false);
    expect(paymentSettlesRequest(req, { ...pay, amount: 49, receivedAmount: 49 })).toBe(false);
    expect(paymentSettlesRequest(req, { ...pay, deletedAt: now })).toBe(false);
  });

  it('une demande en GNF est réglée par le montant REÇU converti', () => {
    const gnf = { ...req, currency: 'GNF', amount: 500_000 };
    const eur = { ...pay, currency: 'EUR', amount: 50, targetCurrency: 'GNF', receivedAmount: 520_000 };
    expect(paidInRequestCurrency(eur, 'GNF')).toBe(520_000);
    expect(paymentSettlesRequest(gnf, eur)).toBe(true);
    expect(paymentSettlesRequest(gnf, { ...eur, receivedAmount: 400_000 })).toBe(false);
    expect(paidInRequestCurrency(eur, 'XOF')).toBe(0);
  });

  it('un envoi fait APRÈS l\'échéance ne règle pas la demande ; fait avant, il la règle même constaté plus tard', () => {
    const limited = { ...req, expiresAt: new Date('2026-11-26T09:00:00Z') };
    expect(paymentSettlesRequest(limited, { ...pay, createdAt: new Date('2026-11-25T10:00:00Z') })).toBe(true);
    expect(paymentSettlesRequest(limited, { ...pay, createdAt: new Date('2026-11-27T10:00:00Z') })).toBe(false);
  });

  it('un envoi qui dépasse la demande la règle aussi (le montant réellement reçu reste celui de l\'envoi)', () => {
    const gnf = { ...req, currency: 'GNF', amount: 5_000 };
    const eur = { ...pay, currency: 'EUR', amount: 4.77, targetCurrency: 'GNF', receivedAmount: 49_985 };
    expect(paymentSettlesRequest(gnf, eur)).toBe(true);
    expect(paidInRequestCurrency(eur, 'GNF')).toBe(49_985);
  });
});

describe('parrainage', () => {
  it('normalise le code saisi', () => {
    expect(normalizeReferralCode(' thi-ab12 ')).toBe('THI-AB12');
    expect(normalizeReferralCode('ab')).toBeNull();
    expect(normalizeReferralCode('a b c d e f')).toBe('ABCDEF');
    expect(normalizeReferralCode('<script>')).toBeNull();
    expect(normalizeReferralCode(undefined)).toBeNull();
  });

  it('expiration et début de mois', () => {
    expect(rewardExpiry(now, 30).toISOString()).toBe('2026-12-19T10:00:00.000Z');
    expect(rewardExpiry(now, 0).toISOString()).toBe(addDays(now, 1).toISOString());
    expect(startOfMonthUtc(now).toISOString()).toBe('2026-11-01T00:00:00.000Z');
  });

  it('valide les réglages, en gardant les valeurs existantes quand elles sont absentes', () => {
    const s = parseReferralSettings({ isActive: true, refereeWaivers: 2 });
    expect(s).toEqual({ ...DEFAULT_REFERRAL, isActive: true, refereeWaivers: 2 });
    expect(parseReferralSettings({ minFirstTransfer: '25,5' }, s).minFirstTransfer).toBe(25.5);
    expect(() => parseReferralSettings({ refereeWaivers: 11 })).toThrow();
    expect(() => parseReferralSettings({ rewardValidityDays: 0 })).toThrow();
    expect(() => parseReferralSettings({ minFirstTransfer: -1 })).toThrow();
  });
});


describe('marge du taux garanti (audit argent M2)', () => {
  it('0,2 % par défaut, bornée entre 0 et 5 %', () => {
    expect(lockMarginPct(undefined)).toBe(0.2);
    expect(lockMarginPct('abc')).toBe(0.2);
    expect(lockMarginPct('0,5')).toBe(0.5);
    expect(lockMarginPct('0')).toBe(0);
    expect(lockMarginPct('12')).toBe(5);
    expect(lockMarginPct('-3')).toBe(0);
  });
  it('retire la marge du montant converti', () => {
    expect(applyLockMargin(1000, 0.2)).toBeCloseTo(998, 6);
    expect(applyLockMargin(1000, 0)).toBe(1000);
    expect(applyLockMargin(1000, -1)).toBe(1000);
  });
});

describe('montant à recevoir saisi par le client', () => {
  it('facteur du taux garanti : 0,998 pour 0,2 %', () => {
    expect(lockRateFactor(0.2)).toBeCloseTo(0.998, 9);
    expect(lockRateFactor(0)).toBe(1);
  });
  it('cas réel : 50 000 GNF saisis → 4,78 € envoyés → crédit EXACT de 50 000 (et plus 49 985)', () => {
    const rate = 10500 * lockRateFactor(0.2);                  // 10 479
    const send = Math.ceil(50000 / rate * 100 - 1e-9) / 100;   // 4,78
    expect(send).toBe(4.78);
    const received = Math.round(send * rate);                  // 50 090 : un peu plus que demandé (le centime d'euro vaut ~105 GNF)
    expect(received).toBe(50090);
    expect(fitDesiredReceived(received, 50000, rate, 0.01)).toBe(50000);
  });
  it('ne crédite jamais plus que le calcul, ignore une saisie incohérente', () => {
    expect(fitDesiredReceived(50090, 60000, 10479, 0.01)).toBe(50090);   // plus que le calcul
    expect(fitDesiredReceived(50090, 40000, 10479, 0.01)).toBe(50090);   // trop loin du calcul (> un centime d'envoi)
    expect(fitDesiredReceived(50090, undefined, 10479, 0.01)).toBe(50090);
    expect(fitDesiredReceived(50090, 0, 10479, 0.01)).toBe(50090);
    expect(fitDesiredReceived(50090, -5, 10479, 0.01)).toBe(50090);
  });
  it('envoi en devise sans décimales (GNF → EUR) : unité = 1', () => {
    expect(fitDesiredReceived(10, 9.99, 0.000095, 1)).toBe(9.99);
  });
});
