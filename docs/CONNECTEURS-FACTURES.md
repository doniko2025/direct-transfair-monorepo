# Écrire un connecteur de facturier

> **À lire d'abord.** Aucun connecteur réel n'est fourni : un connecteur parle à l'API d'un partenaire (opérateur d'électricité, d'eau, assureur, école, agrégateur de paiement…), et cette API n'existe pour vous qu'une fois un contrat signé et une documentation reçue. Ce guide et le gabarit `apps/backend/src/bills/bills.connector.template.ts` vous évitent de repartir de zéro ce jour-là ; ils n'inventent ni adresse, ni authentification, ni format de message.

## 1. Sans connecteur : le mode « manuel »

Un facturier au connecteur **manuel** fonctionne déjà : le client paie dans l'application, l'argent arrive sur le portefeuille de la société, l'administrateur règle le facturier (virement, guichet…) puis confirme avec le numéro de reçu dans « Factures à régler ». Le rapprochement (page « Rapprochement ») permet ensuite de contrôler le relevé envoyé par le facturier. C'est la voie à utiliser tant qu'aucune API n'est disponible.

## 2. Ce qu'il faut obtenir du partenaire avant d'écrire une ligne

- documentation de l'API + accès à un environnement de **test** (bac à sable) et à la **production** ;
- méthode d'authentification (clé, jeton, signature, certificat) et rotation des secrets ;
- l'opération « interroger la facture » (facultative) et l'opération « payer » ;
- si le paiement est **synchrone** (réponse immédiate) ou **asynchrone** (confirmation plus tard, par appel du partenaire) ;
- la gestion des doublons : le partenaire accepte-t-il une **clé d'idempotence** (sinon, comment éviter un double paiement ?) ;
- les codes d'erreur : lesquels signifient « refus définitif » et lesquels « réessayez plus tard » ;
- le format du reçu / du jeton (compteur prépayé…), les plafonds, les horaires de service ;
- l'adresse **depuis laquelle** le partenaire vous appelle (liste blanche) et le secret du webhook ;
- le relevé périodique (format CSV) pour le rapprochement.

## 3. Le contrat (`BillConnector`)

```ts
interface BillConnector {
  readonly key: string;        // clé stockée sur le facturier (Biller.connectorKey), ex. « mon-partenaire »
  readonly label: string;      // nom montré dans le formulaire du facturier
  readonly automatic: boolean; // true : règle sans intervention humaine
  lookup?(biller, reference, fields): Promise<BillLookupResult | null>;  // facultatif : titulaire + montant dû
  pay?(input): Promise<BillPayResult>;                                    // règle la facture
}
// BillPayResult.status : 'COMPLETED' | 'PENDING' | 'FAILED'
```

- `COMPLETED` : le partenaire a **confirmé** ; la facture est réglée, le reçu est émis.
- `PENDING` : réponse inconnue, délai dépassé, ou confirmation attendue par webhook. La facture passe « en cours ».
- `FAILED` : refus **clair** du partenaire ; le client est **remboursé aussitôt** (montant, et frais selon le réglage de la société).

## 4. Les quatre règles d'un connecteur qui manipule de l'argent

1. **Idempotent.** `pay` reçoit `reference`, unique par facture : envoyez-la au partenaire comme clé d'idempotence. Un redémarrage ou un réessai ne doit jamais payer deux fois.
2. **Honnête.** Ne répondez `COMPLETED` que sur confirmation. En cas de doute : `PENDING`, jamais `FAILED` (un `FAILED` à tort rembourse le client alors que le facturier a peut-être été payé).
3. **Borné.** Délai maximal sur chaque appel réseau (15 s dans le gabarit), pour ne pas bloquer l'application.
4. **Sans fuite.** Ni clé d'API, ni jeton, ni réponse brute dans les journaux ou dans `message` (montré au client). La configuration vient de l'environnement, jamais du code ni de la base.

## 5. Étapes

