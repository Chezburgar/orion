/* ===== Orion Store =====
   Installs web games into the desktop: an installed game becomes a real app
   with its own icon, window, desktop shortcut and Start tile, and it comes
   back after a reload.                                                    */
(function (global) {
  'use strict';

  var Emu = global.Emu, U = Emu.util, Icons = global.Icons, WM = global.WM, VFS = global.VFS, Games = global.Games;

  var installing = {};

  function isInstalled(id) { return (Emu.state.installed || []).indexOf(id) >= 0; }

  function stars(n) {
    var full = Math.round(n);
    return '<span class="stars" title="' + n.toFixed(1) + '">' +
      '★★★★★'.slice(0, full) + '<span class="dim">' + '★★★★★'.slice(0, 5 - full) + '</span>' +
      ' <small>' + n.toFixed(1) + '</small></span>';
  }

  function install(id, onProgress) {
    if (isInstalled(id) || installing[id] != null) return;
    installing[id] = 0;
    var timer = setInterval(function () {
      installing[id] += Math.random() * 15 + 6;
      if (installing[id] >= 100) {
        clearInterval(timer);
        delete installing[id];
        finish(id);
        onProgress(id);
        return;
      }
      onProgress(id);
    }, 120);
  }

  function finish(id) {
    var g = Games.get(id);
    Emu.state.installed = (Emu.state.installed || []).concat([id]);
    Emu.save();
    Games.register(id);

    var desktop = VFS.get(VFS.DESKTOP);
    if (desktop && !desktop.children[g.name]) {
      desktop.children[g.name] = VFS.link(id);
      VFS.save();
      VFS.emitChange(VFS.DESKTOP);
    }
    Emu.notify('Orion Store', g.name + ' installed. It is on your desktop and in Start.', 'orionstore');
    Emu.emit('apps');
  }

  function uninstall(id, win) {
    var g = Games.get(id);
    return WM.confirm('Uninstall', 'Remove ' + g.name + ' from this PC?', win).then(function (ok) {
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
      Emu.notify('Orion Store', g.name + ' was uninstalled.', 'orionstore');
      Emu.emit('apps');
      return true;
    });
  }

  function launchStore(args) {
    var win = WM.create({
      appId: 'store', title: 'Orion Store', icon: 'orionstore',
      width: 980, height: 690, minWidth: 520, minHeight: 400
    });

    var page = (args && args.page) || 'home';
    var detail = null;

    win.body.innerHTML =
      '<div class="store2">' +
        '<div class="store-nav">' +
          '<div class="store-brand">' + Icons.get('orionstore') + '<span>Orion Store</span></div>' +
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
      var list = Games.list(), g = list[id];
      if (!g) return '';
      var pct = installing[id];
      var action = pct != null
        ? '<div class="store-prog"><i style="width:' + Math.min(100, pct) + '%"></i></div>' +
          '<small class="muted">' + Math.min(100, Math.round(pct)) + '%</small>'
        : isInstalled(id)
          ? '<button class="btn primary" data-open="' + id + '">Play</button>' +
            '<button class="btn" data-uninstall="' + id + '">Uninstall</button>'
          : '<button class="btn primary" data-install="' + id + '">Get</button>' +
            '<small class="muted">' + g.size + ' MB</small>';
      return '<div class="store-tile" data-detail="' + id + '">' +
        '<div class="store-art">' + Icons.get(Games.art(id, g)) + '</div>' +
        '<b>' + U.esc(g.name) + '</b>' +
        '<small class="muted">' + U.esc(g.cat) + ' &middot; ' + (g.proxied ? 'via proxy' : 'Free') + '</small>' +
        stars(g.rating) +
        '<div class="store-actions" data-stop>' + action + '</div>' +
        '</div>';
    }

    function addTile() {
      // Adding publishes to everyone, so it is the owner's call alone.
      if (!global.Auth || !Auth.isOwner()) return '';
      return '<div class="store-tile store-add" data-addgame>' +
        '<div class="store-art">' + Icons.get('plus') + '</div>' +
        '<b>Add a game</b><small class="muted">Published for everyone</small>' +
        '<div class="store-actions"><button class="btn">Add by URL</button></div></div>';
    }

    function render() {
      U.$$('.store-navitem', win.body).forEach(function (n) {
        n.classList.toggle('active', n.dataset.page === page);
      });
      main.scrollTop = 0;
      if (detail) return renderDetail();

      var ids = Object.keys(Games.list());

      if (page === 'home') {
        main.innerHTML =
          '<div class="store-hero2"><div><h2>Your games, on your desktop</h2>' +
          '<p>Install a game and it becomes a real app in Orion — its own icon, its own window, a ' +
          'desktop shortcut and a Start tile. Games run in a full frame, so their own code, WebGL, ' +
          'audio and pointer lock all work.</p>' +
          '<button class="btn primary" data-page="games">Browse games</button></div>' +
          '<div class="store-hero-art">' + Icons.get('orionstore') + '</div></div>' +
          '<h3 class="store-h">Featured</h3><div class="store-grid2">' +
          ids.map(gameCard).join('') + addTile() + '</div>';
        return;
      }

      if (page === 'games') {
        main.innerHTML = '<h3 class="store-h">Games</h3><div class="store-grid2">' +
          ids.map(gameCard).join('') + addTile() + '</div>';
        return;
      }

      if (page === 'apps') {
        main.innerHTML = '<h3 class="store-h">Apps included with Orion</h3><div class="store-grid2">' +
          Emu.appOrder.filter(function (id) { return !Emu.apps[id].game && !Emu.apps[id].hidden; }).map(function (id) {
            var a = Emu.apps[id];
            return '<div class="store-tile"><div class="store-art">' + Icons.get(a.icon) + '</div>' +
              '<b>' + U.esc(a.name) + '</b><small class="muted">' + U.esc(a.desc || 'App') + '</small>' +
              '<div class="store-actions"><button class="btn primary" data-open="' + id + '">Open</button>' +
              '<button class="btn" data-pin="' + id + '">Pin</button></div></div>';
          }).join('') + '</div>';
        return;
      }

      var installed = (Emu.state.installed || []);
      main.innerHTML = '<h3 class="store-h">Your library</h3>' +
        (installed.length
          ? '<div class="store-grid2">' + installed.map(gameCard).join('') + '</div>'
          : '<div class="ex-empty" style="height:190px">' + Icons.get('download') +
            '<span>Nothing installed yet</span>' +
            '<button class="btn primary" data-page="games">Browse games</button></div>') +
        '<h3 class="store-h">Games you added</h3>' +
        ((Emu.state.games || []).length
          ? '<div class="store-grid2">' + (Emu.state.games || []).map(function (g) {
              return gameCard(g.id);
            }).join('') + '</div>'
          : '<p class="muted">None yet — use <b>Add by URL</b> on the Games page to add any web game.</p>');
    }

    function renderDetail() {
      var g = Games.get(detail);
      if (!g) { detail = null; return render(); }
      var pct = installing[detail];
      main.innerHTML = '<button class="btn" data-back>‹ Back</button>' +
        '<div class="store-detail">' +
        '<div class="store-art big">' + Icons.get(Games.art(detail, g)) + '</div>' +
        '<div class="store-meta"><h2>' + U.esc(g.name) + '</h2>' +
        '<div class="muted">' + U.esc(g.cat) + ' &middot; Free</div>' +
        stars(g.rating) +
        '<p>' + U.esc(g.desc) + '</p>' +
        '<div class="store-actions">' +
        (pct != null
          ? '<div class="store-prog wide"><i style="width:' + Math.min(100, pct) + '%"></i></div>'
          : isInstalled(detail)
            ? '<button class="btn primary" data-open="' + detail + '">Play</button>' +
              '<button class="btn" data-uninstall="' + detail + '">Uninstall</button>'
            : '<button class="btn primary" data-install="' + detail + '">Get</button>') +
        (g.shared && Auth.isOwner()
          ? '<button class="btn" data-toggleproxy="' + detail + '">' +
              (g.proxied ? 'Stop using the proxy' : 'Open through the proxy') + '</button>' +
            '<button class="btn danger" data-unpublish="' + detail + '">Remove for everyone</button>'
          : '') +
        (g.custom ? '<button class="btn" data-forget="' + detail + '">Remove from Store</button>' : '') +
        '</div>' +
        '<div class="store-facts">' +
        '<div><span>Size</span><b>' + g.size + ' MB</b></div>' +
        '<div><span>Category</span><b>' + U.esc(g.cat) + '</b></div>' +
        '<div><span>Runs</span><b>In a real frame</b></div>' +
        '<div><span>Source</span><b class="lnk" data-ext="' + U.esc(g.url) + '">' +
          U.esc((g.url.split('/')[2] || '')) + '</b></div>' +
        '</div></div></div>';
    }

    function onProgress(id) { if (detail === id) renderDetail(); else render(); }

    /** Publishing adds the game to everyone's Store, so it is owner-only. */
    function askForGame() {
      if (!global.Auth || !Auth.isOwner()) {
        WM.alert('Orion Store', 'Only the owner can add games to the Store.', win);
        return;
      }
      var back = U.el('<div class="dlg-backdrop"><div class="dlg">' +
        '<h3>Add a game</h3>' +
        '<p>This publishes the game to the Store for everyone.</p>' +
        '<div class="dlg-body"><form class="gate-form" autocomplete="off">' +
          '<label>Name<input name="name" maxlength="60" placeholder="Kart Bros" required></label>' +
          '<label>URL<input name="url" placeholder="https://example.com/game/" required></label>' +
          '<label>Category<input name="cat" placeholder="Action" value="Added"></label>' +
          '<label>Description<textarea name="desc" rows="2" maxlength="400"></textarea></label>' +
          '<label class="dlg-check"><input type="checkbox" name="proxied"> ' +
            'Open through the proxy (for sites your network blocks)</label>' +
          '<div class="gate-err hidden" data-err></div>' +
        '</form></div>' +
        '<div class="dlg-actions"><button data-x="cancel">Cancel</button>' +
        '<button class="primary" data-x="add">Publish</button></div></div></div>');
      win.el.appendChild(back);
      var form = back.querySelector('form');

      back.addEventListener('click', function (ev) {
        var b = ev.target.closest('[data-x]');
        if (!b) return;
        if (b.dataset.x === 'cancel') { back.remove(); return; }

        var name = form.name.value.trim();
        var url = form.url.value.trim();
        var box = form.querySelector('[data-err]');
        if (!name || !/^https?:/i.test(url)) {
          box.textContent = 'A name and a full https:// URL are required.';
          box.classList.remove('hidden');
          return;
        }
        b.disabled = true;
        b.textContent = 'Publishing…';
        Games.addShared(name, url, {
          cat: form.cat.value.trim(),
          desc: form.desc.value.trim(),
          proxied: form.proxied.checked
        }).then(function () {
          back.remove();
          Emu.notify('Orion Store', '"' + name + '" published to the Store for everyone.', 'orionstore');
          page = 'games';
          render();
        }).catch(function (err) {
          b.disabled = false;
          b.textContent = 'Publish';
          box.textContent = /unauthor/i.test(err.message)
            ? 'The owner key was not accepted.' : err.message;
          box.classList.remove('hidden');
        });
      });
    }

    win.body.addEventListener('click', function (e) {
      var nav = e.target.closest('[data-page]');
      if (nav) { page = nav.dataset.page; detail = null; render(); return; }
      if (e.target.closest('[data-back]')) { detail = null; render(); return; }
      if (e.target.closest('[data-addgame]')) { askForGame(); return; }

      var ext = e.target.closest('[data-ext]');
      if (ext) { window.open(ext.dataset.ext, '_blank', 'noopener'); return; }

      var ins = e.target.closest('[data-install]');
      if (ins) { install(ins.dataset.install, onProgress); onProgress(ins.dataset.install); return; }

      var un = e.target.closest('[data-uninstall]');
      if (un) { uninstall(un.dataset.uninstall, win).then(function () { render(); }); return; }

      var fg = e.target.closest('[data-forget]');
      if (fg) {
        var id = fg.dataset.forget;
        WM.confirm('Remove', 'Remove this game from the Store entirely?', win).then(function (ok) {
          if (!ok) return;
          if (isInstalled(id)) { Games.unregister(id); Emu.state.installed = Emu.state.installed.filter(function (x) { return x !== id; }); }
          Games.removeCustom(id);
          Emu.emit('apps');
          detail = null;
          render();
        });
        return;
      }

      var op = e.target.closest('[data-open]');
      if (op) { Emu.launch(op.dataset.open); return; }

      var pin = e.target.closest('[data-pin]');
      if (pin) {
        var app = Emu.apps[pin.dataset.pin];
        var target = VFS.DESKTOP + '\\' + app.name;
        if (VFS.exists(target)) { Emu.notify('Orion Store', app.name + ' is already on the desktop.', 'orionstore'); return; }
        VFS.get(VFS.DESKTOP).children[app.name] = VFS.link(app.id);
        VFS.save();
        VFS.emitChange(VFS.DESKTOP);
        Emu.notify('Orion Store', app.name + ' pinned to the desktop.', 'orionstore');
        return;
      }

      var tp = e.target.closest('[data-toggleproxy]');
      if (tp) {
        var gid = tp.dataset.toggleproxy;
        var cur = Games.get(gid);
        tp.disabled = true;
        Games.setProxied(gid, !cur.proxied).then(function () {
          Emu.notify('Orion Store', cur.name + (cur.proxied ? ' now opens directly.' : ' now opens through the proxy.'), 'orionstore');
          render();
        }).catch(function (err) { WM.alert('Orion Store', err.message, win); });
        return;
      }

      var up = e.target.closest('[data-unpublish]');
      if (up) {
        var uid = up.dataset.unpublish;
        WM.confirm('Remove for everyone', 'Take this game out of the Store for all users?', win)
          .then(function (ok) {
            if (!ok) return;
            if (isInstalled(uid)) {
              Games.unregister(uid);
              Emu.state.installed = Emu.state.installed.filter(function (x) { return x !== uid; });
              Emu.save();
            }
            return Games.removeShared(uid).then(function () { detail = null; render(); });
          }).catch(function (err) { WM.alert('Orion Store', err.message, win); });
        return;
      }

      var det = e.target.closest('[data-detail]');
      if (det && !e.target.closest('[data-stop]')) { detail = det.dataset.detail; render(); }
    });

    if (global.Games.refresh) global.Games.refresh().then(render);
    render();
    return win;
  }

  Emu.registerApp({
    id: 'store', name: 'Orion Store', icon: 'orionstore', pinned: true,
    desc: 'Install games into Orion', launch: launchStore
  });

  Emu.Store = { install: install, uninstall: uninstall, isInstalled: isInstalled };
})(window);
