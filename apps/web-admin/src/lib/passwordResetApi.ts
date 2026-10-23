// apps/web-admin/src/lib/passwordResetApi.ts
// v1.0 — « Mot de passe oublié » du back-office.
//
// Routes PUBLIQUES déjà en production (utilisées par l'application mobile) — aucun changement backend :
//   POST /auth/find-account   { identifier }                        → { userId, channels }
//   POST /auth/send-otp       { userId, channel, purpose }          → { success }   (code à 6 chiffres par email)
//   POST /auth/reset-password { userId, code, newPassword }         → { success }
// Le code n'est contrôlé qu'UNE fois, par reset-password (ne jamais appeler verify-otp avant : il consomme le code).
// Toutes ces erreurs sont des 400 / 404 / 429 : jamais de 401, donc aucune déconnexion parasite.

import { ApiError } from '@direct-transfair/shared';
import { http } from './api';
import { describeError } from './errors';

export interface FoundAccount {
  userId: string;
  channels: string[];
}

export function findAccount(identifier: string): Promise<FoundAccount> {
  return http.post<FoundAccount>('/auth/find-account', { identifier }, { auth: false });
}

/** Envoie le code de réinitialisation par email. */
export function sendResetCode(userId: string): Promise<unknown> {
  return http.post<unknown>(
    '/auth/send-otp',
    { userId, channel: 'EMAIL', purpose: 'PASSWORD_RESET' },
    { auth: false },
  );
}

export function resetPassword(userId: string, code: string, newPassword: string): Promise<unknown> {
  return http.post<unknown>('/auth/reset-password', { userId, code, newPassword }, { auth: false });
}

/** Message adapté à une interface web (le backend parle parfois de « code secret »). */
export function describeResetError(err: unknown, step: 'find' | 'send' | 'reset'): string {
  if (err instanceof ApiError) {
    const raw = err.message.toLowerCase();
    if (err.status === 404) return 'Aucun compte ne correspond à cette adresse email.';
    if (step === 'reset' && err.status === 400) {
      if (raw.includes('invalide') || raw.includes('expiré')) {
        return 'Ce code est incorrect ou a expiré. Demandez un nouveau code.';
      }
      if (raw.includes('court')) return 'Ce mot de passe est trop court.';
    }
    if (step === 'send' && err.status === 400 && raw.includes('canal')) {
      return "Aucune adresse email n'est enregistrée pour ce compte.";
    }
  }
  return describeError(err).message;
}
