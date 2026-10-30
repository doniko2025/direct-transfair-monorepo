// apps/backend/src/common/utils/safe-user-select.ts
// =========================================================
// SAFE_USER_SELECT v1.0 — Direct Transf'air
//
// Champs d'un User qu'une réponse d'API peut exposer à un autre utilisateur (admin de société, agent) :
// identité et contact, jamais le hash du mot de passe, l'OTP, le secret MFA et ses codes de secours,
// les coordonnées bancaires ni les pièces d'identité.
//
// Utiliser `select: SAFE_USER_SELECT` à la place de `sender: true` / `user: true` dans tout `include`
// dont le résultat est renvoyé tel quel par un contrôleur.
// =========================================================

import type { Prisma } from '@prisma/client';

export const SAFE_USER_SELECT = {
  id:              true,
  firstName:       true,
  lastName:        true,
  email:           true,
  phone:           true,
  role:            true,
  country:         true,
  city:            true,
  primaryCurrency: true,
  agencyId:        true,
  clientId:        true,
  isActive:        true,
  createdAt:       true,
} satisfies Prisma.UserSelect;
