# Lot 8 — Photo de la pièce des clients de passage, expiration des pièces, journalisation

Trois points restés ouverts après le lot 7 : la pièce du client de passage n'était que recopiée, aucune alerte n'annonçait l'expiration d'une pièce,
et la consultation d'une pièce par un administrateur n'était pas tracée. Aucun commit ni push n'a été fait : appliquez les fichiers du zip puis commitez vous-même.

## 1. Photographier la pièce du client de passage (envoi au comptoir)
- Écran **Envoi cash** (agent) : sous les références de la pièce, un bloc **« Photo de la pièce »** (recto, et **verso** pour une carte d'identité, un permis ou un titre de séjour).
  Sur téléphone il ouvre l'appareil photo arrière ; sur ordinateur, le sélecteur de fichier. La photo est **réduite dans le navigateur** (1 600 px, JPEG, moins de 1 Mo en général) avant l'envoi. Boutons Reprendre / Retirer, aperçu.
- **Règle serveur** : la photo est **obligatoire au premier envoi d'une personne**, et à nouveau si la pièce est **renouvelée** (autre date d'expiration ou autre type). Ensuite la photo enregistrée est réutilisée (pas besoin de rephotographier à chaque envoi).
  Sans photo : **400 `COUNTER_ID_PHOTO_REQUIRED`** (l'écran affiche alors les cadres en rouge et exige les photos avant de renvoyer) ; fichier illisible, trop petit (< 8 Ko), trop lourd (> 6 Mo) ou qui n'est pas une image : **400 `COUNTER_ID_PHOTO_INVALID`**.
- Les photos sont stockées en base (table `counter_id_files`, comme les pièces KYC des clients), jamais servies sans jeton, réponses `no-store`.
- **Consultation par l'administrateur** : nouvelle page **Vérifications KYC › Clients de passage** (liste avec recherche nom / téléphone / n° de pièce, numéro **masqué** en liste) puis **fiche** : identité déclarée, numéro complet, photos recto/verso avec zoom et rotation, derniers envois.
  Réservé aux administrateurs de la société (le super administrateur voit tout) ; une fiche d'une autre société répond 404.
- Corps de requête : **`POST /api/transactions` accepte maintenant jusqu'à 18 Mo** (comme `/api/kyc/documents`) pour porter les photos. Toutes les autres routes gardent 100 Ko.
  Si un reverse proxy (nginx, Cloudflare…) limite la taille des requêtes en amont, relevez-la pour ces deux routes (nginx : `client_max_body_size 20m;`).

## 2. Expiration de la pièce d'identité
- **Rappels à 30 puis 7 jours** avant la date d'expiration : notification dans l'application + push + e-mail, chaque seuil **une seule fois** par pièce (compare-and-set : sûr avec plusieurs instances). Tâche quotidienne de 10 h (Paris), la même que les rappels KYC.
  Pas d'alerte si le client a déjà déposé une pièce de remplacement en attente ou possède une autre pièce valable plus longtemps. `KYC_ENFORCEMENT=off` coupe aussi ces alertes.
- **Renouvellement avant l'échéance** : jusqu'ici un client déjà vérifié ne pouvait pas renvoyer une pièce du même type (409). Dans les 30 jours avant l'échéance, c'est maintenant permis ; **l'ancienne pièce reste valable pendant que l'administrateur vérifie la nouvelle** (aucune coupure de service).
- **Blocage dès l'expiration, sans attendre le job de nuit** : une pièce d'identité périmée (le lendemain de sa date de fin) bloque immédiatement les **envois**, les **virements programmés** (création et exécutions) → 403 `KYC_REQUIRED` avec le statut `EXPIRED` et un message clair. Une autre pièce valable débloque. Avant ce lot, le client restait autorisé jusqu'à 3 h 40 du matin suivant.
  Le job de nuit (3 h 40) continue de marquer les pièces EXPIRED et de ramener le niveau à 0 ; le client est prévenu et relancé ensuite.
- **Application mobile** : la bannière de l'accueil réapparaît 30 jours avant l'échéance (« Pièce bientôt expirée », rouge à 7 jours), l'écran Vérification d'identité affiche l'échéance et un bouton **Renouveler** ; après expiration, un avis rouge explique ce qui est bloqué.
- **Portail administrateur** : le dossier d'un client affiche l'avis « bientôt expirée / expirée » ; **Relancer** fonctionne aussi pour un client dont la pièce vient d'expirer (avant : refus « déjà vérifié »).
- `GET /kyc/me` et le dossier admin exposent un nouveau champ `expiry` (`{ type, label, expiryDate, daysLeft, expired }`, ou `null`).

## 3. Journalisation
Trois nouvelles actions dans le journal d'audit (écran Supervision, libellés ajoutés web et mobile) :
- **`KYC_VIEW`** — un administrateur a consulté : un **dossier client**, le **recto/verso d'une pièce**, une **fiche de client de passage** ou sa photo. On enregistre l'auteur, la société, l'objet, le côté (recto / verso / dossier) et le client concerné.
  Le client qui relit sa **propre** pièce n'est pas journalisé. Une même consultation répétée dans les **10 minutes** par la même personne ne crée pas de doublon.
  Une panne du journal ne bloque pas la consultation (erreur tracée dans les logs serveur).
- **`KYC_REMIND`** — relance manuelle d'un client par un administrateur (qui, quand, numéro de la relance).
- **`KYC_COUNTER_ID`** — une photo de pièce a été prise au comptoir (agent, fiche, recto/verso, pièce renouvelée ou non).

## À faire pour déployer
1. Appliquer le zip, puis `pnpm --filter backend prisma migrate deploy` : migration **`20261108090000_kyc_expiry_notices_and_counter_id_photos`** (idempotente : 2 colonnes, 1 table, 3 valeurs d'enum ; aucune donnée modifiée).
2. `pnpm --filter backend prisma generate`, puis redémarrer le backend (la limite de corps de `POST /api/transactions` est lue au démarrage).
3. Vérifier la limite de taille de requête du reverse proxy (voir plus haut).
4. Les fiches de passage créées avant ce lot n'ont pas de photo : la photo sera exigée à leur prochain envoi (affichées « Sans photo » dans la liste admin).

## Points d'attention
- Une pièce **sans date d'expiration** ne peut pas expirer ; toutes les pièces d'identité exigent une date à l'envoi, donc ce cas ne concerne que d'anciennes données.
- Le jour de la date d'expiration, la pièce est encore valable ; elle bloque à partir du lendemain (« jours restants » compte le jour d'expiration).
- Les photos du comptoir ne sont pas supprimées automatiquement : prévoir une durée de conservation avec votre juriste (obligation de conservation des pièces LCB-FT, en général 5 ans après la fin de la relation).

## Vérifications effectuées
- Backend : `tsc` propre, **718 tests** verts (dont nouveaux : règles d'expiration, garde bloquante, alertes 30/7 jours, renouvellement, photos du comptoir, journal KYC_VIEW / KYC_REMIND, consultation admin des clients de passage).
- Web-admin : `tsc` + `vite build` OK. Mobile et package partagé : `tsc` OK.
- Limite de corps testée sur un serveur Express : 1 Mo accepté sur `POST /api/transactions`, refusé (413) sur les autres routes.

## Suggestions pour la suite
- Afficher à l'agent, dès la saisie du numéro de pièce, si cette personne a déjà une photo enregistrée (évite d'en demander une inutilement) via un petit endpoint de recherche par pièce.
- Durée de conservation + purge automatique des photos des fiches inactives.
- Alerte conformité quand un même administrateur consulte un nombre inhabituel de pièces dans une heure (le journal `KYC_VIEW` le permet désormais).
