/* Orion's Scramjet service worker.
 *
 * Scramjet is the newer proxy engine and handles sites that Ultraviolet
 * mangles - notably ones using threaded WASM or workers, which break when UV
 * strips the cross-origin isolation headers.
 *
 * Scramjet is by MercuryWorkshop.
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
