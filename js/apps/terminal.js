/* ===== Terminal (PowerShell-flavoured) ===== */
(function (global) {
  'use strict';

  var Emu = global.Emu, U = Emu.util, WM = global.WM, VFS = global.VFS;

  function launchTerminal(args) {
    var win = WM.create({
      appId: 'terminal', title: 'Orion Terminal', icon: 'terminal',
      width: 860, height: 520, minWidth: 420, minHeight: 260
    });

    var cwd = (args && args.cwd) || VFS.HOME;
    var history = [], hIdx = -1;

    win.body.innerHTML =
      '<div class="term"><div class="term-out"></div>' +
      '<div class="term-in"><span class="ps"></span><input spellcheck="false" autocomplete="off"></div></div>';

    var out = U.$('.term-out', win.body);
    var input = U.$('.term-in input', win.body);
    var ps = U.$('.term-in .ps', win.body);

    function prompt() { return 'PS ' + cwd + '>'; }
    function sync() { ps.textContent = prompt(); }

    function print(text, cls) {
      var line = document.createElement('div');
      line.className = 'term-line' + (cls ? ' ' + cls : '');
      line.innerHTML = text;
      out.appendChild(line);
      out.scrollTop = out.scrollHeight;
    }

    function resolve(p) {
      if (!p) return cwd;
      p = p.replace(/^["']|["']$/g, '');
      if (/^[a-z]:/i.test(p)) return p.replace(/\//g, '\\');
      if (p === '.') return cwd;
      if (p === '..') return VFS.parentOf(cwd) || cwd;
      if (p === '~') return VFS.HOME;
      if (p.charAt(0) === '\\' || p.charAt(0) === '/') return 'C:' + p.replace(/\//g, '\\');
      var parts = VFS.split(cwd);
      p.replace(/\//g, '\\').split('\\').forEach(function (seg) {
        if (seg === '.' || !seg) return;
        if (seg === '..') parts.pop();
        else parts.push(seg);
      });
      return parts.join('\\');
    }

    var COMMANDS = {
      help: function () {
        print('<span class="c">Available commands</span>');
        print('  help            this list\n' +
              '  dir | ls        list the current directory\n' +
              '  cd &lt;path&gt;       change directory (cd .. to go up)\n' +
              '  pwd             print the working directory\n' +
              '  type | cat      print a file\n' +
              '  echo &lt;text&gt;     print text  (echo hi &gt; file.txt writes it)\n' +
              '  mkdir &lt;name&gt;    create a directory\n' +
              '  del | rm        delete a file or folder\n' +
              '  copy &lt;a&gt; &lt;b&gt;    copy into a folder\n' +
              '  ren &lt;a&gt; &lt;b&gt;     rename\n' +
              '  tree            show the directory tree\n' +
              '  start &lt;app&gt;     launch an app (edge, notepad, explorer, calc…)\n' +
              '  edge &lt;url&gt;      open a URL in Microsoft Edge\n' +
              '  ipconfig        network information\n' +
              '  systeminfo      emulator information\n' +
              '  whoami, hostname, date, ver\n' +
              '  cls | clear     clear the screen\n' +
              '  exit            close this window');
      },
      dir: function () {
        var list = VFS.list(cwd);
        if (!list.length) { print('<span class="d">(empty)</span>'); return; }
        print('\n    Directory: ' + cwd + '\n');
        print('<span class="d">Mode   LastWriteTime        Length Name</span>');
        print('<span class="d">----   -------------        ------ ----</span>');
        list.forEach(function (e) {
          var isDir = e.node.type === 'dir';
          var date = new Date(e.node.modified || Date.now()).toLocaleString();
          var size = isDir ? '' : String(VFS.sizeOf(e.node));
          print((isDir ? 'd----' : '-a---') + '  ' + date.padEnd(20).slice(0, 20) + ' ' +
            size.padStart(6) + ' ' + '<span class="' + (isDir ? 'c' : '') + '">' + U.esc(e.name) + '</span>');
        });
        print('');
      },
      cd: function (a) {
        if (!a.length) { print(cwd); return; }
        var t = resolve(a[0]);
        var node = VFS.get(t);
        if (!node) return print('<span class="r">cd: cannot find path \'' + U.esc(a[0]) + '\'</span>');
        if (node.type !== 'dir') return print('<span class="r">cd: not a directory</span>');
        cwd = t;
        sync();
      },
      pwd: function () { print(cwd); },
      type: function (a) {
        if (!a.length) return print('<span class="r">type: missing file</span>');
        var c = VFS.read(resolve(a[0]));
        if (c == null) return print('<span class="r">type: cannot find \'' + U.esc(a[0]) + '\'</span>');
        print(U.esc(c) || '<span class="d">(empty file)</span>');
      },
      echo: function (a, raw) {
        var m = raw.match(/^(.*?)\s*>\s*(\S+)\s*$/);
        if (m) {
          var target = resolve(m[2]);
          VFS.write(target, m[1].replace(/^["']|["']$/g, '') + '\r\n', 'txt');
          print('<span class="g">Wrote ' + U.esc(VFS.nameOf(target)) + '</span>');
          return;
        }
        print(U.esc(raw));
      },
      mkdir: function (a) {
        if (!a.length) return print('<span class="r">mkdir: missing name</span>');
        VFS.mkdir(resolve(a[0]));
        print('<span class="g">Created ' + U.esc(a[0]) + '</span>');
      },
      del: function (a) {
        if (!a.length) return print('<span class="r">del: missing name</span>');
        print(VFS.remove(resolve(a[0]))
          ? '<span class="g">Deleted ' + U.esc(a[0]) + '</span>'
          : '<span class="r">del: cannot find \'' + U.esc(a[0]) + '\'</span>');
      },
      copy: function (a) {
        if (a.length < 2) return print('<span class="r">copy: usage copy &lt;file&gt; &lt;folder&gt;</span>');
        print(VFS.copy(resolve(a[0]), resolve(a[1]))
          ? '<span class="g">1 file(s) copied.</span>'
          : '<span class="r">copy: failed</span>');
      },
      ren: function (a) {
        if (a.length < 2) return print('<span class="r">ren: usage ren &lt;old&gt; &lt;new&gt;</span>');
        print(VFS.rename(resolve(a[0]), a[1]) ? '<span class="g">Renamed.</span>' : '<span class="r">ren: failed</span>');
      },
      tree: function () {
        (function walk(p, indent, depth) {
          if (depth > 4) return;
          VFS.list(p).forEach(function (e, i, arr) {
            var last = i === arr.length - 1;
            print('<span class="d">' + indent + (last ? '└── ' : '├── ') + '</span>' +
              '<span class="' + (e.node.type === 'dir' ? 'c' : '') + '">' + U.esc(e.name) + '</span>');
            if (e.node.type === 'dir') walk(e.path, indent + (last ? '    ' : '│   '), depth + 1);
          });
        })(cwd, '', 0);
      },
      start: function (a) {
        var alias = { calc: 'calculator', msedge: 'edge', browser: 'edge', explorer: 'explorer', notepad: 'notepad', cmd: 'terminal', taskmgr: 'taskmgr' };
        var id = alias[(a[0] || '').toLowerCase()] || (a[0] || '').toLowerCase();
        if (!Emu.apps[id]) return print('<span class="r">start: unknown app \'' + U.esc(a[0] || '') + '\'</span>');
        Emu.launch(id);
        print('<span class="g">Started ' + Emu.apps[id].name + '</span>');
      },
      edge: function (a) {
        Emu.apps.edge.open(a.join(' ') || 'edge://newtab');
        print('<span class="g">Opening Microsoft Edge…</span>');
      },
      ipconfig: function () {
        print('\nWindows IP Configuration (emulated)\n');
        print('Ethernet adapter Emulated:\n');
        print('   Connection-specific DNS Suffix  . : emu.local');
        print('   IPv4 Address. . . . . . . . . . . : 192.168.0.' + (10 + Emu.state.user.length % 40));
        print('   Subnet Mask . . . . . . . . . . . : 255.255.255.0');
        print('   Default Gateway . . . . . . . . . : 192.168.0.1\n');
      },
      systeminfo: function () {
        print('Host Name:                 ORION-PC');
        print('OS Name:                   Orion');
        print('OS Version:                1.0.0 build 22621');
        print('System Type:               ' + (navigator.platform || 'browser'));
        print('Logical Processors:        ' + (navigator.hardwareConcurrency || 4));
        print('Screen:                    ' + window.innerWidth + 'x' + window.innerHeight);
        print('Storage:                   localStorage (' + U.fmtBytes(VFS.sizeOf(VFS.get('C:'))) + ' used)');
      },
      whoami: function () { print('orion-pc\\' + Emu.state.user.toLowerCase().replace(/\s+/g, '')); },
      hostname: function () { print('ORION-PC'); },
      date: function () { print(new Date().toString()); },
      ver: function () { print('\nOrion [Version 1.0.0]\n'); },
      cls: function () { out.innerHTML = ''; },
      exit: function () { win.close(); }
    };
    COMMANDS.ls = COMMANDS.dir;
    COMMANDS.cat = COMMANDS.type;
    COMMANDS.rm = COMMANDS.del;
    COMMANDS.clear = COMMANDS.cls;
    COMMANDS.md = COMMANDS.mkdir;
    COMMANDS.erase = COMMANDS.del;
    COMMANDS.calc = function () { COMMANDS.start(['calculator']); };
    COMMANDS.notepad = function (a) { Emu.launch('notepad', a.length ? { path: resolve(a[0]) } : null); };

    function run(raw) {
      var line = raw.trim();
      print('<span class="y">' + U.esc(prompt()) + '</span> ' + U.esc(raw));
      if (!line) return;
      history.unshift(line);
      hIdx = -1;
      var parts = line.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
      var cmd = parts[0].toLowerCase();
      var rest = parts.slice(1).map(function (p) { return p.replace(/^"|"$/g, ''); });
      if (COMMANDS[cmd]) {
        try { COMMANDS[cmd](rest, line.slice(cmd.length).trim()); }
        catch (err) { print('<span class="r">' + U.esc(err.message) + '</span>'); }
      } else {
        print('<span class="r">' + U.esc(cmd) + ' : The term \'' + U.esc(cmd) +
          '\' is not recognized as a name of a cmdlet, function or operable program.</span>');
        print('<span class="d">Type \'help\' for a list of commands.</span>');
      }
    }

    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { run(input.value); input.value = ''; out.scrollTop = out.scrollHeight; }
      else if (e.key === 'ArrowUp') { e.preventDefault(); if (hIdx < history.length - 1) input.value = history[++hIdx]; }
      else if (e.key === 'ArrowDown') { e.preventDefault(); input.value = hIdx > 0 ? history[--hIdx] : (hIdx = -1, ''); }
      else if (e.ctrlKey && e.key.toLowerCase() === 'l') { e.preventDefault(); out.innerHTML = ''; }
    });
    win.body.addEventListener('click', function (e) {
      if (!window.getSelection().toString()) input.focus();
    });

    print('<span class="c">Orion Terminal</span> <span class="d">- Orion, version 1.0.0</span>');
    print('<span class="d">Type \'help\' to see what this shell can do.</span>\n');
    sync();
    setTimeout(function () { input.focus(); }, 60);
    return win;
  }

  Emu.registerApp({
    id: 'terminal', name: 'Terminal', icon: 'terminal', pinned: true,
    desc: 'Command line for the virtual file system', launch: launchTerminal
  });
})(window);
