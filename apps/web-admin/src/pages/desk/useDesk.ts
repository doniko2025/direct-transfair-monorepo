// src/pages/desk/useDesk.ts
// Le guichet de l'agent (agence, caisse, opérations du jour), rechargé après chaque opération.

import { api } from '../../lib/api';
import { startOfLocalDayIso } from '../../lib/deskRules';
import { useResource, type Resource } from '../../lib/useResource';
import type { AgentDesk } from '@direct-transfair/shared';

export function useDesk(): Resource<AgentDesk> {
  return useResource(() => api.agentDesk.me(startOfLocalDayIso()), []);
}
