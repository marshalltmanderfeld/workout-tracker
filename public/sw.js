// Installable shell only. Deliberately no fetch handler or personal-data cache.
// This app requires a connection for edits; it does not promise offline sync.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
