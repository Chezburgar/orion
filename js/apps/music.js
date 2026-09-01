/* ===== Orion Music =====
   A music app built on the same Supabase edge function Orion Tube uses, so the
   YouTube Data API key stays server-side and never ships to this public repo.

   Playback runs through one hidden YouTube IFrame player that lives for the
   life of the window, so a track keeps playing while you browse, search and
   edit playlists. Playlists, likes and history are per-device in Emu.state -
   they are yours, not published to anyone else's Orion.                    */
(function (global) {
  'use strict';

  var Emu = global.Emu, U = Emu.util, Icons = global.Icons, WM = global.WM;

  var API = 'https://bgoxonxxutkporbqbtbh.supabase.co/functions/v1/yt';
  var MUSIC_CATEGORY = '10';

  // ------------------------------------------------------------- storage
  function store() {
    var s = Emu.state;
    if (!s.music) {
      s.music = { playlists: [], liked: [], recent: [], volume: 80, shuffle: false, repeat: 'off' };
    }
    var m = s.music;
    if (!m.playlists) m.playlists = [];
    if (!m.liked) m.liked = [];
    if (!m.recent) m.recent = [];
    if (m.volume == null) m.volume = 80;
    if (!m.repeat) m.repeat = 'off';
    return m;
  }
  function save() { Emu.save(); }

  function fmtTime(sec) {
    sec = Math.max(0, Math.round(sec || 0));
    var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s).padStart(2, '0');
  }

  /** YouTube titles are noisy for a music app; strip the usual decorations. */
  function cleanTitle(t) {
    return String(t || '')
      .replace(/\s*[\(\[][^\)\]]*(official|lyric|audio|video|visualizer|hd|4k|mv|m\/v)[^\)\]]*[\)\]]/ig, '')
      .replace(/\s*[-–|]\s*(official\s*)?(music\s*)?(video|audio|lyrics?|visualizer)\s*$/i, '')
      .trim() || String(t || '');
  }
  function cleanArtist(c) {
    return String(c || '').replace(/\s*-\s*Topic$/i, '').replace(/VEVO$/i, '').trim();
  }

  function api(path, params) {
    var u = API + path + '?' + Object.keys(params || {})
      .filter(function (k) { return params[k] !== '' && params[k] != null; })
      .map(function (k) { return k + '=' + encodeURIComponent(params[k]); }).join('&');
    return fetch(u).then(function (r) { return r.json(); }).then(function (d) {
      if (d && d.error) throw new Error(d.error);
      return (d && d.items) || [];
    });
  }

  function toTrack(v) {
    return {
      id: v.id, title: cleanTitle(v.title), artist: cleanArtist(v.channel),
      channelId: v.channelId || '', thumb: v.thumb || '', seconds: v.seconds || 0
    };
  }

  /** Search results carry no duration; one cheap /videos call fills them in. */
  function withDurations(tracks) {
    var need = tracks.filter(function (t) { return !t.seconds; }).map(function (t) { return t.id; });
    if (!need.length) return Promise.resolve(tracks);
    return api('/videos', { ids: need.slice(0, 40).join(',') }).then(function (items) {
      var by = {};
      items.forEach(function (v) { by[v.id] = v.seconds; });
      tracks.forEach(function (t) { if (by[t.id]) t.seconds = by[t.id]; });
      return tracks;
    }).catch(function () { return tracks; });
  }

  // ================================================================== app
  function launchMusic(args) {
    var win = WM.create({
      appId: 'music', title: 'Orion Music', icon: 'orionmusic',
      width: 1080, height: 720, minWidth: 640, minHeight: 460
    });

    var m = store();
    var page = (args && args.page) || 'home';
    var pageArg = null;
    var results = [], home = null, loading = false, error = null;

    // player state
    var queue = [], qIndex = -1, playing = false, ready = false;
    var position = 0, duration = 0, seeking = false;
    var player = null, poll = null;
    var pendingTrack = null;

    win.body.innerHTML =
      '<div class="mu">' +
        '<div class="mu-side">' +
          '<div class="mu-brand">' + Icons.get('orionmusic') + '<span>Orion Music</span></div>' +
          '<nav class="mu-nav">' +
            [['home', 'Home', 'home'], ['explore', 'Explore', 'explore'],
             ['search', 'Search', 'search'], ['library', 'Library', 'library']]
              .map(function (n) {
                return '<button class="mu-navitem" data-page="' + n[0] + '">' +
                  Icons.get(n[2]) + '<span>' + n[1] + '</span></button>';
              }).join('') +
          '</nav>' +
          '<div class="mu-plhead"><span>Playlists</span>' +
            '<button class="e-btn" data-act="newpl" title="New playlist">' + Icons.get('plus') + '</button></div>' +
          '<div class="mu-pllist" data-pllist></div>' +
        '</div>' +

        '<div class="mu-main">' +
          '<div class="mu-top">' +
            '<button class="e-btn" data-act="back" title="Back">' + Icons.get('back') + '</button>' +
            '<div class="mu-searchbox">' + Icons.get('search') +
              '<input class="mu-search" placeholder="Search songs, artists, albums" spellcheck="false">' +
            '</div>' +
            '<span style="flex:1"></span>' +
            '<button class="e-btn" data-act="queue" title="Queue">' + Icons.get('queue') + '</button>' +
          '</div>' +
          '<div class="mu-content" data-content></div>' +
        '</div>' +

        '<div class="mu-queue hidden" data-queue>' +
          '<div class="mu-qhead"><b>Queue</b>' +
            '<button class="e-btn" data-act="clearq" title="Clear">' + Icons.get('trash') + '</button>' +
            '<button class="e-btn" data-act="queue" title="Close">' + Icons.get('x') + '</button></div>' +
          '<div class="mu-qlist" data-qlist></div>' +
        '</div>' +

        '<div class="mu-player">' +
          '<div class="mu-np" data-np></div>' +
          '<div class="mu-transport">' +
            '<div class="mu-buttons">' +
              '<button class="mu-tb" data-act="shuffle" title="Shuffle">' + Icons.get('shuffle') + '</button>' +
              '<button class="mu-tb" data-act="prev" title="Previous">' + Icons.get('prev') + '</button>' +
              '<button class="mu-play" data-act="toggle" title="Play">' + Icons.get('playfill') + '</button>' +
              '<button class="mu-tb" data-act="next" title="Next">' + Icons.get('next') + '</button>' +
              '<button class="mu-tb" data-act="repeat" title="Repeat">' + Icons.get('repeat') + '</button>' +
            '</div>' +
            '<div class="mu-seekrow">' +
              '<span class="mu-t" data-cur>0:00</span>' +
              '<input class="mu-seek" type="range" min="0" max="1000" value="0">' +
              '<span class="mu-t" data-dur>0:00</span>' +
            '</div>' +
          '</div>' +
          '<div class="mu-right">' +
            '<button class="mu-tb" data-act="like" title="Like">' + Icons.get('heart') + '</button>' +
            '<span class="mu-vol">' + Icons.get('volume') +
              '<input class="mu-volume" type="range" min="0" max="100" value="' + m.volume + '">' +
            '</span>' +
          '</div>' +
        '</div>' +

        '<div class="mu-stage" data-stage></div>' +
      '</div>';

    var content = U.$('[data-content]', win.body);
    var searchIn = U.$('.mu-search', win.body);
    var npBox = U.$('[data-np]', win.body);
    var seek = U.$('.mu-seek', win.body);
    var curEl = U.$('[data-cur]', win.body);
    var durEl = U.$('[data-dur]', win.body);
    var qPanel = U.$('[data-queue]', win.body);
    var qList = U.$('[data-qlist]', win.body);
    var plList = U.$('[data-pllist]', win.body);
    var stage = U.$('[data-stage]', win.body);

    function current() { return queue[qIndex] || null; }

    /**
     * The tray slider is the master; this window's slider is the app level.
     * YouTube takes one number, so they are combined the way a mixer would.
     */
    function effectiveVolume() {
      return Math.round(store().volume * Emu.masterVolume());
    }
    function applyVolume() {
      if (!player || !ready) return;
      try { player.setVolume(effectiveVolume()); } catch (e) {}
    }

    // ------------------------------------------------------- the player
    /**
     * One iframe for the whole session. The IFrame API gives real transport
     * control - without it a music app cannot do next/seek/duration, only
     * "load a video and hope".
     */
    var readyCbs = [];

    function ensurePlayer(cb) {
      if (cb) {
        if (player && ready) { cb(); return; }
        readyCbs.push(cb);
      }
      if (player) return;          // building already, callback is queued

      var holder = document.createElement('div');
      holder.id = U.uid('ytm');
      stage.appendChild(holder);

      function build() {
        player = new global.YT.Player(holder.id, {
          height: '180', width: '320',
          playerVars: {
            autoplay: 1, controls: 0, disablekb: 1, modestbranding: 1,
            rel: 0, playsinline: 1, origin: location.origin
          },
          events: {
            onReady: function () {
              ready = true;
              try { player.setVolume(effectiveVolume()); } catch (e) {}
              readyCbs.splice(0).forEach(function (f) { try { f(); } catch (e) {} });
              if (pendingTrack) { var t = pendingTrack; pendingTrack = null; loadNow(t); }
            },
            onStateChange: function (e) {
              var S = global.YT.PlayerState;
              if (e.data === S.ENDED) { advance(1, true); return; }
              playing = e.data === S.PLAYING;
              if (playing) startPoll(); else stopPoll();
              renderPlayer();
            },
            onError: function () {
              // Region-locked or removed: skip rather than stall the queue.
              Emu.notify('Orion Music', 'That track would not play here — skipping.', 'orionmusic');
              advance(1, true);
            }
          }
        });
      }

      if (global.YT && global.YT.Player) { build(); return; }
      // load the API once for the whole page
      var prev = global.onYouTubeIframeAPIReady;
      global.onYouTubeIframeAPIReady = function () {
        if (prev) try { prev(); } catch (e) {}
        build();
      };
      if (!document.querySelector('script[data-ytapi]')) {
        var s = document.createElement('script');
        s.src = 'https://www.youtube.com/iframe_api';
        s.dataset.ytapi = '1';
        s.onerror = function () {
          error = 'YouTube could not be reached from this network.';
          renderPlayer();
        };
        document.head.appendChild(s);
      }
    }

    function startPoll() {
      stopPoll();
      poll = setInterval(function () {
        if (!player || !ready || seeking) return;
        try {
          position = player.getCurrentTime() || 0;
          duration = player.getDuration() || (current() ? current().seconds : 0);
        } catch (e) { return; }
        curEl.textContent = fmtTime(position);
        durEl.textContent = fmtTime(duration);
        seek.value = duration ? Math.round(position / duration * 1000) : 0;
      }, 500);
    }
    function stopPoll() { if (poll) { clearInterval(poll); poll = null; } }

    function loadNow(track) {
      if (!track) return;
      if (!player || !ready) { pendingTrack = track; ensurePlayer(); return; }
      try {
        player.loadVideoById(track.id);
        player.setVolume(effectiveVolume());
        playing = true;
      } catch (e) { /* player still warming up */ }
      pushRecent(track);
      renderPlayer();
      renderQueue();
    }

    function pushRecent(track) {
      var mm = store();
      mm.recent = mm.recent.filter(function (t) { return t.id !== track.id; });
      mm.recent.unshift({ id: track.id, title: track.title, artist: track.artist,
        thumb: track.thumb, seconds: track.seconds, ts: Date.now() });
      if (mm.recent.length > 60) mm.recent.length = 60;
      save();
    }

    /** Play a list from a given index; that list becomes the queue. */
    function playList(list, index) {
      if (!list || !list.length) return;
      queue = list.slice();
      qIndex = Math.max(0, Math.min(index || 0, queue.length - 1));
      ensurePlayer(function () { loadNow(current()); });
    }

    function advance(dir, auto) {
      var mm = store();
      if (!queue.length) return;
      if (auto && mm.repeat === 'one') { loadNow(current()); return; }
      if (mm.shuffle && queue.length > 1) {
        var n = qIndex;
        while (n === qIndex) n = Math.floor(Math.random() * queue.length);
        qIndex = n;
        loadNow(current());
        return;
      }
      var next = qIndex + dir;
      if (next >= queue.length) {
        if (mm.repeat === 'all') next = 0;
        else { playing = false; stopPoll(); renderPlayer(); return; }
      }
      if (next < 0) next = 0;
      qIndex = next;
      loadNow(current());
    }

    function toggle() {
      if (!current()) {
        // nothing cued: start whatever is on screen
        var list = currentPageList();
        if (list && list.length) playList(list, 0);
        return;
      }
      if (!player || !ready) { ensurePlayer(function () { loadNow(current()); }); return; }
      try {
        if (playing) player.pauseVideo(); else player.playVideo();
      } catch (e) {}
    }

    // ------------------------------------------------------------ render
    function isLiked(id) {
      return store().liked.some(function (t) { return t.id === id; });
    }

    function trackRow(t, i, opts) {
      opts = opts || {};
      var cur = current();
      var active = cur && cur.id === t.id;
      return '<div class="mu-row' + (active ? ' active' : '') + '" data-track="' + i +
        '" data-src="' + (opts.src || '') + '">' +
        '<span class="mu-rn">' + (active && playing ? Icons.get('sound') : (i + 1)) + '</span>' +
        '<span class="mu-art"><img src="' + U.esc(t.thumb) + '" alt="" loading="lazy"></span>' +
        '<span class="mu-meta"><b>' + U.esc(t.title) + '</b><small>' + U.esc(t.artist) + '</small></span>' +
        '<span class="mu-dur">' + (t.seconds ? fmtTime(t.seconds) : '') + '</span>' +
        '<span class="mu-rowacts">' +
          '<button class="e-btn" data-rowact="like" title="Like">' +
            Icons.get(isLiked(t.id) ? 'heartfill' : 'heart') + '</button>' +
          '<button class="e-btn" data-rowact="addpl" title="Add to playlist">' + Icons.get('plus') + '</button>' +
          '<button class="e-btn" data-rowact="queue" title="Play next">' + Icons.get('queue') + '</button>' +
          (opts.removable ? '<button class="e-btn" data-rowact="remove" title="Remove">' + Icons.get('x') + '</button>' : '') +
        '</span></div>';
    }

    function listMarkup(list, opts) {
      if (!list.length) return '<p class="mu-empty">Nothing here yet.</p>';
      return '<div class="mu-list">' + list.map(function (t, i) { return trackRow(t, i, opts); }).join('') + '</div>';
    }

    function renderPlaylists() {
      var mm = store();
      plList.innerHTML = '<button class="mu-pl' + (page === 'liked' ? ' active' : '') + '" data-open="liked">' +
          Icons.get('heartfill') + '<span>Liked songs</span><small>' + mm.liked.length + '</small></button>' +
        mm.playlists.map(function (p) {
          return '<button class="mu-pl' + (page === 'playlist' && pageArg === p.id ? ' active' : '') +
            '" data-open="pl:' + p.id + '">' + Icons.get('note') +
            '<span>' + U.esc(p.name) + '</span><small>' + p.tracks.length + '</small></button>';
        }).join('');
    }

    function header(title, sub, list, extra) {
      return '<div class="mu-header">' +
        '<div class="mu-hero">' + (list.length && list[0].thumb
          ? '<img src="' + U.esc(list[0].thumb) + '" alt="">' : Icons.get('note')) + '</div>' +
        '<div class="mu-hmeta"><small>' + U.esc(sub) + '</small><h2>' + U.esc(title) + '</h2>' +
        '<div class="mu-hacts">' +
          '<button class="btn primary" data-act="playall">' + Icons.get('playfill') + ' Play</button>' +
          '<button class="btn" data-act="shuffleall">' + Icons.get('shuffle') + ' Shuffle</button>' +
          (extra || '') +
        '</div></div></div>';
    }

    function render() {
      var keepScroll = content.scrollTop;
      drawContent();
      content.scrollTop = keepScroll;
    }

    function drawContent() {
      U.$$('.mu-navitem', win.body).forEach(function (n) {
        n.classList.toggle('active', n.dataset.page === page);
      });
      renderPlaylists();

      if (loading) { content.innerHTML = '<div class="mu-loading"><i></i><span>Loading…</span></div>'; return; }
      if (error) {
        content.innerHTML = '<div class="mu-err">' + Icons.get('warning') + '<b>' + U.esc(error) + '</b>' +
          '<button class="btn" data-act="retry">Try again</button></div>';
        return;
      }

      if (page === 'home') {
        var mm = store();
        var quick = mm.recent.slice(0, 8);
        content.innerHTML =
          (quick.length ? '<h3 class="mu-h">Pick up where you left off</h3>' +
            '<div class="mu-cards">' + quick.map(function (t, i) {
              return '<button class="mu-card" data-recent="' + i + '">' +
                '<span class="mu-cardart"><img src="' + U.esc(t.thumb) + '" alt=""></span>' +
                '<b>' + U.esc(t.title) + '</b><small>' + U.esc(t.artist) + '</small></button>';
            }).join('') + '</div>' : '') +
          '<h3 class="mu-h">Music charts</h3>' +
          (home && home.chart ? listMarkup(home.chart, { src: 'chart' })
            : '<div class="mu-loading"><i></i><span>Loading charts…</span></div>');
        return;
      }

      if (page === 'explore') {
        content.innerHTML = '<h3 class="mu-h">Explore</h3>' +
          '<div class="mu-genres">' + GENRES.map(function (g) {
            return '<button class="mu-genre" data-genre="' + U.esc(g.q) + '" style="--g:' + g.c + '">' +
              '<b>' + U.esc(g.name) + '</b></button>';
          }).join('') + '</div>' +
          (results.length ? '<h3 class="mu-h">' + U.esc(pageArg || '') + '</h3>' +
            listMarkup(results, { src: 'results' }) : '');
        return;
      }

      if (page === 'search') {
        content.innerHTML = results.length
          ? '<h3 class="mu-h">Results for “' + U.esc(pageArg || '') + '”</h3>' + listMarkup(results, { src: 'results' })
          : '<div class="mu-empty2">' + Icons.get('search') +
            '<b>Search Orion Music</b><span>Find a song, an artist or an album.</span></div>';
        return;
      }

      if (page === 'liked') {
        var liked = store().liked;
        content.innerHTML = header('Liked songs', 'Playlist · ' + liked.length + ' songs', liked) +
          listMarkup(liked, { src: 'liked', removable: true });
        return;
      }

      if (page === 'playlist') {
        var pl = store().playlists.filter(function (p) { return p.id === pageArg; })[0];
        if (!pl) { page = 'library'; return render(); }
        content.innerHTML = header(pl.name, 'Playlist · ' + pl.tracks.length + ' songs', pl.tracks,
            '<button class="btn" data-act="renamepl">Rename</button>' +
            '<button class="btn danger" data-act="delpl">Delete</button>') +
          listMarkup(pl.tracks, { src: 'pl', removable: true });
        return;
      }

      // library
      var mm2 = store();
      content.innerHTML = '<h3 class="mu-h">Your library</h3>' +
        '<div class="mu-cards">' +
          '<button class="mu-card" data-open="liked"><span class="mu-cardart alt">' +
            Icons.get('heartfill') + '</span><b>Liked songs</b><small>' + mm2.liked.length + ' songs</small></button>' +
          mm2.playlists.map(function (p) {
            return '<button class="mu-card" data-open="pl:' + p.id + '">' +
              '<span class="mu-cardart' + (p.tracks[0] ? '' : ' alt') + '">' +
              (p.tracks[0] ? '<img src="' + U.esc(p.tracks[0].thumb) + '" alt="">' : Icons.get('note')) +
              '</span><b>' + U.esc(p.name) + '</b><small>' + p.tracks.length + ' songs</small></button>';
          }).join('') +
          '<button class="mu-card mu-cardnew" data-act="newpl"><span class="mu-cardart alt">' +
            Icons.get('plus') + '</span><b>New playlist</b><small>Start an empty one</small></button>' +
        '</div>' +
        (mm2.recent.length ? '<h3 class="mu-h">Recently played</h3>' +
          listMarkup(mm2.recent.slice(0, 25), { src: 'recent' }) : '');
    }

    function renderPlayer() {
      var t = current();
      var mm = store();
      npBox.innerHTML = t
        ? '<span class="mu-npart"><img src="' + U.esc(t.thumb) + '" alt=""></span>' +
          '<span class="mu-npmeta"><b>' + U.esc(t.title) + '</b><small>' + U.esc(t.artist) + '</small></span>'
        : '<span class="mu-npart alt">' + Icons.get('note') + '</span>' +
          '<span class="mu-npmeta"><b>Nothing playing</b><small>Pick a song to start</small></span>';

      U.$('[data-act="toggle"]', win.body).innerHTML = Icons.get(playing ? 'pause' : 'playfill');
      U.$('[data-act="toggle"]', win.body).title = playing ? 'Pause' : 'Play';
      U.$('[data-act="shuffle"]', win.body).classList.toggle('on', !!mm.shuffle);
      var rp = U.$('[data-act="repeat"]', win.body);
      rp.innerHTML = Icons.get(mm.repeat === 'one' ? 'repeatone' : 'repeat');
      rp.classList.toggle('on', mm.repeat !== 'off');
      rp.title = 'Repeat: ' + mm.repeat;
      var lk = U.$('[data-act="like"]', win.body);
      lk.innerHTML = Icons.get(t && isLiked(t.id) ? 'heartfill' : 'heart');
      lk.classList.toggle('on', !!(t && isLiked(t.id)));
      if (!playing) { curEl.textContent = fmtTime(position); durEl.textContent = fmtTime(duration || (t ? t.seconds : 0)); }

      // redraw the list so the playing row is highlighted, without losing
      // the reader's place in a long chart
      render();
    }

    function renderQueue() {
      qList.innerHTML = queue.length
        ? queue.map(function (t, i) {
            return '<div class="mu-qrow' + (i === qIndex ? ' active' : '') + '" data-q="' + i + '">' +
              '<span class="mu-art small"><img src="' + U.esc(t.thumb) + '" alt=""></span>' +
              '<span class="mu-meta"><b>' + U.esc(t.title) + '</b><small>' + U.esc(t.artist) + '</small></span>' +
              '<button class="e-btn" data-qdel="' + i + '" title="Remove">' + Icons.get('x') + '</button></div>';
          }).join('')
        : '<p class="mu-empty">The queue is empty.</p>';
    }

    var GENRES = [
      { name: 'Pop', q: 'pop hits', c: '#ec4899' },
      { name: 'Hip-hop', q: 'hip hop hits', c: '#f59e0b' },
      { name: 'Rock', q: 'rock anthems', c: '#ef4444' },
      { name: 'Electronic', q: 'electronic dance music', c: '#22d3ee' },
      { name: 'R&B', q: 'rnb soul', c: '#a855f7' },
      { name: 'Country', q: 'country hits', c: '#84cc16' },
      { name: 'Latin', q: 'latin hits', c: '#fb7185' },
      { name: 'Jazz', q: 'jazz classics', c: '#38bdf8' },
      { name: 'Classical', q: 'classical music', c: '#94a3b8' },
      { name: 'Lo-fi', q: 'lofi beats', c: '#34d399' },
      { name: 'Metal', q: 'metal', c: '#64748b' },
      { name: 'Indie', q: 'indie music', c: '#c084fc' }
    ];

    // ------------------------------------------------------------- data
    function loadHome() {
      if (home) { render(); return; }
      loading = true; error = null; render();
      api('/popular', { category: MUSIC_CATEGORY, max: 30 }).then(function (items) {
        home = { chart: items.map(toTrack) };
        loading = false;
        render();
      }).catch(function (e) {
        loading = false;
        error = 'Could not load the charts: ' + e.message;
        render();
      });
    }

    function doSearch(q, label, target) {
      if (!q.trim()) return;
      loading = true; error = null; page = target || 'search'; pageArg = label || q; render();
      api('/search', { q: q + ' music', category: MUSIC_CATEGORY, max: 30 })
        .then(function (items) { return withDurations(items.map(toTrack)); })
        .then(function (list) {
          results = list;
          loading = false;
          render();
        }).catch(function (e) {
          loading = false;
          error = 'Search failed: ' + e.message;
          render();
        });
    }

    // ---------------------------------------------------- track sources
    function listFor(src) {
      var mm = store();
      if (src === 'chart') return (home && home.chart) || [];
      if (src === 'results') return results;
      if (src === 'liked') return mm.liked;
      if (src === 'recent') return mm.recent;
      if (src === 'pl') {
        var pl = mm.playlists.filter(function (p) { return p.id === pageArg; })[0];
        return pl ? pl.tracks : [];
      }
      return [];
    }

    function currentPageList() {
      if (page === 'liked') return store().liked;
      if (page === 'playlist') return listFor('pl');
      if (page === 'search' || page === 'explore') return results;
      return (home && home.chart) || [];
    }

    // ------------------------------------------------------- playlist ui
    function addToPlaylist(track) {
      var mm = store();
      var back = U.el('<div class="dlg-backdrop"><div class="dlg">' +
        '<h3>Add to playlist</h3><div class="dlg-body"><div class="of-picker">' +
        mm.playlists.map(function (p) {
          return '<button class="of-pick" data-pl="' + p.id + '">' + Icons.get('note') +
            '<span>' + U.esc(p.name) + '</span><small>' + p.tracks.length + '</small></button>';
        }).join('') +
        '<button class="of-pick" data-pl="__new"><span style="width:18px">' + Icons.get('plus') +
          '</span><span>New playlist…</span></button>' +
        '</div></div><div class="dlg-actions"><button data-x>Cancel</button></div></div></div>');
      win.el.appendChild(back);
      back.addEventListener('click', function (e) {
        if (e.target.closest('[data-x]')) { back.remove(); return; }
        var b = e.target.closest('[data-pl]');
        if (!b) return;
        back.remove();
        if (b.dataset.pl === '__new') {
          WM.prompt('Orion Music', 'Name the new playlist', 'My playlist', win).then(function (n) {
            if (!n) return;
            var pl = { id: U.uid('pl'), name: n, tracks: [track], created: Date.now() };
            store().playlists.push(pl);
            save(); render();
            Emu.notify('Orion Music', '"' + track.title + '" added to ' + n + '.', 'orionmusic');
          });
          return;
        }
        var pl = store().playlists.filter(function (p) { return p.id === b.dataset.pl; })[0];
        if (!pl) return;
        if (pl.tracks.some(function (t) { return t.id === track.id; })) {
          Emu.notify('Orion Music', 'Already in ' + pl.name + '.', 'orionmusic');
          return;
        }
        pl.tracks.push(track);
        save(); render();
        Emu.notify('Orion Music', '"' + track.title + '" added to ' + pl.name + '.', 'orionmusic');
      });
    }

    function newPlaylist() {
      WM.prompt('Orion Music', 'Name the new playlist', 'My playlist', win).then(function (n) {
        if (!n) return;
        var pl = { id: U.uid('pl'), name: n, tracks: [], created: Date.now() };
        store().playlists.push(pl);
        save();
        page = 'playlist'; pageArg = pl.id;
        render();
      });
    }

    // ----------------------------------------------------------- events
    win.body.addEventListener('click', function (e) {
      var nav = e.target.closest('[data-page]');
      if (nav) {
        page = nav.dataset.page;
        if (page === 'home') loadHome();
        else if (page === 'search') { render(); searchIn.focus(); }
        else render();
        return;
      }

      var open = e.target.closest('[data-open]');
      if (open) {
        var v = open.dataset.open;
        if (v === 'liked') { page = 'liked'; pageArg = null; }
        else { page = 'playlist'; pageArg = v.slice(3); }
        render();
        return;
      }

      var g = e.target.closest('[data-genre]');
      if (g) { doSearch(g.dataset.genre, g.querySelector('b').textContent, 'explore'); return; }

      var rec = e.target.closest('[data-recent]');
      if (rec) { playList(store().recent, parseInt(rec.dataset.recent, 10)); return; }

      var qrow = e.target.closest('[data-qdel]');
      if (qrow) {
        var qi = parseInt(qrow.dataset.qdel, 10);
        queue.splice(qi, 1);
        if (qi < qIndex) qIndex--;
        else if (qi === qIndex) { qIndex = Math.min(qIndex, queue.length - 1); loadNow(current()); }
        renderQueue();
        return;
      }
      var qsel = e.target.closest('[data-q]');
      if (qsel) { qIndex = parseInt(qsel.dataset.q, 10); loadNow(current()); return; }

      // row buttons first, then the row itself
      var ra = e.target.closest('[data-rowact]');
      if (ra) {
        var row = ra.closest('[data-track]');
        var list = listFor(row.dataset.src);
        var idx = parseInt(row.dataset.track, 10);
        var tr = list[idx];
        if (!tr) return;
        var kind = ra.dataset.rowact;
        if (kind === 'like') { toggleLike(tr); return; }
        if (kind === 'addpl') { addToPlaylist(tr); return; }
        if (kind === 'queue') {
          if (!queue.length) { playList([tr], 0); return; }
          queue.splice(qIndex + 1, 0, tr);
          renderQueue();
          Emu.notify('Orion Music', '"' + tr.title + '" plays next.', 'orionmusic');
          return;
        }
        if (kind === 'remove') {
          if (row.dataset.src === 'liked') {
            store().liked.splice(idx, 1);
          } else if (row.dataset.src === 'pl') {
            var pl = store().playlists.filter(function (p) { return p.id === pageArg; })[0];
            if (pl) pl.tracks.splice(idx, 1);
          }
          save(); render();
          return;
        }
        return;
      }

      var trow = e.target.closest('[data-track]');
      if (trow) {
        var l = listFor(trow.dataset.src);
        playList(l, parseInt(trow.dataset.track, 10));
        return;
      }

      var act = e.target.closest('[data-act]');
      if (!act) return;
      var k = act.dataset.act;
      var mm = store();

      if (k === 'toggle') toggle();
      else if (k === 'next') advance(1);
      else if (k === 'prev') {
        if (position > 3 && player && ready) { try { player.seekTo(0); } catch (e2) {} }
        else advance(-1);
      }
      else if (k === 'shuffle') { mm.shuffle = !mm.shuffle; save(); renderPlayer(); }
      else if (k === 'repeat') {
        mm.repeat = mm.repeat === 'off' ? 'all' : mm.repeat === 'all' ? 'one' : 'off';
        save(); renderPlayer();
      }
      else if (k === 'like') { var c = current(); if (c) toggleLike(c); }
      else if (k === 'queue') {
        // the grid has to reflow to make room, so the state lives on .mu
        var open = qPanel.classList.toggle('hidden');
        U.$('.mu', win.body).classList.toggle('q-open', !open);
        renderQueue();
      }
      else if (k === 'clearq') { queue = []; qIndex = -1; renderQueue(); }
      else if (k === 'newpl') newPlaylist();
      else if (k === 'retry') { error = null; home = null; loadHome(); }
      else if (k === 'back') { page = 'home'; loadHome(); }
      else if (k === 'playall') playList(currentPageList(), 0);
      else if (k === 'shuffleall') {
        var src = currentPageList().slice();
        for (var i = src.length - 1; i > 0; i--) {
          var j = Math.floor(Math.random() * (i + 1)), tmp = src[i]; src[i] = src[j]; src[j] = tmp;
        }
        mm.shuffle = true; save();
        playList(src, 0);
      }
      else if (k === 'renamepl') {
        var p2 = mm.playlists.filter(function (p) { return p.id === pageArg; })[0];
        if (!p2) return;
        WM.prompt('Orion Music', 'Rename playlist', p2.name, win).then(function (n) {
          if (!n) return;
          p2.name = n; save(); render();
        });
      }
      else if (k === 'delpl') {
        var p3 = mm.playlists.filter(function (p) { return p.id === pageArg; })[0];
        if (!p3) return;
        WM.confirm('Orion Music', 'Delete the playlist "' + p3.name + '"?', win).then(function (ok) {
          if (!ok) return;
          mm.playlists = mm.playlists.filter(function (p) { return p.id !== p3.id; });
          save();
          page = 'library'; pageArg = null;
          render();
        });
      }
    });

    function toggleLike(track) {
      var mm = store();
      if (isLiked(track.id)) {
        mm.liked = mm.liked.filter(function (t) { return t.id !== track.id; });
      } else {
        mm.liked.unshift({ id: track.id, title: track.title, artist: track.artist,
          thumb: track.thumb, seconds: track.seconds });
      }
      save();
      renderPlayer();
    }

    searchIn.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      doSearch(searchIn.value, searchIn.value, 'search');
    });

    seek.addEventListener('pointerdown', function () { seeking = true; });
    seek.addEventListener('change', function () {
      seeking = false;
      if (!player || !ready || !duration) return;
      try { player.seekTo(duration * (seek.value / 1000), true); } catch (e) {}
    });
    seek.addEventListener('input', function () {
      if (duration) curEl.textContent = fmtTime(duration * (seek.value / 1000));
    });

    U.$('.mu-volume', win.body).addEventListener('input', function (e) {
      var mm = store();
      mm.volume = parseInt(e.target.value, 10);
      save();
      if (player && ready) { applyVolume(); }
    });

    // Space toggles playback unless you are typing.
    var onKey = function (e) {
      if (WM.focused !== win) return;
      if (e.target.matches('input, textarea, [contenteditable]')) return;
      if (e.code === 'Space') { e.preventDefault(); toggle(); }
      else if (e.key === 'MediaTrackNext') advance(1);
      else if (e.key === 'MediaTrackPrevious') advance(-1);
    };
    document.addEventListener('keydown', onKey);

    // The tray slider is the master, so follow it while a track is playing.
    var onMaster = Emu.on('volume', applyVolume);

    win.onClose = function () {
      stopPoll();
      Emu.off('volume', onMaster);
      document.removeEventListener('keydown', onKey);
      try { if (player && player.destroy) player.destroy(); } catch (e) {}
      player = null;
    };

    renderPlayer();
    renderQueue();
    loadHome();
    if (args && args.q) doSearch(args.q, args.q, 'search');
    return win;
  }

  Emu.registerApp({
    id: 'music', name: 'Orion Music', icon: 'orionmusic', pinned: true,
    desc: 'Songs, playlists and your library', singleton: true,
    launch: launchMusic
  });
})(window);
