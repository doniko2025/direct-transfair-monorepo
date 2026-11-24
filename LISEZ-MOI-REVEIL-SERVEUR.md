# Réveiller le serveur Render plus vite

## 1. Le vrai remède : un ping externe toutes les 5 à 10 minutes (5 minutes, gratuit)
Render endort un service gratuit après 15 minutes sans requête ; il suffit d'une requête avant pour qu'il reste éveillé.
Ton workflow GitHub `keep-alive.yml` ne suffit pas (GitHub ne le lance que 3 à 4 fois par jour, comme le dit son en-tête).
1. Crée un compte gratuit sur **UptimeRobot** (ou **cron-job.org**).
2. Ajoute un moniteur HTTP(s) sur `https://direct-transfair-backend.onrender.com/api/health`, intervalle **5 minutes** (10 maximum).
3. Une fois qu'il tourne, mets la variable de dépôt GitHub `KEEP_ALIVE_ENABLED=false` pour arrêter le workflow inutile.
`/api/health` existe déjà : elle ne renvoie aucune donnée métier et teste aussi la base.

Limites : un service éveillé 24 h/24 consomme ~744 des 750 h gratuites du mois (un seul service gratuit tient). Render tolère mal ce procédé sur le plan gratuit : rien ne garantit qu'il le restera. Le plan **Starter (≈ 7 $/mois)** supprime définitivement la veille ; c'est la solution à retenir dès que de vrais clients utilisent l'app.

## 2. Dans l'app (ce pack)
- `app/index.tsx` : le serveur est réveillé **dès l'ouverture de l'app** et les taux sont relus **dès qu'il répond** (avant : jusqu'à 60 s d'attente après un réveil).
- Pendant le réveil, la carte affiche « Le serveur se réveille, quelques secondes… » au lieu d'un « Chargement du taux… » muet (fr/en/pt dans `i18n/messages/home.ts`).
Le réveil lui-même reste de 30 à 60 s côté Render : l'app ne peut que l'accélérer en le lançant plus tôt et le rendre moins pénible.

## Testé / non testé
Contrôle de types OK. Non testé sur appareil ni contre le vrai serveur endormi.
