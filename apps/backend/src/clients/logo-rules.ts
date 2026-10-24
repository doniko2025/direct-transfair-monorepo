// apps/backend/src/clients/logo-rules.ts
// =========================================================
// LOGO D'UNE SOCIÉTÉ v1.0 — Direct Transf'air
//
// Client.logoUrl accepte :
//   - une adresse web (http / https) ;
//   - une image importée depuis l'appareil, stockée telle quelle en « data URL » (data:image/png;base64,…) : c'est déjà la
//     convention de l'app mobile (galerie). Le web-admin la redimensionne (256 px) et la compresse avant l'envoi.
// Refusé : tout autre schéma (javascript:, file:…), et le SVG en data URL (il peut embarquer du script). Taille bornée :
// le corps JSON d'une requête est limité à 100 Ko par défaut, et le logo est renvoyé dans les réponses publiques de branding.
// Vide → NULL (le logo est retiré).
// =========================================================

import { BadRequestException } from '@nestjs/common';

/** Longueur maximale d'un logo (adresse ou data URL), en caractères. */
export const MAX_LOGO_CHARS = 100_000;
const MAX_LOGO_URL_CHARS = 500;

const WEB_URL = /^https?:\/\/\S+$/i;
const DATA_IMAGE = /^data:image\/(?:png|jpe?g|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/i;

export function normalizeLogoUrl(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') throw new BadRequestException('Logo invalide.');

  const logo = value.trim();
  if (!logo) return null;

  if (logo.length > MAX_LOGO_CHARS) {
    throw new BadRequestException(
      'Le logo est trop lourd. Choisissez une image plus légère (elle est normalement réduite automatiquement).',
    );
  }
  if (DATA_IMAGE.test(logo)) return logo;
  if (WEB_URL.test(logo) && logo.length <= MAX_LOGO_URL_CHARS) return logo;

  throw new BadRequestException(
    "Logo invalide : utilisez une image PNG, JPG, WebP ou GIF importée, ou l'adresse web (https://…) d'une image.",
  );
}
