/* ===== Orion proxy =====
   Routes a page through an Ultraviolet deployment so sites that refuse to be
   framed still open. This is the fallback path only: anything that loads
   directly keeps loading directly, because a direct frame is always faster
   and more compatible than a proxied one.                                   */
(function (global) {
  'use strict';

  var Emu = global.Emu, U = Emu.util;

  /** Sites that must never be routed through the proxy. */
  var NEVER = ['deadshot.io', 'kartbros.io', 'chezburgar.github.io', 'ubgone.github.io'];

  /** Sites known to refuse framing, so the proxy is used without a wasted try. */
  var FRAME_BLOCKED = ['google.com', 'www.google.com', 'github.com', 'youtube.com',
    'www.youtube.com', 'x.com', 'twitter.com', 'reddit.com', 'www.reddit.com',
    'instagram.com', 'facebook.com', 'discord.com', 'netflix.com', 'amazon.com'];

  var state = { ready: false, starting: null, error: null, wisp: null, sw: false };

  function cfg() {
    var p = Emu.state.proxy || (Emu.state.proxy = {});
    if (!p.assets) p.assets = '/PRUXYZ';
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
      var h = hostOf(url);
      return NEVER.some(function (n) { return h === n || h.endsWith('.' + n); });
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
        return navigator.serviceWorker.ready.then(function () { return reg; });
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
    xorEncode: xorEncode
  };

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
