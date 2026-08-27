/* ===== Microsoft Edge =====
   A browser that renders pages itself: it fetches the document over the
   emulator's network stack, sanitises and rewrites it, then paints it into
   a shadow root. Tabs, history, favourites, downloads, find-in-page, zoom,
   reader mode and a real web search all sit on top of that.              */
(function (global) {
  'use strict';

  var Emu = global.Emu, U = Emu.util, Icons = global.Icons, WM = global.WM, VFS = global.VFS, Net = global.Net;

  var NEWTAB = 'edge://newtab';

  var INDEX = [
    { url: 'https://bing.local', title: 'Bing', desc: 'Search the real web from inside the emulator.', kw: 'search bing engine web' },
    { url: 'https://docs.emu', title: 'Orion - Documentation', desc: 'Every feature, keyboard shortcut and app in this emulator.', kw: 'docs help shortcuts keyboard manual guide windows' },
    { url: 'https://news.emu', title: 'Orion News - Today', desc: 'Headlines from the simulated web.', kw: 'news headlines today feed' },
    { url: 'https://weather.emu', title: 'Weather - Orion Forecast', desc: 'Seven day forecast.', kw: 'weather forecast rain temperature' },
    { url: 'https://about.emu', title: 'About this emulator', desc: 'What is real, what is simulated.', kw: 'about credits built how source' },
    { url: 'https://en.wikipedia.org/wiki/Windows_11', title: 'Windows 11 - Wikipedia', desc: 'A real page, fetched and rendered by the emulator itself.', kw: 'wikipedia windows real' },
    { url: 'https://news.ycombinator.com', title: 'Hacker News', desc: 'A real site that renders well in the engine.', kw: 'hacker news tech real' },
    { url: 'https://example.com', title: 'Example Domain', desc: 'The smallest real page on the internet.', kw: 'example real internet live' }
  ];

  // ------------------------------------------------------------ URL parse
  function parseUrl(input) {
    var s = String(input || '').trim();
    if (!s) return { kind: 'internal', url: NEWTAB, host: 'newtab', path: '/', query: {} };

    if (/^edge:\/\//i.test(s)) {
      var page = s.replace(/^edge:\/\//i, '').split(/[?#]/)[0].replace(/\/+$/, '') || 'newtab';
      return { kind: 'internal', url: 'edge://' + page, host: page, path: '/', query: qs(s) };
    }
    if (/^view-source:/i.test(s)) {
      return { kind: 'source', url: s, target: s.replace(/^view-source:/i, '') };
    }
    var hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(s);
    var looksLikeHost = /^[\w-]+(\.[\w-]+)+(\/|$|\?|#|:)/.test(s) || /^localhost(:|\/|$)/.test(s);
    if (!hasScheme && !looksLikeHost) return { kind: 'search', url: s, term: s };

    var full = hasScheme ? s : 'https://' + s;
    var a = document.createElement('a');
    a.href = full;
    var host = a.hostname.replace(/^www\./, '');
    return {
      kind: SITES[host] ? 'site' : 'external',
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
  function pageShell(inner) { return '<div class="pg">' + inner + '</div>'; }
  function link(url, text) { return '<span class="lnk" data-url="' + U.esc(url) + '">' + U.esc(text) + '</span>'; }

  // ------------------------------------------------------- simulated web
  var SITES = {
    'bing.local': {
      title: 'Bing', favicon: 'search',
      render: function (p) {
        var q = p.query.q || '';
        if (!q) {
          return {
            title: 'Bing',
            html: pageShell(
              '<div style="text-align:center;padding:40px 0 10px"><h1 style="font-size:44px;margin:0">Bing</h1>' +
              '<p class="muted">Real results, fetched by the emulator</p></div>' +
              '<div class="card"><b>Try</b><ul>' +
              '<li>' + link(searchUrl('windows 11'), 'windows 11') + '</li>' +
              '<li>' + link(searchUrl('how do browsers render pages'), 'how do browsers render pages') + '</li>' +
              '<li>' + link(searchUrl('minesweeper strategy'), 'minesweeper strategy') + '</li></ul></div>')
          };
        }
        return {
          title: q + ' - Search',
          html: pageShell(
            '<h1 style="font-size:22px;margin-bottom:2px">' + U.esc(q) + '</h1>' +
            '<p class="muted" style="font-size:12.5px">Searching the real web…</p>' +
            '<div data-searchresults><div class="srp-skel"><i></i><i></i><i></i><i></i></div></div>'),
          mount: function (pane) { runSearch(pane, q); }
        };
      }
    },

    'docs.emu': {
      title: 'Documentation', favicon: 'doc',
      render: function () {
        return {
          title: 'Orion - Docs',
          html: pageShell(
            '<div class="hero"><h1>Orion</h1><p>A desktop environment, a window manager and a ' +
            'browser that renders real pages itself - all of it HTML, CSS and JavaScript.</p></div>' +
            '<h2>How the browser works</h2>' +
            '<p>Edge here is not an iframe wrapper. When you open a page it fetches the document over the ' +
            'emulator\'s own network stack, strips scripts and frames, rewrites every URL, and paints the ' +
            'result into a shadow root with its own history, tabs and cache. Turn on <b>Orion VPN</b> to route ' +
            'that fetching through a relay so more sites load.</p>' +
            '<div class="kv">' +
            '<b>Engine</b><span>Fetch, sanitise, rewrite, render. Default.</span>' +
            '<b>Reader</b><span>Text-only version of the page. Fastest, always works.</span>' +
            '<b>App</b><span>Runs the real site in a frame. Default, and what games need.</span>' +
            '</div>' +
            '<h2>Keyboard shortcuts</h2>' +
            '<div class="kv">' +
            '<b>Win</b><span>Open or close Start</span>' +
            '<b>Win + D / E / S</b><span>Desktop / Explorer / Search</span>' +
            '<b>Win + Tab</b><span>Task View</span>' +
            '<b>Win + arrows</b><span>Snap, maximise, minimise</span>' +
            '<b>Alt + Tab</b><span>Switch windows</span>' +
            '<b>Ctrl + T / W / L</b><span>New tab, close tab, address bar</span>' +
            '<b>Ctrl + F</b><span>Find on page</span>' +
            '<b>Ctrl + + / -</b><span>Zoom the page</span>' +
            '<b>F5 / Alt + arrows</b><span>Reload, back, forward</span>' +
            '</div>' +
            '<p><button class="btn" data-act="download" data-name="Shortcuts.txt">Download the shortcut list</button></p>' +
            '<h2>Apps</h2><ul>' +
            '<li><b>Microsoft Edge</b> - the browser described above.</li>' +
            '<li><b>Orion VPN</b> - relay tunnel that decides how pages are fetched.</li>' +
            '<li><b>Orion Store</b> - installs six real games that persist across reloads.</li>' +
            '<li><b>File Explorer, Notepad, Settings, Calculator, Terminal, Photos, Task Manager</b>.</li></ul>')
        };
      }
    },

    'news.emu': {
      title: 'Orion News', favicon: 'globe',
      render: function () {
        var stories = [
          ['Technology', 'Browser-based desktop hits 60 fps on a laptop from 2016', 'Turns out most of an operating system UI is rectangles with rounded corners.'],
          ['Science', 'Local storage found to contain four years of unfinished to-do lists', 'Researchers describe the discovery as "relatable".'],
          ['Business', 'Startup raises seed round to put a taskbar on everything', 'The taskbar will be centred, obviously.'],
          ['Sport', 'Minesweeper record broken on a simulated machine', 'Officials are reviewing whether the flag counter counts.']
        ];
        var html = '<h1>Orion News</h1><p class="muted">' + new Date().toDateString() + ' &middot; fictional headlines</p>';
        stories.forEach(function (s) {
          html += '<div class="card"><div class="muted" style="font-size:11.5px;text-transform:uppercase;letter-spacing:.5px">' +
            U.esc(s[0]) + '</div><b style="font-size:16px">' + U.esc(s[1]) + '</b><p>' + U.esc(s[2]) + '</p></div>';
        });
        html += '<p>For real news the engine can render, try ' +
          link('https://news.ycombinator.com', 'Hacker News') + '.</p>';
        return { title: 'Orion News - Today', html: pageShell(html) };
      }
    },

    'weather.emu': {
      title: 'Weather', favicon: 'sun',
      render: function () {
        var days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        var now = new Date().getDay();
        var html = '<h1>Orion Forecast</h1><div class="card" style="display:flex;align-items:center;gap:24px">' +
          '<div style="font-size:54px;font-weight:600">21&deg;</div><div><b>Partly cloudy</b>' +
          '<div class="muted">Feels like 20&deg; &middot; Humidity 48% &middot; Wind 11 km/h</div></div></div><div class="card">';
        for (var i = 0; i < 7; i++) {
          html += '<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid rgba(128,128,128,.2)">' +
            '<span>' + days[(now + i) % 7] + (i === 0 ? ' (today)' : '') + '</span><span>' +
            (18 + ((i * 3) % 7)) + '&deg; / ' + (9 + i % 4) + '&deg;</span></div>';
        }
        return { title: 'Weather - Orion Forecast', html: pageShell(html + '</div>') };
      }
    },

    'about.emu': {
      title: 'About', favicon: 'info',
      render: function () {
        return {
          title: 'About this emulator',
          html: pageShell(
            '<h1>About this emulator</h1>' +
            '<p>A Windows 11 <em>simulation</em> written in plain HTML/CSS/JS. No Microsoft code, nothing virtualised.</p>' +
            '<h2>What is genuinely real</h2><div class="card"><ul>' +
            '<li>The browser engine: pages are fetched, parsed, sanitised and rendered by this app</li>' +
            '<li>Web search: results come from live search APIs</li>' +
            '<li>The window manager, file system, and installed games</li></ul></div>' +
            '<h2>What is simulated</h2><div class="card"><ul>' +
            '<li>Sites ending in <code>.emu</code> and <code>bing.local</code></li>' +
            '<li>The VPN\'s location names, protocol and encryption - it is a relay, not a tunnel</li>' +
            '<li>Wi-Fi, Bluetooth, battery and Task Manager figures</li></ul></div>' +
            '<h2>Why some pages still look plain</h2>' +
            '<p>Scripts are never executed - that is what keeps rendering someone else\'s page safe. Sites that ' +
            'build themselves entirely in JavaScript therefore arrive nearly empty. Static and server-rendered ' +
            'pages come through properly.</p>')
        };
      }
    }
  };

  // -------------------------------------------------------- search render
  function runSearch(pane, q) {
    var host = pane.querySelector('[data-searchresults]');
    if (!host) return;
    Net.search(q).then(function (r) {
      var html = '';
      if (r.answer) {
        html += '<div class="card srp-answer"><b>' + U.esc(r.answer.source) + '</b>' +
          '<p>' + U.esc(r.answer.text) + '</p>' +
          (r.answer.url ? '<span class="lnk" data-url="' + U.esc(r.answer.url) + '">' + U.esc(r.answer.url) + '</span>' : '') +
          '</div>';
      }
      if (r.results.length) {
        html += '<div class="srp">' + r.results.map(function (x) {
          return '<div class="res"><b class="lnk" data-url="' + U.esc(x.url) + '">' + U.esc(x.title) + '</b>' +
            '<div class="u">' + U.esc(x.host || x.url) + '</div>' +
            (x.desc ? '<p>' + U.esc(x.desc) + '</p>' : '') + '</div>';
        }).join('') + '</div>';
      }
      if (r.wiki.length) {
        html += '<h2>From Wikipedia</h2><div class="srp">' + r.wiki.map(function (x) {
          return '<div class="res"><b class="lnk" data-url="' + U.esc(x.url) + '">' + U.esc(x.title) + '</b>' +
            '<p>' + U.esc(x.desc) + '…</p></div>';
        }).join('') + '</div>';
      }
      if (r.related.length) {
        html += '<h2>Related</h2><ul>' + r.related.map(function (x) {
          return '<li>' + link(x.url, x.title) + '</li>';
        }).join('') + '</ul>';
      }
      if (!r.results.length && !r.wiki.length && !r.answer) {
        html = '<div class="card"><b>No results came back.</b>' +
          '<p>The search relay may be rate limiting. Turning on <b>Orion VPN</b> often helps, or try again in a moment.</p>' +
          (r.errors.length ? '<p class="muted">Providers that failed: ' + U.esc(r.errors.join(', ')) + '</p>' : '') +
          '</div>';
      } else if (r.errors.length) {
        html += '<p class="muted" style="font-size:12px">Some providers did not respond: ' +
          U.esc(r.errors.join(', ')) + '</p>';
      }
      host.innerHTML = html;
      var sub = pane.querySelector('.muted');
      if (sub) {
        sub.textContent = (r.results.length + r.wiki.length) + ' results' +
          (r.answer ? ' + instant answer' : '');
      }
    }).catch(function (e) {
      host.innerHTML = '<div class="card"><b>Search failed.</b><p>' + U.esc(e.message) + '</p></div>';
    });
  }

  // -------------------------------------------------------- internal pages
  function internalPage(name, p) {
    var st = Emu.state.edge;
    switch (name) {
      case 'newtab': return { title: 'New tab', favicon: 'globe', html: newTabHtml() };
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
            '<button class="btn" data-act="show-dl">Show in folder</button></div>';
        }).join('') || '<p class="muted">No downloads yet.</p>';
        return { title: 'Downloads', favicon: 'download', html: '<div class="e-list"><h1>Downloads</h1>' + dls + '</div>' };
      }
      case 'net': {
        var s = Emu.state.net, r = Net.relay(), st2 = Net.stats;
        return {
          title: 'Network internals', favicon: 'network',
          html: '<div class="e-list"><h1>edge://net</h1>' +
            '<div class="e-row"><span class="t">Tunnel</span><span class="when">' +
              (s.connected ? 'connected via ' + U.esc(r.host) : 'direct (no relay)') + '</span></div>' +
            '<div class="e-row"><span class="t">Fetch strategy</span><span class="when">' +
              (s.connected ? 'relay → fallback relay' : 'direct → relay fallback') + '</span></div>' +
            '<div class="e-row"><span class="t">Exit address (simulated)</span><span class="when">' + U.esc(Net.exitIp()) + '</span></div>' +
            '<div class="e-row"><span class="t">Last probe</span><span class="when">' + U.esc(s.lastProbe || '—') + '</span></div>' +
            '<div class="e-row"><span class="t">Requests</span><span class="when">' + st2.requests + '</span></div>' +
            '<div class="e-row"><span class="t">Transferred</span><span class="when">' + U.fmtBytes(st2.bytes) + '</span></div>' +
            '<div class="e-row"><span class="t">Scripts &amp; frames blocked</span><span class="when">' + st2.blocked + '</span></div>' +
            '<div class="e-row"><span class="t">Failed fetches</span><span class="when">' + st2.errors + '</span></div>' +
            '<div class="e-row"><span class="t">Cached pages</span><span class="when">' + Net.cacheSize() + '</span></div>' +
            '<div class="e-row"><span class="t">Orion build</span><span class="when">' + U.esc(Emu.BUILD) + '</span></div>' +
            '<p><button class="btn" data-act="clear-cache">Clear cache</button> ' +
            '<button class="btn" data-act="open-vpn">Open Orion VPN</button></p></div>'
        };
      }
      case 'settings': {
        return {
          title: 'Settings', favicon: 'gear',
          html: '<div class="e-list"><h1>Settings</h1></div><div class="e-set-group">' +
            '<div class="e-set"><div class="lbl"><b>Home page</b><small>Opened by the home button and new windows</small></div>' +
              '<input class="ex-search" style="width:230px" data-act="homepage" value="' + U.esc(st.homepage) + '"></div>' +
            '<div class="e-set"><div class="lbl"><b>How pages are rendered</b>' +
              '<small>Real sites always run for real. Engine and Reader are per-page views in the ' +
              '&hellip; menu, and reset when you move on.</small></div>' +
              '<span class="muted">App</span></div>' +
            '<div class="e-set"><div class="lbl"><b>Load images</b><small>Routed through the relay</small></div>' +
              '<div class="sw' + (st.images ? ' on' : '') + '" data-act="images"></div></div>' +
            '<div class="e-set"><div class="lbl"><b>Load the page\'s own stylesheets</b>' +
              '<small>Closer to the real layout, a little slower</small></div>' +
              '<div class="sw' + (st.styles ? ' on' : '') + '" data-act="styles"></div></div>' +
            '<div class="e-set"><div class="lbl"><b>Clear browsing data</b><small>History and download list</small></div>' +
              '<button class="btn" data-act="clear-all">Clear</button></div>' +
            '<div class="e-set"><div class="lbl"><b>About</b><small>Emulated Edge 2.0 &middot; own rendering engine</small></div>' +
              '<button class="btn" data-url="https://about.emu">Learn more</button></div></div>'
        };
      }
      case 'version': case 'about':
        return {
          title: 'About', favicon: 'info',
          html: '<div class="e-list"><h1>Microsoft Edge (emulated)</h1>' +
            '<div class="e-row"><span class="t">Version</span><span class="when">2.0.0 (own engine)</span></div>' +
            '<div class="e-row"><span class="t">Rendering</span><span class="when">fetch → sanitise → rewrite → shadow DOM</span></div>' +
            '<div class="e-row"><span class="t">Scripting</span><span class="when">disabled on remote pages, by design</span></div>' +
            '<div class="e-row"><span class="t">Host browser</span><span class="when">' + U.esc(navigator.userAgent.slice(0, 80)) + '</span></div></div>'
        };
      default:
        return { title: name, favicon: 'globe', html: '<div class="e-list"><h1>edge://' + U.esc(name) + '</h1>' +
          '<p class="muted">No such internal page. Try ' + link('edge://net', 'edge://net') + ' or ' +
          link('edge://settings', 'edge://settings') + '.</p></div>' };
    }
  }

  function newTabHtml() {
    var tiles = [
      { t: 'Search', u: 'https://bing.local', i: 'search' },
      { t: 'Docs', u: 'https://docs.emu', i: 'doc' },
      { t: 'Wikipedia', u: 'https://en.wikipedia.org/wiki/Windows_11', i: 'globe' },
      { t: 'Hacker News', u: 'https://news.ycombinator.com', i: 'globe' },
      { t: 'News', u: 'https://news.emu', i: 'globe' },
      { t: 'Weather', u: 'https://weather.emu', i: 'sun' },
      { t: 'Network', u: 'edge://net', i: 'network' },
      { t: 'History', u: 'edge://history', i: 'history' }
    ].map(function (x) {
      return '<div class="ntp-tile" data-url="' + U.esc(x.u) + '">' + Icons.get(x.i) + '<span>' + U.esc(x.t) + '</span></div>';
    }).join('');

    var vpn = Emu.state.net.connected;
    return '<div class="ntp">' +
      '<div class="ntp-brand">' + Icons.get('edge') + '<span>Microsoft Edge</span></div>' +
      '<div class="ntp-search"><input data-ntp-q placeholder="Search the web" spellcheck="false">' +
      '<button data-ntp-go title="Search">' + Icons.get('search') + '</button></div>' +
      '<div class="ntp-tiles">' + tiles + '</div>' +
      '<div class="ntp-feed">' +
        '<div class="ntp-card"><span class="k">Engine</span><b>This browser renders pages itself</b>' +
        'Documents are fetched, stripped of scripts and frames, rewritten and painted here - no iframe. ' +
        'Search results come from live APIs.</div>' +
        '<div class="ntp-card"><span class="k">Tunnel</span><b>' +
        (vpn ? 'Orion VPN is connected' : 'Orion VPN is off') + '</b>' +
        (vpn ? 'Pages are being fetched through the relay, so more sites load.'
             : 'Sites that block cross-origin reads may fail. Open Orion VPN to route through a relay.') +
        '</div></div></div>';
  }

  // --------------------------------------------------------- Edge window
  function launchEdge(args) {
    var win = WM.create({
      appId: 'edge', title: 'Microsoft Edge', icon: 'edge',
      width: 1120, height: 740, minWidth: 520, minHeight: 380,
      tabs: true, className: 'edge-win'
    });

    var st = Emu.state.edge;
    var tabs = [], active = null, suggestIndex = -1, suggestEl = null;

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
            '<button class="e-act" data-nav="fav" title="Add to favourites">' + Icons.get('star') + '</button>' +
          '</div>' +
          '<button class="e-mode" data-nav="mode" title="How this page is being shown - click for App mode">App</button>' +
          '<button class="e-btn" data-nav="find" title="Find on page (Ctrl+F)">' + Icons.get('find') + '</button>' +
          '<button class="e-btn" data-nav="reader" title="Reader mode">' + Icons.get('reader') + '</button>' +
          '<button class="e-btn" data-nav="vpn" title="Tunnel status">' + Icons.get('shield') + '</button>' +
          '<button class="e-btn" data-nav="favs" title="Favourites">' + Icons.get('star') + '</button>' +
          '<button class="e-btn" data-nav="menu" title="Settings and more">' + Icons.get('more') + '</button>' +
        '</div>' +
        '<div class="edge-favbar"></div>' +
        '<div class="edge-findbar hidden">' +
          '<input placeholder="Find on page" spellcheck="false">' +
          '<span class="fb-count">0/0</span>' +
          '<button class="e-btn" data-find="prev">' + Icons.get('chevronUp') + '</button>' +
          '<button class="e-btn" data-find="next">' + Icons.get('chevronDown') + '</button>' +
          '<button class="e-btn" data-find="close">' + Icons.get('x') + '</button>' +
        '</div>' +
        '<div class="edge-progress"><i></i></div>' +
        '<div class="edge-content"></div>' +
        '<div class="edge-status hidden"></div>' +
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
    var findBar = U.$('.edge-findbar', win.body);
    var findInput = U.$('.edge-findbar input', win.body);
    var statusEl = U.$('.edge-status', win.body);

    // ------------------------------------------------------------- tabs
    function newTab(url, background) {
      var tab = {
        id: U.uid('tab'), url: url || st.homepage || NEWTAB, title: 'New tab', favicon: 'globe',
        history: [], hIndex: -1, loading: false, zoom: 1, mode: null,
        pane: document.createElement('div')
      };
      tab.pane.className = 'edge-pane hidden';
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
      closeFind();
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

    function syncChrome() {
      if (!active) return;
      if (document.activeElement !== omni) omni.value = active.url;
      var p = parseUrl(active.url);
      lockIco.innerHTML = Icons.get(p.kind === 'internal' ? 'gear'
        : Emu.state.net.connected ? 'shield' : (p.secure === false ? 'info' : 'lock'));
      lockIco.title = Emu.state.net.connected ? 'Fetched through the relay' : 'Fetched directly';
      U.$('[data-nav="back"]', win.body).classList.toggle('disabled', active.hIndex <= 0);
      U.$('[data-nav="fwd"]', win.body).classList.toggle('disabled', active.hIndex >= active.history.length - 1);
      starBtn.classList.toggle('on', isFav(active.url));
      var host = p.host;
      var shown = /^(internal|site|source)$/.test(p.kind) ? 'local' : (active.mode || 'app');
      var chip = U.$('.e-mode', win.body);
      if (chip) {
        chip.textContent = shown === 'local' ? 'Orion' : shown === 'app' ? 'App'
          : shown === 'reader' ? 'Reader' : 'Engine';
        chip.className = 'e-mode mode-' + shown;
        chip.title = shown === 'app' ? 'Running the real site'
          : shown === 'local' ? 'A page built into Orion'
          : 'Showing a stripped-down copy - click to run the real site';
      }
      U.$('[data-nav="reader"]', win.body).classList.toggle('on', shown === 'reader');
      U.$('[data-nav="vpn"]', win.body).classList.toggle('vpn-on', !!Emu.state.net.connected);
      renderFavbar();
    }

    function renderFavbar() {
      favbar.innerHTML = st.favorites.map(function (f, i) {
        return '<div class="fav-item" data-fav="' + i + '" title="' + U.esc(f.url) + '">' +
          Icons.get(f.icon || 'globe') + '<span>' + U.esc(f.title) + '</span></div>';
      }).join('');
    }

    function isFav(url) { return st.favorites.some(function (f) { return f.url === url; }); }

    function status(msg) {
      if (!msg) { statusEl.classList.add('hidden'); return; }
      statusEl.textContent = msg;
      statusEl.classList.remove('hidden');
    }

    // -------------------------------------------------------- navigation
    function navigate(tab, input, push) {
      var p = parseUrl(input);
      var url = p.kind === 'search' ? searchUrl(p.term) : p.url;
      if (p.kind === 'search') p = parseUrl(url);

      // A view override (Reader, "render it here") belongs to the page you
      // chose it on. Moving to a different site drops it, otherwise one tap
      // of Reader would quietly turn every later site into text.
      if (tab.lastHost && p.host && tab.lastHost !== p.host) tab.mode = null;
      if (p.host) tab.lastHost = p.host;

      tab.url = url;
      tab.loading = true;
      tab.find = null;
      renderTabs();
      if (tab === active) { syncChrome(); startProgress(); closeFind(); }

      if (push !== false) {
        tab.history = tab.history.slice(0, tab.hIndex + 1);
        if (tab.history[tab.history.length - 1] !== url) tab.history.push(url);
        tab.hIndex = tab.history.length - 1;
      }
      tab.pane.innerHTML = '';

      if (p.kind === 'internal') {
        var ip = internalPage(p.host, p);
        renderLocal(tab, ip.html, ip.title, ip.favicon);
        if (p.host === 'newtab') wireNewTab(tab);
        finish(tab);
        return;
      }

      if (p.kind === 'site') {
        var site = SITES[p.host];
        var out = site.render(p);
        renderLocal(tab, out.html, out.title || site.title, site.favicon);
        if (out.mount) out.mount(tab.pane);
        record(out.title || site.title, url);
        finish(tab);
        return;
      }

      if (p.kind === 'source') { renderSource(tab, p.target); return; }

      // A real page on the real internet. App mode runs the site's own code
      // in a frame, which is the only way games and web apps actually work;
      // the engine is for reading pages that refuse to be framed.
      var mode = tab.mode || 'app';
      if (mode === 'app') { renderFrame(tab, url, p.host); return; }
      if (Emu.state.net.killSwitch && !Emu.state.net.connected) {
        renderMessage(tab, 'warning', 'Blocked by the VPN kill switch',
          'Orion VPN is not connected and the kill switch is on, so real sites are not being fetched.',
          [['open-vpn', 'Open Orion VPN', true], ['killswitch-off', 'Turn the kill switch off', false]], url);
        finish(tab);
        return;
      }
      renderEngine(tab, url, mode === 'reader');
    }

    /** Pages that ship with the emulator. */
    function renderLocal(tab, html, title, favicon) {
      var page = document.createElement('div');
      page.className = 'edge-page';
      page.innerHTML = html;
      tab.pane.appendChild(page);
      tab.title = title || 'Page';
      tab.favicon = favicon || 'globe';
      tab.root = page;
      page.addEventListener('click', function (e) { onLocalClick(e, tab); });
      page.addEventListener('change', function (e) { onLocalChange(e, tab); });
    }

    /** The engine: fetch, sanitise, rewrite, paint into a shadow root. */
    function renderEngine(tab, url, readerMode) {
      status('Requesting ' + url + '…');
      Net.fetchPage(url, { mode: readerMode ? 'reader' : 'auto' }).then(function (res) {
        var hostEl = document.createElement('div');
        hostEl.className = 'edge-view';
        tab.pane.appendChild(hostEl);
        var shadow = hostEl.attachShadow({ mode: 'open' });
        tab.shadow = shadow;
        tab.root = shadow;

        var doc, bodyHtml, pageTitle, note;

        if (res.kind === 'text' || readerMode) {
          var rd = Net.readerToHtml(res.body);
          pageTitle = rd.title || url;
          bodyHtml = '<article class="reader">' + rd.html + '</article>';
          note = 'Reader view via ' + res.via.host;
        } else {
          doc = Net.buildDocument(res.body, url, { images: st.images });
          pageTitle = doc.title || url;
          bodyHtml = doc.body;
          note = doc.blocked + ' scripts/frames removed · ' + doc.links + ' links · ' +
            U.fmtBytes(res.bytes) + ' via ' + res.via.host + (res.cached ? ' (cached)' : '');
        }

        shadow.innerHTML = '<style>' + baseSheet() + '</style>' +
          (doc && doc.styles ? '<style>' + doc.styles + '</style>' : '') +
          '<div class="emu-doc" style="zoom:' + tab.zoom + '">' + bodyHtml + '</div>';

        tab.title = String(pageTitle).slice(0, 90);
        tab.favicon = 'globe';
        wireShadow(tab, shadow, url);
        record(tab.title, url);
        status(note);
        setTimeout(function () { status(''); }, 5000);
        finish(tab);

        // Progressive enhancement: pull in the page's own CSS afterwards.
        if (doc && st.styles && doc.sheets && doc.sheets.length) {
          Net.fetchSheets(doc.sheets).then(function (css) {
            if (!css || tab.shadow !== shadow) return;
            var s = document.createElement('style');
            s.textContent = css;
            shadow.appendChild(s);
          });
        }
      }).catch(function (err) {
        status('');
        renderMessage(tab, 'warning', 'This page could not be fetched',
          Emu.state.net.connected
            ? 'The relay could not retrieve it (' + err.message + '). It may be rate limiting, or the site may block relays.'
            : 'A direct fetch failed (' + err.message + '). Real sites usually need the relay - open Orion VPN and connect.',
          [['open-vpn', 'Open Orion VPN', !Emu.state.net.connected], ['retry', 'Try again', false],
           ['reader', 'Try reader mode', false], ['open-external', 'Open in system browser', false]], url);
        finish(tab);
      });
    }

    function renderSource(tab, url) {
      Net.fetchPage(url).then(function (res) {
        renderLocal(tab, '<div class="e-list"><h1>Source of ' + U.esc(url) + '</h1>' +
          '<pre class="src">' + U.esc(res.body.slice(0, 200000)) + '</pre></div>',
          'view-source:' + url, 'code');
        finish(tab);
      }).catch(function (e) {
        renderMessage(tab, 'warning', 'Could not read the source', e.message, [['retry', 'Try again', true]], url);
        finish(tab);
      });
    }

    /**
     * App mode: the site loads in a real frame and runs its own JavaScript,
     * WebGL, audio and pointer lock. This is what games need.
     */
    function renderFrame(tab, url, host) {
      var frame = document.createElement('iframe');
      frame.className = 'edge-frame';
      // Delegate the permissions interactive sites actually use.
      frame.setAttribute('allow',
        'fullscreen; autoplay; gamepad; pointer-lock; accelerometer; gyroscope; microphone; camera; clipboard-write');
      frame.setAttribute('allowfullscreen', 'true');
      frame.src = url;
      tab.pane.appendChild(frame);
      tab.root = null;
      tab.title = host || parseUrl(url).host || url;
      tab.favicon = 'globe';
      record(tab.title, url);
      status('App mode · the site is running its own code');

      var bar = U.el('<div class="edge-infobar app-bar">' + Icons.get('info') +
        '<span class="sp">Running the real site. Big games can take a while to appear.</span>' +
        '<button data-act="open-external">Open in system browser</button>' +
        '<button data-act="dismiss-bar">Dismiss</button></div>');
      bar.addEventListener('click', function (e) {
        var b = e.target.closest('[data-act]');
        if (!b) return;
        if (b.dataset.act === 'dismiss-bar') { bar.remove(); sizeFrame(); return; }
        if (b.dataset.act === 'open-external') { openExternal(url); return; }

      });
      tab.pane.appendChild(bar);
      bar.style.cssText = 'position:absolute;left:0;right:0;top:0;z-index:5';

      function sizeFrame() {
        var h = bar.parentNode ? bar.offsetHeight : 0;
        frame.style.top = h + 'px';
        frame.style.height = 'calc(100% - ' + h + 'px)';
      }
      sizeFrame();
      // The bar is for the first visit only; games want the whole window.
      setTimeout(function () { if (bar.parentNode) { bar.remove(); sizeFrame(); } }, 9000);

      frame.addEventListener('load', function () { finish(tab); });
      setTimeout(function () { finish(tab); }, 4000);
    }

    function renderMessage(tab, icon, title, body, actions, url) {
      tab.pane.innerHTML = '';
      var page = document.createElement('div');
      page.className = 'edge-page';
      page.innerHTML = '<div class="err-page">' + Icons.get(icon) +
        '<h2>' + U.esc(title) + '</h2><p>' + U.esc(body) + '</p>' +
        '<code>' + U.esc(url || '') + '</code><div class="err-actions">' +
        actions.map(function (a) {
          return '<button class="btn' + (a[2] ? ' primary' : '') + '" data-act="' + a[0] +
            '" data-url="' + U.esc(url || '') + '">' + U.esc(a[1]) + '</button>';
        }).join('') + '</div></div>';
      tab.pane.appendChild(page);
      tab.root = page;
      tab.title = title;
      tab.favicon = 'warning';
      page.addEventListener('click', function (e) { onLocalClick(e, tab); });
    }

    function baseSheet() {
      var dark = Emu.state.theme === 'dark';
      return ':host{all:initial;display:block}' +
        '*{box-sizing:border-box;max-width:100%}' +
        '.emu-doc{font:15px/1.6 "Segoe UI Variable Text","Segoe UI",system-ui,sans-serif;' +
        'color:' + (dark ? '#e6e6e8' : '#1a1a1a') + ';background:' + (dark ? '#1c1c20' : '#fff') + ';' +
        'padding:22px 26px 60px;min-height:100%;overflow-wrap:break-word}' +
        '.emu-doc img{max-width:100%;height:auto;border-radius:4px}' +
        '.emu-doc a{color:' + (dark ? '#7cc0ff' : '#0b57d0') + ';text-decoration:underline;cursor:pointer}' +
        '.emu-doc table{border-collapse:collapse;max-width:100%;overflow:auto;display:block}' +
        '.emu-doc td,.emu-doc th{border:1px solid rgba(128,128,128,.35);padding:5px 8px}' +
        '.emu-doc pre,.emu-doc code{font-family:Consolas,monospace;background:rgba(128,128,128,.16);' +
        'padding:2px 5px;border-radius:4px;white-space:pre-wrap}' +
        '.emu-doc h1,.emu-doc h2,.emu-doc h3{line-height:1.25;margin:18px 0 8px}' +
        '.emu-doc input,.emu-doc select,.emu-doc textarea{font:inherit;padding:5px 8px;border-radius:5px;' +
        'border:1px solid rgba(128,128,128,.5);background:transparent;color:inherit;max-width:100%}' +
        '.emu-doc button{font:inherit;padding:5px 12px;border-radius:5px;border:1px solid rgba(128,128,128,.5);' +
        'background:rgba(128,128,128,.14);color:inherit;cursor:pointer}' +
        '.emu-doc mark.emu-hit{background:#ffd54a;color:#000}' +
        '.emu-doc mark.emu-hit.on{background:#ff8a00}' +
        '.reader{max-width:720px;margin:0 auto}' +
        '.reader h1,.reader h2{margin-top:22px}' +
        '.emu-doc [style*="position:fixed"],.emu-doc [style*="position: fixed"]{position:static !important}';
    }

    /** Clicks, forms and hovers inside a rendered remote page. */
    function wireShadow(tab, shadow, baseUrl) {
      shadow.addEventListener('click', function (e) {
        var path = e.composedPath();
        for (var i = 0; i < path.length; i++) {
          var el = path[i];
          if (!el.tagName) continue;
          if (el.tagName === 'A') {
            e.preventDefault();
            var href = el.getAttribute('data-emu-href') || el.getAttribute('href');
            if (!href || /^javascript:/i.test(href)) return;
            if (/^#/.test(href)) return;
            navigate(tab, href, true);
            return;
          }
        }
      }, true);

      shadow.addEventListener('submit', function (e) {
        e.preventDefault();
        var form = e.target;
        var action = form.getAttribute('data-emu-form') || baseUrl;
        if ((form.getAttribute('data-emu-method') || 'get') !== 'get') {
          Emu.notify('Microsoft Edge', 'Forms that submit data are disabled in the emulated browser.', 'edge');
          return;
        }
        var parts = [];
        Array.prototype.slice.call(form.querySelectorAll('input[name],select[name],textarea[name]')).forEach(function (i) {
          if (i.type === 'password' || i.disabled) return;
          if ((i.type === 'checkbox' || i.type === 'radio') && !i.checked) return;
          parts.push(encodeURIComponent(i.name) + '=' + encodeURIComponent(i.value || ''));
        });
        navigate(tab, action + (action.indexOf('?') >= 0 ? '&' : '?') + parts.join('&'), true);
      });

      shadow.addEventListener('mouseover', function (e) {
        var a = e.composedPath().filter(function (n) { return n.tagName === 'A'; })[0];
        if (a && tab === active) status(a.getAttribute('data-emu-href') || '');
      });
      shadow.addEventListener('mouseout', function () { if (tab === active) status(''); });
    }

    function finish(tab) {
      tab.loading = false;
      renderTabs();
      if (tab === active) { syncChrome(); endProgress(); }
    }

    function record(title, url) {
      if (/^edge:\/\//.test(url)) return;
      st.history = st.history.filter(function (h) { return h.url !== url; });
      st.history.unshift({ title: title, url: url, ts: Date.now() });
      if (st.history.length > 200) st.history.length = 200;
      Emu.save();
    }

    function startProgress() {
      progress.style.transition = 'none';
      progress.style.width = '0%';
      setTimeout(function () { progress.style.transition = ''; progress.style.width = '72%'; }, 10);
    }
    function endProgress() {
      progress.style.width = '100%';
      setTimeout(function () { progress.style.transition = 'opacity .2s'; progress.style.width = '0%'; }, 220);
    }

    // ------------------------------------------------------ page actions
    function onLocalClick(e, tab) {
      var act = e.target.closest('[data-act]');
      if (act) {
        var a = act.dataset.act, url = act.dataset.url;
        if (a === 'open-external') { openExternal(url || tab.url); return; }
        if (a === 'retry') { navigate(tab, url || tab.url, false); return; }
        if (a === 'reader') { tab.mode = 'reader'; navigate(tab, url || tab.url, false); return; }
        if (a === 'open-vpn') { Emu.launch('vpn'); return; }
        if (a === 'killswitch-off') { Emu.state.net.killSwitch = false; Emu.save(); navigate(tab, url || tab.url, false); return; }
        if (a === 'clear-history') { st.history = []; Emu.save(); navigate(tab, tab.url, false); return; }
        if (a === 'clear-cache') { Net.clearCache(); navigate(tab, tab.url, false); return; }
        if (a === 'clear-all') {
          st.history = []; st.downloads = []; Emu.save();
          Emu.notify('Microsoft Edge', 'Browsing data cleared.', 'edge');
          navigate(tab, tab.url, false); return;
        }
        if (a === 'unfav') { st.favorites.splice(+act.dataset.i, 1); Emu.save(); navigate(tab, tab.url, false); syncChrome(); return; }
        if (a === 'images') { st.images = !st.images; Emu.save(); navigate(tab, tab.url, false); return; }
        if (a === 'styles') { st.styles = !st.styles; Emu.save(); navigate(tab, tab.url, false); return; }
        if (a === 'show-dl') { Emu.launch('explorer', { path: VFS.HOME + '\\Downloads' }); return; }
        if (a === 'download') { doDownload(act.dataset.name || 'download.txt', tab.url); return; }
      }
      var l = e.target.closest('[data-url]');
      if (l) { navigate(tab, l.dataset.url, true); }
    }

    function onLocalChange(e, tab) {
      var t = e.target;
      if (t.dataset.act === 'homepage') { st.homepage = t.value.trim() || NEWTAB; Emu.save(); }
      if (t.dataset.act === 'mode') { st.render = t.value; Emu.save(); }
    }

    function wireNewTab(tab) {
      var input = tab.pane.querySelector('[data-ntp-q]');
      var btn = tab.pane.querySelector('[data-ntp-go]');
      if (!input) return;
      function go() { var v = input.value.trim(); if (v) navigate(tab, v, true); }
      input.addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); });
      if (btn) btn.addEventListener('click', go);
      setTimeout(function () { if (win === WM.focused) input.focus(); }, 60);
    }

    function openExternal(url) {
      var w = window.open(url, '_blank', 'noopener');
      if (!w) Emu.notify('Microsoft Edge', 'Your browser blocked the pop-up.', 'warning');
    }

    function doDownload(name, from) {
      var body = 'Orion - keyboard shortcuts\r\n\r\n' +
        'Win\t\t\tStart menu\r\nWin+D\t\tShow desktop\r\nWin+E\t\tFile Explorer\r\n' +
        'Win+S\t\tSearch\r\nWin+Tab\t\tTask View\r\nWin+A\t\tQuick Settings\r\n' +
        'Win+N\t\tNotifications\r\nWin+W\t\tWidgets\r\nWin+Arrows\tSnap windows\r\n' +
        'Alt+Tab\t\tSwitch windows\r\nCtrl+T / Ctrl+W\tNew / close tab\r\nCtrl+L\t\tAddress bar\r\n' +
        'Ctrl+F\t\tFind on page\r\n';
      var dir = VFS.HOME + '\\Downloads';
      var target = dir + '\\' + VFS.uniqueName(dir, name.replace(/\.txt$/, ''), '.txt');
      VFS.write(target, body, 'txt');
      st.downloads.unshift({ name: VFS.nameOf(target), from: from, ts: Date.now(), path: target });
      Emu.save();
      Emu.notify('Download complete', VFS.nameOf(target) + ' saved to Downloads.', 'download');
    }

    // -------------------------------------------------------- find on page
    function findRoot() { return active && active.root; }

    function clearHits() {
      var root = findRoot();
      if (!root) return;
      Array.prototype.slice.call(root.querySelectorAll('mark.emu-hit')).forEach(function (m) {
        var t = document.createTextNode(m.textContent);
        m.parentNode.replaceChild(t, m);
      });
      if (root.normalize) root.normalize();
      else if (root.host) root.host.normalize();
    }

    function runFind(term) {
      clearHits();
      var root = findRoot();
      if (!root || !term) { U.$('.fb-count', win.body).textContent = '0/0'; return; }
      var scope = root.querySelector ? (root.querySelector('.emu-doc') || root) : root;
      var walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, {
        acceptNode: function (n) {
          if (!n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
          var p = n.parentNode.nodeName;
          if (p === 'SCRIPT' || p === 'STYLE' || p === 'MARK') return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      });
      var nodes = [], n;
      while ((n = walker.nextNode())) nodes.push(n);
      var needle = term.toLowerCase(), count = 0;
      nodes.forEach(function (node) {
        var text = node.nodeValue, lower = text.toLowerCase(), idx = lower.indexOf(needle);
        if (idx < 0) return;
        var frag = document.createDocumentFragment(), pos = 0;
        while (idx >= 0 && count < 400) {
          frag.appendChild(document.createTextNode(text.slice(pos, idx)));
          var mark = document.createElement('mark');
          mark.className = 'emu-hit';
          mark.textContent = text.slice(idx, idx + term.length);
          frag.appendChild(mark);
          pos = idx + term.length;
          idx = lower.indexOf(needle, pos);
          count++;
        }
        frag.appendChild(document.createTextNode(text.slice(pos)));
        node.parentNode.replaceChild(frag, node);
      });
      active.find = { term: term, total: count, at: count ? 0 : -1 };
      focusHit(0);
    }

    function focusHit(delta) {
      var root = findRoot();
      if (!root || !active.find) return;
      var hits = Array.prototype.slice.call(root.querySelectorAll('mark.emu-hit'));
      if (!hits.length) { U.$('.fb-count', win.body).textContent = '0/0'; return; }
      active.find.at = ((active.find.at + delta) % hits.length + hits.length) % hits.length;
      hits.forEach(function (h, i) { h.classList.toggle('on', i === active.find.at); });
      hits[active.find.at].scrollIntoView({ block: 'center', behavior: 'smooth' });
      U.$('.fb-count', win.body).textContent = (active.find.at + 1) + '/' + hits.length;
    }

    function openFind() {
      findBar.classList.remove('hidden');
      findInput.focus();
      findInput.select();
    }
    function closeFind() {
      findBar.classList.add('hidden');
      clearHits();
      findInput.value = '';
    }

    findInput.addEventListener('input', U.debounce(function () { runFind(findInput.value); }, 220));
    findInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); focusHit(e.shiftKey ? -1 : 1); }
      if (e.key === 'Escape') closeFind();
    });
    findBar.addEventListener('click', function (e) {
      var b = e.target.closest('[data-find]');
      if (!b) return;
      if (b.dataset.find === 'next') focusHit(1);
      if (b.dataset.find === 'prev') focusHit(-1);
      if (b.dataset.find === 'close') closeFind();
    });

    function setZoom(delta) {
      active.zoom = U.clamp((active.zoom || 1) + delta, 0.5, 2.5);
      var doc = active.shadow && active.shadow.querySelector('.emu-doc');
      if (doc) doc.style.zoom = active.zoom;
      else if (active.root && active.root.style) active.root.style.zoom = active.zoom;
      status('Zoom ' + Math.round(active.zoom * 100) + '%');
      setTimeout(function () { status(''); }, 1200);
    }

    // ----------------------------------------------------------- omnibox
    function closeSuggest() {
      if (suggestEl) { suggestEl.remove(); suggestEl = null; }
      suggestIndex = -1;
    }

    function showSuggest() {
      closeSuggest();
      var q = omni.value.trim(), lower = q.toLowerCase();
      var items = [], seen = {};
      if (q) items.push({ icon: 'search', text: q, sub: 'Search the web', url: searchUrl(q) });
      function add(title, url, icon, sub) {
        if (seen[url] || items.length > 8) return;
        seen[url] = 1;
        items.push({ icon: icon, text: title, sub: sub || url, url: url });
      }
      INDEX.forEach(function (s) {
        if (!q || (s.title + ' ' + s.url + ' ' + s.kw).toLowerCase().indexOf(lower) >= 0) add(s.title, s.url, 'globe');
      });
      st.history.forEach(function (h) {
        if (!q || (h.title + ' ' + h.url).toLowerCase().indexOf(lower) >= 0) add(h.title || h.url, h.url, 'history');
      });
      ['newtab', 'history', 'favorites', 'downloads', 'settings', 'net'].forEach(function (p) {
        if (q && ('edge://' + p).indexOf(lower) >= 0) add('edge://' + p, 'edge://' + p, 'gear', 'Edge page');
      });
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

      // Live suggestions from the real search engine, appended when they land.
      if (q.length > 1) {
        Net.suggest(q).then(function (list) {
          if (!suggestEl || omni.value.trim() !== q) return;
          list.slice(0, 4).forEach(function (s) {
            if (s.toLowerCase() === lower) return;
            var row = U.el('<div class="e-sug">' + Icons.get('search') +
              '<span>' + U.esc(s) + '</span><small>Suggestion</small></div>');
            row.addEventListener('mousedown', function (e) {
              e.preventDefault();
              navigate(active, searchUrl(s), true);
              omni.blur();
              closeSuggest();
            });
            suggestEl.appendChild(row);
            var urls = JSON.parse(suggestEl.dataset.items);
            urls.push(searchUrl(s));
            suggestEl.dataset.items = JSON.stringify(urls);
          });
        });
      }
    }

    omni.addEventListener('focus', function () { omni.select(); showSuggest(); });
    omni.addEventListener('input', showSuggest);
    omni.addEventListener('blur', function () { setTimeout(closeSuggest, 140); syncChrome(); });
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

    // ----------------------------------------------------------- toolbar
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
      else if (kind === 'reload') { Net.clearCache(); navigate(active, active.url, false); }
      else if (kind === 'home') navigate(active, st.homepage || NEWTAB, true);
      else if (kind === 'favs') navigate(active, 'edge://favorites', true);
      else if (kind === 'find') openFind();
      else if (kind === 'reader') {
        active.mode = active.mode === 'reader' ? null : 'reader';
        navigate(active, active.url, false);
      }
      else if (kind === 'mode') {
        active.mode = null;
        navigate(active, active.url, false);
      }
      else if (kind === 'vpn') Emu.launch('vpn');
      else if (kind === 'fav') toggleFav();
      else if (kind === 'menu') openMenu(b);
    });

    function toggleFav() {
      if (isFav(active.url)) {
        st.favorites = st.favorites.filter(function (f) { return f.url !== active.url; });
      } else {
        st.favorites.push({ title: active.title.slice(0, 32), url: active.url, icon: active.favicon });
        Emu.notify('Microsoft Edge', 'Added to favourites.', 'star');
      }
      Emu.save();
      syncChrome();
    }

    newTabBtn.addEventListener('click', function () { newTab(NEWTAB); });

    function openMenu(anchor) {
      var r = anchor.getBoundingClientRect();
      var mode = active.mode || 'app';
      // Every override applies to this page only and is dropped when the tab
      // moves on, so a site can never end up permanently stuck as text.
      function pick(m) {
        return function () {
          active.mode = m === 'app' ? null : m;
          navigate(active, active.url, false);
        };
      }
      global.Shell.contextMenu([
        { label: 'New tab', icon: 'plus', key: 'Ctrl+T', action: function () { newTab(NEWTAB); } },
        { label: 'New window', icon: 'globe', action: function () { Emu.launch('edge'); } },
        { sep: true },
        { label: 'Find on page', icon: 'find', key: 'Ctrl+F', action: openFind },
        { label: 'Zoom in', icon: 'zoomIn', key: 'Ctrl++', action: function () { setZoom(0.1); } },
        { label: 'Zoom out', icon: 'zoomOut', key: 'Ctrl+-', action: function () { setZoom(-0.1); } },
        { sep: true },
        { label: (mode === 'app' ? '✓ ' : '') + 'App mode (run the site)', icon: 'monitor', action: pick('app') },
        { label: (mode === 'engine' ? '✓ ' : '') + 'Engine rendering', icon: 'apps', action: pick('engine') },
        { label: (mode === 'reader' ? '✓ ' : '') + 'Reader mode', icon: 'reader', action: pick('reader') },
        { label: 'View source', icon: 'code', action: function () { navigate(active, 'view-source:' + active.url, true); } },
        { sep: true },
        { label: 'Favourites', icon: 'star', action: function () { navigate(active, 'edge://favorites', true); } },
        { label: 'History', icon: 'history', action: function () { navigate(active, 'edge://history', true); } },
        { label: 'Downloads', icon: 'download', action: function () { navigate(active, 'edge://downloads', true); } },
        { label: 'Network internals', icon: 'network', action: function () { navigate(active, 'edge://net', true); } },
        { sep: true },
        { label: 'Open in system browser', icon: 'upload', action: function () {
          if (/^edge:\/\//.test(active.url) || /\.emu|bing\.local/.test(active.url)) {
            Emu.notify('Microsoft Edge', 'That page only exists inside the emulator.', 'info');
          } else openExternal(active.url);
        } },
        { label: 'Settings', icon: 'gear', action: function () { navigate(active, 'edge://settings', true); } }
      ], r.right - 250, r.bottom + 4);
    }

    // --------------------------------------------------------- keyboard
    function onKey(e) {
      if (WM.focused !== win) return;
      var ctrl = e.ctrlKey || e.metaKey;
      var k = e.key.toLowerCase();
      if (ctrl && k === 't') { e.preventDefault(); newTab(NEWTAB); }
      else if (ctrl && k === 'w') { e.preventDefault(); closeTab(active); }
      else if (ctrl && k === 'l') { e.preventDefault(); omni.focus(); }
      else if (ctrl && k === 'f') { e.preventDefault(); openFind(); }
      else if (ctrl && (k === '+' || k === '=')) { e.preventDefault(); setZoom(0.1); }
      else if (ctrl && k === '-') { e.preventDefault(); setZoom(-0.1); }
      else if (ctrl && k === '0') { e.preventDefault(); active.zoom = 1; setZoom(0); }
      else if (e.key === 'F5' || (ctrl && k === 'r')) { e.preventDefault(); Net.clearCache(); navigate(active, active.url, false); }
      else if (e.key === 'F3') { e.preventDefault(); focusHit(1); }
      else if (e.altKey && e.key === 'ArrowLeft' && active.hIndex > 0) { active.hIndex--; navigate(active, active.history[active.hIndex], false); }
      else if (e.altKey && e.key === 'ArrowRight' && active.hIndex < active.history.length - 1) { active.hIndex++; navigate(active, active.history[active.hIndex], false); }
    }
    document.addEventListener('keydown', onKey);

    var onNet = Emu.on('net', function () { syncChrome(); });
    win.onClose = function () {
      document.removeEventListener('keydown', onKey);
      Emu.off('net', onNet);
    };

    renderFavbar();
    newTab(args && args.url ? args.url : (st.homepage || NEWTAB));

    win.data.edge = {
      openUrl: function (u) { newTab(u); win.focus(); },
      navigate: function (u) { navigate(active, u, true); win.focus(); },
      search: function (q) { newTab(searchUrl(q)); win.focus(); }
    };
    return win;
  }

  Emu.registerApp({
    id: 'edge', name: 'Microsoft Edge', icon: 'edge', pinned: true,
    desc: 'Web browser with its own rendering engine',
    launch: launchEdge,
    open: function (url) {
      var existing = WM.byApp('edge')[0];
      if (existing && existing.data.edge) { existing.data.edge.openUrl(url); return existing; }
      return launchEdge({ url: url });
    },
    search: function (q) {
      var existing = WM.byApp('edge')[0];
      if (existing && existing.data.edge) { existing.data.edge.search(q); return existing; }
      return launchEdge({ url: searchUrl(q) });
    }
  });

  Emu.EdgeIndex = INDEX;
})(window);
