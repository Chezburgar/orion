/* ===== Desktop shell: boot, lock, taskbar, Start, flyouts, Task View ===== */
(function (global) {
  'use strict';

  var Emu = global.Emu, U = Emu.util, Icons = global.Icons, WM = global.WM, VFS = global.VFS;
  var $ = U.$, $$ = U.$$;

  var els = {};
  var openFlyout = null;
  var allApps = false;
  var calMonth = new Date();
  var desks = [{ name: 'Desktop 1' }];
  var activeDesk = 0;

  var Shell = {
    desk: 0,

    /**
     * Swap the shell between the Windows and Mac layouts. Only chrome
     * changes - every app, window and setting is identical either way, so
     * this is a class on <html> plus the extra Mac menu bar.
     */
    setUiStyle: function (style, quiet) {
      style = style === 'mac' ? 'mac' : 'win';
      Emu.state.ui = style;
      document.documentElement.setAttribute('data-ui', style);
      if (!quiet) Emu.save();
      syncMacBar();
      Emu.emit('ui', style);
      return style;
    },
    uiStyle: function () { return Emu.state.ui === 'mac' ? 'mac' : 'win'; },

    init: function () {
      els = {
        desktop: $('#desktop'), boot: $('#boot'), lock: $('#lock'),
        taskbar: $('#taskbar'), tbLeft: $('#tbLeft'), tbCenter: $('#tbCenter'),
        start: $('#startMenu'), search: $('#searchPanel'), widgets: $('#widgetsPanel'),
        quick: $('#quickPanel'), notif: $('#notifPanel'), taskView: $('#taskView'),
        icons: $('#iconLayer'), menu: $('#contextMenu'), toasts: $('#toastLayer'),
        power: $('#powerOverlay')
      };

      WM.init();
      Shell.setUiStyle(Emu.state.ui || 'win', true);
      buildTaskbar();
      buildStart();
      renderIcons();
      wireTray();
      wireGlobalEvents();
      tickClock();
      setInterval(tickClock, 1000);

      Emu.on('win:open', function (w) { w.desk = activeDesk; syncTaskbar(); syncMacBar(); });
      Emu.on('win:close', function () { syncTaskbar(); syncMacBar(); });
      Emu.on('win:focus', function () { syncTaskbar(); syncMacBar(); });
      Emu.on('win:change', syncTaskbar);
      Emu.on('user', syncMacBar);
      wireMacBar();
      Emu.on('vfs', function (p) { if (!p || p === VFS.DESKTOP) renderIcons(); });
      Emu.on('notify', function (n) { toast(n); syncBadge(); });
      Emu.on('notify:changed', function () { if (openFlyout === 'notif') renderNotifs(); syncBadge(); });
      Emu.on('user', function () { buildStart(); });
      Emu.on('theme', function () { renderIcons(); });
      Emu.on('apps', function () { buildStart(); syncTaskbar(); });
      Emu.on('net', syncMacStatus);

      // Live device state, rather than the numbers the tray used to invent.
      initPower();
      ['online', 'offline'].forEach(function (ev) {
        window.addEventListener(ev, function () {
          renderQuick();
          Emu.notify('Network', navigator.onLine ? 'Back online.' : 'This device lost its internet connection.',
            navigator.onLine ? 'wifi' : 'warning');
        });
      });
      if (navigator.connection && navigator.connection.addEventListener) {
        navigator.connection.addEventListener('change', renderQuick);
      }
    },

    // ---------------------------------------------------------- boot/lock
    boot: function () {
      setTimeout(function () {
        els.boot.classList.add('hidden');
        Shell.lock();
      }, 2100);
    },

    lock: function () {
      closeFlyouts();
      els.lock.classList.remove('hidden', 'lifting');
      updateLockClock();
      els.desktop.classList.add('hidden');
    },

    unlock: function () {
      els.lock.classList.add('lifting');
      els.desktop.classList.remove('hidden');
      setTimeout(function () {
        els.lock.classList.add('hidden');
        Emu.emit('shell:ready');
      }, 450);
    },

    shutdown: function (mode) {
      closeFlyouts();
      $('#powerText').textContent = mode === 'restart' ? 'Restarting' : mode === 'sleep' ? 'Sleeping' : 'Shutting down';
      els.power.classList.remove('hidden');
      setTimeout(function () {
        if (mode === 'sleep') {
          els.power.classList.add('hidden');
          Shell.lock();
          return;
        }
        if (mode === 'restart') {
          els.power.classList.add('hidden');
          els.boot.classList.remove('hidden');
          WM.closeAll();
          Shell.boot();
          return;
        }
        $('#powerText').textContent = 'It is now safe to close this tab.';
        $('.boot-spinner', els.power).classList.add('hidden');
      }, mode === 'sleep' ? 900 : 1800);
    },

    // ------------------------------------------------------- context menu
    contextMenu: function (items, x, y) {
      var menu = els.menu;
      menu.innerHTML = '';
      items.filter(Boolean).forEach(function (it) {
        if (it.sep) { menu.appendChild(U.el('<div class="cm-sep"></div>')); return; }
        var row = U.el('<div class="cm-item' + (it.disabled ? ' disabled' : '') + '">' +
          (it.icon ? Icons.get(it.icon) : '<span style="width:16px"></span>') +
          '<span>' + U.esc(it.label) + '</span>' +
          (it.key ? '<span class="key">' + U.esc(it.key) + '</span>' : '') + '</div>');
        row.addEventListener('click', function () {
          hideMenu();
          if (it.action) it.action();
        });
        menu.appendChild(row);
      });
      menu.classList.remove('hidden');
      var r = menu.getBoundingClientRect();
      var maxX = window.innerWidth - r.width - 8;
      var maxY = window.innerHeight - r.height - 8;
      menu.style.left = U.clamp(x, 8, Math.max(8, maxX)) + 'px';
      menu.style.top = U.clamp(y, 8, Math.max(8, maxY)) + 'px';
    },

    /** Simple list chooser used as a stand-in for common file dialogs. */
    picker: function (title, items) {
      return new Promise(function (resolve) {
        var back = U.el('<div class="dlg-backdrop"><div class="dlg"><h3>' + U.esc(title) + '</h3>' +
          '<div class="dlg-body" style="max-height:320px;overflow:auto"></div>' +
          '<div class="dlg-actions"><button>Cancel</button></div></div></div>');
        var body = $('.dlg-body', back);
        if (!items.length) body.innerHTML = '<p class="muted">Nothing to show.</p>';
        items.forEach(function (it) {
          var row = U.el('<div class="sr">' + Icons.get(it.icon || 'file') +
            '<div><b>' + U.esc(it.label) + '</b><small>' + U.esc(it.sub || '') + '</small></div></div>');
          row.addEventListener('click', function () { back.remove(); resolve(it.value); });
          body.appendChild(row);
        });
        $('.dlg-actions button', back).addEventListener('click', function () { back.remove(); resolve(null); });
        els.desktop.appendChild(back);
      });
    },

    toast: function (n) { toast(n); },
    closeFlyouts: closeFlyouts,
    renderIcons: renderIcons
  };

  // ------------------------------------------------------------- taskbar
  function pinnedApps() {
    return Emu.appOrder.filter(function (id) { return Emu.apps[id].pinned && !Emu.apps[id].hidden; });
  }

  /**
   * The taskbar used native title= tooltips, and syncTaskbar() replaces the
   * whole strip whenever a window opens, focuses or closes. That destroys the
   * button the tooltip belongs to without ever firing a mouseleave, so the
   * browser leaves the label stranded on screen. Orion draws its own instead,
   * and hides it on every rebuild.
   */
  var tipEl = null, tipFor = null, tipGuard = null;

  function showTip(btn) {
    var text = btn && btn.dataset.tip;
    if (!text) return hideTip();
    if (!tipEl) {
      tipEl = U.el('<div class="tb-tip" role="tooltip"></div>');
      els.desktop.appendChild(tipEl);
    }
    tipFor = btn;
    // Whatever the label is attached to can be thrown away by a re-render at
    // any moment - the Store rebuilds its tiles while installing, Start
    // rebuilds on every app change. Rather than chase each caller, watch the
    // element itself and drop the label the moment it leaves the document.
    clearInterval(tipGuard);
    tipGuard = setInterval(function () {
      if (!tipFor || !tipFor.isConnected) hideTip();
    }, 150);
    tipEl.textContent = text;
    tipEl.classList.add('on');
    var r = btn.getBoundingClientRect();
    var t = tipEl.getBoundingClientRect();
    var left = U.clamp(r.left + r.width / 2 - t.width / 2, 8, window.innerWidth - t.width - 8);
    var above = r.top > t.height + 14;
    tipEl.style.left = Math.round(left) + 'px';
    tipEl.style.top = Math.round(above ? r.top - t.height - 10 : r.bottom + 10) + 'px';
  }

  function hideTip() {
    tipFor = null;
    clearInterval(tipGuard);
    tipGuard = null;
    if (tipEl) tipEl.classList.remove('on');
  }

  /**
   * Delegated on the document, so anything anywhere in Orion gets a label by
   * adding data-tip. Native title= is deliberately avoided on anything that
   * re-renders: the browser strands the bubble when the element it belongs to
   * is replaced without a mouseleave.
   */
  function wireTips() {
    document.addEventListener('pointerover', function (e) {
      var b = e.target.closest && e.target.closest('[data-tip]');
      if (b !== tipFor) b ? showTip(b) : hideTip();
    }, true);
    ['pointerdown', 'wheel', 'keydown'].forEach(function (ev) {
      document.addEventListener(ev, hideTip, true);
    });
    window.addEventListener('blur', hideTip);
    document.addEventListener('visibilitychange', hideTip);
  }

  function buildTaskbar() {
    els.tbLeft.innerHTML =
      '<button class="tb-btn" data-tb="widgets" data-tip="Widgets (Win+W)">' + Icons.get('widgets') + '</button>';
    syncTaskbar();
    wireTips();

    els.taskbar.addEventListener('click', function (e) {
      var b = e.target.closest('[data-tb]');
      if (!b) return;
      var k = b.dataset.tb;
      if (k === 'start') toggleFlyout('start');
      else if (k === 'search') { toggleFlyout('search'); if (openFlyout === 'search') $('#searchInput').focus(); }
      else if (k === 'taskview') toggleTaskView();
      else if (k === 'widgets') toggleFlyout('widgets');
      else if (k === 'app') appButton(b.dataset.app);
    });

    els.taskbar.addEventListener('contextmenu', function (e) {
      var b = e.target.closest('[data-app]');
      if (!b) return;
      e.preventDefault();
      var id = b.dataset.app, app = Emu.apps[id];
      var running = WM.byApp(id).length;
      Shell.contextMenu([
        { label: app.name, icon: app.icon, action: function () { Emu.launch(id); } },
        { sep: true },
        { label: app.pinned ? 'Unpin from taskbar' : 'Pin to taskbar', icon: 'pin', action: function () {
          app.pinned = !app.pinned; syncTaskbar(); buildStart();
        } },
        { label: 'Close all windows', icon: 'x', disabled: !running, action: function () { WM.closeAll(id); } }
      ], e.clientX, e.clientY - 8);
    });

    // hover previews
    var hoverEl = null;
    els.taskbar.addEventListener('pointerover', function (e) {
      var b = e.target.closest('[data-app]');
      if (!b) return;
      var wins = WM.byApp(b.dataset.app).filter(onDesk);
      if (!wins.length) return;
      hoverEl = U.el('<div class="tb-preview">' + wins.map(function (w) {
        return U.esc(w.title);
      }).join('<br>') + '</div>');
      els.desktop.appendChild(hoverEl);
      var r = b.getBoundingClientRect();
      hoverEl.style.left = Math.max(8, r.left + r.width / 2 - hoverEl.offsetWidth / 2) + 'px';
    });
    els.taskbar.addEventListener('pointerout', function () {
      if (hoverEl) { hoverEl.remove(); hoverEl = null; }
    });
  }

  function onDesk(w) { return w.desk === activeDesk; }

  function syncTaskbar() {
    var running = {};
    WM.list().filter(onDesk).forEach(function (w) { running[w.appId] = true; });
    var ids = pinnedApps().slice();
    Object.keys(running).forEach(function (id) { if (ids.indexOf(id) < 0) ids.push(id); });

    var focusedApp = WM.focused && !WM.focused.minimized ? WM.focused.appId : null;
    var html = '<button class="tb-btn start-btn' + (openFlyout === 'start' ? ' open' : '') +
      '" data-tb="start" data-tip="Start (Win)">' + Icons.start() + '</button>' +
      '<button class="tb-btn" data-tb="search" data-tip="Search (Win+S)">' + Icons.get('search') + '</button>' +
      '<button class="tb-btn" data-tb="taskview" data-tip="Task view (Win+Tab)">' + Icons.get('taskview') + '</button>';

    ids.forEach(function (id) {
      var app = Emu.apps[id];
      if (!app) return;
      var wins = WM.byApp(id).filter(onDesk);
      html += '<button class="tb-btn' + (wins.length ? ' running' : '') + (focusedApp === id ? ' active-win' : '') +
        '" data-tb="app" data-app="' + id + '" data-tip="' + U.esc(app.name) + '">' +
        Icons.get(app.icon) + '<span class="ind"></span></button>';
    });
    els.tbCenter.innerHTML = html;
    // The buttons just went away and came back; any label about one of them
    // is now pointing at an element that no longer exists.
    hideTip();
  }

  function appButton(id) {
    var wins = WM.byApp(id).filter(onDesk);
    if (!wins.length) return Emu.launch(id);
    if (wins.length === 1) {
      var w = wins[0];
      if (w.minimized) WM.unminimize(w);
      else if (WM.focused === w) w.minimize();
      else w.focus();
      return;
    }
    var idx = wins.indexOf(WM.focused);
    var next = wins[(idx + 1) % wins.length];
    if (next.minimized) WM.unminimize(next); else next.focus();
  }

  // --------------------------------------------------------------- Start
  function buildStart() {
    var pinnedGrid = $('#startPinned');
    var q = ($('#startSearch').value || '').toLowerCase();
    var visible = Emu.appOrder.filter(function (id) { return !Emu.apps[id].hidden; });
    var startList = visible.filter(function (id) {
      return Emu.apps[id].pinned || Emu.apps[id].startPinned;
    });
    var ids = (allApps ? visible : startList).filter(function (id) {
      return !q || Emu.apps[id].name.toLowerCase().indexOf(q) >= 0;
    });
    pinnedGrid.innerHTML = ids.map(function (id) {
      var a = Emu.apps[id];
      return '<div class="start-app" data-app="' + id + '" data-tip="' + U.esc(a.desc || a.name) + '">' +
        Icons.get(a.icon) + '<span>' + U.esc(a.name) + '</span></div>';
    }).join('') || '<p class="muted" style="grid-column:1/-1;padding:12px">No apps match.</p>';
    $('[data-all-apps]').innerHTML = allApps ? '&lsaquo; Back' : 'All apps &rsaquo;';
    $('.start-user span:last-child').textContent = Emu.state.user;
    renderRecommended();
  }

  function renderRecommended() {
    var host = $('#startRecommended');
    var items = Emu.state.recent.slice(0, 6);
    if (!items.length) {
      items = [
        { name: 'Read me first.txt', path: VFS.DESKTOP + '\\Read me first.txt', app: 'notepad' },
        { name: 'Notes.txt', path: VFS.HOME + '\\Documents\\Notes.txt', app: 'notepad' }
      ].filter(function (i) { return VFS.exists(i.path); });
    }
    host.innerHTML = items.map(function (r) {
      return '<div class="rec" data-open="' + U.esc(r.path) + '" data-app="' + U.esc(r.app || 'notepad') + '">' +
        Icons.get('filetext') + '<div class="rec-txt"><b>' + U.esc(r.name) + '</b>' +
        '<small>' + (r.ts ? U.fmtAgo(r.ts) : VFS.parentOf(r.path)) + '</small></div></div>';
    }).join('') || '<p class="muted" style="padding:8px">Nothing recent yet.</p>';
    $('#recSection').classList.toggle('hidden', !items.length);
  }

  function wireStart() {
    els.start.addEventListener('click', function (e) {
      var app = e.target.closest('.start-app');
      if (app) { Emu.launch(app.dataset.app); closeFlyouts(); return; }
      var rec = e.target.closest('[data-open]');
      if (rec) { Emu.launch(rec.dataset.app, { path: rec.dataset.open }); closeFlyouts(); return; }
      if (e.target.closest('[data-all-apps]')) { allApps = !allApps; buildStart(); return; }
      if (e.target.closest('.start-user')) { Emu.launch('settings', { page: 'accounts' }); closeFlyouts(); return; }
      if (e.target.closest('#powerBtn')) {
        var r = e.target.closest('#powerBtn').getBoundingClientRect();
        Shell.contextMenu([
          { label: 'Sleep', icon: 'moon', action: function () { Shell.shutdown('sleep'); } },
          { label: 'Shut down', icon: 'power', action: function () { Shell.shutdown('off'); } },
          { label: 'Restart', icon: 'refresh', action: function () { Shell.shutdown('restart'); } },
          { sep: true },
          { label: 'Lock', icon: 'lock', action: function () { Shell.lock(); } },
          { label: 'Reset emulator data', icon: 'trash', action: function () {
            WM.confirm('Reset', 'Delete all emulator files and settings from this browser?')
              .then(function (ok) { if (ok) Emu.reset(); });
          } }
        ], r.left - 60, r.top - 190);
      }
    });
    $('#startSearch').addEventListener('input', buildStart);
    $('#startSearch').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        var first = $('.start-app', els.start);
        if (first) { Emu.launch(first.dataset.app); closeFlyouts(); }
      }
    });
  }

  // -------------------------------------------------------------- search
  function runSearch() {
    var q = $('#searchInput').value.trim();
    var host = $('#searchResults');
    if (!q) {
      host.innerHTML = '<div class="sr-group">Top apps</div>' + pinnedApps().slice(0, 6).map(function (id) {
        var a = Emu.apps[id];
        return '<div class="sr" data-app="' + id + '">' + Icons.get(a.icon) +
          '<div><b>' + U.esc(a.name) + '</b><small>' + U.esc(a.desc || 'App') + '</small></div></div>';
      }).join('');
      return;
    }
    var lower = q.toLowerCase();
    var apps = Emu.appOrder.filter(function (id) {
      return !Emu.apps[id].hidden && Emu.apps[id].name.toLowerCase().indexOf(lower) >= 0;
    });
    var files = VFS.search(VFS.HOME, q, 8);
    var html = '';
    if (apps.length) {
      html += '<div class="sr-group">Apps</div>' + apps.map(function (id) {
        var a = Emu.apps[id];
        return '<div class="sr" data-app="' + id + '">' + Icons.get(a.icon) +
          '<div><b>' + U.esc(a.name) + '</b><small>' + U.esc(a.desc || 'App') + '</small></div></div>';
      }).join('');
    }
    if (files.length) {
      html += '<div class="sr-group">Documents</div>' + files.map(function (f) {
        return '<div class="sr" data-file="' + U.esc(f.path) + '" data-type="' + f.node.type + '">' +
          Icons.get(f.node.type === 'dir' ? 'folder' : 'filetext') +
          '<div><b>' + U.esc(f.name) + '</b><small>' + U.esc(VFS.parentOf(f.path)) + '</small></div></div>';
      }).join('');
    }
    html += '<div class="sr-group">Web</div>' +
      '<div class="sr" data-web="' + U.esc(q) + '">' + Icons.get('edge') +
      '<div><b>' + U.esc(q) + '</b><small>Search the web in Google Chrome</small></div></div>';
    if (!apps.length && !files.length) html += '<div class="sr-empty">No local results for “' + U.esc(q) + '”.</div>';
    host.innerHTML = html;
  }

  function wireSearch() {
    $('#searchInput').addEventListener('input', U.debounce(runSearch, 140));
    els.search.addEventListener('click', function (e) {
      var row = e.target.closest('.sr');
      if (!row) return;
      if (row.dataset.app) Emu.launch(row.dataset.app);
      else if (row.dataset.file) {
        if (row.dataset.type === 'dir') Emu.launch('explorer', { path: row.dataset.file });
        else Emu.launch('notepad', { path: row.dataset.file });
      } else if (row.dataset.web) {
        Emu.apps.edge.open('https://bing.local/search?q=' + encodeURIComponent(row.dataset.web));
      }
      closeFlyouts();
    });
  }

  // ------------------------------------------------------------- widgets
  function renderWidgets() {
    var t = 18 + (new Date().getHours() % 9);
    els.widgets.innerHTML =
      '<div class="widget"><h4>Weather</h4><div class="w-temp">' + t + '&deg;</div>' +
      '<div class="w-row"><span>Partly cloudy</span></div>' +
      '<div class="w-row"><span>Simulated</span><span>' + (t + 3) + '&deg; / ' + (t - 8) + '&deg;</span></div></div>' +
      '<div class="widget"><h4>System</h4>' +
      '<div class="w-row"><span>Windows</span><span>11 Emulator</span></div>' +
      '<div class="w-row"><span>Apps open</span><span>' + WM.list().length + '</span></div>' +
      '<div class="w-row"><span>Disk (C:)</span><span>' + U.fmtBytes(VFS.sizeOf(VFS.get('C:'))) + '</span></div>' +
      '<div class="w-row"><span>Battery</span><span>100%</span></div></div>' +
      '<div class="widget wide"><h4>Top stories</h4>' +
      [['Browser-based desktop hits 60 fps', 'Orion News'],
       ['Everything you can do in this emulator', 'Docs'],
       ['Minesweeper record broken again', 'Orion Games']].map(function (n) {
        return '<div class="w-news" data-news="' + U.esc(n[1]) + '"><i></i><div><b>' + U.esc(n[0]) + '</b>' +
          '<div class="muted" style="font-size:11px">' + U.esc(n[1]) + '</div></div></div>';
      }).join('') + '</div>' +
      '<div class="widget wide"><h4>Tips</h4><div class="w-row"><span>Drag a window to the top edge to maximize it, ' +
      'or hover the maximize button for Snap Layouts.</span></div></div>';
  }

  function wireWidgets() {
    els.widgets.addEventListener('click', function (e) {
      var n = e.target.closest('[data-news]');
      if (n) {
        var map = { 'Orion News': 'https://news.emu', 'Docs': 'https://docs.emu', 'Orion Games': 'https://games.emu' };
        Emu.apps.edge.open(map[n.dataset.news] || 'https://news.emu');
        closeFlyouts();
      }
    });
  }

  // ------------------------------------------------------- quick settings
  var QUICK_TILES = [
    { k: 'wifi', name: 'Wi-Fi', icon: 'wifi' },
    { k: 'bluetooth', name: 'Bluetooth', icon: 'bluetooth' },
    { k: 'airplane', name: 'Aeroplane mode', icon: 'airplane' },
    { k: 'saver', name: 'Battery saver', icon: 'battery' },
    { k: 'night', name: 'Night light', icon: 'night' },
    { k: 'cast', name: 'Cast', icon: 'cast' }
  ];

  // ---------------------------------------------------------- real power
  // The tray used to print a hardcoded "100% - Plugged in". These read the
  // actual device where the browser exposes it, and say so plainly when it
  // does not, rather than inventing a number.
  var power = { level: null, charging: false, supported: false };

  function initPower() {
    if (!navigator.getBattery) { renderQuick(); return; }
    navigator.getBattery().then(function (b) {
      power.supported = true;
      function upd() {
        power.level = Math.round(b.level * 100);
        power.charging = !!b.charging;
        renderQuick();
        syncMacStatus();
      }
      ['levelchange', 'chargingchange'].forEach(function (ev) { b.addEventListener(ev, upd); });
      upd();
    }).catch(function () { renderQuick(); });
  }

  /** Battery glyph whose fill tracks the real charge level. */
  function batteryGlyph() {
    var lvl = power.supported && power.level != null ? power.level : 100;
    var w = Math.max(1.5, 13 * lvl / 100);
    var fill = power.charging ? '#34d399' : lvl <= 15 ? '#f87171' : lvl <= 30 ? '#fbbf24' : 'currentColor';
    return '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" ' +
      'stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
      '<rect x="2" y="7.6" width="17" height="8.8" rx="2.2"/>' +
      '<path d="M21.2 10.6v2.8"/>' +
      '<rect x="4" y="9.6" width="' + w.toFixed(1) + '" height="4.8" rx="1" fill="' + fill + '" stroke="none"/>' +
      (power.charging
        ? '<path d="M12.6 7.4 8.8 13h2.9l-.7 3.8 4-5.8h-3z" fill="#fff" stroke="var(--layer-solid)" stroke-width="1.1"/>'
        : '') + '</svg>';
  }

  function powerText() {
    if (!power.supported || power.level == null) {
      return Emu.state.quick.saver ? 'Battery saver on' : 'No battery reported - on mains power';
    }
    return power.level + '%' + (power.charging ? ' - charging' : ' - on battery') +
      (Emu.state.quick.saver ? ' - saver on' : '');
  }

  /** Real connectivity, not the simulated Wi-Fi switch. */
  function online() { return navigator.onLine !== false; }

  function netIconName() {
    if (!online()) return 'globe';
    if (!Emu.state.quick.wifi) return 'airplane';
    return 'wifi';
  }

  function netText() {
    if (!online()) return 'No internet connection';
    var c = navigator.connection || {};
    var kind = c.effectiveType ? ' - ' + c.effectiveType.toUpperCase() : '';
    return (Emu.state.quick.wifi ? 'Connected' : 'Wi-Fi off (still online)') + kind;
  }

  function renderQuick() {
    var s = Emu.state;
    $('#quickGrid').innerHTML = QUICK_TILES.map(function (t) {
      return '<div class="q-tile' + (s.quick[t.k] ? ' on' : '') + '" data-q="' + t.k + '">' +
        (t.k === 'saver' ? batteryGlyph() : Icons.get(t.k === 'wifi' ? netIconName() : t.icon)) +
        '<span>' + t.name + '</span></div>';
    }).join('');
    $('#volumeSlider').value = s.volume;
    $('#volumeVal').textContent = s.volume;
    $('#brightSlider').value = s.brightness;
    $('#brightVal').textContent = s.brightness;
    $$('.qs-ico', els.quick).forEach(function (el) { el.innerHTML = Icons.get(el.dataset.ico); });
    $$('[data-ico]', $('#taskbar')).forEach(function (el) {
      var name = el.dataset.ico;
      if (name === 'battery') { el.innerHTML = batteryGlyph(); return; }
      if (name === 'wifi') name = netIconName();
      if (name === 'volume' && s.volume === 0) name = 'mute';
      el.innerHTML = Icons.get(name);
    });
    var tq = $('#trayQuick');
    if (tq) tq.dataset.tip = [netText(), powerText(), 'Volume ' + s.volume + '%'].join(' · ');
    $('#batteryText').textContent = powerText();
    syncMacStatus();
  }

  function wireQuick() {
    els.quick.addEventListener('click', function (e) {
      var t = e.target.closest('[data-q]');
      if (t) {
        var k = t.dataset.q;
        Emu.state.quick[k] = !Emu.state.quick[k];
        if (k === 'airplane' && Emu.state.quick.airplane) {
          Emu.state.quick.wifi = false;
          Emu.state.quick.bluetooth = false;
        }
        if (k === 'night') document.getElementById('wallpaper').style.filter =
          Emu.state.quick.night ? 'sepia(.35) saturate(1.2)' : '';
        Emu.save();
        renderQuick();
        Emu.emit('quick');
        Emu.notify('Quick settings', QUICK_TILES.filter(function (x) { return x.k === k; })[0].name +
          ' turned ' + (Emu.state.quick[k] ? 'on' : 'off') + '.', 'gear');
        return;
      }
      if (e.target.closest('[data-open-settings]')) { Emu.launch('settings'); closeFlyouts(); }
    });
    $('#volumeSlider').addEventListener('input', function () {
      Emu.state.volume = +this.value;
      $('#volumeVal').textContent = this.value;
      Emu.save();
      Emu.applyVolume();
      renderQuick();
    });
    $('#brightSlider').addEventListener('input', function () {
      Emu.state.brightness = +this.value;
      $('#brightVal').textContent = this.value;
      Emu.save();
      Emu.applyTheme();
    });
    $('[data-open-settings]').innerHTML = Icons.get('gear');
  }

  // ------------------------------------------------ notifications + clock
  function notifButtons(n) {
    if (!n.buttons || !n.buttons.length) return '';
    return '<div class="notif-actions">' + n.buttons.map(function (b, i) {
      return '<button class="btn' + (b.primary ? ' primary' : '') + '" data-nbtn="' + i + '">' +
        U.esc(b.label) + '</button>';
    }).join('') + '</div>';
  }

  function renderNotifs() {
    var list = Emu.state.notifications;
    $('#notifList').innerHTML = list.length ? list.map(function (n) {
      return '<div class="notif' + (n.action ? ' actionable' : '') + '" data-n="' + n.id + '">' +
        '<b>' + U.esc(n.title) + '</b>' +
        '<p>' + U.esc(n.body) + '</p>' +
        notifButtons(n) +
        '<div class="muted" style="font-size:11px;margin-top:6px">' + U.fmtAgo(n.ts) + '</div>' +
        '<button class="x" data-dismiss="' + n.id + '">' + Icons.get('x') + '</button></div>';
    }).join('') : '<div class="notif-empty">No new notifications</div>';
    renderCalendar();
    syncBadge();
  }

  function renderCalendar() {
    var d = new Date(calMonth.getFullYear(), calMonth.getMonth(), 1);
    var today = new Date();
    $('#calTitle').textContent = d.toLocaleDateString([], { month: 'long', year: 'numeric' });
    var first = d.getDay(), days = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    var prevDays = new Date(d.getFullYear(), d.getMonth(), 0).getDate();
    var html = ['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(function (x) {
      return '<div class="dow">' + x + '</div>';
    }).join('');
    for (var i = 0; i < first; i++) html += '<div class="day other">' + (prevDays - first + i + 1) + '</div>';
    for (var n = 1; n <= days; n++) {
      var isToday = n === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
      html += '<div class="day' + (isToday ? ' today' : '') + '">' + n + '</div>';
    }
    var trailing = (7 - ((first + days) % 7)) % 7;
    for (var t = 1; t <= trailing; t++) html += '<div class="day other">' + t + '</div>';
    $('#calGrid').innerHTML = html;
  }

  function syncBadge() {
    var badge = $('#notifBadge');
    var n = Emu.state.notifications.length;
    badge.textContent = n > 9 ? '9+' : n;
    badge.classList.toggle('hidden', !n);
    $('#trayBell').innerHTML = Icons.get('bell') + badge.outerHTML;
  }

  function wireNotifs() {
    els.notif.addEventListener('click', function (e) {
      var d = e.target.closest('[data-dismiss]');
      if (d) {
        Emu.state.notifications = Emu.state.notifications.filter(function (n) { return n.id !== d.dataset.dismiss; });
        Emu.save(); renderNotifs(); return;
      }
      if (e.target.closest('#clearNotifs')) { Emu.state.notifications = []; Emu.save(); renderNotifs(); }

      var btn = e.target.closest('[data-nbtn]');
      if (btn) {
        var row = btn.closest('[data-n]');
        var n = Emu.state.notifications.filter(function (x) { return x.id === row.dataset.n; })[0];
        if (n) {
          var spec = (n.buttons || [])[+btn.dataset.nbtn];
          if (spec) Emu.runNotifAction(spec.action);
          Emu.dismissNotif(n.id);
        }
        renderNotifs();
        return;
      }
      var card = e.target.closest('.notif.actionable');
      if (card) {
        var nn = Emu.state.notifications.filter(function (x) { return x.id === card.dataset.n; })[0];
        if (nn && Emu.runNotifAction(nn.action)) closeFlyouts();
        return;
      }
      if (e.target.closest('#calPrev')) { calMonth.setMonth(calMonth.getMonth() - 1); renderCalendar(); }
      if (e.target.closest('#calNext')) { calMonth.setMonth(calMonth.getMonth() + 1); renderCalendar(); }
    });
    $('#calPrev').innerHTML = Icons.get('chevronLeft');
    $('#calNext').innerHTML = Icons.get('chevronRight');
  }

  function toast(n) {
    var app = Emu.apps[n.icon];
    var el = U.el('<div class="toast' + (n.action ? ' actionable' : '') + '">' +
      Icons.get(app ? app.icon : n.icon) +
      '<div><b>' + U.esc(n.title) + '</b><p>' + U.esc(n.body) + '</p>' +
      notifButtons(n) + '</div></div>');
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-nbtn]');
      if (b) {
        e.stopPropagation();
        var btn = (n.buttons || [])[+b.dataset.nbtn];
        if (btn) Emu.runNotifAction(btn.action);
        Emu.dismissNotif(n.id);
        el.remove();
        return;
      }
      if (n.action) { Emu.runNotifAction(n.action); closeFlyouts(); }
      el.remove();
    });
    els.toasts.appendChild(el);
    // A toast you are meant to act on needs longer than one you just read.
    setTimeout(function () {
      el.classList.add('out');
      setTimeout(function () { el.remove(); }, 240);
    }, n.buttons && n.buttons.length ? 15000 : 4600);
  }

  function tickClock() {
    var now = new Date();
    $('#clockTime').textContent = U.fmtTime(now);
    $('#clockDate').textContent = U.fmtShortDate(now);
    var mc = $('#macClock');
    if (mc) mc.textContent = now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) +
      '  ' + U.fmtTime(now);
    if (!els.lock.classList.contains('hidden')) updateLockClock(now);
  }

  /** The Mac menu bar names the focused app; it is inert in Windows style. */
  function syncMacBar() {
    var name = $('#macAppName');
    if (!name) return;
    var w = WM.focused;
    name.textContent = w && Emu.apps[w.appId] ? Emu.apps[w.appId].name : 'Orion';
    var owner = $('#macUser');
    if (owner) owner.textContent = Emu.state.user || 'Orion';
    syncMacStatus();
  }

  /**
   * A Mac keeps status in the menu bar, not the dock. Putting battery, network
   * and volume up here is also what stops the dock's right end being cramped -
   * the whole tray is hidden there in this style.
   */
  function syncMacStatus() {
    var box = $('#macStatus');
    if (!box) return;
    var s = Emu.state;
    box.innerHTML = batteryGlyph() +
      (power.supported && power.level != null ? '<b>' + power.level + '%</b>' : '') +
      Icons.get(netIconName()) +
      Icons.get(s.volume === 0 ? 'mute' : 'volume');
    box.title = [netText(), powerText(), 'Volume ' + s.volume + '%'].join(' · ');
  }

  /**
   * The Mac bar reuses the same panels as the Windows tray - there is one
   * set of quick settings and one notification centre, drawn in both skins.
   */
  function wireMacBar() {
    var bar = $('#macBar');
    if (!bar) return;
    { var ico = { search: 'search', quick: 'wifi', bell: 'bell', settings: 'gear' };
      Object.keys(ico).forEach(function (k) {
        var b = bar.querySelector('[data-mb="' + k + '"]');
        if (b) b.innerHTML = Icons.get(ico[k]);
      }); }
    bar.addEventListener('click', function (e) {
      var b = e.target.closest('[data-mb]');
      if (!b) return;
      var k = b.dataset.mb;
      if (k === 'orion') toggleFlyout('start');
      else if (k === 'quick') toggleFlyout('quick');
      else if (k === 'bell') { toggleFlyout('notif'); if (openFlyout === 'notif') renderNotifs(); }
      else if (k === 'search') { toggleFlyout('search'); if (openFlyout === 'search') $('#searchInput').focus(); }
      else if (k === 'settings') { closeFlyouts(); Emu.launch('settings'); }
      else if (k === 'close' && WM.focused) WM.focused.close();
      else if (k === 'min' && WM.focused) WM.minimize(WM.focused);
    });
  }

  function updateLockClock(now) {
    now = now || new Date();
    $('#lockTime').textContent = U.fmtTime(now);
    $('#lockDate').textContent = U.fmtLongDate(now);
    $('.lock-name').textContent = Emu.state.user;
  }

  function wireTray() {
    $('#trayQuick').addEventListener('click', function () { toggleFlyout('quick'); });
    $('#trayClock').addEventListener('click', function () { toggleFlyout('notif'); });
    $('#trayBell').addEventListener('click', function () { toggleFlyout('notif'); });
    $('#trayChevron').innerHTML = Icons.get('chevronUp');
    $('#trayChevron').addEventListener('click', function (e) {
      Shell.contextMenu([
        { label: 'Orion Security', icon: 'shield', action: function () { Emu.launch('settings', { page: 'privacy' }); } },
        { label: 'Task Manager', icon: 'taskmgr', action: function () { Emu.launch('taskmgr'); } },
        { label: 'Terminal', icon: 'terminal', action: function () { Emu.launch('terminal'); } }
      ], e.clientX - 100, e.clientY - 130);
    });
    $('#showDesktop').addEventListener('click', function () { WM.minimizeAll(); });
    wireQuick();
    wireNotifs();
    wireStart();
    wireSearch();
    wireWidgets();
    renderQuick();
    renderNotifs();
  }

  // ------------------------------------------------------- desktop icons
  function renderIcons() {
    var items = [
      { name: 'This PC', icon: 'thispc', act: function () { Emu.launch('explorer', { path: 'C:' }); } },
      { name: 'Recycle Bin', icon: 'recycle', act: function () {
        Emu.notify('Recycle Bin', 'The Recycle Bin is empty.', 'recycle');
      } }
    ];
    VFS.list(VFS.DESKTOP).forEach(function (e) {
      var icon = e.node.type === 'dir' ? 'folder'
        : e.node.type === 'app' ? ((Emu.apps[e.node.app] || {}).icon || 'file')
        : (/^(png|jpe?g|gif|svg|webp|img)$/.test(e.node.ext || '') ? 'fileimg' : 'filetext');
      items.push({
        name: e.name.replace(/\.txt$/i, ''), icon: icon, path: e.path, node: e.node,
        act: function () {
          if (e.node.type === 'dir') Emu.launch('explorer', { path: e.path });
          else if (e.node.type === 'app') Emu.launch(e.node.app, e.node.args);
          else if (/^(png|jpe?g|gif|svg|webp|img)$/.test(e.node.ext || '')) Emu.launch('photos', { path: e.path });
          else { Emu.launch('notepad', { path: e.path }); Emu.pushRecent({ name: e.name, path: e.path, app: 'notepad' }); }
        }
      });
    });

    els.icons.innerHTML = items.map(function (it, i) {
      return '<div class="d-icon" data-i="' + i + '"' + (it.path ? ' data-path="' + U.esc(it.path) + '"' : '') + '>' +
        Icons.get(it.icon) + '<span>' + U.esc(it.name) + '</span></div>';
    }).join('');
    els.icons._items = items;
  }

  function wireIcons() {
    // Single click selects, double click opens - the dblclick event alone,
    // so a real double click cannot also trip a manual click-timer and
    // launch the app twice.
    els.icons.addEventListener('click', function (e) {
      var ic = e.target.closest('.d-icon');
      $$('.d-icon', els.icons).forEach(function (x) { x.classList.remove('selected'); });
      if (ic) ic.classList.add('selected');
    });
    els.icons.addEventListener('dblclick', function (e) {
      var ic = e.target.closest('.d-icon');
      if (!ic) return;
      var item = els.icons._items[+ic.dataset.i];
      if (item) item.act();
    });
    // Enter opens whatever is selected, like Explorer.
    els.icons.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      var sel = $('.d-icon.selected', els.icons);
      if (sel) els.icons._items[+sel.dataset.i].act();
    });
  }

  function desktopMenu(x, y, iconEl) {
    if (iconEl) {
      var item = els.icons._items[+iconEl.dataset.i];
      Shell.contextMenu([
        { label: 'Open', icon: 'open', action: item.act },
        item.path ? { label: 'Rename', icon: 'rename', action: function () {
          WM.prompt('Rename', 'New name for "' + item.name + '"', VFS.nameOf(item.path)).then(function (v) {
            if (v) { VFS.rename(item.path, v); renderIcons(); }
          });
        } } : null,
        item.path ? { label: 'Delete', icon: 'trash', action: function () {
          VFS.remove(item.path); renderIcons();
        } } : null,
        { sep: true },
        { label: 'Properties', icon: 'info', action: function () {
          WM.alert(item.name, item.path ? 'Location: ' + VFS.parentOf(item.path) : 'System item');
        } }
      ].filter(Boolean), x, y);
      return;
    }
    Shell.contextMenu([
      { label: 'New folder', icon: 'newfolder', action: function () {
        var n = VFS.uniqueName(VFS.DESKTOP, 'New folder');
        VFS.mkdir(VFS.DESKTOP + '\\' + n);
        renderIcons();
      } },
      { label: 'New text document', icon: 'notepad', action: function () {
        var n = VFS.uniqueName(VFS.DESKTOP, 'New Text Document', '.txt');
        VFS.write(VFS.DESKTOP + '\\' + n, '', 'txt');
        renderIcons();
      } },
      { sep: true },
      { label: 'Refresh', icon: 'refresh', key: 'F5', action: renderIcons },
      { label: 'Open in Terminal', icon: 'terminal', action: function () { Emu.launch('terminal', { cwd: VFS.DESKTOP }); } },
      { sep: true },
      { label: 'Next wallpaper', icon: 'image', action: function () {
        var list = Emu.WALLPAPERS, i = list.map(function (w) { return w.value; }).indexOf(Emu.state.wallpaper);
        Emu.state.wallpaper = list[(i + 1) % list.length].value;
        Emu.save(); Emu.applyTheme();
      } },
      { label: 'Display settings', icon: 'monitor', action: function () { Emu.launch('settings', { page: 'system' }); } },
      { label: 'Personalise', icon: 'brush', action: function () { Emu.launch('settings', { page: 'personalization' }); } }
    ], x, y);
  }

  // ----------------------------------------------------------- task view
  function toggleTaskView() {
    if (!els.taskView.classList.contains('hidden')) { els.taskView.classList.add('hidden'); return; }
    closeFlyouts();
    renderTaskView();
    els.taskView.classList.remove('hidden');
  }

  function renderTaskView() {
    var list = WM.list().filter(onDesk);
    $('#tvWindows').innerHTML = list.length ? list.map(function (w) {
      var app = Emu.apps[w.appId] || { icon: 'file', name: w.appId };
      return '<div class="tv-card" data-win="' + w.id + '"><div class="tv-thumb">' +
        '<div class="bar">' + Icons.get(app.icon) + '<span>' + U.esc(w.title) + '</span></div>' +
        '<div class="fill">' + Icons.get(app.icon) + '</div>' +
        '<button class="tv-close" data-close="' + w.id + '">' + Icons.get('x') + '</button></div>' +
        '<div class="tv-label">' + Icons.get(app.icon) + '<span>' + U.esc(w.title) + '</span></div></div>';
    }).join('') : '<div class="tv-empty">No open windows on this desktop.<br>Press the Windows key to open Start.</div>';

    $('#tvDesks').innerHTML = desks.map(function (d, i) {
      var bg = /^#/.test(Emu.state.wallpaper) ? 'background:' + Emu.state.wallpaper
        : 'background-image:url(' + Emu.state.wallpaper + ')';
      return '<div class="tv-desk' + (i === activeDesk ? ' active' : '') + '" data-desk="' + i + '" style="' + bg + '">' +
        U.esc(d.name) + '</div>';
    }).join('') + '<div class="tv-desk" data-desk="new" style="display:grid;place-items:center">+ New desktop</div>';
  }

  function wireTaskView() {
    els.taskView.addEventListener('click', function (e) {
      var close = e.target.closest('[data-close]');
      if (close) {
        var w = WM.get(close.dataset.close);
        if (w) w.close();
        setTimeout(renderTaskView, 160);
        return;
      }
      var card = e.target.closest('[data-win]');
      if (card) {
        var win = WM.get(card.dataset.win);
        if (win) { WM.unminimize(win); win.focus(); }
        els.taskView.classList.add('hidden');
        return;
      }
      var desk = e.target.closest('[data-desk]');
      if (desk) {
        if (desk.dataset.desk === 'new') {
          desks.push({ name: 'Desktop ' + (desks.length + 1) });
          renderTaskView();
        } else switchDesk(+desk.dataset.desk);
        return;
      }
      if (e.target === els.taskView || e.target.id === 'tvWindows') els.taskView.classList.add('hidden');
    });
  }

  function switchDesk(i) {
    activeDesk = i;
    Shell.desk = i;
    WM.list().forEach(function (w) {
      w.el.style.display = (w.desk !== i || w.minimized) ? 'none' : '';
    });
    syncTaskbar();
    renderTaskView();
    els.taskView.classList.add('hidden');
  }

  // ------------------------------------------------------------- flyouts
  function toggleFlyout(name) {
    var map = { start: els.start, search: els.search, widgets: els.widgets, quick: els.quick, notif: els.notif };
    var was = openFlyout;
    closeFlyouts();
    if (was === name) return;
    if (name === 'start') { allApps = false; $('#startSearch').value = ''; buildStart(); }
    if (name === 'search') { $('#searchInput').value = ''; runSearch(); setTimeout(function () { $('#searchInput').focus(); }, 30); }
    if (name === 'widgets') renderWidgets();
    if (name === 'quick') renderQuick();
    if (name === 'notif') renderNotifs();
    map[name].classList.remove('hidden');
    openFlyout = name;
    syncTaskbar();
  }

  function closeFlyouts() {
    [els.start, els.search, els.widgets, els.quick, els.notif].forEach(function (el) {
      if (el) el.classList.add('hidden');
    });
    openFlyout = null;
    hideMenu();
    syncTaskbar();
  }

  function hideMenu() { els.menu.classList.add('hidden'); }

  // ------------------------------------------------------- global events
  function wireGlobalEvents() {
    wireIcons();
    wireTaskView();

    els.lock.addEventListener('click', Shell.unlock);
    document.addEventListener('keydown', function (e) {
      if (!els.lock.classList.contains('hidden')) { Shell.unlock(); return; }
    }, true);

    document.addEventListener('pointerdown', function (e) {
      if (!els.menu.classList.contains('hidden') && !e.target.closest('#contextMenu')) hideMenu();
      if (!openFlyout) return;
      var map = { start: '#startMenu', search: '#searchPanel', widgets: '#widgetsPanel', quick: '#quickPanel', notif: '#notifPanel' };
      if (e.target.closest(map[openFlyout])) return;
      if (e.target.closest('#taskbar')) return;
      closeFlyouts();
    });

    els.desktop.addEventListener('contextmenu', function (e) {
      if (e.target.closest('.win') || e.target.closest('.flyout') || e.target.closest('#contextMenu') ||
          e.target.closest('#taskbar') || e.target.closest('.task-view')) return;
      e.preventDefault();
      desktopMenu(e.clientX, e.clientY, e.target.closest('.d-icon'));
    });

    window.addEventListener('keydown', function (e) {
      var typing = /^(INPUT|TEXTAREA)$/.test((e.target.tagName || '')) || e.target.isContentEditable;

      if (e.key === 'Escape') {
        if (!els.taskView.classList.contains('hidden')) { els.taskView.classList.add('hidden'); return; }
        if (openFlyout) { closeFlyouts(); return; }
      }

      // Windows key combinations
      if (e.metaKey || e.key === 'Meta' || e.key === 'OS') {
        var k = e.key.toLowerCase();
        if (k === 'meta' || k === 'os') { e.preventDefault(); toggleFlyout('start'); return; }
        if (k === 'd') { e.preventDefault(); WM.minimizeAll(); return; }
        if (k === 'e') { e.preventDefault(); Emu.launch('explorer'); return; }
        if (k === 's') { e.preventDefault(); toggleFlyout('search'); return; }
        if (k === 'a') { e.preventDefault(); toggleFlyout('quick'); return; }
        if (k === 'n') { e.preventDefault(); toggleFlyout('notif'); return; }
        if (k === 'w') { e.preventDefault(); toggleFlyout('widgets'); return; }
        if (k === 'l') { e.preventDefault(); Shell.lock(); return; }
        if (k === 'tab') { e.preventDefault(); toggleTaskView(); return; }
        if (WM.focused) {
          if (k === 'arrowleft') { e.preventDefault(); WM.focused.snapTo('left'); return; }
          if (k === 'arrowright') { e.preventDefault(); WM.focused.snapTo('right'); return; }
          if (k === 'arrowup') { e.preventDefault(); WM.focused.snapTo('max'); return; }
          if (k === 'arrowdown') { e.preventDefault(); WM.focused.minimize(); return; }
        }
      }

      if (e.altKey && e.key === 'Tab') {
        e.preventDefault();
        var list = WM.list().filter(onDesk);
        if (!list.length) return;
        var idx = list.indexOf(WM.focused);
        var next = list[(idx + (e.shiftKey ? -1 : 1) + list.length) % list.length];
        WM.unminimize(next);
        next.focus();
        return;
      }
      if (e.altKey && e.key === 'F4' && WM.focused) { e.preventDefault(); WM.focused.close(); return; }
      // F5 refreshes inside the emulator rather than reloading the real page.
      if (e.key === 'F5' && !typing) { e.preventDefault(); if (!WM.focused) renderIcons(); }
    });

    // Win key alone (keyup handles the case where keydown is swallowed)
    window.addEventListener('keyup', function (e) {
      if ((e.key === 'Meta' || e.key === 'OS') && !e.ctrlKey && !e.altKey && !e.shiftKey) e.preventDefault();
    });
  }

  global.Shell = Shell;
})(window);
