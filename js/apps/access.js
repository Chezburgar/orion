/* ===== Orion Admin =====
   The console for whoever runs this Orion. Devices that asked for access,
   the administrators who can decide on them, and the system-wide switches.

   Two roles: the owner (the root key, plus anyone the owner promotes) can do
   everything including managing administrators; an admin can approve devices
   and publish to the Store but cannot mint or revoke keys. The server
   enforces both - the UI here only reflects them.                          */
(function (global) {
  'use strict';

  var Emu = global.Emu, U = Emu.util, Icons = global.Icons, WM = global.WM, Auth = global.Auth;

  var ROLE_LABEL = { student: 'Student', personal: 'Personal', educator: 'Educator', employee: 'Employee' };

  function shortUa(ua) {
    var m = ua.match(/(Chrome|Firefox|Safari|Edg|OPR)\/[\d.]+/);
    var os = /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'macOS'
      : /Android/.test(ua) ? 'Android' : /iPhone|iPad|CrOS/.test(ua) ? (/CrOS/.test(ua) ? 'ChromeOS' : 'iOS')
      : /Linux/.test(ua) ? 'Linux' : '';
    return [os, m ? m[0] : ''].filter(Boolean).join(' · ');
  }

  function launchAccess(args) {
    var win = WM.create({
      appId: 'access', title: 'Orion Admin', icon: 'shield',
      width: 880, height: 660, minWidth: 520, minHeight: 400
    });

    var tab = (args && args.tab) || 'devices';
    var rows = [], admins = [], filter = 'pending';
    var loading = true, error = null, adminError = null;

    function isRoot() { return Auth.role() === 'owner'; }

    // ------------------------------------------------------------- data
    function load() {
      loading = true;
      render();
      Auth.list().then(function (r) {
        rows = r || [];
        loading = false;
        error = null;
        render();
        Emu.emit('access', rows.filter(function (x) { return x.status === 'pending'; }).length);
      }).catch(function (e) {
        loading = false;
        error = e.message;
        render();
      });
      Auth.whoami().then(render).catch(function () {});
      loadAdmins();
    }

    function loadAdmins() {
      if (!Auth.isSignedIn()) return;
      Auth.adminsList().then(function (a) {
        admins = a || [];
        adminError = null;
        render();
      }).catch(function (e) {
        // an admin (not the owner) is not allowed to see this list at all
        admins = [];
        adminError = /unauthor/i.test(e.message)
          ? 'Only the owner can manage administrators.' : e.message;
        render();
      });
    }

    // ------------------------------------------------------------ render
    function deviceCard(r) {
      var when = new Date(r.created_at);
      return '<div class="acc-card ' + r.status + '" data-id="' + r.id + '">' +
        '<div class="acc-head">' +
          '<span class="acc-avatar">' + U.esc((r.name || '?').charAt(0).toUpperCase()) + '</span>' +
          '<div class="acc-who"><b>' + U.esc(r.name) + '</b>' +
            '<small>' + U.esc(ROLE_LABEL[r.role] || r.role) + ' · device ' +
            U.esc(String(r.device_id || '').slice(0, 8)) + (r.ip ? ' · ' + U.esc(r.ip) : '') + '</small></div>' +
          '<span class="acc-badge ' + r.status + '">' + r.status + '</span>' +
        '</div>' +
        '<p class="acc-reason">' + (r.reason ? U.esc(r.reason) : '<i>No reason given</i>') + '</p>' +
        '<div class="acc-meta">' + when.toLocaleString() +
          (r.user_agent ? ' · ' + U.esc(shortUa(r.user_agent)) : '') + '</div>' +
        '<div class="acc-actions">' +
          (r.status !== 'approved' ? '<button class="btn primary" data-act="approve">Approve</button>' : '') +
          (r.status !== 'denied' ? '<button class="btn" data-act="deny">Deny</button>' : '') +
          (r.status !== 'pending' ? '<button class="btn" data-act="reset">Set pending</button>' : '') +
          '<button class="btn danger" data-act="revoke">Delete</button>' +
        '</div></div>';
    }

    function devicesPane() {
      var counts = { pending: 0, approved: 0, denied: 0 };
      rows.forEach(function (r) { counts[r.status] = (counts[r.status] || 0) + 1; });
      var shown = rows.filter(function (r) { return filter === 'all' || r.status === filter; });

      return '<div class="acc-bar">' +
          ['pending', 'approved', 'denied', 'all'].map(function (f) {
            return '<button class="acc-tab' + (filter === f ? ' active' : '') + '" data-filter="' + f + '">' +
              f.charAt(0).toUpperCase() + f.slice(1) + (counts[f] ? ' <b>' + counts[f] + '</b>' : '') + '</button>';
          }).join('') +
          '<span style="flex:1"></span>' +
          '<button class="btn" data-act="reload">Refresh</button>' +
        '</div>' +
        '<div class="acc-list">' +
          (error ? '<div class="acc-empty">' + Icons.get('warning') + '<span>' + U.esc(error) + '</span>' +
              '<button class="btn" data-act="reload">Try again</button></div>'
           : loading ? '<div class="acc-empty"><span>Loading…</span></div>'
           : shown.length ? shown.map(deviceCard).join('')
           : '<div class="acc-empty">' + Icons.get('check') + '<span>Nothing ' + filter + '</span></div>') +
        '</div>';
    }

    function adminsPane() {
      if (!isRoot()) {
        return '<div class="acc-list"><div class="acc-empty">' + Icons.get('lock') +
          '<span>' + U.esc(adminError || 'Only the owner can manage administrators.') + '</span>' +
          '<small class="muted">You are signed in as an administrator, which can approve devices ' +
          'and publish to the Store.</small></div></div>';
      }
      return '<div class="acc-bar">' +
          '<b style="font-size:13px">Administrators</b>' +
          '<span style="flex:1"></span>' +
          '<button class="btn" data-act="reloadadmins">Refresh</button>' +
          '<button class="btn primary" data-act="addadmin">Add administrator</button>' +
        '</div>' +
        '<div class="acc-list">' +
          '<div class="adm-row adm-root">' +
            '<span class="acc-avatar">O</span>' +
            '<div class="acc-who"><b>Owner key</b><small>The original key, stored as a hash in ' +
              'orion_config. It cannot be revoked from here.</small></div>' +
            '<span class="acc-badge approved">owner</span>' +
          '</div>' +
          (adminError ? '<div class="acc-empty">' + Icons.get('warning') + '<span>' + U.esc(adminError) + '</span></div>' : '') +
          (admins.length ? admins.map(function (a) {
            return '<div class="adm-row' + (a.active ? '' : ' off') + '" data-adm="' + a.id + '">' +
              '<span class="acc-avatar">' + U.esc((a.label || '?').charAt(0).toUpperCase()) + '</span>' +
              '<div class="acc-who"><b>' + U.esc(a.label) + '</b><small>Added ' +
                new Date(a.created_at).toLocaleDateString() +
                (a.last_seen ? ' · last used ' + U.fmtAgo(new Date(a.last_seen).getTime()) : ' · never used') +
                '</small></div>' +
              '<span class="acc-badge ' + (a.active ? 'approved' : 'denied') + '">' +
                U.esc(a.role) + (a.active ? '' : ' · off') + '</span>' +
              '<div class="acc-actions">' +
                '<button class="btn" data-aact="' + (a.active ? 'off' : 'on') + '">' +
                  (a.active ? 'Suspend' : 'Re-enable') + '</button>' +
                '<button class="btn danger" data-aact="del">Remove</button>' +
              '</div></div>';
          }).join('') : '<p class="muted acc-note">No extra administrators yet. Add one and Orion ' +
            'generates a key you hand to them — they enter it at <b>Owner sign in</b> on the access screen.</p>') +
        '</div>';
    }

    function systemPane() {
      var s = Emu.state;
      return '<div class="acc-list acc-sys">' +
        '<div class="sys-card"><b>This install</b>' +
          '<div class="sys-kv"><span>Build</span><code>' + U.esc(Emu.BUILD) + '</code></div>' +
          '<div class="sys-kv"><span>Signed in as</span><code>' + U.esc(Auth.roleLabel()) + '</code></div>' +
          '<div class="sys-kv"><span>This device</span><code>' + U.esc(String(Auth.deviceId()).slice(0, 8)) + '</code></div>' +
          '<div class="sys-kv"><span>Shell style</span><code>' + (s.ui === 'mac' ? 'Mac' : 'Windows') + '</code></div>' +
          '<div class="sys-kv"><span>Devices on record</span><code>' + rows.length + '</code></div>' +
        '</div>' +
        '<div class="sys-card"><b>Actions</b>' +
          '<div class="acc-actions wrap">' +
            '<button class="btn" data-act="tour">Run setup and tour</button>' +
            '<button class="btn" data-act="style">Switch shell style</button>' +
            '<button class="btn" data-act="clearnotifs">Clear all notifications</button>' +
            '<button class="btn" data-act="signout">Sign out of admin</button>' +
          '</div>' +
        '</div>' +
        '<div class="sys-card"><b>What each role can do</b>' +
          '<table class="sys-table"><tr><th></th><th>Owner</th><th>Admin</th></tr>' +
          '<tr><td>Approve or deny devices</td><td>Yes</td><td>Yes</td></tr>' +
          '<tr><td>Publish games to the Store</td><td>Yes</td><td>Yes</td></tr>' +
          '<tr><td>Add or revoke administrators</td><td>Yes</td><td>No</td></tr>' +
          '</table>' +
          '<p class="muted acc-note">This gate keeps honest people out of a private desktop. ' +
          'Everything here runs in the visitor\'s browser and the source is public, so it is not ' +
          'a security boundary — do not put anything sensitive behind it.</p>' +
        '</div></div>';
    }

    function render() {
      var pending = rows.filter(function (r) { return r.status === 'pending'; }).length;
      win.body.innerHTML = '<div class="acc">' +
        '<div class="acc-tabs">' +
          [['devices', 'Devices', pending], ['admins', 'Administrators', 0], ['system', 'System', 0]]
            .map(function (t) {
              return '<button class="acc-maintab' + (tab === t[0] ? ' active' : '') + '" data-tab="' + t[0] + '">' +
                t[1] + (t[2] ? ' <b>' + t[2] + '</b>' : '') + '</button>';
            }).join('') +
          '<span style="flex:1"></span>' +
          '<span class="acc-me">' + Icons.get('shield') + U.esc(Auth.roleLabel()) + '</span>' +
        '</div>' +
        (tab === 'devices' ? devicesPane() : tab === 'admins' ? adminsPane() : systemPane()) +
        '<div class="ex-status"><span>' + rows.length + ' device' + (rows.length === 1 ? '' : 's') + ' on record</span>' +
        '<span style="margin-left:auto">Approval is per device, not per network</span></div>' +
      '</div>';
    }

    // ------------------------------------------------------------ actions
    function fail(e) {
      WM.alert('Orion Admin', 'That did not work:\n' + e.message, win);
      load();
    }

    /**
     * The generated key is shown exactly once - only its hash reaches the
     * database, so there is no way to look it up again later.
     */
    function showNewKey(res) {
      var back = U.el('<div class="dlg-backdrop"><div class="dlg">' +
        '<h3>Key for ' + U.esc(res.label) + '</h3>' +
        '<div class="dlg-body"><p style="padding:0 0 12px">Copy this now. Orion stores only a hash of ' +
          'it, so it cannot be shown again — if it is lost, remove the administrator and add them back.</p>' +
        '<code class="adm-key">' + U.esc(res.key) + '</code>' +
        '<p style="padding:12px 0 0;font-size:12px" class="muted">They enter it at <b>Owner sign in</b> ' +
          'on the Orion access screen.</p></div>' +
        '<div class="dlg-actions"><button data-x="copy">Copy key</button>' +
        '<button class="primary" data-x="done">Done</button></div></div></div>');
      win.el.appendChild(back);
      back.addEventListener('click', function (e) {
        var b = e.target.closest('[data-x]');
        if (!b) return;
        if (b.dataset.x === 'copy') {
          try {
            navigator.clipboard.writeText(res.key);
            b.textContent = 'Copied';
          } catch (err) { b.textContent = 'Select it by hand'; }
          return;
        }
        back.remove();
      });
    }

    function addAdmin() {
      var back = U.el('<div class="dlg-backdrop"><div class="dlg">' +
        '<h3>Add an administrator</h3>' +
        '<div class="dlg-body"><form class="gate-form" autocomplete="off">' +
          '<label>Who is it?<input name="label" maxlength="60" placeholder="Jordan (library)" required></label>' +
          '<label>Role<select name="role">' +
            '<option value="admin">Administrator — approve devices, publish to the Store</option>' +
            '<option value="owner">Owner — everything, including managing administrators</option>' +
          '</select></label>' +
          '<div class="gate-err hidden" data-err></div>' +
        '</form></div>' +
        '<div class="dlg-actions"><button data-x="cancel">Cancel</button>' +
        '<button class="primary" data-x="add">Create key</button></div></div></div>');
      win.el.appendChild(back);
      var form = back.querySelector('form');

      back.addEventListener('click', function (e) {
        var b = e.target.closest('[data-x]');
        if (!b) return;
        if (b.dataset.x === 'cancel') { back.remove(); return; }
        var label = form.label.value.trim();
        var box = form.querySelector('[data-err]');
        if (!label) {
          box.textContent = 'A name is required so you can tell keys apart later.';
          box.classList.remove('hidden');
          return;
        }
        b.disabled = true;
        b.textContent = 'Creating…';
        Auth.adminsAdd(label, form.role.value).then(function (res) {
          back.remove();
          showNewKey(res);
          loadAdmins();
          Emu.notify('Orion Admin', label + ' can now sign in as ' + res.role + '.', 'shield');
        }).catch(function (err) {
          b.disabled = false;
          b.textContent = 'Create key';
          box.textContent = /unauthor/i.test(err.message) ? 'Only the owner can add administrators.' : err.message;
          box.classList.remove('hidden');
        });
      });
    }

    win.body.addEventListener('click', function (e) {
      var t = e.target.closest('[data-tab]');
      if (t) { tab = t.dataset.tab; render(); return; }

      var f = e.target.closest('[data-filter]');
      if (f) { filter = f.dataset.filter; render(); return; }

      // ---- administrator rows
      var aact = e.target.closest('[data-aact]');
      if (aact) {
        var arow = aact.closest('[data-adm]');
        if (!arow) return;
        var aid = arow.dataset.adm;
        var who = admins.filter(function (x) { return x.id === aid; })[0] || {};
        var k = aact.dataset.aact;
        if (k === 'del') {
          WM.confirm('Remove administrator', 'Remove ' + (who.label || 'this administrator') +
            '? Their key stops working immediately.', win).then(function (ok) {
            if (!ok) return;
            Auth.adminsRemove(aid).then(loadAdmins).catch(fail);
          });
        } else {
          Auth.adminsSetActive(aid, k === 'on').then(loadAdmins).catch(fail);
        }
        return;
      }

      var act = e.target.closest('[data-act]');
      if (!act) return;
      var kind = act.dataset.act;

      if (kind === 'reload') return load();
      if (kind === 'reloadadmins') return loadAdmins();
      if (kind === 'addadmin') return addAdmin();
      if (kind === 'tour') { win.close(); return global.Tour && global.Tour.run(true); }
      if (kind === 'style') {
        global.Shell.setUiStyle(global.Shell.uiStyle() === 'mac' ? 'win' : 'mac');
        render();
        return;
      }
      if (kind === 'clearnotifs') {
        Emu.state.notifications = [];
        Emu.save();
        Emu.emit('notify:changed');
        return;
      }
      if (kind === 'signout') {
        Auth.setOwnerKey('');
        Emu.notify('Orion Admin', 'Signed out of the admin console on this device.', 'shield');
        win.close();
        return;
      }

      var card = act.closest('[data-id]');
      if (!card) return;
      var id = card.dataset.id;
      var row = rows.filter(function (r) { return r.id === id; })[0] || {};

      if (kind === 'revoke') {
        WM.confirm('Delete request', 'Remove ' + (row.name || 'this device') +
          ' completely? They can request access again.', win).then(function (ok) {
          if (!ok) return;
          Auth.revoke(id).then(load).catch(fail);
        });
        return;
      }

      var status = kind === 'approve' ? 'approved' : kind === 'deny' ? 'denied' : 'pending';
      act.disabled = true;
      Auth.decide(id, status).then(function () {
        Emu.notify('Orion Admin', (row.name || 'Device') + ' ' +
          (status === 'approved' ? 'approved' : status === 'denied' ? 'denied' : 'set back to pending') + '.', 'shield');
        load();
      }).catch(fail);
    });

    var onChanged = Emu.on('access:changed', load);
    win.onClose = function () { Emu.off('access:changed', onChanged); };

    load();
    return win;
  }

  Emu.registerApp({
    id: 'access', name: 'Orion Admin', icon: 'shield',
    desc: 'Devices, administrators and system',
    launch: launchAccess
  });

  // Notifications are actionable: clicking one opens the console, and the
  // Approve / Deny buttons decide without opening anything.
  Emu.onNotifAction('access:open', function () { Emu.launch('access'); });

  Emu.onNotifAction('access:decide', function (a) {
    if (!Auth.isSignedIn()) {
      Emu.notify('Orion Admin', 'Sign in with an admin key first.', 'shield', { action: { do: 'access:open' } });
      return;
    }
    Auth.decide(a.id, a.status).then(function () {
      Emu.notify('Orion Admin', (a.name || 'Device') + ' ' +
        (a.status === 'approved' ? 'approved' : 'denied') + '.', 'shield');
      Emu.emit('access:changed');
    }).catch(function (e) {
      Emu.notify('Orion Admin', 'Could not update that request: ' + e.message, 'warning');
    });
  });

  /** Only signed-in administrators get the app on the taskbar and in Start. */
  function syncVisibility() {
    var app = Emu.apps.access;
    if (!app) return;
    var on = Auth.isSignedIn();
    app.pinned = on;
    app.startPinned = on;
    app.hidden = !on;
    Emu.emit('apps');
  }

  Emu.on('access', function (pending) {
    var app = Emu.apps.access;
    if (app) app.badge = pending || 0;
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', syncVisibility);
  else syncVisibility();

  global.AccessApp = { syncVisibility: syncVisibility };
})(window);
