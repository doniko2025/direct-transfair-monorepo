// apps/backend/src/i18n/phrases/auth.ts — connexion, inscription, codes, sessions, appareils. [français du code, anglais, portugais]
import { registerPhrases, type Phrase } from '../phrase-book';

export const AUTH_PHRASES: readonly Phrase[] = [
  // ── auth.controller ──
  ['Numéro de téléphone requis', 'Phone number required', 'Número de telemóvel obrigatório'],
  ['Session invalide', 'Invalid session', 'Sessão inválida'],
  ['User not found', 'User not found', 'Utilizador não encontrado'],
  ['Utilisateur non trouvé', 'User not found', 'Utilizador não encontrado'],
  ['deviceId et platform requis', 'deviceId and platform are required', 'deviceId e platform são obrigatórios'],
  ['platform inconnue (IOS, ANDROID, WEB ou DESKTOP)', 'Unknown platform (IOS, ANDROID, WEB or DESKTOP)', 'Plataforma desconhecida (IOS, ANDROID, WEB ou DESKTOP)'],
  ['Champ appareil invalide ou trop long.', 'Invalid or too long device field.', 'Campo do dispositivo inválido ou demasiado longo.'],
  ['Appareil introuvable.', 'Device not found.', 'Dispositivo não encontrado.'],

  // ── auth.service ──
  ['Identifiant requis', 'Identifier required', 'Identificador obrigatório'],
  ['Identifiants incorrects', 'Incorrect credentials', 'Credenciais incorretas'],
  ['Compte suspendu', 'Account suspended', 'Conta suspensa'],
  ['Cette société a été désactivée. Contactez votre administrateur.', 'This company has been deactivated. Contact your administrator.', 'Esta empresa foi desativada. Contacte o seu administrador.'],
  ['Aucun canal de contact disponible', 'No contact channel available', 'Nenhum canal de contacto disponível'],
  ['Utilisateur introuvable', 'User not found', 'Utilizador não encontrado'],
  ['Ce compte a été désactivé.', 'This account has been deactivated.', 'Esta conta foi desativada.'],
  ['Compte verrouillé. Réessayez dans {1} minute(s).', 'Account locked. Try again in {1} minute(s).', 'Conta bloqueada. Tente novamente dentro de {1} minuto(s).'],
  ['Trop de tentatives échouées. Compte verrouillé {1} minutes.', 'Too many failed attempts. Account locked for {1} minutes.', 'Demasiadas tentativas falhadas. Conta bloqueada durante {1} minutos.'],
  ['Numéro de téléphone invalide', 'Invalid phone number', 'Número de telemóvel inválido'],
  ['Numéro de téléphone non reconnu.', 'Phone number not recognised.', 'Número de telemóvel não reconhecido.'],
  ['Cet email est déjà utilisé.', 'This email is already in use.', 'Este email já está a ser utilizado.'],
  ['Ce numéro est déjà utilisé.', 'This number is already in use.', 'Este número já está a ser utilizado.'],
  ['Société introuvable ({1}).', 'Company not found ({1}).', 'Empresa não encontrada ({1}).'],
  ["Cette société n'accepte plus de nouvelles inscriptions.", 'This company is no longer accepting new registrations.', 'Esta empresa já não aceita novas inscrições.'],
  ['Les comptes marchands ne sont pas ouverts pour l\'instant.', 'Merchant accounts are not open at the moment.', 'As contas de comerciante não estão abertas de momento.'],
  ['Ce RCCM est déjà associé à un autre compte marchand. Vérifiez-le ou contactez le support.', 'This RCCM is already linked to another merchant account. Check it or contact support.', 'Este RCCM já está associado a outra conta de comerciante. Verifique-o ou contacte o suporte.'],
  ['Utilisateur introuvable après création', 'User not found after creation', 'Utilizador não encontrado após a criação'],
  ['Compte introuvable', 'Account not found', 'Conta não encontrada'],
  ['Canal indisponible', 'Channel unavailable', 'Canal indisponível'],
  ['Veuillez patienter {1} seconde(s) avant de redemander un code.', 'Please wait {1} second(s) before requesting a new code.', 'Aguarde {1} segundo(s) antes de pedir um novo código.'],
  ['Trop de demandes de code récentes. Réessayez dans {1} minutes.', 'Too many recent code requests. Try again in {1} minutes.', 'Demasiados pedidos de código recentes. Tente novamente dentro de {1} minutos.'],
  ['Mot de passe trop court', 'Password too short', 'Palavra-passe demasiado curta'],
  ['Code invalide ou expiré', 'Invalid or expired code', 'Código inválido ou expirado'],
  ['Trop de tentatives incorrectes. Demandez un nouveau code.', 'Too many incorrect attempts. Request a new code.', 'Demasiadas tentativas incorretas. Peça um novo código.'],
  ['Refresh token manquant', 'Refresh token missing', 'Token de atualização em falta'],
  ['Refresh token expiré', 'Refresh token expired', 'Token de atualização expirado'],
  ['Ce numéro de téléphone est déjà utilisé.', 'This phone number is already in use.', 'Este número de telemóvel já está a ser utilizado.'],
  ['Erreur lors de la mise à jour du profil.', 'Error while updating the profile.', 'Erro ao atualizar o perfil.'],
  ['Ancien code secret incorrect.', 'Current secret code is incorrect.', 'O código secreto atual está incorreto.'],
  ['Le nouveau code doit faire au moins 6 caractères.', 'The new code must be at least 6 characters long.', 'O novo código deve ter pelo menos 6 caracteres.'],
  ["Le nouveau code doit être différent de l'ancien.", 'The new code must be different from the old one.', 'O novo código deve ser diferente do anterior.'],

  // ── jwt-auth.guard ──
  ['Missing Authorization header', 'Missing Authorization header', 'Cabeçalho Authorization em falta'],
  ['Invalid Authorization header', 'Invalid Authorization header', 'Cabeçalho Authorization inválido'],
  ['Invalid token payload', 'Invalid token payload', 'Conteúdo do token inválido'],
  ['Ce compte a été désactivé. Reconnectez-vous ou contactez votre administrateur.', 'This account has been deactivated. Sign in again or contact your administrator.', 'Esta conta foi desativada. Inicie sessão novamente ou contacte o seu administrador.'],
  ['Ce compte est suspendu.', 'This account is suspended.', 'Esta conta está suspensa.'],
  ['Session terminée. Reconnectez-vous.', 'Session ended. Please sign in again.', 'Sessão terminada. Inicie sessão novamente.'],
  ['Invalid token: missing clientId', 'Invalid token: missing clientId', 'Token inválido: clientId em falta'],
  ['Tenant mismatch (token clientId={1}, tenant clientId={2}). Reconnectez-vous pour obtenir un nouveau token.', 'Tenant mismatch (token clientId={1}, tenant clientId={2}). Sign in again to get a new token.', 'Incompatibilidade de empresa (clientId do token={1}, clientId da empresa={2}). Inicie sessão novamente para obter um novo token.'],
  ['Invalid token', 'Invalid token', 'Token inválido'],

  // ── connexion unique plateforme ──
  ['Assertion invalide ou expirée.', 'Invalid or expired assertion.', 'Asserção inválida ou expirada.'],
  ['Assertion incomplète.', 'Incomplete assertion.', 'Asserção incompleta.'],
  ["Durée de vie de l'assertion trop longue.", 'Assertion lifetime too long.', 'Duração da asserção demasiado longa.'],
  ["Ce compte n'est pas autorisé à utiliser la connexion unique.", 'This account is not allowed to use single sign-on.', 'Esta conta não está autorizada a utilizar o início de sessão único.'],
  ['Assertion déjà utilisée.', 'Assertion already used.', 'Asserção já utilizada.'],

  // ── sessions ──
  ['Session introuvable ou déjà fermée.', 'Session not found or already closed.', 'Sessão não encontrada ou já terminada.'],
  ['Reconnectez-vous pour utiliser cette fonction.', 'Sign in again to use this feature.', 'Inicie sessão novamente para utilizar esta funcionalidade.'],

  // ── v2-auth (téléphone, codes, vérification) ──
  ['Numéro de téléphone ou adresse email requis', 'Phone number or email address required', 'Número de telemóvel ou endereço de email obrigatório'],
  ['Code OTP invalide ou expiré. Demandez un nouveau code.', 'Invalid or expired code. Request a new code.', 'Código inválido ou expirado. Peça um novo código.'],
  ['Adresse email déjà vérifiée.', 'Email address already verified.', 'Endereço de email já verificado.'],
  ['Numéro de téléphone déjà vérifié.', 'Phone number already verified.', 'Número de telemóvel já verificado.'],
  ['Code invalide ou expiré. Demandez un nouveau code.', 'Invalid or expired code. Request a new code.', 'Código inválido ou expirado. Peça um novo código.'],
  ['Compte désactivé. {1}', 'Account deactivated. {1}', 'Conta desativada. {1}'],
  ['Cette plateforme est actuellement inactive.', 'This platform is currently inactive.', 'Esta plataforma está atualmente inativa.'],
  ['Compte temporairement verrouillé. Réessayez dans {1} minute(s).', 'Account temporarily locked. Try again in {1} minute(s).', 'Conta temporariamente bloqueada. Tente novamente dentro de {1} minuto(s).'],
  ['Trop de codes envoyés. Réessayez dans 1 heure.', 'Too many codes sent. Try again in 1 hour.', 'Demasiados códigos enviados. Tente novamente dentro de 1 hora.'],
  ['Compte verrouillé {1} min après {2} tentatives échouées.', 'Account locked for {1} min after {2} failed attempts.', 'Conta bloqueada durante {1} min após {2} tentativas falhadas.'],

  // ── gardes et résolution de la société ──
  ['Utilisateur non authentifié', 'User not authenticated', 'Utilizador não autenticado'],
  ['Accès administrateur requis (Rôle actuel: {1})', 'Administrator access required (current role: {1})', 'Acesso de administrador necessário (função atual: {1})'],
  ['Missing x-tenant-id header', 'Missing x-tenant-id header', 'Cabeçalho x-tenant-id em falta'],
  ['Unknown or inactive tenant: {1}', 'Unknown or inactive tenant: {1}', 'Empresa desconhecida ou inativa: {1}'],

  // ── règle du code secret (src/common/pin-policy.ts) ──
  ['{1} doit contenir exactement 6 chiffres.', '{1} must contain exactly 6 digits.', '{1} deve ter exatamente 6 dígitos.'],
  ['Le code doit contenir exactement 6 chiffres.', 'The code must contain exactly 6 digits.', 'O código deve ter exatamente 6 dígitos.'],
  ['Évitez les chiffres identiques (ex. 000000).', 'Avoid identical digits (e.g. 000000).', 'Evite dígitos iguais (ex. 000000).'],
  ['Évitez les chiffres qui se suivent (ex. 123456).', 'Avoid consecutive digits (e.g. 123456).', 'Evite dígitos consecutivos (ex. 123456).'],
  ['Évitez 4 chiffres qui se suivent (ex. 1234).', 'Avoid 4 consecutive digits (e.g. 1234).', 'Evite 4 dígitos consecutivos (ex. 1234).'],
  ['Évitez les motifs répétés (ex. 121212 ou 123123).', 'Avoid repeated patterns (e.g. 121212 or 123123).', 'Evite padrões repetidos (ex. 121212 ou 123123).'],
  ['Évitez les chiffres doublés (ex. 112233).', 'Avoid doubled digits (e.g. 112233).', 'Evite dígitos duplicados (ex. 112233).'],
  ['Évitez les codes symétriques (ex. 123321).', 'Avoid symmetric codes (e.g. 123321).', 'Evite códigos simétricos (ex. 123321).'],
  ['Utilisez au moins 3 chiffres différents.', 'Use at least 3 different digits.', 'Utilize pelo menos 3 dígitos diferentes.'],
  ['Évitez 4 chiffres identiques à la suite.', 'Avoid 4 identical digits in a row.', 'Evite 4 dígitos iguais seguidos.'],
  ['Ce code est trop courant. Choisissez-en un moins prévisible.', 'This code is too common. Choose a less predictable one.', 'Este código é demasiado comum. Escolha um menos previsível.'],
  ['Évitez une date (naissance, anniversaire…).', 'Avoid a date (birth, anniversary…).', 'Evite uma data (nascimento, aniversário…).'],
  ['Évitez votre date de naissance.', 'Avoid your date of birth.', 'Evite a sua data de nascimento.'],
  ['Évitez un morceau de votre numéro de téléphone.', 'Avoid part of your phone number.', 'Evite uma parte do seu número de telemóvel.'],
];

registerPhrases(AUTH_PHRASES);
