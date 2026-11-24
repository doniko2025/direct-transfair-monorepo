# Séparation des rôles : Direct Transf'air (plateforme) / Flash Transfer (société)

## Les deux identités
| | **Direct Transf'air** (société mère, plateforme) | **Flash Transfer** (société hébergée) |
|---|---|---|
| Logo | monogramme « t’ » (vert, apostrophe jaune) | nouvel emblème éclair + orbite (dossier `logos/flash-transfer/`) |
| Où il apparaît | icône et écran de démarrage de l'APK, portail web de la plateforme, courriels de la plateforme (bienvenue d'une société…) | accueil, connexion, reçus, contrats, portail web de la société |
| D'où il vient | configuration de la plateforme (`EXPO_PUBLIC_PLATFORM_*`, `VITE_PLATFORM_*`) | uniquement la fiche de la société (champ « Logo », section « Apparence ») |

Le code garantit déjà qu'une société n'emprunte pas le logo de la plateforme (reçus, contrats et courriels de société lisent la fiche de la société). Ce pack comble les trous restants et rend l'erreur visible.

## Pourquoi tu vois le logo bleu sur Flash Transfer
Je n'ai pas accès à ta base. Mais l'app n'affiche que le `logoUrl` de la fiche société : **la fiche Flash Transfer contient donc cette image bleue** (probablement le logo AssoGlobal, qui est aussi l'icône « Gestion » de ton téléphone). Ce n'est pas un bug de code.

**À faire maintenant (2 minutes, sans nouveau build)**
1. Web-admin, Sociétés, **Flash Transfer**, section **Apparence**, Logo : téléverse `logos/flash-transfer/flash-transfer-icon-1024.png`.
2. Si la fiche de la société système (Direct Transf'air / DONIKO) porte aussi l'image bleue : remplace-la par `logos/direct-transfair-plateforme/logo-mark.png` (le « t’ » d'origine).
3. L'app relit la marque au retour au premier plan (5 min max) : le nouveau logo apparaît sans réinstaller.

## Ce que ce pack change dans le code
**Mobile**
- `providers/TenantProvider.tsx` : le cache d'une société ne peut plus hériter du logo de la plateforme (un ancien cache sans logo reprenait celui de la plateforme).
- `components/brand/BrandMark.tsx` + `BrandLogo.tsx` : une société sans logo affiche **son monogramme** (initiales, ex. « FT », sur sa couleur d'accent) à la place d'une icône générique. Le « t’ » reste réservé à la plateforme.
- `app/index.tsx` + `i18n/messages/home.ts` : sous les conditions générales, une mention discrète « Propulsé par Direct Transf'air », en texte, **sans logo**, uniquement pour une société hébergée (fr/en/pt).

**Web-admin (super admin)**
- `lib/logoClash.ts` (nouveau), `CompaniesPage.tsx`, `CompanyDetailPage.tsx`, `packages/shared/src/companies.ts` : une société dont le logo est **identique** à celui d'une autre entité (plateforme comprise) reçoit un badge « Logo identique à … » dans la liste et un message sur sa fiche. Aucun blocage, juste l'alerte.

## À ne PAS appliquer
Du pack logo précédent, **ne copie pas `app-assets/` ni `app.json`** : l'icône native et l'écran de démarrage de l'APK appartiennent à la plateforme (Direct Transf'air, « t’ »). Garde uniquement le dossier `logo/` de ce pack-là (déjà repris dans `logos/flash-transfer/` ici).

## Option pour la suite (je ne l'ai pas faite)
Un APK **dédié à Flash Transfer** (son nom et son icône sur l'écran d'accueil) demande une variante de build : profil EAS `flash`, identifiant d'app propre, `EXPO_PUBLIC_TENANT_ID=FLASH`. C'est le seul moyen d'avoir l'icône Flash sur le téléphone ; dis-moi si tu veux que je la prépare.

## Testé / non testé
Testé : contrôle de types mobile et web-admin ; règles « logo en double » et « initiales » vérifiées. Non testé : appareil réel et données réelles (je ne vois pas ta base).
