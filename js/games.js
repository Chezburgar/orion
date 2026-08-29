/* ===== Installable games =====
   A game is a real web game hosted somewhere else. Installing it registers
   an app that opens the site in a proper frame, so its own JavaScript,
   WebGL, pointer lock and audio all run natively.                        */
(function (global) {
  'use strict';

  var Emu = global.Emu, U = Emu.util, Icons = global.Icons, WM = global.WM;

  // ------------------------------------------------------------- catalogue
  var CATALOG = {
    breach: {
      name: 'Breach',
      url: 'https://chezburgar.github.io/breach/',
      cat: 'Action', size: 74, rating: 4.6,
      desc: 'Fast-paced action, straight from your own GitHub Pages build. Runs in a real frame, so ' +
            'pointer lock, audio and WebGL all work.',
      art: ['#5b21b6', '#2563eb'], w: 1100, h: 720
    },
    rythem: {
      name: 'Rythem',
      url: 'https://chezburgar.github.io/Rythem/',
      cat: 'Music', size: 52, rating: 4.4,
      desc: 'Rhythm game. Keyboard input goes straight through to the game, and audio is allowed ' +
            'to autoplay inside the window.',
      art: ['#db2777', '#7c3aed'], w: 1000, h: 700
    },
    hollow: {
      name: 'Hollow Knight',
      url: 'https://ubgone.github.io/Hollow-knight4school/',
      cat: 'Platformer', size: 128, rating: 4.9,
      desc: 'The full browser build. Give it a moment to load the first time - it is a big game.',
      art: ['#0f766e', '#1e1b4b'], w: 1180, h: 760
    }
  };

  /** Catalogue shared by everyone, fetched from the server. */
  var shared = {};

  function rpc(fn, body) {
    return fetch(Auth.CFG.url + '/rest/v1/rpc/' + fn, {
      method: 'POST',
      headers: {
        'apikey': Auth.CFG.key, 'Authorization': 'Bearer ' + Auth.CFG.key,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body || {})
    }).then(function (r) {
      return r.text().then(function (t) {
        var p = null;
        try { p = t ? JSON.parse(t) : null; } catch (e) { p = t; }
        if (!r.ok) throw new Error((p && (p.message || p.hint)) || ('HTTP ' + r.status));
        return p;
      });
    });
  }

  /** Pull the shared catalogue; falls back to whatever is cached in state. */
  function refresh() {
    return rpc('orion_games_list', {}).then(function (rows) {
      shared = {};
      (rows || []).forEach(function (r) {
        shared[r.id] = {
          id: r.id, name: r.name, url: r.url, cat: r.cat, size: r.size,
          rating: Number(r.rating) || 4.5, desc: r.descr || '',
          proxied: !!r.proxied, art: [r.art1, r.art2], shared: true, icon: r.icon || null
        };
      });
      Emu.state.sharedGames = shared;
      Emu.save();
      Emu.emit('apps');
      return shared;
    }).catch(function () {
      shared = Emu.state.sharedGames || {};
      return shared;
    });
  }

  /** Games the user added themselves live in state. */
  function custom() { return Emu.state.games || (Emu.state.games = []); }

  function all() {
    var out = {};
    Object.keys(CATALOG).forEach(function (k) { out[k] = CATALOG[k]; });
    var sh = Object.keys(shared).length ? shared : (Emu.state.sharedGames || {});
    Object.keys(sh).forEach(function (k) { out[k] = sh[k]; });
    custom().forEach(function (g) { out[g.id] = g; });
    return out;
  }

  function get(id) { return all()[id]; }

  // ------------------------------------------------------------- tile art
  function artFor(id, g) {
    if (g && g.icon) return g.icon;
    var name = 'game-' + id;
    if (Icons.has(name)) return name;
    var c = g.art || palette(id);
    var initials = String(g.name).replace(/[^A-Za-z0-9 ]/g, '').split(/\s+/)
      .slice(0, 2).map(function (w) { return w.charAt(0).toUpperCase(); }).join('');
    Icons.add(name,
      '<defs><linearGradient id="ga' + id + '" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="' + c[0] + '"/><stop offset="1" stop-color="' + c[1] + '"/>' +
      '</linearGradient></defs>' +
      '<rect x="1.5" y="1.5" width="29" height="29" rx="7" fill="url(#ga' + id + ')"/>' +
      '<path d="M23.5 5.5c.5 3.4 1.3 4.4 4.6 4.9-3.3.5-4.1 1.5-4.6 4.9-.5-3.4-1.3-4.4-4.6-4.9 3.3-.5 4.1-1.5 4.6-4.9Z" fill="#fff" opacity=".85"/>' +
      '<text x="15" y="24" text-anchor="middle" font-family="Segoe UI,system-ui,sans-serif" ' +
      'font-size="15" font-weight="700" fill="#fff" opacity=".96">' + U.esc(initials) + '</text>');
    return name;
  }

  function palette(seed) {
    var pairs = [['#2563eb', '#4c1d95'], ['#0891b2', '#1e3a8a'], ['#c026d3', '#4338ca'],
                 ['#ea580c', '#7c2d12'], ['#059669', '#134e4a'], ['#e11d48', '#4c1d95']];
    var n = 0;
    for (var i = 0; i < seed.length; i++) n += seed.charCodeAt(i);
    return pairs[n % pairs.length];
  }

  // ------------------------------------------------------------ the window
  function openGame(id) {
    var g = get(id);
    if (!g) return null;
    var icon = artFor(id, g);

    var win = WM.create({
      appId: id, title: g.name, icon: icon,
      width: g.w || 1080, height: g.h || 720, minWidth: 420, minHeight: 320,
      className: 'game-win'
    });

    win.body.innerHTML =
      '<div class="gw">' +
        '<div class="gw-bar">' +
          '<span class="gw-name">' + Icons.get(icon) + '<b>' + U.esc(g.name) + '</b></span>' +
          '<span class="gw-load" data-load>Loading…</span>' +
          '<span class="gw-spacer"></span>' +
          '<button class="e-btn" data-g="reload" title="Restart">' + Icons.get('refresh') + '</button>' +
          '<button class="e-btn" data-g="full" title="Fill the screen">' + Icons.get('maximize') + '</button>' +
          '<button class="e-btn" data-g="ext" title="Open in a real browser tab">' + Icons.get('upload') + '</button>' +
        '</div>' +
        '<div class="gw-stage"></div>' +
      '</div>';

    var stage = U.$('.gw-stage', win.body);
    var loadEl = U.$('[data-load]', win.body);

    function mount() {
      stage.innerHTML = '';
      loadEl.textContent = g.proxied ? 'Starting the proxy…' : 'Loading…';
      loadEl.classList.remove('hidden');
      // Games flagged "open through the proxy" need the tunnel up first.
      if (g.proxied && global.OrionProxy) {
        global.OrionProxy.startFor(g.url).then(function (ok) {
          var via = ok ? global.OrionProxy.urlFor(g.url) : null;
          mountFrame(via || g.url);
        });
        return;
      }
      mountFrame(g.url);
    }

    function mountFrame(target) {
      loadEl.textContent = 'Loading…';
      var f = document.createElement('iframe');
      f.className = 'gw-frame';
      // Delegate the capabilities games actually need.
      f.setAttribute('allow', 'fullscreen; autoplay; gamepad; pointer-lock; accelerometer; gyroscope; clipboard-write');
      f.setAttribute('allowfullscreen', 'true');
      f.src = target;
      f.addEventListener('load', function () {
        loadEl.textContent = 'Ready';
        setTimeout(function () { loadEl.classList.add('hidden'); }, 1200);
      });
      stage.appendChild(f);
      // If nothing has loaded after a while, say something useful.
      setTimeout(function () {
        if (loadEl.classList.contains('hidden')) return;
        loadEl.textContent = 'Still loading — big games can take a while';
      }, 8000);
    }

    win.body.addEventListener('click', function (e) {
      var b = e.target.closest('[data-g]');
      if (!b) return;
      if (b.dataset.g === 'reload') mount();
      if (b.dataset.g === 'full') win.toggleMax();
      if (b.dataset.g === 'ext') window.open(g.url, '_blank', 'noopener');
    });

    mount();
    Emu.pushRecent({ name: g.name, path: g.url, app: id });
    return win;
  }

  // --------------------------------------------------------- registration
  function register(id) {
    var g = get(id);
    if (!g || Emu.apps[id]) return;
    Emu.registerApp({
      id: id, name: g.name, icon: artFor(id, g), desc: g.desc, game: true, startPinned: true,
      launch: function () { return openGame(id); }
    });
  }

  function unregister(id) {
    WM.closeAll(id);
    delete Emu.apps[id];
    Emu.appOrder = Emu.appOrder.filter(function (x) { return x !== id; });
  }

  /** Add a game the user supplied by URL. */
  function addCustom(name, url) {
    var id = 'g-' + String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24);
    if (!id || id === 'g-') id = 'g-' + Math.random().toString(36).slice(2, 7);
    if (get(id)) id += '-' + Math.random().toString(36).slice(2, 5);
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    var g = { id: id, name: name, url: url, cat: 'Added by you', size: 20 + Math.floor(Math.random() * 90),
      rating: 4.0, desc: 'Added from ' + url, custom: true };
    custom().push(g);
    Emu.save();
    return g;
  }

  function removeCustom(id) {
    Emu.state.games = custom().filter(function (g) { return g.id !== id; });
    Emu.save();
  }

  function addShared(name, url, opts) {
    opts = opts || {};
    return rpc('orion_games_add', {
      p_key: Auth.ownerKey(), p_name: name, p_url: url,
      p_cat: opts.cat || 'Added', p_descr: opts.desc || ('Added from ' + url),
      p_proxied: !!opts.proxied, p_art1: opts.art1 || '', p_art2: opts.art2 || ''
    }).then(refresh);
  }

  function removeShared(id) {
    return rpc('orion_games_remove', { p_key: Auth.ownerKey(), p_id: id }).then(refresh);
  }

  function setIcon(id, dataUrl) {
    return rpc('orion_games_set_icon', { p_key: Auth.ownerKey(), p_id: id, p_icon: dataUrl })
      .then(function () {
        Icons.add('game-' + id, null);   // drop the generated tile
        return refresh();
      });
  }

  function setProxied(id, on) {
    return rpc('orion_games_set_proxied', { p_key: Auth.ownerKey(), p_id: id, p_proxied: !!on })
      .then(refresh);
  }

  global.Games = {
    refresh: refresh,
    addShared: addShared,
    removeShared: removeShared,
    setProxied: setProxied,
    setIcon: setIcon,
    catalog: CATALOG,
    list: all,
    get: get,
    art: artFor,
    register: register,
    unregister: unregister,
    addCustom: addCustom,
    removeCustom: removeCustom,
    open: openGame
  };

  // Restore installed games after the built-in apps have registered.
  refresh();

  function restore() {
    // Drop anything installed that no longer exists (e.g. the old built-ins).
    Emu.state.installed = (Emu.state.installed || []).filter(function (id) { return !!get(id); });
    Emu.save();
    Emu.state.installed.forEach(register);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', restore);
  else restore();
})(window);
