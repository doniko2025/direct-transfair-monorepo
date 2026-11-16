// apps/backend/src/bills/bills.webhook.ts
// =========================================================
// CONFIRMATION ASYNCHRONE D'UN FACTURIER (lot 14b) — fonctions PURES de signature.
//
// Quand un facturier ne répond pas tout de suite (connecteur → PENDING), il confirme plus tard en appelant :
//   POST /api/bills/webhook/<clé du connecteur>
//   En-tête  X-Bills-Signature: t=<horodatage UNIX en secondes>,v1=<HMAC-SHA256 hexadécimal>
//   Signature = HMAC-SHA256(secret, `${t}.${corps brut de la requête}`)   ← le corps BRUT, octet pour octet
//   Corps    { "reference": "FAC-…", "status": "COMPLETED" | "FAILED", "providerRef"?, "token"?, "message"? }
// Le secret est propre à chaque connecteur : variable d'environnement BILLS_WEBHOOK_SECRET_<CLÉ> (clé en MAJUSCULES, « - » → « _ »).
// Un horodatage de plus de 5 minutes est refusé (rejeu d'une ancienne requête interceptée). Sans secret configuré, l'adresse n'existe pas.
// =========================================================

import { createHmac, timingSafeEqual } from 'crypto';

export const WEBHOOK_TOLERANCE_SECONDS = 300;

/** Nom de la variable d'environnement qui porte le secret d'un connecteur. */
export const webhookSecretEnvName = (connectorKey: string): string => `BILLS_WEBHOOK_SECRET_${connectorKey.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;

export function webhookSecretFor(connectorKey: string, env: NodeJS.ProcessEnv = process.env): string | null {
  const v = String(env[webhookSecretEnvName(connectorKey)] ?? '').trim();
  return v.length >= 16 ? v : null; // un secret trop court est traité comme absent : jamais de signature devinable
}

export function signWebhook(secret: string, timestamp: number, rawBody: string | Buffer): string {
  return createHmac('sha256', secret).update(`${timestamp}.`).update(rawBody).digest('hex');
}

/** « t=…,v1=… » → { t, v1 } ou null si mal formé. */
export function parseSignatureHeader(header: unknown): { t: number; v1: string } | null {
  if (typeof header !== 'string' || header.length > 300) return null;
  const parts = Object.fromEntries(header.split(',').map((p) => p.trim().split('=', 2) as [string, string]));
  const t = Number(parts.t);
  const v1 = typeof parts.v1 === 'string' ? parts.v1.toLowerCase() : '';
  return Number.isInteger(t) && t > 0 && /^[0-9a-f]{64}$/.test(v1) ? { t, v1 } : null;
}

export type WebhookCheck = { ok: true } | { ok: false; reason: 'MALFORMED' | 'EXPIRED' | 'BAD_SIGNATURE' };

export function verifyWebhook(args: { secret: string; header: unknown; rawBody: string | Buffer; nowSeconds?: number; toleranceSeconds?: number }): WebhookCheck {
  const parsed = parseSignatureHeader(args.header);
  if (!parsed) return { ok: false, reason: 'MALFORMED' };
  const now = args.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - parsed.t) > (args.toleranceSeconds ?? WEBHOOK_TOLERANCE_SECONDS)) return { ok: false, reason: 'EXPIRED' };
  const expected = Buffer.from(signWebhook(args.secret, parsed.t, args.rawBody));
  const given = Buffer.from(parsed.v1);
  return expected.length === given.length && timingSafeEqual(expected, given) ? { ok: true } : { ok: false, reason: 'BAD_SIGNATURE' };
}
