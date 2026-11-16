// apps/web-admin/api/icon.js — GET /api/icon : icône du portail (logo importé par la société, servi comme image).
// Logo en adresse https → redirection vers cette adresse ; plateforme / pas de logo → « t’ » de la plateforme.
// Le serveur ne télécharge jamais d'adresse fournie par une société (pas de requête sortante vers un site choisi par un tiers).
import { decodeDataLogo, fetchBranding, hostOf, iconSourceOf } from './_branding.js';

export default async function handler(req, res) {
  const branding = await fetchBranding(hostOf(req));
  const source = branding ? iconSourceOf(branding) : null;
  res.setHeader('Cache-Control', 'private, max-age=300');
  if (source?.kind === 'data') {
    const img = decodeDataLogo(branding.logoUrl);
    if (img) {
      res.setHeader('Content-Type', img.type);
      res.status(200).send(img.bytes);
      return;
    }
  }
  if (source?.kind === 'url') {
    res.setHeader('Location', source.src);
    res.status(302).end();
    return;
  }
  res.setHeader('Location', '/brand/logo-mark.png');
  res.status(302).end();
}
