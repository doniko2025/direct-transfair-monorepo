<!-- docs/PLATFORM-CONFIG.md -->
# Configuration de la plateforme (v1.0 — phase 7)

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
`VITE_CONSOLE_PORTAL_NAME`, `VITE_CONSOLE_PORTAL_TAGLINE` (en plus de `VITE_API_URL`, `VITE_PLATFORM_HOSTS`, etc.).

Le code de la plateforme doit être **identique** partout : `PLATFORM_TENANT_CODE` (backend), `EXPO_PUBLIC_PLATFORM_CODE` (mobile),
`VITE_PLATFORM_CODE` (web-admin).
