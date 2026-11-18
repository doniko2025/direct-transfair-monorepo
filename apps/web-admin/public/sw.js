/* Service worker minimal : il rend le portail « installable » (plein écran, sans barre d'adresse).
   Il ne met rien en cache : les données restent toujours celles du serveur. Les navigations passent par le réseau ;
   hors connexion, une page claire s'affiche au lieu de l'erreur du navigateur. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

const OFFLINE_HTML =
  '<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
  '<title>Hors connexion</title><body style="font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;' +
  'background:#F2F5F3;color:#0F3B2E;text-align:center;padding:24px"><div><h1 style="font-size:1.25rem">Pas de connexion</h1>' +
  '<p>Vérifiez votre réseau puis relancez l\'application.</p></div></body></html>';

self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return; // le reste : réseau direct, comme avant
  event.respondWith(
    fetch(event.request).catch(
      () => new Response(OFFLINE_HTML, { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }),
    ),
  );
});
