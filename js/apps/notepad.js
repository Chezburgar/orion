/* ===== Notepad ===== */
(function (global) {
  'use strict';

  var Emu = global.Emu, U = Emu.util, WM = global.WM, VFS = global.VFS;

  function launchNotepad(args) {
    var win = WM.create({
      appId: 'notepad', title: 'Untitled - Notepad', icon: 'notepad',
      width: 760, height: 560, minWidth: 380, minHeight: 260
    });

    var filePath = (args && args.path) || null;
    var dirty = false;
    var wrap = true;

    win.body.innerHTML =
      '<div class="np">' +
        '<div class="np-menu">' +
          '<button data-menu="file">File</button>' +
          '<button data-menu="edit">Edit</button>' +
          '<button data-menu="format">Format</button>' +
          '<button data-menu="view">View</button>' +
          '<span class="fname"></span>' +
        '</div>' +
        '<textarea class="np-area" spellcheck="false"></textarea>' +
        '<div class="np-status"></div>' +
      '</div>';

    var area = U.$('.np-area', win.body);
    var status = U.$('.np-status', win.body);
    var fname = U.$('.fname', win.body);

    function title() {
      var name = filePath ? VFS.nameOf(filePath) : 'Untitled';
      win.setTitle((dirty ? '*' : '') + name + ' - Notepad');
      fname.textContent = filePath || 'Not saved';
    }

    function load(p) {
      var content = VFS.read(p);
      if (content == null) { WM.alert('Notepad', 'Cannot open file:\n' + p, win); return; }
      filePath = p;
      area.value = content;
      dirty = false;
      title();
      updateStatus();
      Emu.pushRecent({ name: VFS.nameOf(p), path: p, app: 'notepad' });
    }

    function save(saveAs) {
      if (!filePath || saveAs) {
        return WM.prompt('Save As', 'Save the file as (full path or name):',
          filePath || (VFS.HOME + '\\Documents\\' + VFS.uniqueName(VFS.HOME + '\\Documents', 'Untitled', '.txt')), win)
          .then(function (v) {
            if (!v) return false;
            if (VFS.split(v).length < 2) v = VFS.HOME + '\\Documents\\' + v;
            if (!/\.[a-z0-9]+$/i.test(v)) v += '.txt';
            filePath = v;
            VFS.write(filePath, area.value, 'txt');
            dirty = false;
            title();
            Emu.notify('Notepad', 'Saved ' + VFS.nameOf(filePath), 'notepad');
            return true;
          });
      }
      VFS.write(filePath, area.value, 'txt');
      dirty = false;
      title();
      return Promise.resolve(true);
    }

    function updateStatus() {
      var upto = area.value.slice(0, area.selectionStart);
      var lines = upto.split('\n');
      status.innerHTML = '<span>Ln ' + lines.length + ', Col ' + (lines[lines.length - 1].length + 1) + '</span>' +
        '<span>' + area.value.length + ' characters</span>' +
        '<span>UTF-8</span>';
    }

    area.addEventListener('input', function () {
      if (!dirty) { dirty = true; title(); }
      updateStatus();
    });
    area.addEventListener('keyup', updateStatus);
    area.addEventListener('click', updateStatus);
    area.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(e.shiftKey); }
      if (e.key === 'Tab') {
        e.preventDefault();
        var s = area.selectionStart;
        area.value = area.value.slice(0, s) + '\t' + area.value.slice(area.selectionEnd);
        area.selectionStart = area.selectionEnd = s + 1;
      }
    });

    win.body.addEventListener('click', function (e) {
      var b = e.target.closest('[data-menu]');
      if (!b) return;
      var r = b.getBoundingClientRect();
      var menus = {
        file: [
          { label: 'New', icon: 'doc', key: 'Ctrl+N', action: function () { Emu.launch('notepad'); } },
          { label: 'Open…', icon: 'open', action: openDialog },
          { label: 'Save', icon: 'save', key: 'Ctrl+S', action: function () { save(false); } },
          { label: 'Save As…', icon: 'save', action: function () { save(true); } },
          { sep: true },
          { label: 'Exit', icon: 'x', action: function () { win.close(); } }
        ],
        edit: [
          { label: 'Select all', key: 'Ctrl+A', icon: 'list', action: function () { area.focus(); area.select(); } },
          { label: 'Copy', key: 'Ctrl+C', icon: 'copy', action: function () { document.execCommand('copy'); } },
          { label: 'Paste', key: 'Ctrl+V', icon: 'paste', action: function () { area.focus(); } },
          { sep: true },
          { label: 'Time/Date', key: 'F5', icon: 'history', action: function () {
            var s = area.selectionStart, stamp = U.fmtTime() + ' ' + U.fmtShortDate();
            area.value = area.value.slice(0, s) + stamp + area.value.slice(area.selectionEnd);
            dirty = true; title(); updateStatus();
          } }
        ],
        format: [
          { label: (wrap ? '✓ ' : '') + 'Word wrap', icon: 'list', action: function () {
            wrap = !wrap;
            area.style.whiteSpace = wrap ? 'pre-wrap' : 'pre';
            area.style.overflowX = wrap ? 'hidden' : 'auto';
          } }
        ],
        view: [
          { label: 'Zoom in', icon: 'plus', action: function () { zoom(1); } },
          { label: 'Zoom out', icon: 'minus', action: function () { zoom(-1); } },
          { label: 'Restore default zoom', icon: 'refresh', action: function () { area.style.fontSize = '13.5px'; } }
        ]
      };
      global.Shell.contextMenu(menus[b.dataset.menu], r.left, r.bottom + 4);
    });

    function zoom(dir) {
      var cur = parseFloat(getComputedStyle(area).fontSize);
      area.style.fontSize = U.clamp(cur + dir * 1.5, 9, 34) + 'px';
    }

    function openDialog() {
      var list = VFS.search(VFS.HOME, '.', 60).filter(function (e) {
        return e.node.type === 'file' && e.node.ext !== 'img' && e.node.ext !== 'exe';
      });
      global.Shell.picker('Open', list.map(function (e) {
        return { label: e.name, sub: VFS.parentOf(e.path), icon: 'filetext', value: e.path };
      })).then(function (p) { if (p) load(p); });
    }

    win.onClose = function () {
      if (!dirty) return true;
      WM.dialog({
        title: 'Notepad', message: 'Do you want to save changes to ' + (filePath ? VFS.nameOf(filePath) : 'Untitled') + '?',
        win: win,
        buttons: [{ label: 'Save', value: 'save', primary: true }, { label: "Don't save", value: 'no' }, { label: 'Cancel', value: null }]
      }).then(function (v) {
        if (v === 'no') { dirty = false; win.close(); }
        if (v === 'save') Promise.resolve(save(false)).then(function (ok) { if (ok) { dirty = false; win.close(); } });
      });
      return false;
    };

    area.style.whiteSpace = 'pre-wrap';
    if (filePath) load(filePath); else { title(); updateStatus(); }
    setTimeout(function () { area.focus(); }, 60);
    return win;
  }

  Emu.registerApp({
    id: 'notepad', name: 'Notepad', icon: 'notepad', pinned: true,
    desc: 'Edit text files', launch: launchNotepad
  });
})(window);
