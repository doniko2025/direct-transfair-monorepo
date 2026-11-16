// apps/web-admin/api/manifest.js — GET /api/manifest : manifeste d'installation du portail, selon l'adresse visitée.
// Société connue → son nom et son logo ; plateforme, adresse inconnue ou serveur injoignable → manifeste de la plateforme (« t’ »).
import { companyManifest, fetchBranding, hostOf, platformManifest } from './_branding.js';

export default async function handler(req, res) {
  const branding = await fetchBranding(hostOf(req));
  const manifest = branding ? companyManifest(branding) : platformManifest();
  res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
  // « private » : jamais gardé par un cache partagé (le contenu dépend de l'hôte) ; le navigateur le revérifie après 5 minutes.
  res.setHeader('Cache-Control', 'private, max-age=300');
  res.status(200).send(JSON.stringify(manifest));
}
