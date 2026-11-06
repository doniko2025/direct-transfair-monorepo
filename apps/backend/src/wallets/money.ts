// apps/backend/src/wallets/money.ts
// =========================================================
// MONEY v1.0 — normalisation d'un montant avant écriture dans un wallet / le journal.
//
// POURQUOI : les colonnes d'argent sont en Decimal(18, 4). Un montant à plus de 4 décimales (ex. 0.00005, venu d'un DTO
// qui n'impose pas maxDecimalPlaces) était écrit tel quel : PostgreSQL arrondit alors CHAQUE colonne séparément. Sur un
// transfert, la ligne débitée et la ligne créditée pouvaient s'arrondir différemment (9.99995 → 10.0000 d'un côté,
// 10.00005 → 10.0001 de l'autre) : de l'argent créé ou perdu, un dix-millième à la fois. Un montant « flottant »
// (0.1 + 0.2 = 0.30000000000000004) était lui aussi stocké avec ses 17 chiffres dans le journal.
//
// RÈGLE : tout montant est arrondi UNE fois, ici, à 4 décimales (demi vers le haut), AVANT d'être utilisé pour le solde ET
// pour le journal : les deux lignes portent exactement la même valeur. Un montant non fini ou qui devient nul après
// arrondi est refusé.
// =========================================================

import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/** Précision des colonnes d'argent (Decimal(18, 4)). */
export const MONEY_DECIMALS = 4;

export function toMoney(amount: number | string | Prisma.Decimal): Prisma.Decimal {
  let value: Prisma.Decimal;
  try {
    value = new Prisma.Decimal(amount as any);
  } catch {
    throw new BadRequestException('Montant invalide');
  }
  if (!value.isFinite()) throw new BadRequestException('Montant invalide');

  const rounded = value.toDecimalPlaces(MONEY_DECIMALS, Prisma.Decimal.ROUND_HALF_UP);
  if (rounded.lte(0)) throw new BadRequestException('Montant invalide');
  return rounded;
}
