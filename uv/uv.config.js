/* Ultraviolet configuration for Orion.
 *
 * The stock config that ships with the proxy hardcodes prefix "/uv/service/",
 * which only works when the proxy is served from a domain root. On GitHub
 * Pages the site lives under a repo path, so the service worker ends up
 * listening on a path that is never requested - that is why the proxy did
 * nothing. Everything here is derived from the worker's own location instead.
 *
 * The heavy runtime (bundle, handler, client) is loaded from wherever the
 * proxy is deployed; only this config and sw.js belong to Orion.
 *
 * Ultraviolet is by TitaniumNetwork, AGPL-3.0.
 */
(() => {
  // /orion/uv/sw.js -> "/orion"
  var base = self.location.pathname.replace(/\/uv\/[^/]*$/, '');
  var assets = self.__ORION_PROXY_ASSETS || base;

  self.__uv$config = {
    prefix: base + '/uv/service/',
    encodeUrl: Ultraviolet.codec.xor.encode,
    decodeUrl: Ultraviolet.codec.xor.decode,
    handler: assets + '/uv/uv.handler.js',
    client: assets + '/uv/uv.client.js',
    bundle: assets + '/uv/uv.bundle.js',
    config: base + '/uv/uv.config.js',
    sw: base + '/uv/sw.js',
    loc: base
  };
})();
