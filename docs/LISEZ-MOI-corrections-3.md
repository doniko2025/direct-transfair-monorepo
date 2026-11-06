# Lot 3 — Écran « Appareils connectés » (sessions)

À appliquer avec les lots 1 et 2 (les fichiers de ce lot sont plus récents : en cas de doublon, gardez ceux du lot 3).
Aucune migration, aucune nouvelle variable d'environnement. Aucun commit ni push.

## Ce qui est ajouté
- **Web (Mon compte)** : carte « Appareils connectés » — liste des sessions ouvertes, « Cet appareil » repéré,
  « Déconnecter » (confirmation en deux temps) et « Déconnecter tous les autres appareils ». Une colonne et boutons
  pleine largeur sur téléphone.
- **Mobile (Profil › Appareils connectés)** : section « Sessions ouvertes » en cartes animées, même actions ; la liste
  des appareils de notifications reste en dessous, renommée « Appareils (notifications) ».
- **Serveur** : `GET /auth/sessions` marque la session courante et masque les sessions expirées ;
  `DELETE /auth/sessions/:id` répond 404 si la session n'est pas à vous (avant : « succès » dans tous les cas) ;
  nouveau `POST /auth/sessions/revoke-others`. Chaque fermeture est écrite dans le journal d'audit.
- **Package partagé** : `api.sessions` et `describeSession`.

## Bug corrigé au passage
Sur mobile, « Déconnecter » un appareil n'a **jamais** fonctionné : l'application envoyait l'identifiant de la fiche
appareil, le serveur cherchait l'identifiant matériel, ne trouvait rien et répondait « succès ». De plus la session de
l'appareil restait ouverte. `DELETE /auth/devices/:id` accepte maintenant les deux identifiants, répond 404 si inconnu,
coupe le jeton de notifications et ferme les sessions liées à l'appareil.

## À savoir
- Les sessions ouvertes **avant** le lot 2 n'ont pas d'identifiant de session dans leur jeton : jusqu'à leur
  prochain renouvellement (ou reconnexion), « Déconnecter tous les autres » répond « Reconnectez-vous ».
- Le lien session ↔ fiche appareil n'est renseigné que pour les connexions par code (OTP). Pour couper un appareil
  à coup sûr, utilisez la liste « Sessions ouvertes ».
- La session de l'appareil courant ne se ferme pas depuis cet écran : utilisez « Se déconnecter ».

## Vérifications
`tsc` sans erreur (backend, partagé, web-admin, mobile) · build Vite OK · Jest : 53 suites, 529 tests verts.
