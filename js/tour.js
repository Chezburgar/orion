/* ===== Orion setup and guided tour =====
   Runs once on a brand new install: a short setup wizard, then a spotlight
   walkthrough of the shell. Re-runnable any time from Settings or Start, so
   it is never a one-shot thing you can miss.                               */
(function (global) {
  'use strict';

  var Emu = global.Emu, U = Emu.util, Icons = global.Icons;

  // ------------------------------------------------------------- wizard
  var STYLES = [
    { id: 'win', name: 'Windows style', hint: 'Taskbar along the bottom, Start on the left, window buttons top-right.' },
    { id: 'mac', name: 'Mac style', hint: 'Menu bar on top, a dock at the bottom, traffic-light window buttons.' }
  ];

  function stepWelcome() {
    return '<div class="tw-hero">' + Icons.get('orion') + '</div>' +
      '<h2>Welcome to Orion</h2>' +
      '<p>Orion is a desktop that runs entirely in this browser tab. Files, windows, ' +
      'settings and installed apps are all saved locally, so it looks the same when you come back.</p>' +
      '<p class="tw-note">This takes about a minute. You can change any of it later in Settings.</p>';
  }

  function stepName() {
    return '<h2>What should Orion call you?</h2>' +
      '<p>This is the name on the lock screen and in Start.</p>' +
      '<label class="tw-field">Your name<input data-f="user" maxlength="40" value="' +
        U.esc(Emu.state.user || '') + '" placeholder="Chase"></label>';
  }

  function stepLook() {
    return '<h2>Pick a look</h2>' +
      '<p>Theme, accent colour and wallpaper.</p>' +
      '<div class="tw-row">' +
        '<button class="tw-chip' + (Emu.state.theme === 'dark' ? ' on' : '') + '" data-theme="dark">' +
          Icons.get('moon') + 'Dark</button>' +
        '<button class="tw-chip' + (Emu.state.theme === 'light' ? ' on' : '') + '" data-theme="light">' +
          Icons.get('sun') + 'Light</button>' +
      '</div>' +
      '<div class="tw-swatches">' + Emu.ACCENTS.slice(0, 10).map(function (c) {
        return '<button class="tw-sw' + (c === Emu.state.accent ? ' on' : '') +
          '" data-accent="' + c + '" style="background:' + c + '"></button>';
      }).join('') + '</div>' +
      '<div class="tw-walls">' + Emu.WALLPAPERS.map(function (w) {
        var bg = /^#/.test(w.value) ? w.value : 'center/cover url("' + w.value + '")';
        return '<button class="tw-wall' + (w.value === Emu.state.wallpaper ? ' on' : '') +
          '" data-wall="' + U.esc(w.value) + '" style="background:' + bg + '" title="' + w.name + '"></button>';
      }).join('') + '</div>';
  }

  function stepStyle() {
    return '<h2>Windows style or Mac style?</h2>' +
      '<p>This changes the shell only. Every app, file and setting works the same either way, ' +
      'and you can switch whenever you like.</p>' +
      '<div class="tw-styles">' + STYLES.map(function (s) {
        return '<button class="tw-style' + ((Emu.state.ui || 'win') === s.id ? ' on' : '') +
          '" data-ui="' + s.id + '">' +
          '<span class="tw-prev tw-prev-' + s.id + '"><i></i><i></i><i></i></span>' +
          '<b>' + s.name + '</b><small>' + s.hint + '</small></button>';
      }).join('') + '</div>';
  }

  function stepApps() {
    var picks = ['edge', 'store', 'write', 'sheets', 'draw', 'photo', 'youtube', 'vpn'];
    return '<h2>What is already installed</h2>' +
      '<p>These come with Orion. There is more in Start, and games install from the Orion Store.</p>' +
      '<div class="tw-apps">' + picks.filter(function (id) { return Emu.apps[id]; }).map(function (id) {
        var a = Emu.apps[id];
        return '<div class="tw-app">' + Icons.get(a.icon) +
          '<b>' + U.esc(a.name) + '</b><small>' + U.esc(a.desc || '') + '</small></div>';
      }).join('') + '</div>';
  }

  function stepDone() {
    return '<div class="tw-hero ok">' + Icons.get('check') + '</div>' +
      '<h2>You are set up</h2>' +
      '<p>Next is a quick tour of the shell — where Start, search, notifications and settings live. ' +
      'It takes a few seconds and you can stop at any point.</p>';
  }

  var STEPS = [
    { render: stepWelcome, next: 'Get started' },
    { render: stepName },
    { render: stepLook },
    { render: stepStyle },
    { render: stepApps },
    { render: stepDone, next: 'Start the tour' }
  ];

  function wizard() {
    return new Promise(function (resolve) {
      var i = 0;
      var ov = U.el('<div class="tw-back"><div class="tw-card">' +
        '<div class="tw-dots"></div>' +
        '<div class="tw-body"></div>' +
        '<div class="tw-actions">' +
          '<button class="btn" data-a="skip">Skip setup</button>' +
          '<span style="flex:1"></span>' +
          '<button class="btn" data-a="back">Back</button>' +
          '<button class="btn primary" data-a="next">Next</button>' +
        '</div></div></div>');
      document.body.appendChild(ov);

      var body = ov.querySelector('.tw-body');
      var dots = ov.querySelector('.tw-dots');
      var backBtn = ov.querySelector('[data-a="back"]');
      var nextBtn = ov.querySelector('[data-a="next"]');

      function draw() {
        body.innerHTML = STEPS[i].render();
        dots.innerHTML = STEPS.map(function (s, n) {
          return '<i class="' + (n === i ? 'on' : n < i ? 'done' : '') + '"></i>';
        }).join('');
        backBtn.style.visibility = i === 0 ? 'hidden' : 'visible';
        nextBtn.textContent = STEPS[i].next || (i === STEPS.length - 1 ? 'Finish' : 'Next');
        var f = body.querySelector('[data-f="user"]');
        if (f) f.focus();
      }

      /** Read anything the current step collected before moving on. */
      function commit() {
        var f = body.querySelector('[data-f="user"]');
        if (f && f.value.trim()) {
          Emu.state.user = f.value.trim().slice(0, 40);
          Emu.emit('user');
        }
        Emu.save();
      }

      function finish(ranWizard) {
        Emu.state.setupDone = true;
        Emu.save();
        ov.remove();
        resolve(ranWizard);
      }

      // Every selector here is class-scoped on purpose. <html> itself carries
      // data-theme and data-ui, so a bare [data-theme] would match on the way
      // up from any button and swallow every click in the wizard.
      ov.addEventListener('click', function (e) {
        var t = e.target.closest('.tw-chip[data-theme]');
        if (t) {
          Emu.state.theme = t.dataset.theme;
          Emu.applyTheme(); Emu.save(); draw();
          return;
        }
        var a = e.target.closest('.tw-sw[data-accent]');
        if (a) { Emu.state.accent = a.dataset.accent; Emu.applyTheme(); Emu.save(); draw(); return; }
        var w = e.target.closest('.tw-wall[data-wall]');
        if (w) { Emu.state.wallpaper = w.dataset.wall; Emu.applyTheme(); Emu.save(); draw(); return; }
        var u = e.target.closest('.tw-style[data-ui]');
        if (u) { global.Shell.setUiStyle(u.dataset.ui); draw(); return; }

        var b = e.target.closest('[data-a]');
        if (!b) return;
        if (b.dataset.a === 'skip') { commit(); finish(false); return; }
        if (b.dataset.a === 'back') { commit(); i = Math.max(0, i - 1); draw(); return; }
        commit();
        if (i === STEPS.length - 1) { finish(true); return; }
        i++;
        draw();
      });

      draw();
    });
  }

  // ---------------------------------------------------------- walkthrough
  var COACH = [
    { sel: '#taskbar .start-btn', title: 'Start',
      text: 'Every app lives here, with search across apps, settings and files. The Windows key opens it too.' },
    { sel: '#taskbar', title: 'The taskbar', place: 'top',
      text: 'Running apps appear here. Click one to bring it forward, click again to minimise it.' },
    { sel: '#trayQuick', title: 'Quick settings', place: 'top',
      text: 'Wi-Fi, volume, brightness and the Orion VPN toggle live in this tray button.' },
    { sel: '#trayBell', title: 'Notifications', place: 'top',
      text: 'Alerts collect here. Some are actionable — access requests can be approved right from the notification.' },
    { sel: '#iconLayer', title: 'The desktop', place: 'right',
      text: 'Double-click an icon to open it. Right-click empty space for view options, a new folder and Settings.' }
  ];

  function walkthrough() {
    return new Promise(function (resolve) {
      var live = COACH.filter(function (c) { return document.querySelector(c.sel); });
      if (!live.length) return resolve();

      var i = 0;
      var ov = U.el('<div class="tour-back">' +
        '<div class="tour-hole"></div>' +
        '<div class="tour-tip"><b></b><p></p>' +
          '<div class="tour-foot"><span class="tour-n"></span>' +
          '<button class="btn" data-a="end">End tour</button>' +
          '<button class="btn primary" data-a="next">Next</button></div>' +
        '</div></div>');
      document.body.appendChild(ov);

      var hole = ov.querySelector('.tour-hole');
      var tip = ov.querySelector('.tour-tip');

      function place() {
        var c = live[i];
        var el = document.querySelector(c.sel);
        if (!el) { step(1); return; }
        var r = el.getBoundingClientRect();
        var pad = 8;
        hole.style.left = (r.left - pad) + 'px';
        hole.style.top = (r.top - pad) + 'px';
        hole.style.width = (r.width + pad * 2) + 'px';
        hole.style.height = (r.height + pad * 2) + 'px';

        tip.querySelector('b').textContent = c.title;
        tip.querySelector('p').textContent = c.text;
        tip.querySelector('.tour-n').textContent = (i + 1) + ' of ' + live.length;
        tip.querySelector('[data-a="next"]').textContent = i === live.length - 1 ? 'Done' : 'Next';

        // Keep the bubble on screen whichever edge the target sits near.
        tip.style.visibility = 'hidden';
        tip.style.left = '0px';
        tip.style.top = '0px';
        requestAnimationFrame(function () {
          var tr = tip.getBoundingClientRect();
          var left = Math.min(Math.max(12, r.left + r.width / 2 - tr.width / 2), innerWidth - tr.width - 12);
          var above = r.top > tr.height + 24;
          var top = above ? r.top - tr.height - 16 : Math.min(r.bottom + 16, innerHeight - tr.height - 12);
          tip.style.left = left + 'px';
          tip.style.top = Math.max(12, top) + 'px';
          tip.style.visibility = 'visible';
        });
      }

      function step(d) {
        i += d;
        if (i >= live.length || i < 0) { end(); return; }
        place();
      }

      function end() {
        ov.remove();
        window.removeEventListener('resize', place);
        resolve();
      }

      ov.addEventListener('click', function (e) {
        var b = e.target.closest('[data-a]');
        if (!b) return;
        if (b.dataset.a === 'end') end();
        else step(1);
      });
      window.addEventListener('resize', place);

      place();
    });
  }

  var Tour = {
    /** Setup wizard, then the shell tour. */
    run: function (force) {
      if (!force && Emu.state.setupDone) return Promise.resolve();
      return wizard().then(function (wantsTour) {
        if (wantsTour === false) return null;
        return walkthrough();
      }).then(function () {
        Emu.notify('Orion', 'Setup finished. Open Settings to change anything, or the Orion Store for apps and games.', 'orion');
      });
    },
    tourOnly: walkthrough,
    pending: function () { return !Emu.state.setupDone; }
  };

  // Searchable in Start, but not pinned anywhere.
  Emu.registerApp({
    id: 'setup', name: 'Setup and tour', icon: 'orion', desc: 'Re-run first-time setup',
    launch: function () { Tour.run(true); return null; }
  });

  global.Tour = Tour;
})(window);
