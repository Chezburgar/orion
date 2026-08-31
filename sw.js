/* Orion's root service worker.
   It exists only so the browser treats Orion as installable - it deliberately
   caches nothing and answers nothing. The fetch handler never calls
   respondWith(), so every request falls straight through to the network.

   Keep it that way. The proxy engines register their own workers at the far
   more specific /a/s/ and /b/s/ scopes; the most specific registration wins
   for those URLs, so this one must not try to be clever about any request or
   it will start fighting them. */
self.addEventListener('install', function () {
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', function () {
  /* intentionally inert - see above */
});
