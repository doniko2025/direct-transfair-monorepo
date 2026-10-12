// src/lib/errors.ts
// Transforme une erreur API en message clair pour l'utilisateur.

import { ApiError } from '@direct-transfair/shared';

export interface DescribedError {
  message: string;
  /** Adresse de l'espace société à ouvrir (cas USE_COMPANY_PORTAL). */
  companyUrl?: string;
}

const HOSTNAME = /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/i;

function companyUrlFrom(data: unknown): string | undefined {
  if (!data || typeof data !== 'object') return undefined;
  const custom = (data as { customDomain?: unknown }).customDomain;
  if (typeof custom === 'string' && HOSTNAME.test(custom.trim())) {
    return `https://${custom.trim()}`;
  }
  return undefined;
}

export function describeError(err: unknown): DescribedError {
  if (!(err instanceof ApiError)) {
    return { message: 'Une erreur inattendue est survenue. Réessayez.' };
  }

  if (err.code === 'USE_COMPANY_PORTAL') {
    const url = companyUrlFrom(err.data);
    return {
      message: err.message || "Ce compte appartient à l'espace d'une société.",
      ...(url ? { companyUrl: url } : {}),
    };
  }

  switch (err.status) {
    case 0:
      return { message: err.message };
    case 429:
      return { message: 'Trop de tentatives. Patientez une minute avant de réessayer.' };
    case 401:
      return { message: err.message || 'Identifiants incorrects.' };
    case 403:
      return { message: err.message || "Vous n'avez pas accès à cet espace." };
    default:
      return err.status >= 500
        ? { message: 'Le serveur a rencontré un problème. Réessayez dans un instant.' }
        : { message: err.message };
  }
}
