/* ===== Orion Access =====
   The owner's console: every device that has asked for access, with approve,
   deny and revoke. Only visible once you have signed in with the owner key. */
(function (global) {
  'use strict';

  var Emu = global.Emu, U = Emu.util, Icons = global.Icons, WM = global.WM, Auth = global.Auth;

  var ROLE_LABEL = { student: 'Student', personal: 'Personal', educator: 'Educator', employee: 'Employee' };

  function launchAccess() {
    var win = WM.create({
      appId: 'access', title: 'Orion Access', icon: 'shield',
      width: 820, height: 620, minWidth: 460, minHeight: 360
    });

    var rows = [], filter = 'pending', loading = true, error = null;

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
    }

    function card(r) {
      var when = new Date(r.created_at);
      return '<div class="acc-card ' + r.status + '" data-id="' + r.id + '">' +
        '<div class="acc-head">' +
          '<span class="acc-avatar">' + U.esc((r.name || '?').charAt(0).toUpperCase()) + '</span>' +
          '<div class="acc-who"><b>' + U.esc(r.name) + '</b>' +
            '<small>' + U.esc(ROLE_LABEL[r.role] || r.role) + ' · ' + U.esc(r.ip) + '</small></div>' +
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

    function shortUa(ua) {
      var m = ua.match(/(Chrome|Firefox|Safari|Edg|OPR)\/[\d.]+/);
      var os = /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'macOS'
        : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Linux/.test(ua) ? 'Linux' : '';
      return [os, m ? m[0] : ''].filter(Boolean).join(' · ');
    }

    function render() {
      var counts = { pending: 0, approved: 0, denied: 0 };
      rows.forEach(function (r) { counts[r.status] = (counts[r.status] || 0) + 1; });
      var shown = rows.filter(function (r) { return filter === 'all' || r.status === filter; });

      win.body.innerHTML = '<div class="acc">' +
        '<div class="acc-bar">' +
          ['pending', 'approved', 'denied', 'all'].map(function (f) {
            return '<button class="acc-tab' + (filter === f ? ' active' : '') + '" data-filter="' + f + '">' +
              f.charAt(0).toUpperCase() + f.slice(1) +
              (counts[f] ? ' <b>' + counts[f] + '</b>' : '') + '</button>';
          }).join('') +
          '<span style="flex:1"></span>' +
          '<button class="btn" data-act="reload">Refresh</button>' +
          '<button class="btn" data-act="signout">Sign out</button>' +
        '</div>' +
        '<div class="acc-list">' +
          (error ? '<div class="acc-empty">' + Icons.get('warning') + '<span>' + U.esc(error) + '</span>' +
              '<button class="btn" data-act="reload">Try again</button></div>'
           : loading ? '<div class="acc-empty"><span>Loading…</span></div>'
           : shown.length ? shown.map(card).join('')
           : '<div class="acc-empty">' + Icons.get('check') + '<span>Nothing ' + filter + '</span></div>') +
        '</div>' +
        '<div class="ex-status"><span>' + rows.length + ' device' + (rows.length === 1 ? '' : 's') + ' on record</span>' +
        '<span style="margin-left:auto">Approval is by public IP address</span></div>' +
      '</div>';
    }

    win.body.addEventListener('click', function (e) {
      var f = e.target.closest('[data-filter]');
      if (f) { filter = f.dataset.filter; render(); return; }

      var act = e.target.closest('[data-act]');
      if (!act) return;
      var kind = act.dataset.act;

      if (kind === 'reload') return load();
      if (kind === 'signout') {
        Auth.setOwnerKey('');
        Emu.notify('Orion Access', 'Signed out of the owner console on this device.', 'shield');
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
        Emu.notify('Orion Access', (row.name || 'Device') + ' ' +
          (status === 'approved' ? 'approved' : status === 'denied' ? 'denied' : 'set back to pending') + '.', 'shield');
        load();
      }).catch(fail);
    });

    function fail(e) {
      WM.alert('Orion Access', 'That did not work:\n' + e.message, win);
      load();
    }

    load();
    return win;
  }

  Emu.registerApp({
    id: 'access', name: 'Orion Access', icon: 'shield',
    desc: 'Approve or deny devices',
    launch: launchAccess
  });

  /** Only the owner gets the app on the taskbar and in Start. */
  function syncVisibility() {
    var app = Emu.apps.access;
    if (!app) return;
    var owner = Auth.isOwner();
    app.pinned = owner;
    app.startPinned = owner;
    app.hidden = !owner;
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
