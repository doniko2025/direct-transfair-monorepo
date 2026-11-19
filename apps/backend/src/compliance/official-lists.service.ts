// apps/backend/src/compliance/official-lists.service.ts
// =========================================================
// SYNCHRONISATION DES LISTES OFFICIELLES (lot 17b) : ONU · OFAC · UE
//   • téléchargement https borné (délai, taille, redirections https seulement) ;
//   • empreinte SHA-256 : fichier identique à la veille = rien à faire ;
//   • garde-fou : un fichier vide ou amputé de moitié est REFUSÉ, la liste en place reste intacte ;
//   • mise à jour différentielle (créer / modifier / désactiver) — jamais de suppression ;
//   • après chaque changement : l'index mémoire est invalidé, et la clientèle des sociétés qui ont activé la liste est re-contrôlée.
// Adresses : variables d'environnement (voir .env.example) ; l'UE n'a pas d'adresse par défaut (jeton personnel).
// =========================================================

import { createHash } from 'node:crypto';

import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { notifyAdmins, screenCustomerBase } from './compliance.core';
import { diffOfficial, sanityError, type ExistingOfficial } from './official-diff';
import { invalidateOfficialIndex } from './official-index';
import { OFFICIAL_PROVIDERS, parseEuXml, parseOfacCsv, parseUnXml, type OfficialEntryInput, type OfficialProvider } from './official-parsers';

export const PROVIDER_LABEL: Record<OfficialProvider, string> = {
  UN: 'ONU — Conseil de sécurité (liste consolidée)',
  OFAC: 'États-Unis — OFAC (liste SDN)',
  EU: 'Union européenne — sanctions financières',
};

const FETCH_TIMEOUT_MS = 90_000;
const MAX_BYTES = 150 * 1024 * 1024;
/** Une liste non rafraîchie depuis plus longtemps est signalée « périmée ». */
export const STALE_AFTER_MS = 72 * 3600_000;
/** Délai minimal entre deux actualisations demandées à la main (la liste est partagée par toutes les sociétés). */
export const MANUAL_COOLDOWN_MS = 10 * 60_000;

export interface ProviderSources { provider: OfficialProvider; urls: string[] }

export function providerSources(env: NodeJS.ProcessEnv = process.env): Record<OfficialProvider, string[]> {
  const pick = (v: string | undefined) => (v && v.trim() ? [v.trim()] : []);
  return {
    UN: pick(env.OFFICIAL_LIST_UN_URL).length ? pick(env.OFFICIAL_LIST_UN_URL) : ['https://scsanctions.un.org/resources/xml/en/consolidated.xml'],
    OFAC: [
      pick(env.OFFICIAL_LIST_OFAC_SDN_URL)[0] ?? 'https://www.treasury.gov/ofac/downloads/sdn.csv',
      pick(env.OFFICIAL_LIST_OFAC_ALT_URL)[0] ?? 'https://www.treasury.gov/ofac/downloads/alt.csv',
    ],
    EU: pick(env.OFFICIAL_LIST_EU_URL),
  };
}

export const isConfigured = (p: OfficialProvider, env: NodeJS.ProcessEnv = process.env): boolean => providerSources(env)[p].length > 0;

/** Télécharge un texte en https, avec délai et plafond de taille. Ne suit que des redirections https. */
export async function fetchText(url: string): Promise<string> {
  if (!/^https:\/\//i.test(url) && String(process.env.OFFICIAL_LISTS_ALLOW_HTTP).toLowerCase() !== 'true') throw new Error('Adresse non sécurisée (https obligatoire).');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal, redirect: 'follow', headers: { 'User-Agent': 'DirectTransfair-Compliance/1.0', Accept: '*/*' } });
    if (res.url && !/^https:\/\//i.test(res.url) && String(process.env.OFFICIAL_LISTS_ALLOW_HTTP).toLowerCase() !== 'true') throw new Error('Redirection vers une adresse non sécurisée.');
    if (!res.ok) throw new Error(`Réponse ${res.status} du serveur.`);
    const declared = Number(res.headers.get('content-length') ?? 0);
    if (declared > MAX_BYTES) throw new Error('Fichier trop volumineux.');
    if (!res.body) throw new Error('Réponse vide.');
    const chunks: Uint8Array[] = [];
    let total = 0;
    const reader = res.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BYTES) { ctrl.abort(); throw new Error('Fichier trop volumineux.'); }
      chunks.push(value);
    }
    return Buffer.concat(chunks).toString('utf8');
  } finally {
    clearTimeout(timer);
  }
}

