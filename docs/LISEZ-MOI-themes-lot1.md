# Thème clair / sombre — Lot 1 (socle + Préférences + écrans clés)

## Ce que ça apporte
- **Page « Préférences »** (Profil → Préférences, comptes client ET marchand) : trois cartes avec aperçu animé — **Clair**, **Sombre**, **Automatique** (suit le téléphone, en direct) — et le choix de la langue.
- **Pastille soleil / lune** sur les écrans de connexion, à côté de la pastille de langue.
- Le choix est **immédiat** et **mémorisé** sur l'appareil ; premier lancement = Automatique.
- Textes FR / EN / PT (préfixe `th.*`, fichier `i18n/messages/theme.ts`).

## Comment ça marche (pour la suite)
- `providers/ThemeProvider.tsx` : `useTheme()` → `{ mode, scheme, isDark, setMode }`.
- `components/ui/themeMode.ts` : état du thème + neutres clair/sombre (`LIGHT_N` / `DARK_N`).
- `buildColors(primary, secondary, scheme)` : **une seule palette sombre** (mêmes clés que la claire) → tous les écrans qui passent par `useUI()` / `C` basculent tout seuls. Les couleurs de marque des sociétés sont conservées (teintes éclaircies automatiquement pour rester lisibles sur fond sombre, contraste ≥ 4,8:1 vérifié).
- `N` (neutres des écrans d'authentification / wallet) est devenu « vivant » : `N.ink`, `N.surface`… suivent le thème. Les feuilles de style créées au chargement du module sont enveloppées dans `themed(() => StyleSheet.create({…}))` (déjà existant, `wallet/brand.ts`) pour se recalculer.
- Règle pour un nouvel écran : couleurs via `useUI().C` ou `N` ; jamais de `#FFFFFF` / `#111111` en dur pour un fond ou un texte courant.

## Adapté dans ce lot
Socle (fournisseur, palettes, `useUI`, `useWalletTheme`, `useAuthPalette`), `app/_layout.tsx` (barre d'état, fond de navigation), composants `ui/*`, `wallet/*` (cartes, lignes de transaction, pastilles de statut, squelettes), tous les écrans d'authentification (connexion avec **mer de nuit**, inscription, mot de passe oublié, OTP, CGU, confidentialité, assistance), accueil, envoi (devise incluse), activité, profil (+ Préférences), pastille de langue, icônes soleil / lune / contraste / palette.

## Volontairement laissé en clair
Reçus (écran et PDF/HTML partagés), QR codes (fond blanc nécessaire au scan), caméra/scanner, en-têtes dégradés de marque, logo.

## Pas encore adapté (lot suivant)
Écrans agent, admin et tableaux de bord société / super-admin (peu utilisés sur mobile), modale de recharge d'agence. Ils restent en clair en mode sombre. Dites-moi si vous voulez que je les traite.

## ⚠️ Application
- **Reconstruire l'application** (build EAS / `expo run`) : `app.json` passe `userInterfaceStyle` de `light` à `automatic`. Sans nouveau build natif, Android peut rester en clair.
- Appliquer après les lots 1–8 langues ; aucun changement serveur, aucune migration, aucune nouvelle dépendance.

## Vérifications
- `npx tsc --noEmit` : aucune erreur ; catalogue 2060 clés / 0 problème.
- Test d'exécution du cœur du thème (esbuild + node) : `N` vivant, `themed()` recalculé au changement et stable sans changement, palettes clair/sombre aux mêmes clés, 4 couleurs de marque × 2 thèmes valides.
- Non testé à l'écran (pas d'appareil ici) : passez en revue connexion, accueil, envoi, activité, profil, Préférences dans les trois modes.
