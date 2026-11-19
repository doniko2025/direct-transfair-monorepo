# Lot 1 — Pilotage de l'administrateur de société

Copiez les fichiers du zip à la racine du monorepo (chemins conservés), puis :

```bash
cd apps/backend
pnpm prisma migrate deploy   # crée cash_closings, liquidity_rules, agent_targets + 4 valeurs d'enum
pnpm prisma generate
```

## Ce qui est ajouté

| Où | Quoi |
|---|---|
| **Agent** → « Clôture de caisse » (`/closing`) | Pour chaque devise de la caisse de l'agence : solde théorique, saisie des espèces comptées, écart calculé en direct, note. Rectifiable tant que l'administrateur n'a pas examiné l'écart. |
| **Admin** → « Caisses » (`/pilotage/caisses`) | Clôtures d'un jour, filtre « écarts seulement », caisses non clôturées, bouton « Marquer comme examiné » (avec note visible par l'agent), export CSV. |
| **Admin** → « Liquidité » (`/pilotage/liquidite`) | Jauge par agence et devise, seuils minimaux (une agence ou toutes), niveaux Confortable / À surveiller / Sous le seuil / Critique. |
| **Admin** → « Rentabilité » (`/pilotage/rentabilite`) | Par couloir (ex. EUR → GNF) : envois, volume, frais, commissions agents, part plateforme, marge nette estimée. Périodes 7/30/90 jours, ce mois, mois dernier. 3 exports CSV (rentabilité, toutes les opérations, clôtures). |
| **Admin** → « Objectifs agents » (`/pilotage/agents`) | Activité du mois, classement (médailles), objectif de volume et/ou d'opérations par agent, barre d'avancement. |

## Automatismes (backend)

- **Toutes les 15 minutes** : contrôle de liquidité. Une caisse sous son seuil crée une alerte `LOW_AGENCY_BALANCE` (HIGH, ou CRITICAL sous la moitié du seuil) et notifie les administrateurs. L'alerte se ferme toute seule quand la caisse remonte. Une seule alerte ouverte par agence et devise.
- **Écart de caisse** : toute clôture avec écart crée une alerte `CASH_VARIANCE` (gravité selon le % du solde : ≤1 % faible, ≤5 % moyenne, au-delà haute) et notifie les administrateurs.
- **Le 1er de chaque mois à 07:10 (heure du serveur)** : rapport d'activité du mois écoulé envoyé par courriel aux administrateurs (volume, frais, marge estimée, meilleurs agents, clôtures).
- Variables : `PILOTAGE_CRON=false` coupe les deux tâches sur une instance ; `PILOTAGE_MONTHLY_REPORT=false` coupe seulement le courriel.

## Choses à savoir

- **Marge nette = estimation** : frais perçus − commissions des agents − part de la plateforme. Elle ignore les coûts de structure et l'écart entre votre taux et le taux du marché.
- Seuls les envois (TRANSFER sortants) validés, en cours ou payés comptent. Les annulés, échoués, remboursés ou expirés sont exclus.
- Le classement des agents compte les envois et dépôts (pas les retraits) ; les ex æquo partagent le rang.
- Le super admin n'a pas accès à ces écrans (comme pour les factures : il ne voit pas les opérations des sociétés).
- Tout est filtré par société côté serveur ; les actions (clôture, examen, seuil, objectif) sont écrites dans le journal d'audit.
- Les jours de clôture suivent le fuseau de l'appareil de l'agent.

## Non vérifié ici

Les moteurs Prisma ne se téléchargent pas dans mon environnement : `prisma generate`, `migrate` et les tests qui touchent la base n'ont pas pu tourner. Vérifiés : 13 tests unitaires des règles (écart, liquidité, marge, objectifs, classement, mois), typage du backend (hors erreurs liées au client Prisma non généré), typage et build de web-admin. Les pages n'ont pas été testées visuellement avec de vraies données : un coup d'œil sur mobile après déploiement est conseillé.
