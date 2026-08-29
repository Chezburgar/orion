/* ===== Boot the emulator ===== */
(function (global) {
  'use strict';

  var Emu = global.Emu, WM = global.WM, Shell = global.Shell, VFS = global.VFS;

  Emu.clipboard = null;

  /** Launch an app by id. Apps decide whether to reuse an existing window. */
  Emu.launch = function (appId, args) {
    var app = Emu.apps[appId];
    if (!app) {
      Emu.notify('Windows', 'The app "' + appId + '" is not installed.', 'warning');
      return null;
    }
    if (app.singleton) {
      var existing = WM.byApp(appId)[0];
      if (existing) {
        WM.unminimize(existing);
        existing.focus();
        return existing;
      }
    }
    return app.launch(args);
  };

  /**
   * GitHub Pages caches index.html, so a browser can keep running an old
   * build long after a deploy. version.json is always fetched fresh; if it
   * names a newer build, reload once through a changed URL so the cached
   * HTML is bypassed. The session guard stops any reload loop.
   */
  function checkForUpdate() {
    fetch('version.json?cb=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (v) {
        if (!v || !v.build || v.build === Emu.BUILD) return;
        var seen = null;
        try { seen = sessionStorage.getItem('orion.reloadedFor'); } catch (e) {}
        if (seen === v.build) {
          Emu.notify('Orion update', 'Version ' + v.build + ' is available but this tab is still on ' +
            Emu.BUILD + '. Try a hard refresh.', 'update', { action: { do: 'app:reload' } });
          return;
        }
        try { sessionStorage.setItem('orion.reloadedFor', v.build); } catch (e) {}
        location.replace(location.pathname + '?b=' + encodeURIComponent(v.build));
      })
      .catch(function () { /* offline is fine */ });
  }

  function start() {
    // Custom logos replace an app's built-in icon everywhere it is drawn.
    Object.keys(Emu.state.appIcons || {}).forEach(function (id) {
      if (Emu.apps[id]) Emu.apps[id].icon = Emu.state.appIcons[id];
    });

    Emu.applyTheme();
    Shell.init();
    checkForUpdate();
    Emu.onNotifAction('app:reload', function () {
      location.replace(location.pathname + '?b=' + Date.now());
    });

    // Nothing starts until this device is allowed in.
    global.Auth.gate().then(function () {
      Shell.boot();
      global.Auth.watch();
      if (global.AccessApp) global.AccessApp.syncVisibility();
    });

    // Suppress the native browser menu so the emulated one is the only one.
    document.addEventListener('contextmenu', function (e) {
      if (e.target.closest('input, textarea, .np-area, .term-in')) return;
      if (e.defaultPrevented) return;
      e.preventDefault();
    });

    // Welcome notifications, once the desktop is actually visible.
    setTimeout(function () {
      if (!Emu.state.notifications.length) {
        Emu.notify('Welcome to Orion',
          'Press the Windows key for Start, or open Microsoft Edge to browse. Right-click the desktop for more.', 'info');
        setTimeout(function () {
          Emu.notify('Microsoft Edge', 'Tip: visit docs.emu inside Edge for every shortcut and feature.', 'edge');
        }, 6000);
      }
    }, 4200);

    global.addEventListener('beforeunload', function () {
      try { localStorage.setItem('win11emu.state.v1', JSON.stringify(Emu.state)); } catch (e) {}
    });

    if (!VFS.exists(VFS.DESKTOP)) VFS.mkdir(VFS.DESKTOP);

    // Bring the tunnel up automatically if the user asked for that.
    if (Emu.state.net.autoConnect && !Emu.state.net.connected) {
      setTimeout(function () { global.Net.connect(); }, 3000);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else start();
})(window);
