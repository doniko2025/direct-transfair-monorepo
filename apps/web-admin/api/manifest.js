// apps/web-admin/api/manifest.js — GET /api/manifest : manifeste d'installation du portail, selon l'adresse visitée.
// Société connue → son nom et son logo ; plateforme, adresse inconnue ou serveur injoignable → manifeste de la plateforme (« t’ »).
// Cette adresse est branchée DIRECTEMENT dans index.html au moment du build (voir vite.config.ts) : le navigateur lit donc le bon
// manifeste dès le premier chargement, sans remplacement en JavaScript — condition pour obtenir une vraie application plein écran.
import { companyManifest, fetchBranding, hostOf, platformManifest } from './_branding.js';

export default async function handler(req, res) {
  let manifest;
  try {
    const branding = await fetchBranding(hostOf(req));
    manifest = branding ? companyManifest(branding) : platformManifest();
  } catch {
    // Quoi qu'il arrive, on sert un manifeste VALIDE : un manifeste absent ou en erreur ferait retomber l'installation en simple raccourci.
    manifest = platformManifest();
  }
  res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
  // « private » : jamais gardé par un cache partagé (le contenu dépend de l'hôte) ; le navigateur le revérifie après 5 minutes.
  res.setHeader('Cache-Control', 'private, max-age=300');
  res.status(200).send(JSON.stringify(manifest));
}
