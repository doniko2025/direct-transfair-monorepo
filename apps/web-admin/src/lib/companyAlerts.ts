// apps/web-admin/src/lib/companyAlerts.ts
// Ce qui reste à régler pour une société (liste des sociétés du Super Admin) — mêmes règles que l'application mobile
// (services/contractTypes.ts › companyAlerts) :
//  • RCCM manquant (sociétés créées avant son introduction) : sans lui, aucun contrat ne peut être émis ;
//  • lien de signature expiré, puis contrat à signer ;
//  • aucun contrat (ou seulement des contrats annulés).
// `contracts` = contrats de CETTE société, ou null si la liste n'a pas pu être chargée : aucune alerte de contrat alors
// (mieux vaut ne rien afficher qu'un faux « Aucun contrat »).

import type { ContractSummary } from '@direct-transfair/shared';

export type CompanyAlertKey = 'RCCM_MISSING' | 'CONTRACT_EXPIRED' | 'CONTRACT_PENDING' | 'NO_CONTRACT';

export interface CompanyAlert {
  key: CompanyAlertKey;
  label: string;
  tone: 'danger' | 'warn' | 'neutral';
}

export function companyAlerts(company: { rccmNumber?: string | null }, contracts: ContractSummary[] | null): CompanyAlert[] {
  const out: CompanyAlert[] = [];
  if (!String(company.rccmNumber ?? '').trim()) out.push({ key: 'RCCM_MISSING', label: 'RCCM manquant', tone: 'danger' });
  if (contracts) {
    if (contracts.some((c) => c.status === 'EXPIRED')) {
      out.push({ key: 'CONTRACT_EXPIRED', label: 'Lien de contrat expiré', tone: 'danger' });
    } else if (contracts.some((c) => c.status === 'PENDING')) {
      out.push({ key: 'CONTRACT_PENDING', label: 'Contrat à signer', tone: 'warn' });
    } else if (!contracts.some((c) => c.status === 'SIGNED')) {
      out.push({ key: 'NO_CONTRACT', label: 'Aucun contrat', tone: 'neutral' });
    }
  }
  return out;
}

/** Regroupe les contrats par identifiant de société. */
export function groupContractsByCompany(contracts: ContractSummary[]): Map<number, ContractSummary[]> {
  const map = new Map<number, ContractSummary[]>();
  for (const c of contracts) {
    const id = c.client?.id;
    if (typeof id !== 'number') continue;
    const arr = map.get(id) ?? [];
    arr.push(c);
    map.set(id, arr);
  }
  return map;
}
