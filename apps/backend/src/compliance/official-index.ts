// apps/backend/src/compliance/official-index.ts
// =========================================================
// INDEX EN MÉMOIRE DES LISTES OFFICIELLES (lot 17b)
// Les listes officielles sont GLOBALES (une seule copie en base, partagée par toutes les sociétés qui les activent).
// Chaque liste est chargée une fois dans un NameIndex (blocage par préfixe/suffixe de mot) puis gardée en mémoire quelques minutes :
// filtrer un envoi coûte alors quelques millisecondes, même avec ~17 000 fiches OFAC.
// ⚠️ Le cache est par processus : après une synchronisation, les AUTRES instances voient la nouveauté au plus tard après le TTL.
// =========================================================

import { Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { NameIndex, type NameMatch, type NameSubject, type WatchlistLike } from './name-matching';
import { OFFICIAL_PROVIDERS, type OfficialProvider } from './official-parsers';

type Db = Prisma.TransactionClient;
const logger = new Logger('OfficialIndex');

const TTL_MS = Math.max(30_000, Number(process.env.OFFICIAL_INDEX_TTL_MS) || 10 * 60_000);

interface Cached { at: number; promise: Promise<NameIndex> }
const cache = new Map<OfficialProvider, Cached>();

/** Identifiant d'une correspondance « liste officielle » : sert aussi d'anti-doublon des dossiers clients. */
export const officialEntryId = (rowId: string): string => `OFF:${rowId}`;

export function invalidateOfficialIndex(provider?: OfficialProvider): void {
  if (provider) cache.delete(provider);
  else cache.clear();
}

async function build(db: Db, provider: OfficialProvider): Promise<NameIndex> {
  const rows = await db.officialListEntry.findMany({
    where: { provider, isActive: true },
    select: { id: true, fullName: true, aliases: true, country: true, reference: true },
  });
  const entries: WatchlistLike[] = rows.map((r) => ({
    id: officialEntryId(r.id), kind: 'SANCTION', fullName: r.fullName, aliases: r.aliases, country: r.country, reference: r.reference, source: provider,
  }));
  return new NameIndex(entries);
}

export function getOfficialIndex(db: Db, provider: OfficialProvider): Promise<NameIndex> {
  const hit = cache.get(provider);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.promise;
  const promise = build(db, provider);
  cache.set(provider, { at: Date.now(), promise });
  promise.catch((e: Error) => { cache.delete(provider); logger.warn(`Index ${provider} non construit : ${e.message}`); });
  return promise;
}

export const isProvider = (v: unknown): v is OfficialProvider => typeof v === 'string' && (OFFICIAL_PROVIDERS as readonly string[]).includes(v);

/** Confronte des noms aux listes officielles activées. Ne lève jamais : une liste illisible est ignorée (le reste du filtrage continue). */
export async function matchOfficial(db: Db, providers: readonly string[], subjects: NameSubject[], threshold: number): Promise<NameMatch[]> {
  const out: NameMatch[] = [];
  for (const p of providers.filter(isProvider)) {
    try {
      const index = await getOfficialIndex(db, p);
      if (index.size) out.push(...index.query(subjects, threshold));
    } catch (e) {
      logger.warn(`Liste ${p} ignorée : ${(e as Error).message}`);
    }
  }
  return out.sort((a, b) => b.score - a.score);
}

