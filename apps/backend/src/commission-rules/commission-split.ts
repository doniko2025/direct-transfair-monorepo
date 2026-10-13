// apps/backend/src/commission-rules/commission-split.ts
// =========================================================
// COMMISSION SPLIT v1.0 — calcul pur de la répartition des frais d'un retrait payé.
//
// Règles :
//   - chaque part est arrondie à la précision de la devise (0 décimale XOF/GNF, 2 sinon) ;
//   - la part de la société est le RESTE : payeur + envoi + société = frais, au centime (jamais d'argent
//     créé ni perdu par les arrondis) ;
//   - expéditeur sans agence (client wallet) : la part d'envoi revient à la société ;
//   - agence d'envoi = agence payeuse : la part d'envoi s'ajoute à celle de l'agence payeuse.
// =========================================================

import { roundToCurrency } from '../fee-schedule/fee-engine';
import type { Shares } from './commission-rule-defaults';

export interface SplitInput {
  /** Frais totaux, déjà exprimés dans la devise du paiement. */
  fees: number;
  currency: string;
  shares: Shares;
  /** L'expéditeur n'a pas d'agence (client wallet). */
  senderIsClient: boolean;
  /** L'agence d'envoi est l'agence qui paie. */
  sameAgency: boolean;
}

export interface SplitResult {
  payer: number;
  sender: number;
  platform: number;
}

export function splitFees(input: SplitInput): SplitResult {
  const { fees, currency, shares } = input;
  const total = roundToCurrency(Math.max(0, Number.isFinite(fees) ? fees : 0), currency);
  if (total <= 0) return { payer: 0, sender: 0, platform: 0 };

  const pct = (v: number) => Math.min(100, Math.max(0, Number.isFinite(v) ? v : 0));
  let payer = roundToCurrency((total * pct(shares.payerShare)) / 100, currency);
  let sender = roundToCurrency((total * pct(shares.senderShare)) / 100, currency);

  // Parts incohérentes (somme > 100 en base) : on rogne l'envoi puis le payeur, la société ne devient jamais négative.
  if (payer + sender > total) {
    sender = Math.max(0, roundToCurrency(total - payer, currency));
    payer = Math.min(payer, total);
  }
  let platform = roundToCurrency(total - payer - sender, currency);

  if (input.senderIsClient) {
    platform = roundToCurrency(platform + sender, currency);
    sender = 0;
  } else if (input.sameAgency) {
    payer = roundToCurrency(payer + sender, currency);
    sender = 0;
  }
  return { payer, sender, platform };
}
