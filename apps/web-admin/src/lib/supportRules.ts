// src/lib/supportRules.ts
// Règles d'affichage du service client (lot 9) : regroupement des interrupteurs, profils types, étiquettes, pagination.

import type {
  Page,
  Paged,
  RefundStatus,
  SupportPermission,
  SupportPermissionMeta,
  TicketOutcome,
  TicketStatus,
} from '@direct-transfair/shared';
import { expandSupportPermissions } from '@direct-transfair/shared';
export type PillTone = 'neutral' | 'brand' | 'ok' | 'warn' | 'danger';

/** Adapte une page du bureau d'assistance (items/total) au format attendu par usePagedList (data/meta). */
export function toPage<T extends { id: string }>(r: Paged<T>): Page<T> {
  return { data: r.items, meta: { total: r.total, page: r.page, limit: r.limit, totalPages: Math.max(1, Math.ceil(r.total / Math.max(1, r.limit))) } };
}

// ─── Interrupteurs ───────────────────────────────────────
export const GROUP_ORDER: readonly SupportPermissionMeta['group'][] = ['COMPTES', 'CONFORMITE', 'ASSISTANCE', 'ARGENT'];

export function groupedCatalog(catalog: readonly SupportPermissionMeta[]): { group: SupportPermissionMeta['group']; items: SupportPermissionMeta[] }[] {
  return GROUP_ORDER.map((group) => ({ group, items: catalog.filter((m) => m.group === group) })).filter((g) => g.items.length > 0);
}

/**
 * Nouvelle liste d'interrupteurs après un clic. Une délégation « impliquée » par une autre active est verrouillée (on ne peut pas
 * la couper tant que celle qui l'exige reste active). Couper une délégation retire aussi ce qu'elle seule justifiait.
 */
export function toggled(
  explicit: readonly SupportPermission[],
  key: SupportPermission,
  on: boolean,
  catalog: readonly SupportPermissionMeta[],
): SupportPermission[] {
  const set = new Set(explicit);
  if (on) set.add(key);
  else set.delete(key);
  // On ne garde que des interrupteurs réellement posés ; les implications se recalculent à l'affichage.
  return catalog.map((m) => m.key).filter((k) => set.has(k));
}

/** Qui impose cette délégation (parmi les interrupteurs posés) ? Vide = elle est libre. */
export function requiredBy(
  key: SupportPermission,
  explicit: readonly SupportPermission[],
  catalog: readonly SupportPermissionMeta[],
): SupportPermissionMeta[] {
  const have = new Set(expandSupportPermissions(explicit, catalog));
  return catalog.filter((m) => m.key !== key && explicit.includes(m.key) && have.has(m.key) && expandSupportPermissions([m.key], catalog).includes(key));
}

export interface PermissionPreset {
  id: string;
  label: string;
  hint: string;
  permissions: SupportPermission[];
}

/** Profils types : un point de départ que l'administrateur ajuste ensuite interrupteur par interrupteur. */
export const PRESETS: readonly PermissionPreset[] = [
  { id: 'none', label: 'Aucune délégation', hint: 'Le compte ne voit que son tableau de bord.', permissions: [] },
  { id: 'readonly', label: 'Consultation', hint: 'Voir les clients et les opérations, sans agir.', permissions: ['CLIENTS_VIEW', 'TRANSACTIONS_VIEW'] },
  { id: 'level1', label: 'Support niveau 1', hint: 'Répondre aux clients et vérifier leurs pièces.', permissions: ['CLIENTS_VIEW', 'TRANSACTIONS_VIEW', 'TICKETS_HANDLE', 'KYC_REVIEW'] },
  {
    id: 'level2',
    label: 'Support niveau 2',
    hint: 'Régler les litiges et suspendre / réactiver des comptes.',
    permissions: ['CLIENTS_VIEW', 'TRANSACTIONS_VIEW', 'TICKETS_HANDLE', 'KYC_REVIEW', 'DISPUTES_RESOLVE', 'ACCOUNT_SUSPEND', 'ACCOUNT_REACTIVATE'],
  },
  {
    id: 'lead',
    label: 'Responsable',
    hint: 'Tout, y compris valider les remboursements.',
    permissions: ['CLIENTS_VIEW', 'TRANSACTIONS_VIEW', 'TICKETS_HANDLE', 'KYC_REVIEW', 'KYC_COUNTER', 'DISPUTES_RESOLVE', 'ACCOUNT_SUSPEND', 'ACCOUNT_REACTIVATE', 'REFUNDS_DECIDE'],
  },
];

export function presetOf(explicit: readonly SupportPermission[]): PermissionPreset | null {
  const key = [...explicit].sort().join();
  return PRESETS.find((p) => [...p.permissions].sort().join() === key) ?? null;
}

// ─── Étiquettes ──────────────────────────────────────────
export const TICKET_TONE: Record<TicketStatus, PillTone> = {
  OPEN: 'warn',
  IN_PROGRESS: 'brand',
  WAITING_USER: 'neutral',
  RESOLVED: 'ok',
  CLOSED: 'neutral',
};

export const OUTCOME_TONE: Record<TicketOutcome, PillTone> = { ACCEPTED: 'ok', REJECTED: 'danger', INFO: 'neutral' };

export const REFUND_TONE: Record<RefundStatus, PillTone> = { PENDING: 'warn', APPROVED: 'ok', REJECTED: 'danger', FAILED: 'danger' };

export const PRIORITY_LABEL: Record<string, string> = { LOW: 'Basse', MEDIUM: 'Normale', HIGH: 'Haute', URGENT: 'Urgente' };

/** Message de l'administrateur à afficher quand une action est refusée faute de délégation. */
export const NOT_DELEGATED = "Cette action n'est pas (ou plus) déléguée à votre compte. Contactez votre administrateur.";
