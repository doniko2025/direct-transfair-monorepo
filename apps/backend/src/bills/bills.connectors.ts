// apps/backend/src/bills/bills.connectors.ts
// =========================================================
// CONNECTEURS DE FACTURIERS (lot 14)
//
// Un connecteur est la manière dont la société RÈGLE un facturier. Aujourd'hui aucun accord n'est signé : tout passe par le connecteur
// « manual » (la société règle elle-même, puis confirme dans le portail). Le jour où un accord API est signé — la société elle-même
// (EDG, SEG, un assureur, une école), un opérateur mobile money ou un agrégateur — on ajoute UN fichier qui implémente `BillConnector`
// et on l'enregistre dans `BillConnectorsService` : ni le schéma, ni les écrans, ni le circuit d'argent ne changent.
//
//   manual   Aucune automatisation. Le paiement reste « à régler » jusqu'à la confirmation d'un administrateur.
//   sandbox  SIMULATION : reconnaît n'importe quelle référence, « paie » aussitôt et fabrique un reçu fictif. Sert à essayer TOUT le
//            circuit (écrans, débit, reçu, remboursement) sans partenaire. Refusé en production sauf BILLS_SANDBOX_ALLOWED=true.
//
// Contrat d'un connecteur réel :
//   • lookup  facultatif — « interroger la facture » : nom du titulaire, montant dû, échéance. Sans lui, le client saisit le montant.
//   • pay     « payer » — COMPLETED (reçu/jeton immédiats), PENDING (réponse attendue : le paiement passe en PROCESSING) ou FAILED
//             (le client est remboursé). Doit être IDEMPOTENT sur `reference` : un nouvel appel ne paie jamais deux fois.
// =========================================================

import { Injectable } from '@nestjs/common';

export interface ConnectorBiller {
  id: string;
  name: string;
  category: string;
  currency: string;
  amountMode: string;
  connectorKey: string;
}

export interface BillLookupResult {
  /** Titulaire reconnu (« Mamadou D. ») : le client vérifie qu'il paie la bonne facture. */
  customerName?: string | null;
  /** Montant dû, dans la devise du facturier (obligatoire pour un facturier en mode FROM_LOOKUP). */
  amountDue?: number | null;
  dueDate?: string | null;
}

export interface BillPayResult {
  status: 'COMPLETED' | 'PENDING' | 'FAILED';
  providerRef?: string;
  /** Jeton de compteur prépayé, code de recharge… */
  token?: string;
  message?: string;
}

export interface BillConnector {
  readonly key: string;
  readonly label: string;
  /** Règle le facturier sans intervention humaine. */
  readonly automatic: boolean;
  lookup?(biller: ConnectorBiller, reference: string, fields: Record<string, string>): Promise<BillLookupResult | null>;
  pay?(input: { biller: ConnectorBiller; reference: string; accountRef: string; fields: Record<string, string>; amount: number; currency: string }): Promise<BillPayResult>;
}

class ManualConnector implements BillConnector {
  readonly key = 'manual';
  readonly label = 'Manuel (la société règle puis confirme)';
  readonly automatic = false;
}

/** Chiffres de fin d'une référence, pour fabriquer des données de simulation stables. */
const digitsOf = (s: string): number => Number((s.replace(/\D/g, '') || '0').slice(-6));

export class SandboxConnector implements BillConnector {
  readonly key = 'sandbox';
  readonly label = 'Simulation (essais uniquement)';
  readonly automatic = true;

  async lookup(biller: ConnectorBiller, reference: string): Promise<BillLookupResult | null> {
    if (/^0+$|^(inconnu|unknown)/i.test(reference)) return null; // référence « introuvable » pour essayer ce cas
    const n = digitsOf(reference);
    return {
      customerName: `Client Test ${String(n).padStart(4, '0').slice(-4)}`,
      // Pour un facturier en mode FROM_LOOKUP : un montant dû stable, entier, déterministe.
      amountDue: biller.amountMode === 'FROM_LOOKUP' ? 5_000 + (n % 50) * 1_000 : null,
      dueDate: null,
    };
  }

  async pay(input: { reference: string; accountRef: string; biller: ConnectorBiller }): Promise<BillPayResult> {
    // « FAIL » dans la référence : permet d'essayer le remboursement automatique d'un échec.
    if (/fail|echec|échec/i.test(input.accountRef)) return { status: 'FAILED', message: 'Simulation : paiement refusé par le facturier.' };
    const token = input.biller.category === 'ELECTRICITY' ? String(digitsOf(input.reference) * 7919).padStart(20, '4').slice(0, 20).replace(/(.{4})/g, '$1 ').trim() : undefined;
    return { status: 'COMPLETED', providerRef: `SANDBOX-${input.reference}`, token, message: 'Simulation : aucun argent n\'a été envoyé à un vrai facturier.' };
  }
}

export const sandboxAllowed = (): boolean => process.env.NODE_ENV !== 'production' || process.env.BILLS_SANDBOX_ALLOWED === 'true';

@Injectable()
export class BillConnectorsService {
  private readonly connectors = new Map<string, BillConnector>();

  constructor() {
    this.register(new ManualConnector());
    this.register(new SandboxConnector());
    // Futur : this.register(new OrangeMoneyBillConnector(...)), this.register(new EdgConnector(...)), …
  }

  register(connector: BillConnector): void {
    this.connectors.set(connector.key, connector);
  }

  /** Connecteur utilisable par la société ; la simulation n'est disponible que là où elle est permise. */
  get(key: string): BillConnector | null {
    const c = this.connectors.get(key);
    if (!c) return null;
    if (c.key === 'sandbox' && !sandboxAllowed()) return null;
    return c;
  }

  /** Liste proposée dans le portail (formulaire d'un facturier). */
  available(): Array<{ key: string; label: string; automatic: boolean }> {
    return [...this.connectors.values()].filter((c) => this.get(c.key)).map((c) => ({ key: c.key, label: c.label, automatic: c.automatic }));
  }
}
