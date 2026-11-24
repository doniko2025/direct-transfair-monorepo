// src/lib/logoClash.ts
// SÉPARATION DES RÔLES : la plateforme (Direct Transf'air, société mère) et chaque société qu'elle héberge (Flash Transfer…) ont chacune
// leur identité. Un logo identique chez deux entités est presque toujours une erreur (logo de la plateforme repris par une société,
// ou l'inverse) : on le signale au super admin, sans jamais bloquer.

import type { CompanySummary } from '@direct-transfair/shared';

/** Clé de comparaison d'un logo : l'adresse sans espaces ni paramètres de cache (?v=…), les images intégrées (data:) telles quelles. */
export function logoKey(url: string | null | undefined): string | null {
  const raw = (url ?? '').trim();
  if (!raw) return null;
  if (/^data:/i.test(raw)) return raw;
  return raw.replace(/[?#].*$/, '').replace(/\/+$/, '').toLowerCase();
}

export interface LogoClash {
  /** Entités (nom + code) qui affichent exactement le même logo. */
  others: { id: number; name: string; code: string }[];
}

/**
 * Pour chaque société, les AUTRES sociétés (plateforme comprise) qui ont le même logo.
 * Renvoie une Map vide d'entrée si rien n'est en double.
 */
export function findLogoClashes(companies: readonly Pick<CompanySummary, 'id' | 'name' | 'code' | 'logoUrl'>[]): Map<number, LogoClash> {
  const byKey = new Map<string, { id: number; name: string; code: string }[]>();
  for (const c of companies) {
    const k = logoKey(c.logoUrl);
    if (!k) continue;
    const list = byKey.get(k) ?? [];
    list.push({ id: c.id, name: c.name, code: c.code });
    byKey.set(k, list);
  }
  const out = new Map<number, LogoClash>();
  for (const group of byKey.values()) {
    if (group.length < 2) continue;
    for (const c of group) out.set(c.id, { others: group.filter((o) => o.id !== c.id) });
  }
  return out;
}

export function clashLabel(clash: LogoClash): string {
  const names = clash.others.map((o) => o.name || o.code);
  return names.length <= 2 ? names.join(' et ') : `${names.slice(0, 2).join(', ')} et ${names.length - 2} autre(s)`;
}
