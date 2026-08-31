/* ===== File Explorer ===== */
(function (global) {
  'use strict';

  var Emu = global.Emu, U = Emu.util, Icons = global.Icons, WM = global.WM, VFS = global.VFS;

  var QUICK = [
    { name: 'Desktop', path: VFS.HOME + '\\Desktop', icon: 'monitor' },
    { name: 'Downloads', path: VFS.HOME + '\\Downloads', icon: 'download' },
    { name: 'Documents', path: VFS.HOME + '\\Documents', icon: 'doc' },
    { name: 'Pictures', path: VFS.HOME + '\\Pictures', icon: 'image' },
    { name: 'Music', path: VFS.HOME + '\\Music', icon: 'sound' },
    { name: 'Videos', path: VFS.HOME + '\\Videos', icon: 'play' }
  ];

  function iconFor(entry) {
    var n = entry.node;
    if (n.type === 'dir') return 'folder';
    if (n.type === 'app') return (Emu.apps[n.app] && Emu.apps[n.app].icon) || 'file';
    if (n.ext === 'img' || /^(png|jpg|jpeg|gif|svg|webp)$/.test(n.ext || '')) return 'fileimg';
    if (n.ext === 'exe') return 'file';
    return 'filetext';
  }

  function typeName(entry) {
    var n = entry.node;
    if (n.type === 'dir') return 'File folder';
    if (n.type === 'app') return 'Shortcut';
    if (n.ext === 'exe') return 'Application';
    if (n.ext === 'img') return 'Image';
    return (n.ext || 'txt').toUpperCase() + ' File';
  }

  function launchExplorer(args) {
    var win = WM.create({
      appId: 'explorer', title: 'File Explorer', icon: 'explorer',
      width: 940, height: 600, minWidth: 480, minHeight: 320
    });

    var path = (args && args.path) || VFS.HOME;
    var hist = [path], hIdx = 0;
    var view = 'grid';
    var selected = [];
    var filter = '';
    var shown = [];

    win.body.innerHTML =
      '<div class="ex">' +
        '<div class="ex-toolbar">' +
          '<button class="e-btn" data-cmd="back" title="Back">' + Icons.get('back') + '</button>' +
          '<button class="e-btn" data-cmd="fwd" title="Forward">' + Icons.get('forward') + '</button>' +
          '<button class="e-btn" data-cmd="up" title="Up">' + Icons.get('chevronUp') + '</button>' +
          '<button class="e-btn" data-cmd="refresh" title="Refresh">' + Icons.get('refresh') + '</button>' +
          '<div class="ex-crumbs"></div>' +
          '<button class="e-btn" data-cmd="newfolder" title="New folder">' + Icons.get('newfolder') + '</button>' +
          '<button class="e-btn" data-cmd="view" title="Toggle view">' + Icons.get('grid') + '</button>' +
          '<input class="ex-search" placeholder="Search" spellcheck="false">' +
        '</div>' +
        '<div class="ex-body">' +
          '<div class="ex-nav"></div>' +
          '<div class="ex-files" tabindex="0"></div>' +
        '</div>' +
        '<div class="ex-status"></div>' +
      '</div>';

    var crumbs = U.$('.ex-crumbs', win.body);
    var nav = U.$('.ex-nav', win.body);
    var files = U.$('.ex-files', win.body);
    var status = U.$('.ex-status', win.body);
    var search = U.$('.ex-search', win.body);

    function go(p, push) {
      if (!VFS.exists(p)) { WM.alert('File Explorer', 'This location no longer exists:\n' + p, win); return; }
      path = p;
      selected = [];
      if (push !== false) {
        hist = hist.slice(0, hIdx + 1);
        hist.push(p);
        hIdx = hist.length - 1;
      }
      filter = '';
      search.value = '';
      render();
      win.setTitle(VFS.nameOf(path) + ' - File Explorer');
    }

    function renderNav() {
      var html = '<div class="ex-nav-head">Quick access</div>';
      QUICK.forEach(function (q) {
        html += '<div class="ex-nav-item' + (path === q.path ? ' active' : '') + '" data-path="' + U.esc(q.path) + '">' +
          Icons.get(q.icon) + '<span>' + q.name + '</span></div>';
      });
      html += '<div class="ex-nav-head">This PC</div>' +
        '<div class="ex-nav-item" data-path="C:">' + Icons.get('drive') + '<span>Local Disk (C:)</span></div>' +
        '<div class="ex-nav-item" data-path="' + U.esc(VFS.HOME) + '">' + Icons.get('user') + '<span>' + U.esc(Emu.state.user) + '</span></div>';
      nav.innerHTML = html;
    }

    function renderCrumbs() {
      var parts = VFS.split(path), acc = '';
      crumbs.innerHTML = parts.map(function (p, i) {
        acc = acc ? acc + '\\' + p : p;
        return (i ? '<span class="ex-sep">›</span>' : '') +
          '<span class="ex-crumb" data-path="' + U.esc(acc) + '">' + U.esc(p) + '</span>';
      }).join('');
    }

    function entries() {
      var list = filter ? VFS.search(path, filter, 60) : VFS.list(path);
      return list;
    }

    function render() {
      renderNav();
      renderCrumbs();
      var list = entries();
      U.$('[data-cmd="back"]', win.body).classList.toggle('disabled', hIdx <= 0);
      U.$('[data-cmd="fwd"]', win.body).classList.toggle('disabled', hIdx >= hist.length - 1);
      U.$('[data-cmd="view"]', win.body).innerHTML = Icons.get(view === 'grid' ? 'list' : 'grid');

      if (!list.length) {
        files.innerHTML = '<div class="ex-empty">' + Icons.get('folder') +
          '<span>' + (filter ? 'No matches' : 'This folder is empty') + '</span></div>';
      } else if (view === 'grid') {
        files.innerHTML = '<div class="ex-grid">' + list.map(function (e) {
          return '<div class="ex-item' + (selected.indexOf(e.path) >= 0 ? ' selected' : '') +
            '" data-path="' + U.esc(e.path) + '">' + Icons.get(iconFor(e)) +
            '<span>' + U.esc(e.name) + '</span></div>';
        }).join('') + '</div>';
      } else {
        files.innerHTML = '<div class="ex-list-hdr"><span>Name</span><span>Date modified</span><span>Type</span><span>Size</span></div>' +
          list.map(function (e) {
            return '<div class="ex-list-row' + (selected.indexOf(e.path) >= 0 ? ' selected' : '') +
              '" data-path="' + U.esc(e.path) + '"><span class="nm">' + Icons.get(iconFor(e)) +
              '<span>' + U.esc(e.name) + '</span></span>' +
              '<span class="muted">' + new Date(e.node.modified || Date.now()).toLocaleDateString() + '</span>' +
              '<span class="muted">' + typeName(e) + '</span>' +
              '<span class="muted">' + (e.node.type === 'dir' ? '' : U.fmtBytes(VFS.sizeOf(e.node))) + '</span></div>';
          }).join('');
      }
      shown = list;
      renderStatus();
    }

    function renderStatus() {
      var n = shown.length;
      status.innerHTML = '<span>' + n + ' item' + (n === 1 ? '' : 's') + '</span>' +
        (selected.length ? '<span>' + selected.length + ' selected</span>' : '') +
        '<span style="margin-left:auto">' + U.esc(path) + '</span>';
    }

    /**
     * Selecting must never rebuild the list. A rebuild swaps out the row under
     * the pointer between the two halves of a double-click, so the browser has
     * no shared element left to fire dblclick on and nothing ever opens. Toggle
     * the class on the rows that are already there instead.
     */
    function paintSelection() {
      U.$$('[data-path]', files).forEach(function (row) {
        row.classList.toggle('selected', selected.indexOf(row.dataset.path) >= 0);
      });
      renderStatus();
    }

    function open(p) {
      var node = VFS.get(p);
      if (!node) return;
      if (node.type === 'dir') return go(p);
      if (node.type === 'app') { Emu.launch(node.app, node.args); return; }
      if (node.ext === 'exe') {
        var map = { 'cmd.exe': 'terminal', 'notepad.exe': 'notepad', 'msedge.exe': 'edge' };
        var app = map[VFS.nameOf(p)];
        if (app) Emu.launch(app);
        else WM.alert('File Explorer', 'This app cannot run in the emulator.', win);
        return;
      }
      // Orion Office and Draw own their own extensions.
      var office = global.OfficeApps && global.OfficeApps.forExt(node.ext);
      if (office) { Emu.launch(office, { path: p }); return; }
      if (node.ext === 'odraw') { Emu.launch('draw', { path: p }); return; }

      if (node.ext === 'img' || /^(png|jpe?g|gif|svg|webp)$/.test(node.ext || '')) {
        Emu.launch('photos', { path: p });
        return;
      }
      Emu.launch('notepad', { path: p });
      Emu.pushRecent({ name: VFS.nameOf(p), path: p, app: 'notepad' });
    }

    // ---- events ----
    win.body.addEventListener('click', function (e) {
      var navItem = e.target.closest('.ex-nav-item, .ex-crumb');
      if (navItem) { go(navItem.dataset.path); return; }

      var cmd = e.target.closest('[data-cmd]');
      if (cmd) {
        var c = cmd.dataset.cmd;
        if (c === 'back' && hIdx > 0) { hIdx--; go(hist[hIdx], false); }
        else if (c === 'fwd' && hIdx < hist.length - 1) { hIdx++; go(hist[hIdx], false); }
        else if (c === 'up') { var up = VFS.parentOf(path); if (up) go(up); }
        else if (c === 'refresh') render();
        else if (c === 'view') { view = view === 'grid' ? 'list' : 'grid'; render(); }
        else if (c === 'newfolder') newFolder();
        return;
      }

      var item = e.target.closest('[data-path]');
      if (item && files.contains(item)) {
        if (e.ctrlKey) {
          var i = selected.indexOf(item.dataset.path);
          i >= 0 ? selected.splice(i, 1) : selected.push(item.dataset.path);
        } else selected = [item.dataset.path];
        paintSelection();
        return;
      }
      if (files.contains(e.target)) { selected = []; paintSelection(); }
    });

    files.addEventListener('dblclick', function (e) {
      var item = e.target.closest('[data-path]');
      if (item) open(item.dataset.path);
    });

    files.addEventListener('contextmenu', function (e) {
      e.preventDefault();
      var item = e.target.closest('[data-path]');
      if (item) {
        selected = selected.indexOf(item.dataset.path) >= 0 ? selected : [item.dataset.path];
        render();
        itemMenu(item.dataset.path, e.clientX, e.clientY);
      } else {
        selected = [];
        render();
        emptyMenu(e.clientX, e.clientY);
      }
    });

    files.addEventListener('keydown', function (e) {
      if (e.key === 'Delete' && selected.length) { del(selected.slice()); }
      if (e.key === 'F2' && selected.length === 1) { rename(selected[0]); }
      if (e.key === 'Enter' && selected.length === 1) { open(selected[0]); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        selected = entries().map(function (x) { return x.path; });
        render();
      }
    });

    search.addEventListener('input', U.debounce(function () {
      filter = search.value.trim();
      selected = [];
      render();
    }, 200));

    function itemMenu(p, x, y) {
      var node = VFS.get(p);
      global.Shell.contextMenu([
        { label: 'Open', icon: 'open', action: function () { open(p); } },
        node && node.type === 'file' ? { label: 'Open with Notepad', icon: 'notepad', action: function () { Emu.launch('notepad', { path: p }); } } : null,
        { sep: true },
        { label: 'Cut', icon: 'cut', action: function () { Emu.clipboard = { op: 'cut', paths: selected.slice() }; } },
        { label: 'Copy', icon: 'copy', action: function () { Emu.clipboard = { op: 'copy', paths: selected.slice() }; } },
        { label: 'Rename', icon: 'rename', key: 'F2', action: function () { rename(p); } },
        { label: 'Delete', icon: 'trash', key: 'Del', action: function () { del(selected.slice()); } },
        { sep: true },
        { label: 'Properties', icon: 'info', action: function () { properties(p); } }
      ].filter(Boolean), x, y);
    }

    function emptyMenu(x, y) {
      global.Shell.contextMenu([
        { label: 'New folder', icon: 'newfolder', action: newFolder },
        { label: 'New text document', icon: 'notepad', action: newFile },
        { sep: true },
        { label: 'Paste', icon: 'paste', disabled: !Emu.clipboard, action: paste },
        { label: 'Refresh', icon: 'refresh', action: render },
        { sep: true },
        { label: 'Open in Terminal', icon: 'terminal', action: function () { Emu.launch('terminal', { cwd: path }); } }
      ], x, y);
    }

    function newFolder() {
      var name = VFS.uniqueName(path, 'New folder');
      VFS.mkdir(path + '\\' + name);
      render();
      rename(path + '\\' + name);
    }

    function newFile() {
      var name = VFS.uniqueName(path, 'New Text Document', '.txt');
      VFS.write(path + '\\' + name, '', 'txt');
      render();
      rename(path + '\\' + name);
    }

    function rename(p) {
      WM.prompt('Rename', 'Enter a new name for "' + VFS.nameOf(p) + '"', VFS.nameOf(p), win).then(function (v) {
        if (!v || v === VFS.nameOf(p)) return;
        if (!VFS.rename(p, v)) WM.alert('Rename', 'A file with that name already exists.', win);
        selected = [VFS.parentOf(p) + '\\' + v];
        render();
      });
    }

    function del(paths) {
      WM.confirm('Delete', paths.length === 1
        ? 'Are you sure you want to move "' + VFS.nameOf(paths[0]) + '" to the Recycle Bin?'
        : 'Move ' + paths.length + ' items to the Recycle Bin?', win).then(function (ok) {
        if (!ok) return;
        paths.forEach(function (p) { VFS.remove(p); });
        selected = [];
        render();
      });
    }

    function paste() {
      if (!Emu.clipboard) return;
      Emu.clipboard.paths.forEach(function (p) {
        VFS.copy(p, path);
        if (Emu.clipboard.op === 'cut') VFS.remove(p);
      });
      if (Emu.clipboard.op === 'cut') Emu.clipboard = null;
      render();
    }

    function properties(p) {
      var node = VFS.get(p);
      WM.alert(VFS.nameOf(p) + ' Properties',
        'Type: ' + typeName({ node: node }) + '\n' +
        'Location: ' + VFS.parentOf(p) + '\n' +
        'Size: ' + U.fmtBytes(VFS.sizeOf(node)) + '\n' +
        'Modified: ' + new Date(node.modified || Date.now()).toLocaleString(), win);
    }

    var onVfs = Emu.on('vfs', function (changed) {
      if (changed === path || changed === '') render();
    });
    win.onClose = function () { Emu.off('vfs', onVfs); };

    go(path, false);
    return win;
  }

  Emu.registerApp({
    id: 'explorer', name: 'File Explorer', icon: 'explorer', pinned: true,
    desc: 'Browse your files', launch: launchExplorer
  });
})(window);
