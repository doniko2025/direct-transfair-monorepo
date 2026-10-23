// apps/backend/src/transactions/idempotency.ts
// =========================================================
// IDEMPOTENCE v1.0 — Direct Transf'air (audit point 3)
//
// Un double-tap, ou une coupure réseau suivie d'un nouvel essai, ne doit pas créer un second débit.
// Le client envoie l'en-tête `Idempotency-Key` (une valeur unique par intention : un UUID généré à l'ouverture de
// l'écran / au premier appui, réutilisé tel quel par les nouveaux essais). Côté serveur :
//   1. avant tout mouvement d'argent : une opération de CET utilisateur avec la même clé existe déjà → on la renvoie ;
//   2. à la création : la clé est enregistrée sur la Transaction (index unique (senderId, idempotencyKey)). Deux
//      requêtes simultanées avec la même clé : la seconde est refusée par la base, sa transaction SQL est annulée
//      (aucun débit) et on renvoie l'opération de la première ;
//   3. même clé mais autre opération (montant, devise ou type différents) → 409, jamais un résultat trompeur.
// Sans en-tête, le comportement est inchangé (anciens clients).
// =========================================================

import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma, Transaction, TransactionType } from '@prisma/client';

export const IDEMPOTENCY_HEADER = 'idempotency-key';

const KEY_PATTERN = /^[A-Za-z0-9_\-:.]{8,128}$/;

/** Lit et valide la valeur brute de l'en-tête. null = pas d'en-tête (comportement historique). */
export function parseIdempotencyKey(raw: unknown): string | null {
  if (raw === undefined || raw === null) return null;
  const value = Array.isArray(raw) ? String(raw[0] ?? '') : String(raw);
  const key = value.trim();
  if (!key) return null;
  if (!KEY_PATTERN.test(key)) {
    throw new BadRequestException(
      'Idempotency-Key invalide : 8 à 128 caractères (lettres, chiffres, - _ : .).',
    );
  }
  return key;
}

/** Erreur d'unicité Prisma (P2002) portant sur la clé d'idempotence ? */
export function isIdempotencyConflict(e: unknown): boolean {
  const err = e as { code?: string; meta?: { target?: unknown } };
  if (err?.code !== 'P2002') return false;
  const target = err.meta?.target;
  const names = Array.isArray(target) ? target.map(String) : [String(target ?? '')];
  return names.some((n) => n.includes('idempotencyKey'));
}

/** Ce que l'opération rejouée doit être : sinon la clé a été réutilisée pour autre chose. */
export interface IdempotencyExpectation {
  type: TransactionType;
  amount: number;
  /** Absente quand la devise est dérivée côté serveur (ex. caisse de l'agence pour un dépôt) : non comparée. */
  currency?: string;
}

/** Opération déjà créée par `senderId` avec cette clé, ou null. Lève 409 si elle ne correspond pas à la demande. */
export async function findIdempotent(
  db: Pick<Prisma.TransactionClient, 'transaction'>,
  senderId: string,
  key: string,
  expected: IdempotencyExpectation,
): Promise<Transaction | null> {
  const existing = await db.transaction.findFirst({ where: { senderId, idempotencyKey: key } });
  if (!existing) return null;
  if (
    existing.type !== expected.type ||
    (expected.currency !== undefined && existing.currency !== expected.currency) ||
    Number(existing.amount) !== Number(expected.amount)
  ) {
    throw new ConflictException(
      'Cette Idempotency-Key a déjà servi pour une autre opération : utilisez une nouvelle clé.',
    );
  }
  return existing;
}
