// src/lib/accountApi.ts
// v1.0 — Appel « changer mon mot de passe » du back-office.
//
// Route existante du backend : PATCH /auth/change-password { oldPass, newPass }
// (JwtAuthGuard). Elle vérifie l'ancien mot de passe (400 s'il est faux — jamais 401,
// que le client HTTP traduirait en déconnexion), enregistre le hash, écrit l'audit et
// envoie un email de confirmation. Fichier isolé : le package partagé et l'application
// mobile ne sont pas touchés.

import { ApiError } from '@direct-transfair/shared';
import { http } from './api';
import { describeError } from './errors';

export interface ChangePasswordResult {
  success: boolean;
  message?: string;
}

export function changeMyPassword(currentPassword: string, newPassword: string): Promise<ChangePasswordResult> {
  return http.patch<ChangePasswordResult>('/auth/change-password', {
    oldPass: currentPassword,
    newPass: newPassword,
  });
}

/** Champ du formulaire auquel rattacher l'erreur (null = erreur générale). */
export interface ChangePasswordFailure {
  field: 'current' | 'next' | null;
  message: string;
}

/**
 * Traduit une erreur du backend en message adapté à une interface web.
 * Le backend parle de « code secret » (vocabulaire de l'app mobile) : ici, c'est un
 * mot de passe.
 */
export function describeChangePasswordError(err: unknown): ChangePasswordFailure {
  if (err instanceof ApiError && err.status === 400) {
    const raw = err.message.toLowerCase();
    if (raw.includes('ancien')) {
      return { field: 'current', message: 'Le mot de passe actuel est incorrect.' };
    }
    if (raw.includes('différent')) {
      return { field: 'next', message: "Le nouveau mot de passe doit être différent de l'actuel." };
    }
    if (raw.includes('caractères')) {
      return { field: 'next', message: err.message.replace(/code/gi, 'mot de passe') };
    }
  }
  return { field: null, message: describeError(err).message };
}
