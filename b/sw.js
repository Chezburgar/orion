/* Orion proxy worker (Scramjet engine).
 * Scope is <base>/b/s/. Scramjet is by MercuryWorkshop.
 */
'use strict';

var assets = new URL(self.location).searchParams.get('assets') || '';

importScripts(assets + '/scram/scramjet.all.js');

var loaded = $scramjetLoadWorker();
var scramjet = new loaded.ScramjetServiceWorker();

self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (event) { event.waitUntil(self.clients.claim()); });

self.addEventListener('fetch', function (event) {
  event.respondWith((async function () {
    await scramjet.loadConfig();
    if (scramjet.route(event)) return scramjet.fetch(event);
    return fetch(event.request);
  })());
});
