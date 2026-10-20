// apps/backend/src/portal-domains/portal-domains.service.ts
// =========================================================
// ✅ v1.2 (phase 7) : la société système (exclue de la gestion des domaines) est lue dans la configuration plateforme (PLATFORM_TENANT_CODE) ; SYSTEM_COMPANY_CODE supprimé.
// DOMAINES DES PORTAILS DE SOCIÉTÉS v1.1 (lot C — console unique)
//
// v1.1 — 🔥 CORRIGÉ : un domaine restait en « Validation en cours » alors que le TXT de preuve était en place — le moteur
//        lisait l'état chez Vercel mais ne lui demandait jamais de relire le TXT. Désormais, tant que Vercel ne confirme
//        pas le domaine : (1) zone gérée par la plateforme ⇒ le TXT « _vercel » demandé est posé automatiquement dans
//        Cloudflare (jamais d'écrasement d'un autre TXT ; seuls les noms _vercel.* de la zone et les valeurs
//        vc-domain-verify=… sont acceptés) ; (2) relecture forcée chez Vercel (verifyDomain), puis nouvelle lecture.
//        Si la pose du TXT échoue, on retombe sur l'instruction manuelle au lieu de passer le domaine en erreur.
//
// Une société = un domaine pour son portail web (web-admin servi à la racine) :
//   • SUBDOMAIN : <libellé>.<PORTAL_BASE_DOMAIN>  → enregistrement CNAME dans la zone Cloudflare de la plateforme
//   • CUSTOM    : domaine propre de la société
//        - dnsMode CLOUDFLARE : on crée la zone Cloudflare, la société pointe ses nameservers chez son registrar,
//                               puis les enregistrements A/CNAME sont posés automatiquement ;
//        - dnsMode EXTERNAL   : la société garde son DNS et ajoute elle-même les enregistrements indiqués.
//
// Machine d'états (ClientPortalDomain.status) :
//   PENDING_NAMESERVERS → (zone Cloudflare active) → PENDING_VERIFICATION → (Vercel valide) → ACTIVE
//   n'importe quelle étape en erreur → FAILED (lastError), nouvelle tentative automatique avec attente croissante.
//
// La résolution par hôte (GET /branding/by-host) et le CORS continuent de lire Client.customDomain / Client.subdomain :
// ce service les renseigne en même temps que la table de suivi.
// =========================================================

import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, type ClientPortalDomain } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { dnsATarget, dnsCnameTarget, integrationState, maxAutoAttempts, type IntegrationState } from './portal-domains.config';
import {
  DomainRuleError,
  hostVariants,
  planCustomDomain,
  planSubdomain,
  type DomainPlan,
} from './portal-domains.rules';
import { CloudflareClient, ProviderError } from './providers/cloudflare.client';
import { VercelClient } from './providers/vercel.client';
import { platform } from '../common/platform.config';

const LEASE_MS = 2 * 60_000;
const ACTIVE_RECHECK_MS = 24 * 3_600_000;
const FAST_POLL_MS = 5 * 60_000;
const SLOW_POLL_MS = 60 * 60_000;
const SLOW_AFTER_MS = 48 * 3_600_000;
const BATCH = 50;

export type SetDomainInput = {
  kind: 'SUBDOMAIN' | 'CUSTOM';
  subdomain?: string;
  domain?: string;
  dnsMode?: 'CLOUDFLARE' | 'EXTERNAL';
  zoneName?: string;
};

export type DnsInstruction = { type: 'A' | 'CNAME'; name: string; value: string };

export type PortalDomainView = {
  clientId: number;
  kind: ClientPortalDomain['kind'];
  dnsMode: ClientPortalDomain['dnsMode'];
  host: string;
  url: string;
  zoneName: string;
  status: ClientPortalDomain['status'];
  nameServers: string[];
  /** Enregistrements que la société doit ajouter elle-même (dnsMode EXTERNAL). */
  dnsInstructions: DnsInstruction[];
  lastError: string | null;
  attempts: number;
  lastCheckedAt: string | null;
  activatedAt: string | null;
  createdAt: string;
};

