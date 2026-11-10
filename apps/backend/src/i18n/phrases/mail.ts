// apps/backend/src/i18n/phrases/mail.ts — courriels et SMS envoyés au client : morceaux de texte (entre deux balises) et lignes de SMS.
// Les morceaux sont courts parce qu'ils entourent des valeurs variables (nom, montant, code) : « Votre transfert vers <b>Awa</b> a été enregistré… ».
import { registerPhrases, type Phrase } from '../phrase-book';

export const MAIL_PHRASES: readonly Phrase[] = [
  // ── objets des courriels ──
  ['Confirmation de transfert ✅', 'Transfer confirmation ✅', 'Confirmação de transferência ✅'],
  ["Vous avez reçu de l'argent 💰", 'You have received money 💰', 'Recebeu dinheiro 💰'],
  ['Code de retrait — {1}', 'Pick-up code — {1}', 'Código de levantamento — {1}'],
  ['Envoi retiré — {1}', 'Transfer collected — {1}', 'Envio levantado — {1}'],
  ['Bienvenue ! 🎉', 'Welcome! 🎉', 'Bem-vindo! 🎉'],
  ['Nouveau statut {1} 🌟', 'New {1} status 🌟', 'Novo estatuto {1} 🌟'],
  ['Virement programmé exécuté 📅', 'Scheduled transfer executed 📅', 'Transferência agendada executada 📅'],
  ['Alerte taux : {1} 📊', 'Rate alert: {1} 📊', 'Alerta de taxa: {1} 📊'],
  ['Bienvenue sur {1} 🎉', 'Welcome to {1} 🎉', 'Bem-vindo ao {1} 🎉'],
  ['Votre code de vérification', 'Your verification code', 'O seu código de verificação'],
  ['Votre code de connexion', 'Your sign-in code', 'O seu código de início de sessão'],
  ['Vérifiez votre adresse email', 'Verify your email address', 'Verifique o seu endereço de email'],
  ['Code secret modifié', 'Secret code changed', 'Código secreto alterado'],
  ['Mot de passe modifié', 'Password changed', 'Palavra-passe alterada'],

  // ── pied de page commun ──
  ['Ceci est un message automatique — merci de ne pas y répondre.', 'This is an automated message — please do not reply.', 'Esta é uma mensagem automática — por favor, não responda.'],
  ['© {1} {2}. Tous droits réservés.', '© {1} {2}. All rights reserved.', '© {1} {2}. Todos os direitos reservados.'],

  // ── transfert envoyé / reçu / retrait ──
  ['Bonjour', 'Hello', 'Olá'],
  ['Bonjour {1},', 'Hello {1},', 'Olá {1},'],
  ['Votre transfert vers', 'Your transfer to', 'A sua transferência para'],
  ['a été enregistré avec succès.', 'has been successfully recorded.', 'foi registada com sucesso.'],
  ['Montant envoyé', 'Amount sent', 'Montante enviado'],
  ['Montant reçu', 'Amount received', 'Montante recebido'],
  ['Frais', 'Fees', 'Taxas'],
  ['Référence', 'Reference', 'Referência'],
  ['Code de retrait', 'Pick-up code', 'Código de levantamento'],
  ["⚠️ Communiquez ce code uniquement au destinataire pour qu'il puisse retirer son argent.", '⚠️ Share this code only with the recipient so they can collect their money.', '⚠️ Partilhe este código apenas com o destinatário para que possa levantar o seu dinheiro.'],
  ['Merci de votre confiance.', 'Thank you for your trust.', 'Obrigado pela sua confiança.'],
  ['🎉 Bonne nouvelle !', '🎉 Good news!', '🎉 Boas notícias!'],
  ['Vous venez de recevoir', 'You have just received', 'Acabou de receber'],
  ['de la part de', 'from', 'da parte de'],
  ['Connectez-vous pour consulter votre nouveau solde et utiliser cet argent.', 'Sign in to see your new balance and use this money.', 'Inicie sessão para consultar o seu novo saldo e utilizar este dinheiro.'],
  ['Votre demande de retrait de', 'Your withdrawal request for', 'O seu pedido de levantamento de'],
  ['est prête.', 'is ready.', 'está pronto.'],
  ['Présentez ce code à un agent agréé pour récupérer votre argent.', 'Show this code to an authorised agent to collect your money.', 'Apresente este código a um agente autorizado para levantar o seu dinheiro.'],
  ['⏰ Ce code expire le', '⏰ This code expires on', '⏰ Este código expira em'],
  ['✅ Votre envoi a été retiré.', '✅ Your transfer has been collected.', '✅ O seu envio foi levantado.'],
  ['vient de retirer', 'has just collected', 'acabou de levantar'],
  ["Aucune autre action n'est nécessaire de votre part.", 'No further action is needed on your part.', 'Não é necessária mais nenhuma ação da sua parte.'],

  // ── bienvenue et fidélité ──
  ['Bienvenue sur la plateforme ! Votre compte a été créé avec succès.', 'Welcome to the platform! Your account has been created successfully.', 'Bem-vindo à plataforma! A sua conta foi criada com sucesso.'],
  ['Pays de résidence', 'Country of residence', 'País de residência'],
  ['Devise principale', 'Main currency', 'Moeda principal'],
  ['Vous pouvez maintenant :', 'You can now:', 'Agora pode:'],
  ["Envoyer de l'argent vers vos bénéficiaires", 'Send money to your beneficiaries', 'Enviar dinheiro para os seus beneficiários'],
  ['Recevoir des paiements en {1}', 'Receive payments in {1}', 'Receber pagamentos em {1}'],
  ['Consulter les taux de change en temps réel', 'Check exchange rates in real time', 'Consultar as taxas de câmbio em tempo real'],
  ['Programmer des virements récurrents', 'Schedule recurring transfers', 'Agendar transferências recorrentes'],
  ['À très bientôt !', 'See you soon!', 'Até breve!'],
  ["🌟 Félicitations ! Vous venez d'atteindre le statut", '🌟 Congratulations! You have just reached the status', '🌟 Parabéns! Acabou de atingir o estatuto'],
  ['Total de vos points :', 'Your total points:', 'Total dos seus pontos:'],
  ['Profitez dès maintenant de vos avantages exclusifs.', 'Enjoy your exclusive benefits right away.', 'Aproveite já as suas vantagens exclusivas.'],

  // ── virements programmés et alertes de taux ──
  ['Votre virement programmé de', 'Your scheduled transfer of', 'A sua transferência agendada de'],
  ['Votre virement de', 'Your transfer of', 'A sua transferência de'],
  ['vers', 'to', 'para'],
  ['a été exécuté avec succès.', 'was executed successfully.', 'foi executada com sucesso.'],
  ['a été exécuté.', 'was executed.', 'foi executada.'],
  ['Prochaine exécution prévue le', 'Next execution scheduled on', 'Próxima execução prevista para'],
  ['Prochaine exécution :', 'Next execution:', 'Próxima execução:'],
  ['📊 Le taux', '📊 The rate', '📊 A taxa'],
  ['Le taux', 'The rate', 'A taxa'],
  ['a dépassé votre seuil.', 'has exceeded your threshold.', 'ultrapassou o seu limiar.'],
  ['a passé sous votre seuil.', 'has dropped below your threshold.', 'desceu abaixo do seu limiar.'],
  ['a dépassé votre seuil de', 'has exceeded your threshold of', 'ultrapassou o seu limiar de'],
  ['a passé sous votre seuil de', 'has dropped below your threshold of', 'desceu abaixo do seu limiar de'],
  ['Seuil défini', 'Threshold set', 'Limiar definido'],
  ['Taux actuel', 'Current rate', 'Taxa atual'],
  ["C'est peut-être le moment d'effectuer votre transfert.", 'It may be a good time to make your transfer.', 'Pode ser o momento certo para fazer a sua transferência.'],

  // ── inscription, codes, mot de passe ──
  ["Votre compte a bien été créé. Pour l'activer, vérifiez votre adresse email.", 'Your account has been created. To activate it, verify your email address.', 'A sua conta foi criada. Para a ativar, verifique o seu endereço de email.'],
  ['Votre code de vérification est :', 'Your verification code is:', 'O seu código de verificação é:'],
  ['Il expire dans {1} minutes.', 'It expires in {1} minutes.', 'Expira dentro de {1} minutos.'],
  ["Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.", 'If you did not make this request, please ignore this message.', 'Se não fez este pedido, ignore esta mensagem.'],
  ['Votre code pour {1} sur', 'Your code for {1} on', 'O seu código para {1} em'],
  ['votre connexion', 'your sign-in', 'o seu início de sessão'],
  ['la vérification de votre email', 'your email verification', 'a verificação do seu email'],
  ['votre demande', 'your request', 'o seu pedido'],
  ['Ce code expire dans', 'This code expires in', 'Este código expira dentro de'],
  ['{1} minutes', '{1} minutes', '{1} minutos'],
  ['. Ne le partagez jamais, même avec le support.', '. Never share it, not even with support.', '. Nunca o partilhe, nem mesmo com o suporte.'],
  ['Votre {1} a été modifié avec succès.', 'Your {1} has been changed successfully.', 'O seu {1} foi alterado com sucesso.'],
  ['code secret', 'secret code', 'código secreto'],
  ['mot de passe', 'password', 'palavra-passe'],
  ["Si vous n'êtes pas à l'origine de cette modification, contactez-nous immédiatement.", 'If you did not make this change, contact us immediately.', 'Se não fez esta alteração, contacte-nos imediatamente.'],
  ["Ouvrez l'application, rubrique", 'Open the app, section', 'Abra a aplicação, secção'],

  // ── lignes de SMS (le préfixe [Nom] est conservé tel quel) ──
  ['Votre code de vérification : {1}', 'Your verification code: {1}', 'O seu código de verificação: {1}'],
  ['Valable 10 minutes. Ne le partagez jamais.', 'Valid for 10 minutes. Never share it.', 'Válido durante 10 minutos. Nunca o partilhe.'],
  ['Votre transfert de {1} {2} vers {3} est enregistré.', 'Your transfer of {1} {2} to {3} has been recorded.', 'A sua transferência de {1} {2} para {3} foi registada.'],
  ['Votre transfert de {1} {2} vers {3} est enregistré. Code retrait : {4}', 'Your transfer of {1} {2} to {3} has been recorded. Pick-up code: {4}', 'A sua transferência de {1} {2} para {3} foi registada. Código de levantamento: {4}'],
  ['Vous avez reçu {1} {2} de {3}. Connectez-vous pour voir votre solde.', 'You received {1} {2} from {3}. Sign in to see your balance.', 'Recebeu {1} {2} de {3}. Inicie sessão para ver o seu saldo.'],
  ['Code retrait : {1}', 'Pick-up code: {1}', 'Código de levantamento: {1}'],
  ['Montant : {1} {2}.', 'Amount: {1} {2}.', 'Montante: {1} {2}.'],
  ['Présentez ce code à un agent agréé.', 'Show this code to an authorised agent.', 'Apresente este código a um agente autorizado.'],
  ['📊 Alerte taux !', '📊 Rate alert!', '📊 Alerta de taxa!'],
  ['Le taux {1} a dépassé votre seuil.', 'The {1} rate has exceeded your threshold.', 'A taxa {1} ultrapassou o seu limiar.'],
  ['Le taux {1} a passé sous votre seuil.', 'The {1} rate has dropped below your threshold.', 'A taxa {1} desceu abaixo do seu limiar.'],
  ['Taux actuel : {1}', 'Current rate: {1}', 'Taxa atual: {1}'],
];

registerPhrases(MAIL_PHRASES);

// Verbes des alertes de taux, insérés dans des phrases à trous.
registerPhrases([
  ['dépassé', 'exceeded', 'ultrapassou'],
  ['passé sous', 'dropped below', 'desceu abaixo de'],
  ['dépasse', 'exceeds', 'ultrapassa'],
  ['passe sous', 'drops below', 'desce abaixo de'],
]);
