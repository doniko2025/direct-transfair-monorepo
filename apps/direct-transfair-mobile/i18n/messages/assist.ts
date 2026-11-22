// apps/direct-transfair-mobile/i18n/messages/assist.ts
// Petits « coups de pouce » autour de l'envoi : message WhatsApp du code de retrait, chronologie du suivi, « Renvoyer »,
// erreurs qui proposent une action. { fr, en, pt }
import type { Trio } from '../core';

export const assist = {
  // ── Message WhatsApp avec le code de retrait ──
  'wa.button':   { fr: 'WhatsApp', en: 'WhatsApp', pt: 'WhatsApp' },
  'wa.a11y':     { fr: 'Envoyer le code de retrait par WhatsApp', en: 'Send the pickup code on WhatsApp', pt: 'Enviar o código de levantamento por WhatsApp' },
  'wa.msg': {
    fr: "Bonjour {name} 👋\n{sender} vous a envoyé {amount} avec {brand}.\n\nCode de retrait : {code}\n\nPrésentez-vous dans une agence avec une pièce d'identité et ce code. Ne le partagez avec personne d'autre.",
    en: "Hello {name} 👋\n{sender} sent you {amount} with {brand}.\n\nPickup code: {code}\n\nGo to an agency with an ID document and this code. Do not share it with anyone else.",
    pt: "Olá {name} 👋\n{sender} enviou-lhe {amount} com {brand}.\n\nCódigo de levantamento: {code}\n\nDirija-se a uma agência com um documento de identidade e este código. Não o partilhe com mais ninguém.",
  },

  // ── Chronologie du suivi ──
  'trk.title':       { fr: 'Suivi de votre envoi', en: 'Tracking your transfer', pt: 'Acompanhamento do envio' },
  'trk.s.sent':      { fr: 'Enregistré', en: 'Registered', pt: 'Registado' },
  'trk.s.validated': { fr: 'Validé', en: 'Validated', pt: 'Validado' },
  'trk.s.ready':     { fr: 'À retirer', en: 'Ready', pt: 'Disponível' },
  'trk.s.paid':      { fr: 'Payé', en: 'Paid', pt: 'Pago' },
  'trk.s.processing':{ fr: 'En cours', en: 'In progress', pt: 'Em curso' },
  'trk.s.sentOut':   { fr: 'Versé', en: 'Paid out', pt: 'Creditado' },
  'trk.s.received':  { fr: 'Reçu', en: 'Received', pt: 'Recebido' },
  'trk.f.CANCELLED': { fr: 'Annulé', en: 'Cancelled', pt: 'Cancelado' },
  'trk.f.FAILED':    { fr: 'Échoué', en: 'Failed', pt: 'Falhado' },
  'trk.f.EXPIRED':   { fr: 'Expiré', en: 'Expired', pt: 'Expirado' },
  'trk.f.REFUNDED':  { fr: 'Remboursé', en: 'Refunded', pt: 'Reembolsado' },
  'trk.h.pending':   { fr: 'Votre envoi est en cours de validation.', en: 'Your transfer is being validated.', pt: 'O seu envio está a ser validado.' },
  'trk.h.ready':     { fr: 'Le code est prêt : {name} peut retirer l\'argent en agence.', en: 'The code is ready: {name} can collect the money at an agency.', pt: 'O código está pronto: {name} pode levantar o dinheiro numa agência.' },
  'trk.h.processing':{ fr: 'Le versement est en cours.', en: 'The payout is in progress.', pt: 'O pagamento está em curso.' },
  'trk.h.paid':      { fr: 'L\'argent a bien été remis à {name}.', en: 'The money was handed to {name}.', pt: 'O dinheiro foi entregue a {name}.' },
  'trk.h.received':  { fr: '{name} a reçu l\'argent.', en: '{name} received the money.', pt: '{name} recebeu o dinheiro.' },
  'trk.h.CANCELLED': { fr: 'Envoi annulé : vous avez été remboursé.', en: 'Transfer cancelled: you have been refunded.', pt: 'Envio cancelado: foi reembolsado.' },
  'trk.h.FAILED':    { fr: 'L\'envoi a échoué : vous avez été remboursé.', en: 'The transfer failed: you have been refunded.', pt: 'O envio falhou: foi reembolsado.' },
  'trk.h.EXPIRED':   { fr: 'Le code n\'a pas été retiré à temps : vous avez été remboursé.', en: 'The code was not collected in time: you have been refunded.', pt: 'O código não foi levantado a tempo: foi reembolsado.' },
  'trk.h.REFUNDED':  { fr: 'Envoi remboursé sur votre compte.', en: 'Transfer refunded to your account.', pt: 'Envio reembolsado na sua conta.' },

  // ── Renvoyer en un geste ──
  'rep.chip':   { fr: 'Renvoyer {amount} à {name}', en: 'Send {amount} to {name} again', pt: 'Reenviar {amount} a {name}' },
  'rep.chipSub':{ fr: 'Même destinataire, même montant', en: 'Same recipient, same amount', pt: 'Mesmo destinatário, mesmo montante' },
  'rep.button': { fr: 'Renvoyer', en: 'Send again', pt: 'Reenviar' },

  // ── Erreurs qui proposent une action ──
  'err.limitTitle':   { fr: 'Plafond atteint', en: 'Limit reached', pt: 'Limite atingido' },
  'err.limitKyc':     { fr: 'Voir ma vérification', en: 'See my verification', pt: 'Ver a minha verificação' },
  'err.limitMax':     { fr: 'Envoyer {amount}', en: 'Send {amount}', pt: 'Enviar {amount}' },
  'err.balanceTitle': { fr: 'Solde insuffisant', en: 'Insufficient balance', pt: 'Saldo insuficiente' },
  'err.topUp':        { fr: 'Recharger', en: 'Top up', pt: 'Carregar' },
  'err.rateTitle':    { fr: 'Taux indisponible', en: 'Rate unavailable', pt: 'Taxa indisponível' },
  'err.rateMsg':      { fr: 'Le taux de change n\'est pas disponible pour le moment. Réessayez dans quelques instants : rien n\'a été débité.', en: 'The exchange rate is not available right now. Try again in a moment: nothing was debited.', pt: 'A taxa de câmbio não está disponível neste momento. Tente novamente dentro de instantes: nada foi debitado.' },
  'err.offlineTitle': { fr: 'Connexion perdue', en: 'Connection lost', pt: 'Ligação perdida' },
  'err.offlineMsg':   { fr: 'Vérifiez votre connexion puis réessayez. En cas de doute, consultez d\'abord votre historique avant de renvoyer.', en: 'Check your connection and try again. If in doubt, check your history before sending again.', pt: 'Verifique a sua ligação e tente novamente. Em caso de dúvida, consulte primeiro o seu histórico antes de reenviar.' },
  'err.retry':        { fr: 'Réessayer', en: 'Try again', pt: 'Tentar novamente' },
} as const satisfies Record<string, Trio>;
