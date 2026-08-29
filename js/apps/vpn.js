/* ===== Orion VPN =====
   A Windows-style VPN client. The tunnel is real in the sense that it
   changes how the emulated browser reaches the internet (via a relay);
   it is NOT encryption or anonymity, and the app says so plainly.       */
(function (global) {
  'use strict';

  var Emu = global.Emu, U = Emu.util, Icons = global.Icons, WM = global.WM, Net = global.Net;

  var log = [];
  function addLog(msg, cls) {
    log.unshift({ t: Date.now(), msg: msg, cls: cls || '' });
    if (log.length > 40) log.length = 40;
  }
  addLog('VPN service started', 'd');

  function fmtDuration(ms) {
    var s = Math.max(0, Math.floor(ms / 1000));
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
    return (h ? h + ':' : '') + String(m).padStart(h ? 2 : 1, '0') + ':' + String(s % 60).padStart(2, '0');
  }

  function launchVpn() {
    var win = WM.create({
      appId: 'vpn', title: 'Orion VPN', icon: 'vpn',
      width: 540, height: 700, minWidth: 400, minHeight: 460
    });

    var s = Emu.state.net;
    var busy = false;

    function render() {
      var loc = Net.LOCATIONS.filter(function (l) { return l.id === s.location; })[0] || Net.LOCATIONS[0];
      var relay = Net.relayFor(s.connected ? s.relay : 'direct');
      var state = busy ? 'connecting' : (s.connected ? 'connected' : 'off');

      win.body.innerHTML = '<div class="vpn">' +
        '<div class="vpn-hero ' + state + '">' +
          '<button class="vpn-orb ' + state + '" data-act="toggle" ' + (busy ? 'disabled' : '') + '>' +
            Icons.get('shield') +
            '<span class="vpn-ring"></span>' +
          '</button>' +
          '<div class="vpn-status">' +
            (busy ? 'Connecting…' : s.connected ? 'Connected' : 'Not connected') + '</div>' +
          '<div class="vpn-sub">' +
            (s.connected
              ? U.esc(loc.city) + ' &middot; ' + U.esc(loc.cc) + ' &middot; <span data-timer>' + fmtDuration(Date.now() - (s.since || Date.now())) + '</span>'
              : 'The emulated browser is using a direct connection') +
          '</div>' +
          '<div class="vpn-pills">' +
            '<span class="vpn-pill">' + Icons.get('globe') + U.esc(Net.exitIp()) + '</span>' +
            '<span class="vpn-pill">' + Icons.get('network') + (s.lastPing > 0 ? s.lastPing + ' ms' : '—') + '</span>' +
            '<span class="vpn-pill">' + Icons.get('key') + U.esc(s.protocol) + '</span>' +
          '</div>' +
        '</div>' +

        '<div class="vpn-tabs">' +
          '<button class="vpn-tab active" data-tab="locations">Locations</button>' +
          '<button class="vpn-tab" data-tab="settings">Settings</button>' +
          '<button class="vpn-tab" data-tab="activity">Activity</button>' +
        '</div>' +
        '<div class="vpn-pane" data-pane></div>' +
      '</div>';

      paneLocations();
      startTimer();
    }

    function setPane(html) { U.$('[data-pane]', win.body).innerHTML = html; }

    function paneLocations() {
      setPane(Net.LOCATIONS.map(function (l) {
        var r = Net.relayFor(l.relay);
        var active = s.connected && s.location === l.id;
        return '<div class="vpn-loc' + (active ? ' active' : '') + '" data-loc="' + l.id + '">' +
          '<span class="cc">' + U.esc(l.cc) + '</span>' +
          '<div class="lbl"><b>' + U.esc(l.city) + '</b>' +
          '<small>via ' + U.esc(r.host) + '</small></div>' +
          '<span class="bars" title="' + l.ping + ' ms"><i style="height:' +
            Math.max(4, 16 - l.ping / 12) + 'px"></i><i style="height:' +
            Math.max(6, 18 - l.ping / 14) + 'px"></i><i style="height:' +
            Math.max(8, 20 - l.ping / 16) + 'px"></i></span>' +
          (active ? '<span class="tick">' + Icons.get('check') + '</span>' : '') +
          '</div>';
      }).join('') +
      '<div class="vpn-note">' + Icons.get('info') +
      '<span>Location names are cosmetic. What actually changes is which public relay fetches pages ' +
      'for the emulated browser. Your traffic is <b>not</b> encrypted end to end and your IP is <b>not</b> hidden.</span></div>');
    }

    function paneSettings() {
      setPane(
        '<div class="e-set"><div class="lbl"><b>Kill switch</b>' +
        '<small>Block real-site loading in Edge when the tunnel is down</small></div>' +
        '<div class="sw' + (s.killSwitch ? ' on' : '') + '" data-set="killSwitch"></div></div>' +

        '<div class="e-set"><div class="lbl"><b>Connect on startup</b>' +
        '<small>Bring the tunnel up when the emulator boots</small></div>' +
        '<div class="sw' + (s.autoConnect ? ' on' : '') + '" data-set="autoConnect"></div></div>' +

        '<div class="e-set"><div class="lbl"><b>Protocol</b><small>Cosmetic - the relay is plain HTTPS</small></div>' +
        '<select class="st-select" data-set="protocol">' +
        ['WireGuard', 'OpenVPN (UDP)', 'OpenVPN (TCP)', 'IKEv2'].map(function (p) {
          return '<option' + (s.protocol === p ? ' selected' : '') + '>' + p + '</option>';
        }).join('') + '</select></div>' +

        '<div class="e-set"><div class="lbl"><b>Relay</b><small>' +
        U.esc(Net.relayFor(s.relay).note) + '</small></div>' +
        '<select class="st-select" data-set="relay">' +
        Object.keys(Net.RELAYS).filter(function (k) { return k !== 'direct'; }).map(function (k) {
          var r = Net.RELAYS[k];
          return '<option value="' + k + '"' + (s.relay === k ? ' selected' : '') + '>' +
            U.esc(r.name + ' - ' + r.host) + '</option>';
        }).join('') + '</select></div>' +

        '<div class="e-set"><div class="lbl"><b>Test this relay</b>' +
        '<small>' + (s.lastProbe ? 'Last result: ' + U.esc(s.lastProbe) + (s.lastPing > 0 ? ' (' + s.lastPing + ' ms)' : '') : 'Not tested yet') + '</small></div>' +
        '<button class="btn" data-act="probe">Test</button></div>' +

        '<div class="e-set"><div class="lbl"><b>Clear page cache</b>' +
        '<small>' + Net.cacheSize() + ' pages held in memory</small></div>' +
        '<button class="btn" data-act="clearcache">Clear</button></div>' +

        '<div class="e-set"><div class="lbl"><b>Proxy for blocked sites</b>' +
        '<small>' + (global.OrionProxy
          ? (global.OrionProxy.state.ready
              ? 'Running via ' + U.esc(global.OrionProxy.state.wisp || 'backend')
              : (global.OrionProxy.state.error ? U.esc(global.OrionProxy.state.error) : 'Not started yet'))
          : 'unavailable') + '</small></div>' +
        '<div class="sw' + ((global.OrionProxy && global.OrionProxy.config().enabled) ? ' on' : '') +
        '" data-act="proxy-toggle"></div></div>' +

        '<div class="e-set"><div class="lbl"><b>Your own proxy (recommended)</b>' +
        '<small>Paste the address of a proxy you host — this replaces everything below it. ' +
        'For Rammerhead just the base address; otherwise use %s where the encoded URL goes.</small></div>' +
        '<input class="ex-search" style="width:230px" data-act="external" placeholder="https://you.up.railway.app/service/%s" value="' +
        U.esc((global.OrionProxy && global.OrionProxy.config().external) || '') + '"></div>' +

        '<div class="e-set"><div class="lbl"><b>How your proxy encodes URLs</b>' +
        '<small>Rammerhead for a self-hosted server-side proxy; Ultraviolet uses XOR</small></div>' +
        '<select class="st-select" data-act="externalEncoding">' +
        ['rammerhead:Rammerhead (session)', 'xor:Ultraviolet (XOR)', 'plain:Plain', 'base64:Base64'].map(function (o) {
          var kv = o.split(':');
          var cur = (global.OrionProxy && global.OrionProxy.config().externalEncoding) || 'xor';
          return '<option value="' + kv[0] + '"' + (cur === kv[0] ? ' selected' : '') + '>' + kv[1] + '</option>';
        }).join('') + '</select></div>' +

        '<div class="e-set"><div class="lbl"><b>Proxy backend</b>' +
        '<small>Public wisp servers come and go; Orion uses the first that answers</small></div>' +
        '<input class="ex-search" style="width:230px" data-act="wisp" value="' +
        U.esc((global.OrionProxy && global.OrionProxy.config().wisp) || '') + '"></div>' +

        '<div class="e-set"><div class="lbl"><b>Ultraviolet files</b>' +
        '<small>Path to the Ultraviolet deployment on this domain</small></div>' +
        '<input class="ex-search" style="width:230px" data-act="assets" value="' +
        U.esc((global.OrionProxy && global.OrionProxy.config().assets) || '') + '"></div>' +

        '<div class="e-set"><div class="lbl"><b>Scramjet files</b>' +
        '<small>Used for sites Ultraviolet cannot render, such as deadshot.io</small></div>' +
        '<input class="ex-search" style="width:230px" data-act="scramAssets" value="' +
        U.esc((global.OrionProxy && global.OrionProxy.config().scramAssets) || '') + '"></div>' +

        '<div class="e-set"><div class="lbl"><b>Send every site through the proxy</b>' +
        '<small>Turn on if your network filters most sites</small></div>' +
        '<div class="sw' + ((global.OrionProxy && global.OrionProxy.config().always) ? ' on' : '') +
        '" data-act="proxy-always"></div></div>' +

        '<div class="e-set"><div class="lbl"><b>Restart the proxy</b>' +
        '<small>Re-registers the worker and finds a live backend</small></div>' +
        '<button class="btn" data-act="proxy-restart">Restart</button></div>' +

        '<div class="e-set"><div class="lbl"><b>Proxy diagnostics</b>' +
        '<small>Checks every step and shows exactly which one fails</small></div>' +
        '<button class="btn" data-act="proxy-diag">Run</button></div>' +

        '<div class="vpn-note warn">' + Icons.get('warning') +
        '<span><b>Read this once.</b> When the tunnel is on, the address of every real page you open in ' +
        'Edge is sent to a third-party relay service, which fetches it for you. That service can see what ' +
        'you request. Do not sign in to anything through it - password fields are disabled on relayed pages ' +
        'for exactly this reason.</span></div>');
    }

    function paneActivity() {
      var st = Net.stats;
      setPane(
        '<div class="vpn-stats">' +
        '<div><b>' + st.requests + '</b><span>Requests</span></div>' +
        '<div><b>' + U.fmtBytes(st.bytes) + '</b><span>Transferred</span></div>' +
        '<div><b>' + st.blocked + '</b><span>Scripts blocked</span></div>' +
        '<div><b>' + st.errors + '</b><span>Failures</span></div>' +
        '</div>' +
        '<div class="vpn-log">' + (log.length ? log.map(function (l) {
          return '<div class="vpn-log-row ' + l.cls + '"><span class="t">' +
            new Date(l.t).toLocaleTimeString() + '</span>' + U.esc(l.msg) + '</div>';
        }).join('') : '<p class="muted">Nothing yet.</p>') + '</div>');
    }

    function paneDiagnostics() {
      setPane('<div class="vpn-note">' + Icons.get('info') +
        '<span>Running every check. This takes up to a minute.</span></div>' +
        '<div class="vpn-log" data-diag><div class="vpn-log-row">Working…</div></div>');
      global.OrionProxy.diagnose().then(function (rows) {
        var host = U.$('[data-diag]', win.body);
        if (!host) return;
        host.innerHTML = rows.map(function (r) {
          return '<div class="vpn-log-row ' + (r.ok ? 'g' : 'r') + '">' +
            (r.ok ? '[ok]  ' : '[FAIL] ') + U.esc(r.step) +
            (r.detail ? ' — ' + U.esc(r.detail) : '') + '</div>';
        }).join('') +
        '<div class="vpn-log-row d">Screenshot this if something failed.</div>';
      });
    }

    var timer = null;
    function startTimer() {
      clearInterval(timer);
      timer = setInterval(function () {
        var el = U.$('[data-timer]', win.body);
        if (!el) return;
        if (!s.connected) { clearInterval(timer); return; }
        el.textContent = fmtDuration(Date.now() - (s.since || Date.now()));
      }, 1000);
    }

    function toggle() {
      if (busy) return;
      if (s.connected) {
        Net.disconnect();
        addLog('Tunnel closed', 'r');
        Emu.notify('Orion VPN', 'Disconnected. Edge is back on a direct connection.', 'vpn');
        render();
        return;
      }
      confirmDisclosure().then(function (ok) {
        if (!ok) return;
        busy = true;
        render();
        addLog('Negotiating with ' + Net.relayFor(s.relay).host + '…');
        Net.connect(s.location).then(function (r) {
          busy = false;
          if (r.ms < 0) {
            Net.disconnect();
            addLog('Handshake failed - relay unreachable', 'r');
            Emu.notify('Orion VPN', 'Could not reach the relay. It may be rate limiting - try the other relay in Settings.', 'warning');
          } else {
            addLog('Connected to ' + r.location.city + ' (' + r.ms + ' ms)', 'g');
            Emu.notify('Orion VPN', 'Connected via ' + r.location.city + '. Edge will now render real sites itself.', 'vpn');
          }
          render();
        });
      });
    }

    function confirmDisclosure() {
      if (s.seenDisclosure) return Promise.resolve(true);
      return WM.dialog({
        title: 'Before you connect',
        message: 'This is a simulated VPN.\n\n' +
          'What it really does: page requests from the emulated browser are sent through a public relay ' +
          'service, which fetches those pages and hands them back. That is what makes sites load inside ' +
          'the emulator instead of being refused.\n\n' +
          'What it does not do: it does not encrypt your traffic, hide your IP address, or make you ' +
          'anonymous. The relay operator can see which URLs you ask for. Never sign in to anything ' +
          'through it.',
        win: win,
        buttons: [{ label: 'I understand, connect', value: true, primary: true }, { label: 'Cancel', value: false }]
      }).then(function (ok) {
        if (ok) { s.seenDisclosure = true; Emu.save(); }
        return ok;
      });
    }

    win.body.addEventListener('click', function (e) {
      var tab = e.target.closest('[data-tab]');
      if (tab) {
        U.$$('.vpn-tab', win.body).forEach(function (t) { t.classList.toggle('active', t === tab); });
        ({ locations: paneLocations, settings: paneSettings, activity: paneActivity }[tab.dataset.tab])();
        return;
      }
      var loc = e.target.closest('[data-loc]');
      if (loc) {
        s.location = loc.dataset.loc;
        var l = Net.LOCATIONS.filter(function (x) { return x.id === s.location; })[0];
        s.relay = l.relay;
        Emu.save();
        if (s.connected) {
          addLog('Switching to ' + l.city + '…');
          busy = true; render();
          Net.connect(s.location).then(function (r) {
            busy = false;
            addLog(r.ms < 0 ? 'Switch failed' : 'Now on ' + l.city, r.ms < 0 ? 'r' : 'g');
            render();
          });
        } else { render(); }
        return;
      }
      var act = e.target.closest('[data-act]');
      if (act && act.dataset.act === 'proxy-always') {
        var pa = global.OrionProxy.config();
        pa.always = !pa.always;
        Emu.save();
        paneSettings();
        return;
      }
      if (act && act.dataset.act === 'proxy-toggle') {
        var pc = global.OrionProxy.config();
        pc.enabled = !pc.enabled;
        Emu.save();
        if (!pc.enabled) global.OrionProxy.stop();
        paneSettings();
        return;
      }
      var sw = e.target.closest('[data-set]');
      if (sw && sw.classList.contains('sw')) {
        s[sw.dataset.set] = !s[sw.dataset.set];
        Emu.save();
        paneSettings();
        return;
      }
      if (!act) return;
      if (act.dataset.act === 'toggle') toggle();
      if (act.dataset.act === 'probe') {
        act.textContent = 'Testing…';
        Net.probe().then(function (ms) {
          addLog('Probe: ' + (ms < 0 ? 'unreachable' : ms + ' ms'), ms < 0 ? 'r' : 'g');
          paneSettings();
        });
      }
      if (act.dataset.act === 'clearcache') { Net.clearCache(); addLog('Page cache cleared'); paneSettings(); }
      if (act.dataset.act === 'proxy-diag') { paneDiagnostics(); return; }
      if (act.dataset.act === 'proxy-restart') {
        act.textContent = 'Starting…';
        global.OrionProxy.stop()
          .then(function () { return global.OrionProxy.start(); })
          .then(function (ok) {
            addLog(ok ? 'Proxy ready via ' + global.OrionProxy.state.wisp : 'Proxy failed: ' + global.OrionProxy.state.error,
              ok ? 'g' : 'r');
            paneSettings();
          });
      }
    });

    win.body.addEventListener('change', function (e) {
      var a = e.target.dataset.act;
      if (a === 'external' || a === 'externalEncoding') {
        var pe = global.OrionProxy.config();
        pe[a] = e.target.value.trim();
        pe.rhSession = null;          // a session belongs to one deployment
        pe.rhSessionHost = null;
        Emu.save();
        addLog(a === 'external'
          ? (pe.external ? 'Using your own proxy: ' + pe.external : 'Back to the built-in proxy')
          : 'Proxy encoding set to ' + pe.externalEncoding, 'g');
        paneSettings();
        return;
      }
      if (a === 'wisp' || a === 'assets' || a === 'scramAssets') {
        var pc = global.OrionProxy.config();
        pc[a] = e.target.value.trim();
        Emu.save();
        addLog('Proxy ' + a + ' set to ' + e.target.value.trim());
        return;
      }
      var k = e.target.dataset.set;
      if (!k) return;
      s[k] = e.target.value;
      Emu.save();
      if (k === 'relay' && s.connected) Net.probe().then(render);
      paneSettings();
    });

    win.onClose = function () { clearInterval(timer); };
    render();
    return win;
  }

  Emu.registerApp({
    id: 'vpn', name: 'Orion VPN', icon: 'vpn', pinned: true,
    desc: 'Relay tunnel for the emulated browser',
    launch: launchVpn
  });

  Emu.on('net', function () {
    var s = Emu.state.net;
    if (s.connected) addLog('Relay: ' + Net.relayFor(s.relay).host, 'd');
  });

  global.VpnLog = addLog;
})(window);
