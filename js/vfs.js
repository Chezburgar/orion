/* ===== Virtual file system (localStorage backed) ===== */
(function (global) {
  'use strict';

  var Emu = global.Emu;
  var KEY = 'win11emu.vfs.v1';
  var HOME = 'C:\\Users\\Chase';

  function dir(children) { return { type: 'dir', children: children || {}, modified: Date.now() }; }
  function file(content, ext) {
    return { type: 'file', ext: ext || 'txt', content: content || '', modified: Date.now() };
  }
  function link(appId, args) { return { type: 'app', app: appId, args: args || null, modified: Date.now() }; }

  function seed() {
    return {
      'C:': dir({
        'Users': dir({
          'Chase': dir({
            'Desktop': dir({
              'Google Chrome': link('edge'),
              'File Explorer': link('explorer'),
              'Notepad': link('notepad'),
              'Read me first.txt': file(
                'Welcome to the Orion!\r\n\r\n' +
                'Everything here runs in your browser - no VM, no install.\r\n\r\n' +
                'Try this:\r\n' +
                '  * Press the Windows key (or click Start) to open the Start menu\r\n' +
                '  * Open Google Chrome to search the web\r\n' +
                '  * Right-click the desktop for the Windows 11 context menu\r\n' +
                '  * Drag a window to a screen edge to snap it\r\n' +
                '  * Hover a window\'s maximize button for Snap Layouts\r\n' +
                '  * Win+D shows the desktop, Win+Tab opens Task View\r\n\r\n' +
                'Files you create are saved to this browser\'s local storage.\r\n')
            }),
            'Documents': dir({
              'Notes.txt': file('Shopping list\r\n- coffee\r\n- HDMI cable\r\n- more RAM (always)\r\n'),
              'Project plan.txt': file('Q3 plan\r\n=======\r\n1. Ship the thing\r\n2. Fix the thing\r\n3. Ship it again\r\n'),
              'Work': dir({
                'timesheet.txt': file('Mon 8h\r\nTue 8h\r\nWed 8h\r\nThu 8h\r\nFri 6h\r\n')
              })
            }),
            'Downloads': dir({}),
            'Pictures': dir({
              'Bloom.svg': file('assets/wall-bloom.svg', 'img'),
              'Flow.svg': file('assets/wall-flow.svg', 'img'),
              'Glow.svg': file('assets/wall-dark.svg', 'img'),
              'Sunset.svg': file('assets/lock.svg', 'img')
            }),
            'Music': dir({}),
            'Videos': dir({})
          })
        }),
        'Windows': dir({
          'System32': dir({
            'drivers': dir({ 'etc': dir({ 'hosts': file('# Copyright (c) 1993-2009 Microsoft Corp.\r\n127.0.0.1 localhost\r\n') }) }),
            'cmd.exe': file('', 'exe'),
            'notepad.exe': file('', 'exe')
          }),
          'Web': dir({ 'Wallpaper': dir({}) })
        }),
        'Program Files': dir({
          'Google': dir({ 'Chrome': dir({ 'Application': dir({ 'chrome.exe': file('', 'exe') }) }) })
        })
      })
    };
  }

  var tree;
  try {
    var raw = localStorage.getItem(KEY);
    tree = raw ? JSON.parse(raw) : seed();
  } catch (e) { tree = seed(); }

  var saveTimer = null;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      try { localStorage.setItem(KEY, JSON.stringify(tree)); } catch (e) {}
    }, 150);
  }

  function split(p) {
    return String(p).replace(/\//g, '\\').split('\\').filter(function (s) { return s.length; });
  }
  function join() {
    return Array.prototype.slice.call(arguments).filter(Boolean).join('\\').replace(/\\+/g, '\\');
  }

  function get(p) {
    var parts = split(p), node = { type: 'dir', children: tree }, i;
    for (i = 0; i < parts.length; i++) {
      if (!node || node.type !== 'dir' || !node.children) return null;
      node = node.children[parts[i]];
      if (!node) return null;
    }
    return node;
  }

  function parentOf(p) {
    var parts = split(p);
    parts.pop();
    return parts.join('\\');
  }
  function nameOf(p) {
    var parts = split(p);
    return parts[parts.length - 1] || p;
  }

  function mkdir(p) {
    var parts = split(p), node = { type: 'dir', children: tree }, i;
    for (i = 0; i < parts.length; i++) {
      if (!node.children[parts[i]]) node.children[parts[i]] = dir();
      node = node.children[parts[i]];
      if (node.type !== 'dir') return null;
    }
    save();
    return node;
  }

  function write(p, content, ext) {
    var parent = get(parentOf(p));
    if (!parent) parent = mkdir(parentOf(p));
    if (!parent || parent.type !== 'dir') return null;
    var n = nameOf(p), existing = parent.children[n];
    if (existing && existing.type === 'file') {
      existing.content = content;
      existing.modified = Date.now();
      if (ext) existing.ext = ext;
    } else {
      parent.children[n] = file(content, ext || (n.split('.').pop() || 'txt').toLowerCase());
    }
    save();
    VFS.emitChange(parentOf(p));
    return parent.children[n];
  }

  function remove(p) {
    var parent = get(parentOf(p));
    if (!parent || parent.type !== 'dir') return false;
    var n = nameOf(p);
    if (!parent.children[n]) return false;
    delete parent.children[n];
    save();
    VFS.emitChange(parentOf(p));
    return true;
  }

  function rename(p, newName) {
    var parent = get(parentOf(p));
    if (!parent || parent.type !== 'dir') return false;
    var n = nameOf(p);
    if (!parent.children[n] || parent.children[newName]) return false;
    parent.children[newName] = parent.children[n];
    delete parent.children[n];
    save();
    VFS.emitChange(parentOf(p));
    return true;
  }

  function copy(p, destDir) {
    var node = get(p);
    if (!node) return false;
    var target = get(destDir);
    if (!target || target.type !== 'dir') return false;
    var base = nameOf(p), name = base, i = 2;
    while (target.children[name]) {
      var dot = base.lastIndexOf('.');
      name = dot > 0 ? base.slice(0, dot) + ' (' + i + ')' + base.slice(dot) : base + ' (' + i + ')';
      i++;
    }
    target.children[name] = JSON.parse(JSON.stringify(node));
    target.children[name].modified = Date.now();
    save();
    VFS.emitChange(destDir);
    return join(destDir, name);
  }

  function list(p) {
    var node = get(p);
    if (!node || node.type !== 'dir') return [];
    return Object.keys(node.children).map(function (k) {
      return { name: k, node: node.children[k], path: join(p, k) };
    }).sort(function (a, b) {
      var ad = a.node.type === 'dir', bd = b.node.type === 'dir';
      if (ad !== bd) return ad ? -1 : 1;
      return a.name.localeCompare(b.name, undefined, { numeric: true });
    });
  }

  function sizeOf(node) {
    if (!node) return 0;
    if (node.type === 'file') return (node.content || '').length;
    if (node.type === 'app') return 1024;
    var total = 0;
    for (var k in node.children) total += sizeOf(node.children[k]);
    return total;
  }

  /** Recursive name search from a root path. */
  function search(rootPath, query, limit) {
    var out = [], q = String(query).toLowerCase();
    (function walk(p, depth) {
      if (out.length >= (limit || 40) || depth > 6) return;
      list(p).forEach(function (e) {
        if (out.length >= (limit || 40)) return;
        if (e.name.toLowerCase().indexOf(q) >= 0) out.push(e);
        if (e.node.type === 'dir') walk(e.path, depth + 1);
      });
    })(rootPath, 0);
    return out;
  }

  var VFS = {
    HOME: HOME,
    DESKTOP: HOME + '\\Desktop',
    get: get, list: list, mkdir: mkdir, write: write, remove: remove, rename: rename, copy: copy,
    split: split, join: join, parentOf: parentOf, nameOf: nameOf, sizeOf: sizeOf, search: search,
    file: file, dir: dir, link: link,
    save: save,
    exists: function (p) { return !!get(p); },
    read: function (p) { var n = get(p); return n && n.type === 'file' ? n.content : null; },
    /** Unique child name inside a directory, e.g. "New folder (2)". */
    uniqueName: function (dirPath, base, ext) {
      var node = get(dirPath);
      if (!node) return base + (ext || '');
      var name = base + (ext || ''), i = 2;
      while (node.children[name]) { name = base + ' (' + i + ')' + (ext || ''); i++; }
      return name;
    },
    emitChange: function (p) { if (Emu) Emu.emit('vfs', p); },
    reseed: function () { tree = seed(); save(); if (Emu) Emu.emit('vfs', ''); }
  };

  global.VFS = VFS;
})(window);
