/* ===== Orion Tube =====
   A YouTube client. Metadata comes from the yt edge function on the Orion
   Supabase project, so the Data API key stays on the server and never ships
   in this repo. Playback uses the official embedded player.

   The feed adapts: every video you open raises the score of its channel and
   its category, and later feeds are ranked by those scores.                */
(function (global) {
  'use strict';

  var Emu = global.Emu, U = Emu.util, Icons = global.Icons, WM = global.WM, Auth = global.Auth;

  var API = 'https://bgoxonxxutkporbqbtbh.supabase.co/functions/v1/yt';

  var CATEGORIES = {
    '1': 'Film', '2': 'Autos', '10': 'Music', '15': 'Pets', '17': 'Sport',
    '19': 'Travel', '20': 'Gaming', '22': 'People', '23': 'Comedy', '24': 'Entertainment',
    '25': 'News', '26': 'How-to', '27': 'Education', '28': 'Science', '29': 'Activism'
  };

  function store() {
    var y = Emu.state.yt || (Emu.state.yt = {});
    if (!y.affinity) y.affinity = { channel: {}, category: {} };
    if (!y.history) y.history = [];
    return y;
  }

  function api(path) {
    return fetch(API + path, { headers: { apikey: Auth.CFG.key } })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d && d.error) throw new Error(d.error);
        return (d && d.items) || [];
      });
  }

  /** Score a video against what has actually been watched. */
  function score(v) {
    var a = store().affinity;
    var s = 0;
    if (v.channelId && a.channel[v.channelId]) s += a.channel[v.channelId] * 3;
    if (v.categoryId && a.category[v.categoryId]) s += a.category[v.categoryId];
    return s;
  }

  function rank(items) {
    return items.slice().sort(function (x, y) { return score(y) - score(x); });
  }

  function remember(v) {
    var y = store();
    if (v.channelId) y.affinity.channel[v.channelId] = (y.affinity.channel[v.channelId] || 0) + 3;
    if (v.categoryId) y.affinity.category[v.categoryId] = (y.affinity.category[v.categoryId] || 0) + 1;
    y.history = y.history.filter(function (h) { return h.id !== v.id; });
    y.history.unshift({ id: v.id, title: v.title, channel: v.channel, thumb: v.thumb, ts: Date.now() });
    if (y.history.length > 60) y.history.length = 60;
    Emu.save();
  }

  /** Channels watched most, best first. */
  function topChannels(n) {
    var a = store().affinity.channel;
    return Object.keys(a).sort(function (x, y) { return a[y] - a[x]; }).slice(0, n || 4);
  }

  function views(n) {
    n = parseInt(n, 10);
    if (!n) return '';
    if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B views';
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M views';
    if (n >= 1e3) return Math.round(n / 1e3) + 'K views';
    return n + ' views';
  }

  function dur(sec) {
    if (!sec) return '';
    var m = Math.floor(sec / 60), s = sec % 60;
    if (m >= 60) return Math.floor(m / 60) + ':' + String(m % 60).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    return m + ':' + String(s).padStart(2, '0');
  }

  function embed(id, autoplay, loop) {
    return 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(id) +
      '?rel=0&modestbranding=1&playsinline=1' + (autoplay ? '&autoplay=1' : '') +
      (loop ? '&loop=1&playlist=' + encodeURIComponent(id) : '');
  }

  function launch(args) {
    var win = WM.create({
      appId: 'youtube', title: 'Orion Tube', icon: 'youtube',
      width: 1180, height: 760, minWidth: 560, minHeight: 420
    });

    var view = (args && args.view) || 'home';
    var query = '';
    var feed = [];
    var shorts = [];
    var shortIndex = 0;
    var watching = null;
    var loading = false;
    var error = null;

    win.body.innerHTML =
      '<div class="yt">' +
        '<div class="yt-rail">' +
          '<div class="yt-brand">' + Icons.get('youtube') + '<span>Orion Tube</span></div>' +
          ['home:Home:apps', 'shorts:Shorts:play', 'history:History:history'].map(function (x) {
            var p = x.split(':');
            return '<div class="yt-nav" data-view="' + p[0] + '">' + Icons.get(p[2]) +
              '<span>' + p[1] + '</span></div>';
          }).join('') +
          '<div class="yt-subs" data-subs></div>' +
        '</div>' +
        '<div class="yt-main">' +
          '<div class="yt-top">' +
            '<div class="yt-search"><span class="si">' + Icons.get('search') + '</span>' +
            '<input placeholder="Search" spellcheck="false"></div>' +
            '<button class="btn" data-act="refresh">Refresh</button>' +
          '</div>' +
          '<div class="yt-body" data-body></div>' +
        '</div>' +
      '</div>';

    var body = U.$('[data-body]', win.body);
    var input = U.$('.yt-search input', win.body);

    function setNav() {
      U.$$('.yt-nav', win.body).forEach(function (n) {
        n.classList.toggle('active', n.dataset.view === view && !watching);
      });
    }

    function card(v, big) {
      return '<div class="yt-card' + (big ? ' big' : '') + '" data-id="' + U.esc(v.id) + '">' +
        '<div class="yt-thumb" style="background-image:url(' + U.esc(v.thumb) + ')">' +
          (v.seconds ? '<span class="yt-dur">' + dur(v.seconds) + '</span>' : '') + '</div>' +
        '<div class="yt-meta"><b>' + U.esc(v.title) + '</b>' +
        '<small>' + U.esc(v.channel || '') +
        (v.views ? ' · ' + views(v.views) : '') +
        (v.categoryId && CATEGORIES[v.categoryId] ? ' · ' + CATEGORIES[v.categoryId] : '') +
        '</small></div></div>';
    }

    function renderSubs() {
      var host = U.$('[data-subs]', win.body);
      var y = store();
      var names = {};
      y.history.forEach(function (h) { names[h.channel] = true; });
      var list = Object.keys(names).slice(0, 6);
      host.innerHTML = list.length
        ? '<div class="yt-rail-head">Channels you watch</div>' + list.map(function (n) {
            return '<div class="yt-nav sub" data-channel="' + U.esc(n) + '">' +
              '<span class="yt-ava">' + U.esc(n.charAt(0).toUpperCase()) + '</span>' +
              '<span>' + U.esc(n) + '</span></div>';
          }).join('')
        : '';
    }

    function shell(inner) {
      body.innerHTML = inner;
      setNav();
      renderSubs();
    }

    function spinner(msg) {
      shell('<div class="yt-empty"><div class="gate-spin"><i></i></div><p>' + U.esc(msg || 'Loading…') + '</p></div>');
    }

    function fail(e) {
      shell('<div class="yt-empty">' + Icons.get('warning') +
        '<p>' + U.esc(e.message || 'Could not reach YouTube.') + '</p>' +
        '<button class="btn" data-act="refresh">Try again</button></div>');
    }

    // ------------------------------------------------------------- views
    function showHome() {
      view = 'home'; watching = null; shortIndex = 0;
      spinner('Building your feed…');
      var wants = topChannels(2);
      var jobs = [api('/popular?max=40')];
      wants.forEach(function (c) { jobs.push(api('/shorts?channelId=' + encodeURIComponent(c) + '&max=8')); });

      Promise.all(jobs.map(function (p) { return p.catch(function () { return []; }); }))
        .then(function (sets) {
          var seen = {};
          feed = [];
          sets.forEach(function (set) {
            set.forEach(function (v) { if (!seen[v.id]) { seen[v.id] = 1; feed.push(v); } });
          });
          if (!feed.length) throw new Error('The feed came back empty.');
          feed = rank(feed);
          var top = feed.slice(0, 1);
          var rest = feed.slice(1);
          shell(
            '<h3 class="yt-h">' + (topChannels(1).length ? 'For you' : 'Popular right now') + '</h3>' +
            '<div class="yt-grid">' + top.map(function (v) { return card(v, true); }).join('') +
            rest.map(function (v) { return card(v); }).join('') + '</div>');
        }).catch(fail);
    }

    function showSearch(q) {
      view = 'search'; watching = null; query = q;
      spinner('Searching…');
      api('/search?q=' + encodeURIComponent(q) + '&max=30').then(function (items) {
        if (!items.length) return shell('<div class="yt-empty"><p>Nothing found for “' + U.esc(q) + '”.</p></div>');
        shell('<h3 class="yt-h">Results for “' + U.esc(q) + '”</h3>' +
          '<div class="yt-list">' + items.map(function (v) { return card(v); }).join('') + '</div>');
      }).catch(fail);
    }

    function showShorts(seedQuery) {
      view = 'shorts'; watching = null;
      spinner('Loading shorts…');
      var chans = topChannels(1);
      var path = seedQuery ? '/shorts?q=' + encodeURIComponent(seedQuery) + '&max=30'
        : chans.length ? '/shorts?channelId=' + encodeURIComponent(chans[0]) + '&max=30'
        : '/shorts?q=' + encodeURIComponent(['funny', 'gaming', 'music', 'sport'][Math.floor(Math.random() * 4)]) + '&max=30';

      api(path).then(function (items) {
        if (!items.length && !seedQuery) return showShorts('trending');
        shorts = rank(items);
        shortIndex = 0;
        if (!shorts.length) throw new Error('No shorts came back.');
        renderShort();
      }).catch(fail);
    }

    function renderShort() {
      var v = shorts[shortIndex];
      if (!v) return showShorts();
      remember(v);
      shell(
        '<div class="yt-shorts">' +
          '<button class="yt-sarrow" data-short="-1" title="Previous">' + Icons.get('chevronUp') + '</button>' +
          '<div class="yt-sframe">' +
            '<iframe src="' + embed(v.id, true, true) + '" allow="autoplay; encrypted-media; picture-in-picture" ' +
            'allowfullscreen frameborder="0"></iframe>' +
          '</div>' +
          '<button class="yt-sarrow" data-short="1" title="Next">' + Icons.get('chevronDown') + '</button>' +
          '<div class="yt-sinfo"><b>' + U.esc(v.title) + '</b>' +
            '<small>' + U.esc(v.channel) + (v.views ? ' · ' + views(v.views) : '') + '</small>' +
            '<div class="muted" style="font-size:11px;margin-top:6px">' +
            (shortIndex + 1) + ' of ' + shorts.length + ' · use ↑ ↓ or scroll</div></div>' +
        '</div>');
    }

    function showWatch(id) {
      var v = feed.concat(shorts).filter(function (x) { return x.id === id; })[0] ||
              (store().history.filter(function (h) { return h.id === id; })[0]) || { id: id, title: '', channel: '' };
      watching = v;
      remember(v);
      shell(
        '<div class="yt-watch">' +
          '<div class="yt-player"><iframe src="' + embed(id, true) +
            '" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen frameborder="0"></iframe></div>' +
          '<div class="yt-wmeta"><h2>' + U.esc(v.title || 'Now playing') + '</h2>' +
            '<div class="muted">' + U.esc(v.channel || '') + (v.views ? ' · ' + views(v.views) : '') + '</div>' +
            '<div class="yt-wactions">' +
              '<button class="btn" data-act="back">‹ Back</button>' +
              '<button class="btn" data-act="more">More from this channel</button>' +
              '<button class="btn" data-ext="https://www.youtube.com/watch?v=' + U.esc(id) + '">Open on YouTube</button>' +
            '</div>' +
            '<p class="muted" style="font-size:11.5px">If the video refuses to play here, its owner has ' +
            'disabled embedding — use Open on YouTube.</p></div>' +
          '<div class="yt-up" data-up><div class="yt-h">Up next</div></div>' +
        '</div>');

      var up = U.$('[data-up]', win.body);
      var others = rank(feed.filter(function (x) { return x.id !== id; })).slice(0, 12);
      if (others.length) {
        up.innerHTML = '<div class="yt-h">Up next</div>' + others.map(function (x) { return card(x); }).join('');
      } else {
        api('/popular?max=12').then(function (items) {
          feed = items;
          up.innerHTML = '<div class="yt-h">Up next</div>' +
            rank(items).filter(function (x) { return x.id !== id; }).map(function (x) { return card(x); }).join('');
        }).catch(function () {});
      }
    }

    function showHistory() {
      view = 'history'; watching = null;
      var h = store().history;
      shell('<h3 class="yt-h">Watch history</h3>' +
        (h.length
          ? '<div class="yt-list">' + h.map(function (v) { return card(v); }).join('') + '</div>' +
            '<p><button class="btn" data-act="clear-history">Clear history</button></p>'
          : '<div class="yt-empty"><p>Nothing watched yet. What you play here shapes the feed.</p></div>'));
    }

    // ------------------------------------------------------------ events
    win.body.addEventListener('click', function (e) {
      var nav = e.target.closest('[data-view]');
      if (nav) {
        if (nav.dataset.view === 'home') showHome();
        if (nav.dataset.view === 'shorts') showShorts();
        if (nav.dataset.view === 'history') showHistory();
        return;
      }
      var ch = e.target.closest('[data-channel]');
      if (ch) { input.value = ch.dataset.channel; showSearch(ch.dataset.channel); return; }

      var s = e.target.closest('[data-short]');
      if (s) {
        shortIndex = U.clamp(shortIndex + (+s.dataset.short), 0, shorts.length - 1);
        renderShort();
        return;
      }
      var ext = e.target.closest('[data-ext]');
      if (ext) { window.open(ext.dataset.ext, '_blank', 'noopener'); return; }

      var act = e.target.closest('[data-act]');
      if (act) {
        if (act.dataset.act === 'refresh') { watching ? showWatch(watching.id) : view === 'shorts' ? showShorts() : showHome(); return; }
        if (act.dataset.act === 'back') { showHome(); return; }
        if (act.dataset.act === 'clear-history') { store().history = []; Emu.save(); showHistory(); return; }
        if (act.dataset.act === 'more' && watching) {
          input.value = watching.channel || '';
          showSearch(watching.channel || '');
          return;
        }
      }
      var c = e.target.closest('[data-id]');
      if (c) showWatch(c.dataset.id);
    });

    input.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      var q = input.value.trim();
      if (q) showSearch(q);
    });

    // Shorts respond to the wheel and arrows, like the real thing.
    win.body.addEventListener('wheel', U.debounce(function (e) {
      if (view !== 'shorts' || watching) return;
      shortIndex = U.clamp(shortIndex + (e.deltaY > 0 ? 1 : -1), 0, shorts.length - 1);
      renderShort();
    }, 220));

    function onKey(e) {
      if (WM.focused !== win || view !== 'shorts' || watching) return;
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
      e.preventDefault();
      shortIndex = U.clamp(shortIndex + (e.key === 'ArrowDown' ? 1 : -1), 0, shorts.length - 1);
      renderShort();
    }
    document.addEventListener('keydown', onKey);
    win.onClose = function () { document.removeEventListener('keydown', onKey); };

    if (args && args.q) { input.value = args.q; showSearch(args.q); }
    else if (view === 'shorts') showShorts();
    else showHome();

    return win;
  }

  Emu.registerApp({
    id: 'youtube', name: 'Orion Tube', icon: 'youtube', pinned: true,
    desc: 'Videos and shorts, with a feed that learns',
    launch: launch
  });
})(window);
