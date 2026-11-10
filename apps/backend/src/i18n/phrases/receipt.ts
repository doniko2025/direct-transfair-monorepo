// apps/backend/src/i18n/phrases/receipt.ts — libellés du reçu d'envoi (titre, statut, mode de réception, montant mis en avant).
// Source : transactions/transfer-receipt.ts (KIND_TITLE, PAYOUT_LABEL, statusInfo, libellé du montant).
import { registerPhrases, type Phrase } from '../phrase-book';

export const RECEIPT_PHRASES: readonly Phrase[] = [
  // ── type d'opération ──
  ["Envoi d'argent — retrait en agence", 'Money transfer — agency pick-up', 'Envio de dinheiro — levantamento em agência'],
  ['Transfert vers portefeuille', 'Transfer to wallet', 'Transferência para carteira'],
  ['Transfert Mobile Money', 'Mobile Money transfer', 'Transferência Mobile Money'],
  ['Virement bancaire', 'Bank transfer', 'Transferência bancária'],
  ['Dépôt en agence', 'Agency deposit', 'Depósito em agência'],
  ['Retrait', 'Withdrawal', 'Levantamento'],
  ['Opération', 'Transaction', 'Operação'],

  // ── mode de réception ──
  ['Retrait en espèces en agence', 'Cash pick-up at an agency', 'Levantamento em numerário numa agência'],
  ['Crédit sur portefeuille', 'Credit to wallet', 'Crédito na carteira'],
  ['Mobile Money', 'Mobile Money', 'Mobile Money'],
  ['Dépôt bancaire', 'Bank deposit', 'Depósito bancário'],
  ['Crypto-actif', 'Crypto-asset', 'Criptoativo'],

  // ── statut ──
  ['DÉPOSÉ', 'DEPOSITED', 'DEPOSITADO'],
  ['PAYÉ', 'PAID', 'PAGO'],
  ['DISPONIBLE — À RETIRER', 'AVAILABLE — READY FOR PICK-UP', 'DISPONÍVEL — PARA LEVANTAR'],
  ['EN COURS', 'IN PROGRESS', 'EM CURSO'],
  ['EN ATTENTE DE VALIDATION', 'AWAITING VALIDATION', 'A AGUARDAR VALIDAÇÃO'],
  ['EN VÉRIFICATION', 'UNDER REVIEW', 'EM VERIFICAÇÃO'],
  ['ANNULÉ', 'CANCELLED', 'CANCELADO'],
  ['ÉCHOUÉ', 'FAILED', 'FALHADO'],
  ['EXPIRÉ', 'EXPIRED', 'EXPIRADO'],
  ['REMBOURSÉ', 'REFUNDED', 'REEMBOLSADO'],

  // ── montant mis en avant ──
  ['Montant crédité', 'Amount credited', 'Montante creditado'],
  ['Montant déposé', 'Amount deposited', 'Montante depositado'],
  ['Montant payé', 'Amount paid', 'Montante pago'],
  ['Montant à retirer', 'Amount to collect', 'Montante a levantar'],
  ["Montant de l'envoi", 'Transfer amount', 'Montante do envio'],
  ['Montant du transfert', 'Transfer amount', 'Montante da transferência'],
];

registerPhrases(RECEIPT_PHRASES);
