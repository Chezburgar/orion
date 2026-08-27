/* ===== Microsoft Store =====
   Installs and uninstalls the games in js/games.js for real: an installed
   game becomes a launchable app, gets a desktop shortcut and a Start tile,
   and survives a reload.                                                  */
(function (global) {
  'use strict';

  var Emu = global.Emu, U = Emu.util, Icons = global.Icons, WM = global.WM, VFS = global.VFS, Games = global.Games;

  var installing = {};   // id -> percent

  function isInstalled(id) { return (Emu.state.installed || []).indexOf(id) >= 0; }

  function stars(n) {
    var full = Math.round(n);
    return '<span class="stars" title="' + n.toFixed(1) + '">' +
      '★★★★★'.slice(0, full) + '<span class="dim">' + '★★★★★'.slice(0, 5 - full) + '</span>' +
      ' <small>' + n.toFixed(1) + '</small></span>';
  }

  function install(id, onProgress) {
    var g = Games.list[id];
    if (!g || isInstalled(id) || installing[id] != null) return;
    installing[id] = 0;
    var total = g.size;
    var timer = setInterval(function () {
      installing[id] += Math.random() * 14 + 5;
      if (installing[id] >= 100) {
        clearInterval(timer);
        delete installing[id];
        finish(id);
        onProgress(id, 100);
        return;
      }
      onProgress(id, installing[id], total);
    }, 130);
  }

  function finish(id) {
    var g = Games.list[id];
    Emu.state.installed = (Emu.state.installed || []).concat([id]);
    Emu.save();
    Games.register(id);

    // Desktop shortcut, like a real install
    var desktop = VFS.get(VFS.DESKTOP);
    if (desktop && !desktop.children[g.name]) {
      desktop.children[g.name] = VFS.link(id);
      VFS.save();
      VFS.emitChange(VFS.DESKTOP);
    }
    Emu.notify('Microsoft Store', g.name + ' was installed. It is on your desktop and in Start.', 'store');
    Emu.emit('apps');
  }

  function uninstall(id, win) {
    var g = Games.list[id];
    return WM.confirm('Uninstall', 'Remove ' + g.name + ' from this PC? Saved high scores are kept.', win)
      .then(function (ok) {
        if (!ok) return false;
        Emu.state.installed = (Emu.state.installed || []).filter(function (x) { return x !== id; });
        Emu.save();
        Games.unregister(id);
        var desktop = VFS.get(VFS.DESKTOP);
        if (desktop && desktop.children[g.name] && desktop.children[g.name].type === 'app') {
          delete desktop.children[g.name];
          VFS.save();
          VFS.emitChange(VFS.DESKTOP);
        }
        Emu.notify('Microsoft Store', g.name + ' was uninstalled.', 'store');
        Emu.emit('apps');
        return true;
      });
  }

  function launchStore(args) {
    var win = WM.create({
      appId: 'store', title: 'Microsoft Store', icon: 'store',
      width: 980, height: 680, minWidth: 520, minHeight: 400
    });

    var page = (args && args.page) || 'home';
    var detail = null;

    win.body.innerHTML =
      '<div class="store2">' +
        '<div class="store-nav">' +
          '<div class="store-brand">' + Icons.get('store') + '<span>Store</span></div>' +
          ['home:Home:apps', 'games:Games:game', 'apps:Apps:grid', 'library:Library:download']
            .map(function (x) {
              var p = x.split(':');
              return '<div class="store-navitem" data-page="' + p[0] + '">' + Icons.get(p[2]) +
                '<span>' + p[1] + '</span></div>';
            }).join('') +
        '</div>' +
        '<div class="store-main" data-main></div>' +
      '</div>';

    var main = U.$('[data-main]', win.body);

    function gameCard(id) {
      var g = Games.list[id];
      var pct = installing[id];
      var action = pct != null
        ? '<div class="store-prog"><i style="width:' + Math.min(100, pct) + '%"></i></div>' +
          '<small class="muted">' + Math.min(100, Math.round(pct)) + '% of ' + g.size + ' MB</small>'
        : isInstalled(id)
          ? '<button class="btn primary" data-open="' + id + '">Play</button>' +
            '<button class="btn" data-uninstall="' + id + '">Uninstall</button>'
          : '<button class="btn primary" data-install="' + id + '">Get</button>' +
            '<small class="muted">' + g.size + ' MB</small>';
      return '<div class="store-tile" data-detail="' + id + '">' +
        '<div class="store-art">' + Icons.get(g.icon) + '</div>' +
        '<b>' + U.esc(g.name) + '</b>' +
        '<small class="muted">' + U.esc(g.cat) + ' &middot; Free</small>' +
        stars(g.rating) +
        '<div class="store-actions" data-stop>' + action + '</div>' +
        '</div>';
    }

    function render() {
      U.$$('.store-navitem', win.body).forEach(function (n) {
        n.classList.toggle('active', n.dataset.page === page);
      });
      main.scrollTop = 0;

      if (detail) return renderDetail();

      var ids = Object.keys(Games.list);
      if (page === 'home') {
        main.innerHTML =
          '<div class="store-hero2"><div><h2>Games that actually run</h2>' +
          '<p>Six real games written for this emulator. Install one and it lands on your desktop, ' +
          'in Start and on the taskbar - and it still works after a reload.</p>' +
          '<button class="btn primary" data-page="games">Browse games</button></div>' +
          '<div class="store-hero-art">' + Icons.get('blocks') + Icons.get('cards') + Icons.get('tiles') + '</div></div>' +
          '<h3 class="store-h">Top free games</h3><div class="store-grid2">' +
          ids.slice(0, 3).map(gameCard).join('') + '</div>' +
          '<h3 class="store-h">Also worth a look</h3><div class="store-grid2">' +
          ids.slice(3).map(gameCard).join('') + '</div>';
        return;
      }

      if (page === 'games') {
        main.innerHTML = '<h3 class="store-h">Games</h3><div class="store-grid2">' +
          ids.map(gameCard).join('') + '</div>';
        return;
      }

      if (page === 'apps') {
        main.innerHTML = '<h3 class="store-h">Apps included with the emulator</h3><div class="store-grid2">' +
          Emu.appOrder.filter(function (id) { return !Emu.apps[id].game; }).map(function (id) {
            var a = Emu.apps[id];
            return '<div class="store-tile"><div class="store-art">' + Icons.get(a.icon) + '</div>' +
              '<b>' + U.esc(a.name) + '</b><small class="muted">' + U.esc(a.desc || 'App') + '</small>' +
              '<div class="store-actions"><button class="btn primary" data-open="' + id + '">Open</button>' +
              '<button class="btn" data-pin="' + id + '">Pin</button></div></div>';
          }).join('') + '</div>';
        return;
      }

      // library
      var installed = (Emu.state.installed || []);
      main.innerHTML = '<h3 class="store-h">Your library</h3>' +
        (installed.length
          ? '<div class="store-grid2">' + installed.map(gameCard).join('') + '</div>'
          : '<div class="ex-empty" style="height:200px">' + Icons.get('download') +
            '<span>Nothing installed yet</span>' +
            '<button class="btn primary" data-page="games">Browse games</button></div>') +
        '<h3 class="store-h">High scores</h3><div class="store-scores">' +
        (Object.keys(Emu.state.scores || {}).length
          ? Object.keys(Emu.state.scores).map(function (k) {
            return '<div class="e-row"><span class="t">' + U.esc(k) + '</span>' +
              '<span class="when">' + Emu.state.scores[k] + '</span></div>';
          }).join('')
          : '<p class="muted">No scores recorded yet.</p>') + '</div>';
    }

    function renderDetail() {
      var g = Games.list[detail];
      var pct = installing[detail];
      main.innerHTML = '<button class="btn" data-back>‹ Back</button>' +
        '<div class="store-detail">' +
        '<div class="store-art big">' + Icons.get(g.icon) + '</div>' +
        '<div class="store-meta"><h2>' + U.esc(g.name) + '</h2>' +
        '<div class="muted">Emulated Studios &middot; ' + U.esc(g.cat) + ' &middot; Free</div>' +
        stars(g.rating) +
        '<p>' + U.esc(g.desc) + '</p>' +
        '<div class="store-actions">' +
        (pct != null
          ? '<div class="store-prog wide"><i style="width:' + Math.min(100, pct) + '%"></i></div>'
          : isInstalled(detail)
            ? '<button class="btn primary" data-open="' + detail + '">Play</button>' +
              '<button class="btn" data-uninstall="' + detail + '">Uninstall</button>'
            : '<button class="btn primary" data-install="' + detail + '">Get</button>') +
        '</div>' +
        '<div class="store-facts">' +
        '<div><span>Size</span><b>' + g.size + ' MB</b></div>' +
        '<div><span>Category</span><b>' + U.esc(g.cat) + '</b></div>' +
        '<div><span>Best score</span><b>' + (Games.best(detail === '2048' ? '2048' : detail) || '—') + '</b></div>' +
        '<div><span>Runs</span><b>Offline</b></div>' +
        '</div></div></div>';
    }

    function onProgress(id) {
      if (detail === id) renderDetail(); else render();
    }

    win.body.addEventListener('click', function (e) {
      var nav = e.target.closest('[data-page]');
      if (nav) { page = nav.dataset.page; detail = null; render(); return; }
      if (e.target.closest('[data-back]')) { detail = null; render(); return; }

      var ins = e.target.closest('[data-install]');
      if (ins) { install(ins.dataset.install, onProgress); onProgress(ins.dataset.install); return; }

      var un = e.target.closest('[data-uninstall]');
      if (un) { uninstall(un.dataset.uninstall, win).then(function () { render(); }); return; }

      var op = e.target.closest('[data-open]');
      if (op) { Emu.launch(op.dataset.open); return; }

      var pin = e.target.closest('[data-pin]');
      if (pin) {
        var app = Emu.apps[pin.dataset.pin];
        var target = VFS.DESKTOP + '\\' + app.name;
        if (VFS.exists(target)) { Emu.notify('Microsoft Store', app.name + ' is already on the desktop.', 'store'); return; }
        VFS.get(VFS.DESKTOP).children[app.name] = VFS.link(app.id);
        VFS.save();
        VFS.emitChange(VFS.DESKTOP);
        Emu.notify('Microsoft Store', app.name + ' pinned to the desktop.', 'store');
        return;
      }

      var det = e.target.closest('[data-detail]');
      if (det && !e.target.closest('[data-stop]')) { detail = det.dataset.detail; render(); }
    });

    render();
    return win;
  }

  Emu.registerApp({
    id: 'store', name: 'Microsoft Store', icon: 'store', pinned: true,
    desc: 'Install games into the emulator', launch: launchStore
  });

  Emu.Store = { install: install, uninstall: uninstall, isInstalled: isInstalled };
})(window);
