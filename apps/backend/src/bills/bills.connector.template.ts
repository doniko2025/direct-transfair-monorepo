// apps/backend/src/bills/bills.connector.template.ts
// =========================================================
// GABARIT DE CONNECTEUR — à COPIER (jamais enregistré tel quel) le jour où un facturier ou un agrégateur fournit une API.
// Guide pas à pas : docs/CONNECTEURS-FACTURES.md.
//
// Ce fichier est volontairement INERTE : il n'est enregistré nulle part, et chaque méthode refuse de fonctionner tant que
// les « À COMPLÉTER » n'ont pas été remplacés par ce que dit la documentation DU PARTENAIRE. Il n'invente aucune adresse, aucun
// format d'authentification ni aucun champ : ces éléments dépendent entièrement de l'API réelle.
//
// Les quatre règles qui font un bon connecteur d'argent :
//   1. IDEMPOTENT — `pay` est appelé avec `reference` (unique par facture) ; envoyez-la au partenaire comme clé d'idempotence. Un
//      deuxième appel (redémarrage, réessai) ne doit jamais payer deux fois.
//   2. HONNÊTE — ne répondez COMPLETED que si le partenaire a confirmé le règlement. Réponse floue, délai dépassé, état inconnu :
//      renvoyez PENDING (la facture passe « en cours » et la confirmation arrivera par webhook ou par la société), jamais FAILED.
//      FAILED rembourse le client aussitôt : à ne renvoyer que sur un refus CLAIR du partenaire.
//   3. BORNÉ — délai maximal sur chaque appel réseau (ici 15 s) : un partenaire lent ne doit pas bloquer l'application du client.
//   4. SANS FUITE — ne mettez jamais la clé d'API, un jeton ni le corps complet d'une réponse dans les journaux ou dans `message`
//      (le message est montré au client).
// =========================================================

import type { BillConnector, BillLookupResult, BillPayResult, ConnectorBiller } from './bills.connectors';

/** Délai maximal d'un appel au partenaire. */
const TIMEOUT_MS = 15_000;

/** Lit la configuration du partenaire dans l'environnement (jamais dans le code ni dans la base). */
function config() {
  const baseUrl = process.env.BILLS_PARTNER_EXAMPLE_URL; // À COMPLÉTER : nom de variable propre au partenaire
  const apiKey = process.env.BILLS_PARTNER_EXAMPLE_KEY; // À COMPLÉTER : idem
  if (!baseUrl || !apiKey) throw new Error('Connecteur non configuré : variables d\'environnement du partenaire absentes.');
  return { baseUrl: baseUrl.replace(/\/+$/, ''), apiKey };
}

/** Appel HTTP borné. À adapter à l'authentification du partenaire (en-tête, signature, mTLS…). */
async function call(path: string, body: unknown): Promise<{ status: number; json: unknown }> {
  const { baseUrl, apiKey } = config();
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` }, // À COMPLÉTER : schéma d'authentification réel
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    /* réponse sans JSON : traitée plus bas comme « état inconnu » */
  }
  return { status: res.status, json };
}

export class ExamplePartnerConnector implements BillConnector {
  /** Clé stockée dans Biller.connectorKey ; elle donne aussi le nom du secret du webhook : BILLS_WEBHOOK_SECRET_EXAMPLE_PARTNER. */
  readonly key = 'example-partner';
  readonly label = 'Partenaire exemple (à renommer)';
  readonly automatic = true;

  /** Facultatif : « interroger la facture ». Retirer la méthode si le partenaire n'offre pas cette fonction (le client saisira le montant). */
  async lookup(_biller: ConnectorBiller, reference: string, fields: Record<string, string>): Promise<BillLookupResult | null> {
    const { status, json } = await call('/TODO/lookup', { reference, fields }); // À COMPLÉTER : chemin et corps réels
    if (status === 404) return null; // référence inconnue chez le partenaire
    if (status >= 400 || !json || typeof json !== 'object') throw new Error(`Réponse inattendue du partenaire (HTTP ${status}).`);
    const r = json as Record<string, unknown>;
    return {
      customerName: typeof r.customerName === 'string' ? r.customerName : null, // À COMPLÉTER : nom du champ chez le partenaire
      amountDue: typeof r.amountDue === 'number' ? r.amountDue : null,
      dueDate: typeof r.dueDate === 'string' ? r.dueDate : null,
    };
  }

  /** Paie la facture. Voir les quatre règles en tête de fichier. */
  async pay(input: { biller: ConnectorBiller; reference: string; accountRef: string; fields: Record<string, string>; amount: number; currency: string }): Promise<BillPayResult> {
    let res: { status: number; json: unknown };
    try {
      res = await call('/TODO/pay', {
        idempotencyKey: input.reference, // règle 1 : la même facture n'est jamais payée deux fois
        account: input.accountRef,
        fields: input.fields,
        amount: input.amount,
        currency: input.currency,
      }); // À COMPLÉTER : corps réel
    } catch {
      // Délai dépassé / réseau coupé : on ne SAIT PAS si le partenaire a payé → PENDING, jamais FAILED (règle 2).
      return { status: 'PENDING', message: 'Confirmation du facturier en attente.' };
    }
    const r = (res.json ?? {}) as Record<string, unknown>;
    if (res.status >= 200 && res.status < 300 && r.status === 'PAID') { // À COMPLÉTER : valeur réelle de « payé »
      return { status: 'COMPLETED', providerRef: String(r.receipt ?? ''), token: typeof r.token === 'string' ? r.token : undefined };
    }
    if (res.status >= 200 && res.status < 300 && r.status === 'PENDING') return { status: 'PENDING', providerRef: typeof r.receipt === 'string' ? r.receipt : undefined };
    if (res.status >= 400 && res.status < 500 && r.status === 'REJECTED') { // refus CLAIR uniquement
      return { status: 'FAILED', message: typeof r.reason === 'string' ? r.reason.slice(0, 200) : 'Paiement refusé par le facturier.' };
    }
    return { status: 'PENDING', message: 'Confirmation du facturier en attente.' }; // tout le reste : état inconnu
  }
}

// Pour l'activer (voir le guide) : dans bills.connectors.ts, constructeur de BillConnectorsService :
//   this.register(new ExamplePartnerConnector());
// puis, dans le portail, choisir ce connecteur sur le facturier concerné.
