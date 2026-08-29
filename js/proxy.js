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
  /** Engines chosen automatically live here only - never in storage. */
  var sessionEngine = {};
  var scram = { ready: false, starting: null, error: null, wisp: null, sw: false, controller: null };

  /**
   * Scramjet is the default engine: it rendered every site tested, including
   * deadshot.io, which Ultraviolet cannot load on any backend. Ultraviolet is
   * kept as an automatic fallback in case Scramjet fails to start.
   */
  var DEFAULT_ENGINE = 'scramjet';

  function cfg() {
    var p = Emu.state.proxy || (Emu.state.proxy = {});
    if (!p.assets) p.assets = '/PRUXYZ';
    if (!p.scramAssets) p.scramAssets = '/Scramjet-App';
    if (!p.siteEngine) p.siteEngine = {};
    if (p.always === undefined) p.always = true;
    if (!p.wisp) p.wisp = 'wss://wisp.mercurywork.shop/';
    if (!p.wispFallbacks) {
      p.wispFallbacks = ['wss://anura.pro/', 'wss://nebulaproxy.io/wisp/', 'wss://wisp.terbiumon.top/wisp/'];
    }
    if (p.enabled === undefined) p.enabled = true;
    // A self-hosted proxy is far simpler than running engines in the browser:
    // no service worker, no transport, no public backend. Set this and Orion
    // just points a frame at your server.
    if (p.external === undefined) p.external = '';
    if (!p.externalEncoding) p.externalEncoding = 'xor';
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

    /**
     * URL on a self-hosted proxy. The template carries %s where the encoded
     * address goes, e.g. https://you.up.railway.app/service/%s
     */
    externalUrl: function (target) {
      var p = cfg();
      if (!p.enabled || !p.external) return null;
      var trimmed = p.external;
      while (trimmed.charAt(trimmed.length - 1) === '/') trimmed = trimmed.slice(0, -1);
      var tpl = p.external.indexOf('%s') >= 0 ? p.external : trimmed + '/%s';
      var enc = p.externalEncoding === 'plain' ? encodeURIComponent(target)
        : p.externalEncoding === 'base64' ? btoa(target).replace(/=+$/, '')
        : xorEncode(target);
      return tpl.replace('%s', enc);
    },

    hasExternal: function () { var p = cfg(); return !!(p.enabled && p.external); },

    /** Proxied URL for a target, or null if the proxy cannot be used. */
    url: function (target) {
      if (!state.ready || Proxy.isProtected(target)) return null;
      return base() + '/a/s/' + xorEncode(target);
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

      state.starting = preflight(p.assets + '/uv/uv.bundle.js').then(function () {
        return navigator.serviceWorker.register(
        base() + '/a/sw.js?assets=' + encodeURIComponent(p.assets),
        { scope: base() + '/a/s/' });
      }).then(function (reg) {
        state.sw = true;
        // Not navigator.serviceWorker.ready: that waits for a worker
        // controlling *this* page, and Orion sits outside the proxy scope on
        // purpose, so it would never resolve. Wait on the registration.
        return waitActivated(reg);
      }).then(function () {
        // Use the first backend that answers; they come and go.
        return firstLive([p.wisp].concat(p.wispFallbacks || []));
      }).then(function (wisp) {
        if (!wisp) throw new Error('No proxy backend answered. All wisp servers appear to be down.');
        state.wisp = wisp;
        return setupTransport('uv', wisp, function (u) {
          return base() + '/a/s/' + xorEncode(u);
        });
      }).then(function (tb) {
        state.transportBase = tb;
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
          return /[/](a|b)[/]s[/]/.test(r.scope || '');
        }).map(function (r) { return r.unregister(); }));
      }).then(function () { Emu.emit('proxy'); });
    },

    /**
     * Walk every step the proxy depends on and report what happened, so a
     * failure on someone else's network can be read off a screenshot instead
     * of guessed at.
     */
    diagnose: function () {
      var p = cfg();
      var out = [];
      function add(step, ok, detail) { out.push({ step: step, ok: ok, detail: detail || '' }); }

      add('Build', true, Emu.BUILD || '?');
      if (Proxy.hasExternal()) {
        add('Self-hosted proxy', true, cfg().external);
        return fetch(Proxy.externalUrl('https://example.com/'), { method: 'GET', mode: 'no-cors' })
          .then(function () { add('Proxy reachable', true, 'responded'); return out; })
          .catch(function (e) { add('Proxy reachable', false, e.message); return out; });
      }
      add('HTTPS', location.protocol === 'https:', location.protocol);
      add('Service workers', 'serviceWorker' in navigator, 'serviceWorker' in navigator ? 'supported' : 'missing');

      var files = [
        ['Ultraviolet bundle', p.assets + '/uv/uv.bundle.js'],
        ['Scramjet bundle', p.scramAssets + '/scram/scramjet.all.js'],
        ['BareMux (UV copy)', p.assets + '/baremux/index.js'],
        ['BareMux (SJ copy)', p.scramAssets + '/baremux/index.js'],
        ['Orion worker A', base() + '/a/sw.js'],
        ['Orion worker B', base() + '/b/sw.js']
      ];

      return Promise.all(files.map(function (f) {
        return fetch(f[1], { method: 'GET', cache: 'no-store' })
          .then(function (r) { add(f[0], r.ok, 'HTTP ' + r.status); })
          .catch(function (e) { add(f[0], false, 'blocked: ' + e.message); });
      })).then(function () {
        var backends = [p.wisp].concat(p.wispFallbacks || []);
        return Promise.all(backends.map(function (w) {
          return probeWisp(w, 7000).then(function (ok) { add('Backend ' + w, ok, ok ? 'reachable' : 'no answer'); });
        }));
      }).then(function () {
        return Proxy.startScramjet().then(function (ok) {
          add('Scramjet engine', ok, ok ? ('ready via ' + (scram.transportBase || '?')) : (scram.error || 'failed'));
        });
      }).then(function () {
        return Proxy.start().then(function (ok) {
          add('Ultraviolet engine', ok, ok ? ('ready via ' + (state.transportBase || '?')) : (state.error || 'failed'));
        });
      }).then(function () {
        return out;
      });
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
      // Only a choice you made yourself is allowed to persist. An engine that
      // a failover picked lives for this session only, so one bad day can
      // never pin a site to a broken engine forever.
      if (p.siteEngine[h] && p.siteEngine[h] !== 'direct') return p.siteEngine[h];
      if (sessionEngine[h]) return sessionEngine[h];
      return DEFAULT_ENGINE;
    },

    /** persist=true only for an explicit choice made in the menu. */
    setEngineFor: function (url, engine, persist) {
      var h = hostOf(url);
      if (!h) return;
      if (persist) {
        cfg().siteEngine[h] = engine;
        Emu.save();
      } else {
        sessionEngine[h] = engine;
      }
    },

    /**
     * Start the engine this URL wants and, if that fails, the other one. One
     * engine failing to register must not take the whole proxy down.
     * Resolves the engine name that worked, or false.
     */
    startFor: function (url) {
      // Nothing to start for a self-hosted proxy - it is just a URL.
      if (Proxy.hasExternal()) return Promise.resolve('external');
      var pref = Proxy.engineFor(url);
      var alt = pref === 'scramjet' ? 'uv' : 'scramjet';
      var runPref = pref === 'scramjet' ? Proxy.startScramjet : Proxy.start;
      var runAlt = alt === 'scramjet' ? Proxy.startScramjet : Proxy.start;

      return runPref().then(function (ok) {
        if (ok) return pref;
        return runAlt().then(function (ok2) {
          if (!ok2) return false;
          // Remember for this session only.
          Proxy.setEngineFor(url, alt, false);
          return alt;
        });
      });
    },

    /** Whichever engine failed, in words, with the build for bug reports. */
    lastError: function () {
      var bits = [];
      if (scram.error) bits.push('Scramjet: ' + scram.error);
      if (state.error) bits.push('Ultraviolet: ' + state.error);
      bits.push('build ' + (Emu.BUILD || '?'));
      return bits.join(' · ');
    },

    urlFor: function (target) {
      if (Proxy.isProtected(target)) return null;
      if (Proxy.hasExternal()) return Proxy.externalUrl(target);
      var want = Proxy.engineFor(target);
      if (want === 'scramjet' && scram.ready) return Proxy.scramUrl(target);
      if (want === 'uv' && state.ready) return Proxy.url(target);
      // Preferred engine is not up; use whatever is.
      if (scram.ready) return Proxy.scramUrl(target);
      if (state.ready) return Proxy.url(target);
      return null;
    },

    /** Which engine actually served the last URL built. */
    activeEngine: function () {
      return scram.ready ? 'scramjet' : state.ready ? 'uv' : null;
    },

    scramUrl: function (target) {
      if (!scram.ready || !scram.controller) return null;
      try { return scram.controller.encodeUrl(target); }
      catch (e) { return base() + '/b/s/' + encodeURIComponent(target); }
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

      scram.starting = preflight(p.scramAssets + '/scram/scramjet.all.js').then(function () {
        return loadScript(p.scramAssets + '/scram/scramjet.all.js');
      }).then(function () {
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
          prefix: base() + '/b/s/'
        });
        scram.controller = controller;
        return controller.init();
      }).then(function () {
        return navigator.serviceWorker.register(
          base() + '/b/sw.js?assets=' + encodeURIComponent(p.scramAssets),
          { scope: base() + '/b/s/' }
        );
      }).then(function (reg) {
        scram.sw = true;
        return waitActivated(reg);
      }).then(function () {
        return firstLive([p.wisp].concat(p.wispFallbacks || []));
      }).then(function (wisp) {
        if (!wisp) throw new Error('No proxy backend answered.');
        scram.wisp = wisp;
        return setupTransport('scram', wisp, function (u) {
          try { return scram.controller.encodeUrl(u); } catch (e) { return null; }
        });
      }).then(function (tb) {
        scram.transportBase = tb;
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

  /**
   * Both engines need BareMux and a transport. Each deployment ships its own
   * copy, so try the engine's own first and the other as a spare - otherwise
   * one unreachable path takes down both engines.
   */
  function transportOrder(preferred) {
    var p = cfg();
    // The deployments ship different BareMux/libcurl versions and they are not
    // interchangeable, so try each and keep the one that actually serves a
    // page rather than assuming the first reachable one works.
    var order = preferred === 'scram'
      ? [p.assets, p.scramAssets]
      : [p.assets, p.scramAssets];
    return order.filter(Boolean).filter(function (b, i, a) { return a.indexOf(b) === i; });
  }

  /**
   * Prove the proxy can actually serve a page. This loads the probe in a
   * hidden frame rather than fetching it: the engines handle navigations,
   * and a plain fetch of a service URL does not exercise the same path.
   */
  function verifyThrough(buildUrl) {
    var probe = buildUrl('https://example.com/');
    if (!probe) return Promise.resolve(false);
    return new Promise(function (resolve) {
      var done = false;
      var f = document.createElement('iframe');
      f.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:400px;height:300px';
      function finish(ok) {
        if (done) return;
        done = true;
        clearTimeout(timer);
        try { f.remove(); } catch (e) {}
        resolve(ok);
      }
      var timer = setTimeout(function () { finish(false); }, 25000);
      f.addEventListener('load', function () {
        // Give the engine a moment to swap in the real document.
        setTimeout(function () {
          var ok = false;
          try {
            var d = f.contentDocument;
            var text = (d && d.body ? d.body.innerText : '') || '';
            ok = /Example Domain/i.test(text);
          } catch (e) { ok = false; }
          finish(ok);
        }, 2500);
      });
      f.src = probe;
      document.body.appendChild(f);
    });
  }

  /** Bring up BareMux + transport on the first base that genuinely works. */
  function setupTransport(preferred, wisp, buildUrl) {
    var bases = transportOrder(preferred);
    var i = 0;
    function next(lastErr) {
      if (i >= bases.length) {
        return Promise.reject(lastErr || new Error('No transport could serve pages.'));
      }
      var b = bases[i++];
      return preflight(b + '/baremux/index.js')
        .then(function () { return loadScript(b + '/baremux/index.js'); })
        .then(function () {
          var conn = new global.BareMux.BareMuxConnection(b + '/baremux/worker.js');
          return conn.setTransport(b + '/libcurl/index.mjs', [{ wisp: wisp, websocket: wisp }]);
        })
        .then(function () { return verifyThrough(buildUrl); })
        .then(function (ok) {
          if (!ok) throw new Error('transport at ' + b + ' did not serve pages');
          return b;
        })
        .catch(function (e) { return next(e); });
    }
    return next(null);
  }

  /** Confirm a runtime file is actually reachable before relying on it. */
  function preflight(url) {
    return fetch(url, { method: 'GET', cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return true;
    }).catch(function (e) {
      throw new Error('Could not fetch the proxy runtime at ' + url +
        ' (' + e.message + '). Your network may be blocking it.');
    });
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
