/* ===== Google Chrome =====
   A plain iframe pointing at Google. No fetching, no rewriting, no proxy -
   the page loads straight from Google into the frame.

   Google only allows itself to be embedded through the "igu=1" homepage, so
   that is the home page and searches are run through it. Most other sites
   send X-Frame-Options and simply refuse to appear in a frame; nothing can
   be done about that from a page, so the toolbar offers to open those in a
   real browser tab instead.                                              */
(function (global) {
  'use strict';

  var Emu = global.Emu, U = Emu.util, Icons = global.Icons, WM = global.WM;

  var HOME = 'https://www.google.com/webhp?igu=1';

  function searchUrl(q) {
    return 'https://www.google.com/search?q=' + encodeURIComponent(q);
  }

  /** Is this an address to load, or words to search for? */
  function isAddress(s) {
    return /^https?:\/\//i.test(s) ||
      /^[\w-]+(\.[\w-]+)+(\/|$|\?|#|:)/.test(s) ||
      /^localhost(:|\/|$)/.test(s);
  }

  /** Turn whatever was typed into something loadable. */
  function toUrl(input) {
    var s = String(input || '').trim();
    if (!s) return HOME;
    if (/^https?:\/\//i.test(s)) return s;
    if (isAddress(s)) return 'https://' + s;
    return searchUrl(s);
  }

  /** What to show in the address bar - the home page reads as plain google.com. */
  function pretty(url) {
    return url === HOME ? 'google.com' : url;
  }

  function launchChrome(opts) {
    opts = opts || {};

    var win = WM.create({
      appId: 'edge', title: 'Google Chrome', icon: 'chrome',
      width: 1100, height: 720, minWidth: 460, minHeight: 320
    });

    win.body.innerHTML =
        '<div class="cr">' +
          '<div class="cr-bar">' +
            '<button class="e-btn" data-nav="back" data-tip="Back">' + Icons.get('back') + '</button>' +
            '<button class="e-btn" data-nav="fwd" data-tip="Forward">' + Icons.get('forward') + '</button>' +
            '<button class="e-btn" data-nav="reload" data-tip="Reload">' + Icons.get('refresh') + '</button>' +
            '<button class="e-btn" data-nav="home" data-tip="Google">' + Icons.get('home') + '</button>' +
            '<div class="cr-omni">' + Icons.get('search') +
              '<input class="cr-url" type="text" spellcheck="false" ' +
                'placeholder="Search Google or type a web address">' +
            '</div>' +
            '<button class="e-btn" data-nav="pop" data-tip="Open in a real browser tab">' +
              Icons.get('forward') + '</button>' +
          '</div>' +
          '<div class="cr-stage"><iframe class="cr-frame" title="Google Chrome"></iframe></div>' +
          '<div class="cr-note" hidden>' +
            '<span></span><button class="btn sm" data-nav="pop">Open in a new tab</button>' +
            '<button class="e-btn" data-nav="dismiss">' + Icons.get('x') + '</button>' +
          '</div>' +
        '</div>';

    var root  = win.body.querySelector('.cr');
    var frame = root.querySelector('.cr-frame');
    var omni  = root.querySelector('.cr-url');
    var note  = root.querySelector('.cr-note');

    // Our own history. An iframe's real history is cross-origin and cannot be
    // read or driven from here, so only the pages we set are tracked.
    var hist = [], at = -1;

    function go(url, push) {
      url = toUrl(url);
      if (push !== false) {
        hist = hist.slice(0, at + 1);
        hist.push(url);
        at = hist.length - 1;
      }
      frame.src = url;
      omni.value = pretty(url);
      hint(url);
      paint();
    }

    function paint() {
      root.querySelector('[data-nav="back"]').disabled = at <= 0;
      root.querySelector('[data-nav="fwd"]').disabled = at >= hist.length - 1;
    }

    // Google's home page is the one thing that reliably embeds - "igu=1" is
    // the variant that permits it. Its results pages, and most other sites,
    // send X-Frame-Options and come out blank with no error a page can catch,
    // so say so up front rather than leaving an empty white rectangle.
    function hint(url) {
      var safe = url === HOME;
      note.hidden = safe;
      if (!safe) {
        note.querySelector('span').textContent =
          'Sites can refuse to be shown inside another page, and this one may come ' +
          'up blank. Open it in a tab to see it properly.';
      }
    }

    function search(q) {
      q = String(q || '').trim();
      if (!q) return;
      omni.value = q;
      // Google will not render results in a frame, so this has to leave.
      global.open(searchUrl(q), '_blank', 'noopener');
      note.hidden = false;
      note.querySelector('span').textContent =
        'Google will not show search results inside another page, so “' + q +
        '” opened in a real browser tab.';
    }

    root.addEventListener('click', function (e) {
      var b = e.target.closest('[data-nav]');
      if (!b) return;
      var a = b.dataset.nav;
      if (a === 'back' && at > 0) { at--; go(hist[at], false); }
      else if (a === 'fwd' && at < hist.length - 1) { at++; go(hist[at], false); }
      else if (a === 'reload') { frame.src = 'about:blank'; setTimeout(function () { frame.src = hist[at] || HOME; }, 0); }
      else if (a === 'home') go(HOME, true);
      else if (a === 'pop') global.open(hist[at] || HOME, '_blank', 'noopener');
      else if (a === 'dismiss') note.hidden = true;
    });

    omni.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      var v = omni.value.trim();
      if (!v) return;
      if (isAddress(v)) go(v, true); else search(v);
    });
    omni.addEventListener('focus', function () { omni.select(); });

    go(opts.url || HOME, true);

    win.data.edge = {
      openUrl: function (u) { go(u, true); win.focus(); },
      navigate: function (u) { go(u, true); win.focus(); },
      search: function (q) { win.focus(); search(q); }
    };
    return win;
  }

  function reuse(fn, arg) {
    var existing = WM.byApp('edge')[0];
    if (existing && existing.data.edge) { existing.data.edge[fn](arg); return existing; }
    var win = launchChrome(fn === 'search' ? {} : { url: arg });
    if (fn === 'search') win.data.edge.search(arg);
    return win;
  }

  Emu.registerApp({
    id: 'edge', name: 'Google Chrome', icon: 'chrome', pinned: true,
    desc: 'Browse the web',
    launch: launchChrome,
    open:   function (url) { return reuse('openUrl', url); },
    search: function (q)   { return reuse('search', q); }
  });

  Emu.EdgeIndex = [];
})(window);
