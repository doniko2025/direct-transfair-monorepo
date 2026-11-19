// apps/backend/src/webhooks/webhook-security.ts
// =========================================================
// SÉCURITÉ DES WEBHOOKS SORTANTS (lot 17) — fonctions pures.
// Protection SSRF : un administrateur ne doit pas pouvoir faire appeler par NOTRE serveur une adresse interne
// (métadonnées cloud 169.254.169.254, base de données, services en réseau privé, localhost…).
//   • validateWebhookUrl : contrôle SYNTAXIQUE (https obligatoire, pas d'identifiants dans l'URL, pas de nom interne, pas d'IP privée) ;
//   • isPrivateIp        : utilisé aussi APRÈS résolution DNS, au moment de l'envoi (anti « DNS rebinding » simple).
//   • signature HMAC-SHA256 horodatée (le destinataire vérifie l'origine ET rejette les rejeux anciens).
//   • backoff exponentiel plafonné.
// =========================================================

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';

export function isPrivateIpv4(ip: string): boolean {
  const p = ip.split('.').map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b] = p as [number, number, number, number];
  return (
    a === 0 || a === 10 || a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||   // CGNAT
    (a === 169 && b === 254) ||             // lien local + métadonnées cloud
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224                                // multicast, réservé, broadcast
  );
}

export function isPrivateIp(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) return isPrivateIpv4(ip);
  if (v === 6) {
    const x = ip.toLowerCase();
    if (x === '::' || x === '::1') return true;
    const mapped = x.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateIpv4(mapped[1] as string);
    return /^(fc|fd|fe[89ab])/.test(x) || x.startsWith('ff');
  }
  return true; // pas une adresse IP valide : par prudence, refusée
}

const BLOCKED_SUFFIXES = ['.local', '.localhost', '.internal', '.lan', '.intranet', '.corp', '.home', '.localdomain'];
const ALLOWED_PORTS_BELOW_1024 = new Set([80, 443]);

/** Renvoie un message d'erreur en français, ou null si l'adresse est acceptable. */
export function validateWebhookUrl(raw: string, opts: { allowHttp?: boolean } = {}): string | null {
  let u: URL;
  try { u = new URL(String(raw).trim()); } catch { return "Adresse invalide (exemple : https://exemple.com/webhook)."; }
  if (u.protocol !== 'https:' && !(opts.allowHttp && u.protocol === 'http:')) return 'Seules les adresses https:// sont acceptées.';
  if (u.username || u.password) return "L'adresse ne doit pas contenir d'identifiants.";
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (!host) return 'Adresse invalide.';
  if (host === 'localhost' || BLOCKED_SUFFIXES.some((s) => host.endsWith(s))) return 'Les adresses internes ne sont pas autorisées.';
  if (isIP(host)) {
    if (isPrivateIp(host)) return 'Les adresses IP privées ou réservées ne sont pas autorisées.';
  } else if (!host.includes('.')) {
    return 'Utilisez un nom de domaine complet.';
  }
  if (u.port) {
    const port = Number(u.port);
    if (port < 1024 && !ALLOWED_PORTS_BELOW_1024.has(port)) return 'Ce port n’est pas autorisé.';
  }
  if (u.toString().length > 500) return 'Adresse trop longue (500 caractères au plus).';
  return null;
}

// ── Signature ────────────────────────────────────────────

export function generateWebhookSecret(): string {
  return `whsec_${randomBytes(32).toString('hex')}`;
}

export function maskSecret(secret: string): string {
  return secret.length > 10 ? `${secret.slice(0, 6)}…${secret.slice(-4)}` : '••••';
}

/** En-tête « t=<horodatage>,v1=<signature> » ; la signature couvre « horodatage.corps ». */
export function signPayload(secret: string, timestampSec: number, body: string): string {
  const v1 = createHmac('sha256', secret).update(`${timestampSec}.${body}`).digest('hex');
  return `t=${timestampSec},v1=${v1}`;
}

/** Vérification côté destinataire (fournie pour les tests et la documentation). Tolérance par défaut : 5 minutes. */
export function verifySignature(secret: string, header: string, body: string, nowSec = Math.floor(Date.now() / 1000), toleranceSec = 300): boolean {
  const parts = Object.fromEntries(header.split(',').map((kv) => kv.split('=') as [string, string]));
  const t = Number(parts.t);
  const v1 = parts.v1;
  if (!Number.isFinite(t) || !v1 || Math.abs(nowSec - t) > toleranceSec) return false;
  const expected = createHmac('sha256', secret).update(`${t}.${body}`).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(v1);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Délai avant la nouvelle tentative n (n = nombre de tentatives déjà faites, ≥ 1) : base × 2^(n-1), plafonné à 6 h. */
export function backoffMs(attemptsDone: number, baseMs: number): number {
  const base = Math.max(1000, baseMs);
  return Math.min(6 * 3_600_000, base * 2 ** Math.max(0, attemptsDone - 1));
}
