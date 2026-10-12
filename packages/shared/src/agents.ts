// packages/shared/src/agents.ts
// =========================================================
// AGENTS — COMPANY_ADMIN (sa société) ; SUPER_ADMIN en lecture seule
//
// Contrat du module backend apps/backend/src/agents-admin :
//   GET   /agents-admin                      agents avec leur agence
//   POST  /agents-admin                      crée un agent dans une agence ; renvoie le mot de passe temporaire
//   PATCH /agents-admin/:id/agency           change l'agence de l'agent
//   PATCH /agents-admin/:id/manager          en fait le responsable de son agence
//   POST  /agents-admin/:id/reset-password   nouveau mot de passe temporaire
// Suspendre, réactiver, supprimer : /users/:id/* (voir users.ts).
// =========================================================

import type { HttpClient } from './http';

export interface AgentWallet {
  currency: string;
  balance: number;
}

export interface Agent {
  id: string;
  email: string;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  isActive: boolean;
  isSuspended: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  company: string | null;
  agency: { id: string; name: string; city: string | null; isActive: boolean } | null;
  isManager: boolean;
  wallets: AgentWallet[];
}

export interface CreateAgentInput {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  agencyId: string;
  makeManager?: boolean;
}

export interface CreateAgentResult {
  agent: Agent;
  /** Affiché une seule fois : le serveur ne le conserve pas en clair. */
  generatedPassword: string;
}

export interface ResetPasswordResult {
  generatedPassword: string;
}

export function createAgentsApi(http: HttpClient) {
  const enc = encodeURIComponent;
  return {
    list: async (): Promise<Agent[]> => (await http.get<{ data: Agent[] }>('/agents-admin')).data ?? [],
    create: (input: CreateAgentInput) => http.post<CreateAgentResult>('/agents-admin', input),
    assignAgency: (id: string, agencyId: string) =>
      http.patch<Agent>(`/agents-admin/${enc(id)}/agency`, { agencyId }),
    setManager: (id: string) => http.patch<Agent>(`/agents-admin/${enc(id)}/manager`, {}),
    resetPassword: (id: string) => http.post<ResetPasswordResult>(`/agents-admin/${enc(id)}/reset-password`, {}),
  };
}
