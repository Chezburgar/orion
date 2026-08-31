/* ===== Orion Creative: Draw (vector) and Photo (raster) =====
   Orion's own design tools. Draw keeps a live list of shapes and exports real
   SVG; Photo works on a canvas with an undo stack and bakes its adjustments
   into the pixels. Both save into the Orion filesystem.                    */
(function (global) {
  'use strict';

  var Emu = global.Emu, U = Emu.util, Icons = global.Icons, WM = global.WM, VFS = global.VFS;

  var PICS = VFS.HOME + '\\Pictures';
  var DOCS = VFS.HOME + '\\Documents';

  function ensure(dir) { if (!VFS.exists(dir)) VFS.mkdir(dir); return dir; }

  // ==================================================================
  // Orion Draw - vector illustration
  // ==================================================================
  function launchDraw(args) {
    var win = WM.create({
      appId: 'draw', title: 'Orion Draw', icon: 'draw',
      width: 1040, height: 700, minWidth: 620, minHeight: 420
    });

    var W = 900, H = 560;
    var shapes = [];
    var selId = null;
    var tool = 'select';
    var path = (args && args.path) || null;
    var dirty = false;
    var style = { fill: '#6366f1', stroke: '#e6e8ee', width: 2, opacity: 1 };
    var drag = null;

    var TOOLS = [
      ['select', 'Select', 'cursor'], ['rect', 'Rectangle', 'shaperect'],
      ['ellipse', 'Ellipse', 'shapeellipse'], ['line', 'Line', 'shapeline'],
      ['pen', 'Pen', 'pen'], ['text', 'Text', 'text']
    ];

    win.body.innerHTML =
      '<div class="of dr">' +
        '<div class="of-bar">' +
          '<button class="btn" data-file="new">New</button>' +
          '<button class="btn" data-file="open">Open</button>' +
          '<button class="btn primary" data-file="save">Save</button>' +
          '<button class="btn" data-file="svg">Export SVG</button>' +
          '<button class="btn" data-file="png">Export PNG</button>' +
          '<span class="of-sep"></span>' +
          TOOLS.map(function (t) {
            return '<button class="e-btn' + (t[0] === 'select' ? ' on' : '') + '" data-tool="' + t[0] +
              '" title="' + t[1] + '">' + Icons.get(t[2]) + '</button>';
          }).join('') +
          '<span class="of-sep"></span>' +
          '<label class="dr-lab">Fill<input type="color" data-s="fill" value="#6366f1"></label>' +
          '<label class="dr-lab">Line<input type="color" data-s="stroke" value="#e6e8ee"></label>' +
          '<label class="dr-lab">W<input type="range" min="0" max="20" value="2" data-s="width"></label>' +
          '<label class="dr-lab">Opacity<input type="range" min="10" max="100" value="100" data-s="opacity"></label>' +
        '</div>' +
        '<div class="dr-body">' +
          '<div class="dr-stage"><svg class="dr-canvas" viewBox="0 0 ' + W + ' ' + H + '" ' +
            'width="' + W + '" height="' + H + '" xmlns="http://www.w3.org/2000/svg"></svg></div>' +
          '<div class="dr-side">' +
            '<div class="nt-head">Layers</div><div class="dr-layers" data-layers></div>' +
            '<div class="dr-ops"><button class="btn" data-op="up">Bring forward</button>' +
            '<button class="btn" data-op="down">Send back</button>' +
            '<button class="btn" data-op="dup">Duplicate</button>' +
            '<button class="btn danger" data-op="del">Delete</button></div>' +
          '</div>' +
        '</div>' +
        '<div class="ex-status"><span data-hint>Pick a tool, then drag on the canvas</span>' +
          '<span style="margin-left:auto" data-where>Not saved yet</span></div>' +
      '</div>';

    var svg = U.$('.dr-canvas', win.body);
    var layers = U.$('[data-layers]', win.body);
    var hint = U.$('[data-hint]', win.body);
    var where = U.$('[data-where]', win.body);

    function setTitle() {
      win.setTitle((path ? VFS.nameOf(path) : 'Untitled') + (dirty ? ' *' : '') + ' - Orion Draw');
      where.textContent = path || 'Not saved yet';
    }

    /** Shape -> SVG markup. Used for both the live canvas and the export. */
    function markup(s) {
      var common = 'fill="' + (s.fill || 'none') + '" stroke="' + (s.stroke || 'none') +
        '" stroke-width="' + s.width + '" opacity="' + s.opacity + '"';
      if (s.type === 'rect') {
        return '<rect x="' + Math.min(s.x, s.x2) + '" y="' + Math.min(s.y, s.y2) +
          '" width="' + Math.abs(s.x2 - s.x) + '" height="' + Math.abs(s.y2 - s.y) +
          '" rx="' + (s.r || 0) + '" ' + common + '/>';
      }
      if (s.type === 'ellipse') {
        return '<ellipse cx="' + (s.x + s.x2) / 2 + '" cy="' + (s.y + s.y2) / 2 +
          '" rx="' + Math.abs(s.x2 - s.x) / 2 + '" ry="' + Math.abs(s.y2 - s.y) / 2 + '" ' + common + '/>';
      }
      if (s.type === 'line') {
        return '<line x1="' + s.x + '" y1="' + s.y + '" x2="' + s.x2 + '" y2="' + s.y2 +
          '" stroke="' + s.stroke + '" stroke-width="' + Math.max(1, s.width) +
          '" stroke-linecap="round" opacity="' + s.opacity + '"/>';
      }
      if (s.type === 'pen') {
        return '<polyline points="' + s.pts.map(function (p) { return p[0] + ',' + p[1]; }).join(' ') +
          '" fill="none" stroke="' + s.stroke + '" stroke-width="' + Math.max(1, s.width) +
          '" stroke-linecap="round" stroke-linejoin="round" opacity="' + s.opacity + '"/>';
      }
      if (s.type === 'text') {
        return '<text x="' + s.x + '" y="' + s.y + '" fill="' + s.fill +
          '" font-size="' + (s.size || 32) + '" font-family="Segoe UI, system-ui, sans-serif" opacity="' +
          s.opacity + '">' + U.esc(s.text || '') + '</text>';
      }
      return '';
    }

    function bbox(s) {
      if (s.type === 'pen') {
        var xs = s.pts.map(function (p) { return p[0]; }), ys = s.pts.map(function (p) { return p[1]; });
        return { x: Math.min.apply(null, xs), y: Math.min.apply(null, ys),
          w: Math.max.apply(null, xs) - Math.min.apply(null, xs),
          h: Math.max.apply(null, ys) - Math.min.apply(null, ys) };
      }
      if (s.type === 'text') return { x: s.x, y: s.y - (s.size || 32), w: (s.text || '').length * (s.size || 32) * 0.55, h: (s.size || 32) * 1.2 };
      return { x: Math.min(s.x, s.x2), y: Math.min(s.y, s.y2), w: Math.abs(s.x2 - s.x), h: Math.abs(s.y2 - s.y) };
    }

    function exportSvg() {
      return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H +
        '" width="' + W + '" height="' + H + '"><rect width="' + W + '" height="' + H +
        '" fill="#ffffff"/>' + shapes.map(markup).join('') + '</svg>';
    }

    function draw() {
      var sel = shapes.filter(function (s) { return s.id === selId; })[0];
      var handles = '';
      if (sel) {
        var b = bbox(sel);
        handles = '<rect class="dr-sel" x="' + (b.x - 3) + '" y="' + (b.y - 3) + '" width="' + (b.w + 6) +
          '" height="' + (b.h + 6) + '" fill="none" stroke="#4f8cff" stroke-width="1.5" stroke-dasharray="5 4"/>';
      }
      svg.innerHTML = '<rect width="' + W + '" height="' + H + '" fill="#ffffff"/>' +
        shapes.map(markup).join('') + handles;

      layers.innerHTML = shapes.slice().reverse().map(function (s) {
        return '<div class="dr-layer' + (s.id === selId ? ' active' : '') + '" data-id="' + s.id + '">' +
          '<i style="background:' + (s.type === 'line' || s.type === 'pen' ? s.stroke : s.fill) + '"></i>' +
          '<span>' + s.type + '</span></div>';
      }).join('') || '<p class="muted" style="padding:10px 12px;margin:0;font-size:12px">Nothing drawn yet</p>';
      setTitle();
    }

    function pt(e) {
      var r = svg.getBoundingClientRect();
      return [Math.round((e.clientX - r.left) * W / r.width), Math.round((e.clientY - r.top) * H / r.height)];
    }

    function hitTest(p) {
      for (var i = shapes.length - 1; i >= 0; i--) {
        var b = bbox(shapes[i]);
        if (p[0] >= b.x - 4 && p[0] <= b.x + b.w + 4 && p[1] >= b.y - 4 && p[1] <= b.y + b.h + 4) return shapes[i];
      }
      return null;
    }

    svg.addEventListener('pointerdown', function (e) {
      var p = pt(e);
      svg.setPointerCapture(e.pointerId);

      if (tool === 'select') {
        var s = hitTest(p);
        selId = s ? s.id : null;
        if (s) drag = { kind: 'move', id: s.id, from: p, snap: JSON.parse(JSON.stringify(s)) };
        draw();
        return;
      }

      if (tool === 'text') {
        WM.prompt('Orion Draw', 'Text to place', 'Hello', win).then(function (t) {
          if (!t) return;
          shapes.push({ id: U.uid('s'), type: 'text', x: p[0], y: p[1], text: t, size: 32,
            fill: style.fill, stroke: 'none', width: 0, opacity: style.opacity });
          dirty = true; draw();
        });
        return;
      }

      var shape = {
        id: U.uid('s'), type: tool, x: p[0], y: p[1], x2: p[0], y2: p[1],
        fill: tool === 'line' || tool === 'pen' ? 'none' : style.fill,
        stroke: style.stroke, width: style.width, opacity: style.opacity
      };
      if (tool === 'pen') shape.pts = [p];
      shapes.push(shape);
      selId = shape.id;
      drag = { kind: 'draw', id: shape.id };
      dirty = true;
      draw();
    });

    svg.addEventListener('pointermove', function (e) {
      if (!drag) return;
      var p = pt(e);
      var s = shapes.filter(function (x) { return x.id === drag.id; })[0];
      if (!s) return;
      if (drag.kind === 'draw') {
        if (s.type === 'pen') s.pts.push(p);
        else { s.x2 = p[0]; s.y2 = p[1]; }
      } else {
        var dx = p[0] - drag.from[0], dy = p[1] - drag.from[1];
        var o = drag.snap;
        if (s.type === 'pen') s.pts = o.pts.map(function (q) { return [q[0] + dx, q[1] + dy]; });
        else { s.x = o.x + dx; s.y = o.y + dy; if (o.x2 != null) { s.x2 = o.x2 + dx; s.y2 = o.y2 + dy; } }
        dirty = true;
      }
      draw();
    });

    svg.addEventListener('pointerup', function () {
      if (drag && drag.kind === 'draw') {
        var s = shapes.filter(function (x) { return x.id === drag.id; })[0];
        // a click with no drag leaves a zero-size shape behind; drop it
        if (s && s.type !== 'pen' && Math.abs(s.x2 - s.x) < 2 && Math.abs(s.y2 - s.y) < 2) {
          shapes = shapes.filter(function (x) { return x.id !== s.id; });
          selId = null;
        }
      }
      drag = null;
      draw();
    });

    win.body.addEventListener('click', function (e) {
      var t = e.target.closest('[data-tool]');
      if (t) {
        tool = t.dataset.tool;
        U.$$('[data-tool]', win.body).forEach(function (b) { b.classList.toggle('on', b.dataset.tool === tool); });
        hint.textContent = tool === 'select' ? 'Click a shape to select, drag to move'
          : tool === 'text' ? 'Click where the text should start'
          : 'Drag on the canvas to draw';
        return;
      }

      var l = e.target.closest('[data-id]');
      if (l) { selId = l.dataset.id; draw(); return; }

      var op = e.target.closest('[data-op]');
      if (op) {
        var i = shapes.findIndex(function (s) { return s.id === selId; });
        if (i < 0) { WM.alert('Orion Draw', 'Select a shape first.', win); return; }
        var k = op.dataset.op;
        if (k === 'del') shapes.splice(i, 1);
        else if (k === 'up' && i < shapes.length - 1) shapes.splice(i + 1, 0, shapes.splice(i, 1)[0]);
        else if (k === 'down' && i > 0) shapes.splice(i - 1, 0, shapes.splice(i, 1)[0]);
        else if (k === 'dup') {
          var c = JSON.parse(JSON.stringify(shapes[i]));
          c.id = U.uid('s');
          if (c.pts) c.pts = c.pts.map(function (p) { return [p[0] + 16, p[1] + 16]; });
          else { c.x += 16; c.y += 16; if (c.x2 != null) { c.x2 += 16; c.y2 += 16; } }
          shapes.push(c);
          selId = c.id;
        }
        dirty = true;
        draw();
        return;
      }

      var f = e.target.closest('[data-file]');
      if (!f) return;
      var kind = f.dataset.file;

      if (kind === 'new') {
        WM.confirm('Orion Draw', 'Clear the canvas?', win).then(function (ok) {
          if (!ok) return;
          shapes = []; selId = null; path = null; dirty = false; draw();
        });
      } else if (kind === 'save') {
        var payload = JSON.stringify({ v: 1, w: W, h: H, shapes: shapes });
        if (path) {
          VFS.write(path, payload, 'odraw');
          dirty = false; draw();
          Emu.notify('Orion Draw', VFS.nameOf(path) + ' saved.', 'draw');
        } else {
          WM.prompt('Orion Draw', 'Save as', 'Untitled.odraw', win).then(function (n) {
            if (!n) return;
            if (!/\.odraw$/i.test(n)) n += '.odraw';
            path = ensure(DOCS) + '\\' + n;
            VFS.write(path, payload, 'odraw');
            dirty = false; draw();
            Emu.notify('Orion Draw', n + ' saved to Documents.', 'draw');
          });
        }
      } else if (kind === 'open') {
        var list = VFS.list(ensure(DOCS)).filter(function (x) { return /\.odraw$/i.test(x.name); });
        if (!list.length) { WM.alert('Orion Draw', 'No .odraw files in Documents yet.', win); return; }
        WM.prompt('Orion Draw', 'Open which file?\n' + list.map(function (x) { return '· ' + x.name; }).join('\n'),
          list[0].name, win).then(function (n) {
          if (!n) return;
          var hit = list.filter(function (x) { return x.name.toLowerCase() === String(n).toLowerCase(); })[0];
          if (!hit) { WM.alert('Orion Draw', 'No file called "' + n + '".', win); return; }
          try {
            var d = JSON.parse(VFS.read(hit.path) || '{}');
            shapes = d.shapes || [];
            path = hit.path; selId = null; dirty = false;
            draw();
          } catch (err) { WM.alert('Orion Draw', 'That file could not be read.', win); }
        });
      } else if (kind === 'svg') {
        var name = VFS.uniqueName(ensure(PICS), 'Drawing', '.svg');
        VFS.write(PICS + '\\' + name, 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(exportSvg()))), 'svg');
        Emu.notify('Orion Draw', name + ' exported to Pictures.', 'draw');
      } else if (kind === 'png') {
        var img = new Image();
        img.onload = function () {
          var c = document.createElement('canvas');
          c.width = W; c.height = H;
          c.getContext('2d').drawImage(img, 0, 0);
          var pn = VFS.uniqueName(ensure(PICS), 'Drawing', '.png');
          VFS.write(PICS + '\\' + pn, c.toDataURL('image/png'), 'png');
          Emu.notify('Orion Draw', pn + ' exported to Pictures.', 'draw');
        };
        img.onerror = function () { WM.alert('Orion Draw', 'The PNG export failed.', win); };
        img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(exportSvg())));
      }
    });

    win.body.addEventListener('input', function (e) {
      var s = e.target.closest('[data-s]');
      if (!s) return;
      var k = s.dataset.s;
      style[k] = k === 'width' ? parseInt(s.value, 10)
        : k === 'opacity' ? parseInt(s.value, 10) / 100 : s.value;
      var cur = shapes.filter(function (x) { return x.id === selId; })[0];
      if (cur) {
        if (k === 'fill' && cur.type !== 'line' && cur.type !== 'pen') cur.fill = style.fill;
        else if (k === 'stroke') cur.stroke = style.stroke;
        else if (k === 'width') cur.width = style.width;
        else if (k === 'opacity') cur.opacity = style.opacity;
        dirty = true;
      }
      draw();
    });

    draw();
    return win;
  }

  // ==================================================================
  // Orion Photo - raster editor
  // ==================================================================
  function launchPhoto(args) {
    var win = WM.create({
      appId: 'photo', title: 'Orion Photo', icon: 'photo',
      width: 1040, height: 700, minWidth: 620, minHeight: 420
    });

    var W = 900, H = 560;
    var tool = 'brush';
    var color = '#4f46e5';
    var size = 8;
    var undo = [], redo = [];
    var drawing = null;
    var adj = { brightness: 100, contrast: 100, saturate: 100, blur: 0, grayscale: 0, sepia: 0, invert: 0 };

    var TOOLS = [
      ['brush', 'Brush', 'brush'], ['eraser', 'Eraser', 'eraser'], ['line', 'Line', 'shapeline'],
      ['rect', 'Rectangle', 'shaperect'], ['ellipse', 'Ellipse', 'shapeellipse'],
      ['fill', 'Fill', 'bucket'], ['pick', 'Pick colour', 'dropper'], ['text', 'Text', 'text']
    ];

    win.body.innerHTML =
      '<div class="of ph2">' +
        '<div class="of-bar">' +
          '<button class="btn" data-file="new">New</button>' +
          '<button class="btn" data-file="open">Open</button>' +
          '<button class="btn" data-file="import">Import file</button>' +
          '<button class="btn primary" data-file="save">Save to Pictures</button>' +
          '<span class="of-sep"></span>' +
          '<button class="e-btn" data-act="undo" title="Undo">' + Icons.get('undo') + '</button>' +
          '<button class="e-btn" data-act="redo" title="Redo">' + Icons.get('redo') + '</button>' +
          '<span class="of-sep"></span>' +
          TOOLS.map(function (t) {
            return '<button class="e-btn' + (t[0] === 'brush' ? ' on' : '') + '" data-tool="' + t[0] +
              '" title="' + t[1] + '">' + Icons.get(t[2]) + '</button>';
          }).join('') +
          '<input type="color" class="of-color" data-color value="#4f46e5" title="Colour">' +
          '<label class="dr-lab">Size<input type="range" min="1" max="80" value="8" data-size></label>' +
        '</div>' +
        '<div class="dr-body">' +
          '<div class="dr-stage"><canvas class="ph-canvas" width="' + W + '" height="' + H + '"></canvas></div>' +
          '<div class="dr-side">' +
            '<div class="nt-head">Adjustments</div>' +
            '<div class="ph-adj">' +
              [['brightness', 0, 200, 100], ['contrast', 0, 200, 100], ['saturate', 0, 200, 100],
               ['blur', 0, 12, 0], ['grayscale', 0, 100, 0], ['sepia', 0, 100, 0], ['invert', 0, 100, 0]]
                .map(function (a) {
                  return '<label class="ph-slider"><span>' + a[0] + '</span>' +
                    '<input type="range" min="' + a[1] + '" max="' + a[2] + '" value="' + a[3] +
                    '" data-adj="' + a[0] + '"><b data-v="' + a[0] + '">' + a[3] + '</b></label>';
                }).join('') +
            '</div>' +
            '<div class="dr-ops">' +
              '<button class="btn primary" data-act="apply">Apply adjustments</button>' +
              '<button class="btn" data-act="resetadj">Reset</button>' +
              '<button class="btn" data-act="fliph">Flip across</button>' +
              '<button class="btn" data-act="flipv">Flip down</button>' +
              '<button class="btn" data-act="rot">Rotate 90°</button>' +
              '<button class="btn danger" data-act="clear">Clear canvas</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="ex-status"><span data-hint>Brush selected</span>' +
          '<span style="margin-left:auto" data-where>Unsaved image</span></div>' +
      '</div>';

    var cv = U.$('.ph-canvas', win.body);
    var ctx = cv.getContext('2d', { willReadFrequently: true });
    var hint = U.$('[data-hint]', win.body);
    var where = U.$('[data-where]', win.body);

    function filterString() {
      return 'brightness(' + adj.brightness + '%) contrast(' + adj.contrast + '%) saturate(' + adj.saturate +
        '%) blur(' + adj.blur + 'px) grayscale(' + adj.grayscale + '%) sepia(' + adj.sepia +
        '%) invert(' + adj.invert + '%)';
    }
    function showFilter() { cv.style.filter = filterString(); }

    function snapshot() {
      try { undo.push(cv.toDataURL('image/png')); } catch (e) { return; }
      if (undo.length > 24) undo.shift();
      redo.length = 0;
    }

    function restore(url, done) {
      var img = new Image();
      img.onload = function () {
        ctx.clearRect(0, 0, W, H);
        ctx.drawImage(img, 0, 0);
        if (done) done();
      };
      img.src = url;
    }

    function blank() {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, W, H);
    }

    function pt(e) {
      var r = cv.getBoundingClientRect();
      return [Math.round((e.clientX - r.left) * W / r.width), Math.round((e.clientY - r.top) * H / r.height)];
    }

    function hex(r, g, b) {
      return '#' + [r, g, b].map(function (n) { return ('0' + n.toString(16)).slice(-2); }).join('');
    }

    /** Scanline-free flood fill; fine at this canvas size. */
    function floodFill(x, y, rgb) {
      var img = ctx.getImageData(0, 0, W, H), d = img.data;
      var i0 = (y * W + x) * 4;
      var target = [d[i0], d[i0 + 1], d[i0 + 2], d[i0 + 3]];
      if (target[0] === rgb[0] && target[1] === rgb[1] && target[2] === rgb[2] && target[3] === 255) return;
      var stack = [[x, y]];
      while (stack.length) {
        var p = stack.pop(), px = p[0], py = p[1];
        if (px < 0 || py < 0 || px >= W || py >= H) continue;
        var i = (py * W + px) * 4;
        if (d[i] !== target[0] || d[i + 1] !== target[1] || d[i + 2] !== target[2] || d[i + 3] !== target[3]) continue;
        d[i] = rgb[0]; d[i + 1] = rgb[1]; d[i + 2] = rgb[2]; d[i + 3] = 255;
        stack.push([px + 1, py], [px - 1, py], [px, py + 1], [px, py - 1]);
      }
      ctx.putImageData(img, 0, 0);
    }

    function rgbOf(h) {
      var n = parseInt(h.slice(1), 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }

    cv.addEventListener('pointerdown', function (e) {
      var p = pt(e);
      cv.setPointerCapture(e.pointerId);

      if (tool === 'pick') {
        var d = ctx.getImageData(p[0], p[1], 1, 1).data;
        color = hex(d[0], d[1], d[2]);
        U.$('[data-color]', win.body).value = color;
        hint.textContent = 'Picked ' + color;
        return;
      }
      if (tool === 'fill') { snapshot(); floodFill(p[0], p[1], rgbOf(color)); return; }
      if (tool === 'text') {
        WM.prompt('Orion Photo', 'Text to draw', 'Hello', win).then(function (t) {
          if (!t) return;
          snapshot();
          ctx.fillStyle = color;
          ctx.font = (size * 3) + 'px "Segoe UI", system-ui, sans-serif';
          ctx.fillText(t, p[0], p[1]);
        });
        return;
      }

      snapshot();
      drawing = { from: p, last: p, base: null };
      if (tool === 'line' || tool === 'rect' || tool === 'ellipse') {
        try { drawing.base = ctx.getImageData(0, 0, W, H); } catch (err) { drawing.base = null; }
      } else {
        ctx.beginPath();
        ctx.moveTo(p[0], p[1]);
      }
    });

    cv.addEventListener('pointermove', function (e) {
      if (!drawing) return;
      var p = pt(e);

      if (tool === 'brush' || tool === 'eraser') {
        ctx.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over';
        ctx.strokeStyle = color;
        ctx.lineWidth = size;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(drawing.last[0], drawing.last[1]);
        ctx.lineTo(p[0], p[1]);
        ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
        drawing.last = p;
        return;
      }

      if (drawing.base) ctx.putImageData(drawing.base, 0, 0);
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = Math.max(1, size / 2);
      var a = drawing.from;
      if (tool === 'line') {
        ctx.beginPath(); ctx.lineCap = 'round';
        ctx.moveTo(a[0], a[1]); ctx.lineTo(p[0], p[1]); ctx.stroke();
      } else if (tool === 'rect') {
        ctx.strokeRect(Math.min(a[0], p[0]), Math.min(a[1], p[1]), Math.abs(p[0] - a[0]), Math.abs(p[1] - a[1]));
      } else if (tool === 'ellipse') {
        ctx.beginPath();
        ctx.ellipse((a[0] + p[0]) / 2, (a[1] + p[1]) / 2, Math.abs(p[0] - a[0]) / 2, Math.abs(p[1] - a[1]) / 2, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    });

    cv.addEventListener('pointerup', function () { drawing = null; });

    win.body.addEventListener('click', function (e) {
      var t = e.target.closest('[data-tool]');
      if (t) {
        tool = t.dataset.tool;
        U.$$('[data-tool]', win.body).forEach(function (b) { b.classList.toggle('on', b.dataset.tool === tool); });
        hint.textContent = t.title + ' selected';
        return;
      }

      var a = e.target.closest('[data-act]');
      if (a) {
        var k = a.dataset.act;
        if (k === 'undo') {
          if (!undo.length) return;
          try { redo.push(cv.toDataURL('image/png')); } catch (err) {}
          restore(undo.pop());
        } else if (k === 'redo') {
          if (!redo.length) return;
          try { undo.push(cv.toDataURL('image/png')); } catch (err) {}
          restore(redo.pop());
        } else if (k === 'apply') {
          // Bake the CSS preview into the pixels, then drop the preview.
          snapshot();
          var url = cv.toDataURL('image/png');
          var img = new Image();
          img.onload = function () {
            ctx.save();
            ctx.filter = filterString();
            ctx.clearRect(0, 0, W, H);
            ctx.drawImage(img, 0, 0);
            ctx.restore();
            resetAdj();
            Emu.notify('Orion Photo', 'Adjustments applied to the image.', 'photo');
          };
          img.src = url;
        } else if (k === 'resetadj') {
          resetAdj();
        } else if (k === 'fliph' || k === 'flipv' || k === 'rot') {
          snapshot();
          var src = cv.toDataURL('image/png');
          var im = new Image();
          im.onload = function () {
            ctx.save();
            ctx.clearRect(0, 0, W, H);
            if (k === 'fliph') { ctx.translate(W, 0); ctx.scale(-1, 1); }
            else if (k === 'flipv') { ctx.translate(0, H); ctx.scale(1, -1); }
            else { ctx.translate(W / 2, H / 2); ctx.rotate(Math.PI / 2); ctx.translate(-H / 2, -W / 2); }
            ctx.drawImage(im, 0, 0);
            ctx.restore();
          };
          im.src = src;
        } else if (k === 'clear') {
          WM.confirm('Orion Photo', 'Clear the whole canvas?', win).then(function (ok) {
            if (!ok) return;
            snapshot(); blank();
          });
        }
        return;
      }

      var f = e.target.closest('[data-file]');
      if (!f) return;
      var kind = f.dataset.file;

      if (kind === 'new') {
        WM.confirm('Orion Photo', 'Start a blank image?', win).then(function (ok) {
          if (!ok) return;
          snapshot(); blank(); resetAdj();
          where.textContent = 'Unsaved image';
        });
      } else if (kind === 'save') {
        var name = VFS.uniqueName(ensure(PICS), 'Image', '.png');
        WM.prompt('Orion Photo', 'Save to Pictures as', name, win).then(function (n) {
          if (!n) return;
          if (!/\.png$/i.test(n)) n += '.png';
          var p = PICS + '\\' + n;
          VFS.write(p, cv.toDataURL('image/png'), 'png');
          where.textContent = p;
          Emu.notify('Orion Photo', n + ' saved to Pictures.', 'photo');
        });
      } else if (kind === 'open') {
        var pics = VFS.list(ensure(PICS)).filter(function (x) {
          return x.node.type === 'file' && /^(data:image|https?:|assets\/)/.test(x.node.content || '');
        });
        if (!pics.length) { WM.alert('Orion Photo', 'No images in Pictures yet.', win); return; }
        WM.prompt('Orion Photo', 'Open which image?\n' + pics.map(function (x) { return '· ' + x.name; }).join('\n'),
          pics[0].name, win).then(function (n) {
          if (!n) return;
          var hit = pics.filter(function (x) { return x.name.toLowerCase() === String(n).toLowerCase(); })[0];
          if (!hit) { WM.alert('Orion Photo', 'No image called "' + n + '".', win); return; }
          loadImage(hit.node.content, hit.path);
        });
      } else if (kind === 'import') {
        U.pickImage(1200).then(function (url) {
          if (!url) return;
          loadImage(url, null);
        });
      }
    });

    function loadImage(src, p) {
      var img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = function () {
        snapshot();
        blank();
        var scale = Math.min(W / img.width, H / img.height, 1);
        var w = img.width * scale, h = img.height * scale;
        ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
        where.textContent = p || 'Imported image';
      };
      img.onerror = function () { WM.alert('Orion Photo', 'That image could not be loaded.', win); };
      img.src = src;
    }

    function resetAdj() {
      adj = { brightness: 100, contrast: 100, saturate: 100, blur: 0, grayscale: 0, sepia: 0, invert: 0 };
      U.$$('[data-adj]', win.body).forEach(function (s) {
        s.value = adj[s.dataset.adj];
        U.$('[data-v="' + s.dataset.adj + '"]', win.body).textContent = adj[s.dataset.adj];
      });
      showFilter();
    }

    win.body.addEventListener('input', function (e) {
      if (e.target.matches('[data-color]')) { color = e.target.value; return; }
      if (e.target.matches('[data-size]')) { size = parseInt(e.target.value, 10); hint.textContent = 'Size ' + size; return; }
      var s = e.target.closest('[data-adj]');
      if (!s) return;
      adj[s.dataset.adj] = parseInt(s.value, 10);
      U.$('[data-v="' + s.dataset.adj + '"]', win.body).textContent = s.value;
      showFilter();
    });

    blank();
    if (args && args.path) {
      var node = VFS.get(args.path);
      if (node && node.content) loadImage(node.content, args.path);
    }
    return win;
  }

  Emu.registerApp({
    id: 'draw', name: 'Orion Draw', icon: 'draw', desc: 'Vector illustration',
    suite: 'creative', launch: launchDraw
  });
  Emu.registerApp({
    id: 'photo', name: 'Orion Photo', icon: 'photo', desc: 'Edit and paint images',
    suite: 'creative', launch: launchPhoto
  });
})(window);
