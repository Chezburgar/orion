/* ===== Installing Orion as an app =====
   Chrome fires beforeinstallprompt when a page qualifies; that event is the
   only way to show the install dialog, and it can only be used once, so it is
   captured here and handed out on request. Where it never fires (Firefox,
   iOS Safari, or an install that already happened) the UI falls back to
   telling the user where the browser's own menu item lives.              */
(function (global) {
  'use strict';

  var Emu = global.Emu;
  var deferred = null;

  global.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferred = e;
    Emu.emit('install:available');
  });

  global.addEventListener('appinstalled', function () {
    deferred = null;
    Emu.state.installedApp = true;
    Emu.save();
    Emu.emit('install:done');
    Emu.notify('Orion', 'Orion is installed. It opens in its own window from now on.', 'orion');
  });

  function standalone() {
    return (global.matchMedia && global.matchMedia('(display-mode: standalone)').matches) ||
      global.navigator.standalone === true;
  }

  /** Which manual route to describe when there is no prompt to show. */
  function manualHint() {
    var ua = navigator.userAgent;
    if (/CrOS/.test(ua)) {
      return 'In Chrome on ChromeOS: the ⋮ menu (top right) → Cast, save and share → Install page as app.';
    }
    if (/Edg\//.test(ua)) {
      return 'In Edge: the … menu (top right) → Apps → Install this site as an app.';
    }
    if (/iPhone|iPad|iPod/.test(ua)) {
      return 'In Safari: the Share button → Add to Home Screen.';
    }
    if (/Firefox\//.test(ua)) {
      return 'Firefox on desktop cannot install web apps. Chrome, Edge or Brave can — or just bookmark this page.';
    }
    if (/Chrome\//.test(ua)) {
      return 'In Chrome: the ⋮ menu (top right) → Cast, save and share → Install page as app. ' +
        'An install icon also appears at the right of the address bar.';
    }
    return 'Look for "Install" or "Add to Home Screen" in your browser\'s menu.';
  }

  var Install = {
    /** true once the browser has offered us a prompt to fire. */
    available: function () { return !!deferred; },
    installed: function () { return standalone() || !!Emu.state.installedApp; },
    hint: manualHint,

    /**
     * Show the browser's install dialog. Resolves 'accepted', 'dismissed',
     * 'unavailable' or 'installed' - never rejects, so callers can just
     * render the outcome.
     */
    prompt: function () {
      if (standalone()) return Promise.resolve('installed');
      if (!deferred) return Promise.resolve('unavailable');
      var e = deferred;
      deferred = null;                    // a prompt event is single use
      e.prompt();
      return e.userChoice.then(function (c) {
        return c && c.outcome === 'accepted' ? 'accepted' : 'dismissed';
      }).catch(function () { return 'dismissed'; });
    },

    /**
     * Registering the worker is what makes the browser consider Orion
     * installable at all. It is inert - see sw.js.
     */
    register: function () {
      if (!('serviceWorker' in navigator)) return;
      if (location.protocol === 'file:') return;
      var url = new URL('sw.js', document.baseURI).href;
      navigator.serviceWorker.register(url, { scope: './' }).catch(function (err) {
        console.warn('[orion] install worker not registered:', err.message);
      });
    }
  };

  global.Install = Install;
})(window);
