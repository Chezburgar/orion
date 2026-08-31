/* ===== Orion Office: Write, Sheets, Slides, Notes =====
   Orion's own productivity apps. They are not clones of anyone's software and
   carry no one else's branding - they do the same jobs with Orion's own code.
   Everything is saved into the Orion filesystem, so documents survive a
   reload and show up in File Explorer like any other file.                 */
(function (global) {
  'use strict';

  var Emu = global.Emu, U = Emu.util, Icons = global.Icons, WM = global.WM, VFS = global.VFS;

  var DOCS = VFS.HOME + '\\Documents';

  function docsDir() {
    if (!VFS.exists(DOCS)) VFS.mkdir(DOCS);
    return DOCS;
  }

  /**
   * Shared "save as" flow: ask for a name, add the extension if the user
   * left it off, and write it into Documents.
   */
  function saveAs(win, appName, ext, suggestion, content) {
    return WM.prompt(appName, 'Save as', suggestion || ('Untitled' + ext), win).then(function (name) {
      if (!name) return null;
      name = String(name).trim();
      if (!name) return null;
      if (name.slice(-ext.length).toLowerCase() !== ext) name += ext;
      var path = docsDir() + '\\' + name;
      VFS.write(path, content, ext.slice(1));
      Emu.pushRecent({ name: name, path: path, app: null });
      return path;
    });
  }

  /** A file picker over the documents folder, limited to one extension. */
  function openFrom(win, appName, ext) {
    var list = VFS.list(docsDir()).filter(function (e) {
      return e.node.type === 'file' && e.path.slice(-ext.length).toLowerCase() === ext;
    });
    if (!list.length) {
      WM.alert(appName, 'There are no ' + ext + ' files in Documents yet.', win);
      return Promise.resolve(null);
    }
    return new Promise(function (resolve) {
      var back = U.el('<div class="dlg-backdrop"><div class="dlg">' +
        '<h3>Open</h3><div class="dlg-body"><div class="of-picker">' +
        list.map(function (e) {
          return '<button class="of-pick" data-p="' + U.esc(e.path) + '">' +
            Icons.get('filetext') + '<span>' + U.esc(e.name) + '</span>' +
            '<small>' + new Date(e.node.modified || Date.now()).toLocaleDateString() + '</small></button>';
        }).join('') +
        '</div></div><div class="dlg-actions"><button data-x>Cancel</button></div></div></div>');
      win.el.appendChild(back);
      back.addEventListener('click', function (ev) {
        if (ev.target.closest('[data-x]')) { back.remove(); resolve(null); return; }
        var p = ev.target.closest('[data-p]');
        if (p) { back.remove(); resolve(p.dataset.p); }
      });
    });
  }

  // ==================================================================
  // Orion Write - word processor
  // ==================================================================
  function launchWrite(args) {
    var win = WM.create({
      appId: 'write', title: 'Orion Write', icon: 'write',
      width: 940, height: 660, minWidth: 520, minHeight: 380
    });

    var path = (args && args.path) || null;
    var dirty = false;

    var TOOLS = [
      ['undo', 'Undo', 'undo'], ['redo', 'Redo', 'redo'], ['|'],
      ['bold', 'Bold', 'bold'], ['italic', 'Italic', 'italic'], ['underline', 'Underline', 'underline'],
      ['strikeThrough', 'Strikethrough', 'strike'], ['|'],
      ['insertUnorderedList', 'Bulleted list', 'list'], ['insertOrderedList', 'Numbered list', 'numlist'], ['|'],
      ['justifyLeft', 'Align left', 'alignleft'], ['justifyCenter', 'Centre', 'aligncenter'],
      ['justifyRight', 'Align right', 'alignright'], ['|'],
      ['removeFormat', 'Clear formatting', 'clearfmt']
    ];

    win.body.innerHTML =
      '<div class="of wr">' +
        '<div class="of-bar">' +
          '<button class="btn" data-file="new">New</button>' +
          '<button class="btn" data-file="open">Open</button>' +
          '<button class="btn primary" data-file="save">Save</button>' +
          '<span class="of-sep"></span>' +
          '<select class="of-sel" data-block>' +
            '<option value="p">Body text</option><option value="h1">Title</option>' +
            '<option value="h2">Heading</option><option value="h3">Subheading</option>' +
            '<option value="blockquote">Quote</option><option value="pre">Code</option>' +
          '</select>' +
          '<select class="of-sel" data-font>' +
            '<option value="">Default</option><option value="Georgia, serif">Georgia</option>' +
            '<option value="&quot;Times New Roman&quot;, serif">Times</option>' +
            '<option value="Arial, sans-serif">Arial</option>' +
            '<option value="&quot;Courier New&quot;, monospace">Courier</option>' +
          '</select>' +
          '<select class="of-sel narrow" data-size>' +
            '<option value="2">10</option><option value="3" selected>12</option>' +
            '<option value="4">14</option><option value="5">18</option>' +
            '<option value="6">24</option><option value="7">36</option>' +
          '</select>' +
          '<input type="color" class="of-color" data-color value="#e6e8ee" title="Text colour">' +
          '<span class="of-sep"></span>' +
          TOOLS.map(function (t) {
            if (t[0] === '|') return '<span class="of-sep"></span>';
            return '<button class="e-btn" data-cmd="' + t[0] + '" title="' + t[1] + '">' + Icons.get(t[2]) + '</button>';
          }).join('') +
        '</div>' +
        '<div class="of-page-wrap"><div class="of-page" contenteditable="true" spellcheck="true"></div></div>' +
        '<div class="ex-status"><span data-words>0 words</span>' +
          '<span style="margin-left:auto" data-where>Not saved yet</span></div>' +
      '</div>';

    var page = U.$('.of-page', win.body);
    var words = U.$('[data-words]', win.body);
    var where = U.$('[data-where]', win.body);

    function setTitle() {
      var n = path ? VFS.nameOf(path) : 'Untitled';
      win.setTitle(n + (dirty ? ' *' : '') + ' - Orion Write');
      where.textContent = path ? path : 'Not saved yet';
    }

    function countWords() {
      var t = (page.innerText || '').trim();
      var n = t ? t.split(/\s+/).length : 0;
      words.textContent = n + ' word' + (n === 1 ? '' : 's') + ' · ' + (page.innerText || '').length + ' characters';
    }

    function load(p) {
      var c = VFS.read(p);
      if (c == null) { WM.alert('Orion Write', 'That file could not be read.', win); return; }
      page.innerHTML = c;
      path = p;
      dirty = false;
      setTitle();
      countWords();
    }

    function save() {
      if (path) {
        VFS.write(path, page.innerHTML, 'odoc');
        dirty = false;
        setTitle();
        Emu.notify('Orion Write', VFS.nameOf(path) + ' saved.', 'write');
        return Promise.resolve(path);
      }
      return saveAs(win, 'Orion Write', '.odoc',
        (page.innerText || 'Untitled').trim().split('\n')[0].slice(0, 40) || 'Untitled', page.innerHTML)
        .then(function (p) {
          if (!p) return null;
          path = p; dirty = false; setTitle();
          Emu.notify('Orion Write', VFS.nameOf(p) + ' saved to Documents.', 'write');
          return p;
        });
    }

    win.body.addEventListener('click', function (e) {
      var f = e.target.closest('[data-file]');
      if (f) {
        var k = f.dataset.file;
        if (k === 'save') return save();
        if (k === 'open') return openFrom(win, 'Orion Write', '.odoc').then(function (p) { if (p) load(p); });
        if (k === 'new') {
          return WM.confirm('Orion Write', dirty ? 'Start a new document? Unsaved changes are lost.' : 'Start a new document?', win)
            .then(function (ok) {
              if (!ok) return;
              page.innerHTML = '';
              path = null; dirty = false;
              setTitle(); countWords();
            });
        }
        return;
      }
      var c = e.target.closest('[data-cmd]');
      if (c) {
        page.focus();
        document.execCommand(c.dataset.cmd, false, null);
        dirty = true; setTitle(); countWords();
      }
    });

    win.body.addEventListener('change', function (e) {
      page.focus();
      if (e.target.matches('[data-block]')) document.execCommand('formatBlock', false, e.target.value);
      else if (e.target.matches('[data-font]')) document.execCommand('fontName', false, e.target.value);
      else if (e.target.matches('[data-size]')) document.execCommand('fontSize', false, e.target.value);
      else if (e.target.matches('[data-color]')) document.execCommand('foreColor', false, e.target.value);
      dirty = true; setTitle();
    });

    page.addEventListener('input', function () { dirty = true; setTitle(); countWords(); });

    page.addEventListener('keydown', function (e) {
      if (!(e.ctrlKey || e.metaKey)) return;
      var k = e.key.toLowerCase();
      if (k === 's') { e.preventDefault(); save(); }
      else if (k === 'b' || k === 'i' || k === 'u') { dirty = true; setTitle(); }
    });

    if (path) load(path); else { setTitle(); countWords(); }
    return win;
  }

  // ==================================================================
  // Orion Sheets - spreadsheet with a real formula engine
  // ==================================================================
  var COLS = 26, ROWS = 60;

  function colName(i) { return String.fromCharCode(65 + i); }

  /** A1 -> {c,r}, or null. */
  function refToRC(ref) {
    var m = /^([A-Z]+)(\d+)$/.exec(String(ref).toUpperCase());
    if (!m) return null;
    var c = 0;
    for (var i = 0; i < m[1].length; i++) c = c * 26 + (m[1].charCodeAt(i) - 64);
    return { c: c - 1, r: parseInt(m[2], 10) - 1 };
  }

  /**
   * Evaluate one formula. Cell values come from getRaw(); anything that
   * refers back to itself resolves to a #CYCLE error rather than hanging.
   */
  function makeEngine(getRaw) {
    var visiting = {};

    function valueOf(key) {
      var raw = getRaw(key);
      if (raw == null || raw === '') return 0;
      if (typeof raw === 'string' && raw.charAt(0) === '=') {
        if (visiting[key]) throw new Error('#CYCLE');
        visiting[key] = true;
        try { return evalFormula(raw.slice(1)); }
        finally { delete visiting[key]; }
      }
      var n = parseFloat(raw);
      return isNaN(n) ? raw : n;
    }

    function rangeValues(a, b) {
      var A = refToRC(a), B = refToRC(b), out = [];
      if (!A || !B) throw new Error('#REF');
      for (var r = Math.min(A.r, B.r); r <= Math.max(A.r, B.r); r++) {
        for (var c = Math.min(A.c, B.c); c <= Math.max(A.c, B.c); c++) {
          out.push(valueOf(colName(c) + (r + 1)));
        }
      }
      return out;
    }

    var FN = {
      SUM: function (a) { return a.reduce(function (s, v) { return s + (typeof v === 'number' ? v : 0); }, 0); },
      AVERAGE: function (a) {
        var n = a.filter(function (v) { return typeof v === 'number'; });
        return n.length ? FN.SUM(n) / n.length : 0;
      },
      MIN: function (a) { return Math.min.apply(null, a.filter(isNum).concat([Infinity])); },
      MAX: function (a) { return Math.max.apply(null, a.filter(isNum).concat([-Infinity])); },
      COUNT: function (a) { return a.filter(isNum).length; },
      ROUND: function (a) { return Math.round(a[0] * Math.pow(10, a[1] || 0)) / Math.pow(10, a[1] || 0); },
      ABS: function (a) { return Math.abs(a[0]); },
      SQRT: function (a) { return Math.sqrt(a[0]); },
      POWER: function (a) { return Math.pow(a[0], a[1]); },
      IF: function (a) { return a[0] ? a[1] : a[2]; },
      CONCAT: function (a) { return a.join(''); },
      LEN: function (a) { return String(a[0]).length; },
      UPPER: function (a) { return String(a[0]).toUpperCase(); },
      LOWER: function (a) { return String(a[0]).toLowerCase(); },
      TODAY: function () { return new Date().toLocaleDateString(); },
      PI: function () { return Math.PI; }
    };
    function isNum(v) { return typeof v === 'number' && !isNaN(v); }

    // --- tiny recursive-descent parser -----------------------------
    function evalFormula(src) {
      var s = String(src), i = 0;

      function ws() { while (i < s.length && s[i] === ' ') i++; }
      function peek() { ws(); return s[i]; }
      function eat(ch) { ws(); if (s[i] === ch) { i++; return true; } return false; }

      function parseExpr() {
        var left = parseCmp();
        return left;
      }
      function parseCmp() {
        var l = parseAdd();
        ws();
        var two = s.substr(i, 2);
        if (two === '<=' || two === '>=' || two === '<>') {
          i += 2;
          var r2 = parseAdd();
          return two === '<=' ? l <= r2 : two === '>=' ? l >= r2 : l != r2;
        }
        var op = s[i];
        if (op === '<' || op === '>' || op === '=') {
          i++;
          var r = parseAdd();
          return op === '<' ? l < r : op === '>' ? l > r : l == r;
        }
        return l;
      }
      function parseAdd() {
        var l = parseMul();
        for (;;) {
          ws();
          var op = s[i];
          if (op === '+' || op === '-') { i++; var r = parseMul(); l = op === '+' ? add(l, r) : l - r; }
          else if (op === '&') { i++; l = String(l) + String(parseMul()); }
          else return l;
        }
      }
      function add(a, b) {
        if (typeof a === 'string' || typeof b === 'string') return String(a) + String(b);
        return a + b;
      }
      function parseMul() {
        var l = parsePow();
        for (;;) {
          ws();
          var op = s[i];
          if (op === '*') { i++; l = l * parsePow(); }
          else if (op === '/') { i++; var d = parsePow(); if (d === 0) throw new Error('#DIV/0'); l = l / d; }
          else return l;
        }
      }
      function parsePow() {
        var l = parseUnary();
        ws();
        if (s[i] === '^') { i++; return Math.pow(l, parsePow()); }
        return l;
      }
      function parseUnary() {
        ws();
        if (s[i] === '-') { i++; return -parseUnary(); }
        if (s[i] === '+') { i++; return parseUnary(); }
        return parseAtom();
      }
      function parseAtom() {
        ws();
        if (eat('(')) { var v = parseExpr(); eat(')'); return v; }
        if (s[i] === '"') {
          i++;
          var out = '';
          while (i < s.length && s[i] !== '"') out += s[i++];
          i++;
          return out;
        }
        var num = /^\d+(\.\d+)?/.exec(s.slice(i));
        if (num) { i += num[0].length; return parseFloat(num[0]); }

        var word = /^[A-Za-z_][A-Za-z0-9_.]*/.exec(s.slice(i));
        if (word) {
          var name = word[0];
          i += name.length;
          ws();
          if (s[i] === '(') {
            i++;
            var argv = [];
            if (peek() !== ')') {
              do { argv.push(parseArg()); } while (eat(','));
            }
            eat(')');
            var fn = FN[name.toUpperCase()];
            if (!fn) throw new Error('#NAME');
            var flat = [];
            argv.forEach(function (a) { Array.isArray(a) ? flat.push.apply(flat, a) : flat.push(a); });
            return fn(flat);
          }
          // a bare word is a cell reference, possibly the start of a range
          ws();
          if (s[i] === ':') {
            i++;
            var w2 = /^[A-Za-z]+\d+/.exec(s.slice(i));
            if (!w2) throw new Error('#REF');
            i += w2[0].length;
            return rangeValues(name, w2[0]);
          }
          if (/^[A-Za-z]+\d+$/.test(name)) return valueOf(name.toUpperCase());
          if (name.toUpperCase() === 'TRUE') return true;
          if (name.toUpperCase() === 'FALSE') return false;
          throw new Error('#NAME');
        }
        throw new Error('#ERROR');
      }
      function parseArg() {
        // an argument may be a whole range, which parseAtom returns as an array
        return parseExpr();
      }

      var out = parseExpr();
      return out;
    }

    return {
      eval: function (key) {
        try { return valueOf(key); }
        catch (e) { return e.message.charAt(0) === '#' ? e.message : '#ERROR'; }
      }
    };
  }

  function launchSheets(args) {
    var win = WM.create({
      appId: 'sheets', title: 'Orion Sheets', icon: 'sheets',
      width: 1000, height: 640, minWidth: 560, minHeight: 380
    });

    var path = (args && args.path) || null;
    var cells = {};              // "A1" -> raw string
    var sel = 'A1';
    var dirty = false;

    var engine = makeEngine(function (k) { return cells[k]; });

    win.body.innerHTML =
      '<div class="of sh">' +
        '<div class="of-bar">' +
          '<button class="btn" data-file="new">New</button>' +
          '<button class="btn" data-file="open">Open</button>' +
          '<button class="btn primary" data-file="save">Save</button>' +
          '<span class="of-sep"></span>' +
          '<span class="sh-ref" data-ref>A1</span>' +
          '<input class="sh-input" data-fx placeholder="Value, or =SUM(A1:A9)" spellcheck="false">' +
        '</div>' +
        '<div class="sh-scroll"><table class="sh-grid"><thead></thead><tbody></tbody></table></div>' +
        '<div class="ex-status"><span data-sum></span>' +
          '<span style="margin-left:auto" data-where>Not saved yet</span></div>' +
      '</div>';

    var thead = U.$('thead', win.body);
    var tbody = U.$('tbody', win.body);
    var fx = U.$('[data-fx]', win.body);
    var refBox = U.$('[data-ref]', win.body);
    var sumBox = U.$('[data-sum]', win.body);
    var where = U.$('[data-where]', win.body);

    function setTitle() {
      win.setTitle((path ? VFS.nameOf(path) : 'Untitled') + (dirty ? ' *' : '') + ' - Orion Sheets');
      where.textContent = path || 'Not saved yet';
    }

    function buildGrid() {
      var h = '<tr><th class="sh-corner"></th>';
      for (var c = 0; c < COLS; c++) h += '<th data-col="' + c + '">' + colName(c) + '</th>';
      thead.innerHTML = h + '</tr>';

      var b = '';
      for (var r = 0; r < ROWS; r++) {
        b += '<tr><th data-row="' + r + '">' + (r + 1) + '</th>';
        for (var c2 = 0; c2 < COLS; c2++) {
          b += '<td data-k="' + colName(c2) + (r + 1) + '"></td>';
        }
        b += '</tr>';
      }
      tbody.innerHTML = b;
    }

    /** Recompute every displayed cell. Cheap enough at this grid size. */
    function paint() {
      U.$$('td[data-k]', tbody).forEach(function (td) {
        var k = td.dataset.k, raw = cells[k];
        td.classList.toggle('selected', k === sel);
        if (raw == null || raw === '') { td.textContent = ''; td.className = td.className.replace(/ ?sh-(num|err)/g, ''); return; }
        var v = String(raw).charAt(0) === '=' ? engine.eval(k) : raw;
        var err = typeof v === 'string' && v.charAt(0) === '#';
        var num = typeof v === 'number';
        td.textContent = num ? (Math.round(v * 1e10) / 1e10) : String(v);
        td.classList.toggle('sh-num', num);
        td.classList.toggle('sh-err', err);
      });
      var v = cells[sel];
      refBox.textContent = sel;
      if (document.activeElement !== fx) fx.value = v == null ? '' : v;
      var shown = cells[sel] != null && String(cells[sel]).charAt(0) === '=' ? engine.eval(sel) : cells[sel];
      sumBox.textContent = sel + (shown === undefined || shown === '' ? ' is empty' : ' = ' + shown);
    }

    function select(k) { sel = k; paint(); }

    function commit(k, raw) {
      if (raw === '') delete cells[k]; else cells[k] = raw;
      dirty = true;
      setTitle();
      paint();
    }

    function save() {
      var payload = JSON.stringify({ v: 1, cells: cells });
      if (path) {
        VFS.write(path, payload, 'osheet');
        dirty = false; setTitle();
        Emu.notify('Orion Sheets', VFS.nameOf(path) + ' saved.', 'sheets');
        return Promise.resolve(path);
      }
      return saveAs(win, 'Orion Sheets', '.osheet', 'Untitled.osheet', payload).then(function (p) {
        if (!p) return null;
        path = p; dirty = false; setTitle();
        Emu.notify('Orion Sheets', VFS.nameOf(p) + ' saved to Documents.', 'sheets');
        return p;
      });
    }

    function load(p) {
      try {
        var d = JSON.parse(VFS.read(p) || '{}');
        cells = d.cells || {};
        path = p; dirty = false; sel = 'A1';
        setTitle(); paint();
      } catch (e) {
        WM.alert('Orion Sheets', 'That file is not a readable sheet.', win);
      }
    }

    tbody.addEventListener('click', function (e) {
      var td = e.target.closest('td[data-k]');
      if (td) { select(td.dataset.k); fx.focus(); fx.select(); }
    });

    tbody.addEventListener('dblclick', function (e) {
      var td = e.target.closest('td[data-k]');
      if (td) { select(td.dataset.k); fx.focus(); }
    });

    fx.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        commit(sel, fx.value);
        var rc = refToRC(sel);
        if (rc && rc.r < ROWS - 1) select(colName(rc.c) + (rc.r + 2));
        fx.select();
        e.preventDefault();
      } else if (e.key === 'Escape') {
        paint();
      } else if (e.key === 'Tab') {
        commit(sel, fx.value);
        var t = refToRC(sel);
        if (t && t.c < COLS - 1) select(colName(t.c + 1) + (t.r + 1));
        fx.select();
        e.preventDefault();
      }
    });

    fx.addEventListener('blur', function () { commit(sel, fx.value); });

    win.body.addEventListener('click', function (e) {
      var f = e.target.closest('[data-file]');
      if (!f) return;
      var k = f.dataset.file;
      if (k === 'save') return save();
      if (k === 'open') return openFrom(win, 'Orion Sheets', '.osheet').then(function (p) { if (p) load(p); });
      if (k === 'new') {
        WM.confirm('Orion Sheets', 'Start an empty sheet?', win).then(function (ok) {
          if (!ok) return;
          cells = {}; path = null; dirty = false; sel = 'A1';
          setTitle(); paint();
        });
      }
    });

    buildGrid();
    if (path) load(path);
    else {
      // A small worked example, so the formula engine is visible immediately.
      cells = { A1: 'Item', B1: 'Qty', C1: 'Price', D1: 'Total',
        A2: 'Keyboard', B2: '2', C2: '49.5', D2: '=B2*C2',
        A3: 'Monitor', B3: '1', C3: '189', D3: '=B3*C3',
        A4: 'Cable', B4: '3', C4: '7.25', D4: '=B4*C4',
        A6: 'Subtotal', D6: '=SUM(D2:D4)',
        A7: 'Tax 8%', D7: '=ROUND(D6*0.08,2)',
        A8: 'Due', D8: '=D6+D7' };
      setTitle(); paint();
    }
    return win;
  }

  // ==================================================================
  // Orion Slides - presentation editor with a present mode
  // ==================================================================
  var THEMES = [
    { id: 'ink', name: 'Ink', bg: '#12172a', fg: '#eef2ff', accent: '#818cf8' },
    { id: 'paper', name: 'Paper', bg: '#f7f5f0', fg: '#1e2430', accent: '#c2410c' },
    { id: 'forest', name: 'Forest', bg: '#0f2420', fg: '#e6fff6', accent: '#34d399' },
    { id: 'ember', name: 'Ember', bg: '#2a1210', fg: '#ffeee8', accent: '#fb7185' },
    { id: 'steel', name: 'Steel', bg: '#1c2029', fg: '#e8ecf3', accent: '#38bdf8' }
  ];

  function launchSlides(args) {
    var win = WM.create({
      appId: 'slides', title: 'Orion Slides', icon: 'slides',
      width: 1020, height: 680, minWidth: 560, minHeight: 400
    });

    var path = (args && args.path) || null;
    var dirty = false;
    var idx = 0;
    var deck = { theme: 'ink', slides: [{ title: 'Your deck', body: 'Click any text to edit it.\nUse New slide to add more.' }] };

    win.body.innerHTML =
      '<div class="of sl">' +
        '<div class="of-bar">' +
          '<button class="btn" data-file="new">New</button>' +
          '<button class="btn" data-file="open">Open</button>' +
          '<button class="btn primary" data-file="save">Save</button>' +
          '<span class="of-sep"></span>' +
          '<button class="btn" data-act="add">New slide</button>' +
          '<button class="btn" data-act="dup">Duplicate</button>' +
          '<button class="btn" data-act="del">Delete</button>' +
          '<span class="of-sep"></span>' +
          '<select class="of-sel" data-theme>' +
            THEMES.map(function (t) { return '<option value="' + t.id + '">' + t.name + '</option>'; }).join('') +
          '</select>' +
          '<span style="flex:1"></span>' +
          '<button class="btn primary" data-act="present">Present</button>' +
        '</div>' +
        '<div class="sl-body">' +
          '<div class="sl-rail" data-rail></div>' +
          '<div class="sl-stage"><div class="sl-slide" data-stage>' +
            '<h1 class="sl-title" contenteditable="true"></h1>' +
            '<div class="sl-text" contenteditable="true"></div>' +
          '</div></div>' +
        '</div>' +
        '<div class="ex-status"><span data-count></span>' +
          '<span style="margin-left:auto" data-where>Not saved yet</span></div>' +
      '</div>';

    var rail = U.$('[data-rail]', win.body);
    var stage = U.$('[data-stage]', win.body);
    var titleEl = U.$('.sl-title', win.body);
    var textEl = U.$('.sl-text', win.body);
    var count = U.$('[data-count]', win.body);
    var where = U.$('[data-where]', win.body);
    var themeSel = U.$('[data-theme]', win.body);

    function theme() {
      return THEMES.filter(function (t) { return t.id === deck.theme; })[0] || THEMES[0];
    }

    function applyTheme(el) {
      var t = theme();
      el.style.background = t.bg;
      el.style.color = t.fg;
      el.style.setProperty('--sl-accent', t.accent);
    }

    function setTitle() {
      win.setTitle((path ? VFS.nameOf(path) : 'Untitled') + (dirty ? ' *' : '') + ' - Orion Slides');
      where.textContent = path || 'Not saved yet';
      count.textContent = 'Slide ' + (idx + 1) + ' of ' + deck.slides.length;
    }

    function renderRail() {
      rail.innerHTML = deck.slides.map(function (s, i) {
        return '<div class="sl-thumb' + (i === idx ? ' active' : '') + '" data-i="' + i + '">' +
          '<span class="sl-num">' + (i + 1) + '</span>' +
          '<div class="sl-thumb-in"><b>' + U.esc(s.title || 'Untitled') + '</b>' +
          '<small>' + U.esc((s.body || '').split('\n')[0].slice(0, 48)) + '</small></div></div>';
      }).join('');
      U.$$('.sl-thumb-in', rail).forEach(applyTheme);
    }

    function render() {
      var s = deck.slides[idx] || { title: '', body: '' };
      titleEl.textContent = s.title || '';
      textEl.textContent = s.body || '';
      applyTheme(stage);
      themeSel.value = deck.theme;
      renderRail();
      setTitle();
    }

    function pull() {
      var s = deck.slides[idx];
      if (!s) return;
      s.title = titleEl.textContent;
      s.body = textEl.innerText;
      dirty = true;
    }

    function present() {
      var t = theme();
      var i = idx;
      var ov = U.el('<div class="sl-present"><div class="sl-present-slide">' +
        '<h1></h1><div></div></div>' +
        '<div class="sl-present-bar"><button data-p="prev">‹</button>' +
        '<span data-p="n"></span><button data-p="next">›</button>' +
        '<button data-p="exit">Exit</button></div></div>');
      var slideEl = ov.querySelector('.sl-present-slide');
      slideEl.style.background = t.bg;
      slideEl.style.color = t.fg;
      slideEl.style.setProperty('--sl-accent', t.accent);
      ov.style.background = t.bg;

      function draw() {
        var s = deck.slides[i] || {};
        slideEl.querySelector('h1').textContent = s.title || '';
        slideEl.querySelector('div').textContent = s.body || '';
        ov.querySelector('[data-p="n"]').textContent = (i + 1) + ' / ' + deck.slides.length;
      }
      function step(d) { i = Math.max(0, Math.min(deck.slides.length - 1, i + d)); draw(); }
      function key(e) {
        if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') { step(1); e.preventDefault(); }
        else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { step(-1); e.preventDefault(); }
        else if (e.key === 'Escape') close();
      }
      function close() {
        document.removeEventListener('keydown', key, true);
        ov.remove();
      }
      ov.addEventListener('click', function (e) {
        var b = e.target.closest('[data-p]');
        if (!b) return;
        if (b.dataset.p === 'next') step(1);
        else if (b.dataset.p === 'prev') step(-1);
        else if (b.dataset.p === 'exit') close();
      });
      document.addEventListener('keydown', key, true);
      win.el.appendChild(ov);
      draw();
      ov.focus();
    }

    function save() {
      pull();
      var payload = JSON.stringify(deck);
      if (path) {
        VFS.write(path, payload, 'oslides');
        dirty = false; setTitle();
        Emu.notify('Orion Slides', VFS.nameOf(path) + ' saved.', 'slides');
        return Promise.resolve(path);
      }
      return saveAs(win, 'Orion Slides', '.oslides',
        (deck.slides[0] && deck.slides[0].title || 'Untitled') + '.oslides', payload).then(function (p) {
        if (!p) return null;
        path = p; dirty = false; setTitle();
        Emu.notify('Orion Slides', VFS.nameOf(p) + ' saved to Documents.', 'slides');
        return p;
      });
    }

    function load(p) {
      try {
        var d = JSON.parse(VFS.read(p) || '{}');
        if (!d.slides || !d.slides.length) throw new Error('empty');
        deck = d; idx = 0; path = p; dirty = false;
        render();
      } catch (e) {
        WM.alert('Orion Slides', 'That file is not a readable deck.', win);
      }
    }

    win.body.addEventListener('click', function (e) {
      var th = e.target.closest('[data-i]');
      if (th) { pull(); idx = parseInt(th.dataset.i, 10); render(); return; }

      var a = e.target.closest('[data-act]');
      if (a) {
        pull();
        var k = a.dataset.act;
        if (k === 'add') { deck.slides.splice(idx + 1, 0, { title: 'New slide', body: '' }); idx++; }
        else if (k === 'dup') {
          var s = deck.slides[idx];
          deck.slides.splice(idx + 1, 0, { title: s.title, body: s.body });
          idx++;
        } else if (k === 'del') {
          if (deck.slides.length === 1) { WM.alert('Orion Slides', 'A deck needs at least one slide.', win); return; }
          deck.slides.splice(idx, 1);
          idx = Math.max(0, idx - 1);
        } else if (k === 'present') { present(); return; }
        dirty = true;
        render();
        return;
      }

      var f = e.target.closest('[data-file]');
      if (!f) return;
      if (f.dataset.file === 'save') return save();
      if (f.dataset.file === 'open') return openFrom(win, 'Orion Slides', '.oslides').then(function (p) { if (p) load(p); });
      if (f.dataset.file === 'new') {
        WM.confirm('Orion Slides', 'Start an empty deck?', win).then(function (ok) {
          if (!ok) return;
          deck = { theme: deck.theme, slides: [{ title: 'Your deck', body: '' }] };
          idx = 0; path = null; dirty = false;
          render();
        });
      }
    });

    win.body.addEventListener('change', function (e) {
      if (!e.target.matches('[data-theme]')) return;
      deck.theme = e.target.value;
      dirty = true;
      render();
    });

    [titleEl, textEl].forEach(function (el) {
      el.addEventListener('input', function () { pull(); renderRail(); setTitle(); });
    });

    if (path) load(path); else render();
    return win;
  }

  // ==================================================================
  // Orion Notes - notebook with sections and pages
  // ==================================================================
  function launchNotes() {
    var win = WM.create({
      appId: 'notes', title: 'Orion Notes', icon: 'notes',
      width: 940, height: 620, minWidth: 520, minHeight: 360
    });

    var FILE = DOCS + '\\Notebook.onotes';
    var book = { sections: [] };
    var si = 0, pi = 0;

    function loadBook() {
      try {
        var raw = VFS.read(FILE);
        if (raw) book = JSON.parse(raw);
      } catch (e) { /* fall through to the seed below */ }
      if (!book.sections || !book.sections.length) {
        book = { sections: [{ name: 'Notes', pages: [{ title: 'Welcome', body: 'Notes autosave as you type.' }] }] };
      }
    }

    function persist() {
      docsDir();
      VFS.write(FILE, JSON.stringify(book), 'onotes');
    }
    var persistSoon = U.debounce(persist, 500);

    win.body.innerHTML =
      '<div class="of nt">' +
        '<div class="nt-sections" data-sections></div>' +
        '<div class="nt-pages"><div class="nt-pagelist" data-pages></div>' +
          '<button class="btn nt-add" data-act="addpage">+ Page</button></div>' +
        '<div class="nt-main">' +
          '<input class="nt-title" data-title placeholder="Page title" spellcheck="false">' +
          '<div class="nt-body" data-body contenteditable="true" spellcheck="true"></div>' +
        '</div>' +
      '</div>';

    var secBox = U.$('[data-sections]', win.body);
    var pageBox = U.$('[data-pages]', win.body);
    var titleIn = U.$('[data-title]', win.body);
    var bodyEl = U.$('[data-body]', win.body);

    function sec() { return book.sections[si] || book.sections[0]; }
    function page() { return (sec().pages || [])[pi] || sec().pages[0]; }

    function render() {
      secBox.innerHTML = '<div class="nt-head">Sections</div>' +
        book.sections.map(function (s, i) {
          return '<div class="nt-sec' + (i === si ? ' active' : '') + '" data-s="' + i + '">' +
            U.esc(s.name) + '<small>' + (s.pages || []).length + '</small></div>';
        }).join('') +
        '<button class="btn nt-add" data-act="addsec">+ Section</button>';

      pageBox.innerHTML = (sec().pages || []).map(function (p, i) {
        return '<div class="nt-page' + (i === pi ? ' active' : '') + '" data-p="' + i + '">' +
          '<b>' + U.esc(p.title || 'Untitled') + '</b>' +
          '<small>' + U.esc(String(p.body || '').replace(/<[^>]+>/g, ' ').slice(0, 40)) + '</small></div>';
      }).join('');

      var p = page();
      titleIn.value = p ? (p.title || '') : '';
      bodyEl.innerHTML = p ? (p.body || '') : '';
      win.setTitle(sec().name + ' - Orion Notes');
    }

    win.body.addEventListener('click', function (e) {
      var s = e.target.closest('[data-s]');
      if (s) { si = parseInt(s.dataset.s, 10); pi = 0; render(); return; }
      var p = e.target.closest('[data-p]');
      if (p) { pi = parseInt(p.dataset.p, 10); render(); return; }
      var a = e.target.closest('[data-act]');
      if (!a) return;
      if (a.dataset.act === 'addsec') {
        WM.prompt('Orion Notes', 'Name the new section', 'Section', win).then(function (n) {
          if (!n) return;
          book.sections.push({ name: n, pages: [{ title: 'Untitled', body: '' }] });
          si = book.sections.length - 1; pi = 0;
          persist(); render();
        });
      } else if (a.dataset.act === 'addpage') {
        sec().pages.push({ title: 'Untitled', body: '' });
        pi = sec().pages.length - 1;
        persist(); render();
      }
    });

    titleIn.addEventListener('input', function () {
      var p = page(); if (!p) return;
      p.title = titleIn.value;
      persistSoon();
      U.$$('.nt-page.active b', pageBox).forEach(function (b) { b.textContent = p.title || 'Untitled'; });
    });

    bodyEl.addEventListener('input', function () {
      var p = page(); if (!p) return;
      p.body = bodyEl.innerHTML;
      persistSoon();
    });

    win.onClose = function () { persist(); };

    loadBook();
    render();
    return win;
  }

  // ------------------------------------------------------------- register
  Emu.registerApp({
    id: 'write', name: 'Orion Write', icon: 'write', desc: 'Write documents',
    suite: 'office', launch: launchWrite
  });
  Emu.registerApp({
    id: 'sheets', name: 'Orion Sheets', icon: 'sheets', desc: 'Numbers and formulas',
    suite: 'office', launch: launchSheets
  });
  Emu.registerApp({
    id: 'slides', name: 'Orion Slides', icon: 'slides', desc: 'Build and present decks',
    suite: 'office', launch: launchSlides
  });
  Emu.registerApp({
    id: 'notes', name: 'Orion Notes', icon: 'notes', desc: 'A notebook that autosaves',
    suite: 'office', singleton: true, launch: launchNotes
  });

  // File Explorer opens these by extension.
  global.OfficeApps = {
    forExt: function (ext) {
      return { odoc: 'write', osheet: 'sheets', oslides: 'slides', onotes: 'notes' }[ext] || null;
    }
  };
})(window);
