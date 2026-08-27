/* ===== Orion proxy =====
   Routes a page through an Ultraviolet deployment so sites that refuse to be
   framed still open. This is the fallback path only: anything that loads
   directly keeps loading directly, because a direct frame is always faster
   and more compatible than a proxied one.                                   */
(function (global) {
  'use strict';

  var Emu = global.Emu, U = Emu.util;

  /** Only Orion itself must never be proxied - that would just recurse. */
  var NEVER = [];

  /**
   * Sites to send through the proxy without trying direct first. Filtered
   * networks (school iboss/Securly and the like) block these by name, so the
   * direct frame fails before it starts; the proxy is the working path.
   */
  var PREFER_PROXY = ['deadshot.io', 'kartbros.io'];

  /** Sites known to refuse framing, so the proxy is used without a wasted try. */
  var FRAME_BLOCKED = ['google.com', 'www.google.com', 'github.com', 'youtube.com',
    'www.youtube.com', 'x.com', 'twitter.com', 'reddit.com', 'www.reddit.com',
    'instagram.com', 'facebook.com', 'discord.com', 'netflix.com', 'amazon.com'];

  var state = { ready: false, starting: null, error: null, wisp: null, sw: false };
  var scram = { ready: false, starting: null, error: null, wisp: null, sw: false, controller: null };

  /** Sites Ultraviolet cannot render properly; Scramjet handles these. */
  var UV_BREAKS = ['deadshot.io'];

  function cfg() {
    var p = Emu.state.proxy || (Emu.state.proxy = {});
    if (!p.assets) p.assets = '/PRUXYZ';
    if (!p.scramAssets) p.scramAssets = '/Scramjet-App';
    if (!p.siteEngine) p.siteEngine = {};
    if (p.always === undefined) p.always = false;
    if (!p.wisp) p.wisp = 'wss://wisp.mercurywork.shop/';
    if (!p.wispFallbacks) {
      p.wispFallbacks = ['wss://anura.pro/', 'wss://nebulaproxy.io/wisp/', 'wss://wisp.terbiumon.top/wisp/'];
    }
    if (p.enabled === undefined) p.enabled = true;
    return p;
  }

  /** Orion's own base path, e.g. "/orion". */
  function base() {
    return location.pathname.replace(/\/[^/]*$/, '').replace(/\/$/, '');
  }

  /** Ultraviolet's XOR codec, reimplemented so no bundle is needed to build a URL. */
  function xorEncode(str) {
    if (!str) return str;
    return encodeURIComponent(String(str).split('').map(function (c, i) {
      return i % 2 ? String.fromCharCode(c.charCodeAt(0) ^ 2) : c;
    }).join(''));
  }

  function hostOf(url) {
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return ''; }
  }

  /** Is a websocket endpoint actually accepting connections? */
  function probeWisp(url, ms) {
    return new Promise(function (resolve) {
      var done = false, ws;
      var timer = setTimeout(function () {
        if (done) return;
        done = true;
        try { ws.close(); } catch (e) {}
        resolve(false);
      }, ms || 6000);
      try { ws = new WebSocket(url); } catch (e) { clearTimeout(timer); return resolve(false); }
      ws.onopen = function () {
        done = true; clearTimeout(timer);
        try { ws.close(); } catch (e) {}
        resolve(true);
      };
      ws.onerror = ws.onclose = function () {
        if (done) return;
        done = true; clearTimeout(timer);
        resolve(false);
      };
    });
  }

  var Proxy = {
    NEVER: NEVER,
    state: state,
    config: cfg,

    /** Never proxy these, whatever else is going on. */
    isProtected: function (url) {
      // Proxying Orion through itself would loop.
      if (String(url).indexOf(location.origin + base()) === 0) return true;
      var h = hostOf(url);
      return NEVER.some(function (n) { return h === n || h.endsWith('.' + n); });
    },

    /** Should this go straight through the proxy? */
    preferProxy: function (url) {
      var p = cfg();
      if (p.always) return true;
      var h = hostOf(url);
      if (p.siteEngine[h] === 'direct') return false;
      return PREFER_PROXY.some(function (n) { return h === n || h.endsWith('.' + n); });
    },

    /** Worth skipping the direct attempt for. */
    likelyBlocked: function (url) {
      var h = hostOf(url);
      return FRAME_BLOCKED.some(function (n) { return h === n || h.endsWith('.' + n); });
    },

    available: function () { return cfg().enabled && state.ready; },

    /** Proxied URL for a target, or null if the proxy cannot be used. */
    url: function (target) {
      if (!state.ready || Proxy.isProtected(target)) return null;
      return base() + '/uv/service/' + xorEncode(target);
    },

    /**
     * Register the service worker and point the transport at a live wisp
     * server. Resolves false (never rejects) so callers can fall back.
     */
    start: function () {
      if (state.ready) return Promise.resolve(true);
      if (state.starting) return state.starting;
      var p = cfg();

      if (!p.enabled) return Promise.resolve(false);
      if (!('serviceWorker' in navigator)) {
        state.error = 'This browser has no service worker support.';
        return Promise.resolve(false);
      }
      if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
        state.error = 'The proxy needs HTTPS.';
        return Promise.resolve(false);
      }

      state.starting = navigator.serviceWorker.register(
        base() + '/uv/sw.js?assets=' + encodeURIComponent(p.assets),
        { scope: base() + '/uv/service/' }
      ).then(function (reg) {
        state.sw = true;
        // Not navigator.serviceWorker.ready: that waits for a worker
        // controlling *this* page, and Orion sits outside the proxy scope on
        // purpose, so it would never resolve. Wait on the registration.
        return waitActivated(reg);
      }).then(function () {
        return loadScript(p.assets + '/baremux/index.js');
      }).then(function () {
        // Use the first backend that answers; they come and go.
        var candidates = [p.wisp].concat(p.wispFallbacks || []);
        return firstLive(candidates);
      }).then(function (wisp) {
        if (!wisp) throw new Error('No proxy backend answered. All wisp servers appear to be down.');
        state.wisp = wisp;
        var conn = new global.BareMux.BareMuxConnection(p.assets + '/baremux/worker.js');
        // Newer transports expect { wisp }, older ones { websocket }.
        return conn.setTransport(p.assets + '/libcurl/index.mjs', [{ wisp: wisp, websocket: wisp }]);
      }).then(function () {
        state.ready = true;
        state.error = null;
        Emu.emit('proxy');
        return true;
      }).catch(function (e) {
        state.ready = false;
        state.error = e.message || String(e);
        state.starting = null;
        Emu.emit('proxy');
        return false;
      });

      return state.starting;
    },

    /** Drop the worker so a broken proxy cannot linger. */
    stop: function () {
      state.ready = false;
      state.starting = null;
      if (!('serviceWorker' in navigator)) return Promise.resolve();
      return navigator.serviceWorker.getRegistrations().then(function (regs) {
        return Promise.all(regs.filter(function (r) {
          return (r.scope || '').indexOf('/uv/service/') >= 0;
        }).map(function (r) { return r.unregister(); }));
      }).then(function () { Emu.emit('proxy'); });
    },

    probeWisp: probeWisp,
    xorEncode: xorEncode,

    /**
     * Which engine to use for a host. Ultraviolet is the default; Scramjet is
     * for sites UV cannot render - it keeps the cross-origin isolation headers
     * that threaded WASM games need.
     */
    engineFor: function (url) {
      var h = hostOf(url);
      var p = cfg();
      if (p.siteEngine[h]) return p.siteEngine[h];
      return UV_BREAKS.some(function (n) { return h === n || h.endsWith('.' + n); }) ? 'scramjet' : 'uv';
    },

    setEngineFor: function (url, engine) {
      var h = hostOf(url);
      if (!h) return;
      cfg().siteEngine[h] = engine;
      Emu.save();
    },

    /** Start whichever engine a URL needs. Resolves false, never rejects. */
    startFor: function (url) {
      return Proxy.engineFor(url) === 'scramjet' ? Proxy.startScramjet() : Proxy.start();
    },

    urlFor: function (target) {
      if (Proxy.isProtected(target)) return null;
      return Proxy.engineFor(target) === 'scramjet'
        ? Proxy.scramUrl(target)
        : Proxy.url(target);
    },

    scramUrl: function (target) {
      if (!scram.ready || !scram.controller) return null;
      try { return scram.controller.encodeUrl(target); }
      catch (e) { return base() + '/scram/service/' + encodeURIComponent(target); }
    },

    scramState: scram,

    startScramjet: function () {
      if (scram.ready) return Promise.resolve(true);
      if (scram.starting) return scram.starting;
      var p = cfg();
      if (!p.enabled) return Promise.resolve(false);
      if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
        scram.error = 'The proxy needs HTTPS.';
        return Promise.resolve(false);
      }

      scram.starting = loadScript(p.scramAssets + '/scram/scramjet.all.js').then(function () {
        if (typeof global.$scramjetLoadController !== 'function') {
          throw new Error('The Scramjet runtime did not load.');
        }
        var ctrl = global.$scramjetLoadController();
        var controller = new ctrl.ScramjetController({
          files: {
            wasm: p.scramAssets + '/scram/scramjet.wasm.wasm',
            all: p.scramAssets + '/scram/scramjet.all.js',
            sync: p.scramAssets + '/scram/scramjet.sync.js'
          },
          prefix: base() + '/scram/service/'
        });
        scram.controller = controller;
        return controller.init();
      }).then(function () {
        return navigator.serviceWorker.register(
          base() + '/scram/sw.js?assets=' + encodeURIComponent(p.scramAssets),
          { scope: base() + '/scram/service/' }
        );
      }).then(function (reg) {
        scram.sw = true;
        return waitActivated(reg);
      }).then(function () {
        return loadScript(p.assets + '/baremux/index.js');
      }).then(function () {
        return firstLive([p.wisp].concat(p.wispFallbacks || []));
      }).then(function (wisp) {
        if (!wisp) throw new Error('No proxy backend answered.');
        scram.wisp = wisp;
        var conn = new global.BareMux.BareMuxConnection(p.assets + '/baremux/worker.js');
        return conn.setTransport(p.assets + '/libcurl/index.mjs', [{ wisp: wisp, websocket: wisp }]);
      }).then(function () {
        scram.ready = true;
        scram.error = null;
        Emu.emit('proxy');
        return true;
      }).catch(function (e) {
        scram.ready = false;
        scram.error = e.message || String(e);
        scram.starting = null;
        Emu.emit('proxy');
        return false;
      });

      return scram.starting;
    }
  };

  /** Resolve once the registration has an activated worker. */
  function waitActivated(reg) {
    if (reg.active) return Promise.resolve(reg);
    return new Promise(function (resolve, reject) {
      var worker = reg.installing || reg.waiting;
      if (!worker) return resolve(reg);
      var timer = setTimeout(function () {
        reject(new Error('The proxy service worker did not start.'));
      }, 15000);
      worker.addEventListener('statechange', function () {
        if (worker.state === 'activated') { clearTimeout(timer); resolve(reg); }
        if (worker.state === 'redundant') {
          clearTimeout(timer);
          reject(new Error('The proxy service worker failed to install.'));
        }
      });
    });
  }

  function firstLive(list) {
    var i = 0;
    function next() {
      if (i >= list.length) return Promise.resolve(null);
      var u = list[i++];
      if (!u) return next();
      return probeWisp(u, 6000).then(function (ok) { return ok ? u : next(); });
    }
    return next();
  }

  function loadScript(src) {
    if (global.BareMux) return Promise.resolve();
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = function () { reject(new Error('Could not load the proxy runtime from ' + src)); };
      document.head.appendChild(s);
    });
  }

  // Not `Proxy`: that is a built-in JavaScript global and clobbering it would
  // break any library that uses new Proxy(), including the proxy runtime.
  global.OrionProxy = Proxy;
})(window);
