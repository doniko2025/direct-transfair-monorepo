// apps/backend/src/i18n/phrases/wallet.ts — portefeuille, bénéficiaires, plafonds, virements programmés, alertes de taux, photo, suppression du compte.
import { registerPhrases, type Phrase } from '../phrase-book';

export const WALLET_PHRASES: readonly Phrase[] = [
  // ── portefeuille ──
  ['Montant invalide', 'Invalid amount', 'Montante inválido'],
  ['Montant invalide.', 'Invalid amount.', 'Montante inválido.'],
  ['Non authentifié', 'Not authenticated', 'Não autenticado'],
  ['Devise non supportée: {1}', 'Unsupported currency: {1}', 'Moeda não suportada: {1}'],
  ['Un identifiant (userId, agencyId, merchantId ou clientId) est requis.', 'An identifier (userId, agencyId, merchantId or clientId) is required.', 'É necessário um identificador (userId, agencyId, merchantId ou clientId).'],
  ['Wallet introuvable', 'Wallet not found', 'Carteira não encontrada'],
  ['Accès non autorisé à ce wallet', 'Access to this wallet is not allowed', 'Acesso não autorizado a esta carteira'],
  ['Date invalide : utilisez le format AAAA-MM-JJ.', 'Invalid date: use the YYYY-MM-DD format.', 'Data inválida: utilize o formato AAAA-MM-DD.'],
  ['Solde insuffisant: {1} {2}', 'Insufficient balance: {1} {2}', 'Saldo insuficiente: {1} {2}'],
  ['Solde insuffisant', 'Insufficient balance', 'Saldo insuficiente'],
  ['Fonds insuffisants', 'Insufficient funds', 'Fundos insuficientes'],
  ['Montant réservé insuffisant', 'Insufficient reserved amount', 'Montante reservado insuficiente'],
  ['Le wallet source et le wallet destination sont identiques.', 'The source and destination wallets are the same.', 'A carteira de origem e a de destino são iguais.'],
  ['Montant converti nul : augmentez le montant.', 'Converted amount is zero: increase the amount.', 'O montante convertido é nulo: aumente o montante.'],
  ['Utilisateur introuvable', 'User not found', 'Utilizador não encontrado'],
  ['Utilisateur invalide', 'Invalid user', 'Utilizador inválido'],
  ['Utilisateur non authentifié', 'User not authenticated', 'Utilizador não autenticado'],
  ['Client introuvable', 'Customer not found', 'Cliente não encontrado'],
  ['Client introuvable.', 'Customer not found.', 'Cliente não encontrado.'],

  // ── bénéficiaires ──
  ['Utilisateur non identifié (User ID missing)', 'User not identified (User ID missing)', 'Utilizador não identificado (User ID em falta)'],
  ['Le paramètre "phone" est requis.', 'The "phone" parameter is required.', 'O parâmetro "phone" é obrigatório.'],
  ['Impossible de déterminer la société.', 'Unable to determine the company.', 'Não foi possível determinar a empresa.'],
  ['Beneficiary not found', 'Beneficiary not found', 'Beneficiário não encontrado'],
  ['No fields provided', 'No fields provided', 'Nenhum campo indicado'],
  ['Cannot delete beneficiary linked to transactions', 'Cannot delete a beneficiary linked to transactions', 'Não é possível eliminar um beneficiário associado a transações'],
  ["Ce bénéficiaire est utilisé par un virement programmé en cours. Supprimez ou terminez d'abord ce virement programmé.", 'This beneficiary is used by an ongoing scheduled transfer. Delete or end that scheduled transfer first.', 'Este beneficiário é utilizado por uma transferência agendada em curso. Elimine ou termine primeiro essa transferência agendada.'],

  // ── plafonds d'envoi ──
  ['Niveau KYC inconnu : « {1} ».', 'Unknown KYC level: “{1}”.', 'Nível KYC desconhecido: «{1}».'],
  ['Devise inconnue : « {1} ».', 'Unknown currency: “{1}”.', 'Moeda desconhecida: «{1}».'],
  ['Deux décimales au maximum.', 'Two decimal places at most.', 'No máximo duas casas decimais.'],
  ['Société introuvable.', 'Company not found.', 'Empresa não encontrada.'],
  ['Tenant non résolu', 'Company not resolved', 'Empresa não identificada'],

  // ── virements programmés ──
  ['Les virements programmés ne sont pas activés pour cette société.', 'Scheduled transfers are not enabled for this company.', 'As transferências agendadas não estão ativadas para esta empresa.'],
  ['Bénéficiaire introuvable', 'Beneficiary not found', 'Beneficiário não encontrado'],
  ['Date de départ invalide', 'Invalid start date', 'Data de início inválida'],
  ['La date de départ doit être dans le futur', 'The start date must be in the future', 'A data de início deve ser no futuro'],
  ['Virement programmé introuvable', 'Scheduled transfer not found', 'Transferência agendada não encontrada'],
  ['Introuvable', 'Not found', 'Não encontrado'],
  ['Seul un virement ACTIVE peut être suspendu', 'Only an ACTIVE transfer can be paused', 'Só uma transferência ACTIVE pode ser suspensa'],
  ['Seul un virement PAUSED peut être repris', 'Only a PAUSED transfer can be resumed', 'Só uma transferência PAUSED pode ser retomada'],

  // ── alertes de taux ──
  ['Les alertes de taux ne sont pas activées pour cette société.', 'Rate alerts are not enabled for this company.', 'Os alertas de taxa não estão ativados para esta empresa.'],
  ['Paire invalide : « {1} ». Exemple : EUR_GNF. Devises prises en charge : {2}.', 'Invalid pair: “{1}”. Example: EUR_GNF. Supported currencies: {2}.', 'Par inválido: «{1}». Exemplo: EUR_GNF. Moedas suportadas: {2}.'],
  ['Le seuil doit être positif', 'The threshold must be positive', 'O limiar deve ser positivo'],
  ['Vous ne pouvez pas garder plus de {1} alertes actives.', 'You cannot keep more than {1} active alerts.', 'Não pode manter mais de {1} alertas ativos.'],
  ['Alerte introuvable', 'Alert not found', 'Alerta não encontrado'],
  ['Alerte taux {1} 📊', 'Rate alert {1} 📊', 'Alerta de taxa {1} 📊'],
  ['Le taux {1} a dépassé votre seuil de {2}. Taux actuel : {3}', 'The {1} rate has exceeded your threshold of {2}. Current rate: {3}', 'A taxa {1} ultrapassou o seu limiar de {2}. Taxa atual: {3}'],
  ['Le taux {1} a passé sous votre seuil de {2}. Taux actuel : {3}', 'The {1} rate has dropped below your threshold of {2}. Current rate: {3}', 'A taxa {1} desceu abaixo do seu limiar de {2}. Taxa atual: {3}'],
  ['Taux "{1}" introuvable', 'Rate "{1}" not found', 'Taxa "{1}" não encontrada'],
  ['Aucun taux trouvé pour la paire {1}', 'No rate found for the pair {1}', 'Nenhuma taxa encontrada para o par {1}'],

  // ── photo de profil ──
  ['La photo de profil doit être une image (JPEG, PNG ou WebP).', 'The profile photo must be an image (JPEG, PNG or WebP).', 'A fotografia de perfil deve ser uma imagem (JPEG, PNG ou WebP).'],
  ['Photo trop lourde (2 Mo au plus). Choisissez une photo plus petite.', 'Photo too large (2 MB at most). Choose a smaller photo.', 'Fotografia demasiado pesada (máximo 2 MB). Escolha uma fotografia mais pequena.'],
  ['Photo vide ou illisible. Réessayez.', 'Empty or unreadable photo. Try again.', 'Fotografia vazia ou ilegível. Tente novamente.'],
  ['Aucune photo de profil.', 'No profile photo.', 'Sem fotografia de perfil.'],

  // ── suppression du compte ──
  ['Compte introuvable.', 'Account not found.', 'Conta não encontrada.'],
  ['La suppression de ce type de compte se fait par votre administrateur.', 'This type of account is deleted by your administrator.', 'A eliminação deste tipo de conta é feita pelo seu administrador.'],
  ["Aucun numéro de téléphone n'est enregistré sur ce compte. Contactez l'assistance pour le supprimer.", 'No phone number is registered on this account. Contact support to delete it.', 'Não existe número de telemóvel registado nesta conta. Contacte a assistência para a eliminar.'],
];

registerPhrases(WALLET_PHRASES);
