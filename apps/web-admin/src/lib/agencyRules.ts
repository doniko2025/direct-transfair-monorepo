// src/lib/agencyRules.ts
// Libellés et règles de saisie des agences et des agents.

import type { Agency, AgencyAgent, AgencyType, Agent } from '@direct-transfair/shared';
import { EMAIL } from './companyRules';
import { COUNTRIES } from './countries';
import { fullName } from './userRules';

export const PHONE = /^\+?[0-9 ().-]{6,25}$/;
export const AGENCY_CODE = /^[A-Z0-9_-]{2,16}$/;

export const AGENCY_TYPE_LABEL: Record<AgencyType, string> = {
  SUBSIDIARY: 'Filiale',
  PARTNER: 'Partenaire',
};

export const AGENCY_TYPE_OPTIONS = (Object.keys(AGENCY_TYPE_LABEL) as AgencyType[]).map((value) => ({
  value,
  label: AGENCY_TYPE_LABEL[value],
}));

export function typeLabel(type: string | null | undefined): string {
  return AGENCY_TYPE_LABEL[type as AgencyType] ?? 'Filiale';
}

export function managerOf(agency: Agency): AgencyAgent | null {
  if (!agency.managerId) return null;
  return agency.agents?.find((a) => a.id === agency.managerId) ?? null;
}

export function agentName(a: Pick<AgencyAgent, 'firstName' | 'lastName' | 'email'>): string {
  return fullName(a);
}

/** Total des soldes de toutes les agences, par devise, dans l'ordre de la plus grosse somme. */
export function totalsByCurrency(agencies: readonly Agency[]): { currency: string; amount: number }[] {
  const totals = new Map<string, number>();
  for (const a of agencies) {
    for (const w of a.wallets ?? []) totals.set(w.currency, (totals.get(w.currency) ?? 0) + Number(w.balance));
  }
  return [...totals.entries()].map(([currency, amount]) => ({ currency, amount })).sort((x, y) => y.amount - x.amount);
}

export function agencyMatches(a: Agency, q: string): boolean {
  if (!q) return true;
  const manager = managerOf(a);
  const hay = [a.name, a.city, a.code, a.email, manager ? agentName(manager) : null]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return hay.includes(q);
}

export function agentMatches(a: Agent, q: string): boolean {
  if (!q) return true;
  const hay = [a.firstName, a.lastName, a.email, a.phone, a.agency?.name, a.agency?.city]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return hay.includes(q);
}

export function currencyOfCountry(code: string): string | null {
  return COUNTRIES.find((c) => c.code === code)?.currency ?? null;
}

// ─── Formulaire de création d'agence ─────────────────────
export interface AgencyForm {
  name: string;
  city: string;
  address: string;
  country: string;
  type: AgencyType;
  code: string;
  adminFirstName: string;
  adminLastName: string;
  email: string;
  phone: string;
}

export type AgencyFormErrors = Partial<Record<keyof AgencyForm, string>>;

export const emptyAgencyForm = (): AgencyForm => ({
  name: '',
  city: '',
  address: '',
  country: '',
  type: 'SUBSIDIARY',
  code: '',
  adminFirstName: '',
  adminLastName: '',
  email: '',
  phone: '',
});

export function validateAgencyForm(f: AgencyForm): AgencyFormErrors {
  const e: AgencyFormErrors = {};
  if (!f.name.trim()) e.name = "Le nom de l'agence est obligatoire.";
  if (!f.city.trim()) e.city = 'La ville est obligatoire.';
  if (!f.address.trim()) e.address = "L'adresse est obligatoire.";
  if (!f.country) e.country = 'Choisissez le pays.';
  if (f.code.trim() && !AGENCY_CODE.test(f.code.trim().toUpperCase())) {
    e.code = '2 à 16 caractères : lettres, chiffres, tiret.';
  }
  if (!f.adminFirstName.trim()) e.adminFirstName = 'Le prénom est obligatoire.';
  if (!f.adminLastName.trim()) e.adminLastName = 'Le nom est obligatoire.';
  if (!EMAIL.test(f.email.trim())) e.email = 'Adresse email invalide.';
  if (f.phone.trim() && !PHONE.test(f.phone.trim())) e.phone = 'Numéro de téléphone invalide.';
  return e;
}

// ─── Formulaire de création d'agent ──────────────────────
export interface AgentForm {
  agencyId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  makeManager: boolean;
}

export type AgentFormErrors = Partial<Record<keyof AgentForm, string>>;

export const emptyAgentForm = (agencyId = ''): AgentForm => ({
  agencyId,
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  makeManager: false,
});

export function validateAgentForm(f: AgentForm): AgentFormErrors {
  const e: AgentFormErrors = {};
  if (!f.agencyId) e.agencyId = "Choisissez l'agence.";
  if (!f.firstName.trim()) e.firstName = 'Le prénom est obligatoire.';
  if (!f.lastName.trim()) e.lastName = 'Le nom est obligatoire.';
  if (!EMAIL.test(f.email.trim())) e.email = 'Adresse email invalide.';
  if (f.phone.trim() && !PHONE.test(f.phone.trim())) e.phone = 'Numéro de téléphone invalide.';
  return e;
}
