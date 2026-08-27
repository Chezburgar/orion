/* ===== Settings ===== */
(function (global) {
  'use strict';

  var Emu = global.Emu, U = Emu.util, Icons = global.Icons, WM = global.WM, VFS = global.VFS;

  var PAGES = [
    { id: 'system', name: 'System', icon: 'monitor' },
    { id: 'personalization', name: 'Personalisation', icon: 'brush' },
    { id: 'apps', name: 'Apps', icon: 'apps' },
    { id: 'accounts', name: 'Accounts', icon: 'user' },
    { id: 'network', name: 'Network & internet', icon: 'network' },
    { id: 'privacy', name: 'Privacy & security', icon: 'privacy' },
    { id: 'update', name: 'Windows Update', icon: 'update' },
    { id: 'about', name: 'About', icon: 'info' }
  ];

  function card(icon, title, sub, right) {
    return '<div class="st-card">' + Icons.get(icon) +
      '<div class="lbl"><b>' + title + '</b><small>' + sub + '</small></div>' + (right || '') + '</div>';
  }

  function sw(on, act) { return '<div class="sw' + (on ? ' on' : '') + '" data-act="' + act + '"></div>'; }

  function launchSettings(args) {
    var win = WM.create({
      appId: 'settings', title: 'Settings', icon: 'settings',
      width: 940, height: 640, minWidth: 520, minHeight: 380
    });

    var page = (args && args.page) || 'system';
    var s = Emu.state;

    win.body.innerHTML = '<div class="st"><div class="st-nav"></div><div class="st-content"></div></div>';
    var nav = U.$('.st-nav', win.body);
    var content = U.$('.st-content', win.body);

    function renderNav() {
      nav.innerHTML = '<div class="st-head"><span class="avatar"></span><div><b>' + U.esc(s.user) + '</b>' +
        '<small>Local account</small></div></div>' +
        PAGES.map(function (p) {
          return '<div class="st-nav-item' + (p.id === page ? ' active' : '') + '" data-page="' + p.id + '">' +
            Icons.get(p.icon) + '<span>' + p.name + '</span></div>';
        }).join('');
    }

    function render() {
      renderNav();
      content.scrollTop = 0;
      content.innerHTML = ({
        system: function () {
          return '<h2>System</h2>' +
            card('sound', 'Volume', 'Output level for the emulated system',
              '<input type="range" min="0" max="100" value="' + s.volume + '" data-act="volume" style="max-width:180px">') +
            card('brightness', 'Brightness', 'Dims the whole emulator',
              '<input type="range" min="30" max="100" value="' + s.brightness + '" data-act="brightness" style="max-width:180px">') +
            card('monitor', 'Display resolution', 'Follows your real browser window',
              '<span class="muted" data-res>' + window.innerWidth + ' × ' + window.innerHeight + '</span>') +
            card('night', 'Night light', 'Warmer colours on the desktop', sw(s.quick.night, 'night')) +
            '<h3>Storage</h3>' +
            card('drive', 'Local Disk (C:)', 'Virtual file system stored in this browser',
              '<span class="muted">' + U.fmtBytes(VFS.sizeOf(VFS.get('C:'))) + ' used</span>');
        },
        personalization: function () {
          var walls = Emu.WALLPAPERS.map(function (w) {
            var style = /^#/.test(w.value) ? 'background:' + w.value : 'background-image:url(' + w.value + ')';
            return '<div class="wall-opt' + (s.wallpaper === w.value ? ' sel' : '') + '" style="' + style +
              '" data-wall="' + U.esc(w.value) + '" title="' + w.name + '"></div>';
          }).join('');
          var accents = Emu.ACCENTS.map(function (a) {
            return '<div class="acc' + (s.accent === a ? ' sel' : '') + '" style="background:' + a + '" data-accent="' + a + '"></div>';
          }).join('');
          return '<h2>Personalisation</h2><h3>Background</h3><div class="wall-grid">' + walls + '</div>' +
            '<h3>Colours</h3>' +
            card('moon', 'Choose your mode', 'Light or dark across the whole shell',
              '<select class="st-select" data-act="theme">' +
              '<option value="dark"' + (s.theme === 'dark' ? ' selected' : '') + '>Dark</option>' +
              '<option value="light"' + (s.theme === 'light' ? ' selected' : '') + '>Light</option></select>') +
            card('brush', 'Transparency effects', 'Acrylic and mica blur on menus and the taskbar', sw(s.transparency, 'transparency')) +
            '<h3>Accent colour</h3><div class="acc-grid">' + accents + '</div>' +
            '<h3>Lock screen</h3>' +
            card('lock', 'Lock the emulator', 'Show the lock screen now',
              '<button class="btn" data-act="lock">Lock</button>');
        },
        apps: function () {
          return '<h2>Apps</h2><h3>Installed apps</h3>' +
            Emu.appOrder.map(function (id) {
              var a = Emu.apps[id];
              return '<div class="st-card">' + Icons.get(a.icon) +
                '<div class="lbl"><b>' + U.esc(a.name) + '</b><small>' + U.esc(a.desc || '') + '</small></div>' +
                '<button class="btn" data-open-app="' + id + '">Open</button></div>';
            }).join('') +
            '<h3>Default apps</h3>' +
            card('edge', 'Web browser', 'Microsoft Edge (emulated)', '<span class="muted">Default</span>') +
            card('notepad', 'Text editor', 'Notepad', '<span class="muted">Default</span>');
        },
        accounts: function () {
          return '<h2>Accounts</h2>' +
            '<div class="st-card"><span class="avatar" style="width:44px;height:44px"></span>' +
            '<div class="lbl"><b>' + U.esc(s.user) + '</b><small>Local account &middot; Administrator</small></div>' +
            '<button class="btn" data-act="rename-user">Change name</button></div>' +
            card('key', 'Sign-in options', 'No password is required in the emulator', '<span class="muted">Off</span>') +
            card('people', 'Other users', 'Family and other people', '<span class="muted">None</span>');
        },
        network: function () {
          return '<h2>Network &amp; internet</h2>' +
            card('wifi', 'Wi-Fi', s.quick.wifi ? 'Connected to Emulated-Network-5G' : 'Disconnected', sw(s.quick.wifi, 'wifi')) +
            card('airplane', 'Aeroplane mode', 'Stops all simulated radios', sw(s.quick.airplane, 'airplane')) +
            card('bluetooth', 'Bluetooth', 'Discoverable as EMU-PC', sw(s.quick.bluetooth, 'bluetooth')) +
            '<h3>Properties</h3>' +
            '<div class="st-card"><div class="lbl"><div class="st-about">' +
            '<span>IPv4 address</span><b>192.168.0.' + (10 + (Emu.state.user.length % 40)) + '</b>' +
            '<span>DNS</span><b>1.1.1.1</b>' +
            '<span>Link speed</span><b>867 Mbps</b>' +
            '<span>Connection</span><b>' + (navigator.onLine ? 'Your real connection is online' : 'Your real connection is offline') + '</b>' +
            '</div></div></div>';
        },
        privacy: function () {
          return '<h2>Privacy &amp; security</h2>' +
            card('shield', 'Windows Security (simulated)', 'No threats found - because nothing here can run',
              '<span class="muted">Protected</span>') +
            card('privacy', 'Location', 'The emulator never asks for your location', '<span class="muted">Off</span>') +
            card('trash', 'Clear emulator data', 'Wipes settings, files and browsing data from this browser',
              '<button class="btn" data-act="reset">Reset</button>') +
            '<div class="st-card"><div class="lbl"><small>Everything you do here stays in this browser\'s localStorage. ' +
            'Nothing is uploaded anywhere.</small></div></div>';
        },
        update: function () {
          return '<h2>Windows Update</h2>' +
            '<div class="st-card">' + Icons.get('check') +
            '<div class="lbl"><b>You\'re up to date</b><small>Last checked: just now</small></div>' +
            '<button class="btn primary" data-act="check-update">Check for updates</button></div>' +
            card('history', 'Update history', 'Emulator build 1.0.0 installed', '') +
            card('night', 'Active hours', 'Restarts are never required here', '<span class="muted">Always</span>');
        },
        about: function () {
          return '<h2>About</h2>' +
            '<div class="st-card"><div class="lbl"><div class="st-about">' +
            '<span>Device name</span><b>EMU-PC</b>' +
            '<span>Edition</span><b>Windows 11 Emulator</b>' +
            '<span>Version</span><b>1.0.0</b>' +
            '<span>Processor</span><b>' + (navigator.hardwareConcurrency || 4) + ' logical cores (your real CPU)</b>' +
            '<span>Renderer</span><b>' + U.esc((navigator.userAgent.match(/(Chrome|Firefox|Safari|Edg)\/[\d.]+/) || ['Browser'])[0]) + '</b>' +
            '<span>Storage</span><b>localStorage</b>' +
            '</div></div></div>' +
            '<div class="st-card"><div class="lbl"><small>This is an independent simulation of the Windows 11 interface. ' +
            'It is not affiliated with Microsoft and contains no Microsoft code.</small></div></div>';
        }
      }[page] || function () { return '<h2>Not found</h2>'; })();
    }

    win.body.addEventListener('click', function (e) {
      var p = e.target.closest('[data-page]');
      if (p) { page = p.dataset.page; render(); return; }

      var w = e.target.closest('[data-wall]');
      if (w) { s.wallpaper = w.dataset.wall; Emu.save(); Emu.applyTheme(); render(); return; }

      var a = e.target.closest('[data-accent]');
      if (a) { s.accent = a.dataset.accent; Emu.save(); Emu.applyTheme(); render(); return; }

      var oa = e.target.closest('[data-open-app]');
      if (oa) { Emu.launch(oa.dataset.openApp); return; }

      var act = e.target.closest('[data-act]');
      if (!act) return;
      var k = act.dataset.act;
      if (act.classList.contains('sw')) {
        if (k === 'transparency') { s.transparency = !s.transparency; }
        else { s.quick[k] = !s.quick[k]; if (k === 'airplane' && s.quick.airplane) { s.quick.wifi = false; s.quick.bluetooth = false; } }
        Emu.save(); Emu.applyTheme(); Emu.emit('quick'); render();
        return;
      }
      if (k === 'lock') { global.Shell.lock(); return; }
      if (k === 'reset') {
        WM.confirm('Reset emulator', 'This deletes all files, settings and browsing data stored by the emulator in this browser. Continue?', win)
          .then(function (ok) { if (ok) Emu.reset(); });
        return;
      }
      if (k === 'rename-user') {
        WM.prompt('Account name', 'What should we call you?', s.user, win).then(function (v) {
          if (!v) return;
          s.user = v.slice(0, 24);
          Emu.save(); Emu.emit('user'); render();
        });
        return;
      }
      if (k === 'check-update') {
        act.textContent = 'Checking…';
        setTimeout(function () {
          act.textContent = 'Check for updates';
          Emu.notify('Windows Update', 'Your emulator is up to date (build 1.0.0).', 'update');
        }, 1400);
      }
    });

    win.body.addEventListener('input', function (e) {
      var k = e.target.dataset.act;
      if (k === 'volume') { s.volume = +e.target.value; Emu.save(); Emu.emit('quick'); }
      if (k === 'brightness') { s.brightness = +e.target.value; Emu.save(); Emu.applyTheme(); Emu.emit('quick'); }
    });

    win.body.addEventListener('change', function (e) {
      if (e.target.dataset.act === 'theme') {
        s.theme = e.target.value;
        Emu.save(); Emu.applyTheme();
      }
    });

    var onQuick = Emu.on('quick', function () { if (page === 'system' || page === 'network') render(); });
    win.onClose = function () { Emu.off('quick', onQuick); };

    render();
    return win;
  }

  Emu.registerApp({
    id: 'settings', name: 'Settings', icon: 'settings', pinned: true,
    desc: 'Personalise the emulator', launch: launchSettings
  });
})(window);