const CLIENT_SELECT = {
  id: true,
  code: true,
  name: true,
  isActive: true,
  deletedAt: true,
  logoUrl: true,
  primaryColor: true,
  secondaryColor: true,
  subscriptionStatus: true,
  subdomain: true,
  customDomain: true,
} satisfies Prisma.ClientSelect;

type ClientRow = Prisma.ClientGetPayload<{ select: typeof CLIENT_SELECT }>;

/** Message d'erreur sûr à stocker et à afficher : une ligne, longueur bornée. */
export function safeMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err ?? 'Erreur inconnue');
  return raw.replace(/\s+/g, ' ').trim().slice(0, 400) || 'Erreur inconnue';
}

/**
 * Preuve de propriété que la plateforme accepte de poser d'elle-même : un TXT « _vercel.<zone ou sous-zone> » portant une
 * valeur « vc-domain-verify=… ». La réponse de Vercel est une donnée externe : rien d'autre n'est écrit dans notre zone DNS.
 */
export function isVercelTxtProof(v: { type: string; domain: string; value: string }, zoneName: string): boolean {
  const name = v.domain.trim().toLowerCase();
  const zone = zoneName.trim().toLowerCase();
  return (
    v.type === 'TXT' &&
    /^_vercel\./.test(name) &&
    (name === `_vercel.${zone}` || name.endsWith(`.${zone}`)) &&
    v.value.trim().startsWith('vc-domain-verify=')
  );
}

/** Attente avant une nouvelle tentative automatique après `attempts` échecs : 5 min, 10, 20… plafonnée à 6 h. */
export function retryDelayMs(attempts: number): number {
  return Math.min(6 * 3_600_000, FAST_POLL_MS * 2 ** Math.max(0, Math.min(attempts, 10)));
}

/** Hôtes à rattacher à Vercel et enregistrements DNS attendus, déduits de la ligne de suivi. */
export function planOfRecord(rec: Pick<ClientPortalDomain, 'kind' | 'host' | 'zoneName'>): Pick<DomainPlan, 'attachHosts' | 'records'> {
  if (rec.kind === 'SUBDOMAIN') {
    return { attachHosts: [rec.host], records: [{ type: 'CNAME', name: rec.host }] };
  }
  if (rec.host === rec.zoneName) {
    return {
      attachHosts: [rec.host, `www.${rec.host}`],
      records: [{ type: 'A', name: rec.host }, { type: 'CNAME', name: `www.${rec.host}` }],
    };
  }
  return { attachHosts: [rec.host], records: [{ type: 'CNAME', name: rec.host }] };
}

export function toView(rec: ClientPortalDomain): PortalDomainView {
  const { records } = planOfRecord(rec);
  const external = rec.dnsMode === 'EXTERNAL';
  return {
    clientId: rec.clientId,
    kind: rec.kind,
    dnsMode: rec.dnsMode,
    host: rec.host,
    url: `https://${rec.host}`,
    zoneName: rec.zoneName,
    status: rec.status,
    nameServers: rec.nameServers,
    dnsInstructions: external
      ? records.map((r) => ({ type: r.type, name: r.name, value: r.type === 'A' ? dnsATarget() : dnsCnameTarget() }))
      : [],
    lastError: rec.lastError,
    attempts: rec.attempts,
    lastCheckedAt: rec.lastCheckedAt?.toISOString() ?? null,
    activatedAt: rec.activatedAt?.toISOString() ?? null,
    createdAt: rec.createdAt.toISOString(),
  };
}

@Injectable()
export class PortalDomainsService {
  private readonly logger = new Logger(PortalDomainsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudflare: CloudflareClient,
    private readonly vercel: VercelClient,
  ) {}

  // ───────────────────────── Lecture ─────────────────────────

  config(): IntegrationState {
    return integrationState();
  }

