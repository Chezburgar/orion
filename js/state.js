/* ===== Global state, persistence, tiny utilities ===== */
(function (global) {
  'use strict';

  var KEY = 'win11emu.state.v1';
  var BUILD = '2026-08-27.18';

  var DEFAULTS = {
    user: 'Chase',
    theme: 'dark',
    accent: '#4f46e5',
    wallpaper: 'assets/wall-orion.svg',
    volume: 65,
    brightness: 100,
    transparency: true,
    quick: { wifi: true, bluetooth: false, airplane: false, night: false, saver: false, cast: false },
    edge: {
      homepage: 'edge://newtab',
      searchEngine: 'bing',
      render: 'app',
      siteModes: {},
      modesReset: false,
      images: true,
      styles: true,
      allowEmbedding: true,
      favorites: [
        { title: 'New tab', url: 'edge://newtab', icon: 'globe' },
        { title: 'Bing', url: 'https://bing.local', icon: 'search' },
        { title: 'Emulator docs', url: 'https://docs.emu', icon: 'doc' },
        { title: 'Example.com', url: 'https://example.com', icon: 'globe' }
      ],
      history: [],
      downloads: []
    },
    net: {
      connected: false,
      relay: 'corssh',
      location: 'auto',
      killSwitch: false,
      autoConnect: false,
      protocol: 'WireGuard',
      since: 0,
      lastPing: 0,
      lastProbe: '',
      seenDisclosure: false
    },
    rebranded: false,
    installed: [],
    games: [],
    notifications: [],
    recent: [],
    desktopIcons: null
  };

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function merge(base, over) {
    var out = clone(base), k;
    for (k in over) {
      if (!Object.prototype.hasOwnProperty.call(over, k)) continue;
      if (over[k] && typeof over[k] === 'object' && !Array.isArray(over[k]) && base[k] &&
          typeof base[k] === 'object' && !Array.isArray(base[k])) {
        out[k] = merge(base[k], over[k]);
      } else if (over[k] !== undefined) {
        out[k] = over[k];
      }
    }
    return out;
  }

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return clone(DEFAULTS);
      return merge(DEFAULTS, JSON.parse(raw));
    } catch (e) {
      return clone(DEFAULTS);
    }
  }

  var state = load();
  var listeners = {};
  var saveTimer = null;

  // One-time move onto the Orion theme. Only values still sitting at the old
  // defaults are touched, so a colour or wallpaper you picked yourself stays.
  // Stored render overrides are gone for good: a site can no longer be left
  // permanently downgraded to text. Clear any left over from older builds.
  if (state.build !== BUILD) {
    state.edge.siteModes = {};
    state.edge.render = 'app';
    // Engine pins written by older builds could force a site onto an engine
    // that cannot load it; start every build from a clean slate.
    if (state.proxy) state.proxy.siteEngine = {};
    state.build = BUILD;
  }

  // Proxy-everything became the default after it turned out the network here
  // filters most sites. Apply it once to existing installs, then leave it to
  // whatever the user sets.
  if (!state.proxyDefaultApplied) {
    state.proxy = state.proxy || {};
    state.proxy.always = true;
    state.proxyDefaultApplied = true;
  }

  if (!state.rebranded) {
    if (state.accent === '#0078d4') state.accent = '#4f46e5';
    if (state.wallpaper === 'assets/wall-bloom.svg') state.wallpaper = 'assets/wall-orion.svg';
    state.rebranded = true;
  }

  var util = {
    $: function (sel, root) { return (root || document).querySelector(sel); },
    $$: function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); },
    /** Build one element from an HTML string. */
    el: function (html) {
      var t = document.createElement('template');
      t.innerHTML = html.trim();
      return t.content.firstElementChild;
    },
    esc: function (s) {
      return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    },
    uid: function (p) { return (p || 'id') + '-' + Math.random().toString(36).slice(2, 9); },
    clamp: function (v, a, b) { return v < a ? a : v > b ? b : v; },
    fmtTime: function (d, seconds) {
      d = d || new Date();
      var o = { hour: 'numeric', minute: '2-digit' };
      if (seconds) o.second = '2-digit';
      return d.toLocaleTimeString([], o);
    },
    fmtShortDate: function (d) {
      d = d || new Date();
      return (d.getMonth() + 1) + '/' + d.getDate() + '/' + d.getFullYear();
    },
    fmtLongDate: function (d) {
      d = d || new Date();
      return d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
    },
    fmtBytes: function (n) {
      if (n < 1024) return n + ' B';
      if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
      return (n / 1048576).toFixed(1) + ' MB';
    },
    fmtAgo: function (ts) {
      var s = Math.max(1, Math.round((Date.now() - ts) / 1000));
      if (s < 60) return s + 's ago';
      if (s < 3600) return Math.round(s / 60) + 'm ago';
      if (s < 86400) return Math.round(s / 3600) + 'h ago';
      return Math.round(s / 86400) + 'd ago';
    },
    debounce: function (fn, ms) {
      var t;
      return function () {
        var a = arguments, c = this;
        clearTimeout(t);
        t = setTimeout(function () { fn.apply(c, a); }, ms || 120);
      };
    },
    /** Lighten/darken a hex colour by amt (-1..1). */
    shade: function (hex, amt) {
      var n = parseInt(hex.slice(1), 16);
      var r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
      function m(c) { return Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt); }
      return '#' + [m(r), m(g), m(b)].map(function (c) {
        return ('0' + c.toString(16)).slice(-2);
      }).join('');
    }
  };

  var Emu = {
    BUILD: BUILD,
    state: state,
    util: util,
    apps: {},
    appOrder: [],

    save: function () {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(function () {
        try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* quota / private mode */ }
      }, 150);
    },

    reset: function () {
      try { localStorage.removeItem(KEY); localStorage.removeItem('win11emu.vfs.v1'); } catch (e) {}
      location.reload();
    },

    on: function (evt, fn) {
      (listeners[evt] || (listeners[evt] = [])).push(fn);
      return fn;
    },
    off: function (evt, fn) {
      var a = listeners[evt];
      if (a) listeners[evt] = a.filter(function (f) { return f !== fn; });
    },
    emit: function (evt, data) {
      (listeners[evt] || []).forEach(function (f) {
        try { f(data); } catch (e) { console.error('[' + evt + ']', e); }
      });
    },

    /** Register an application definition. */
    registerApp: function (def) {
      Emu.apps[def.id] = def;
      if (Emu.appOrder.indexOf(def.id) < 0) Emu.appOrder.push(def.id);
      return def;
    },

    /**
     * Push a notification into the Action Center (shell renders the toast).
     * opts.action / opts.buttons are stored as plain data - a notification
     * outlives a reload, so handlers are looked up by name at click time.
     */
    notify: function (title, body, icon, opts) {
      opts = opts || {};
      var n = {
        id: util.uid('n'), title: title, body: body, icon: icon || 'info', ts: Date.now(),
        action: opts.action || null, buttons: opts.buttons || null
      };
      state.notifications.unshift(n);
      if (state.notifications.length > 30) state.notifications.length = 30;
      Emu.save();
      Emu.emit('notify', n);
      return n;
    },

    /** Apps register what a notification click should do. */
    notifyHandlers: {},
    onNotifAction: function (name, fn) { Emu.notifyHandlers[name] = fn; },
    runNotifAction: function (action) {
      if (!action || !action.do) return false;
      var fn = Emu.notifyHandlers[action.do];
      if (!fn) return false;
      try { fn(action); } catch (e) { console.error('notif action', e); }
      return true;
    },
    dismissNotif: function (id) {
      state.notifications = state.notifications.filter(function (n) { return n.id !== id; });
      Emu.save();
      Emu.emit('notify:changed');
    },

    /** Track a recently used item for Start's Recommended list. */
    pushRecent: function (item) {
      state.recent = state.recent.filter(function (r) { return r.path !== item.path; });
      state.recent.unshift(Object.assign({ ts: Date.now() }, item));
      if (state.recent.length > 8) state.recent.length = 8;
      Emu.save();
      Emu.emit('recent');
    },

    applyTheme: function () {
      var s = state;
      document.documentElement.setAttribute('data-theme', s.theme);
      document.documentElement.style.setProperty('--accent', s.accent);
      document.documentElement.style.setProperty('--accent-2', util.shade(s.accent, 0.35));
      var wp = util.$('#wallpaper');
      if (wp) {
        wp.style.background = /^#/.test(s.wallpaper)
          ? s.wallpaper
          : 'center/cover no-repeat url("' + s.wallpaper + '")';
      }
      document.body.style.filter = s.brightness < 100
        ? 'brightness(' + (0.45 + s.brightness / 100 * 0.55).toFixed(3) + ')'
        : '';
      if (!s.transparency) {
        document.documentElement.style.setProperty('--acrylic', s.theme === 'dark' ? '#2b2b2b' : '#f6f6f6');
        document.documentElement.style.setProperty('--mica', s.theme === 'dark' ? '#1f1f1f' : '#f3f3f3');
      } else {
        document.documentElement.style.removeProperty('--acrylic');
        document.documentElement.style.removeProperty('--mica');
      }
      Emu.emit('theme');
    }
  };

  Emu.WALLPAPERS = [
    { name: 'Orion', value: 'assets/wall-orion.svg' },
    { name: 'Bloom', value: 'assets/wall-bloom.svg' },
    { name: 'Flow', value: 'assets/wall-flow.svg' },
    { name: 'Glow', value: 'assets/wall-dark.svg' },
    { name: 'Sunset', value: 'assets/lock.svg' },
    { name: 'Slate', value: '#1b2430' },
    { name: 'Ink', value: '#0f172a' }
  ];

  Emu.ACCENTS = ['#4f46e5', '#3b6cf6', '#22a7ff', '#8b5cf6', '#0078d4', '#4cc2ff', '#00b7c3', '#10893e', '#7a7574', '#8764b8',
    '#c239b3', '#e3008c', '#ea005e', '#ca5010', '#ef6950', '#498205'];

  global.Emu = Emu;
})(window);
