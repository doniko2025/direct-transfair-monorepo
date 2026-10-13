// packages/shared/src/portalDomains.ts
// =========================================================
// DOMAINES DES PORTAILS DE SOCIÉTÉS — réservé au SUPER_ADMIN
//
// Contrat relevé dans apps/backend/src/portal-domains/portal-domains.controller.ts :
//   GET    /portal-domains/config             état des intégrations (Vercel, Cloudflare, sous-domaines)
//   GET    /portal-domains                    sociétés + domaine de leur portail
//   PUT    /portal-domains/:clientId          définir / remplacer le domaine
//   POST   /portal-domains/:clientId/check    revérifier maintenant
//   DELETE /portal-domains/:clientId          retirer le domaine
// =========================================================

import type { HttpClient } from './http';

export type PortalDomainKind = 'SUBDOMAIN' | 'CUSTOM';
export type PortalDomainDnsMode = 'CLOUDFLARE' | 'EXTERNAL';
export type PortalDomainStatus = 'PENDING_NAMESERVERS' | 'PENDING_VERIFICATION' | 'ACTIVE' | 'FAILED';

export interface PortalDomainConfig {
  vercel: boolean;
  cloudflare: boolean;
  /** Sous-domaines de plateforme utilisables (domaine de base + Vercel + Cloudflare). */
  subdomains: boolean;
  baseDomain: string | null;
  dnsATarget: string;
  dnsCnameTarget: string;
}

export interface PortalDomainInstruction {
  type: 'A' | 'CNAME';
  name: string;
  value: string;
}

export interface PortalDomain {
  clientId: number;
  kind: PortalDomainKind;
  dnsMode: PortalDomainDnsMode;
  host: string;
  url: string;
  zoneName: string;
  status: PortalDomainStatus;
  nameServers: string[];
  /** Enregistrements que la société ajoute elle-même (dnsMode EXTERNAL). */
  dnsInstructions: PortalDomainInstruction[];
  lastError: string | null;
  attempts: number;
  lastCheckedAt: string | null;
  activatedAt: string | null;
  createdAt: string;
}

export interface PortalDomainClient {
  id: number;
  code: string;
  name: string;
  isActive: boolean;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  subscriptionStatus: string | null;
}

export interface PortalDomainEntry {
  client: PortalDomainClient;
  domain: PortalDomain | null;
}

export interface PortalDomainResult extends PortalDomainEntry {
  /** Opérations secondaires qui n'ont pas pu aboutir (ex. ancien domaine non détaché de Vercel). */
  warnings: string[];
}

export interface SetPortalDomainInput {
  kind: PortalDomainKind;
  subdomain?: string;
  domain?: string;
  dnsMode?: PortalDomainDnsMode;
  zoneName?: string;
}

export function createPortalDomainsApi(http: HttpClient) {
  return {
    config: () => http.get<PortalDomainConfig>('/portal-domains/config'),
    list: () => http.get<PortalDomainEntry[]>('/portal-domains'),
    set: (clientId: number, input: SetPortalDomainInput) =>
      http.request<PortalDomainResult>(`/portal-domains/${clientId}`, { method: 'PUT', body: input }),
    check: (clientId: number) => http.post<PortalDomainResult>(`/portal-domains/${clientId}/check`),
    remove: (clientId: number) => http.delete<PortalDomainResult>(`/portal-domains/${clientId}`),
  };
}
