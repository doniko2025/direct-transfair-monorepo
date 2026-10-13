// src/lib/portalDomainRules.ts
// Règles de saisie et libellés des domaines de portail. Le serveur applique les mêmes règles (et plus : libellés
// réservés, conflits, hôtes de la plateforme) : le web ne fait que prévenir les fautes de frappe évidentes.

import type { PortalDomain, PortalDomainStatus } from '@direct-transfair/shared';

export const SUBDOMAIN_RE = /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/;
export const HOST_RE = /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+([a-z]{2,63}|xn--[a-z0-9-]{2,59})$/;

export type StatusTone = 'ok' | 'brand' | 'warn' | 'danger' | 'neutral';

export const STATUS_LABEL: Record<PortalDomainStatus, string> = {
  ACTIVE: 'Actif',
  PENDING_NAMESERVERS: 'Nameservers à pointer',
  PENDING_VERIFICATION: 'Validation en cours',
  FAILED: 'En erreur',
};

export const STATUS_TONE: Record<PortalDomainStatus, StatusTone> = {
  ACTIVE: 'ok',
  PENDING_NAMESERVERS: 'warn',
  PENDING_VERIFICATION: 'brand',
  FAILED: 'danger',
};

/** Retire protocole, chemin, port et point final d'une saisie, passe en minuscules. */
export function cleanHost(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^[a-z][a-z0-9+.-]*:\/\//, '')
    .split(/[/?#]/)[0]!
    .replace(/:\d+$/, '')
    .replace(/\.+$/, '');
}

export function validateSubdomain(value: string): string | null {
  if (!value) return 'Saisissez le sous-domaine.';
  if (!SUBDOMAIN_RE.test(value)) return 'Minuscules, chiffres et tirets, 3 à 32 caractères, sans tiret au début ni à la fin.';
  return null;
}

export function validateDomain(value: string): string | null {
  const host = cleanHost(value);
  if (!host) return 'Saisissez le domaine.';
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return 'Une adresse IP ne peut pas servir de domaine.';
  if (!HOST_RE.test(host)) return 'Domaine invalide. Exemple : ma-societe.com ou portail.ma-societe.com';
  return null;
}

/** Adresse finale telle que l'utilisateur la verra, pour l'aperçu du formulaire. */
export function previewUrl(kind: 'SUBDOMAIN' | 'CUSTOM', subdomain: string, domain: string, baseDomain: string | null): string | null {
  if (kind === 'SUBDOMAIN') return subdomain && baseDomain ? `https://${subdomain}.${baseDomain}` : null;
  const host = cleanHost(domain).replace(/^www\./, '');
  return host ? `https://${host}` : null;
}

/** Consigne affichée sur la carte, selon l'état d'avancement. */
export function nextStep(d: PortalDomain): string {
  switch (d.status) {
    case 'ACTIVE':
      return 'Le portail est en ligne en HTTPS.';
    case 'PENDING_NAMESERVERS':
      return 'Demandez à la société de remplacer les nameservers de son domaine, chez son registrar, par ceux ci-dessous. Le portail s’active tout seul ensuite (de quelques minutes à 48 h).';
    case 'PENDING_VERIFICATION':
      return d.dnsMode === 'EXTERNAL'
        ? 'La société doit ajouter ces enregistrements chez le gestionnaire de son DNS. La vérification est automatique.'
        : 'Les enregistrements DNS sont en place. L’hébergeur valide le domaine et émet le certificat (quelques minutes).';
    case 'FAILED':
      return 'La dernière tentative a échoué. Une nouvelle tentative a lieu automatiquement ; vous pouvez aussi la relancer.';
  }
}

/** « il y a 5 min », « il y a 3 h », « il y a 2 j ». */
export function ago(iso: string | null, now: number = Date.now()): string {
  if (!iso) return 'jamais';
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'à l’instant';
  if (s < 3600) return `il y a ${Math.round(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.round(s / 3600)} h`;
  return `il y a ${Math.round(s / 86400)} j`;
}
