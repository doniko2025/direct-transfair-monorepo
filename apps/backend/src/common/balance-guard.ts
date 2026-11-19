// apps/backend/src/common/balance-guard.ts
// =========================================================
// REFUS DE DÉSACTIVER UN COMPTE QUI DÉTIENT DE L'ARGENT (audit argent I5)
// Désactiver une agence, ou une société, met ses portefeuilles hors service : l'argent qu'ils contiennent ne peut alors plus
// bouger — il est bloqué pour de bon (et la réconciliation ne le voit plus). On refuse donc tant qu'un portefeuille a un solde
// ou des fonds réservés non nuls (409, code BALANCE_NOT_EMPTY — le même que pour la suppression d'un utilisateur).
// Pour COUPER L'ACCÈS tout de suite (agent ou agence compromis), on suspend : la suspension ne touche pas aux portefeuilles.
// =========================================================

import { ConflictException } from '@nestjs/common';

export interface WalletLike {
  currency: unknown;
  balance: unknown;
  reservedBalance?: unknown;
}

export interface FundedWallet { currency: string; balance: number; reserved: number }

/** Les portefeuilles qui détiennent de l'argent, regroupés par devise. */
export function fundedByCurrency(wallets: readonly WalletLike[]): FundedWallet[] {
  const map = new Map<string, FundedWallet>();
  for (const w of wallets) {
    const balance = Number(w.balance ?? 0);
    const reserved = Number(w.reservedBalance ?? 0);
    if (balance === 0 && reserved === 0) continue;
    const cur = String(w.currency);
    const e = map.get(cur) ?? { currency: cur, balance: 0, reserved: 0 };
    e.balance = Math.round((e.balance + balance) * 10_000) / 10_000;
    e.reserved = Math.round((e.reserved + reserved) * 10_000) / 10_000;
    map.set(cur, e);
  }
  return [...map.values()].sort((a, b) => a.currency.localeCompare(b.currency));
}

/** Lève une 409 s'il reste de l'argent. `scope` complète la phrase : « L'agence … », « La société … ». */
export function assertNoFunds(wallets: readonly WalletLike[], subject: string, suspendHint: string): void {
  const funded = fundedByCurrency(wallets);
  if (funded.length === 0) return;
  const detail = funded.map((w) => `${w.balance} ${w.currency}${w.reserved ? ` (dont ${w.reserved} réservés)` : ''}`).join(', ');
  throw new ConflictException({
    statusCode: 409,
    code: 'BALANCE_NOT_EMPTY',
    message: `${subject} détient encore de l'argent (${detail}). Videz-le (retrait ou transfert) avant la désactivation. ${suspendHint}`,
    balances: funded,
  });
}
