// src/lib/complianceRules.ts
// Libellés, tons et règles d'affichage de la conformité et des webhooks (lot 17) — fonctions pures.

import type { CaseAction, ComplianceCase, OfficialList, OfficialProvider, ComplianceCaseStatus, ComplianceSeverity, WatchlistKind, WebhookDeliveryStatus, WebhookEndpoint } from '@direct-transfair/shared';

export type Tone = 'neutral' | 'brand' | 'ok' | 'warn' | 'danger';

export const SEVERITY_LABEL: Record<ComplianceSeverity, string> = { LOW: 'Faible', MEDIUM: 'Moyenne', HIGH: 'Élevée', CRITICAL: 'Critique' };
export const SEVERITY_TONE: Record<ComplianceSeverity, Tone> = { LOW: 'neutral', MEDIUM: 'warn', HIGH: 'danger', CRITICAL: 'danger' };

export const STATUS_LABEL: Record<ComplianceCaseStatus, string> = {
  OPEN: 'À traiter', UNDER_REVIEW: 'En cours', ESCALATED: 'Escaladé', RESOLVED: 'Résolu', CLOSED: 'Classé',
};
export const STATUS_TONE: Record<ComplianceCaseStatus, Tone> = { OPEN: 'warn', UNDER_REVIEW: 'brand', ESCALATED: 'danger', RESOLVED: 'ok', CLOSED: 'neutral' };

export const KIND_LABEL: Record<string, string> = { SANCTION_MATCH: 'Liste de surveillance', AML_RULE: 'Règle anti-blanchiment', MANUAL: 'Manuel' };
export const WATCHLIST_LABEL: Record<WatchlistKind, string> = { SANCTION: 'Sanctions', PEP: 'Personnes exposées', INTERNAL: 'Liste interne' };
export const WATCHLIST_TONE: Record<WatchlistKind, Tone> = { SANCTION: 'danger', PEP: 'warn', INTERNAL: 'brand' };
export const WATCHLIST_OPTIONS = (Object.keys(WATCHLIST_LABEL) as WatchlistKind[]).map((value) => ({ value, label: WATCHLIST_LABEL[value] }));

export const ROLE_LABEL: Record<string, string> = { SENDER: 'Expéditeur', RECIPIENT: 'Destinataire', BENEFICIARY: 'Bénéficiaire', COUNTER_CUSTOMER: 'Client de passage', CUSTOMER: 'Client', TEST: 'Nom saisi' };
export const RULE_LABEL: Record<string, string> = { HIGH_RISK_COUNTRY: 'Pays à risque', STRUCTURING: 'Fractionnement', FAN_IN: 'Regroupement de fonds' };

export const isOpenCase = (c: Pick<ComplianceCase, 'status'>): boolean => c.status === 'OPEN' || c.status === 'UNDER_REVIEW' || c.status === 'ESCALATED';

/** Un envoi bloqué attend la décision : seule voie pour le libérer ou le rejeter. */
export const isHeld = (c: ComplianceCase): boolean => c.transaction?.status === 'ON_HOLD' && isOpenCase(c);

export interface CaseFilter { id: string; label: string; status?: string; kind?: string }
export const CASE_FILTERS: readonly CaseFilter[] = [
  { id: 'open', label: 'À traiter', status: 'OPEN_ALL' },
  { id: 'sanction', label: 'Surveillance', status: 'OPEN_ALL', kind: 'SANCTION_MATCH' },
  { id: 'aml', label: 'Anti-blanchiment', status: 'OPEN_ALL', kind: 'AML_RULE' },
  { id: 'closed', label: 'Clos', status: 'RESOLVED' },
  { id: 'dismissed', label: 'Classés', status: 'CLOSED' },
];

export interface ActionSpec { action: CaseAction; label: string; needsNote: boolean; tone: 'default' | 'danger'; help: string }

/** Actions proposées selon l'état du dossier. */
export function actionsFor(c: ComplianceCase): ActionSpec[] {
  if (!isOpenCase(c)) return [];
  const out: ActionSpec[] = [];
  if (c.status === 'OPEN') out.push({ action: 'TAKE', label: 'Prendre en charge', needsNote: false, tone: 'default', help: 'Le dossier vous est attribué.' });
  if (c.status !== 'ESCALATED') out.push({ action: 'ESCALATE', label: 'Escalader', needsNote: false, tone: 'default', help: 'À signaler comme demandant une attention particulière.' });
  if (isHeld(c)) {
    out.push({ action: 'RELEASE', label: 'Débloquer l’envoi', needsNote: true, tone: 'default', help: 'L’envoi reprend son cours. Justifiez la décision.' });
    out.push({ action: 'REJECT', label: 'Rejeter et rembourser', needsNote: true, tone: 'danger', help: 'L’envoi est annulé et l’expéditeur remboursé. Aucun message ne lui est envoyé.' });
  } else {
    out.push({ action: 'RESOLVE', label: 'Clore (traité)', needsNote: true, tone: 'default', help: 'Décrivez ce qui a été vérifié et décidé.' });
  }
  out.push({ action: 'DISMISS', label: 'Classer sans suite', needsNote: true, tone: 'default', help: 'Fausse alerte : expliquez pourquoi.' });
  return out;
}

export const scoreTone = (score: number): Tone => (score >= 96 ? 'danger' : score >= 90 ? 'warn' : 'brand');

/** Les pays à risque se saisissent à la suite, séparés par des virgules, des points-virgules ou des retours à la ligne. */
export function parseCountries(raw: string): string[] {
  return Array.from(new Set(raw.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean)));
}