1. Copier `bills.connector.template.ts` vers `bills-<partenaire>.connector.ts` ; renommer la classe, la clé et le libellé.
2. Remplacer chaque « À COMPLÉTER » par ce que dit la documentation **du partenaire** (adresse, authentification, champs, codes d'erreur).
3. Enregistrer le connecteur dans `BillConnectorsService` (constructeur de `bills.connectors.ts`, à côté de `manual` et `sandbox`).
4. Renseigner les variables d'environnement du partenaire sur le serveur.
5. Dans « Facturiers », créer ou modifier le facturier : choisir ce connecteur, le passer « Ouvert » seulement après les essais.
6. Écrire des tests avec un faux serveur HTTP (voir ci-dessous).

## 6. Confirmation asynchrone (webhook signé)

Quand le partenaire confirme plus tard, il appelle :

```
POST https://<votre-api>/api/bills/webhook/<clé du connecteur>
X-Bills-Signature: t=<horodatage UNIX en secondes>,v1=<HMAC-SHA256 hexadécimal>
Content-Type: application/json

{ "reference": "FAC-…", "status": "COMPLETED" | "FAILED", "providerRef": "…", "token": "…", "message": "…" }
```

- **Signature** : `HMAC-SHA256(secret, "<t>." + <corps brut exact>)`, en hexadécimal. Le corps brut, octet pour octet : ne le re-sérialisez pas.
- **Secret** : variable `BILLS_WEBHOOK_SECRET_<CLÉ>` (clé en MAJUSCULES, tout caractère non alphanumérique remplacé par `_` ; ex. `mon-partenaire` → `BILLS_WEBHOOK_SECRET_MON_PARTENAIRE`), **16 caractères au moins**. Sans secret valide, l'adresse répond 404 : elle n'existe pas.
- **Fraîcheur** : un horodatage de plus de 5 minutes est refusé (anti-rejeu).
- **Idempotent** : si la facture est déjà réglée ou remboursée, la réponse est `200` sans rien refaire ; le partenaire peut donc réessayer jusqu'à recevoir un `2xx`.
- **Isolation** : un connecteur ne peut régler que les paiements qui lui sont rattachés.
- `COMPLETED` → facture réglée, client prévenu. `FAILED` → client remboursé.

Exemple d'appel (Node 18+), utile pour vos essais :

```js
import { createHmac } from 'node:crypto';
const secret = process.env.BILLS_WEBHOOK_SECRET_MON_PARTENAIRE;
const body = JSON.stringify({ reference: 'FAC-123', status: 'COMPLETED', providerRef: 'P-789' });
const t = Math.floor(Date.now() / 1000);
const v1 = createHmac('sha256', secret).update(`${t}.${body}`).digest('hex');
await fetch('https://api.exemple.com/api/bills/webhook/mon-partenaire', {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'x-bills-signature': `t=${t},v1=${v1}` },
  body,
});
```

Si le partenaire impose **sa propre** méthode de signature (autre en-tête, autre algorithme), il faut adapter `bills.webhook.ts` : ses fonctions sont pures et testées dans `bills.webhook.spec.ts`.

## 7. Liste de contrôle avant d'ouvrir à de vrais clients

- [ ] Essais complets en environnement de test du partenaire : succès, refus, délai dépassé, doublon.
- [ ] Un redémarrage du serveur en plein paiement ne paie pas deux fois.
- [ ] Un `PENDING` sans webhook reste visible dans « Factures à régler » (en retard signalé) et peut être clôturé à la main.
- [ ] Le rapprochement du premier relevé réel ne montre aucun écart inexpliqué.
- [ ] Plafonds par paiement et par jour réglés ; portefeuille de la société approvisionné pour les remboursements.
- [ ] Aucun secret dans les journaux ni dans le dépôt.
- [ ] Contrat, frais et responsabilités en cas d'erreur signés ; points réglementaires (agrément, lutte anti-blanchiment, protection des données) **à vérifier avec votre conseil juridique**.
