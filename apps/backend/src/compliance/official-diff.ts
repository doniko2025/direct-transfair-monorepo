// apps/backend/src/compliance/official-diff.ts
// =========================================================
// COMPARAISON « fichier téléchargé » ↔ « base » (lot 17b) — fonction pure.
// Ne touche que ce qui a changé : une mise à jour quotidienne de l'OFAC (≈ 17 000 fiches) n'écrit que quelques dizaines de lignes.
// Une fiche absente du fichier est DÉSACTIVÉE (jamais supprimée : l'historique des dossiers reste lisible) ; si elle revient, elle est réactivée.
// =========================================================

import type { OfficialEntryInput } from './official-parsers';

export interface ExistingOfficial {
  id: string;
  externalId: string;
  fullName: string;
  aliases: string[];
  country: string | null;
  birthYear: number | null;
  reference: string | null;
  programs: string[];
  isActive: boolean;
}

export interface OfficialDiff {
  toCreate: OfficialEntryInput[];
  toUpdate: Array<{ id: string; data: OfficialEntryInput }>;
  /** ids à désactiver (retirées de la liste officielle). */
  toDeactivate: string[];
  unchanged: number;
}

const sig = (e: Pick<OfficialEntryInput, 'fullName' | 'aliases' | 'country' | 'birthYear' | 'reference' | 'programs'>): string =>
  JSON.stringify([e.fullName, [...e.aliases].sort(), e.country ?? null, e.birthYear ?? null, e.reference ?? null, [...e.programs].sort()]);

export function diffOfficial(existing: ExistingOfficial[], incoming: OfficialEntryInput[]): OfficialDiff {
  const byExt = new Map(existing.map((e) => [e.externalId, e]));
  const seen = new Set<string>();
  const diff: OfficialDiff = { toCreate: [], toUpdate: [], toDeactivate: [], unchanged: 0 };

  for (const e of incoming) {
    if (seen.has(e.externalId)) continue; // doublon dans le fichier : la première occurrence l'emporte
    seen.add(e.externalId);
    const cur = byExt.get(e.externalId);
    if (!cur) diff.toCreate.push(e);
    else if (!cur.isActive || sig(cur) !== sig(e)) diff.toUpdate.push({ id: cur.id, data: e });
    else diff.unchanged++;
  }
  for (const cur of existing) if (cur.isActive && !seen.has(cur.externalId)) diff.toDeactivate.push(cur.id);
  return diff;
}

/** Garde-fou : un fichier vide ou amputé (panne, page d'erreur, format modifié) ne doit JAMAIS vider la liste. */
export function sanityError(previousActive: number, incomingCount: number): string | null {
  if (incomingCount === 0) return 'Aucune fiche lisible dans le fichier téléchargé (format modifié ou page d’erreur).';
  if (previousActive >= 50 && incomingCount < previousActive * 0.5) {
    return `Le fichier ne contient que ${incomingCount} fiche(s) contre ${previousActive} actuellement : mise à jour refusée par prudence.`;
  }
  return null;
}
