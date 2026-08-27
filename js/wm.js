/* ===== Window manager: drag, resize, snap, focus, dialogs ===== */
(function (global) {
  'use strict';

  var Emu = global.Emu, U = Emu.util, Icons = global.Icons;
  var layer, preview;
  var wins = [];
  var zTop = 10;
  var cascade = 0;
  var dragState = null;
  var snapTarget = null;

  function bounds() {
    return { w: layer.clientWidth, h: layer.clientHeight };
  }

  function ctrlSvg(kind) {
    if (kind === 'min') return '<svg viewBox="0 0 10 10"><path d="M0 5h10" stroke="currentColor" stroke-width="1"/></svg>';
    if (kind === 'max') return '<svg viewBox="0 0 10 10"><rect x=".5" y=".5" width="9" height="9" fill="none" stroke="currentColor" stroke-width="1"/></svg>';
    if (kind === 'restore') return '<svg viewBox="0 0 10 10"><rect x=".5" y="2.5" width="7" height="7" fill="none" stroke="currentColor" stroke-width="1"/><path d="M2.5 2.5v-2h7v7h-2" fill="none" stroke="currentColor" stroke-width="1"/></svg>';
    return '<svg viewBox="0 0 10 10"><path d="M0 0l10 10M10 0L0 10" stroke="currentColor" stroke-width="1"/></svg>';
  }

  var WM = {
    windows: wins,
    focused: null,

    init: function () {
      layer = U.$('#windowLayer');
      preview = U.$('#snapPreview');
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('resize', U.debounce(function () {
        var b = bounds();
        wins.forEach(function (w) {
          if (w.maxed || w.snapped) { applyRect(w, regionRect(w.snapped || 'max')); return; }
          w.rect.x = U.clamp(w.rect.x, -w.rect.w + 80, b.w - 80);
          w.rect.y = U.clamp(w.rect.y, 0, b.h - 40);
          w.rect.w = Math.min(w.rect.w, b.w);
          w.rect.h = Math.min(w.rect.h, b.h);
          applyRect(w, w.rect);
        });
      }, 120));
    },

    create: function (opt) {
      opt = opt || {};
      var b = bounds();
      var mobile = b.w < 760;
      var w = Math.min(opt.width || 900, b.w - 20);
      var h = Math.min(opt.height || 600, b.h - 20);
      var x = opt.x != null ? opt.x : Math.round((b.w - w) / 2 + (cascade % 6) * 26 - 65);
      var y = opt.y != null ? opt.y : Math.round((b.h - h) / 2 + (cascade % 6) * 22 - 55);
      cascade++;

      var win = {
        id: U.uid('win'),
        appId: opt.appId || 'app',
        title: opt.title || 'Window',
        icon: opt.icon || 'file',
        rect: { x: U.clamp(x, 4, Math.max(4, b.w - w - 4)), y: U.clamp(y, 4, Math.max(4, b.h - h - 4)), w: w, h: h },
        prev: null,
        maxed: false,
        snapped: null,
        minimized: false,
        resizable: opt.resizable !== false,
        minWidth: opt.minWidth || 340,
        minHeight: opt.minHeight || 220,
        onClose: opt.onClose || null,
        onResize: null,
        data: {}
      };

      var el = document.createElement('div');
      el.className = 'win' + (opt.tabs ? ' has-tabs' : '') + (opt.className ? ' ' + opt.className : '');
      el.dataset.win = win.id;
      el.innerHTML =
        '<div class="win-titlebar">' +
          '<div class="win-drag">' + (opt.tabs ? '' : Icons.get(win.icon) + '<span class="win-title"></span>') + '</div>' +
          '<div class="win-slot"></div>' +
          '<div class="win-controls">' +
            '<button class="wc-min" title="Minimize">' + ctrlSvg('min') + '</button>' +
            '<button class="wc-max" title="Maximize">' + ctrlSvg('max') + '</button>' +
            '<button class="wc-close" title="Close">' + ctrlSvg('close') + '</button>' +
          '</div>' +
        '</div>' +
        '<div class="win-body"></div>' +
        (win.resizable ? ['n', 's', 'w', 'e', 'nw', 'ne', 'sw', 'se'].map(function (d) {
          return '<div class="rz rz-' + d + '" data-dir="' + d + '"></div>';
        }).join('') : '');

      win.el = el;
      win.body = el.querySelector('.win-body');
      win.slot = el.querySelector('.win-slot');
      win.dragEl = el.querySelector('.win-drag');
      win.titleEl = el.querySelector('.win-title');
      if (win.titleEl) win.titleEl.textContent = win.title;

      // Window methods --------------------------------------------------
      win.setTitle = function (t) {
        win.title = t;
        if (win.titleEl) win.titleEl.textContent = t;
        Emu.emit('win:change', win);
      };
      win.focus = function () { focus(win); };
      win.close = function () { close(win); };
      win.minimize = function () { minimize(win); };
      win.toggleMax = function () { win.maxed || win.snapped ? restore(win) : maximize(win); };
      win.snapTo = function (region) { snapTo(win, region); };
      win.setBusy = function (on) { el.classList.toggle('busy', !!on); };

      el.addEventListener('pointerdown', function () { focus(win); }, true);
      el.querySelector('.wc-min').addEventListener('click', function (e) { e.stopPropagation(); minimize(win); });
      el.querySelector('.wc-close').addEventListener('click', function (e) { e.stopPropagation(); close(win); });

      var maxBtn = el.querySelector('.wc-max');
      maxBtn.addEventListener('click', function (e) { e.stopPropagation(); win.toggleMax(); });
      attachSnapFlyout(win, maxBtn);

      win.dragEl.addEventListener('pointerdown', startDrag(win));
      win.dragEl.addEventListener('dblclick', function () { win.toggleMax(); });
      el.querySelector('.win-titlebar').addEventListener('pointerdown', function (e) {
        if (e.target.closest('.win-controls') || e.target.closest('.etab') || e.target.closest('.etab-new')) return;
        if (e.target.closest('.win-slot') && !e.target.classList.contains('edge-tabs')) return;
        startDrag(win)(e);
      });
      U.$$('.rz', el).forEach(function (h) {
        h.addEventListener('pointerdown', startResize(win, h.dataset.dir));
      });

      applyRect(win, win.rect);
      el.style.zIndex = ++zTop;
      layer.appendChild(el);
      wins.push(win);
      focus(win);

      if (mobile || opt.maximized) maximize(win);
      Emu.emit('win:open', win);
      return win;
    },

    list: function () { return wins.slice(); },
    byApp: function (appId) { return wins.filter(function (w) { return w.appId === appId; }); },
    get: function (id) { return wins.filter(function (w) { return w.id === id; })[0]; },

    minimizeAll: function () {
      var any = wins.some(function (w) { return !w.minimized; });
      wins.forEach(function (w) { any ? minimize(w, true) : unminimize(w); });
    },

    closeAll: function (appId) {
      wins.filter(function (w) { return !appId || w.appId === appId; })
        .forEach(function (w) { close(w); });
    },

    focus: focus,
    unminimize: unminimize,

    /** Modal dialog. buttons: [{label, value, primary}] -> Promise(value) */
    dialog: function (opt) {
      return new Promise(function (resolve) {
        var host = opt.win ? opt.win.el : U.$('#desktop');
        var back = U.el('<div class="dlg-backdrop"><div class="dlg"></div></div>');
        var dlg = back.firstElementChild;
        dlg.innerHTML = '<h3>' + U.esc(opt.title || '') + '</h3>' +
          (opt.message ? '<p>' + U.esc(opt.message).replace(/\n/g, '<br>') + '</p>' : '') +
          (opt.input != null ? '<div class="dlg-body"><input type="text" value="' + U.esc(opt.input) + '"></div>' : '') +
          '<div class="dlg-actions"></div>';
        var actions = dlg.querySelector('.dlg-actions');
        (opt.buttons || [{ label: 'OK', value: true, primary: true }]).forEach(function (b) {
          var btn = U.el('<button' + (b.primary ? ' class="primary"' : '') + '>' + U.esc(b.label) + '</button>');
          btn.addEventListener('click', function () {
            var input = dlg.querySelector('input');
            back.remove();
            resolve(b.value === true && input ? input.value : b.value);
          });
          actions.appendChild(btn);
        });
        host.appendChild(back);
        var inp = dlg.querySelector('input');
        if (inp) {
          inp.focus(); inp.select();
          inp.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') { back.remove(); resolve(inp.value); }
            if (e.key === 'Escape') { back.remove(); resolve(null); }
          });
        }
      });
    },

    prompt: function (title, message, value, win) {
      return WM.dialog({
        title: title, message: message, input: value == null ? '' : value, win: win,
        buttons: [{ label: 'OK', value: true, primary: true }, { label: 'Cancel', value: null }]
      });
    },

    alert: function (title, message, win) {
      return WM.dialog({ title: title, message: message, win: win, buttons: [{ label: 'OK', value: true, primary: true }] });
    },

    confirm: function (title, message, win) {
      return WM.dialog({
        title: title, message: message, win: win,
        buttons: [{ label: 'Yes', value: true, primary: true }, { label: 'No', value: false }]
      });
    }
  };

  // ---- geometry ----------------------------------------------------------
  function applyRect(win, r) {
    win.el.style.left = r.x + 'px';
    win.el.style.top = r.y + 'px';
    win.el.style.width = r.w + 'px';
    win.el.style.height = r.h + 'px';
    if (win.onResize) win.onResize(r);
  }

  function regionRect(region) {
    var b = bounds(), hw = Math.round(b.w / 2), hh = Math.round(b.h / 2), tw = Math.round(b.w / 3);
    switch (region) {
      case 'left': return { x: 0, y: 0, w: hw, h: b.h };
      case 'right': return { x: hw, y: 0, w: b.w - hw, h: b.h };
      case 'tl': return { x: 0, y: 0, w: hw, h: hh };
      case 'tr': return { x: hw, y: 0, w: b.w - hw, h: hh };
      case 'bl': return { x: 0, y: hh, w: hw, h: b.h - hh };
      case 'br': return { x: hw, y: hh, w: b.w - hw, h: b.h - hh };
      case 'l3': return { x: 0, y: 0, w: tw, h: b.h };
      case 'm3': return { x: tw, y: 0, w: tw, h: b.h };
      case 'r3': return { x: tw * 2, y: 0, w: b.w - tw * 2, h: b.h };
      case 'l23': return { x: 0, y: 0, w: Math.round(b.w * 2 / 3), h: b.h };
      case 'r13': return { x: Math.round(b.w * 2 / 3), y: 0, w: b.w - Math.round(b.w * 2 / 3), h: b.h };
      default: return { x: 0, y: 0, w: b.w, h: b.h };
    }
  }

  /** Keep z-indices well below the taskbar (600) no matter how long a session runs. */
  function normalizeZ() {
    if (zTop < 400) return;
    wins.slice().sort(function (a, b) {
      return (+a.el.style.zIndex || 0) - (+b.el.style.zIndex || 0);
    }).forEach(function (w, i) { w.el.style.zIndex = 10 + i; });
    zTop = 10 + wins.length;
  }

  function focus(win) {
    if (WM.focused === win && !win.minimized) return;
    if (win.minimized) unminimize(win);
    wins.forEach(function (w) { w.el.classList.toggle('inactive', w !== win); });
    normalizeZ();
    win.el.style.zIndex = ++zTop;
    WM.focused = win;
    Emu.emit('win:focus', win);
  }

  function close(win) {
    if (win.onClose && win.onClose() === false) return;
    win.el.classList.add('closing');
    setTimeout(function () {
      win.el.remove();
      var i = wins.indexOf(win);
      if (i >= 0) wins.splice(i, 1);
      if (WM.focused === win) {
        WM.focused = null;
        var next = wins.filter(function (w) { return !w.minimized; }).pop();
        if (next) focus(next);
      }
      Emu.emit('win:close', win);
    }, 130);
  }

  function minimize(win, silent) {
    if (win.minimized) return;
    win.minimized = true;
    win.el.classList.add('minimizing');
    setTimeout(function () {
      win.el.style.display = 'none';
      win.el.classList.remove('minimizing');
    }, 150);
    if (WM.focused === win) WM.focused = null;
    if (!silent) {
      var next = wins.filter(function (w) { return !w.minimized; }).pop();
      if (next) focus(next);
    }
    Emu.emit('win:change', win);
  }

  function unminimize(win) {
    if (!win.minimized) return;
    win.minimized = false;
    win.el.style.display = '';
    win.el.classList.add('win-restoring');
    setTimeout(function () { win.el.classList.remove('win-restoring'); }, 160);
    focus(win);
    Emu.emit('win:change', win);
  }

  function maximize(win) {
    if (win.maxed) return;
    if (!win.snapped) win.prev = Object.assign({}, win.rect);
    win.maxed = true;
    win.snapped = null;
    win.el.classList.add('maximized', 'snapping');
    applyRect(win, regionRect('max'));
    setMaxIcon(win, true);
    setTimeout(function () { win.el.classList.remove('snapping'); }, 180);
    Emu.emit('win:change', win);
  }

  function restore(win) {
    var r = win.prev || { x: 80, y: 60, w: 900, h: 600 };
    win.maxed = false;
    win.snapped = null;
    win.rect = Object.assign({}, r);
    win.el.classList.remove('maximized');
    win.el.classList.add('snapping');
    applyRect(win, win.rect);
    setMaxIcon(win, false);
    setTimeout(function () { win.el.classList.remove('snapping'); }, 180);
    Emu.emit('win:change', win);
  }

  function snapTo(win, region) {
    if (region === 'max') return maximize(win);
    if (!win.maxed && !win.snapped) win.prev = Object.assign({}, win.rect);
    win.maxed = false;
    win.snapped = region;
    win.el.classList.remove('maximized');
    win.el.classList.add('snapping');
    win.rect = regionRect(region);
    applyRect(win, win.rect);
    setMaxIcon(win, false);
    setTimeout(function () { win.el.classList.remove('snapping'); }, 180);
    Emu.emit('win:change', win);
  }

  function setMaxIcon(win, maxed) {
    var b = win.el.querySelector('.wc-max');
    b.innerHTML = ctrlSvg(maxed ? 'restore' : 'max');
    b.title = maxed ? 'Restore' : 'Maximize';
  }

  // ---- drag / resize -----------------------------------------------------
  function startDrag(win) {
    return function (e) {
      if (e.button !== 0) return;
      if (e.target.closest('button') || e.target.closest('input')) return;
      focus(win);
      var b = bounds();
      var wasMax = win.maxed || !!win.snapped;
      var startRect = Object.assign({}, wasMax ? (win.prev || win.rect) : win.rect);
      var px = e.clientX, py = e.clientY;
      var offX, offY;
      if (wasMax) {
        var cur = win.el.getBoundingClientRect();
        var ratio = (px - cur.left) / cur.width;
        offX = ratio * startRect.w;
        offY = Math.min(py - cur.top, 20);
      } else {
        var r = win.el.getBoundingClientRect();
        offX = px - r.left;
        offY = py - r.top;
      }
      dragState = {
        type: 'move', win: win, offX: offX, offY: offY, wasMax: wasMax,
        startRect: startRect, started: false, b: b
      };
      win.el.setPointerCapture && win.el.setPointerCapture(e.pointerId);
    };
  }

  function startResize(win, dir) {
    return function (e) {
      if (e.button !== 0) return;
      e.stopPropagation();
      focus(win);
      dragState = {
        type: 'resize', win: win, dir: dir,
        px: e.clientX, py: e.clientY,
        startRect: Object.assign({}, win.rect), b: bounds()
      };
      win.el.classList.add('resizing');
    };
  }

  function onMove(e) {
    if (!dragState) return;
    var win = dragState.win, b = dragState.b;

    if (dragState.type === 'move') {
      if (!dragState.started) {
        if (Math.abs(e.clientX - (dragState.startRect.x + dragState.offX)) < 3 &&
            Math.abs(e.clientY - (dragState.startRect.y + dragState.offY)) < 3 && !dragState.wasMax) return;
        dragState.started = true;
        win.el.classList.add('dragging');
        if (dragState.wasMax) {
          win.maxed = false; win.snapped = null;
          win.el.classList.remove('maximized');
          setMaxIcon(win, false);
          win.rect = { x: 0, y: 0, w: dragState.startRect.w, h: dragState.startRect.h };
          applyRect(win, win.rect);
        }
      }
      var layerBox = layer.getBoundingClientRect();
      var nx = e.clientX - layerBox.left - dragState.offX;
      var ny = e.clientY - layerBox.top - dragState.offY;
      win.rect.x = Math.round(U.clamp(nx, -win.rect.w + 90, b.w - 90));
      win.rect.y = Math.round(U.clamp(ny, 0, b.h - 34));
      applyRect(win, win.rect);

      // snap zones
      var lx = e.clientX - layerBox.left, ly = e.clientY - layerBox.top;
      var region = null, edge = 12;
      if (ly <= edge && lx > b.w * 0.25 && lx < b.w * 0.75) region = 'max';
      else if (lx <= edge) region = ly < b.h * 0.28 ? 'tl' : ly > b.h * 0.72 ? 'bl' : 'left';
      else if (lx >= b.w - edge) region = ly < b.h * 0.28 ? 'tr' : ly > b.h * 0.72 ? 'br' : 'right';
      else if (ly <= edge) region = 'max';
      showSnapPreview(region);
      return;
    }

    // resize
    var d = dragState.dir, r = dragState.startRect;
    var dx = e.clientX - dragState.px, dy = e.clientY - dragState.py;
    var nr = { x: r.x, y: r.y, w: r.w, h: r.h };
    if (d.indexOf('e') >= 0) nr.w = r.w + dx;
    if (d.indexOf('s') >= 0) nr.h = r.h + dy;
    if (d.indexOf('w') >= 0) { nr.w = r.w - dx; nr.x = r.x + dx; }
    if (d.indexOf('n') >= 0) { nr.h = r.h - dy; nr.y = r.y + dy; }
    if (nr.w < win.minWidth) { if (d.indexOf('w') >= 0) nr.x = r.x + r.w - win.minWidth; nr.w = win.minWidth; }
    if (nr.h < win.minHeight) { if (d.indexOf('n') >= 0) nr.y = r.y + r.h - win.minHeight; nr.h = win.minHeight; }
    nr.x = Math.round(nr.x); nr.y = Math.round(nr.y);
    nr.w = Math.round(nr.w); nr.h = Math.round(nr.h);
    win.rect = nr;
    win.maxed = false; win.snapped = null;
    win.el.classList.remove('maximized');
    applyRect(win, nr);
  }

  function onUp() {
    if (!dragState) return;
    var win = dragState.win;
    win.el.classList.remove('dragging', 'resizing');
    if (dragState.type === 'move' && snapTarget) {
      snapTo(win, snapTarget);
    }
    showSnapPreview(null);
    dragState = null;
  }

  function showSnapPreview(region) {
    snapTarget = region;
    if (!region) { preview.classList.add('hidden'); return; }
    var r = regionRect(region);
    // Sit above the other windows but below the one being dragged.
    preview.style.zIndex = Math.max(1, (+(dragState && dragState.win.el.style.zIndex) || 10) - 1);
    preview.style.left = (r.x + 6) + 'px';
    preview.style.top = (r.y + 6) + 'px';
    preview.style.width = (r.w - 12) + 'px';
    preview.style.height = (r.h - 12) + 'px';
    preview.classList.remove('hidden');
  }

  // ---- snap layouts flyout ------------------------------------------------
  var LAYOUTS = [
    { cls: 'snap-l2', zones: ['left', 'right'] },
    { cls: 'snap-l2b', zones: ['l23', 'r13'] },
    { cls: 'snap-l3', zones: ['l3', 'm3', 'r3'] },
    { cls: 'snap-l4', zones: ['tl', 'tr', 'bl', 'br'] }
  ];

  function attachSnapFlyout(win, btn) {
    var fly = null, hideTimer = null;

    function build() {
      if (fly) return;
      fly = U.el('<div class="snap-flyout"></div>');
      LAYOUTS.forEach(function (L) {
        var opt = U.el('<div class="snap-opt ' + L.cls + '"></div>');
        L.zones.forEach(function (z) {
          var cell = document.createElement('div');
          cell.addEventListener('click', function () { snapTo(win, z); hide(); });
          opt.appendChild(cell);
        });
        fly.appendChild(opt);
      });
      var r = btn.getBoundingClientRect();
      fly.style.left = Math.max(8, r.left - 130) + 'px';
      fly.style.top = (r.bottom + 4) + 'px';
      fly.addEventListener('pointerenter', function () { clearTimeout(hideTimer); });
      fly.addEventListener('pointerleave', function () { hideTimer = setTimeout(hide, 220); });
      document.getElementById('desktop').appendChild(fly);
    }
    function hide() { if (fly) { fly.remove(); fly = null; } }

    var showTimer = null;
    btn.addEventListener('pointerenter', function () {
      if (bounds().w < 760) return;
      clearTimeout(hideTimer);
      showTimer = setTimeout(build, 480);
    });
    btn.addEventListener('pointerleave', function () {
      clearTimeout(showTimer);
      hideTimer = setTimeout(hide, 220);
    });
    btn.addEventListener('click', function () { clearTimeout(showTimer); hide(); });
    Emu.on('win:close', function (w) { if (w === win) hide(); });
  }

  global.WM = WM;
})(window);
