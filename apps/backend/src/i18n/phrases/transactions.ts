// apps/backend/src/i18n/phrases/transactions.ts — envois, annulations, remboursements, reçus : messages vus par le client du portefeuille.
import { registerPhrases, type Phrase } from '../phrase-book';

export const TRANSACTION_PHRASES: readonly Phrase[] = [
  // ── clé d'idempotence ──
  ['Idempotency-Key invalide : 8 à 128 caractères (lettres, chiffres, - _ : .).', 'Invalid Idempotency-Key: 8 to 128 characters (letters, digits, - _ : .).', 'Idempotency-Key inválida: 8 a 128 caracteres (letras, números, - _ : .).'],
  ['Cette Idempotency-Key a déjà servi pour une autre opération : utilisez une nouvelle clé.', 'This Idempotency-Key was already used for another operation: use a new key.', 'Esta Idempotency-Key já foi utilizada noutra operação: utilize uma nova chave.'],

  // ── montants ──
  ['Montant trop élevé (maximum {1}).', 'Amount too high (maximum {1}).', 'Montante demasiado elevado (máximo {1}).'],
  ['Montant invalide : 4 décimales maximum.', 'Invalid amount: 4 decimal places maximum.', 'Montante inválido: máximo de 4 casas decimais.'],
  ['Devise non supportée', 'Unsupported currency', 'Moeda não suportada'],
  ['Montant trop faible : le montant reçu serait nul après conversion.', 'Amount too low: the received amount would be zero after conversion.', 'Montante demasiado baixo: o montante recebido seria nulo após a conversão.'],

  // ── envoi ──
  ['User not found', 'User not found', 'Utilizador não encontrado'],
  ['User must belong to a client', 'User must belong to a company', 'O utilizador tem de pertencer a uma empresa'],
  ['Beneficiary not found', 'Beneficiary not found', 'Beneficiário não encontrado'],
  ["Vous n'avez pas de wallet {1}. Créez-en un d'abord.", 'You do not have a {1} wallet. Create one first.', 'Não tem uma carteira {1}. Crie uma primeiro.'],
  ["Le pays du bénéficiaire{1} n'est pas reconnu : modifiez le bénéficiaire en choisissant un pays pris en charge pour que le code puisse être payé au bon endroit.", "The beneficiary's country{1} is not recognised: edit the beneficiary and choose a supported country so the code can be paid out in the right place.", 'O país do beneficiário{1} não é reconhecido: edite o beneficiário e escolha um país suportado para que o código possa ser pago no local certo.'],
  ['Solde {1} insuffisant. Disponible : {2}', 'Insufficient {1} balance. Available: {2}', 'Saldo {1} insuficiente. Disponível: {2}'],
  ["Aucun compte n'existe avec ce numéro de téléphone : l'envoi vers un portefeuille n'est pas possible. Vérifiez le numéro (indicatif du pays compris) ou choisissez le retrait en agence. Votre compte n'a pas été débité.", 'No account exists with this phone number: sending to a wallet is not possible. Check the number (including the country code) or choose agency pick-up. Your account has not been debited.', 'Não existe nenhuma conta com este número de telemóvel: o envio para uma carteira não é possível. Verifique o número (incluindo o indicativo do país) ou escolha o levantamento em agência. A sua conta não foi debitada.'],
  ["Vous ne pouvez pas vous envoyer de l'argent à vous-même. Votre compte n'a pas été débité.", 'You cannot send money to yourself. Your account has not been debited.', 'Não pode enviar dinheiro para si próprio. A sua conta não foi debitada.'],
  ["Un envoi vers un compte de votre propre agence n'est pas autorisé. Le compte n'a pas été débité.", 'Sending to an account of your own agency is not allowed. The account has not been debited.', 'O envio para uma conta da sua própria agência não é permitido. A conta não foi debitada.'],
  ['Utilisateur invalide', 'Invalid user', 'Utilizador inválido'],
  ['Utilisateur inconnu', 'Unknown user', 'Utilizador desconhecido'],
  ['Non authentifié', 'Not authenticated', 'Não autenticado'],

  // ── consultation, reçu ──
  ['Transaction introuvable', 'Transaction not found', 'Transação não encontrada'],
  ['Transaction not found', 'Transaction not found', 'Transação não encontrada'],
  ['Accès refusé à cette transaction.', 'Access to this transaction is denied.', 'Acesso negado a esta transação.'],
  ['Société introuvable', 'Company not found', 'Empresa não encontrada'],
  ['Accès refusé', 'Access denied', 'Acesso negado'],
  ['Transaction déjà traitée', 'Transaction already processed', 'Transação já processada'],
  ['Transaction déjà traitée ou annulée.', 'Transaction already processed or cancelled.', 'Transação já processada ou cancelada.'],
  ["Cette transaction vient d'être modifiée : rechargez la page.", 'This transaction has just been modified: reload the page.', 'Esta transação acabou de ser modificada: recarregue a página.'],
  ['Transition interdite: {1} -> {2}', 'Transition not allowed: {1} -> {2}', 'Transição não permitida: {1} -> {2}'],
  ["Impossible de générer une référence unique, réessayez.", 'Unable to generate a unique reference, please try again.', 'Não foi possível gerar uma referência única, tente novamente.'],

  // ── annulation et remboursement ──
  ['Vous ne pouvez annuler que vos propres transactions', 'You can only cancel your own transactions', 'Só pode cancelar as suas próprias transações'],
  ["Impossible : le client a déjà retiré l'argent", 'Not possible: the customer has already withdrawn the money', 'Impossível: o cliente já levantou o dinheiro'],
  ['Déjà annulée', 'Already cancelled', 'Já cancelada'],
  ['Cette opération ne peut pas être annulée.', 'This operation cannot be cancelled.', 'Esta operação não pode ser cancelada.'],
  ['Impossible à rejeter', 'Cannot be rejected', 'Não pode ser rejeitada'],
  ["Cette transaction est déjà « {1} » : le retrait ne peut plus être clos.", 'This transaction is already “{1}”: the withdrawal can no longer be closed.', 'Esta transação já está «{1}»: o levantamento já não pode ser encerrado.'],
  ["Ce type d'opération ne se rembourse pas depuis la plateforme.", 'This type of operation cannot be refunded from the platform.', 'Este tipo de operação não pode ser reembolsado a partir da plataforma.'],
  ["Cette opération est déjà « {1} » : rien à rembourser.", 'This operation is already “{1}”: nothing to refund.', 'Esta operação já está «{1}»: nada a reembolsar.'],
  ["Le journal de cet envoi est incomplet : le rappel automatique est impossible, le dossier se traite à la main.", 'The log of this transfer is incomplete: automatic recall is impossible, the case must be handled manually.', 'O registo deste envio está incompleto: a recuperação automática é impossível, o caso tem de ser tratado manualmente.'],
  ["Cet envoi vient d'être traité par quelqu'un d'autre.", 'This transfer has just been processed by someone else.', 'Este envio acabou de ser tratado por outra pessoa.'],
  ["Le destinataire n'a plus cette somme sur son portefeuille (ou son portefeuille est gelé) : le rappel est impossible, le dossier se traite hors plateforme.", 'The recipient no longer has this amount in their wallet (or their wallet is frozen): recall is impossible, the case must be handled outside the platform.', 'O destinatário já não tem este montante na carteira (ou a carteira está congelada): a recuperação é impossível, o caso tem de ser tratado fora da plataforma.'],
  ["Un envoi cash ne passe à « payé » que lorsqu'un agent remet le cash avec le code. Il ne peut pas être marqué payé à la main.", 'A cash transfer only becomes “paid” when an agent hands over the cash against the code. It cannot be marked as paid manually.', 'Um envio em numerário só passa a «pago» quando um agente entrega o dinheiro com o código. Não pode ser marcado como pago manualmente.'],

  // ── notifications ──
  ['Envoi annulé par le service client', 'Transfer cancelled by customer service', 'Envio cancelado pelo serviço de apoio ao cliente'],
  ["L'envoi {1} ({2} {3}) a été annulé : la somme a été reprise sur votre portefeuille.", 'Transfer {1} ({2} {3}) was cancelled: the amount was taken back from your wallet.', 'O envio {1} ({2} {3}) foi cancelado: o montante foi retirado da sua carteira.'],
  ['Envoi expiré — remboursé', 'Transfer expired — refunded', 'Envio expirado — reembolsado'],
  ['Rechargement reçu 🔋', 'Top-up received 🔋', 'Carregamento recebido 🔋'],

  // ── notifications du portefeuille (WalletNotifierService) ──
  ['Transfert envoyé 💸', 'Transfer sent 💸', 'Transferência enviada 💸'],
  ['Vous avez envoyé {1} à {2}.', 'You sent {1} to {2}.', 'Enviou {1} para {2}.'],
  ['Vous avez envoyé {1} à {2}. Réf : {3}.', 'You sent {1} to {2}. Ref: {3}.', 'Enviou {1} para {2}. Ref: {3}.'],
  ['Argent reçu 💰', 'Money received 💰', 'Dinheiro recebido 💰'],
  ['Vous avez reçu {1} de la part de {2}.', 'You received {1} from {2}.', 'Recebeu {1} da parte de {2}.'],
  ['Vous avez reçu {1} de la part de {2}. Réf : {3}.', 'You received {1} from {2}. Ref: {3}.', 'Recebeu {1} da parte de {2}. Ref: {3}.'],
  ['Dépôt effectué ✅', 'Deposit made ✅', 'Depósito efetuado ✅'],
  ['Votre compte a été crédité de {1}.', 'Your account has been credited with {1}.', 'A sua conta foi creditada com {1}.'],
  ["Votre compte a été crédité de {1} par l'agence {2}.", 'Your account has been credited with {1} by the agency {2}.', 'A sua conta foi creditada com {1} pela agência {2}.'],
  ['Retrait effectué 🏧', 'Withdrawal made 🏧', 'Levantamento efetuado 🏧'],
  ['Un retrait de {1} a été débité de votre compte.', 'A withdrawal of {1} has been debited from your account.', 'Foi debitado um levantamento de {1} da sua conta.'],
  ['Un retrait de {1} a été débité de votre compte. Code : {2}.', 'A withdrawal of {1} has been debited from your account. Code: {2}.', 'Foi debitado um levantamento de {1} da sua conta. Código: {2}.'],
  ['Code de retrait prêt 🔐', 'Pick-up code ready 🔐', 'Código de levantamento pronto 🔐'],
  ['Le code pour que {1} retire {2} est disponible : {3}.', 'The code for {1} to collect {2} is available: {3}.', 'O código para {1} levantar {2} está disponível: {3}.'],
  ['Solde faible ⚠️', 'Low balance ⚠️', 'Saldo baixo ⚠️'],
  ['Votre solde est de {1} {2}. Pensez à recharger votre wallet.', 'Your balance is {1} {2}. Remember to top up your wallet.', 'O seu saldo é de {1} {2}. Não se esqueça de carregar a sua carteira.'],
  ['Transfert en cours ⏳', 'Transfer in progress ⏳', 'Transferência em curso ⏳'],
  ['Votre transfert de {1} est en cours de validation.', 'Your transfer of {1} is being validated.', 'A sua transferência de {1} está em validação.'],
  ['Votre transfert de {1} est en cours de validation. Réf : {2}.', 'Your transfer of {1} is being validated. Ref: {2}.', 'A sua transferência de {1} está em validação. Ref: {2}.'],
  ['Transfert annulé 🔁', 'Transfer cancelled 🔁', 'Transferência cancelada 🔁'],
  ['Votre transfert de {1} a été annulé. Le montant sera remboursé.', 'Your transfer of {1} has been cancelled. The amount will be refunded.', 'A sua transferência de {1} foi cancelada. O montante será reembolsado.'],
  ['Votre transfert de {1} a été annulé. Réf : {2}. Le montant sera remboursé.', 'Your transfer of {1} has been cancelled. Ref: {2}. The amount will be refunded.', 'A sua transferência de {1} foi cancelada. Ref: {2}. O montante será reembolsado.'],

  // ── notifications poussées (PushService) ──
  ['Transfert envoyé ✅', 'Transfer sent ✅', 'Transferência enviada ✅'],
  ['{1} {2} vers {3} enregistré.', '{1} {2} to {3} recorded.', '{1} {2} para {3} registado.'],
  ['Vous avez reçu {1} {2} de {3}.', 'You received {1} {2} from {3}.', 'Recebeu {1} {2} de {3}.'],
  ['Retrait prêt 📤', 'Withdrawal ready 📤', 'Levantamento pronto 📤'],
  ['{1} {2} disponible. Code : {3}', '{1} {2} available. Code: {3}', '{1} {2} disponível. Código: {3}'],
  ['Nouvelle connexion 🔐', 'New sign-in 🔐', 'Novo início de sessão 🔐'],
  ['Connexion détectée depuis : {1}', 'Sign-in detected from: {1}', 'Início de sessão detetado a partir de: {1}'],
  ['Le taux a {1} votre seuil. Taux actuel : {2}', 'The rate has {1} your threshold. Current rate: {2}', 'A taxa {1} o seu limiar. Taxa atual: {2}'],
  ['Virement programmé exécuté 📅', 'Scheduled transfer executed 📅', 'Transferência agendada executada 📅'],
  ['{1} {2} envoyé à {3}.', '{1} {2} sent to {3}.', '{1} {2} enviado para {3}.'],
  ['Virement programmé échoué ❌', 'Scheduled transfer failed ❌', 'Transferência agendada falhada ❌'],
  ['Votre virement automatique a échoué. {1}', 'Your automatic transfer failed. {1}', 'A sua transferência automática falhou. {1}'],
];

registerPhrases(TRANSACTION_PHRASES);