  async list() {
    const [clients, records] = await Promise.all([
      this.prisma.client.findMany({
        where: { code: { not: platform.code }, deletedAt: null },
        select: CLIENT_SELECT,
        orderBy: { name: 'asc' },
      }),
      this.prisma.clientPortalDomain.findMany(),
    ]);
    const byClient = new Map(records.map((r) => [r.clientId, r]));
    return clients.map((c) => ({
      client: this.clientView(c),
      domain: byClient.has(c.id) ? toView(byClient.get(c.id)!) : null,
    }));
  }

  async get(clientId: number) {
    const client = await this.loadClient(clientId);
    const rec = await this.prisma.clientPortalDomain.findUnique({ where: { clientId } });
    return { client: this.clientView(client), domain: rec ? toView(rec) : null };
  }

  // ───────────────────────── Écriture ─────────────────────────

  async setDomain(actorId: string | undefined, clientId: number, input: SetDomainInput) {
    const client = await this.loadClient(clientId);
    const state = integrationState();
    const dnsMode = input.kind === 'SUBDOMAIN' ? 'CLOUDFLARE' : (input.dnsMode ?? 'CLOUDFLARE');

    let plan: DomainPlan;
    try {
      plan = input.kind === 'SUBDOMAIN' ? planSubdomain(input.subdomain) : planCustomDomain(input.domain, input.zoneName);
    } catch (err) {
      if (err instanceof DomainRuleError) throw new BadRequestException(err.message);
      throw err;
    }

    if (!state.vercel) throw new BadRequestException("Vercel n'est pas configuré (VERCEL_API_TOKEN, PORTAL_VERCEL_PROJECT_ID).");
    if (dnsMode === 'CLOUDFLARE' && !state.cloudflare) {
      throw new BadRequestException("Cloudflare n'est pas configuré (CLOUDFLARE_API_TOKEN). Choisissez « DNS géré par la société » ou configurez Cloudflare.");
    }

    await this.assertHostFree(clientId, plan);

    const previous = await this.prisma.clientPortalDomain.findUnique({ where: { clientId } });
    const sameTarget = previous && previous.host === plan.host && previous.dnsMode === dnsMode;

    try {
      await this.prisma.$transaction(async (tx) => {
        const data = {
          kind: plan.kind,
          dnsMode,
          host: plan.host,
          zoneName: plan.zoneName,
          ...(sameTarget
            ? {}
            : {
                zoneId: null,
                nameServers: [],
                status: dnsMode === 'CLOUDFLARE' ? ('PENDING_NAMESERVERS' as const) : ('PENDING_VERIFICATION' as const),
                lastError: null,
                attempts: 0,
                lastCheckedAt: null,
                activatedAt: null,
                leaseUntil: null,
              }),
        };
        if (previous) await tx.clientPortalDomain.update({ where: { clientId }, data });
        else await tx.clientPortalDomain.create({ data: { clientId, ...data } });

        // Client.* reste la source de la résolution par hôte. On ne vide l'autre champ que s'il venait de l'ancien domaine.
        const patch: Prisma.ClientUpdateInput = {};
        if (plan.kind === 'SUBDOMAIN') {
          patch.subdomain = plan.subdomainLabel;
          if (previous?.kind === 'CUSTOM') patch.customDomain = null;
        } else {
          patch.customDomain = plan.customDomain;
          if (previous?.kind === 'SUBDOMAIN') patch.subdomain = null;
        }
        await tx.client.update({ where: { id: clientId }, data: patch });
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException(`« ${plan.host} » est déjà attribué à une autre société.`);
      }
      throw err;
    }

    await this.audit(actorId, clientId, 'PORTAL_DOMAIN_SET', { host: plan.host, kind: plan.kind, dnsMode, previousHost: previous?.host ?? null });

    // Ancien domaine : on le détache de Vercel (sans bloquer si l'opération échoue).
    const warnings: string[] = [];
    if (previous && previous.host !== plan.host) warnings.push(...(await this.detach(previous)));

    const rec = await this.advance(clientId);
    const fresh = rec ?? (await this.prisma.clientPortalDomain.findUnique({ where: { clientId } }));
    return { client: this.clientView((await this.loadClient(clientId)) ?? client), domain: fresh ? toView(fresh) : null, warnings };
  }

  /** Relance immédiate (bouton « Vérifier »). Remet le compteur d'échecs à zéro. */
  async recheck(actorId: string | undefined, clientId: number) {
    const client = await this.loadClient(clientId);
    const rec = await this.prisma.clientPortalDomain.findUnique({ where: { clientId } });
    if (!rec) throw new NotFoundException("Cette société n'a pas encore de domaine de portail.");
    if (rec.status === 'FAILED') {
      await this.prisma.clientPortalDomain.update({ where: { clientId }, data: { attempts: 0 } });
    }
    const next = await this.advance(clientId);
    return { client: this.clientView(client), domain: toView(next ?? rec), warnings: [] as string[] };
  }

  async remove(actorId: string | undefined, clientId: number) {
    const client = await this.loadClient(clientId);
    const rec = await this.prisma.clientPortalDomain.findUnique({ where: { clientId } });
    if (!rec) throw new NotFoundException("Cette société n'a pas de domaine de portail.");

    await this.prisma.$transaction(async (tx) => {
      await tx.clientPortalDomain.delete({ where: { clientId } });
      const variants = hostVariants(rec.host);
      if (rec.kind === 'SUBDOMAIN') {
        await tx.client.updateMany({ where: { id: clientId, subdomain: rec.host.slice(0, rec.host.length - rec.zoneName.length - 1) }, data: { subdomain: null } });
      } else {
        await tx.client.updateMany({ where: { id: clientId, customDomain: { in: variants } }, data: { customDomain: null } });
      }
    });

    const warnings = await this.detach(rec);
    await this.audit(actorId, clientId, 'PORTAL_DOMAIN_REMOVE', { host: rec.host, kind: rec.kind });
    return { client: this.clientView(client), domain: null, warnings };
  }

  // ───────────────────────── Vérification planifiée ─────────────────────────

  /** Appelée par le planificateur : fait avancer les domaines en attente, relance les échecs, contrôle les actifs. */
  async checkDue(now: Date = new Date()): Promise<{ examined: number; activated: number; failed: number }> {
    const state = integrationState();
    if (!state.vercel) return { examined: 0, activated: 0, failed: 0 };

    const rows = await this.prisma.clientPortalDomain.findMany({
      where: {
        OR: [
          { status: { in: ['PENDING_NAMESERVERS', 'PENDING_VERIFICATION'] } },
          { status: 'FAILED', attempts: { lt: maxAutoAttempts() } },
          { status: 'ACTIVE', OR: [{ lastCheckedAt: null }, { lastCheckedAt: { lt: new Date(now.getTime() - ACTIVE_RECHECK_MS) } }] },
        ],
      },
      orderBy: { lastCheckedAt: { sort: 'asc', nulls: 'first' } },
      take: BATCH * 2,
    });

    const due = rows.filter((r) => this.isDue(r, now)).slice(0, BATCH);
    let activated = 0;
    let failed = 0;
    for (const r of due) {
      const wasActive = r.status === 'ACTIVE';
      const next = await this.advance(r.clientId, { verifyOnly: wasActive });
      if (!next) continue;
      if (!wasActive && next.status === 'ACTIVE') activated += 1;
      if (next.status === 'FAILED') failed += 1;
    }
    return { examined: due.length, activated, failed };
  }

  /** Vrai si la ligne doit être retraitée maintenant (intervalle selon l'état). */
  isDue(r: ClientPortalDomain, now: Date): boolean {
    const last = r.lastCheckedAt?.getTime() ?? 0;
    const elapsed = now.getTime() - last;
    if (r.leaseUntil && r.leaseUntil.getTime() > now.getTime()) return false;
    switch (r.status) {
      case 'ACTIVE':
        return elapsed >= ACTIVE_RECHECK_MS;
      case 'FAILED':
        return r.attempts < maxAutoAttempts() && elapsed >= retryDelayMs(r.attempts);
      default: {
        const age = now.getTime() - r.createdAt.getTime();
        return elapsed >= (age > SLOW_AFTER_MS ? SLOW_POLL_MS : FAST_POLL_MS);
      }
    }
  }

  // ───────────────────────── Moteur ─────────────────────────

  /**
   * Un pas de la machine d'états, protégé par un verrou court : deux traitements simultanés (requête + planificateur,
   * ou deux instances) ne se marchent pas dessus. Ne lève jamais : l'erreur est consignée dans la ligne.
   */
  async advance(clientId: number, opts: { verifyOnly?: boolean } = {}): Promise<ClientPortalDomain | null> {
    const now = new Date();
    const claim = await this.prisma.clientPortalDomain.updateMany({
      where: { clientId, OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }] },
      data: { leaseUntil: new Date(now.getTime() + LEASE_MS) },
    });
    const rec = await this.prisma.clientPortalDomain.findUnique({ where: { clientId } });
    if (!rec || claim.count === 0) return rec;

