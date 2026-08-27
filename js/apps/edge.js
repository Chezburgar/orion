/* ===== Microsoft Edge =====
   Tabs, omnibox, history, favorites, downloads, settings, an internal
   simulated web, and real-site embedding with a graceful fallback.       */
(function (global) {
  'use strict';

  var Emu = global.Emu, U = Emu.util, Icons = global.Icons, WM = global.WM, VFS = global.VFS;

  var NEWTAB = 'edge://newtab';

  // ---------------------------------------------------------------- index
  // The simulated web the emulator can actually serve.
  var INDEX = [
    { url: 'https://bing.local', title: 'Bing', desc: 'Search the emulator web.', kw: 'search bing engine web' },
    { url: 'https://docs.emu', title: 'Windows 11 Emulator - Documentation', desc: 'Every feature, keyboard shortcut and app in this emulator.', kw: 'docs help shortcuts keyboard manual guide windows' },
    { url: 'https://news.emu', title: 'Emu News - Today', desc: 'Headlines, weather and sport from the simulated web.', kw: 'news headlines today msn feed' },
    { url: 'https://weather.emu', title: 'Weather - Emu Forecast', desc: 'Seven day forecast for wherever you are pretending to be.', kw: 'weather forecast rain temperature' },
    { url: 'https://games.emu', title: 'Emu Games - Minesweeper', desc: 'Play Minesweeper right inside the emulated browser.', kw: 'games minesweeper play fun solitaire' },
    { url: 'https://about.emu', title: 'About this emulator', desc: 'What is real, what is simulated, and how it was built.', kw: 'about credits built how source' },
    { url: 'https://example.com', title: 'Example Domain', desc: 'A real website that allows embedding - loads for real.', kw: 'example real internet live' }
  ];

  var ENGINES = {
    bing: { name: 'Bing', url: 'https://www.bing.com/search?q=' },
    google: { name: 'Google', url: 'https://www.google.com/search?q=' },
    duckduckgo: { name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=' }
  };

  // ------------------------------------------------------------ URL parse
  function parseUrl(input) {
    var s = String(input || '').trim();
    if (!s) return { kind: 'internal', url: NEWTAB, host: 'newtab', path: '/', query: {} };

    if (/^edge:\/\//i.test(s)) {
      var page = s.replace(/^edge:\/\//i, '').split(/[?#]/)[0].replace(/\/+$/, '') || 'newtab';
      return { kind: 'internal', url: 'edge://' + page, host: page, path: '/', query: qs(s) };
    }
    var hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(s);
    var looksLikeHost = /^[\w-]+(\.[\w-]+)+(\/|$|\?|#|:)/.test(s) || /^localhost(:|\/|$)/.test(s);

    if (!hasScheme && !looksLikeHost) return { kind: 'search', url: s, term: s };

    var full = hasScheme ? s : 'https://' + s;
    var a = document.createElement('a');
    a.href = full;
    var host = a.hostname.replace(/^www\./, '');
    var known = SITES[host];
    return {
      kind: known ? 'site' : 'external',
      url: full, host: host, path: a.pathname || '/', query: qs(full), secure: a.protocol === 'https:'
    };
  }

  function qs(u) {
    var out = {}, i = u.indexOf('?');
    if (i < 0) return out;
    u.slice(i + 1).split('#')[0].split('&').forEach(function (p) {
      if (!p) return;
      var kv = p.split('=');
      out[decodeURIComponent(kv[0])] = decodeURIComponent((kv[1] || '').replace(/\+/g, ' '));
    });
    return out;
  }

  function searchUrl(term) { return 'https://bing.local/search?q=' + encodeURIComponent(term); }

  // ------------------------------------------------------- simulated web
  function pageShell(inner) { return '<div class="pg">' + inner + '</div>'; }

  function link(url, text) { return '<span class="lnk" data-url="' + U.esc(url) + '">' + U.esc(text) + '</span>'; }

  var SITES = {
    'bing.local': {
      title: 'Bing', favicon: 'search',
      render: function (p, api) {
        var q = p.query.q || '';
        if (!q) {
          return {
            title: 'Bing',
            html: pageShell(
              '<div style="text-align:center;padding:40px 0 10px"><h1 style="font-size:44px;margin:0">Bing</h1>' +
              '<p class="muted">The emulator\'s search engine</p></div>' +
              '<div class="card"><b>Try searching for</b><ul>' +
              '<li>' + link(searchUrl('keyboard shortcuts'), 'keyboard shortcuts') + '</li>' +
              '<li>' + link(searchUrl('minesweeper'), 'minesweeper') + '</li>' +
              '<li>' + link(searchUrl('weather'), 'weather') + '</li></ul></div>')
          };
        }
        var terms = q.toLowerCase().split(/\s+/);
        var hits = INDEX.filter(function (s) {
          var hay = (s.title + ' ' + s.desc + ' ' + s.kw + ' ' + s.url).toLowerCase();
          return terms.some(function (t) { return hay.indexOf(t) >= 0; });
        });
        var html = '<h1 style="font-size:22px">Results for &ldquo;' + U.esc(q) + '&rdquo;</h1>' +
          '<p class="muted" style="font-size:12.5px">' + hits.length + ' results from the emulator index &middot; ' +
          '<span class="lnk" data-real="' + U.esc(ENGINES[Emu.state.edge.searchEngine].url + encodeURIComponent(q)) + '">' +
          'search the real web instead</span></p><div class="srp">';
        if (!hits.length) {
          html += '<div class="card">No pages in the emulator index match that. ' +
            'The simulated web is small on purpose - try ' + link('https://docs.emu', 'the documentation') + '.</div>';
        }
        hits.forEach(function (h) {
          html += '<div class="res"><b class="lnk" data-url="' + U.esc(h.url) + '">' + U.esc(h.title) + '</b>' +
            '<div class="u">' + U.esc(h.url) + '</div><p>' + U.esc(h.desc) + '</p></div>';
        });
        html += '</div>';
        return { title: q + ' - Bing', html: pageShell(html) };
      }
    },

    'docs.emu': {
      title: 'Documentation', favicon: 'doc',
      render: function () {
        return {
          title: 'Windows 11 Emulator - Docs',
          html: pageShell(
            '<div class="hero"><h1>Windows 11 Emulator</h1><p>A desktop environment, a window manager and a web browser - ' +
            'all of it HTML, CSS and JavaScript running in your real browser.</p></div>' +
            '<h2>Keyboard shortcuts</h2>' +
            '<div class="kv">' +
            '<b>Win</b><span>Open or close Start</span>' +
            '<b>Win + D</b><span>Show the desktop</span>' +
            '<b>Win + E</b><span>Open File Explorer</span>' +
            '<b>Win + S</b><span>Search</span>' +
            '<b>Win + Tab</b><span>Task View</span>' +
            '<b>Win + A</b><span>Quick Settings</span>' +
            '<b>Win + N</b><span>Notification Centre</span>' +
            '<b>Win + W</b><span>Widgets</span>' +
            '<b>Win + Left / Right</b><span>Snap the active window</span>' +
            '<b>Win + Up / Down</b><span>Maximize / restore</span>' +
            '<b>Alt + Tab</b><span>Switch windows</span>' +
            '<b>Ctrl + T / W</b><span>New / close tab (in Edge)</span>' +
            '<b>Ctrl + L</b><span>Focus the address bar</span>' +
            '<b>F5</b><span>Reload the page</span>' +
            '</div>' +
            '<h2>Apps</h2><ul>' +
            '<li><b>Microsoft Edge</b> - tabs, history, favourites, downloads and settings. Browses the simulated web and can embed real sites.</li>' +
            '<li><b>File Explorer</b> - a real virtual file system saved in localStorage. Create, rename, copy and delete.</li>' +
            '<li><b>Notepad</b> - opens and saves text files from the file system.</li>' +
            '<li><b>Settings</b> - wallpaper, accent colour, light/dark theme, transparency.</li>' +
            '<li><b>Calculator</b>, <b>Terminal</b>, <b>Photos</b>, <b>Store</b> and <b>Task Manager</b>.</li></ul>' +
            '<p><button class="btn" data-act="download" data-name="Shortcuts.txt">Download the shortcut list</button></p>' +
            '<h2>What is simulated</h2>' +
            '<p>Windows itself is not running here - there is no VM and no Microsoft code. This is an interface built from ' +
            'scratch that behaves like Windows 11. Sites ending in <code>.emu</code> and <code>bing.local</code> are pages ' +
            'shipped inside the emulator. Real URLs are loaded in an iframe, which many sites refuse - see ' +
            link('https://about.emu', 'about.emu') + '.</p>')
        };
      }
    },

    'news.emu': {
      title: 'Emu News', favicon: 'globe',
      render: function () {
        var stories = [
          ['Technology', 'Browser-based desktop hits 60 fps on a laptop from 2016', 'Turns out most of an operating system UI is just rectangles with rounded corners.'],
          ['Science', 'Local storage found to contain 4 years of unfinished to-do lists', 'Researchers describe the discovery as "relatable".'],
          ['Business', 'Startup raises seed round to put a taskbar on everything', 'The taskbar will be centred, obviously.'],
          ['Sport', 'Minesweeper world record broken on a simulated machine', 'Officials are reviewing whether the flag counter counts.'],
          ['Travel', 'Wallpaper photographers admit the bloom is not a real flower', 'It never was.']
        ];
        var html = '<h1>Emu News</h1><p class="muted">' + new Date().toDateString() + ' &middot; entirely fictional headlines</p>';
        stories.forEach(function (s) {
          html += '<div class="card"><div class="muted" style="font-size:11.5px;text-transform:uppercase;letter-spacing:.5px">' +
            U.esc(s[0]) + '</div><b style="font-size:16px">' + U.esc(s[1]) + '</b><p>' + U.esc(s[2]) + '</p></div>';
        });
        html += '<p>' + link('https://weather.emu', 'See the forecast') + ' &middot; ' + link('https://games.emu', 'Play a game') + '</p>';
        return { title: 'Emu News - Today', html: pageShell(html) };
      }
    },

    'weather.emu': {
      title: 'Weather', favicon: 'sun',
      render: function () {
        var days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        var now = new Date().getDay();
        var html = '<h1>Emu Forecast</h1><div class="card" style="display:flex;align-items:center;gap:24px">' +
          '<div style="font-size:54px;font-weight:600">21&deg;</div><div><b>Partly cloudy</b>' +
          '<div class="muted">Feels like 20&deg; &middot; Humidity 48% &middot; Wind 11 km/h</div></div></div><div class="card">';
        for (var i = 0; i < 7; i++) {
          var d = days[(now + i) % 7], hi = 18 + ((i * 3) % 7), lo = 9 + (i % 4);
          html += '<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid rgba(128,128,128,.2)">' +
            '<span>' + d + (i === 0 ? ' (today)' : '') + '</span><span>' + hi + '&deg; / ' + lo + '&deg;</span></div>';
        }
        html += '</div><p class="muted">Numbers generated by arithmetic, not meteorology.</p>';
        return { title: 'Weather - Emu Forecast', html: pageShell(html) };
      }
    },

    'about.emu': {
      title: 'About', favicon: 'info',
      render: function () {
        return {
          title: 'About this emulator',
          html: pageShell(
            '<h1>About this emulator</h1>' +
            '<p>This is a Windows 11 <em>simulation</em>: a desktop shell, window manager and browser written in plain ' +
            'HTML/CSS/JS. No Microsoft code is included and nothing is virtualised.</p>' +
            '<h2>Real vs simulated</h2>' +
            '<div class="card"><b>Really works</b><ul>' +
            '<li>Window dragging, resizing, snapping, minimise/maximise, z-order</li>' +
            '<li>A virtual file system that persists in localStorage</li>' +
            '<li>Edge tabs, history, favourites, downloads and settings</li>' +
            '<li>Real websites in an iframe when the site permits embedding</li></ul></div>' +
            '<div class="card"><b>Simulated</b><ul>' +
            '<li>Sites ending in <code>.emu</code> and <code>bing.local</code></li>' +
            '<li>Wi-Fi, Bluetooth, battery and the news feed</li>' +
            '<li>Task Manager CPU/memory figures</li></ul></div>' +
            '<h2>Why do most real sites show an error?</h2>' +
            '<p>Sites send an <code>X-Frame-Options</code> or <code>frame-ancestors</code> header telling browsers not to ' +
            'display them inside another page. The emulator cannot override that - it is the same rule that stops sites ' +
            'from being framed by phishing pages. Use <b>Open in system browser</b> on the error page.</p>')
        };
      }
    },

    'games.emu': {
      title: 'Emu Games', favicon: 'game',
      render: function () {
        return { title: 'Minesweeper - Emu Games', html: pageShell('<h1>Minesweeper</h1><div id="msHost"></div>'), mount: mountMinesweeper };
      }
    }
  };

  // ------------------------------------------------------- mini minesweeper
  function mountMinesweeper(host) {
    var root = host.querySelector('#msHost');
    if (!root) return;
    var W = 9, H = 9, MINES = 10, grid, over, flags, revealed;

    function reset() {
      grid = []; over = false; flags = 0; revealed = 0;
      for (var i = 0; i < W * H; i++) grid.push({ m: false, r: false, f: false, n: 0 });
      var placed = 0;
      while (placed < MINES) {
        var k = Math.floor(Math.random() * W * H);
        if (!grid[k].m) { grid[k].m = true; placed++; }
      }
      grid.forEach(function (c, i) {
        c.n = neighbours(i).filter(function (j) { return grid[j].m; }).length;
      });
      draw();
    }
    function neighbours(i) {
      var x = i % W, y = (i / W) | 0, out = [];
      for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        var nx = x + dx, ny = y + dy;
        if (nx >= 0 && nx < W && ny >= 0 && ny < H) out.push(ny * W + nx);
      }
      return out;
    }
    function reveal(i) {
      var c = grid[i];
      if (c.r || c.f || over) return;
      c.r = true; revealed++;
      if (c.m) { over = 'lost'; grid.forEach(function (g) { if (g.m) g.r = true; }); return; }
      if (c.n === 0) neighbours(i).forEach(reveal);
      if (revealed === W * H - MINES) over = 'won';
    }
    function draw() {
      var COLORS = ['', '#4aa3e8', '#4caf50', '#e35d5d', '#7c5cf0', '#c98a2a', '#28a3a3', '#999', '#666'];
      var html = '<div style="display:flex;gap:10px;align-items:center;margin-bottom:10px">' +
        '<button class="btn" data-ms-new>New game</button><span class="muted">Mines left: ' + (MINES - flags) + '</span>' +
        (over ? '<b style="color:' + (over === 'won' ? '#4caf50' : '#e35d5d') + '">' +
          (over === 'won' ? 'You cleared it!' : 'Boom.') + '</b>' : '') + '</div>' +
        '<div style="display:grid;grid-template-columns:repeat(' + W + ',30px);gap:2px">';
      grid.forEach(function (c, i) {
        var label = c.r ? (c.m ? '&#9679;' : (c.n || '')) : (c.f ? '&#9873;' : '');
        var bg = c.r ? (c.m ? '#e35d5d' : 'rgba(128,128,128,.16)') : 'rgba(128,128,128,.34)';
        html += '<div data-ms="' + i + '" style="width:30px;height:30px;display:grid;place-items:center;border-radius:4px;' +
          'font-weight:600;font-size:14px;cursor:default;background:' + bg + ';color:' +
          (c.r && !c.m ? COLORS[c.n] : 'inherit') + '">' + label + '</div>';
      });
      root.innerHTML = html + '</div><p class="muted">Left click reveals, right click flags.</p>';
    }
    root.addEventListener('click', function (e) {
      if (e.target.closest('[data-ms-new]')) return reset();
      var cell = e.target.closest('[data-ms]');
      if (cell) { reveal(+cell.dataset.ms); draw(); }
    });
    root.addEventListener('contextmenu', function (e) {
      var cell = e.target.closest('[data-ms]');
      if (!cell) return;
      e.preventDefault(); e.stopPropagation();
      var c = grid[+cell.dataset.ms];
      if (!c.r) { c.f = !c.f; flags += c.f ? 1 : -1; draw(); }
    });
    reset();
  }

  // -------------------------------------------------------- internal pages
  function internalPage(name, p, edge) {
    var st = Emu.state.edge;
    switch (name) {
      case 'newtab': return { title: 'New tab', favicon: 'globe', html: newTabHtml(), cls: 'ntp-host' };
      case 'history': {
        var rows = st.history.slice(0, 200).map(function (h) {
          return '<div class="e-row"><span>' + Icons.get('globe') + '</span>' +
            '<span class="t lnk" data-url="' + U.esc(h.url) + '">' + U.esc(h.title || h.url) + '</span>' +
            '<span class="u">' + U.esc(h.url) + '</span><span class="when">' + U.fmtAgo(h.ts) + '</span></div>';
        }).join('') || '<p class="muted">No history yet.</p>';
        return { title: 'History', favicon: 'history', html: '<div class="e-list"><h1>History</h1>' +
          '<p><button class="btn" data-act="clear-history">Clear browsing history</button></p>' + rows + '</div>' };
      }
      case 'favorites': {
        var favs = st.favorites.map(function (f, i) {
          return '<div class="e-row"><span>' + Icons.get(f.icon || 'globe') + '</span>' +
            '<span class="t lnk" data-url="' + U.esc(f.url) + '">' + U.esc(f.title) + '</span>' +
            '<span class="u">' + U.esc(f.url) + '</span>' +
            '<button class="btn" data-act="unfav" data-i="' + i + '">Remove</button></div>';
        }).join('') || '<p class="muted">No favourites yet - click the star in the address bar.</p>';
        return { title: 'Favourites', favicon: 'star', html: '<div class="e-list"><h1>Favourites</h1>' + favs + '</div>' };
      }
      case 'downloads': {
        var dls = st.downloads.map(function (d) {
          return '<div class="e-row"><span>' + Icons.get('download') + '</span>' +
            '<span class="t">' + U.esc(d.name) + '</span>' +
            '<span class="u">' + U.esc(d.from) + '</span>' +
            '<span class="when">' + U.fmtAgo(d.ts) + '</span>' +
            '<button class="btn" data-act="show-dl" data-name="' + U.esc(d.name) + '">Show in folder</button></div>';
        }).join('') || '<p class="muted">No downloads yet.</p>';
        return { title: 'Downloads', favicon: 'download', html: '<div class="e-list"><h1>Downloads</h1>' + dls + '</div>' };
      }
      case 'settings': {
        var eng = Object.keys(ENGINES).map(function (k) {
          return '<option value="' + k + '"' + (st.searchEngine === k ? ' selected' : '') + '>' + ENGINES[k].name + '</option>';
        }).join('');
        return {
          title: 'Settings', favicon: 'gear',
          html: '<div class="e-list"><h1>Settings</h1></div>' +
            '<div class="e-set-group">' +
            '<div class="e-set"><div class="lbl"><b>On startup / Home button</b><small>Page opened by the home button and new windows</small></div>' +
              '<input class="ex-search" style="width:230px" data-act="homepage" value="' + U.esc(st.homepage) + '"></div>' +
            '<div class="e-set"><div class="lbl"><b>Search engine used in the address bar</b><small>Used when you choose to search the real web</small></div>' +
              '<select class="st-select" data-act="engine">' + eng + '</select></div>' +
            '<div class="e-set"><div class="lbl"><b>Load real websites in a frame</b><small>Sites that send X-Frame-Options will still refuse</small></div>' +
              '<div class="sw' + (st.allowEmbedding ? ' on' : '') + '" data-act="embed"></div></div>' +
            '<div class="e-set"><div class="lbl"><b>Clear browsing data</b><small>History, favourites and download list</small></div>' +
              '<button class="btn" data-act="clear-all">Clear</button></div>' +
            '<div class="e-set"><div class="lbl"><b>About Microsoft Edge (emulated)</b><small>Version 1.0.0 &middot; built with the Windows 11 Emulator</small></div>' +
              '<button class="btn" data-url="https://about.emu">Learn more</button></div>' +
            '</div>'
        };
      }
      case 'version': case 'about':
        return {
          title: 'About', favicon: 'info',
          html: '<div class="e-list"><h1>Microsoft Edge (emulated)</h1>' +
            '<div class="e-row"><span class="t">Version</span><span class="when">1.0.0 (emulator build)</span></div>' +
            '<div class="e-row"><span class="t">Engine</span><span class="when">' + U.esc(navigator.userAgent.slice(0, 90)) + '</span></div>' +
            '<div class="e-row"><span class="t">Simulated web</span><span class="when">' + INDEX.length + ' indexed pages</span></div></div>'
        };
      default:
        return { title: name, favicon: 'globe', html: '<div class="e-list"><h1>edge://' + U.esc(name) + '</h1>' +
          '<p class="muted">This internal page does not exist in the emulator.</p>' +
          '<p>' + link('edge://settings', 'Go to settings') + '</p></div>' };
    }
  }

  function newTabHtml() {
    var tiles = [
      { t: 'Bing', u: 'https://bing.local', i: 'search' },
      { t: 'Docs', u: 'https://docs.emu', i: 'doc' },
      { t: 'News', u: 'https://news.emu', i: 'globe' },
      { t: 'Weather', u: 'https://weather.emu', i: 'sun' },
      { t: 'Games', u: 'https://games.emu', i: 'game' },
      { t: 'About', u: 'https://about.emu', i: 'info' },
      { t: 'Example.com', u: 'https://example.com', i: 'globe' },
      { t: 'History', u: 'edge://history', i: 'history' }
    ].map(function (x) {
      return '<div class="ntp-tile" data-url="' + U.esc(x.u) + '">' + Icons.get(x.i) + '<span>' + U.esc(x.t) + '</span></div>';
    }).join('');

    return '<div class="ntp">' +
      '<div class="ntp-brand">' + Icons.get('edge') + '<span>Microsoft Edge</span></div>' +
      '<div class="ntp-search"><input data-ntp-q placeholder="Search the web" spellcheck="false">' +
      '<button data-ntp-go title="Search">' + Icons.get('search') + '</button></div>' +
      '<div class="ntp-tiles">' + tiles + '</div>' +
      '<div class="ntp-feed">' +
        '<div class="ntp-card"><span class="k">Tip</span><b>This browser has a small web of its own</b>' +
        'Pages ending in <code>.emu</code> are served from inside the emulator, so they always load. ' +
        'Real URLs are embedded in an iframe and many sites refuse that.</div>' +
        '<div class="ntp-card"><span class="k">Try</span><b>Ctrl+T, Ctrl+W, Ctrl+L, F5, Alt+Left</b>' +
        'The usual browser shortcuts work while an Edge window is focused.</div>' +
      '</div></div>';
  }

  // ------------------------------------------------------------ Edge window
  function launchEdge(args) {
    var win = WM.create({
      appId: 'edge', title: 'Microsoft Edge', icon: 'edge',
      width: 1080, height: 720, minWidth: 520, minHeight: 360,
      tabs: true, className: 'edge-win'
    });

    var st = Emu.state.edge;
    var tabs = [], active = null, suggestOpen = false, suggestIndex = -1;

    win.body.innerHTML =
      '<div class="edge">' +
        '<div class="edge-toolbar">' +
          '<button class="e-btn" data-nav="back" title="Back (Alt+Left)">' + Icons.get('back') + '</button>' +
          '<button class="e-btn" data-nav="fwd" title="Forward (Alt+Right)">' + Icons.get('forward') + '</button>' +
          '<button class="e-btn" data-nav="reload" title="Refresh (F5)">' + Icons.get('refresh') + '</button>' +
          '<button class="e-btn" data-nav="home" title="Home">' + Icons.get('home') + '</button>' +
          '<div class="e-omni">' +
            '<span class="lockico">' + Icons.get('lock') + '</span>' +
            '<input spellcheck="false" placeholder="Search or enter web address">' +
            '<button class="e-act" data-nav="fav" title="Add this page to favourites">' + Icons.get('star') + '</button>' +
          '</div>' +
          '<button class="e-btn" data-nav="favs" title="Favourites">' + Icons.get('star') + '</button>' +
          '<button class="e-btn" data-nav="collections" title="Collections">' + Icons.get('collections') + '</button>' +
          '<button class="e-btn" data-nav="profile" title="Profile">' + Icons.get('user') + '</button>' +
          '<button class="e-btn" data-nav="menu" title="Settings and more">' + Icons.get('more') + '</button>' +
        '</div>' +
        '<div class="edge-favbar"></div>' +
        '<div class="edge-progress"><i></i></div>' +
        '<div class="edge-content"></div>' +
      '</div>';

    var tabStrip = U.el('<div class="edge-tabs"></div>');
    var newTabBtn = U.el('<button class="etab-new" title="New tab (Ctrl+T)">' + Icons.get('plus') + '</button>');
    win.slot.appendChild(tabStrip);
    win.slot.appendChild(newTabBtn);

    var content = U.$('.edge-content', win.body);
    var omni = U.$('.e-omni input', win.body);
    var omniBox = U.$('.e-omni', win.body);
    var favbar = U.$('.edge-favbar', win.body);
    var progress = U.$('.edge-progress i', win.body);
    var lockIco = U.$('.lockico', win.body);
    var starBtn = U.$('[data-nav="fav"]', win.body);

    // ---- tabs ----
    function newTab(url, background) {
      var tab = {
        id: U.uid('tab'), url: url || st.homepage || NEWTAB, title: 'New tab', favicon: 'globe',
        history: [], hIndex: -1, loading: false, pane: document.createElement('div')
      };
      tab.pane.className = 'edge-pane hidden';
      tab.pane.style.cssText = 'position:absolute;inset:0';
      content.appendChild(tab.pane);
      tabs.push(tab);
      if (!background) setActive(tab);
      navigate(tab, tab.url, true);
      renderTabs();
      return tab;
    }

    function closeTab(tab) {
      var i = tabs.indexOf(tab);
      if (i < 0) return;
      tab.pane.remove();
      tabs.splice(i, 1);
      if (!tabs.length) { win.close(); return; }
      if (active === tab) setActive(tabs[Math.min(i, tabs.length - 1)]);
      renderTabs();
    }

    function setActive(tab) {
      active = tab;
      tabs.forEach(function (t) { t.pane.classList.toggle('hidden', t !== tab); });
      syncChrome();
      renderTabs();
    }

    function renderTabs() {
      tabStrip.innerHTML = '';
      tabs.forEach(function (t) {
        var el = U.el('<div class="etab' + (t === active ? ' active' : '') + (t.loading ? ' loading' : '') + '">' +
          '<span class="fav">' + Icons.get(t.loading ? 'refresh' : (t.favicon || 'globe')) + '</span>' +
          '<span class="ttl">' + U.esc(t.title) + '</span>' +
          '<span class="x" title="Close tab">' + Icons.get('x') + '</span></div>');
        el.title = t.title + '\n' + t.url;
        el.addEventListener('click', function (e) {
          if (e.target.closest('.x')) { closeTab(t); return; }
          setActive(t);
        });
        el.addEventListener('auxclick', function (e) { if (e.button === 1) closeTab(t); });
        tabStrip.appendChild(el);
      });
      win.setTitle((active ? active.title + ' - ' : '') + 'Microsoft Edge');
    }

    // ---- chrome sync ----
    function syncChrome() {
      if (!active) return;
      if (document.activeElement !== omni) omni.value = displayUrl(active.url);
      var p = parseUrl(active.url);
      lockIco.innerHTML = Icons.get(p.kind === 'internal' ? 'gear' : (p.kind === 'external' && !p.secure ? 'info' : 'lock'));
      U.$('[data-nav="back"]', win.body).classList.toggle('disabled', active.hIndex <= 0);
      U.$('[data-nav="fwd"]', win.body).classList.toggle('disabled', active.hIndex >= active.history.length - 1);
      starBtn.classList.toggle('on', isFav(active.url));
      starBtn.innerHTML = Icons.get('star');
      renderFavbar();
    }

    function displayUrl(u) { return u; }

    function renderFavbar() {
      favbar.innerHTML = st.favorites.map(function (f, i) {
        return '<div class="fav-item" data-fav="' + i + '" title="' + U.esc(f.url) + '">' +
          Icons.get(f.icon || 'globe') + '<span>' + U.esc(f.title) + '</span></div>';
      }).join('');
    }

    function isFav(url) {
      return st.favorites.some(function (f) { return f.url === url; });
    }

    // ---- navigation ----
    function navigate(tab, input, push) {
      var p = parseUrl(input);
      var url = p.kind === 'search' ? searchUrl(p.term) : p.url;
      if (p.kind === 'search') p = parseUrl(url);

      tab.url = url;
      tab.loading = true;
      renderTabs();
      if (tab === active) { syncChrome(); startProgress(); }

      if (push !== false) {
        tab.history = tab.history.slice(0, tab.hIndex + 1);
        if (tab.history[tab.history.length - 1] !== url) tab.history.push(url);
        tab.hIndex = tab.history.length - 1;
      }

      tab.pane.innerHTML = '';

      if (p.kind === 'internal') {
        var ip = internalPage(p.host, p, null);
        renderHtml(tab, ip.html, ip.title, ip.favicon);
        if (p.host === 'newtab') wireNewTab(tab);
        finish(tab);
        return;
      }

      if (p.kind === 'site' || SITES[p.host]) {
        var site = SITES[p.host];
        var out = site.render(p, null);
        renderHtml(tab, out.html, out.title || site.title, site.favicon);
        if (out.mount) out.mount(tab.pane);
        recordHistory(out.title || site.title, url);
        finish(tab);
        return;
      }

      // real, external URL
      if (!st.allowEmbedding) {
        renderError(tab, url, 'Embedding real sites is turned off in Edge settings.');
        finish(tab);
        return;
      }
      var frame = document.createElement('iframe');
      frame.className = 'edge-frame';
      frame.setAttribute('referrerpolicy', 'no-referrer');
      frame.src = url;
      var settled = false;
      frame.addEventListener('load', function () {
        settled = true;
        tab.title = p.host;
        tab.favicon = 'globe';
        finish(tab);
      });
      frame.addEventListener('error', function () {
        if (!settled) renderError(tab, url, 'The site did not respond.');
        finish(tab);
      });
      tab.pane.appendChild(frame);
      tab.title = p.host;
      tab.favicon = 'globe';
      recordHistory(p.host, url);
      showInfobar(tab, url);
      setTimeout(function () { if (!settled) finish(tab); }, 6000);
    }

    function renderHtml(tab, html, title, favicon) {
      var page = document.createElement('div');
      page.className = 'edge-page';
      page.innerHTML = html;
      tab.pane.appendChild(page);
      tab.title = title || 'Page';
      tab.favicon = favicon || 'globe';
      page.addEventListener('click', function (e) { onPageClick(e, tab); });
      page.addEventListener('change', function (e) { onPageChange(e, tab); });
    }

    function renderError(tab, url, reason) {
      tab.pane.innerHTML = '';
      var host;
      try { host = new URL(url).hostname; } catch (e) { host = url; }
      var page = document.createElement('div');
      page.className = 'edge-page';
      page.innerHTML =
        '<div class="err-page"><div class="face">:(</div>' +
        '<h2>This page can&rsquo;t be shown here</h2>' +
        '<p>' + U.esc(reason || (host + ' refuses to be displayed inside another page.')) +
        ' That is the site&rsquo;s own security header, not something the emulator can change.</p>' +
        '<code>' + U.esc(url) + '</code>' +
        '<div class="err-actions">' +
        '<button class="btn primary" data-act="open-external" data-url="' + U.esc(url) + '">Open in system browser</button>' +
        '<button class="btn" data-act="retry" data-url="' + U.esc(url) + '">Try again</button>' +
        '<button class="btn" data-url="' + U.esc(searchUrl(host)) + '">Search instead</button>' +
        '</div></div>';
      tab.pane.appendChild(page);
      tab.title = 'Can’t reach this page';
      tab.favicon = 'warning';
      page.addEventListener('click', function (e) { onPageClick(e, tab); });
    }

    function showInfobar(tab, url) {
      var bar = U.el('<div class="edge-infobar">' + Icons.get('info') +
        '<span class="sp">Loading a real site inside the emulator. If it stays blank, the site blocks embedding.</span>' +
        '<button data-act="open-external" data-url="' + U.esc(url) + '">Open in system browser</button>' +
        '<button data-act="dismiss-bar">Dismiss</button></div>');
      var frame = tab.pane.querySelector('iframe');
      bar.addEventListener('click', function (e) {
        if (e.target.closest('[data-act="dismiss-bar"]')) {
          bar.remove();
          if (frame) { frame.style.top = '0'; frame.style.height = '100%'; }
        } else onPageClick(e, tab);
      });
      tab.pane.appendChild(bar);
      bar.style.cssText = 'position:absolute;left:0;right:0;top:0;z-index:5';
      // Push the page down so the bar never covers the site's own header.
      if (frame) {
        var h = bar.offsetHeight;
        frame.style.top = h + 'px';
        frame.style.height = 'calc(100% - ' + h + 'px)';
      }
    }

    function finish(tab) {
      tab.loading = false;
      renderTabs();
      if (tab === active) { syncChrome(); endProgress(); }
    }

    function recordHistory(title, url) {
      if (/^edge:\/\//.test(url)) return;
      st.history = st.history.filter(function (h) { return h.url !== url; });
      st.history.unshift({ title: title, url: url, ts: Date.now() });
      if (st.history.length > 200) st.history.length = 200;
      Emu.save();
    }

    function startProgress() {
      progress.style.transition = 'none';
      progress.style.width = '0%';
      setTimeout(function () {
        progress.style.transition = '';
        progress.style.width = '72%';
      }, 10);
    }
    function endProgress() {
      progress.style.width = '100%';
      setTimeout(function () {
        progress.style.transition = 'opacity .2s';
        progress.style.width = '0%';
      }, 220);
    }

    // ---- page interactions ----
    function onPageClick(e, tab) {
      var real = e.target.closest('[data-real]');
      if (real) { openExternal(real.dataset.real); return; }

      var act = e.target.closest('[data-act]');
      if (act) {
        var a = act.dataset.act;
        if (a === 'open-external') { openExternal(act.dataset.url); return; }
        if (a === 'retry') { navigate(tab, act.dataset.url, false); return; }
        if (a === 'clear-history') { st.history = []; Emu.save(); navigate(tab, tab.url, false); return; }
        if (a === 'clear-all') {
          st.history = []; st.downloads = []; Emu.save();
          Emu.notify('Microsoft Edge', 'Browsing data cleared.', 'edge');
          navigate(tab, tab.url, false); return;
        }
        if (a === 'unfav') { st.favorites.splice(+act.dataset.i, 1); Emu.save(); navigate(tab, tab.url, false); syncChrome(); return; }
        if (a === 'embed') { st.allowEmbedding = !st.allowEmbedding; Emu.save(); navigate(tab, tab.url, false); return; }
        if (a === 'show-dl') { Emu.launch('explorer', { path: VFS.HOME + '\\Downloads' }); return; }
        if (a === 'download') { doDownload(act.dataset.name || 'download.txt', tab.url); return; }
      }

      var l = e.target.closest('[data-url]');
      if (l) { navigate(tab, l.dataset.url, true); return; }
    }

    function onPageChange(e, tab) {
      var t = e.target;
      if (t.dataset.act === 'engine') { st.searchEngine = t.value; Emu.save(); }
      if (t.dataset.act === 'homepage') { st.homepage = t.value.trim() || NEWTAB; Emu.save(); }
    }

    function wireNewTab(tab) {
      var input = tab.pane.querySelector('[data-ntp-q]');
      var btn = tab.pane.querySelector('[data-ntp-go]');
      if (!input) return;
      function go() {
        var v = input.value.trim();
        if (v) navigate(tab, v, true);
      }
      input.addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); });
      if (btn) btn.addEventListener('click', go);
      setTimeout(function () { if (win === WM.focused) input.focus(); }, 60);
    }

    function doDownload(name, from) {
      var body = 'Windows 11 Emulator - keyboard shortcuts\r\n\r\n' +
        'Win\t\t\tStart menu\r\nWin+D\t\tShow desktop\r\nWin+E\t\tFile Explorer\r\n' +
        'Win+S\t\tSearch\r\nWin+Tab\t\tTask View\r\nWin+A\t\tQuick Settings\r\n' +
        'Win+N\t\tNotifications\r\nWin+W\t\tWidgets\r\nWin+Arrows\tSnap windows\r\n' +
        'Alt+Tab\t\tSwitch windows\r\nCtrl+T / Ctrl+W\tNew / close tab\r\nCtrl+L\t\tAddress bar\r\n';
      var dir = VFS.HOME + '\\Downloads';
      var target = dir + '\\' + VFS.uniqueName(dir, name.replace(/\.txt$/, ''), '.txt');
      VFS.write(target, body, 'txt');
      st.downloads.unshift({ name: VFS.nameOf(target), from: from, ts: Date.now(), path: target });
      Emu.save();
      Emu.notify('Download complete', VFS.nameOf(target) + ' saved to Downloads.', 'download');
    }

    function openExternal(url) {
      var w = window.open(url, '_blank', 'noopener');
      if (!w) Emu.notify('Microsoft Edge', 'Your browser blocked the pop-up. Allow pop-ups to open real sites.', 'warning');
    }

    // ---- omnibox ----
    var suggestEl = null;
    function closeSuggest() {
      if (suggestEl) { suggestEl.remove(); suggestEl = null; }
      suggestOpen = false; suggestIndex = -1;
    }

    function buildSuggestions(q) {
      var out = [], seen = {};
      q = q.trim().toLowerCase();
      if (q) out.push({ icon: 'search', text: q, sub: 'Search with Bing (emulator)', url: searchUrl(q) });
      function add(title, url, icon, sub) {
        if (seen[url] || out.length > 8) return;
        seen[url] = 1;
        out.push({ icon: icon, text: title, sub: sub || url, url: url });
      }
      INDEX.forEach(function (s) {
        if (!q || (s.title + ' ' + s.url + ' ' + s.kw).toLowerCase().indexOf(q) >= 0) add(s.title, s.url, 'globe');
      });
      st.history.forEach(function (h) {
        if (!q || (h.title + ' ' + h.url).toLowerCase().indexOf(q) >= 0) add(h.title || h.url, h.url, 'history');
      });
      ['newtab', 'history', 'favorites', 'downloads', 'settings'].forEach(function (p) {
        if (q && ('edge://' + p).indexOf(q) >= 0) add('edge://' + p, 'edge://' + p, 'gear', 'Edge page');
      });
      return out.slice(0, 8);
    }

    function showSuggest() {
      closeSuggest();
      var items = buildSuggestions(omni.value);
      if (!items.length) return;
      suggestEl = U.el('<div class="e-suggest"></div>');
      items.forEach(function (it, i) {
        var row = U.el('<div class="e-sug" data-i="' + i + '">' + Icons.get(it.icon) +
          '<span>' + U.esc(it.text) + '</span><small>' + U.esc(it.sub) + '</small></div>');
        row.addEventListener('mousedown', function (e) {
          e.preventDefault();
          navigate(active, it.url, true);
          omni.blur();
          closeSuggest();
        });
        suggestEl.appendChild(row);
      });
      suggestEl.dataset.items = JSON.stringify(items.map(function (i) { return i.url; }));
      omniBox.appendChild(suggestEl);
      suggestOpen = true;
    }

    omni.addEventListener('focus', function () { omni.select(); showSuggest(); });
    omni.addEventListener('input', showSuggest);
    omni.addEventListener('blur', function () { setTimeout(closeSuggest, 120); syncChrome(); });
    omni.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        var urls = suggestEl ? JSON.parse(suggestEl.dataset.items) : null;
        var target = (suggestIndex >= 0 && urls) ? urls[suggestIndex] : omni.value;
        closeSuggest();
        navigate(active, target, true);
        omni.blur();
        return;
      }
      if (e.key === 'Escape') { closeSuggest(); omni.value = active.url; omni.blur(); return; }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (!suggestEl) return;
        e.preventDefault();
        var rows = U.$$('.e-sug', suggestEl);
        suggestIndex = U.clamp(suggestIndex + (e.key === 'ArrowDown' ? 1 : -1), 0, rows.length - 1);
        rows.forEach(function (r, i) { r.classList.toggle('sel', i === suggestIndex); });
      }
    });

    // ---- toolbar ----
    win.body.addEventListener('click', function (e) {
      var b = e.target.closest('[data-nav]');
      if (!b) {
        var fav = e.target.closest('[data-fav]');
        if (fav) navigate(active, st.favorites[+fav.dataset.fav].url, true);
        return;
      }
      var kind = b.dataset.nav;
      if (kind === 'back' && active.hIndex > 0) { active.hIndex--; navigate(active, active.history[active.hIndex], false); }
      else if (kind === 'fwd' && active.hIndex < active.history.length - 1) { active.hIndex++; navigate(active, active.history[active.hIndex], false); }
      else if (kind === 'reload') navigate(active, active.url, false);
      else if (kind === 'home') navigate(active, st.homepage || NEWTAB, true);
      else if (kind === 'favs') navigate(active, 'edge://favorites', true);
      else if (kind === 'collections') Emu.notify('Collections', 'Collections are not part of this emulator (yet).', 'collections');
      else if (kind === 'profile') Emu.notify('Profile', 'Signed in as ' + Emu.state.user + ' (local profile).', 'user');
      else if (kind === 'fav') toggleFav();
      else if (kind === 'menu') openMenu(b);
    });

    function toggleFav() {
      if (isFav(active.url)) {
        st.favorites = st.favorites.filter(function (f) { return f.url !== active.url; });
      } else {
        st.favorites.push({ title: active.title, url: active.url, icon: active.favicon });
        Emu.notify('Microsoft Edge', 'Added "' + active.title + '" to favourites.', 'star');
      }
      Emu.save();
      syncChrome();
    }

    newTabBtn.addEventListener('click', function () { newTab(NEWTAB); });

    // ---- ... menu ----
    function openMenu(anchor) {
      var items = [
        ['New tab', 'plus', function () { newTab(NEWTAB); }],
        ['New window', 'globe', function () { Emu.launch('edge'); }],
        ['sep'],
        ['Favourites', 'star', function () { navigate(active, 'edge://favorites', true); }],
        ['History', 'history', function () { navigate(active, 'edge://history', true); }],
        ['Downloads', 'download', function () { navigate(active, 'edge://downloads', true); }],
        ['sep'],
        ['Print', 'print', function () { Emu.notify('Microsoft Edge', 'Printing is not available in the emulator.', 'print'); }],
        ['Open in system browser', 'upload', function () {
          if (/^edge:\/\//.test(active.url) || /\.emu|bing\.local/.test(active.url)) {
            Emu.notify('Microsoft Edge', 'That page only exists inside the emulator.', 'info');
          } else openExternal(active.url);
        }],
        ['sep'],
        ['Settings', 'gear', function () { navigate(active, 'edge://settings', true); }],
        ['About', 'info', function () { navigate(active, 'edge://version', true); }]
      ];
      global.Shell.contextMenu(items.map(function (it) {
        return it[0] === 'sep' ? { sep: true } : { label: it[0], icon: it[1], action: it[2] };
      }), anchor.getBoundingClientRect().right - 240, anchor.getBoundingClientRect().bottom + 4);
    }

    // ---- keyboard ----
    function onKey(e) {
      if (WM.focused !== win) return;
      var ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key.toLowerCase() === 't') { e.preventDefault(); newTab(NEWTAB); }
      else if (ctrl && e.key.toLowerCase() === 'w') { e.preventDefault(); closeTab(active); }
      else if (ctrl && e.key.toLowerCase() === 'l') { e.preventDefault(); omni.focus(); }
      else if (e.key === 'F5' || (ctrl && e.key.toLowerCase() === 'r')) { e.preventDefault(); navigate(active, active.url, false); }
      else if (e.altKey && e.key === 'ArrowLeft' && active.hIndex > 0) { active.hIndex--; navigate(active, active.history[active.hIndex], false); }
      else if (e.altKey && e.key === 'ArrowRight' && active.hIndex < active.history.length - 1) { active.hIndex++; navigate(active, active.history[active.hIndex], false); }
    }
    document.addEventListener('keydown', onKey);
    win.onClose = function () { document.removeEventListener('keydown', onKey); };

    // ---- start ----
    renderFavbar();
    newTab(args && args.url ? args.url : (st.homepage || NEWTAB));

    win.data.edge = {
      openUrl: function (u) { newTab(u); win.focus(); },
      navigate: function (u) { navigate(active, u, true); win.focus(); }
    };
    return win;
  }

  Emu.registerApp({
    id: 'edge',
    name: 'Microsoft Edge',
    icon: 'edge',
    pinned: true,
    desc: 'Web browser',
    launch: launchEdge,
    /** Reuse an existing window when a URL is opened from elsewhere. */
    open: function (url) {
      var existing = WM.byApp('edge')[0];
      if (existing && existing.data.edge) { existing.data.edge.openUrl(url); return existing; }
      return launchEdge({ url: url });
    }
  });

  Emu.EdgeIndex = INDEX;
})(window);
