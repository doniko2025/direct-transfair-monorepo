// apps/direct-transfair-mobile/i18n/messages/growth.ts
// Textes du lot 16 (croissance) : taux garanti à l'envoi, demandes d'argent, parrainage. Chaque clé : { fr, en, pt }.
import type { Trio } from '../core';

export const growth = {
  // ── Taux garanti (écran d'envoi) ──
  'grw.rate.title':        { fr: 'Taux garanti', en: 'Guaranteed rate', pt: 'Taxa garantida' },
  'grw.rate.left':         { fr: 'Garanti encore {time}', en: 'Guaranteed for {time} more', pt: 'Garantida por mais {time}' },
  'grw.rate.waiting':      { fr: 'Verrouillage du taux…', en: 'Locking the rate…', pt: 'A bloquear a taxa…' },
  'grw.rate.updated':      { fr: 'Taux actualisé : {name} recevra {amount}.', en: 'Rate updated: {name} will receive {amount}.', pt: 'Taxa atualizada: {name} receberá {amount}.' },
  'grw.rate.expiredRetry': { fr: 'Le taux garanti a expiré. Un nouveau taux est affiché : vérifiez-le puis confirmez.', en: 'The guaranteed rate expired. A new rate is shown: check it, then confirm.', pt: 'A taxa garantida expirou. Mostramos uma nova taxa: verifique-a e confirme.' },
  'grw.rate.hint':         { fr: 'Le montant reçu ne changera pas tant que le décompte court.', en: 'The received amount will not change while the countdown runs.', pt: 'O montante recebido não muda enquanto a contagem decorre.' },

  // ── Envoi sans frais (parrainage) ──
  'grw.free.notice':       { fr: 'Parrainage : cet envoi est sans frais.', en: 'Referral: this transfer is free of fees.', pt: 'Apadrinhamento: este envio é sem taxas.' },
  'grw.free.left':         { fr: '1 envoi sans frais restant|{count} envois sans frais restants', en: '1 free transfer left|{count} free transfers left', pt: '1 envio sem taxas restante|{count} envios sem taxas restantes' },

  // ── Demandes d'argent ──
  'grw.mr.entry':          { fr: 'Demander de l’argent', en: 'Request money', pt: 'Pedir dinheiro' },
  'grw.mr.entrySub':       { fr: 'Un proche vous doit ? Envoyez-lui une demande.', en: 'Someone owes you? Send them a request.', pt: 'Alguém lhe deve? Envie um pedido.' },
  'grw.mr.entryPending':   { fr: '1 demande à régler|{count} demandes à régler', en: '1 request to pay|{count} requests to pay', pt: '1 pedido por pagar|{count} pedidos por pagar' },
  'grw.mr.title':          { fr: 'Demandes d’argent', en: 'Money requests', pt: 'Pedidos de dinheiro' },
  'grw.mr.received':       { fr: 'Reçues', en: 'Received', pt: 'Recebidos' },
  'grw.mr.sent':           { fr: 'Envoyées', en: 'Sent', pt: 'Enviados' },
  'grw.mr.new':            { fr: 'Nouvelle demande', en: 'New request', pt: 'Novo pedido' },
  'grw.mr.emptyReceived':  { fr: 'Aucune demande reçue', en: 'No requests received', pt: 'Nenhum pedido recebido' },
  'grw.mr.emptyReceivedMsg': { fr: 'Quand un proche vous demandera de l’argent, sa demande apparaîtra ici.', en: 'When someone asks you for money, the request will appear here.', pt: 'Quando alguém lhe pedir dinheiro, o pedido aparecerá aqui.' },
  'grw.mr.emptySent':      { fr: 'Aucune demande envoyée', en: 'No requests sent', pt: 'Nenhum pedido enviado' },
  'grw.mr.emptySentMsg':   { fr: 'Demandez de l’argent à un autre client : il est prévenu aussitôt.', en: 'Ask another customer for money: they are notified right away.', pt: 'Peça dinheiro a outro cliente: é avisado de imediato.' },
  'grw.mr.from':           { fr: 'De {name}', en: 'From {name}', pt: 'De {name}' },
  'grw.mr.to':             { fr: 'À {name}', en: 'To {name}', pt: 'Para {name}' },
  'grw.mr.expires':        { fr: 'Valable jusqu’au {date}', en: 'Valid until {date}', pt: 'Válido até {date}' },
  'grw.mr.pay':            { fr: 'Payer', en: 'Pay', pt: 'Pagar' },
  'grw.mr.decline':        { fr: 'Refuser', en: 'Decline', pt: 'Recusar' },
  'grw.mr.cancel':         { fr: 'Annuler la demande', en: 'Cancel request', pt: 'Cancelar pedido' },
  'grw.mr.declineAsk':     { fr: 'Refuser cette demande ?', en: 'Decline this request?', pt: 'Recusar este pedido?' },
  'grw.mr.cancelAsk':      { fr: 'Annuler cette demande ?', en: 'Cancel this request?', pt: 'Cancelar este pedido?' },
  'grw.mr.keep':           { fr: 'Garder', en: 'Keep', pt: 'Manter' },
  'grw.mr.otherCurrency':  { fr: 'Le montant est demandé en {currency} : saisissez l’équivalent dans votre devise.', en: 'The amount is requested in {currency}: enter the equivalent in your currency.', pt: 'O montante é pedido em {currency}: indique o equivalente na sua moeda.' },
  'grw.mr.st.PENDING':     { fr: 'En attente', en: 'Pending', pt: 'Pendente' },
  'grw.mr.st.PAID':        { fr: 'Réglée', en: 'Paid', pt: 'Paga' },
  'grw.mr.st.DECLINED':    { fr: 'Refusée', en: 'Declined', pt: 'Recusada' },
  'grw.mr.st.CANCELLED':   { fr: 'Annulée', en: 'Cancelled', pt: 'Cancelada' },
  'grw.mr.st.EXPIRED':     { fr: 'Expirée', en: 'Expired', pt: 'Expirada' },

  // ── Nouvelle demande ──
  'grw.mr.newTitle':       { fr: 'Demander de l’argent', en: 'Request money', pt: 'Pedir dinheiro' },
  'grw.mr.newIntro':       { fr: 'La personne doit avoir un compte chez nous. Elle reçoit votre demande et la règle par un envoi ; la demande passe alors à « Réglée ».', en: 'The person needs an account with us. They get your request and settle it with a transfer; it then turns to “Paid”.', pt: 'A pessoa precisa de ter conta connosco. Recebe o seu pedido e paga-o com um envio; o pedido passa então a “Paga”.' },
  'grw.mr.phone':          { fr: 'Téléphone de la personne', en: 'Their phone number', pt: 'Telefone da pessoa' },
  'grw.mr.phoneHint':      { fr: 'Avec l’indicatif du pays, par exemple +224…', en: 'With the country code, e.g. +224…', pt: 'Com o indicativo do país, por exemplo +224…' },
  'grw.mr.amount':         { fr: 'Montant demandé', en: 'Amount requested', pt: 'Montante pedido' },
  'grw.mr.note':           { fr: 'Motif (facultatif)', en: 'Reason (optional)', pt: 'Motivo (opcional)' },
  'grw.mr.notePh':         { fr: 'Ex. : ma part du loyer', en: 'E.g. my share of the rent', pt: 'Ex.: a minha parte da renda' },
  'grw.mr.send':           { fr: 'Envoyer la demande', en: 'Send request', pt: 'Enviar pedido' },
  'grw.mr.errPhone':       { fr: 'Saisissez le numéro complet, avec l’indicatif du pays.', en: 'Enter the full number, with the country code.', pt: 'Indique o número completo, com o indicativo do país.' },
  'grw.mr.errAmount':      { fr: 'Saisissez un montant supérieur à zéro.', en: 'Enter an amount above zero.', pt: 'Indique um montante superior a zero.' },
  'grw.mr.doneTitle':      { fr: 'Demande envoyée', en: 'Request sent', pt: 'Pedido enviado' },
  'grw.mr.doneMsg':        { fr: '{name} a été prévenu(e). Vous serez notifié(e) dès que la demande sera réglée.', en: '{name} has been notified. You will be notified once it is paid.', pt: '{name} foi avisado(a). Será notificado(a) quando o pedido for pago.' },

  // ── Parrainage ──
  'grw.ref.left':          { fr: 'Envois sans frais', en: 'Free transfers', pt: 'Envios sem taxas' },
  'grw.ref.leftSub':       { fr: 'Prochaine expiration : {date}', en: 'Next expiry: {date}', pt: 'Próxima expiração: {date}' },
  'grw.ref.none':          { fr: 'Aucun envoi offert pour l’instant', en: 'No free transfers yet', pt: 'Ainda sem envios oferecidos' },
  'grw.ref.friends':       { fr: 'Amis parrainés', en: 'Friends referred', pt: 'Amigos apadrinhados' },
  'grw.ref.inactive':      { fr: 'Le programme de parrainage n’est pas actif pour le moment. Votre code reste valable.', en: 'The referral programme is not active right now. Your code stays valid.', pt: 'O programa de apadrinhamento não está ativo neste momento. O seu código continua válido.' },
  'grw.ref.rule':          { fr: 'Votre ami reçoit {friend} sans frais ; vous en gagnez {you} quand il fait son premier envoi (valable {days} jours).', en: 'Your friend gets {friend} with no fees; you earn {you} when they make their first transfer (valid {days} days).', pt: 'O seu amigo recebe {friend} sem taxas; ganha {you} quando ele fizer o primeiro envio (válido {days} dias).' },
  'grw.ref.ruleMin':       { fr: 'Premier envoi d’au moins {amount}.', en: 'First transfer of at least {amount}.', pt: 'Primeiro envio de pelo menos {amount}.' },
  'grw.ref.rewards':       { fr: 'Mes récompenses', en: 'My rewards', pt: 'As minhas recompensas' },
  'grw.ref.kind.REFEREE_WELCOME': { fr: 'Bienvenue (parrainé)', en: 'Welcome (referred)', pt: 'Boas-vindas (apadrinhado)' },
  'grw.ref.kind.REFERRER_BONUS':  { fr: 'Bonus parrain', en: 'Referrer bonus', pt: 'Bónus de padrinho' },
  'grw.ref.until':         { fr: 'Jusqu’au {date}', en: 'Until {date}', pt: 'Até {date}' },
  'grw.ref.st.AVAILABLE':  { fr: 'Disponible', en: 'Available', pt: 'Disponível' },
  'grw.ref.st.USED':       { fr: 'Utilisé', en: 'Used', pt: 'Utilizado' },
  'grw.ref.st.EXPIRED':    { fr: 'Expiré', en: 'Expired', pt: 'Expirado' },
  'grw.ref.entry':         { fr: 'Parrainer un ami', en: 'Refer a friend', pt: 'Apadrinhar um amigo' },
  'grw.ref.entrySub':      { fr: 'Des envois sans frais pour vous deux.', en: 'Fee-free transfers for you both.', pt: 'Envios sem taxas para os dois.' },
  'grw.ref.entryLeft':     { fr: '1 envoi sans frais à utiliser|{count} envois sans frais à utiliser', en: '1 free transfer to use|{count} free transfers to use', pt: '1 envio sem taxas por usar|{count} envios sem taxas por usar' },
  'grw.ref.loadFail':      { fr: 'Votre code n’a pas pu être chargé. Réessayez dans un instant.', en: 'Your code could not be loaded. Try again in a moment.', pt: 'Não foi possível carregar o seu código. Tente novamente daqui a pouco.' },

  // ── Inscription ──
  'grw.reg.code':          { fr: 'Code de parrainage (facultatif)', en: 'Referral code (optional)', pt: 'Código de apadrinhamento (opcional)' },
  'grw.reg.codeHint':      { fr: 'Un ami vous a invité ? Saisissez son code pour recevoir des envois sans frais.', en: 'Invited by a friend? Enter their code to get fee-free transfers.', pt: 'Foi convidado por um amigo? Indique o código dele para receber envios sem taxas.' },
} as const satisfies Record<string, Trio>;
