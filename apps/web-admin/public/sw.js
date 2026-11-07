/* Service worker minimal : il rend le portail « installable » (plein écran, sans barre d'adresse).
   Il ne met rien en cache et ne touche à aucune requête : les données restent toujours celles du serveur. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {
  /* réseau direct */
});
