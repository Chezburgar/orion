/* ===== Orion access control =====
   Each device gets its own identity (a public IP is shared by everyone behind
   the same router, so it cannot gate a single device). A new device fills in a request
   form; the owner sees it as a notification inside Orion and approves or
   denies it. Requests and decisions live in Supabase, so a decision made on
   the owner's machine takes effect on everyone else's.

   This is a soft gate. Everything here runs in the visitor's browser and the
   source is public, so it keeps honest people out of a private desktop - it
   is not a security boundary, and nothing sensitive should live behind it. */
(function (global) {
  'use strict';

  var Emu = global.Emu, U = Emu.util;

  var CFG = {
    url: 'https://bgoxonxxutkporbqbtbh.supabase.co',
    key: 'sb_publishable_HtWG15aHqfYe2gFNbhTfjQ_gy86rIWU'
  };

  var OWNER_KEY = 'orion.owner.key';
  var DEVICE_KEY = 'orion.device.id';
  var ROLE_KEY = 'orion.owner.role';

  /**
   * A public IP identifies a network, not a device - every phone and laptop
   * behind the same router shares one. Access is therefore keyed on an id
   * minted once per browser; the IP is only shown to the owner as context.
   */
  function deviceId() {
    var id = null;
    try { id = localStorage.getItem(DEVICE_KEY); } catch (e) {}
    if (id && id.length >= 8) return id;
    id = (global.crypto && global.crypto.randomUUID)
      ? global.crypto.randomUUID()
      : 'dev-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12);
    try { localStorage.setItem(DEVICE_KEY, id); } catch (e) {}
    return id;
  }

  var ROLES = [
    { id: 'student', label: 'Student' },
    { id: 'personal', label: 'Personal' },
    { id: 'educator', label: 'Educator' },
    { id: 'employee', label: 'Employee' }
  ];

  var state = { ip: null, device: null, status: 'unknown', name: '', role: '', note: '',
    owner: false, adminRole: '', roleName: '', error: null };

  // ------------------------------------------------------------------ api
  function rpc(fn, body) {
    return fetch(CFG.url + '/rest/v1/rpc/' + fn, {
      method: 'POST',
      headers: {
        'apikey': CFG.key,
        'Authorization': 'Bearer ' + CFG.key,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body || {})
    }).then(function (r) {
      return r.text().then(function (t) {
        var parsed = null;
        try { parsed = t ? JSON.parse(t) : null; } catch (e) { parsed = t; }
        if (!r.ok) {
          var msg = (parsed && (parsed.message || parsed.hint)) || ('HTTP ' + r.status);
          throw new Error(msg);
        }
        return parsed;
      });
    });
  }

  /** Public IP of this device, from whichever echo service answers first. */
  function fetchIp() {
    var services = [
      { url: 'https://api.ipify.org?format=json', pick: function (d) { return d.ip; } },
      { url: 'https://ipapi.co/json/', pick: function (d) { return d.ip; } },
      { url: 'https://api.bigdatacloud.net/data/client-ip', pick: function (d) { return d.ipString; } }
    ];
    var i = 0;
    function next() {
      if (i >= services.length) return Promise.reject(new Error('Could not determine this device address'));
      var s = services[i++];
      var ctrl = new AbortController();
      var timer = setTimeout(function () { ctrl.abort(); }, 7000);
      return fetch(s.url, { signal: ctrl.signal }).then(function (r) {
        clearTimeout(timer);
        return r.json();
      }).then(function (d) {
        var ip = s.pick(d);
        if (!ip) throw new Error('no ip');
        return ip;
      }).catch(function () { clearTimeout(timer); return next(); });
    }
    return next();
  }

  function shortDevice() {
    var d = state.device || '';
    return d ? d.slice(0, 8) : '—';
  }

  var Auth = {
    ROLES: ROLES,
    CFG: CFG,
    state: state,
    deviceId: deviceId,

    ownerKey: function () { try { return localStorage.getItem(OWNER_KEY) || ''; } catch (e) { return ''; } },
    setOwnerKey: function (k, role) {
      try {
        if (k) localStorage.setItem(OWNER_KEY, k); else localStorage.removeItem(OWNER_KEY);
        if (role) localStorage.setItem(ROLE_KEY, role); else localStorage.removeItem(ROLE_KEY);
      } catch (e) {}
      state.owner = !!k;
      state.adminRole = k ? (role || '') : '';
    },

    /**
     * 'owner', 'admin' or ''. Cached from the last whoami so the UI can draw
     * before the round trip finishes. Least privilege while it is unknown -
     * the server is the one that actually decides, so a wrongly hidden button
     * costs nothing and a wrongly shown one just errors.
     */
    role: function () {
      if (!Auth.ownerKey()) return '';
      try { return localStorage.getItem(ROLE_KEY) || 'admin'; } catch (e) { return 'admin'; }
    },
    roleLabel: function () {
      var r = Auth.role();
      return r === 'owner' ? 'Owner' : r === 'admin' ? 'Administrator' : 'Not signed in';
    },
    isSignedIn: function () { return !!Auth.ownerKey(); },

    /** Ask the server what this key actually is, and cache it. */
    whoami: function () {
      var k = Auth.ownerKey();
      if (!k) return Promise.resolve({ role: null });
      return rpc('orion_admin_whoami', { p_key: k }).then(function (res) {
        var role = res && res.role;
        if (!role) { Auth.setOwnerKey(''); return { role: null }; }
        try { localStorage.setItem(ROLE_KEY, role); } catch (e) {}
        state.adminRole = role;
        state.roleName = (res && res.label) || '';
        return res;
      });
    },

    // ----------------------------------------------------- administrators
    adminsList: function () {
      return rpc('orion_admins_list', { p_key: Auth.ownerKey() });
    },
    adminsAdd: function (label, role) {
      return rpc('orion_admins_add', { p_key: Auth.ownerKey(), p_label: label, p_role: role || 'admin' });
    },
    adminsSetActive: function (id, active) {
      return rpc('orion_admins_set_active', { p_key: Auth.ownerKey(), p_id: id, p_active: !!active });
    },
    adminsRemove: function (id) {
      return rpc('orion_admins_remove', { p_key: Auth.ownerKey(), p_id: id });
    },

    /** Work out where this device stands. */
    check: function () {
      state.device = deviceId();
      return fetchIp().catch(function () { return null; }).then(function (ip) {
        state.ip = ip;
        return rpc('orion_status', { p_device: state.device, p_ip: ip });
      }).then(function (res) {
        state.status = (res && res.status) || 'none';
        state.name = (res && res.name) || '';
        state.role = (res && res.role) || '';
        state.note = (res && res.note) || '';
        state.error = null;
        return state;
      }).catch(function (e) {
        state.error = e.message;
        state.status = 'error';
        return state;
      });
    },

    submit: function (name, reason, role) {
      return rpc('orion_request', {
        p_device: state.device || deviceId(), p_ip: state.ip,
        p_name: name, p_reason: reason, p_role: role,
        p_ua: navigator.userAgent.slice(0, 200)
      }).then(function (res) {
        state.status = (res && res.status) || 'pending';
        state.name = name;
        return state;
      });
    },

    // --------------------------------------------------------------- owner
    /** Accepts the owner key or any active administrator key. */
    verifyOwner: function (key) {
      return rpc('orion_admin_whoami', { p_key: key }).then(function (res) {
        if (!res || !res.role) throw new Error('unauthorised');
        Auth.setOwnerKey(key, res.role);
        return res;
      });
    },
    list: function () {
      var k = Auth.ownerKey();
      if (!k) return Promise.reject(new Error('not signed in as owner'));
      return rpc('orion_admin_list', { p_key: k });
    },
    decide: function (id, status, note) {
      return rpc('orion_admin_decide', { p_key: Auth.ownerKey(), p_id: id, p_status: status, p_note: note || null });
    },
    revoke: function (id) {
      return rpc('orion_admin_revoke', { p_key: Auth.ownerKey(), p_id: id });
    },

    /** "Signed in as staff" - kept under the old name for the Store. */
    isOwner: function () { return !!Auth.ownerKey(); },
    configured: function () { return /^https:\/\/.+\.supabase\.co$/.test(CFG.url) && CFG.key.length > 20; },

    // ---------------------------------------------------------------- gate
    /** Resolves once this device may use Orion. */
    gate: function () {
      return new Promise(function (resolve) {
        var el = document.getElementById('gate');
        el.classList.remove('hidden');
        render('checking');

        function done() {
          el.classList.add('lifting');
          setTimeout(function () { el.classList.add('hidden'); el.classList.remove('lifting'); }, 420);
          resolve(state);
        }

        function refresh() {
          render('checking');
          Auth.check().then(function (s) {
            if (s.status === 'approved' || (s.status === 'error' && Auth.isOwner())) return done();
            if (Auth.isOwner()) return done();
            render(s.status);
          });
        }

        function render(view) {
          var body = document.getElementById('gateBody');
          if (view === 'checking') {
            body.innerHTML = '<div class="gate-spin"><i></i></div><p class="gate-sub">Checking this device…</p>';
            return;
          }
          if (view === 'error') {
            body.innerHTML =
              '<h2>Cannot verify access</h2>' +
              '<p class="gate-sub">' + U.esc(state.error || 'The access service did not answer.') + '</p>' +
              '<div class="gate-actions"><button class="btn primary" data-a="retry">Try again</button>' +
              '<button class="btn" data-a="owner">Owner sign in</button></div>';
            return;
          }
          if (view === 'pending') {
            body.innerHTML =
              '<h2>Waiting for approval</h2>' +
              '<p class="gate-sub">Your request was sent' + (state.name ? ' as <b>' + U.esc(state.name) + '</b>' : '') +
              '. The owner sees it inside Orion and can approve it from there.</p>' +
              '<div class="gate-ip">This device: <code>' + U.esc(shortDevice()) + '</code>' +
              (state.ip ? ' · network ' + U.esc(state.ip) : '') + '</div>' +
              '<div class="gate-actions"><button class="btn primary" data-a="retry">Check again</button>' +
              '<button class="btn" data-a="owner">Owner sign in</button></div>';
            return;
          }
          if (view === 'denied') {
            body.innerHTML =
              '<h2>Access denied</h2>' +
              '<p class="gate-sub">This device was not approved.' +
              (state.note ? ' <br><i>' + U.esc(state.note) + '</i>' : '') + '</p>' +
              '<div class="gate-ip">This device: <code>' + U.esc(shortDevice()) + '</code>' +
              (state.ip ? ' · network ' + U.esc(state.ip) : '') + '</div>' +
              '<div class="gate-actions"><button class="btn" data-a="owner">Owner sign in</button></div>';
            return;
          }
          // no request yet
          body.innerHTML =
            '<h2>Request access</h2>' +
            '<p class="gate-sub">Orion is private. Tell the owner who you are and they can let this device in.</p>' +
            '<form class="gate-form" autocomplete="off">' +
              '<label>Your name<input name="name" maxlength="80" placeholder="Jane Doe" required></label>' +
              '<label>Why do you want access?<textarea name="reason" maxlength="600" rows="3" ' +
                'placeholder="What you would like to use Orion for" required></textarea></label>' +
              '<label>Role' +
                '<select name="role">' + ROLES.map(function (r) {
                  return '<option value="' + r.id + '">' + r.label + '</option>';
                }).join('') + '</select></label>' +
              '<div class="gate-ip">This device: <code>' + U.esc(shortDevice()) + '</code>' +
                ' — approval applies to this device only, not to everyone on your network.</div>' +
              '<div class="gate-actions"><button class="btn primary" type="submit">Send request</button>' +
              '<button class="btn" type="button" data-a="owner">Owner sign in</button></div>' +
            '</form>';
        }

        function ownerPrompt() {
          var body = document.getElementById('gateBody');
          body.innerHTML =
            '<h2>Owner or admin sign in</h2>' +
            '<p class="gate-sub">Enter the owner key, or an administrator key the owner gave you.</p>' +
            '<form class="gate-form" autocomplete="off">' +
              '<label>Access key<input name="key" placeholder="orion-xxxxx-xxxxx-xxxxx" required></label>' +
              '<div class="gate-err hidden" data-err></div>' +
              '<div class="gate-actions"><button class="btn primary" type="submit">Sign in</button>' +
              '<button class="btn" type="button" data-a="back">Back</button></div>' +
            '</form>';
        }

        el.addEventListener('click', function (e) {
          var b = e.target.closest('[data-a]');
          if (!b) return;
          if (b.dataset.a === 'retry') refresh();
          if (b.dataset.a === 'owner') ownerPrompt();
          if (b.dataset.a === 'back') render(state.status);
        });

        el.addEventListener('submit', function (e) {
          e.preventDefault();
          var f = e.target;
          var btn = f.querySelector('button[type="submit"]');
          if (f.key) {
            btn.disabled = true; btn.textContent = 'Checking…';
            Auth.verifyOwner(f.key.value.trim()).then(function (who) {
              Emu.notify('Orion', 'Signed in as ' +
                (who.role === 'owner' ? 'the owner' : 'an administrator') + ' on this device.', 'shield');
              done();
            }).catch(function (err) {
              btn.disabled = false; btn.textContent = 'Sign in';
              var box = f.querySelector('[data-err]');
              box.textContent = /unauthor/i.test(err.message) ? 'That key was not recognised.' : err.message;
              box.classList.remove('hidden');
            });
            return;
          }
          btn.disabled = true; btn.textContent = 'Sending…';
          Auth.submit(f.name.value.trim(), f.reason.value.trim(), f.role.value)
            .then(function () { render('pending'); })
            .catch(function (err) {
              btn.disabled = false; btn.textContent = 'Send request';
              alert('Could not send the request: ' + err.message);
            });
        });

        refresh();
      });
    },

    /**
     * Sign in with an owner or administrator key from inside a running Orion,
     * without going back through the access gate. Bound to Ctrl+Alt+Shift+A.
     * The field is a password box: these keys are handed out to other people
     * and typed on shared screens.
     */
    signInPrompt: function () {
      var host = document.getElementById('desktop');
      if (!host || host.classList.contains('hidden')) return null;
      var existing = host.querySelector('[data-authprompt]');
      if (existing) { existing.querySelector('input').focus(); return null; }

      var signedIn = Auth.isSignedIn();
      var back = U.el('<div class="dlg-backdrop" data-authprompt><div class="dlg">' +
        '<h3>Owner or admin sign in</h3>' +
        '<div class="dlg-body">' +
          (signedIn
            ? '<p style="padding:0 0 12px">Signed in as <b>' + U.esc(Auth.roleLabel()) +
              '</b> on this device. Enter another key to switch, or sign out.</p>'
            : '<p style="padding:0 0 12px">Enter the owner key, or an administrator key the ' +
              'owner gave you. This unlocks Orion Admin on this device.</p>') +
          '<form class="gate-form" autocomplete="off">' +
            '<label>Access key<input name="key" type="password" autocomplete="off" ' +
              'placeholder="orion-xxxxxx-xxxxxx-xxxxxx"></label>' +
            '<div class="gate-err hidden" data-err></div>' +
          '</form>' +
        '</div>' +
        '<div class="dlg-actions">' +
          '<button data-x="cancel">Cancel</button>' +
          (signedIn ? '<button data-x="out">Sign out</button>' : '') +
          '<button class="primary" data-x="go">Sign in</button>' +
        '</div></div></div>');
      host.appendChild(back);

      var form = back.querySelector('form');
      var box = back.querySelector('[data-err]');
      form.key.focus();

      function fail(msg) {
        box.textContent = msg;
        box.classList.remove('hidden');
      }

      function submit() {
        var key = form.key.value.trim();
        if (!key) return fail('Enter a key first.');
        var go = back.querySelector('[data-x="go"]');
        go.disabled = true;
        go.textContent = 'Checking…';
        Auth.verifyOwner(key).then(function (who) {
          back.remove();
          Emu.notify('Orion', 'Signed in as ' +
            (who.role === 'owner' ? 'the owner' : 'an administrator') + ' on this device.', 'shield');
          if (global.AccessApp) global.AccessApp.syncVisibility();
          Emu.emit('apps');
        }).catch(function (err) {
          go.disabled = false;
          go.textContent = 'Sign in';
          fail(/unauthor/i.test(err.message) ? 'That key was not recognised.' : err.message);
        });
      }

      back.addEventListener('click', function (e) {
        var b = e.target.closest('[data-x]');
        if (!b) return;
        if (b.dataset.x === 'cancel') { back.remove(); return; }
        if (b.dataset.x === 'out') {
          Auth.setOwnerKey('');
          back.remove();
          Emu.notify('Orion', 'Signed out of the admin console on this device.', 'shield');
          if (global.AccessApp) global.AccessApp.syncVisibility();
          Emu.emit('apps');
          return;
        }
        submit();
      });
      form.addEventListener('submit', function (e) { e.preventDefault(); submit(); });
      back.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { e.stopPropagation(); back.remove(); }
      });
      return back;
    },

    /** Poll for new requests so the owner gets notified inside Orion. */
    watch: function () {
      if (!Auth.isOwner()) return;
      var seen = {};
      var first = true;
      function poll() {
        Auth.list().then(function (rows) {
          var pending = (rows || []).filter(function (r) { return r.status === 'pending'; });
          pending.forEach(function (r) {
            if (seen[r.id]) return;
            seen[r.id] = true;
            if (first) return;
            Emu.notify('Access request',
              r.name + ' (' + r.role + ') is asking for access.', 'shield', {
                action: { do: 'access:open' },
                buttons: [
                  { label: 'Approve', primary: true, action: { do: 'access:decide', id: r.id, status: 'approved', name: r.name } },
                  { label: 'Deny', action: { do: 'access:decide', id: r.id, status: 'denied', name: r.name } }
                ]
              });
          });
          if (first && pending.length) {
            Emu.notify('Access requests', pending.length + ' request' + (pending.length === 1 ? '' : 's') +
              ' waiting for a decision.', 'shield', { action: { do: 'access:open' } });
          }
          first = false;
          Emu.emit('access', pending.length);
        }).catch(function () { /* offline; try again next tick */ });
      }
      poll();
      setInterval(poll, 45000);
    }
  };

  /**
   * Ctrl+Alt+Shift+A opens the key box from anywhere in Orion. Captured, so a
   * focused text field in an app cannot swallow it, and deliberately obscure
   * enough that nobody trips it by accident.
   */
  document.addEventListener('keydown', function (e) {
    if (!e.ctrlKey || !e.altKey || !e.shiftKey || e.metaKey) return;
    if (String(e.key).toLowerCase() !== 'a') return;
    e.preventDefault();
    e.stopPropagation();
    Auth.signInPrompt();
  }, true);

  global.Auth = Auth;
})(window);
