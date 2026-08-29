/* Ultraviolet configuration for Orion.
 *
 * Paths deliberately avoid the stock "/uv/service/" naming: network filters
 * match on those strings, and this has to work from a filtered school network.
 * Everything is derived from the worker's own location so it survives the site
 * being served from a repo subpath.
 *
 * Ultraviolet is by TitaniumNetwork, AGPL-3.0.
 */
(() => {
  var here = self.location.pathname;            // /orion/a/sw.js
  var dir = here.replace(/\/[^/]*$/, '');       // /orion/a
  var base = dir.replace(/\/[^/]*$/, '');       // /orion
  var assets = self.__ORION_PROXY_ASSETS || base;

  self.__uv$config = {
    prefix: dir + '/s/',
    encodeUrl: Ultraviolet.codec.xor.encode,
    decodeUrl: Ultraviolet.codec.xor.decode,
    handler: assets + '/uv/uv.handler.js',
    client: assets + '/uv/uv.client.js',
    bundle: assets + '/uv/uv.bundle.js',
    config: dir + '/config.js',
    sw: dir + '/sw.js',
    loc: base
  };
})();
