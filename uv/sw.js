/* Orion's proxy service worker entry point.
 *
 * Registered by Orion with a scope of <base>/uv/service/, which is where the
 * browser will send every proxied request. The Ultraviolet runtime itself is
 * pulled from whichever deployment the ?assets= parameter names (same origin),
 * so Orion does not carry its own copy.
 */
'use strict';

var params = new URL(self.location).searchParams;
self.__ORION_PROXY_ASSETS = params.get('assets') || self.location.pathname.replace(/\/uv\/[^/]*$/, '');

importScripts(self.__ORION_PROXY_ASSETS + '/uv/uv.bundle.js');
importScripts('./uv.config.js');
importScripts(self.__ORION_PROXY_ASSETS + '/uv/uv.sw.js');

var sw = new UVServiceWorker();

self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (event) { event.waitUntil(self.clients.claim()); });

self.addEventListener('fetch', function (event) {
  event.respondWith((async function () {
    if (sw.route(event)) return await sw.fetch(event);
    return await fetch(event.request);
  })());
});
