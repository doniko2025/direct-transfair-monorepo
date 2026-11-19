# Lot 2b — Application mobile : croissance

À appliquer **après** le lot 2 (même contrat d'API). Copiez les fichiers du zip aux mêmes chemins ; aucune migration, aucune dépendance nouvelle. Le zip contient aussi 2 petits correctifs backend (`growth.core.ts`, `growth.service.ts`) et le type partagé `growth.ts` — à appliquer avec le reste (redémarrer le backend).

## Ce que voient vos clients

### Envoi : taux garanti avec compte à rebours
À l'étape de confirmation, l'app demande au serveur de garantir le montant reçu (`POST /rate-locks`). Une pastille « Taux garanti · 9:42 » avec barre qui se vide s'affiche (orange sur la dernière minute) et le montant reçu affiché est le montant garanti. L'envoi joint `rateLockId` s'il est encore valable.
- À l'expiration, le taux est **renouvelé automatiquement** ; si le montant reçu change, un bandeau le signale.
- Si le serveur refuse la garantie (400), l'app en redemande une ; après deux refus elle n'insiste plus et l'envoi se fait au taux du moment (comme avant) : la garantie ne peut jamais bloquer un envoi.
- La garantie n'entre **pas** dans la clé d'idempotence : une coupure réseau suivie d'un renouvellement ne peut pas produire un deuxième envoi.

### Envoi sans frais (parrainage)
Si le client a des envois offerts, les frais passent à « Offerts » à l'étape de confirmation, avec un bandeau « Parrainage : cet envoi est sans frais · N envois restants ». Le serveur reste juge et applique la même règle.

### Demander de l'argent
Accueil → carte « Demander de l'argent » (badge = demandes à régler). Écran `Demandes d'argent` : onglets Reçues / Envoyées, cartes animées, statuts (En attente, Réglée, Refusée, Annulée, Expirée).
- **Nouvelle demande** : téléphone (avec indicatif), montant dans votre devise, motif facultatif.
- **Payer** ouvre l'envoi avec le destinataire déjà rempli (et le montant si la devise est la vôtre) ; la demande passe seule à « Réglée » après l'envoi.
- Refuser / annuler : confirmation demandée. Notification + push au payeur (nouvelle demande) et au demandeur (réglée / refusée) ; un toucher ouvre l'écran.

### Parrainage
- **Correctif important** : l'écran affichait un code fabriqué sur le téléphone (3 lettres du prénom + début de l'identifiant), qui ne correspondait à aucun code connu du serveur : un filleul qui le saisissait n'était jamais rattaché. L'écran affiche maintenant le **vrai code** du compte (`GET /referrals/me`) ; tant qu'il n'est pas chargé, rien n'est partagé.
- Ajouts : envois sans frais restants, prochaine expiration, amis parrainés, règle du programme réglée par la société (ou message « programme inactif »), liste des récompenses.
- **Inscription** : champ « Code de parrainage (facultatif) » à l'étape contact (comptes clients), prérempli si l'app est ouverte avec `/register?ref=CODE`.
- Carte d'accueil « Parrainer un ami » (avec le nombre d'envois offerts).

Textes en français, anglais et portugais.

## Fichiers
- Nouveaux : `app/money-requests/index.tsx`, `app/money-requests/new.tsx`, `components/home/GrowthCards.tsx`, `components/send/RateLockBadge.tsx`, `hooks/useRateLock.ts`, `hooks/useMyReferral.ts`, `i18n/messages/growth.ts`, `services/growthTypes.ts`.
- Modifiés : `app/(tabs)/send.tsx`, `app/referral.tsx`, `app/(auth)/register.tsx`, `components/dashboards/ClientDashboard.tsx`, `services/api.ts` (6 méthodes ajoutées, aucune modifiée), `services/notificationRouting.ts`, `i18n/catalog.ts`, `components/ui/iconNodes.ts` (icône « cadeau »).
- Backend : notifications de demandes d'argent et de parrainage avec lien vers l'écran + push, téléphone de l'autre partie dans la liste des demandes.

## À savoir
- **Vérifié** : compilation TypeScript de toute l'app mobile (0 erreur), du partagé, tests backend de la croissance (23). **Non vérifié** : rendu sur téléphone (animation du compte à rebours, mise en page) — je n'ai pas pu lancer l'app ici ; testez l'envoi avec un montant, la demande d'argent entre deux comptes de test, et l'inscription avec un code.
- Le lien de partage utilise le portail web de la société (`/register?ref=CODE`) : le formulaire d'inscription web doit lire `ref` pour préremplir le code ; l'app, elle, le lit déjà.
- Le rapprochement d'une demande réglée se fait quand on ouvre la liste (ou l'accueil) ; il couvre les envois vers un portefeuille, payés immédiatement.