    let patch: Prisma.ClientPortalDomainUpdateInput;
    try {
      patch = await this.step(rec, Boolean(opts.verifyOnly));
    } catch (err) {
      const message = safeMessage(err);
      this.logger.warn(`Domaine ${rec.host} (société ${rec.clientId}) : ${message}`);
      patch = { status: 'FAILED', lastError: message, attempts: rec.attempts + 1 };
    }

    return this.prisma.clientPortalDomain.update({
      where: { clientId },
      data: { ...patch, lastCheckedAt: new Date(), leaseUntil: null },
    });
  }

  private async step(rec: ClientPortalDomain, verifyOnly: boolean): Promise<Prisma.ClientPortalDomainUpdateInput> {
    const { attachHosts, records } = planOfRecord(rec);
    let zoneId = rec.zoneId;
    let nameServers = rec.nameServers;

    if (!verifyOnly && rec.dnsMode === 'CLOUDFLARE') {
      // Sous-domaine de la plateforme : la zone existe déjà, on ne la crée JAMAIS (ce serait une zone parasite).
      const zone =
        rec.kind === 'SUBDOMAIN' ? await this.cloudflare.findZone(rec.zoneName) : await this.cloudflare.ensureZone(rec.zoneName);
      if (!zone) throw new ProviderError(`La zone « ${rec.zoneName} » est introuvable dans le compte Cloudflare.`);
      zoneId = zone.id;
      nameServers = zone.name_servers ?? [];

      if (zone.status !== 'active') {
        return { zoneId, nameServers: { set: nameServers }, status: 'PENDING_NAMESERVERS', lastError: null, attempts: 0 };
      }
      for (const r of records) {
        await this.cloudflare.upsertRecord(zone.id, r.type, r.name, r.type === 'A' ? dnsATarget() : dnsCnameTarget());
      }
    }

    if (!verifyOnly) {
      for (const h of attachHosts) await this.vercel.addDomain(h);
    }

    let domain = await this.vercel.getDomain(rec.host);
    let txtPosted = false;

    if (!domain.verified) {
      // Preuve de propriété demandée par Vercel (TXT _vercel.<zone>) : on la pose si la zone est la nôtre.
      const proof = domain.verification?.find((v) => isVercelTxtProof(v, rec.zoneName));
      if (proof && !verifyOnly && zoneId && rec.dnsMode === 'CLOUDFLARE') {
        try {
          await this.cloudflare.ensureTxtRecord(zoneId, proof.domain, proof.value);
          txtPosted = true;
        } catch (err) {
          // Pas bloquant : le message affiché indiquera l'enregistrement à poser à la main.
          this.logger.warn(`Domaine ${rec.host} : TXT de vérification non posé (${safeMessage(err)})`);
        }
      }
      // Vercel ne relit le TXT que de lui-même (parfois tardivement) : on lui demande de le relire maintenant.
      await this.vercel.verifyDomain(rec.host);
      domain = await this.vercel.getDomain(rec.host);
    }
    const misconfigured = await this.vercel.isMisconfigured(rec.host);

    if (domain.verified && !misconfigured) {
      return {
        zoneId,
        nameServers: { set: nameServers },
        status: 'ACTIVE',
        lastError: null,
        attempts: 0,
        activatedAt: rec.activatedAt ?? new Date(),
      };
    }

    let info: string | null = null;
    if (!domain.verified && domain.verification?.length) {
      const v = domain.verification[0];
      info = txtPosted
        ? "Vérification en cours chez Vercel : l'enregistrement TXT de contrôle est posé automatiquement."
        : `Vercel demande un enregistrement ${v.type} : ${v.domain} = ${v.value}`.slice(0, 400);
    } else if (misconfigured) {
      info = rec.status === 'ACTIVE' ? 'Le DNS du domaine ne pointe plus vers le portail.' : null;
    }
    return {
      zoneId,
      nameServers: { set: nameServers },
      status: 'PENDING_VERIFICATION',
      lastError: info,
      attempts: 0,
    };
  }

  // ───────────────────────── Outils ─────────────────────────

  private async loadClient(clientId: number): Promise<ClientRow> {
    const client = await this.prisma.client.findUnique({ where: { id: clientId }, select: CLIENT_SELECT });
    if (!client || client.deletedAt) throw new NotFoundException('Société introuvable.');
    if (client.code === platform.code) {
      throw new BadRequestException('La société système de la plateforme n’a pas de domaine de portail.');
    }
    return client;
  }

  private clientView(c: ClientRow) {
    return {
      id: c.id,
      code: c.code,
      name: c.name,
      isActive: c.isActive,
      logoUrl: c.logoUrl,
      primaryColor: c.primaryColor,
      secondaryColor: c.secondaryColor,
      subscriptionStatus: c.subscriptionStatus,
    };
  }

  private async assertHostFree(clientId: number, plan: DomainPlan): Promise<void> {
    const variants = hostVariants(plan.host);
    const [record, client] = await Promise.all([
      this.prisma.clientPortalDomain.findFirst({
        where: { clientId: { not: clientId }, host: { in: variants } },
        select: { clientId: true },
      }),
      this.prisma.client.findFirst({
        where: {
          id: { not: clientId },
          OR: [
            { customDomain: { in: variants } },
            ...(plan.subdomainLabel ? [{ subdomain: plan.subdomainLabel }] : []),
          ],
        },
        select: { id: true },
      }),
    ]);
    if (record || client) throw new ConflictException(`« ${plan.host} » est déjà attribué à une autre société.`);
  }

  /** Détache les hôtes de Vercel et retire le CNAME d'un sous-domaine. Renvoie les avertissements éventuels. */
  private async detach(rec: ClientPortalDomain): Promise<string[]> {
    const warnings: string[] = [];
    const state = integrationState();
    const { attachHosts, records } = planOfRecord(rec);

    if (state.vercel) {
      for (const h of attachHosts) {
        try {
          await this.vercel.removeDomain(h);
        } catch (err) {
          warnings.push(`« ${h} » n’a pas pu être détaché de Vercel : ${safeMessage(err)}`);
        }
      }
    } else {
      warnings.push('Vercel n’est pas configuré : le domaine reste rattaché au projet, à retirer manuellement.');
    }

    // Les enregistrements d'un domaine propre restent : ils appartiennent à la société, pas à la plateforme.
    if (rec.kind === 'SUBDOMAIN' && rec.zoneId && state.cloudflare) {
      for (const r of records) {
        try {
          await this.cloudflare.deleteRecord(rec.zoneId, r.type, r.name);
        } catch (err) {
          warnings.push(`L’enregistrement DNS « ${r.name} » n’a pas pu être supprimé : ${safeMessage(err)}`);
        }
      }
    }
    return warnings;
  }

  private async audit(userId: string | undefined, clientId: number, action: 'PORTAL_DOMAIN_SET' | 'PORTAL_DOMAIN_REMOVE', details: Record<string, unknown>) {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: userId ?? null,
          clientId,
          action,
          entity: 'ClientPortalDomain',
          entityId: String(clientId),
          details: details as Prisma.InputJsonValue,
          successful: true,
        },
      });
    } catch (err) {
      this.logger.error(`Journal d'audit non écrit (domaine société ${clientId}) : ${safeMessage(err)}`);
    }
  }
}
