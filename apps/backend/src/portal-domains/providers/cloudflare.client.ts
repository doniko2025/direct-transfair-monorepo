// apps/backend/src/portal-domains/providers/cloudflare.client.ts
// =========================================================
// CLIENT CLOUDFLARE v1.0 — zones et enregistrements DNS des domaines de portail.
// Identifiants lus dans l'environnement à chaque appel : CLOUDFLARE_API_TOKEN (recommandé, droits limités)
// ou CLOUDFLARE_EMAIL + CLOUDFLARE_GLOBAL_KEY. Aucune valeur secrète n'entre jamais dans un message d'erreur.
// =========================================================

import { Injectable } from '@nestjs/common';

const CF_API = 'https://api.cloudflare.com/client/v4';
const TIMEOUT_MS = 15_000;

export interface CfZone {
  id: string;
  name: string;
  status: string; // 'active' une fois les nameservers propagés, sinon 'pending'
  name_servers: string[];
}

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class CloudflareClient {
  private headers(): Record<string, string> {
    const token = process.env.CLOUDFLARE_API_TOKEN?.trim();
    if (token) return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    const email = process.env.CLOUDFLARE_EMAIL?.trim();
    const key = process.env.CLOUDFLARE_GLOBAL_KEY?.trim();
    if (!email || !key) throw new ProviderError("Cloudflare n'est pas configuré (CLOUDFLARE_API_TOKEN).");
    return { 'X-Auth-Email': email, 'X-Auth-Key': key, 'Content-Type': 'application/json' };
  }

  private async call<T>(path: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET', body?: unknown): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${CF_API}${path}`, {
        method,
        headers: this.headers(),
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      if (err instanceof ProviderError) throw err;
      throw new ProviderError(`Cloudflare injoignable : ${(err as Error).message}`);
    }
    const json = (await res.json().catch(() => null)) as { success?: boolean; errors?: unknown; result?: T } | null;
    if (!res.ok || !json?.success) {
      const detail = json?.errors ? JSON.stringify(json.errors).slice(0, 300) : `HTTP ${res.status}`;
      throw new ProviderError(`Cloudflare a refusé la demande : ${detail}`, res.status);
    }
    return json.result as T;
  }

  async findZone(name: string): Promise<CfZone | null> {
    const zones = await this.call<CfZone[]>(`/zones?name=${encodeURIComponent(name)}`);
    return zones[0] ?? null;
  }

  /** Crée la zone si elle n'existe pas (domaine propre d'une société). Ne touche à aucun enregistrement DNS. */
  async ensureZone(name: string): Promise<CfZone> {
    const existing = await this.findZone(name);
    if (existing) return existing;
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
    if (!accountId) throw new ProviderError("CLOUDFLARE_ACCOUNT_ID manquant : impossible de créer la zone.");
    return this.call<CfZone>('/zones', 'POST', { name, account: { id: accountId }, type: 'full' });
  }

  /** Crée ou met à jour un enregistrement (non proxifié : Vercel doit voir le trafic pour émettre le certificat). */
  async upsertRecord(zoneId: string, type: 'A' | 'CNAME', name: string, content: string): Promise<void> {
    const existing = await this.call<Array<{ id: string; content: string }>>(
      `/zones/${zoneId}/dns_records?type=${type}&name=${encodeURIComponent(name)}`,
    );
    const body = { type, name, content, ttl: 1, proxied: false };
    if (existing.length > 0) {
      if (existing[0].content === content) return;
      await this.call(`/zones/${zoneId}/dns_records/${existing[0].id}`, 'PUT', body);
      return;
    }
    await this.call(`/zones/${zoneId}/dns_records`, 'POST', body);
  }

  /** Supprime un enregistrement par type et nom (aucune erreur s'il n'existe pas). */
  async deleteRecord(zoneId: string, type: 'A' | 'CNAME', name: string): Promise<void> {
    const existing = await this.call<Array<{ id: string }>>(
      `/zones/${zoneId}/dns_records?type=${type}&name=${encodeURIComponent(name)}`,
    );
    for (const r of existing) await this.call(`/zones/${zoneId}/dns_records/${r.id}`, 'DELETE');
  }
}
