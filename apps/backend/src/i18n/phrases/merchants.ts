// apps/backend/src/i18n/phrases/merchants.ts — compte marchand : encaissements, remboursements, retraits, caissiers, clôtures, fiche du commerce.
import { registerPhrases, type Phrase } from '../phrase-book';

export const MERCHANT_PHRASES: readonly Phrase[] = [
  // ── mots réutilisés dans des phrases à trous ──
  ['paiement', 'payment', 'pagamento'],
  ['retrait', 'withdrawal', 'levantamento'],
  ['montant', 'amount', 'montante'],
  ['encaissement', 'collection', 'cobrança'],
  ['remboursement', 'refund', 'reembolso'],

  // ── remboursement d'un paiement, plafonds, périodes ──
  ['Ce paiement a déjà été remboursé.', 'This payment has already been refunded.', 'Este pagamento já foi reembolsado.'],
  ['Seul un paiement reçu peut être remboursé.', 'Only a received payment can be refunded.', 'Só um pagamento recebido pode ser reembolsado.'],
  ['Le délai de remboursement ({1} jours) est dépassé. Contactez le service client.', 'The refund period ({1} days) has passed. Contact customer service.', 'O prazo de reembolso ({1} dias) foi ultrapassado. Contacte o serviço de apoio ao cliente.'],
  ["Votre plafond par encaissement est de {1} {2}. Demandez au propriétaire du commerce.", 'Your limit per collection is {1} {2}. Ask the business owner.', 'O seu limite por cobrança é de {1} {2}. Peça ao proprietário do comércio.'],
  ['Plafond invalide.', 'Invalid limit.', 'Limite inválido.'],
  ['En {1}, le plafond doit être un nombre entier.', 'In {1}, the limit must be a whole number.', 'Em {1}, o limite deve ser um número inteiro.'],
  ['Date invalide (attendu : AAAA-MM-JJ).', 'Invalid date (expected: YYYY-MM-DD).', 'Data inválida (esperado: AAAA-MM-DD).'],
  ['La date de fin précède la date de début.', 'The end date is before the start date.', 'A data de fim é anterior à data de início.'],
  ['Période trop longue ({1} jours au maximum).', 'Period too long ({1} days maximum).', 'Período demasiado longo (máximo de {1} dias).'],

  // ── logo et justificatifs ──
  ['Le logo doit être une image (JPEG, PNG ou WebP).', 'The logo must be an image (JPEG, PNG or WebP).', 'O logótipo deve ser uma imagem (JPEG, PNG ou WebP).'],
  ['Logo trop lourd (1 Mo au plus). Choisissez une image plus petite.', 'Logo too large (1 MB at most). Choose a smaller image.', 'Logótipo demasiado pesado (máximo 1 MB). Escolha uma imagem mais pequena.'],
  ['Logo vide ou illisible. Réessayez.', 'Empty or unreadable logo. Try again.', 'Logótipo vazio ou ilegível. Tente novamente.'],
  ['Aucun logo.', 'No logo.', 'Sem logótipo.'],
  ["Ce compte n'est pas un compte marchand.", 'This account is not a merchant account.', 'Esta conta não é uma conta de comerciante.'],
  ['Aucun document RCCM.', 'No RCCM document.', 'Sem documento RCCM.'],

  // ── demandes de paiement et QR ──
  ['Compte indisponible.', 'Account unavailable.', 'Conta indisponível.'],
  ["Trop de demandes en attente ({1}). Annulez-en ou attendez qu'elles expirent.", 'Too many pending requests ({1}). Cancel some or wait for them to expire.', 'Demasiados pedidos pendentes ({1}). Cancele alguns ou aguarde que expirem.'],
  ["Aucun client Direct Transf'air avec ce numéro. Vérifiez-le, ou proposez le paiement par QR code.", 'No Direct Transf’air customer with this number. Check it, or offer payment by QR code.', 'Nenhum cliente Direct Transf’air com este número. Verifique-o ou proponha o pagamento por código QR.'],
  ['Vous ne pouvez pas vous adresser une demande à vous-même.', 'You cannot send a request to yourself.', 'Não pode enviar um pedido a si próprio.'],
  ['Ce client a déjà beaucoup de demandes en attente. Réessayez plus tard.', 'This customer already has many pending requests. Try again later.', 'Este cliente já tem muitos pedidos pendentes. Tente novamente mais tarde.'],
  ['Demande introuvable.', 'Request not found.', 'Pedido não encontrado.'],
  ['Ce marchand ne peut plus encaisser pour le moment.', 'This merchant cannot collect payments at the moment.', 'Este comerciante não pode cobrar de momento.'],
  ["Ce QR code n'est pas un QR de paiement Direct Transf'air.", 'This QR code is not a Direct Transf’air payment QR.', 'Este código QR não é um QR de pagamento Direct Transf’air.'],
  ['Vous ne pouvez pas payer votre propre QR code.', 'You cannot pay your own QR code.', 'Não pode pagar o seu próprio código QR.'],
  ['QR code inconnu ou non valable pour votre société.', 'Unknown QR code, or not valid for your company.', 'Código QR desconhecido ou não válido para a sua empresa.'],
  ['Seuls les clients peuvent payer.', 'Only customers can pay.', 'Só os clientes podem pagar.'],
  ['Saisissez le montant à payer.', 'Enter the amount to pay.', 'Introduza o montante a pagar.'],
  ['Vous ne pouvez pas vous payer vous-même.', 'You cannot pay yourself.', 'Não pode pagar a si próprio.'],

  // ── remboursement par le commerçant ──
  ['Paiement introuvable.', 'Payment not found.', 'Pagamento não encontrado.'],
  ["Vous n'avez pas le droit de rembourser. Demandez au propriétaire du commerce.", 'You are not allowed to issue refunds. Ask the business owner.', 'Não tem permissão para reembolsar. Peça ao proprietário do comércio.'],
  ['Ce paiement ne peut pas être remboursé automatiquement : client introuvable. Contactez le service client.', 'This payment cannot be refunded automatically: customer not found. Contact customer service.', 'Este pagamento não pode ser reembolsado automaticamente: cliente não encontrado. Contacte o serviço de apoio ao cliente.'],
  ["Le compte du client n'est plus actif : le remboursement doit passer par le service client.", 'The customer’s account is no longer active: the refund must go through customer service.', 'A conta do cliente já não está ativa: o reembolso tem de passar pelo serviço de apoio ao cliente.'],
  ["Le solde de votre commerce ne suffit pas pour rembourser {1}. Encaissez d'abord ou attendez qu'un retrait refusé soit recrédité.", 'Your business balance is not enough to refund {1}. Collect payments first or wait for a rejected withdrawal to be credited back.', 'O saldo do seu comércio não chega para reembolsar {1}. Receba primeiro pagamentos ou aguarde que um levantamento recusado seja creditado novamente.'],

  // ── retraits du commerçant ──
  ['Montant trop faible après commission.', 'Amount too low after commission.', 'Montante demasiado baixo após a comissão.'],
  ['Vous avez déjà plusieurs retraits en cours de traitement. Attendez leur confirmation.', 'You already have several withdrawals being processed. Wait for their confirmation.', 'Já tem vários levantamentos em processamento. Aguarde a sua confirmação.'],
  ['Précisez la société (clientId).', 'Specify the company (clientId).', 'Indique a empresa (clientId).'],
  ['Compte non rattaché à une société.', 'Account not linked to a company.', 'Conta não associada a uma empresa.'],
  ['Retrait introuvable.', 'Withdrawal not found.', 'Levantamento não encontrado.'],
  ['Ce retrait a déjà été traité.', 'This withdrawal has already been processed.', 'Este levantamento já foi tratado.'],
  ['Compte marchand introuvable.', 'Merchant account not found.', 'Conta de comerciante não encontrada.'],

  // ── clôture de journée ──
  ["Vous ne pouvez pas clôturer une journée qui n'a pas encore eu lieu.", 'You cannot close a day that has not happened yet.', 'Não pode encerrar um dia que ainda não aconteceu.'],
  ['Trop d’opérations pour cette journée. Contactez le service client.', 'Too many operations for this day. Contact customer service.', 'Demasiadas operações para este dia. Contacte o serviço de apoio ao cliente.'],
  ['Aucun encaissement ni remboursement ce jour-là : rien à clôturer.', 'No collection or refund that day: nothing to close.', 'Nenhuma cobrança nem reembolso nesse dia: nada a encerrar.'],
  ['Cette journée est déjà clôturée.', 'This day is already closed.', 'Este dia já está encerrado.'],

  // ── règles de saisie ──
  ['Montant invalide.', 'Invalid amount.', 'Montante inválido.'],
  ['En {1}, le montant doit être un nombre entier (pas de centimes).', 'In {1}, the amount must be a whole number (no cents).', 'Em {1}, o montante deve ser um número inteiro (sem cêntimos).'],
  ['Deux décimales au maximum.', 'Two decimal places at most.', 'No máximo duas casas decimais.'],
  ['Le {1} minimum est de {2} {3}.', 'The minimum {1} is {2} {3}.', 'O {1} mínimo é de {2} {3}.'],
  ['Le {1} maximum est de {2} {3}.', 'The maximum {1} is {2} {3}.', 'O {1} máximo é de {2} {3}.'],
  ['IBAN invalide.', 'Invalid IBAN.', 'IBAN inválido.'],
  ['IBAN invalide : longueur incorrecte pour ce pays.', 'Invalid IBAN: incorrect length for this country.', 'IBAN inválido: comprimento incorreto para este país.'],
  ['IBAN invalide : clé de contrôle incorrecte.', 'Invalid IBAN: incorrect check digits.', 'IBAN inválido: dígitos de controlo incorretos.'],
  ['Code BIC invalide.', 'Invalid BIC code.', 'Código BIC inválido.'],
  ["Indiquez l'adresse de votre commerce (5 caractères minimum : rue, quartier, repère…).", 'Enter your business address (5 characters minimum: street, district, landmark…).', 'Indique a morada do seu comércio (mínimo de 5 caracteres: rua, bairro, ponto de referência…).'],
  ['Indiquez la ville de votre commerce.', 'Enter your business city.', 'Indique a cidade do seu comércio.'],
  ["Code postal invalide : 3 à 10 caractères (lettres, chiffres, espace ou tiret). Laissez vide si vous n'en avez pas.", 'Invalid postal code: 3 to 10 characters (letters, digits, space or hyphen). Leave empty if you do not have one.', 'Código postal inválido: 3 a 10 caracteres (letras, números, espaço ou hífen). Deixe em branco se não tiver.'],
  ['Numéro fiscal (NIF / IFU) invalide : 3 à 30 caractères (lettres, chiffres, points ou tirets), avec au moins un chiffre.', 'Invalid tax number (NIF / IFU): 3 to 30 characters (letters, digits, dots or hyphens), with at least one digit.', 'Número fiscal (NIF / IFU) inválido: 3 a 30 caracteres (letras, números, pontos ou hífenes), com pelo menos um dígito.'],
  ['Le numéro RCCM est obligatoire pour ouvrir un compte marchand.', 'The RCCM number is required to open a merchant account.', 'O número RCCM é obrigatório para abrir uma conta de comerciante.'],
  ['Numéro RCCM invalide : 5 à 40 caractères (lettres, chiffres, points ou tirets), avec au moins un chiffre. Exemple : GN.TCC.2019.B.12345.', 'Invalid RCCM number: 5 to 40 characters (letters, digits, dots or hyphens), with at least one digit. Example: GN.TCC.2019.B.12345.', 'Número RCCM inválido: 5 a 40 caracteres (letras, números, pontos ou hífenes), com pelo menos um dígito. Exemplo: GN.TCC.2019.B.12345.'],
  ['Indiquez le nom de votre commerce (2 caractères minimum).', 'Enter your business name (2 characters minimum).', 'Indique o nome do seu comércio (mínimo de 2 caracteres).'],

  // ── équipe de caisse ──
  ["Aucun client Direct Transf'air avec ce numéro. La personne doit d'abord ouvrir un compte.", 'No Direct Transf’air customer with this number. The person must open an account first.', 'Nenhum cliente Direct Transf’air com este número. A pessoa tem de abrir primeiro uma conta.'],
  ['Vous êtes déjà le propriétaire de ce commerce.', 'You are already the owner of this business.', 'Já é o proprietário deste comércio.'],
  ['Cette personne est déjà caissier de votre commerce.', 'This person is already a cashier of your business.', 'Esta pessoa já é caixa do seu comércio.'],
  ['Vous pouvez avoir {1} caissiers au maximum.', 'You can have at most {1} cashiers.', 'Pode ter no máximo {1} caixas.'],
  ['Caissier introuvable.', 'Cashier not found.', 'Caixa não encontrado.'],
  ['Code secret requis pour accorder le droit de rembourser.', 'Secret code required to grant the right to refund.', 'Código secreto necessário para conceder o direito de reembolsar.'],

  // ── fiche du commerce ──
  ['Commerce introuvable.', 'Business not found.', 'Comércio não encontrado.'],
  ['Réservé aux clients.', 'Reserved for customers.', 'Reservado a clientes.'],
  ['Votre compte marchand existe déjà.', 'Your merchant account already exists.', 'A sua conta de comerciante já existe.'],
  ['Compte introuvable.', 'Account not found.', 'Conta não encontrada.'],
  ['Nom du commerce : 2 caractères minimum.', 'Business name: 2 characters minimum.', 'Nome do comércio: mínimo de 2 caracteres.'],
  ['Le numéro RCCM ne peut pas être modifié ici. Contactez le support pour le changer.', 'The RCCM number cannot be changed here. Contact support to change it.', 'O número RCCM não pode ser alterado aqui. Contacte o suporte para o alterar.'],
  ['Indiquez le titulaire du compte bancaire.', 'Enter the bank account holder.', 'Indique o titular da conta bancária.'],
  ["Aucune modification : la destination saisie est identique à l'actuelle.", 'No change: the destination entered is the same as the current one.', 'Sem alteração: o destino introduzido é igual ao atual.'],
  ['Marchand introuvable.', 'Merchant not found.', 'Comerciante não encontrado.'],
  ['Indiquez le motif de la suspension.', 'Enter the reason for the suspension.', 'Indique o motivo da suspensão.'],
];

registerPhrases(MERCHANT_PHRASES);
