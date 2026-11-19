import { PING_EVENT, buildTransactionPayload, eventForStatus, eventKeyFor, isSubscribed } from './webhook-events';
import { backoffMs, generateWebhookSecret, isPrivateIp, maskSecret, signPayload, validateWebhookUrl, verifySignature } from './webhook-security';

describe('validateWebhookUrl (protection SSRF)', () => {
  it('accepte une adresse https publique', () => {
    expect(validateWebhookUrl('https://api.exemple.com/hooks/dt')).toBeNull();
    expect(validateWebhookUrl('https://api.exemple.com:8443/x')).toBeNull();
  });
  it('refuse http, identifiants, localhost et noms internes', () => {
    expect(validateWebhookUrl('http://api.exemple.com')).toMatch(/https/);
    expect(validateWebhookUrl('http://api.exemple.com', { allowHttp: true })).toBeNull();
    expect(validateWebhookUrl('https://user:pw@api.exemple.com')).toMatch(/identifiants/);
    expect(validateWebhookUrl('https://localhost/x')).toMatch(/internes/);
    expect(validateWebhookUrl('https://db.internal/x')).toMatch(/internes/);
    expect(validateWebhookUrl('https://monserveur/x')).toMatch(/domaine/);
  });
  it('refuse les IP privées, réservées et les métadonnées cloud', () => {
    for (const u of ['https://127.0.0.1/x', 'https://10.0.0.5/x', 'https://192.168.1.2/x', 'https://172.16.0.1/x', 'https://169.254.169.254/latest/meta-data', 'https://[::1]/x', 'https://[fd00::1]/x', 'https://0.0.0.0/x']) {
      expect(validateWebhookUrl(u)).not.toBeNull();
    }
    expect(validateWebhookUrl('https://8.8.8.8/x')).toBeNull();
  });
  it('refuse les ports système, sauf 80 et 443', () => {
    expect(validateWebhookUrl('https://api.exemple.com:22/x')).toMatch(/port/);
    expect(validateWebhookUrl('https://api.exemple.com:443/x')).toBeNull();
  });
  it('refuse une adresse invalide', () => {
    expect(validateWebhookUrl('pas une url')).toMatch(/invalide/);
  });
});

describe('isPrivateIp', () => {
  it('reconnaît les IPv4 mappées en IPv6 et les plages privées', () => {
    expect(isPrivateIp('::ffff:127.0.0.1')).toBe(true);
    expect(isPrivateIp('100.64.0.1')).toBe(true);
    expect(isPrivateIp('172.32.0.1')).toBe(false);
    expect(isPrivateIp('2606:4700:4700::1111')).toBe(false);
    expect(isPrivateIp('n/importe quoi')).toBe(true);
  });
});

describe('signature', () => {
  const secret = 'whsec_test';
  const body = '{"event":"ping"}';
  it('se vérifie et rejette un corps modifié ou un horodatage trop ancien', () => {
    const h = signPayload(secret, 1_700_000_000, body);
    expect(verifySignature(secret, h, body, 1_700_000_100)).toBe(true);
    expect(verifySignature(secret, h, body + ' ', 1_700_000_100)).toBe(false);
    expect(verifySignature(secret, h, body, 1_700_001_000)).toBe(false);
    expect(verifySignature('autre', h, body, 1_700_000_100)).toBe(false);
  });
  it('génère des secrets distincts et les masque', () => {
    const a = generateWebhookSecret();
    expect(a).toMatch(/^whsec_[0-9a-f]{64}$/);
    expect(a).not.toBe(generateWebhookSecret());
    expect(maskSecret(a)).not.toContain(a.slice(8, 40));
  });
});

describe('backoffMs', () => {
  it('double à chaque tentative et plafonne à 6 h', () => {
    expect(backoffMs(1, 5000)).toBe(5000);
    expect(backoffMs(2, 5000)).toBe(10_000);
    expect(backoffMs(3, 5000)).toBe(20_000);
    expect(backoffMs(30, 5000)).toBe(6 * 3_600_000);
  });
});

describe('événements', () => {
  it('déduit l’événement du statut, jamais pour un blocage', () => {
    expect(eventForStatus('PAID')).toBe('transaction.paid');
    expect(eventForStatus('PENDING')).toBe('transaction.created');
    expect(eventForStatus('ON_HOLD')).toBeNull();
  });
  it('clé unique par transaction et statut', () => {
    expect(eventKeyFor('t1', 'PAID')).toBe('transaction:t1:PAID');
  });
  it('abonnement : liste vide ou « * » = tout', () => {
    expect(isSubscribed([], 'transaction.paid')).toBe(true);
    expect(isSubscribed(['*'], 'transaction.paid')).toBe(true);
    expect(isSubscribed(['transaction.failed'], 'transaction.paid')).toBe(false);
    expect(isSubscribed(['transaction.paid'], 'transaction.paid')).toBe(true);
  });
  it('le contenu ne porte aucune donnée personnelle', () => {
    const now = new Date('2026-11-19T10:00:00Z');
    const p = buildTransactionPayload('transaction.paid', {
      id: 't1', reference: 'DT-1', type: 'TRANSFER', status: 'PAID', amount: 100, fees: 2, total: 102, currency: 'EUR',
      targetCurrency: 'GNF', receivedAmount: 1_000_000, payoutMethod: 'CASH_PICKUP', createdAt: now, paidAt: now, updatedAt: now,
    }, now);
    expect(p.data.total).toBe(102);
    expect(Object.keys(p.data)).not.toEqual(expect.arrayContaining(['senderId', 'phone', 'fullName']));
    expect(PING_EVENT).toBe('ping');
  });
});
