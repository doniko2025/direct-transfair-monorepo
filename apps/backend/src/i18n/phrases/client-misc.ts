// apps/backend/src/i18n/phrases/client-misc.ts — paiements, cartes, recharge, support, retraits : messages d'erreur vus par le client.
import { registerPhrases, type Phrase } from '../phrase-book';

export const CLIENT_MISC_PHRASES: readonly Phrase[] = [
  // ── paiements / cartes / recharge ──
  ['Transaction introuvable ou non VALIDATED', 'Transaction not found or not VALIDATED', 'Transação não encontrada ou não VALIDADA'],
  ['Vous ne pouvez pas enregistrer plus de {1} cartes.', 'You cannot save more than {1} cards.', 'Não pode guardar mais de {1} cartões.'],
  ['Carte introuvable', 'Card not found', 'Cartão não encontrado'],
  ['Provider non supporté', 'Unsupported provider', 'Fornecedor não suportado'],
  ["Le paiement d'un envoi se fait en agence : cette opération n'est pas disponible.", 'A transfer is paid at an agency: this operation is not available.', 'O pagamento de um envio faz-se numa agência: esta operação não está disponível.'],
  ['transactionId manquant', 'Missing transactionId', 'transactionId em falta'],
  ['Transaction does not belong to this user', 'This transaction does not belong to this user', 'Esta transação não pertence a este utilizador'],
  ['Paiement interdit: transaction CANCELLED', 'Payment not allowed: transaction CANCELLED', 'Pagamento não permitido: transação CANCELADA'],
  ['Paiement interdit: transaction status={1} (attendu: VALIDATED)', 'Payment not allowed: transaction status={1} (expected: VALIDATED)', 'Pagamento não permitido: estado da transação={1} (esperado: VALIDATED)'],
  ['paymentMethod/method manquant', 'Missing paymentMethod/method', 'paymentMethod/method em falta'],
  ['Unsupported payment method', 'Unsupported payment method', 'Método de pagamento não suportado'],
  ['transactionId invalide', 'Invalid transactionId', 'transactionId inválido'],
  ['Paiement wallet interdit (transaction non VALIDATED ou introuvable)', 'Wallet payment not allowed (transaction not VALIDATED or not found)', 'Pagamento com carteira não permitido (transação não VALIDADA ou não encontrada)'],
  ['Paiement interdit (transaction non VALIDATED ou introuvable)', 'Payment not allowed (transaction not VALIDATED or not found)', 'Pagamento não permitido (transação não VALIDADA ou não encontrada)'],
  ["La recharge du wallet n'est pas encore disponible.", 'Wallet top-up is not available yet.', 'O carregamento da carteira ainda não está disponível.'],
  ["Ce moyen de recharge n'est pas ouvert par votre société.", 'This top-up method is not enabled by your company.', 'Este meio de carregamento não está ativo na sua empresa.'],
  ['Recharge introuvable', 'Top-up not found', 'Carregamento não encontrado'],
  ['Utilisateur sans société associée', 'User without an associated company', 'Utilizador sem empresa associada'],

  // ── support ──
  ["Vous avez déjà {1} demandes en cours. Attendez une réponse avant d'en ouvrir une nouvelle.", 'You already have {1} open requests. Wait for a reply before opening a new one.', 'Já tem {1} pedidos em curso. Aguarde uma resposta antes de abrir um novo.'],
  ['Un litige est déjà en cours sur cette opération.', 'A dispute is already open on this operation.', 'Já existe um litígio em curso nesta operação.'],
  ['Cette demande est clôturée. Ouvrez-en une nouvelle si besoin.', 'This request is closed. Open a new one if needed.', 'Este pedido está encerrado. Abra um novo, se necessário.'],
  ['Cette demande est déjà traitée.', 'This request has already been processed.', 'Este pedido já foi tratado.'],
  ['Cette demande est clôturée.', 'This request is closed.', 'Este pedido está encerrado.'],
  ['Une demande sans opération se clôture avec la décision « INFO ».', 'A request without an operation is closed with the decision “INFO”.', 'Um pedido sem operação é encerrado com a decisão «INFO».'],
  ['Un litige se règle (décision motivée) avant d\'être clos.', 'A dispute is settled (reasoned decision) before being closed.', 'Um litígio é resolvido (decisão fundamentada) antes de ser encerrado.'],

  // ── retraits (côté client / code de retrait) ──
  ['Reçu non reconnu : le QR code ne correspond à aucun envoi de cette société. Ne payez pas.', 'Receipt not recognised: the QR code does not match any transfer of this company. Do not pay.', 'Recibo não reconhecido: o código QR não corresponde a nenhum envio desta empresa. Não pague.'],
  ['Code requis', 'Code required', 'Código obrigatório'],
  ['Code invalide ou introuvable.', 'Invalid or unknown code.', 'Código inválido ou não encontrado.'],
  ['Retrait {1} : ce code ne peut plus être payé.', 'Withdrawal {1}: this code can no longer be paid.', 'Levantamento {1}: este código já não pode ser pago.'],
  ["Ce code a expiré : l'envoi est annulé et l'expéditeur est remboursé automatiquement.", 'This code has expired: the transfer is cancelled and the sender is refunded automatically.', 'Este código expirou: o envio foi cancelado e o remetente é reembolsado automaticamente.'],
  ['Code introuvable', 'Code not found', 'Código não encontrado'],
  ['Code déjà payé.', 'Code already paid.', 'Código já pago.'],
  ['Transaction annulée.', 'Transaction cancelled.', 'Transação cancelada.'],
  ["Ce code a expiré : l'envoi est annulé et l'expéditeur est remboursé.", 'This code has expired: the transfer is cancelled and the sender is refunded.', 'Este código expirou: o envio foi cancelado e o remetente foi reembolsado.'],
  ['Statut invalide: {1}', 'Invalid status: {1}', 'Estado inválido: {1}'],
  ['Wallet agence {1} introuvable.', 'Agency wallet {1} not found.', 'Carteira da agência {1} não encontrada.'],
  ['Taux de change {1} → {2} indisponible : le retrait ne peut pas être payé pour le moment. Réessayez dans quelques instants.', 'Exchange rate {1} → {2} unavailable: the withdrawal cannot be paid right now. Try again in a few moments.', 'Taxa de câmbio {1} → {2} indisponível: o levantamento não pode ser pago neste momento. Tente novamente dentro de instantes.'],
  ['Retrait introuvable', 'Withdrawal not found', 'Levantamento não encontrado'],
  ["Ce retrait est déjà « {1} » : son statut n'est plus modifiable.", 'This withdrawal is already “{1}”: its status can no longer be changed.', 'Este levantamento já está «{1}»: o estado já não pode ser alterado.'],
  ["Ce retrait vient d'être modifié par un autre utilisateur. Rechargez la page.", 'This withdrawal has just been modified by another user. Reload the page.', 'Este levantamento acabou de ser alterado por outro utilizador. Recarregue a página.'],
];

registerPhrases(CLIENT_MISC_PHRASES);