const sha = (s: string): string => createHash('sha256').update(s).digest('hex');
const chunk = <T>(a: T[], n: number): T[][] => { const out: T[][] = []; for (let i = 0; i < a.length; i += n) out.push(a.slice(i, i + n)); return out; };

export interface SyncResult {
  provider: OfficialProvider;
  status: 'OK' | 'UNCHANGED' | 'ERROR' | 'SKIPPED';
  error?: string;
  entryCount?: number;
  added?: number;
  updated?: number;
  removed?: number;
}

@Injectable()
export class OfficialListsService {
  private readonly logger = new Logger(OfficialListsService.name);
  private readonly running = new Set<OfficialProvider>();

  constructor(private readonly prisma: PrismaService) {}

  isRunning(p: OfficialProvider): boolean { return this.running.has(p); }

  /** Fiches lisibles d'un fichier téléchargé (pur, testable sans réseau via `parse`). */
  parse(provider: OfficialProvider, texts: string[]): OfficialEntryInput[] {
    if (provider === 'UN') return parseUnXml(texts[0] ?? '');
    if (provider === 'OFAC') return parseOfacCsv(texts[0] ?? '', texts[1] ?? '');
    return parseEuXml(texts[0] ?? '');
  }

  async sync(provider: OfficialProvider, opts: { force?: boolean } = {}): Promise<SyncResult> {
    if (this.running.has(provider)) return { provider, status: 'SKIPPED', error: 'Synchronisation déjà en cours.' };
    const urls = providerSources()[provider];
    if (!urls.length) return { provider, status: 'SKIPPED', error: 'Aucune adresse configurée pour cette liste.' };
    this.running.add(provider);
    const now = new Date();
    try {
      await this.prisma.officialListSync.upsert({
        where: { provider }, create: { provider, sourceUrl: urls[0], status: 'RUNNING', lastRunAt: now }, update: { status: 'RUNNING', lastRunAt: now, sourceUrl: urls[0] },
      });
      const previous = await this.prisma.officialListSync.findUnique({ where: { provider } });

      const texts: string[] = [];
      for (const u of urls) {
        try { texts.push(await fetchText(u)); } catch (e) {
          // L'alias OFAC (alt.csv) est facultatif : sans lui on garde les noms principaux. Tout le reste est obligatoire.
          if (provider === 'OFAC' && u === urls[1]) { this.logger.warn(`alt.csv OFAC indisponible : ${(e as Error).message}`); texts.push(''); } else throw e;
        }
      }
      const hash = sha(texts.join('\n---\n'));
      if (!opts.force && previous?.contentHash === hash && previous.entryCount > 0) {
        await this.prisma.officialListSync.update({ where: { provider }, data: { status: 'OK', error: null, lastSuccessAt: now } });
        return { provider, status: 'UNCHANGED', entryCount: previous.entryCount };
      }

      const incoming = this.parse(provider, texts);
      const existing: ExistingOfficial[] = await this.prisma.officialListEntry.findMany({
        where: { provider }, select: { id: true, externalId: true, fullName: true, aliases: true, country: true, birthYear: true, reference: true, programs: true, isActive: true },
      });
      const activeBefore = existing.filter((e) => e.isActive).length;
      const refused = sanityError(activeBefore, incoming.length);
      if (refused) throw new Error(refused);

      const diff = diffOfficial(existing, incoming);
      for (const part of chunk(diff.toCreate, 1000)) {
        await this.prisma.officialListEntry.createMany({ data: part.map((e) => ({ ...e, isActive: true })), skipDuplicates: true });
      }
      for (const part of chunk(diff.toUpdate, 100)) {
        await this.prisma.$transaction(part.map((u) => this.prisma.officialListEntry.update({ where: { id: u.id }, data: { ...u.data, isActive: true } })));
      }
      for (const part of chunk(diff.toDeactivate, 1000)) {
        await this.prisma.officialListEntry.updateMany({ where: { id: { in: part } }, data: { isActive: false } });
      }

      const entryCount = incoming.length;
      await this.prisma.officialListSync.update({
        where: { provider },
        data: { status: 'OK', error: null, lastSuccessAt: new Date(), entryCount, added: diff.toCreate.length, updated: diff.toUpdate.length, removed: diff.toDeactivate.length, contentHash: hash },
      });
      invalidateOfficialIndex(provider);
      this.logger.log(`📜 Liste ${provider} : ${entryCount} fiche(s) — +${diff.toCreate.length} · ~${diff.toUpdate.length} · −${diff.toDeactivate.length}`);

      if (diff.toCreate.length + diff.toUpdate.length > 0) void this.rescreenCompanies(provider);
      return { provider, status: 'OK', entryCount, added: diff.toCreate.length, updated: diff.toUpdate.length, removed: diff.toDeactivate.length };
    } catch (err) {
      const message = (err as Error).message || 'Erreur inconnue';
      this.logger.error(`Liste ${provider} non mise à jour : ${message}`);
      await this.prisma.officialListSync.update({ where: { provider }, data: { status: 'ERROR', error: message.slice(0, 500) } }).catch(() => undefined);
      return { provider, status: 'ERROR', error: message };
    } finally {
      this.running.delete(provider);
    }
  }

