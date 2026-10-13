// apps/backend/src/portal-domains/portal-domains.rules.ts
// =========================================================
// RÈGLES PURES v1.0 — validation et découpage des noms de domaine.
// Aucune entrée/sortie : tout est testable sans base ni réseau.
// =========================================================

import { domainToASCII } from 'node:url';

import { FORBIDDEN_SUFFIXES, multipartSuffixes, portalBaseDomain, protectedHosts, reservedSubdomains } from './portal-domains.config';

export class DomainRuleError extends Error {}

const LABEL_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;
const TLD_RE = /^([a-z]{2,63}|xn--[a-z0-9-]{2,59})$/;
const SUBDOMAIN_RE = /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/;

/** Nettoie une saisie : retire protocole, chemin, port, point final, passe en minuscules et en ASCII (punycode). */
export function normalizeHost(raw: unknown): string {
  let v = String(raw ?? '').trim().toLowerCase();
  v = v.replace(/^[a-z][a-z0-9+.-]*:\/\//, '');
  v = v.split(/[/?#]/)[0] ?? '';
  v = v.replace(/:\d+$/, '').replace(/\.+$/, '');
  if (!v) throw new DomainRuleError('Le domaine est vide.');
  if (/[\s@]/.test(v)) throw new DomainRuleError('Domaine invalide : espaces et "@" interdits.');
  const ascii = domainToASCII(v);
  if (!ascii) throw new DomainRuleError(`Domaine invalide : « ${v} ».`);
  return ascii;
}

/** Vérifie la forme d'un nom d'hôte (au moins deux libellés, TLD alphabétique, pas d'adresse IP). */
export function assertValidHostname(host: string): void {
  if (host.length > 253) throw new DomainRuleError('Domaine trop long (253 caractères maximum).');
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) throw new DomainRuleError('Une adresse IP ne peut pas servir de domaine.');
  const labels = host.split('.');
  if (labels.length < 2) throw new DomainRuleError('Domaine invalide : il faut au moins un nom et une extension (ex. ma-societe.com).');
  for (const l of labels) {
    if (!LABEL_RE.test(l)) throw new DomainRuleError(`Domaine invalide : le libellé « ${l} » n'est pas autorisé (lettres, chiffres et tirets).`);
  }
  if (!TLD_RE.test(labels[labels.length - 1])) throw new DomainRuleError("Domaine invalide : extension inconnue (ex. .com, .fr, .gn).");
}

/** Domaine enregistrable (celui qu'on achète chez un registrar) : a.b.ma-societe.com → ma-societe.com. */
export function registrableDomain(host: string, multipart: ReadonlySet<string> = multipartSuffixes()): string {
  const labels = host.split('.');
  if (labels.length <= 2) return host;
  const lastTwo = labels.slice(-2).join('.');
  const n = multipart.has(lastTwo) ? 3 : 2;
  return labels.slice(-n).join('.');
}

export type DomainPlan = {
  kind: 'SUBDOMAIN' | 'CUSTOM';
  /** Hôte principal enregistré (clé d'unicité). */
  host: string;
  /** Zone DNS qui porte l'hôte. */
  zoneName: string;
  /** Hôtes à rattacher au projet Vercel (domaine nu : lui + www). */
  attachHosts: string[];
  /** Enregistrements DNS attendus. */
  records: Array<{ type: 'A' | 'CNAME'; name: string }>;
  /** Valeur à stocker dans Client.subdomain (sous-domaine de plateforme uniquement). */
  subdomainLabel: string | null;
  /** Valeur à stocker dans Client.customDomain (domaine propre uniquement). */
  customDomain: string | null;
};

/** Plan pour un sous-domaine de la plateforme : <libellé>.<PORTAL_BASE_DOMAIN>. */
export function planSubdomain(labelRaw: unknown): DomainPlan {
  const base = portalBaseDomain();
  if (!base) throw new DomainRuleError("Les sous-domaines de la plateforme ne sont pas configurés (variable PORTAL_BASE_DOMAIN).");
  const label = String(labelRaw ?? '').trim().toLowerCase();
  if (!SUBDOMAIN_RE.test(label)) {
    throw new DomainRuleError('Sous-domaine : minuscules, chiffres et tirets, 3 à 32 caractères, sans tiret au début ni à la fin.');
  }
  if (reservedSubdomains().has(label)) throw new DomainRuleError(`Le sous-domaine « ${label} » est réservé.`);
  const host = `${label}.${base}`;
  return {
    kind: 'SUBDOMAIN',
    host,
    zoneName: base,
    attachHosts: [host],
    records: [{ type: 'CNAME', name: host }],
    subdomainLabel: label,
    customDomain: null,
  };
}

/** Plan pour un domaine propre. `zoneOverride` : zone à utiliser quand l'heuristique se trompe (suffixe inhabituel). */
export function planCustomDomain(hostRaw: unknown, zoneOverride?: unknown): DomainPlan {
  const input = normalizeHost(hostRaw);
  assertValidHostname(input);

  const base = portalBaseDomain();
  for (const p of protectedHosts()) {
    if (input === p || input.endsWith(`.${p}`)) {
      throw new DomainRuleError(`« ${input} » appartient à la plateforme et ne peut pas être attribué comme domaine propre.`);
    }
  }
  if (base && (input === base || input.endsWith(`.${base}`))) {
    throw new DomainRuleError(`Les adresses en .${base} s'attribuent avec l'option « sous-domaine de la plateforme ».`);
  }
  if (FORBIDDEN_SUFFIXES.some((s) => input.endsWith(s))) {
    throw new DomainRuleError("Ce type d'adresse (hébergeur, local) ne peut pas servir de domaine propre.");
  }

  let zoneName = registrableDomain(input);
  if (zoneOverride !== undefined && zoneOverride !== null && String(zoneOverride).trim() !== '') {
    const z = normalizeHost(zoneOverride);
    assertValidHostname(z);
    if (input !== z && !input.endsWith(`.${z}`)) {
      throw new DomainRuleError(`La zone « ${z} » ne contient pas le domaine « ${input} ».`);
    }
    zoneName = z;
  }

  // « www.ma-societe.com » saisi pour le domaine nu : on sert les deux, l'hôte principal est le domaine nu.
  const canonical = input === `www.${zoneName}` ? zoneName : input;
  const isApex = canonical === zoneName;

  return {
    kind: 'CUSTOM',
    host: canonical,
    zoneName,
    attachHosts: isApex ? [canonical, `www.${canonical}`] : [canonical],
    records: isApex
      ? [{ type: 'A', name: canonical }, { type: 'CNAME', name: `www.${canonical}` }]
      : [{ type: 'CNAME', name: canonical }],
    subdomainLabel: null,
    customDomain: canonical,
  };
}

/** Variantes sous lesquelles un navigateur peut présenter un même domaine (nu / www). */
export function hostVariants(host: string): string[] {
  const h = host.toLowerCase();
  const bare = h.replace(/^www\./, '');
  return Array.from(new Set([h, bare, `www.${bare}`]));
}
