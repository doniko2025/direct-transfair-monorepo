// apps/backend/src/portal-domains/providers/vercel.client.ts
// =========================================================
// CLIENT VERCEL v1.1 — rattachement des domaines au projet qui sert les portails des sociétés.
// Paramétré par PORTAL_VERCEL_PROJECT_ID (distinct du projet de la console /transfert), VERCEL_API_TOKEN, VERCEL_TEAM_ID.
//
// v1.1 — 🔥 CORRIGÉ : « Vérifier » ne faisait que LIRE l'état du domaine (GET) ; Vercel ne relit le TXT de preuve
//        _vercel.<domaine> que de son propre chef, parfois après de longues minutes, d'où des domaines bloqués en
//        « Validation en cours » alors que le TXT était déjà en place. Ajout de verifyDomain() : demande explicite de
//        relecture (POST …/verify), appelée par le moteur dès qu'un domaine n'est pas encore vérifié.
// =========================================================

import { Injectable } from '@nestjs/common';

import { ProviderError } from './cloudflare.client';

const VERCEL_API = 'https://api.vercel.com';
const TIMEOUT_MS = 15_000;

export interface VercelDomain {
  name: string;
  verified: boolean;
  verification?: Array<{ type: string; domain: string; value: string; reason?: string }>;
}

@Injectable()
export class VercelClient {
  private projectId(): string {
    const id = process.env.PORTAL_VERCEL_PROJECT_ID?.trim();
    if (!id) throw new ProviderError("Vercel n'est pas configuré (PORTAL_VERCEL_PROJECT_ID).");
    return id;
  }

  private async call<T>(path: string, method: 'GET' | 'POST' | 'DELETE' = 'GET', body?: unknown): Promise<T> {
    const token = process.env.VERCEL_API_TOKEN?.trim();
    if (!token) throw new ProviderError("Vercel n'est pas configuré (VERCEL_API_TOKEN).");
    const team = process.env.VERCEL_TEAM_ID?.trim();
    const url = `${VERCEL_API}${path}${team ? `${path.includes('?') ? '&' : '?'}teamId=${encodeURIComponent(team)}` : ''}`;
    let res: Response;
    try {
      res = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      throw new ProviderError(`Vercel injoignable : ${(err as Error).message}`);
    }
    const json = (await res.json().catch(() => ({}))) as { error?: { message?: string; code?: string } } & T;
    if (!res.ok) {
      const detail = json?.error?.message ?? json?.error?.code ?? `HTTP ${res.status}`;
      throw new ProviderError(`Vercel a refusé la demande : ${String(detail).slice(0, 300)}`, res.status);
    }
    return json as T;
  }

  /** Rattache un domaine au projet. Déjà rattaché à CE projet ⇒ sans effet. Rattaché ailleurs ⇒ erreur explicite. */
  async addDomain(host: string): Promise<VercelDomain> {
    try {
      return await this.call<VercelDomain>(`/v10/projects/${this.projectId()}/domains`, 'POST', { name: host });
    } catch (err) {
      if (err instanceof ProviderError && (err.status === 409 || err.status === 400)) {
        // Déjà présent sur ce projet ? On le relit ; sinon il appartient à un autre projet / compte.
        try {
          return await this.getDomain(host);
        } catch {
          throw new ProviderError(`« ${host} » est déjà utilisé par un autre projet Vercel : ${err.message}`, err.status);
        }
      }
      throw err;
    }
  }

  async getDomain(host: string): Promise<VercelDomain> {
    return this.call<VercelDomain>(`/v9/projects/${this.projectId()}/domains/${encodeURIComponent(host)}`);
  }

  /**
   * Demande à Vercel de relire MAINTENANT le TXT de vérification du domaine (sans cet appel il ne le fait que de lui-même,
   * parfois tardivement). Jamais bloquant : « pas encore vérifié » (400), domaine inconnu (404) ou conflit (409) ne sont pas
   * des pannes — l'appelant relit l'état juste après. Les autres erreurs (jeton refusé, Vercel en panne) remontent.
   */
  async verifyDomain(host: string): Promise<void> {
    try {
      await this.call(`/v9/projects/${this.projectId()}/domains/${encodeURIComponent(host)}/verify`, 'POST');
    } catch (err) {
      if (err instanceof ProviderError && (err.status === 400 || err.status === 404 || err.status === 409)) return;
      throw err;
    }
  }

  /** Le DNS du domaine pointe-t-il bien vers Vercel ? */
  async isMisconfigured(host: string): Promise<boolean> {
    try {
      const cfg = await this.call<{ misconfigured?: boolean }>(`/v6/domains/${encodeURIComponent(host)}/config`);
      return cfg.misconfigured === true;
    } catch {
      return false; // information indisponible : on ne bloque pas sur ce seul signal
    }
  }

  /** Détache un domaine du projet (404 = déjà absent). */
  async removeDomain(host: string): Promise<void> {
    try {
      await this.call(`/v9/projects/${this.projectId()}/domains/${encodeURIComponent(host)}`, 'DELETE');
    } catch (err) {
      if (err instanceof ProviderError && err.status === 404) return;
      throw err;
    }
  }
}
