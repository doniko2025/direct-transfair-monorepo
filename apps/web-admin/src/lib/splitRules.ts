// src/lib/splitRules.ts
// Répartition des frais d'un retrait payé en agence : libellés, saisie des pourcentages, calcul de la part société.
// Mêmes règles que le serveur (apps/backend/src/commission-rules/) : le serveur reste juge.

import type { Shares, SplitChange, SplitDest, SplitRule, SplitSource } from '@direct-transfair/shared';

export const SOURCE_LABEL: Record<SplitSource, string> = {
  WALLET: 'Envoi depuis un wallet client',
  SUBSIDIARY: 'Envoi depuis une filiale',
  PARTNER: 'Envoi depuis un partenaire',
};

export const DEST_LABEL: Record<SplitDest, string> = {
  SUBSIDIARY: 'Retrait payé dans une filiale',
  PARTNER: 'Retrait payé chez un partenaire',
};

/** Ordre d'affichage stable : par expéditeur, puis par agence payeuse. */
export function sortSplitRules(rules: readonly SplitRule[]): SplitRule[] {
  const src: SplitSource[] = ['WALLET', 'SUBSIDIARY', 'PARTNER'];
  const dst: SplitDest[] = ['SUBSIDIARY', 'PARTNER'];
  return [...rules].sort((a, b) => src.indexOf(a.sourceType) - src.indexOf(b.sourceType) || dst.indexOf(a.destType) - dst.indexOf(b.destType));
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function pct(n: number): string {
  return `${n.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} %`;
}

export interface ParsedPercent {
  value: number | null;
  error: string | null;
}

/** Pourcentage de 0 à 100, deux décimales au plus, virgule ou point. */
export function parsePercent(raw: string): ParsedPercent {
  const t = raw.trim().replace(',', '.');
  if (t === '') return { value: null, error: null };
  if (!/^\d+(\.\d+)?$/.test(t)) return { value: null, error: 'Saisissez un nombre, par exemple 20 ou 12,5.' };
  const n = Number(t);
  if (!Number.isFinite(n) || n > 100) return { value: null, error: 'Entre 0 et 100 %.' };
  if (round2(n) !== n) return { value: null, error: 'Deux décimales au maximum.' };
  return { value: n, error: null };
}

export function toInput(n: number): string {
  return String(n).replace('.', ',');
}

/** Part société = ce qui reste. Négative si la somme dépasse 100. */
export function platformOf(sender: number, payer: number): number {
  return round2(100 - sender - payer);
}

export function sharesOf(rule: SplitRule): Shares {
  return { senderShare: rule.senderShare, payerShare: rule.payerShare, platformShare: rule.platformShare };
}

export function sharesLine(s: Shares): string {
  return `agence d’envoi ${pct(s.senderShare)} · agence payeuse ${pct(s.payerShare)} · société ${pct(s.platformShare)}`;
}

export function changeTitle(c: Pick<SplitChange, 'sourceType' | 'destType'>): string {
  if (!c.sourceType || !c.destType) return 'Répartition';
  return `${SOURCE_LABEL[c.sourceType]} → ${DEST_LABEL[c.destType].replace('Retrait payé ', 'payé ')}`;
}
