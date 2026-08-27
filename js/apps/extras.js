/* ===== Photos, Microsoft Store, Task Manager ===== */
(function (global) {
  'use strict';

  var Emu = global.Emu, U = Emu.util, Icons = global.Icons, WM = global.WM, VFS = global.VFS;

  // ------------------------------------------------------------- Photos
  Emu.registerApp({
    id: 'photos', name: 'Photos', icon: 'photos', pinned: true, desc: 'View pictures',
    launch: function (args) {
      var win = WM.create({
        appId: 'photos', title: 'Photos', icon: 'photos',
        width: 860, height: 600, minWidth: 420, minHeight: 320
      });
      var dir = VFS.HOME + '\\Pictures';
      var viewing = null;

      function pics() {
        return VFS.list(dir).filter(function (e) {
          return e.node.type === 'file' && (e.node.ext === 'img' || /^(png|jpe?g|gif|svg|webp)$/.test(e.node.ext || ''));
        });
      }

      function src(entry) {
        var c = entry.node.content || '';
        return /^(data:|https?:|assets\/)/.test(c) ? c : 'assets/wall-bloom.svg';
      }

      function render() {
        var list = pics();
        if (viewing) {
          var e = list.filter(function (x) { return x.path === viewing; })[0] || list[0];
          if (!e) { viewing = null; return render(); }
          win.setTitle(e.name + ' - Photos');
          win.body.innerHTML = '<div class="ph">' +
            '<div class="ph-bar"><button class="btn" data-act="back">‹ Collection</button>' +
            '<b>' + U.esc(e.name) + '</b><span class="muted" style="margin-left:auto">' +
            (list.indexOf(e) + 1) + ' of ' + list.length + '</span>' +
            '<button class="btn" data-act="wall">Set as wallpaper</button>' +
            '<button class="btn" data-act="prev">‹</button><button class="btn" data-act="next">›</button></div>' +
            '<div class="ph-view" style="background-image:url(' + src(e) + ')"></div></div>';
          return;
        }
        win.setTitle('Photos');
        win.body.innerHTML = '<div class="ph"><div class="ph-bar"><b>Collection</b>' +
          '<span class="muted">' + list.length + ' items in ' + dir + '</span></div>' +
          (list.length ? '<div class="ph-grid">' + list.map(function (e) {
            return '<div class="ph-item" data-path="' + U.esc(e.path) + '" title="' + U.esc(e.name) +
              '" style="background-image:url(' + src(e) + ')"></div>';
          }).join('') + '</div>' : '<div class="ex-empty">' + Icons.get('image') + '<span>No pictures yet</span></div>') +
          '</div>';
      }

      win.body.addEventListener('click', function (ev) {
        var item = ev.target.closest('[data-path]');
        if (item) { viewing = item.dataset.path; render(); return; }
        var act = ev.target.closest('[data-act]');
        if (!act) return;
        var list = pics(), i = list.findIndex(function (x) { return x.path === viewing; });
        if (act.dataset.act === 'back') { viewing = null; render(); }
        if (act.dataset.act === 'prev' && list.length) { viewing = list[(i - 1 + list.length) % list.length].path; render(); }
        if (act.dataset.act === 'next' && list.length) { viewing = list[(i + 1) % list.length].path; render(); }
        if (act.dataset.act === 'wall') {
          var e = list[i];
          Emu.state.wallpaper = src(e);
          Emu.save(); Emu.applyTheme();
          Emu.notify('Photos', 'Wallpaper changed to ' + e.name, 'photos');
        }
      });

      if (args && args.path) viewing = args.path;
      render();
      return win;
    }
  });

  // -------------------------------------------------------------- Store
  var CATALOG = [
    { id: 'edge', name: 'Microsoft Edge', pub: 'Emulated', desc: 'Fast, secure browser' },
    { id: 'notepad', name: 'Notepad', pub: 'Emulated', desc: 'Plain text editing' },
    { id: 'calculator', name: 'Calculator', pub: 'Emulated', desc: 'Standard and keyboard-driven' },
    { id: 'terminal', name: 'Windows Terminal', pub: 'Emulated', desc: 'Shell for the virtual file system' },
    { id: 'photos', name: 'Photos', pub: 'Emulated', desc: 'Browse your pictures' },
    { id: 'taskmgr', name: 'Task Manager', pub: 'Emulated', desc: 'See what is running' },
    { id: 'explorer', name: 'File Explorer', pub: 'Emulated', desc: 'Your files, folders and drives' },
    { id: 'settings', name: 'Settings', pub: 'Emulated', desc: 'Personalise everything' }
  ];

  Emu.registerApp({
    id: 'store', name: 'Microsoft Store', icon: 'store', pinned: true, desc: 'Get apps',
    launch: function () {
      var win = WM.create({
        appId: 'store', title: 'Microsoft Store', icon: 'store',
        width: 900, height: 620, minWidth: 460, minHeight: 340
      });
      win.body.innerHTML = '<div class="store">' +
        '<div class="store-hero"><h2>Everything here is already installed</h2>' +
        '<p>The Store is a mock-up - but the buttons pin real emulator apps to your desktop.</p></div>' +
        '<div class="store-grid">' + CATALOG.map(function (c) {
          var app = Emu.apps[c.id];
          return '<div class="store-card">' + Icons.get(app ? app.icon : 'store') +
            '<div style="min-width:0"><b>' + U.esc(c.name) + '</b><small>' + U.esc(c.pub) + ' &middot; ' + U.esc(c.desc) + '</small>' +
            '<button class="btn primary" data-open="' + c.id + '">Open</button> ' +
            '<button class="btn" data-pin="' + c.id + '">Pin to desktop</button></div></div>';
        }).join('') + '</div></div>';

      win.body.addEventListener('click', function (e) {
        var o = e.target.closest('[data-open]');
        if (o) { Emu.launch(o.dataset.open); return; }
        var p = e.target.closest('[data-pin]');
        if (p) {
          var app = Emu.apps[p.dataset.pin];
          var target = VFS.DESKTOP + '\\' + app.name;
          if (VFS.exists(target)) { Emu.notify('Microsoft Store', app.name + ' is already on the desktop.', 'store'); return; }
          var d = VFS.get(VFS.DESKTOP);
          d.children[app.name] = VFS.link(app.id);
          VFS.save();
          VFS.emitChange(VFS.DESKTOP);
          Emu.notify('Microsoft Store', app.name + ' pinned to the desktop.', 'store');
        }
      });
      return win;
    }
  });

  // --------------------------------------------------------- Task Manager
  Emu.registerApp({
    id: 'taskmgr', name: 'Task Manager', icon: 'taskmgr', desc: 'Processes and performance',
    launch: function () {
      var win = WM.create({
        appId: 'taskmgr', title: 'Task Manager', icon: 'taskmgr',
        width: 720, height: 520, minWidth: 440, minHeight: 300
      });
      var sel = null, seeds = {};

      function rnd(id, base, spread) {
        seeds[id] = seeds[id] || Math.random();
        var t = Date.now() / 3000 + seeds[id] * 10;
        return Math.max(0, base + Math.sin(t) * spread + Math.random() * spread * 0.4);
      }

      function render() {
        var list = WM.list();
        var totalCpu = 0, totalMem = 0;
        var rows = list.map(function (w) {
          var app = Emu.apps[w.appId] || { name: w.appId, icon: 'file' };
          var cpu = rnd(w.id, w.appId === 'edge' ? 6 : 1.4, w.appId === 'edge' ? 4 : 1.2);
          var mem = rnd(w.id + 'm', w.appId === 'edge' ? 220 : 70, 24);
          totalCpu += cpu; totalMem += mem;
          return '<div class="tm-row' + (sel === w.id ? ' sel' : '') + '" data-id="' + w.id + '">' +
            '<span class="nm">' + Icons.get(app.icon) + '<span>' + U.esc(w.title) + '</span></span>' +
            '<span class="tm-num tm-heat" style="background:rgba(80,160,255,' + Math.min(0.5, cpu / 24) + ')">' + cpu.toFixed(1) + '%</span>' +
            '<span class="tm-num tm-heat" style="background:rgba(80,160,255,' + Math.min(0.5, mem / 700) + ')">' + mem.toFixed(0) + ' MB</span>' +
            '<span class="tm-num">' + (w.minimized ? 'Suspended' : 'Running') + '</span></div>';
        }).join('');

        win.body.innerHTML = '<div class="tm">' +
          '<div class="tm-bar"><h3>Processes</h3>' +
          '<span class="muted">CPU ' + Math.min(99, totalCpu + 3).toFixed(0) + '% &middot; Memory ' +
          (totalMem / 1024 + 1.8).toFixed(1) + ' GB</span>' +
          '<button class="btn" data-act="end"' + (sel ? '' : ' disabled') + '>End task</button></div>' +
          '<div class="tm-hdr"><span>Name</span><span class="tm-num">CPU</span><span class="tm-num">Memory</span><span class="tm-num">Status</span></div>' +
          '<div class="tm-list">' + (rows || '<div class="ex-empty muted" style="padding:40px">No apps running</div>') + '</div>' +
          '<div class="ex-status"><span>' + list.length + ' processes</span>' +
          '<span style="margin-left:auto">Figures are simulated</span></div></div>';
      }

      win.body.addEventListener('click', function (e) {
        var row = e.target.closest('[data-id]');
        if (row) { sel = row.dataset.id; render(); return; }
        if (e.target.closest('[data-act="end"]') && sel) {
          var w = WM.get(sel);
          if (w) w.close();
          sel = null;
          setTimeout(render, 160);
        }
      });

      var timer = setInterval(render, 1600);
      win.onClose = function () { clearInterval(timer); };
      render();
      return win;
    }
  });
})(window);