// ── Webhooks ────────────────────────────────────────────

export const DELIVERY_LABEL: Record<WebhookDeliveryStatus, string> = { PENDING: 'En attente', RETRYING: 'Nouvelle tentative', SUCCESS: 'Reçu', FAILED: 'Échec' };
export const DELIVERY_TONE: Record<WebhookDeliveryStatus, Tone> = { PENDING: 'neutral', RETRYING: 'warn', SUCCESS: 'ok', FAILED: 'danger' };

export function hostOf(url: string): string {
  try { return new URL(url).host; } catch { return url; }
}

export type EndpointHealth = 'OFF' | 'DISABLED' | 'FAILING' | 'OK';
export function endpointHealth(e: Pick<WebhookEndpoint, 'isActive' | 'disabledAt' | 'consecutiveFailures'>): EndpointHealth {
  if (e.disabledAt) return 'DISABLED';
  if (!e.isActive) return 'OFF';
  return e.consecutiveFailures >= 3 ? 'FAILING' : 'OK';
}
export const HEALTH_LABEL: Record<EndpointHealth, string> = { OK: 'Actif', FAILING: 'Instable', DISABLED: 'Désactivé (échecs)', OFF: 'En pause' };
export const HEALTH_TONE: Record<EndpointHealth, Tone> = { OK: 'ok', FAILING: 'warn', DISABLED: 'danger', OFF: 'neutral' };

export function nextAttemptLabel(iso: string | null, now = new Date()): string {
  if (!iso) return '';
  const diff = new Date(iso).getTime() - now.getTime();
  if (!Number.isFinite(diff)) return '';
  if (diff <= 0) return 'dans un instant';
  if (diff < 3_600_000) return `dans ${Math.max(1, Math.round(diff / 60_000))} min`;
  return `dans ${Math.round(diff / 3_600_000)} h`;
}

/** Exemple de vérification de signature, à copier côté destinataire (Node.js). */
export const VERIFY_SNIPPET = `import { createHmac, timingSafeEqual } from 'node:crypto';

// req.rawBody = corps brut de la requête (avant tout JSON.parse)
export function isFromDirectTransfair(secret, header, rawBody) {
  const parts = Object.fromEntries(header.split(',').map((kv) => kv.split('=')));
  const age = Math.abs(Date.now() / 1000 - Number(parts.t));
  if (!parts.v1 || !(age <= 300)) return false; // refuse un message de plus de 5 minutes
  const expected = createHmac('sha256', secret).update(parts.t + '.' + rawBody).digest('hex');
  return timingSafeEqual(Buffer.from(expected), Buffer.from(parts.v1));
}`;


// ── Listes officielles (lot 17b) ──────────────────────────

export const OFFICIAL_FLAG: Record<OfficialProvider, string> = { UN: '🇺🇳', OFAC: '🇺🇸', EU: '🇪🇺' };
export const OFFICIAL_SHORT: Record<OfficialProvider, string> = { UN: 'ONU', OFAC: 'OFAC (États-Unis)', EU: 'Union européenne' };
export const OFFICIAL_ABOUT: Record<OfficialProvider, string> = {
  UN: 'Sanctions du Conseil de sécurité des Nations unies : terrorisme, conflits armés, prolifération.',
  OFAC: 'Liste SDN du Trésor américain. Beaucoup de banques partenaires l’exigent, même hors des États-Unis.',
  EU: 'Mesures restrictives de l’Union européenne. Nécessite une adresse de téléchargement personnelle (jeton).',
};

export function ago(iso: string | null | undefined, now = new Date()): string {
  if (!iso) return 'jamais';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 'jamais';
  const min = Math.max(0, Math.round((now.getTime() - t) / 60_000));
  if (min < 1) return 'à l’instant';
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.round(h / 24);
  return `il y a ${d} jour${d > 1 ? 's' : ''}`;
}

export type OfficialHealth = 'NEVER' | 'RUNNING' | 'OK' | 'STALE' | 'ERROR' | 'UNCONFIGURED';

/** État affiché d'une liste : une erreur récente sur une liste encore à jour reste « à jour » (l'avertissement porte sur l'ancienneté). */
export function officialHealth(l: Pick<OfficialList, 'configured' | 'status' | 'stale' | 'entryCount' | 'error'>): OfficialHealth {
  if (!l.configured && l.entryCount === 0) return 'UNCONFIGURED';
  if (l.status === 'RUNNING') return 'RUNNING';
  if (l.stale) return 'STALE';
  if (l.status === 'ERROR' && l.entryCount === 0) return 'ERROR';
  if (l.entryCount === 0) return 'NEVER';
  return 'OK';
}
export const OFFICIAL_HEALTH_LABEL: Record<OfficialHealth, string> = { NEVER: 'Pas encore téléchargée', RUNNING: 'Mise à jour…', OK: 'À jour', STALE: 'Périmée', ERROR: 'Échec', UNCONFIGURED: 'Adresse à configurer' };
export const OFFICIAL_HEALTH_TONE: Record<OfficialHealth, Tone> = { NEVER: 'neutral', RUNNING: 'brand', OK: 'ok', STALE: 'danger', ERROR: 'danger', UNCONFIGURED: 'warn' };

export const SOURCE_LABEL = (source: string | null | undefined): string | null => (source && source in OFFICIAL_SHORT ? OFFICIAL_SHORT[source as OfficialProvider].split(' ')[0] ?? source : null);
