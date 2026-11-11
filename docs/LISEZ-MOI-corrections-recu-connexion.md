# Corrections : reçu PDF, accueil, connexion
Extraire à la racine du monorepo (écrase les fichiers).

1. `services/transferReceipt.ts` — le QR du PDF était illisible : l'image renvoyée par le composant QR est du base64 brut, sans le préfixe `data:image/png;base64,` (carré vide dans le PDF). Préfixe ajouté ; QR plus grand (150 px, fond blanc) ; mise en page du PDF limitée à 560 px pour ne plus déborder à droite (WhatsApp / lecteurs PDF).
2. `components/home/HomeParts.tsx` + `ClientDashboard.tsx` + `MerchantDashboard.tsx` — photo, scan et notifications sur la 1re ligne ; « Bonsoir, <nom> » sur sa propre ligne (nom complet, plus tronqué) ; les onglets « Compte client / marchand » descendent à leur tour.
3. `app/(auth)/login-v2.tsx` — sans soulignement ; « Autres options de connexion » + « Code oublié ? » sur une ligne ; « Pas encore de compte ? » + « Créer un compte » sur une ligne ; Assistance · Conditions · Confidentialité sur une ligne ; polices réduites.
4. `components/auth/AuthShell.tsx` — logo remonté (ne touche plus la carte) ; carte resserrée (marges haut/bas réduites) pour épouser le contenu compacté.
