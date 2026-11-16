# Lot 14b — Factures : paiements programmés, reçu PDF, rapprochement, confirmation des facturiers

Complète le lot 14 (`LISEZ-MOI-factures.md`). Le paiement de factures reste **fermé par défaut** pour chaque société.

## Ce qui est ajouté

1. **Paiements programmés** (loyer, abonnements, assurance…) — hebdomadaire, mensuel, trimestriel, annuel ; date de début et de fin facultative.
   - Mode **Rappel** : le client est prévenu avant l'échéance (nombre de jours réglé par la société) et paie d'un geste.
   - Mode **Prélèvement automatique** : fermé par défaut ; exige l'ouverture par la société, l'identité vérifiée et le code PIN à la création, à la reprise, au changement de mode ou de montant. Les échéances automatiques ne redemandent pas le PIN (consentement donné à la création).
   - Le jour du mois est mémorisé (le 31 reste le 31 après février). Une échéance en retard de plus de 3 jours est sautée et signalée. Nouvel essai après 6 h en cas d'échec ; **pause** après N échecs (réglable) avec notification.
   - Exécution : tâche horaire (`BILLS_RECURRING_HOUR_UTC`, 8 h UTC par défaut ; `BILLS_RECURRING_CRON=false` la coupe sur une instance). Clé d'idempotence par échéance : jamais de double débit.
2. **Reçu PDF** — `GET /api/bills/payments/:id/receipt.pdf` (le payeur seulement, facture réglée) ; nom et couleur de la société, code de vérification, bandeau « simulation » le cas échéant. Page publique de vérification : `GET /api/bills/verify/:code` (page HTML ou JSON). Bouton dans l'écran du paiement (mobile).
3. **Rapprochement** — page web « Rapprochement factures » (administrateur de société) : relevé CSV du facturier comparé aux paiements réglés ; écarts classés (montant différent, absent chez le facturier, inconnu chez nous, doublon) ; colonnes devinées ou choisies à la main ; export CSV des écarts. Rien n'est conservé sur le serveur.
4. **Confirmation asynchrone des facturiers** — `POST /api/bills/webhook/:cle`, signée (HMAC-SHA256, 5 minutes de tolérance), idempotente.
5. **Gabarit de connecteur + guide** — `docs/CONNECTEURS-FACTURES.md` et `apps/backend/src/bills/bills.connector.template.ts`.

## ⚠️ À lire honnêtement : il n'y a toujours pas de vrai connecteur

Un connecteur réel dépend de l'API d'un partenaire (documentation, clés, environnement de test) que vous n'avez pas encore. Je ne l'ai donc **pas inventé**. Livré : le gabarit inerte, le guide, et le webhook prêt à recevoir les confirmations. D'ici là, les facturiers fonctionnent en mode **manuel** (la société règle puis confirme) avec le rapprochement pour contrôler.

## Réglages société (Facturiers → « Paiements programmés »)

`bills.recurring` : `enabled` (vrai), `autoDebitEnabled` (**faux**), `maxPerClient` (10, de 1 à 50), `remindDaysBefore` (2, de 0 à 14), `maxFailures` (3, de 1 à 10).

## Variables d'environnement (`apps/backend/.env.example`)

| Variable | Rôle |
|---|---|
| `PUBLIC_API_URL` | Adresse publique du serveur, imprimée sur le reçu PDF pour la vérification (sans elle : seul le code est imprimé). |
| `BILLS_RECURRING_HOUR_UTC` | Heure UTC des échéances (0–23, défaut 8). |
| `BILLS_RECURRING_CRON` | `false` coupe le planificateur sur cette instance (à n'activer que sur une seule instance si plusieurs tournent). |
| `BILLS_WEBHOOK_SECRET_<CLE>` | Secret (≥ 16 caractères) du webhook d'un connecteur. Absent : l'adresse n'existe pas. |

## Nouvelle dépendance

`pdfkit` (polices intégrées) pour le reçu : lancer `pnpm install`.

## Base de données

Migration `20261116030000_bill_schedules` (SQL, rejouable : `IF NOT EXISTS`) : table `bill_schedules`, colonne `bill_payments.scheduleId`, deux énumérations, deux valeurs d'audit (`BILL_SCHEDULE`, `BILL_RECONCILE`). Appliquer avec `prisma migrate deploy`.

## API ajoutée

Client : `GET/POST /bills/schedules`, `PATCH /bills/schedules/:id`, `POST /bills/schedules/:id/pause|resume`, `DELETE /bills/schedules/:id`, `GET /bills/payments/:id/receipt.pdf`.
Société : `POST /bills-admin/reconcile`, `POST /bills-admin/reconcile/export.csv` (limite 3 Mo, 5 000 lignes).
Public : `GET /bills/verify/:code`, `POST /bills/webhook/:cle` (signé).

## Mobile (FR / EN / PT, clair / sombre)

« Mes factures programmées » (cartes animées, pause/reprise, suppression, « payer maintenant »), création d'un paiement programmé (facturier, champs dynamiques, fréquence, dates, rappel ou automatique), bouton « Programmer ce paiement » sur un reçu, bouton PDF.

## Vérifications faites / non faites

- Faites : TypeScript (backend, mobile, shared, web-admin) ; 108 suites / 1 244 tests backend ; reçu PDF généré et contrôlé visuellement.
- **Non faites** : essai de bout en bout sur PostgreSQL réel, sur téléphone, et pages web ouvertes dans un navigateur.
- À vérifier avec un juriste : consentement au prélèvement automatique, mentions sur le reçu, conservation des données.

## Idées pour la suite

Import automatique du relevé (dépôt SFTP/e-mail) ; reçu en plusieurs langues ; plafond mensuel de prélèvements automatiques par client ; alerte à la société quand un `PENDING` dépasse 24 h.
