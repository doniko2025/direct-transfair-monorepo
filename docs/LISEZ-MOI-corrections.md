# Corrections de l'audit — mode d'emploi

Les fichiers de ce zip gardent leur chemin d'origine : copie-les tels quels à la racine du repo (ils remplacent les fichiers existants). Rien n'a été commité ni poussé.

## 1. À faire après copie (dans cet ordre)

1. **Migration** : `pnpm --filter direct-transfair-backend prisma migrate deploy` (nouvelle migration `20261106120000_add_company_settings` : table `company_settings`), puis `prisma generate`.
2. **Variables d'environnement** (toutes facultatives, valeurs par défaut sûres) : `OTP_MAX_ATTEMPTS` (5), `PICKUP_CODE_VALIDITY_MONTHS` (5, ne sert plus que de défaut/anciens codes).
3. `pnpm install` (aucune dépendance ajoutée), puis `pnpm -r exec tsc --noEmit` et `pnpm --filter direct-transfair-backend test`.
4. Facultatif : `bash scripts/hygiene-move-stale-files.sh` (simulation), puis `--apply` pour ranger à l'écart les doublons (aucune suppression).

## 2. Tout est maintenant paramétrable par l'admin société

Web › Réglages › **Paramètres de la société** (API : `GET/PATCH/DELETE /company-settings`, historique `GET /company-settings/history`, modifications tracées dans l'audit) :

| Réglage | Défaut |
|---|---|
| Envois gratuits (liste de modes) | **WALLET seul** (wallet → wallet) |
| Taux de repli quand aucun tarif n'est défini | 1,5 % |
| Répartition par défaut des frais (payeur / expéditeur / plateforme) | 40 / 20 / 40 |
| Validité du code de retrait | 5 mois |
| Essais erronés avant blocage d'un agent / durée de blocage | 5 / 15 min |
| Vérification des derniers chiffres du téléphone du bénéficiaire (oui/non, nombre de chiffres) | non / 4 |
| Seuils d'alerte de caisse faible par devise | XOF 50 000, GNF 500 000, EUR/USD/GBP 100 |

Seules les valeurs modifiées sont stockées ; le reste suit les défauts du serveur.

## 3. Changements de comportement à connaître

- **Mobile Money est désormais facturé par défaut** (seul le wallet → wallet est gratuit). Pour le rendre gratuit : cocher le mode dans « Envois gratuits ».
- Un envoi « cash » vers quelqu'un qui a déjà un compte est traité comme un transfert wallet.
- Les virements programmés passent par le même code que les envois manuels (mêmes frais, limites, idempotence ; un doublon est impossible même si le cron est relancé).
- Code de retrait : durée de validité figée à la création selon la société, blocage anti-devinette par agent, contrôle facultatif des derniers chiffres du téléphone (web et mobile), commissions enregistrées au paiement.
- OTP : nombre d'essais atomique, comparaison à temps constant ; la réinitialisation du mot de passe révoque les sessions.
- DTO typés sur les routes publiques (auth, taux, retraits) : plus d'objets arbitraires jusqu'à Prisma.
- `GET /commissions/fees` renvoie une ligne par mode avec `charged` et le taux de repli de la société (plus de 1,5 codé en dur).
- Web : plus aucun texte « toujours gratuit » ; les listes de modes et le simulateur suivent les réglages de la société ; CSP + HSTS dans `vercel.json`.
- Mobile : `convertAmount` appelle `/exchange-rates/convert` sans taux inventés ; suppression des appels à des routes qui n'existent pas (favori, appareil de confiance, KYC, fidélité, promotions, pays-devises, alertes en double chemin) ; écrans de retrait avec saisie des derniers chiffres du téléphone ; l'écran admin « Frais » lit et écrit via `/fees-admin`.

## 4. Non traité (à planifier)

- Jetons en cookies httpOnly côté web (aujourd'hui en stockage navigateur).
- Recharges encore simulées (pas de vrai prestataire de paiement).
- `clients.update` accepte un corps libre (à typer par un DTO).
- Un jeton d'accès déjà émis reste valide jusqu'à son expiration après révocation de session (courte durée recommandée).
- `commission_configs` : index unique partiel et dédoublonnage des lignes existantes.
- Mobile : l'écran admin « Frais » garde des paliers/remises stockés localement qui ne s'appliquent pas côté serveur ; ton script `scripts/cleanup-mobile-dead-code.sh` supprime justement les écrans admin/agent du mobile (web = back-office) — si tu l'exécutes, les modifications mobiles correspondantes deviennent sans objet, sans conflit.

## 5. Vérifications effectuées

Backend : `tsc` sans erreur, 50 suites / 491 tests verts. Shared, web-admin et mobile : `tsc` sans erreur.
