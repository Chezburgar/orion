/* ===== Full screen =====
   Orion wants the whole display, but no browser will let a page go full
   screen on load - it must happen inside a real user gesture. So the first
   click or key press after Orion starts is used as that gesture (which in
   practice is the click that dismisses the lock screen), and Ctrl+Alt+F toggles it
   any time after.                                                          */
(function (global) {
  'use strict';

  var Emu = global.Emu;
  var armed = false;
  var warned = false;

  function el() { return document.documentElement; }

  function active() {
    return !!(document.fullscreenElement || document.webkitFullscreenElement);
  }

  function supported() {
    return !!(el().requestFullscreen || el().webkitRequestFullscreen);
  }

  function enter() {
    if (active()) return Promise.resolve(true);
    var e = el();
    var fn = e.requestFullscreen || e.webkitRequestFullscreen;
    if (!fn) return Promise.resolve(false);
    try {
      var r = fn.call(e, { navigationUI: 'hide' });
      return (r && r.then ? r : Promise.resolve()).then(function () { return true; },
        function () { return false; });
    } catch (err) {
      return Promise.resolve(false);
    }
  }

  function exit() {
    if (!active()) return Promise.resolve(true);
    var fn = document.exitFullscreen || document.webkitExitFullscreen;
    if (!fn) return Promise.resolve(false);
    try {
      var r = fn.call(document);
      return (r && r.then ? r : Promise.resolve()).then(function () { return true; },
        function () { return false; });
    } catch (err) { return Promise.resolve(false); }
  }

  function toggle() { return active() ? exit() : enter(); }

  /**
   * A page cannot request full screen on load, only from a gesture. Listen
   * once for whichever comes first and use it; the lock screen means there is
   * always one coming.
   */
  function armAuto() {
    if (armed) return;
    armed = true;

    function fire() {
      disarm();
      if (!Emu.state.autoFullscreen) return;
      // An installed app still gets a window frame - on ChromeOS it opens in a
      // normal app window with a title bar - so it needs the request too. This
      // used to bail out here, which is why installing it stopped it filling
      // the screen.
      enter().then(function (ok) {
        if (ok || warned) return;
        warned = true;
        // F11 first: it is the browser's own full screen and is not subject to
        // the page permission that just refused us.
        Emu.notify('Full screen',
          'This browser blocked Orion from going full screen on its own. Press F11 to fill the display — ' +
          'Ctrl+Alt+F toggles it too, where the browser allows it.', 'monitor');
      });
    }
    function disarm() {
      ['pointerdown', 'keydown', 'touchend'].forEach(function (ev) {
        document.removeEventListener(ev, fire, true);
      });
    }
    ['pointerdown', 'keydown', 'touchend'].forEach(function (ev) {
      document.addEventListener(ev, fire, true);
    });
  }

  function isStandalone() {
    return (global.matchMedia && global.matchMedia('(display-mode: standalone)').matches) ||
      global.navigator.standalone === true;
  }

  // Ctrl+Alt+F toggles. Registered in the capture phase so a focused text
  // field in an app cannot swallow it. Alt+F alone is left to the apps - it
  // is a common in-app "File menu" chord.
  document.addEventListener('keydown', function (e) {
    if (!e.ctrlKey || !e.altKey || e.metaKey) return;
    if (String(e.key).toLowerCase() !== 'f') return;
    e.preventDefault();
    e.stopPropagation();
    toggle();
  }, true);

  document.addEventListener('fullscreenchange', function () {
    document.documentElement.classList.toggle('is-fullscreen', active());
    Emu.emit('fullscreen', active());
  });

  global.Fullscreen = {
    enter: enter, exit: exit, toggle: toggle,
    active: active, supported: supported, armAuto: armAuto,
    standalone: isStandalone
  };
})(window);