  /** Sociétés qui ont activé cette liste (et dont le filtrage est actif). */
  async companiesUsing(provider: OfficialProvider): Promise<number[]> {
    const rows = await this.prisma.complianceSettings.findMany({ where: { officialLists: { has: provider }, sanctionsEnabled: true }, select: { clientId: true } });
    return rows.map((r) => r.clientId);
  }

  /** Re-contrôle la clientèle de chaque société utilisatrice ; ne prévient que s'il y a de NOUVEAUX dossiers. Ne lève jamais. */
  async rescreenCompanies(provider: OfficialProvider): Promise<void> {
    try {
      for (const clientId of await this.companiesUsing(provider)) {
        const r = await screenCustomerBase(this.prisma, clientId);
        if (r.cases > 0) {
          await notifyAdmins(this.prisma, clientId, `⚠️ Liste ${provider} mise à jour`,
            `${r.cases} nouveau(x) dossier(s) client après la mise à jour de la liste officielle ${provider}. Ouvrez la conformité pour les examiner.`,
            { kind: 'OFFICIAL_LIST_MATCH', provider, cases: r.cases });
        }
      }
    } catch (err) {
      this.logger.error(`Contrôle de la clientèle après mise à jour (${provider}) : ${(err as Error).message}`);
    }
  }

  /** Tâche quotidienne : ne télécharge que les listes activées par au moins une société. */
  async syncAllInUse(): Promise<SyncResult[]> {
    const out: SyncResult[] = [];
    for (const provider of OFFICIAL_PROVIDERS) {
      const companies = await this.companiesUsing(provider);
      if (!companies.length) continue;
      const r = await this.sync(provider);
      out.push(r);
      if (r.status === 'ERROR') await this.warnIfStale(provider, companies, r.error ?? '');
    }
    return out;
  }

  /** Une liste de sanctions qui ne se met plus à jour est un risque de conformité : on prévient les administrateurs concernés. */
  private async warnIfStale(provider: OfficialProvider, companies: number[], error: string): Promise<void> {
    const row = await this.prisma.officialListSync.findUnique({ where: { provider } });
    const age = row?.lastSuccessAt ? Date.now() - row.lastSuccessAt.getTime() : Infinity;
    if (age < STALE_AFTER_MS) return;
    for (const clientId of companies) {
      await notifyAdmins(this.prisma, clientId, `🚨 Liste ${provider} non à jour`,
        `La liste officielle ${provider} n'a pas pu être actualisée depuis plus de 3 jours (${error.slice(0, 120)}). Vos contrôles utilisent une version ancienne.`,
        { kind: 'OFFICIAL_LIST_STALE', provider });
    }
  }

  /** Vue pour l'écran : état de chaque liste + activation pour la société. */
  async overview(enabled: string[]) {
    const [syncs, counts] = await Promise.all([
      this.prisma.officialListSync.findMany(),
      this.prisma.officialListEntry.groupBy({ by: ['provider'], where: { isActive: true }, _count: { _all: true } }),
    ]);
    return OFFICIAL_PROVIDERS.map((provider) => {
      const s = syncs.find((x) => x.provider === provider);
      const entryCount = counts.find((c) => c.provider === provider)?._count._all ?? 0;
      const last = s?.lastSuccessAt ?? null;
      return {
        provider, label: PROVIDER_LABEL[provider], configured: isConfigured(provider), enabled: enabled.includes(provider),
        status: this.running.has(provider) ? 'RUNNING' : (s?.status ?? 'NEVER'), error: s?.error ?? null,
        entryCount, lastRunAt: s?.lastRunAt ?? null, lastSuccessAt: last,
        added: s?.added ?? 0, updated: s?.updated ?? 0, removed: s?.removed ?? 0,
        stale: entryCount > 0 && (!last || Date.now() - last.getTime() > STALE_AFTER_MS),
      };
    });
  }
}

