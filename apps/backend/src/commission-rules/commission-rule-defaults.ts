// apps/backend/src/commission-rules/commission-rule-defaults.ts
// =========================================================
// Répartition des frais entre l'agence d'envoi, l'agence qui paie et la société.
//
// Lue par withdrawals.service.ts::agentProcessPayment() au moment où un retrait est payé :
//   CommissionConfig { clientId, payoutMethod: null, sourceType, destType }
//     sourceType : d'où part l'argent — WALLET (un client, sans agence), SUBSIDIARY ou PARTNER (agence d'envoi)
//     destType   : agence qui paie le cash — SUBSIDIARY ou PARTNER
//   Sans ligne : 40 % agence payeuse, 20 % agence d'envoi, 40 % société (constantes de withdrawals.service.ts,
//   dupliquées ici — à garder identiques).
//
// Au paiement, deux cas modifient la répartition affichée :
//   - l'expéditeur est un client (WALLET) : il n'a pas d'agence, la part « agence d'envoi » revient à la société ;
//   - l'agence d'envoi est aussi l'agence payeuse : la part « agence d'envoi » s'ajoute à celle de l'agence payeuse.
// =========================================================

export const SOURCE_TYPES = ['WALLET', 'SUBSIDIARY', 'PARTNER'] as const;
export const DEST_TYPES = ['SUBSIDIARY', 'PARTNER'] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];
export type DestType = (typeof DEST_TYPES)[number];

export const DEFAULT_PAYER_SHARE = 40;
export const DEFAULT_SENDER_SHARE = 20;
export const DEFAULT_PLATFORM_SHARE = 40;

export interface Shares {
  senderShare: number;
  payerShare: number;
  platformShare: number;
}

/** Parts réellement perçues par chacun quand l'expéditeur est un client : la part d'envoi va à la société. */
export function effectiveShares(source: string, s: Shares): Shares {
  if (source !== 'WALLET') return s;
  return { senderShare: 0, payerShare: s.payerShare, platformShare: s.platformShare + s.senderShare };
}

export const defaultShares = (): Shares => ({
  senderShare: DEFAULT_SENDER_SHARE,
  payerShare: DEFAULT_PAYER_SHARE,
  platformShare: DEFAULT_PLATFORM_SHARE,
});
