# Lot 3b — Import automatique des listes officielles de sanctions

Complète le lot « Conformité et robustesse » : au lieu de saisir ou d'importer des noms à la main, chaque société peut **activer** les listes officielles **ONU**, **OFAC** (États-Unis) et **Union européenne**. Elles sont téléchargées chaque nuit, tenues à jour sans intervention, et comparées à chaque envoi ainsi qu'à toute la clientèle.

## Ce que ça fait
- **Une seule copie en base** (tables `official_list_entries` / `official_list_syncs`), partagée par toutes les sociétés ; chaque société choisit ses listes (`compliance_settings.officialLists`).
- **Téléchargement de nuit à 03:30** (`OFFICIAL_LISTS_CRON=false` pour le couper sur une instance). Seules les listes activées par au moins une société sont téléchargées.
- **Mise à jour différentielle** : une fiche nouvelle est créée, une fiche modifiée est mise à jour, une fiche retirée de la liste est **désactivée** (jamais supprimée : les anciens dossiers restent lisibles).
- **Fichier identique à la veille** (empreinte SHA-256) : rien n'est écrit.
- **Garde-fous** : un fichier vide, une page d'erreur ou un fichier amputé de plus de moitié est **refusé** ; la liste en place reste intacte. Seules les adresses `https` sont acceptées (redirections comprises), avec délai de 90 s et plafond de 150 Mo.
- **Dès qu'une liste change** : l'index mémoire est invalidé et la clientèle des sociétés utilisatrices est re-contrôlée ; les administrateurs ne sont prévenus que s'il y a de **nouveaux** dossiers (un dossier par client et par fiche, jamais de doublon).
- **Liste périmée** (plus de 3 jours sans mise à jour réussie) : avertissement sur la carte + notification quotidienne aux administrateurs concernés.
- **Rapidité** : index par préfixe/suffixe de mot (`NameIndex`) — 20 000 fiches interrogées en ~85 ms ; l'index est gardé 10 min en mémoire.
- **Aucune marque de blocage supplémentaire** : une correspondance avec une liste officielle suit exactement les mêmes réglages que les listes de la société (seuil de signalement, seuil fort, blocage automatique facultatif, pas d'information du client).

## Écran
Conformité → **Listes** : une carte par liste (ONU, OFAC, UE) avec interrupteur d'activation, état (à jour / en cours / périmée / échec), nombre de fiches, ajouts et retraits de la dernière mise à jour, bouton **Actualiser** (délai de 10 min entre deux demandes, la liste étant partagée). Le test d'un nom et les dossiers indiquent la **source** de la correspondance (ONU, OFAC, UE).

## API (administrateur de société)
- `GET /compliance-admin/official-lists`
- `PUT /compliance-admin/official-lists/:provider` `{ "enabled": true }` — `UN | OFAC | EU`
- `POST /compliance-admin/official-lists/:provider/sync` (202, en arrière-plan)
- `PUT /compliance-admin/settings` accepte aussi `officialLists: ["UN","OFAC"]`.

## Mise en route
1. Appliquer la migration `20261119190000_official_lists` (`npx prisma migrate deploy`), puis `npx prisma generate`.
2. ONU et OFAC fonctionnent sans réglage (adresses par défaut, surchargeables : voir `.env.example`).
3. **UE** : pas d'adresse par défaut. Créez un compte sur le portail « Financial Sanctions Files » de la Commission européenne, copiez l'adresse de téléchargement du fichier XML (jeton compris) dans `OFFICIAL_LIST_EU_URL`.
4. Conformité → Listes : activer une liste → le téléchargement démarre (quelques secondes) puis la clientèle est contrôlée.

## ⚠️ À vérifier au premier déploiement (je n'ai pas pu le faire ici)
Mon environnement n'a **aucun accès réseau** vers ces sites ni de base de données : les lecteurs (`official-parsers.ts`) sont écrits d'après les formats publiés et testés sur des **extraits fabriqués**, pas sur les vrais fichiers.
- Après l'activation d'une liste, vérifiez que le nombre de fiches est plausible (ordre de grandeur : ONU ≈ 1 000, OFAC ≈ 17 000, UE ≈ 4 000–5 000). Si la carte affiche « Échec » avec « Aucune fiche lisible », le format a changé ou l'adresse est mauvaise : rien n'a été modifié, envoyez-moi les premières lignes du fichier.
- Les adresses par défaut de l'OFAC (`treasury.gov/ofac/downloads`) peuvent être redirigées vers leur nouveau service ; si besoin, renseignez `OFFICIAL_LIST_OFAC_SDN_URL` / `OFFICIAL_LIST_OFAC_ALT_URL`.
- Les noms d'attributs du fichier UE (`wholeName`, `logicalId`, `countryIso2Code`…) sont ceux que je connais ; ils sont à confirmer sur un vrai fichier.
- Partie base de données (migration, `createMany`, `groupBy`) : testée avec une base simulée, pas avec PostgreSQL.

## Limites
- Le rapprochement est un rapprochement de **noms** (tolérant aux fautes, aux alias et à l'ordre des mots) : il signale, un humain décide. Il ne remplace pas une solution de filtrage agréée si votre régulateur en exige une.
- Les noms d'un seul mot (ex. « Diallo ») ne correspondent qu'à un nom d'un seul mot, pour ne pas signaler tous les Diallo.
- Le cache est par processus : en déploiement multi-instances, une nouvelle liste est vue par les autres instances au plus tard après 10 min.

## Fichiers
Backend : `compliance/official-parsers.ts`, `official-diff.ts`, `official-index.ts`, `official-lists.service.ts`, `official-lists.scheduler.ts` (+ 3 specs), `compliance.core.ts`, `compliance.service.ts`, `compliance.controller.ts`, `compliance.module.ts`, `dto/compliance.dto.ts`, `name-matching.ts`, `prisma/schema.prisma`, migration `20261119190000_official_lists`, `.env.example`.
Partagé : `packages/shared/src/compliance.ts`. Web : `pages/compliance/OfficialListsSection.tsx`, `WatchlistPage.tsx`, `CompliancePage.tsx`, `lib/complianceRules.ts`, `styles/compliance.css`.
