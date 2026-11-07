// apps/web-admin/src/lib/urgentRules.ts
// Alertes urgentes de l'accueil — règles pures (sans React ni réseau).
//
// Une alerte = « N éléments attendent une décision » (dossiers à valider, litiges, remboursements, retraits…).
// Elle s'affiche tant qu'il y a du NOUVEAU : au moindre clic elle disparaît pour de bon, et ne revient que si
// de nouvelles demandes arrivent ensuite. Pour cela on mémorise, par catégorie, le nombre « déjà vu » :
//   • nouveauté = compteur actuel − déjà vu (jamais négatif) ;
//   • si le compteur redescend (le personnel a traité des demandes), le « déjà vu » redescend avec lui,
//     de sorte qu'une demande qui arrive ensuite redevient bien « nouvelle ».

import type { IconName } from '../components/Icon';

export type UrgentKind = 'kyc' | 'disputes' | 'tickets' | 'refunds' | 'payouts' | 'flagged' | 'alerts';

export interface UrgentMeta {
  icon: IconName;
  /** Libellé (singulier, pluriel) — « 3 dossiers d'identité à valider ». */
  one: string;
  many: string;
  /** Page où traiter la demande. */
  to: string;
  tone: 'warn' | 'danger' | 'info';
  /** Plus petit = plus haut dans la pile. */
  rank: number;
}

export const URGENT_META: Record<UrgentKind, UrgentMeta> = {
  alerts: { icon: 'alert', one: 'alerte critique de supervision', many: 'alertes critiques de supervision', to: '/supervision', tone: 'danger', rank: 0 },
  disputes: { icon: 'alert', one: 'litige à traiter', many: 'litiges à traiter', to: '/support/tickets', tone: 'danger', rank: 1 },
  flagged: { icon: 'shield', one: 'opération signalée', many: 'opérations signalées', to: '/transactions', tone: 'danger', rank: 2 },
  kyc: { icon: 'shield', one: "dossier d'identité à valider", many: "dossiers d'identité à valider", to: '/kyc', tone: 'warn', rank: 3 },
  refunds: { icon: 'swap', one: 'remboursement à décider', many: 'remboursements à décider', to: '/support/refunds', tone: 'warn', rank: 4 },
  payouts: { icon: 'withdraw', one: 'retrait marchand à traiter', many: 'retraits marchands à traiter', to: '/merchants/payouts', tone: 'warn', rank: 5 },
  tickets: { icon: 'list', one: 'demande client en attente', many: 'demandes clients en attente', to: '/support/tickets', tone: 'info', rank: 6 },
};

export type UrgentCounts = Partial<Record<UrgentKind, number>>;
export type UrgentSeen = Partial<Record<UrgentKind, number>>;

export interface UrgentItem {
  kind: UrgentKind;
  /** Total en attente. */
  count: number;
  /** Dont nouveaux depuis le dernier clic. */
  fresh: number;
  meta: UrgentMeta;
}

const KINDS = Object.keys(URGENT_META) as UrgentKind[];

const toCount = (n: unknown): number => (typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.floor(n) : 0);

/** « Déjà vu » ramené au compteur actuel : une baisse du compteur est répercutée. */
export function reconcileSeen(seen: UrgentSeen, counts: UrgentCounts): UrgentSeen {
  const next: UrgentSeen = {};
  for (const k of KINDS) {
    const s = toCount(seen[k]);
    const c = toCount(counts[k]);
    const kept = Math.min(s, c);
    if (kept > 0) next[k] = kept;
  }
  return next;
}

/** Alertes à afficher : uniquement les catégories qui ont du nouveau, les plus graves en premier. */
export function visibleItems(counts: UrgentCounts, seen: UrgentSeen): UrgentItem[] {
  const out: UrgentItem[] = [];
  for (const k of KINDS) {
    const count = toCount(counts[k]);
    const fresh = count - Math.min(toCount(seen[k]), count);
    if (count > 0 && fresh > 0) out.push({ kind: k, count, fresh, meta: URGENT_META[k] });
  }
  return out.sort((a, b) => a.meta.rank - b.meta.rank);
}

/** « 3 dossiers d'identité à valider ». */
export function urgentLabel(item: Pick<UrgentItem, 'count' | 'meta'>): string {
  return `${item.count} ${item.count > 1 ? item.meta.many : item.meta.one}`;
}

/** « 2 nouveaux » / « 1 nouveau » (rien si tout est nouveau : le total suffit). */
export function freshLabel(item: Pick<UrgentItem, 'count' | 'fresh'>): string | null {
  if (item.fresh >= item.count) return 'Nouveau';
  return `dont ${item.fresh} nouveau${item.fresh > 1 ? 'x' : ''}`;
}

export function totalFresh(items: readonly UrgentItem[]): number {
  return items.reduce((n, i) => n + i.fresh, 0);
}

/** Lecture tolérante du stockage local (valeur absente, illisible ou falsifiée → vide). */
export function parseSeen(raw: string | null): UrgentSeen {
  if (!raw) return {};
  try {
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== 'object') return {};
    const out: UrgentSeen = {};
    for (const k of KINDS) {
      const n = toCount((data as Record<string, unknown>)[k]);
      if (n > 0) out[k] = n;
    }
    return out;
  } catch {
    return {};
  }
}
