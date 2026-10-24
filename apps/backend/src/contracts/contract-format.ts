// apps/backend/src/contracts/contract-format.ts
// Formatage des dates / montants du contrat et nettoyage du texte pour le PDF (polices intégrées de pdfkit = WinAnsi).

import * as crypto from 'crypto';

const TZ = 'Europe/Paris';

/** Remplace les caractères que la police PDF intégrée ne sait pas dessiner (espaces fines, tirets insécables…). */
export function pdfText(input: unknown): string {
  const s = String(input ?? '')
    .replace(/[    ]/g, ' ')
    .replace(/[‐‑‒]/g, '-')
    .replace(/→/g, '->')
    .replace(/[​‌‍﻿]/g, '');
  const allowedBeyondLatin1 = new Set([0x20ac, 0x2018, 0x2019, 0x201a, 0x201c, 0x201d, 0x201e, 0x2013, 0x2014, 0x2022, 0x2026, 0x152, 0x153, 0x160, 0x161, 0x178, 0x17d, 0x17e]);
  let out = '';
  for (const ch of s) {
    const code = ch.codePointAt(0)!;
    if (code === 0x0a || (code >= 0x20 && code <= 0xff) || allowedBeyondLatin1.has(code)) {
      out += ch;
      continue;
    }
    const base = ch.normalize('NFD').replace(/[̀-ͯ]/g, '');
    out += base && base.charCodeAt(0) <= 0xff && base !== ch ? base : '?';
  }
  return out;
}

export function formatDateFr(value: Date | string, withTime = false): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '';
  const base = new Intl.DateTimeFormat('fr-FR', { timeZone: TZ, day: 'numeric', month: 'long', year: 'numeric' }).format(d);
  if (!withTime) return pdfText(base);
  const time = new Intl.DateTimeFormat('fr-FR', { timeZone: TZ, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(d);
  return pdfText(`${base} à ${time} (heure de Paris)`);
}

export function formatMoney(amount: number, currency: string): string {
  try {
    return pdfText(
      new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency,
        minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
        maximumFractionDigits: 2,
      }).format(amount),
    );
  } catch {
    return pdfText(`${amount} ${currency}`);
  }
}

export function countryName(code: string | null | undefined): string | null {
  const c = (code ?? '').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(c)) return c || null;
  try {
    return new Intl.DisplayNames(['fr'], { type: 'region' }).of(c) ?? c;
  } catch {
    return c;
  }
}

/** JSON à clés triées : même objet ⇒ même empreinte, quel que soit l'ordre des clés. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
    .join(',')}}`;
}

export const sha256Hex = (data: string | Buffer): string => crypto.createHash('sha256').update(data).digest('hex');

/** Jeton du lien de signature : 256 bits aléatoires ; seul son SHA-256 est conservé en base. */
export function newSignToken(): { token: string; hash: string } {
  const token = crypto.randomBytes(32).toString('base64url');
  return { token, hash: sha256Hex(token) };
}
