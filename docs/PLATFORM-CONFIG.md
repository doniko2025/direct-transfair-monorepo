<!-- docs/PLATFORM-CONFIG.md -->
# Configuration de la plateforme (v1.1 — phase 8 : logo « t’ »)

Auteur : Thierno Doniko (Grand Chef, Doniko Digital)

Plus aucune donnée d'identité n'est écrite en dur dans le code : tout se règle par variables d'environnement.
Sans variable, les valeurs par défaut reproduisent le comportement précédent (sauf mention contraire).

## Backend (Render) — `apps/backend`

| Variable | Rôle | Défaut |
|---|---|---|
| `PLATFORM_TENANT_CODE` | code de la société système | `DONIKO` |
| `PLATFORM_LEGACY_CODES` | alias historiques du code (séparés par des virgules) | `10` |
| `PLATFORM_NAME` | nom de marque (courriels, SMS, Swagger) | `Direct Transf'air` |
| `PLATFORM_LEGAL_NAME` | raison sociale en pied de courriel | = `PLATFORM_NAME` |
| `PLATFORM_APP_URL` | portail web (lien « Accéder à mon espace ») | = `FRONTEND_URL` |
| `PLATFORM_WEBSITE_URL` | site vitrine (pied de courriel) | absent → lien omis |
| `PLATFORM_SUPPORT_EMAIL` | e-mail du support (pied de courriel) | = `SUPPORT_EMAIL`, sinon omis |
| `PLATFORM_IOS_URL` / `PLATFORM_ANDROID_URL` | liens App Store / Google Play | absents → boutons omis |
| `PLATFORM_LOGO_URL` | logo fixe des courriels (PNG) | `<PLATFORM_APP_URL>/brand/logo-mark.png` |
| `PLATFORM_LOGO_ANIMATED_URL` | logo animé des courriels (GIF) | `<PLATFORM_APP_URL>/brand/logo-mark-animated.gif` |
| `PLATFORM_BRAND_COLOR` / `PLATFORM_ACCENT_COLOR` | couleurs des courriels de la plateforme | `#0E3B2D` / `#F5C32C` |
| `PLATFORM_SSO_ISSUER` / `PLATFORM_SSO_AUDIENCE` | émetteur / destinataire de l'assertion SSO | `dkmoney-console` / `direct-transfair` |

## Mobile (EAS / `.env`) — `apps/direct-transfair-mobile`

`EXPO_PUBLIC_PLATFORM_CODE`, `EXPO_PUBLIC_PLATFORM_NAME`, `EXPO_PUBLIC_PLATFORM_TAGLINE`,
`EXPO_PUBLIC_BRAND_PRIMARY`, `EXPO_PUBLIC_BRAND_SECONDARY`, `EXPO_PUBLIC_BRAND_SPLASH`,
`EXPO_PUBLIC_PORTAL_BASE_DOMAIN` (sans lui : plus de lien « sous-domaine », seuls les domaines propres des sociétés comptent),
`EXPO_PUBLIC_PLATFORM_HOSTS`, `EXPO_PUBLIC_SUPPORT_EMAIL`, `EXPO_PUBLIC_SUPPORT_PHONE`, `EXPO_PUBLIC_DPO_EMAIL`,
`EXPO_PUBLIC_DATA_AUTHORITY_NAME` / `_URL` (défaut CNIL), `EXPO_PUBLIC_LEGAL_JURISDICTION`,
`EXPO_PUBLIC_LEGAL_*` (valeurs de secours des mentions légales — les vraies viennent de la fiche société via l'API),
`EXPO_PUBLIC_FALLBACK_RATES` (JSON, ex. `{"EUR_XOF":655.957}` — vide par défaut), `EXPO_PUBLIC_SENDWAVE_URL`.

## Web-admin (Vercel) — `apps/web-admin`

`VITE_PLATFORM_CODE`, `VITE_PLATFORM_NAME`, `VITE_PLATFORM_TAGLINE`, `VITE_BRAND_PRIMARY`, `VITE_BRAND_SECONDARY`,
`VITE_CONSOLE_PORTAL_NAME`, `VITE_CONSOLE_PORTAL_TAGLINE`, `VITE_PLATFORM_LOGO_URL` (logo du portail plateforme, défaut `<base>/brand/logo-mark.svg`) (en plus de `VITE_API_URL`, `VITE_PLATFORM_HOSTS`, etc.).

Le code de la plateforme doit être **identique** partout : `PLATFORM_TENANT_CODE` (backend), `EXPO_PUBLIC_PLATFORM_CODE` (mobile),
`VITE_PLATFORM_CODE` (web-admin).


## Logo « t’ » — où il apparaît et comment le changer

| Endroit | Fichier | Remarque |
|---|---|---|
| Icône de l'app, icône adaptative Android, écran de démarrage, favicon web | `apps/direct-transfair-mobile/assets/images/*.png` + couleurs dans `app.json` | remplacer les PNG pour changer d'identité |
| Écrans d'accueil et de connexion de l'app | `components/brand/BrandMark.tsx` (`<TenantMark />`) | le logo d'une société (`logoUrl`) garde la priorité ; une société sans logo garde l'icône neutre |
| Portail web (login, menu, favicon) | `apps/web-admin/public/favicon.svg`, `public/brand/*` | `VITE_PLATFORM_LOGO_URL` pour pointer ailleurs |
| Courriels | `PLATFORM_LOGO_URL` / `PLATFORM_LOGO_ANIMATED_URL` (backend) | **adresse publique obligatoire** : Gmail et consorts n'affichent ni SVG, ni image intégrée, ni animation CSS |

Courriels : les fichiers `public/brand/logo-mark.png` et `logo-mark-animated.gif` du web-admin sont servis à `<portail>/brand/…`.
Si le portail est servi sous un préfixe (ex. `/transfert`), renseigner `PLATFORM_LOGO_URL` et `PLATFORM_LOGO_ANIMATED_URL` avec l'adresse complète.
Sans adresse publique, les courriels n'affichent aucune image (le nom de marque reste en texte). Le GIF s'anime dans Gmail, Apple Mail et
Outlook web ; Outlook pour Windows n'affiche que la première image, qui est le logo complet.
