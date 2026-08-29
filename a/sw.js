/* Orion proxy worker (Ultraviolet engine).
 * Scope is <base>/a/s/ - see config.js for why the stock naming is avoided.
 */
'use strict';

var params = new URL(self.location).searchParams;
self.__ORION_PROXY_ASSETS = params.get('assets') ||
  self.location.pathname.replace(/\/[^/]*\/[^/]*$/, '');

importScripts(self.__ORION_PROXY_ASSETS + '/uv/uv.bundle.js');
importScripts('./config.js');
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
