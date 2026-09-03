/* ===== Orion Learn =====
   A study tool, deliberately built as a narrow one.

   There is no prompt box anywhere in this app, and there never should be. The
   only things it sends are the student's own material, a subject picked from a
   list, and two numbers. Every instruction the model sees is written on the
   server, alongside the API key - see the `learn` edge function.

   The rule that does the real work: MARKING ONLY WORKS ON SHEETS ORION LEARN
   MADE. You cannot hand it an assignment to grade, because marking is a lookup
   against a stored answer key. Make a sheet, do it, submit your answers to it.

   Worksheets carry no hints, by design and by contract.                     */
(function (global) {
  'use strict';

  var Emu = global.Emu, U = Emu.util, Icons = global.Icons, WM = global.WM, VFS = global.VFS;

  var API = 'https://bgoxonxxutkporbqbtbh.supabase.co/functions/v1/learn';

  var SUBJECTS = ['Maths', 'English', 'Science', 'Biology', 'Chemistry', 'Physics',
    'History', 'Geography', 'Languages', 'Computing', 'Business', 'Other'];

  function device() {
    try { return global.Auth ? global.Auth.deviceId() : 'local'; } catch (e) { return 'local'; }
  }

  function post(route, body) {
    return fetch(API + route, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.assign({ device: device() }, body))
    }).then(function (r) {
      return r.json().then(function (d) {
        if (!r.ok && !d.refused) throw new Error(d.error || ('HTTP ' + r.status));
        return d;
      });
    });
  }

  /** Strip Orion Write's HTML so a saved document can be used as source. */
  function plain(s) {
    return String(s || '')
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/\n{3,}/g, '\n\n').trim();
  }

  function stamp(d) {
    return new Date(d).toLocaleDateString([], { day: 'numeric', month: 'short' });
  }

  // ------------------------------------------------------------ real maths
  /**
   * The model is told to write maths as ordinary characters, and mostly does,
   * but it still falls back to LaTeX when a question gets fiddly. Asking more
   * firmly does not fix that reliably, so every string it produces is put
   * through here on the way to the screen, the printer and the PDF. LaTeX in
   * means real characters out; anything that is already plain is untouched.
   */
  var GREEK = {
    alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε',
    varepsilon: 'ε', zeta: 'ζ', eta: 'η', theta: 'θ', vartheta: 'θ',
    iota: 'ι', kappa: 'κ', lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ',
    pi: 'π', rho: 'ρ', sigma: 'σ', tau: 'τ', upsilon: 'υ',
    phi: 'φ', varphi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω',
    Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Xi: 'Ξ',
    Pi: 'Π', Sigma: 'Σ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω'
  };
  var SYMS = {
    infty: '∞', pm: '±', mp: '∓', times: '×', div: '÷',
    cdot: '·', cdots: '⋯', ldots: '…', dots: '…', vdots: '⋮',
    leq: '≤', le: '≤', geq: '≥', ge: '≥', neq: '≠', ne: '≠',
    approx: '≈', equiv: '≡', cong: '≅', sim: '~', propto: '∝',
    cup: '∪', cap: '∩', in: '∈', notin: '∉', subset: '⊂',
    subseteq: '⊆', supset: '⊃', emptyset: '∅', varnothing: '∅',
    to: '→', rightarrow: '→', leftarrow: '←', leftrightarrow: '↔',
    Rightarrow: '⇒', Leftrightarrow: '⇔', mapsto: '→',
    sum: '∑', prod: '∏', int: '∫', partial: '∂', nabla: '∇',
    angle: '∠', perp: '⊥', parallel: '∥', therefore: '∴',
    forall: '∀', exists: '∃', land: '∧', lor: '∨', lnot: '¬',
    degree: '°', circ: '°', prime: '′', ast: '*', star: '*',
    mathbb: '', quad: ' ', qquad: '  ', ',': ' ', ';': ' ', '!': '',
    left: '', right: '', displaystyle: '', limits: '', big: '', Big: '', bigg: '', Bigg: ''
  };
  var SUPC = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
    '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
    '+': '⁺', '-': '⁻', '−': '⁻', '=': '⁼', '(': '⁽',
    ')': '⁾', 'n': 'ⁿ', 'x': 'ˣ' };
  var SUBC = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
    '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
    '+': '₊', '-': '₋', '−': '₋', '=': '₌', '(': '₍',
    ')': '₎', 'x': 'ₓ', 'n': 'ₙ' };
  var BLACKBOARD = { R: 'ℝ', Z: 'ℤ', N: 'ℕ', Q: 'ℚ', C: 'ℂ' };

  /** Read the balanced {...} group that starts at i, or a single token. */
  function group(s, i) {
    if (s[i] !== '{') {
      if (s[i] === '\\') {
        var m = /^\\[a-zA-Z]+/.exec(s.slice(i));
        if (m) return { body: m[0], next: i + m[0].length };
      }
      return { body: s[i] || '', next: i + 1 };
    }
    var depth = 0;
    for (var j = i; j < s.length; j++) {
      if (s[j] === '{') depth++;
      else if (s[j] === '}' && --depth === 0) return { body: s.slice(i + 1, j), next: j + 1 };
    }
    return { body: s.slice(i + 1), next: s.length };
  }

  /** Wrap in brackets only when the piece is not already a single unit. */
  function tight(s) {
    if (/^[A-Za-z0-9.α-ωΑ-Ω]+$/.test(s)) return s;
    if (/^\\[a-zA-Z]+$/.test(s)) return s;   // one symbol, not yet translated
    if (/^\(.*\)$/.test(s)) return s;
    return '(' + s + ')';
  }

  function toScript(s, map) {
    var out = '';
    for (var i = 0; i < s.length; i++) {
      if (!map[s[i]]) return null;
      out += map[s[i]];
    }
    return out;
  }

  function mathText(input) {
    var s = String(input == null ? '' : input);
    if (s.indexOf('\\') < 0 && s.indexOf('$') < 0 && s.indexOf('^') < 0 && s.indexOf('_') < 0) {
      return s;
    }

    // delimiters first - they carry no meaning once the body is plain text
    s = s.replace(/\\\[|\\\]|\\\(|\\\)/g, '').replace(/\$\$?/g, '');

    // Fractions and roots, innermost first. Each is found by regex and then
    // its arguments are read off by the brace scanner, which is the part a
    // regex cannot do on its own.
    for (var pass = 0; pass < 8; pass++) {
      var before = s;

      var mf = /\\(?:d|t)?frac\s*/.exec(s);
      if (mf) {
        var num = group(s, mf.index + mf[0].length);
        var den = group(s, num.next);
        s = s.slice(0, mf.index) + tight(num.body) + '/' + tight(den.body) + s.slice(den.next);
      }

      var mr = /\\sqrt\s*(?:\[\s*([^\]]*?)\s*\]\s*)?/.exec(s);
      if (mr) {
        var rad = group(s, mr.index + mr[0].length);
        var sign = mr[1] === '3' ? '∛' : mr[1] ? mr[1] + '√' : '√';
        s = s.slice(0, mr.index) + sign + tight(rad.body) + s.slice(rad.next);
      }

      s = s.replace(/\\(?:text|mathrm|mathbf|mathit|mathsf|operatorname|bm)\s*\{([^{}]*)\}/g, '$1');
      s = s.replace(/\\mathbb\s*\{([A-Z])\}/g, function (m, c) { return BLACKBOARD[c] || c; });
      if (s === before) break;
    }

    // named symbols, greek and function names
    s = s.replace(/\\(sin|cos|tan|sec|csc|cot|arcsin|arccos|arctan|sinh|cosh|tanh|log|ln|exp|lim|max|min|det|gcd|lcm)\b/g, '$1');
    s = s.replace(/\\([a-zA-Z]+)/g, function (m, name) {
      if (GREEK[name]) return GREEK[name];
      if (Object.prototype.hasOwnProperty.call(SYMS, name)) return SYMS[name];
      return name;
    });
    s = s.replace(/\\([,;!:> ])/g, ' ');

    // ^ and _ last, so whatever they lift is already plain characters. The
    // cursor only moves forwards: an exponent that has no real superscript
    // stays written as ^(...), and must not be picked up again.
    var out = '', c = 0;
    while (c < s.length) {
      var ch = s[c];
      if (ch !== '^' && ch !== '_') { out += ch; c++; continue; }
      var g = group(s, c + 1);
      var body = mathText(g.body).replace(/[{}]/g, '');
      var mapped = toScript(body, ch === '^' ? SUPC : SUBC);
      out += mapped != null ? mapped : ch + tight(body);
      c = g.next;
    }

    return out.replace(/[{}]/g, '')
      .replace(/[ \t]{2,}/g, ' ')
      .trim();
  }

  /** Escaped for HTML, with the maths made readable first. */
  function mesc(s) { return U.esc(mathText(s)); }

  // ------------------------------------------------- tables and diagrams
  /**
   * Everything below emits self-contained markup with inline styling, because
   * the same strings go into the app, the print iframe and the downloaded
   * file. A downloaded sheet has no stylesheet to fall back on.
   */
  function tableHtml(t, ink) {
    if (!t) return '';
    var line = ink ? '#999' : 'var(--stroke-strong)';
    var cell = 'border:1px solid ' + line + ';padding:5px 10px;min-width:44px;height:26px;' +
      'text-align:center;font-size:' + (ink ? '11pt' : '12.5px') + '';
    return '<table style="border-collapse:collapse;margin:9px 0">' +
      (t.head && t.head.length
        ? '<tr>' + t.head.map(function (h) {
            return '<th style="' + cell + ';font-weight:600;background:' +
              (ink ? '#f0f0f0' : 'var(--card-active)') + '">' + mesc(h) + '</th>';
          }).join('') + '</tr>'
        : '') +
      (t.rows || []).map(function (r) {
        return '<tr>' + r.map(function (c) {
          return '<td style="' + cell + '">' + mesc(c) + '</td>';
        }).join('') + '</tr>';
      }).join('') + '</table>';
  }

  /** Nice round gridline step for a range, so lines land on sensible numbers. */
  function step(span) {
    var raw = span / 8;
    var mag = Math.pow(10, Math.floor(Math.log10(raw || 1)));
    var n = raw / mag;
    return (n >= 5 ? 5 : n >= 2 ? 2 : 1) * mag;
  }

  /**
   * Split a point list into the runs that should be drawn as one stroke. A
   * null entry is an explicit break, and so is a point that leaves the window
   * - otherwise a curve running off the top comes back as a straight line
   * across the whole graph.
   */
  function segments(points, x0, x1, y0, y1) {
    var out = [], run = [];
    function end() { if (run.length) { out.push(run); run = []; } }
    points.forEach(function (p) {
      if (!p || p.length < 2) { end(); return; }
      if (p[0] < x0 || p[0] > x1 || p[1] < y0 || p[1] > y1) { end(); return; }
      run.push(p);
    });
    end();
    return out;
  }

  function figureSvg(f, ink) {
    if (!f) return '';
    var W = 300, H = 210, m = 26;
    var x0 = f.x[0], x1 = f.x[1], y0 = f.y[0], y1 = f.y[1];
    var px = function (x) { return m + (x - x0) / (x1 - x0) * (W - m * 2); };
    var py = function (y) { return H - m - (y - y0) / (y1 - y0) * (H - m * 2); };
    var grid = ink ? '#d8d8d8' : 'rgba(140,150,175,.28)';
    var axis = ink ? '#333' : 'rgba(190,200,225,.85)';
    var text = ink ? '#555' : 'rgba(170,180,205,.9)';
    var curve = ink ? '#1a1a1a' : '#7aa2ff';
    var s = '';

    var sx = step(x1 - x0), sy = step(y1 - y0);
    for (var gx = Math.ceil(x0 / sx) * sx; gx <= x1 + 1e-9; gx += sx) {
      s += '<line x1="' + px(gx).toFixed(1) + '" y1="' + m + '" x2="' + px(gx).toFixed(1) +
        '" y2="' + (H - m) + '" stroke="' + grid + '" stroke-width="1"/>';
    }
    for (var gy = Math.ceil(y0 / sy) * sy; gy <= y1 + 1e-9; gy += sy) {
      s += '<line x1="' + m + '" y1="' + py(gy).toFixed(1) + '" x2="' + (W - m) +
        '" y2="' + py(gy).toFixed(1) + '" stroke="' + grid + '" stroke-width="1"/>';
    }
    // the axes themselves, only where zero is actually on the chart
    if (y0 <= 0 && y1 >= 0) {
      s += '<line x1="' + m + '" y1="' + py(0).toFixed(1) + '" x2="' + (W - m) + '" y2="' +
        py(0).toFixed(1) + '" stroke="' + axis + '" stroke-width="1.6"/>';
    }
    if (x0 <= 0 && x1 >= 0) {
      s += '<line x1="' + px(0).toFixed(1) + '" y1="' + m + '" x2="' + px(0).toFixed(1) +
        '" y2="' + (H - m) + '" stroke="' + axis + '" stroke-width="1.6"/>';
    }
    s += '<rect x="' + m + '" y="' + m + '" width="' + (W - m * 2) + '" height="' + (H - m * 2) +
      '" fill="none" stroke="' + axis + '" stroke-width="1"/>';

    var lab = 'font-family="Segoe UI,system-ui,sans-serif" font-size="9" fill="' + text + '"';
    s += '<text x="' + m + '" y="' + (H - m + 13) + '" text-anchor="middle" ' + lab + '>' + x0 + '</text>' +
      '<text x="' + (W - m) + '" y="' + (H - m + 13) + '" text-anchor="middle" ' + lab + '>' + x1 + '</text>' +
      '<text x="' + (m - 5) + '" y="' + (H - m) + '" text-anchor="end" ' + lab + '>' + y0 + '</text>' +
      '<text x="' + (m - 5) + '" y="' + (m + 4) + '" text-anchor="end" ' + lab + '>' + y1 + '</text>';

    // Asymptotes, drawn under the curve so the curve stays the strongest line.
    var asym = f.asymptotes || {};
    var dash = ink ? '#777' : 'rgba(190,200,225,.55)';
    (asym.v || []).forEach(function (v) {
      if (v <= x0 || v >= x1) return;
      s += '<line x1="' + px(v).toFixed(1) + '" y1="' + m + '" x2="' + px(v).toFixed(1) +
        '" y2="' + (H - m) + '" stroke="' + dash + '" stroke-width="1.2" stroke-dasharray="5 4"/>';
    });
    (asym.h || []).forEach(function (v) {
      if (v <= y0 || v >= y1) return;
      s += '<line x1="' + m + '" y1="' + py(v).toFixed(1) + '" x2="' + (W - m) +
        '" y2="' + py(v).toFixed(1) + '" stroke="' + dash + '" stroke-width="1.2" stroke-dasharray="5 4"/>';
    });

    if (f.kind === 'plot' && f.points && f.points.length > 1) {
      // A null in the list breaks the curve, so a function with a vertical
      // asymptote is not drawn as one continuous line straight through it.
      segments(f.points, x0, x1, y0, y1).forEach(function (seg) {
        if (seg.length < 2) return;
        s += '<polyline points="' + seg.map(function (p) {
          return px(p[0]).toFixed(1) + ',' + py(p[1]).toFixed(1);
        }).join(' ') + '" fill="none" stroke="' + curve +
          '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>';
      });
      if (f.label) {
        s += '<text x="' + (W - m - 4) + '" y="' + (m + 12) + '" text-anchor="end" ' +
          'font-family="Segoe UI,system-ui,sans-serif" font-size="10" fill="' + curve + '">' +
          mesc(f.label) + '</text>';
      }
    }

    // Marked features last, on top of everything: intercepts, turning points,
    // and the open circles that say a point is missing from the graph.
    var paper = ink ? '#fff' : '#12151f';
    (f.marks || []).forEach(function (mk) {
      if (mk.x < x0 || mk.x > x1 || mk.y < y0 || mk.y > y1) return;
      var cx = px(mk.x).toFixed(1), cy = py(mk.y).toFixed(1);
      var open = mk.type === 'open';
      s += '<circle cx="' + cx + '" cy="' + cy + '" r="3.4" fill="' +
        (open ? paper : curve) + '" stroke="' + curve + '" stroke-width="1.6"/>';
      if (mk.label) {
        s += '<text x="' + (px(mk.x) + 6).toFixed(1) + '" y="' + (py(mk.y) - 6).toFixed(1) + '" ' +
          'font-family="Segoe UI,system-ui,sans-serif" font-size="8.5" fill="' + text + '">' +
          mesc(mk.label) + '</text>';
      }
    });
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H +
      '" xmlns="http://www.w3.org/2000/svg" style="max-width:100%;margin:9px 0;display:block">' +
      s + '</svg>';
  }

  function spaceHtml(n, ink) {
    if (!n) return '';
    var line = ink ? '1px solid #ccc' : '1px dashed var(--stroke-strong)';
    var out = '';
    for (var i = 0; i < n; i++) {
      out += '<div style="border-bottom:' + line + ';height:' + (ink ? '9mm' : '26px') + '"></div>';
    }
    return '<div style="margin-top:7px">' + out + '</div>';
  }

  var LETTERS = 'abcdefgh';
  function partLabel(i) { return '(' + (LETTERS[i] || String(i + 1)) + ')'; }

  /**
   * A question in labelled parts. The model used to run two questions together
   * in one sentence with nothing to tell them apart; when it splits them out
   * they get (a), (b) and their own room to answer in.
   */
  function partsHtml(it, ink) {
    if (!it.parts || !it.parts.length) return spaceHtml(it.space, ink);
    return it.parts.map(function (p, i) {
      return '<div style="margin-top:' + (ink ? '5mm' : '11px') + '">' +
        '<span style="font-weight:600;margin-right:6px">' + partLabel(i) + '</span>' +
        mesc(p) + spaceHtml(it.space || 2, ink) + '</div>';
    }).join('');
  }

  /** The body of one question: table, figure, then the parts or plain space. */
  function extras(it, ink) {
    return tableHtml(it.table, ink) + figureSvg(it.figure, ink) + partsHtml(it, ink);
  }

  // ------------------------------------------------------- printable file
  /**
   * One self-contained HTML document, used for printing, for the .html
   * download and (with a Word MIME) for the .doc download. Everything is
   * inline so the file works after it leaves Orion.
   */
  function sheetDoc(d, withKey) {
    var css =
      'body{font:13pt/1.65 Georgia,"Times New Roman",serif;color:#111;margin:22mm 18mm}' +
      'h1{font-size:20pt;margin:0 0 2mm}h2{font-size:14pt;margin:9mm 0 3mm}' +
      '.sub{font-size:10pt;color:#555;margin:0 0 7mm;border-bottom:1px solid #bbb;padding-bottom:3mm}' +
      '.name{margin:0 0 8mm;font-size:11pt;color:#444}' +
      'ol{padding-left:7mm}li{margin:0 0 8mm;page-break-inside:avoid}' +
      '.q{font-weight:600}.work{border-bottom:1px solid #ccc;height:16mm;margin-top:4mm}' +
      '.study{background:#f2f2f2;padding:4mm 6mm;border-radius:2mm;font-size:11pt}' +
      '.key{page-break-before:always}.key li{margin:0 0 3mm}' +
      '.foot{margin-top:10mm;font-size:9pt;color:#777}';
    return '<!doctype html><html><head><meta charset="utf-8"><title>' +
      mesc(d.topic || 'Practice') + '</title><style>' + css + '</style></head><body>' +
      '<h1>' + mesc(d.topic || 'Practice') + '</h1>' +
      '<p class="sub">' + U.esc(d.level || '') + ' &middot; ' + (d.items || []).length +
        ' questions &middot; Orion Learn</p>' +
      '<p class="name">Name: ________________________     Date: ____________</p>' +
      '<ol>' + (d.items || []).map(function (it) {
        var ex = extras(it, true);
        return '<li><div class="q">' + mesc(it.q) + '</div>' +
          (ex || '<div class="work"></div>') + '</li>';
      }).join('') + '</ol>' +
      (d.study && d.study.length
        ? '<div class="study"><b>Before you start</b><ul>' +
          d.study.map(function (s) { return '<li>' + mesc(s) + '</li>'; }).join('') + '</ul></div>'
        : '') +
      (withKey
        ? '<div class="key"><h2>Answer key</h2><ol>' +
          (d.items || []).map(function (it) { return '<li>' + mesc(it.a) + '</li>'; }).join('') +
          '</ol></div>'
        : '') +
      '<p class="foot">Sheet ' + U.esc(d.sheetId || '') + ' &middot; made by Orion Learn</p>' +
      '</body></html>';
  }

  function reportDoc(d) {
    var css =
      'body{font:13pt/1.65 Georgia,"Times New Roman",serif;color:#111;margin:22mm 18mm}' +
      'h1{font-size:20pt;margin:0 0 2mm}h2{font-size:14pt;margin:9mm 0 3mm}' +
      '.sub{font-size:10pt;color:#555;margin:0 0 7mm;border-bottom:1px solid #bbb;padding-bottom:3mm}' +
      'ol{padding-left:7mm}li{margin:0 0 6mm;page-break-inside:avoid}' +
      '.q{font-weight:600}.tag{font-size:10pt}.ok{color:#0a7d33}.no{color:#b3261e}' +
      '.note{font-size:10.5pt;color:#444}';
    return '<!doctype html><html><head><meta charset="utf-8"><title>Marked</title>' +
      '<style>' + css + '</style></head><body>' +
      '<h1>' + mesc(d.topic || 'Marked') + '</h1>' +
      '<p class="sub">Score ' + (Number(d.score) || 0) + '/100 &middot; ' + U.esc(d.grade || '') +
        ' &middot; Orion Learn</p><p>' + mesc(d.summary || '') + '</p><ol>' +
      (d.marks || []).map(function (m) {
        return '<li><div class="q">' + mesc(m.q) + '</div>' +
          '<div class="tag ' + (m.ok ? 'ok' : 'no') + '">' + (m.ok ? 'Correct' : 'Not correct') +
          ' &mdash; you wrote: ' + mesc(m.given || 'blank') +
          (m.ok ? '' : ' &middot; answer: ' + mesc(m.correct)) + '</div>' +
          (m.note ? '<div class="note">' + mesc(m.note) + '</div>' : '') + '</li>';
      }).join('') + '</ol>' +
      (d.next && d.next.length
        ? '<h2>Practise next</h2><ul>' +
          d.next.map(function (s) { return '<li>' + mesc(s) + '</li>'; }).join('') + '</ul>'
        : '') + '</body></html>';
  }

  function safeName(s) {
    return String(s || 'Orion Learn').replace(/[\\/:*?"<>|]+/g, '').trim().slice(0, 48) || 'Orion Learn';
  }

  // -------------------------------------------------------------- as PDF
  /**
   * The same sheet again, drawn straight into a PDF rather than handed to the
   * browser as HTML. It is written by js/pdf.js, so the file that lands in
   * Downloads is a real .pdf with selectable text - no print dialog, no
   * "save as", and no library fetched from anywhere.
   */
  function sheetPdf(d, withKey) {
    var p = Pdf.doc({ title: mathText(d.topic || 'Practice') });
    p.text(mathText(d.topic || 'Practice'), { size: 18, bold: true });
    p.text((d.level || '') + ' · ' + (d.items || []).length + ' questions · Orion Learn',
      { size: 9.5, gray: 0.4 });
    p.rule();
    p.space(6);
    p.text('Name: ________________________     Date: ____________', { size: 10.5, gray: 0.25 });
    p.space(10);

    (d.items || []).forEach(function (it, i) {
      p.text((i + 1) + '.  ' + mathText(it.q), { size: 11.5, bold: true });
      if (it.table) p.table({
        head: (it.table.head || []).map(mathText),
        rows: (it.table.rows || []).map(function (r) { return r.map(mathText); })
      });
      if (it.figure) p.figure(Object.assign({}, it.figure, {
        label: it.figure.label ? mathText(it.figure.label) : '',
        marks: (it.figure.marks || []).map(function (mk) {
          return Object.assign({}, mk, { label: mk.label ? mathText(mk.label) : '' });
        })
      }));
      if (it.parts && it.parts.length) {
        it.parts.forEach(function (part, k) {
          p.space(3);
          p.text(partLabel(k) + '  ' + mathText(part), { size: 11, indent: 14 });
          p.lines(it.space || 2);
        });
      } else {
        p.lines(it.space || (it.table || it.figure ? 1 : 2));
      }
      p.space(6);
    });

    if (d.study && d.study.length) {
      p.space(6);
      p.text('Before you start', { size: 12, bold: true });
      d.study.forEach(function (s) { p.text('·  ' + mathText(s), { size: 10.5, indent: 8 }); });
    }
    if (withKey) {
      p.pageBreak();
      p.text('Answer key', { size: 16, bold: true });
      p.rule();
      (d.items || []).forEach(function (it, i) {
        p.text((i + 1) + '.  ' + mathText(it.a), { size: 10.5 });
        p.space(3);
      });
    }
    p.space(10);
    p.text('Sheet ' + (d.sheetId || '') + ' · made by Orion Learn', { size: 8, gray: 0.55 });
    return p.blob();
  }

  function reportPdf(d) {
    var p = Pdf.doc({ title: mathText(d.topic || 'Marked') });
    p.text(mathText(d.topic || 'Marked'), { size: 18, bold: true });
    p.text('Score ' + (Number(d.score) || 0) + '/100 · ' + (d.grade || '') + ' · Orion Learn',
      { size: 9.5, gray: 0.4 });
    p.rule();
    p.space(4);
    if (d.summary) { p.text(mathText(d.summary), { size: 11 }); p.space(8); }

    (d.marks || []).forEach(function (m, i) {
      p.text((i + 1) + '.  ' + mathText(m.q), { size: 11.5, bold: true });
      p.text((m.ok ? 'Correct' : 'Not correct') + ' — you wrote: ' +
        mathText(m.given || 'blank') +
        (m.ok ? '' : '   ·   answer: ' + mathText(m.correct)), { size: 10, indent: 8 });
      if (m.note) p.text(mathText(m.note), { size: 10, indent: 8, gray: 0.35 });
      p.space(7);
    });

    if (d.next && d.next.length) {
      p.space(4);
      p.text('Practise next', { size: 12, bold: true });
      d.next.forEach(function (s) { p.text('·  ' + mathText(s), { size: 10.5, indent: 8 }); });
    }
    return p.blob();
  }

  /** Real file download - a blob and an <a download>, no server round trip. */
  function downloadBlob(name, blob) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { a.remove(); URL.revokeObjectURL(url); }, 4000);
  }

  function download(name, mime, text) {
    var blob = new Blob(['﻿', text], { type: mime });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { a.remove(); URL.revokeObjectURL(url); }, 4000);
  }

  /** Print through an isolated iframe, so the desktop is not on the paper. */
  function printDoc(html, win) {
    var f = document.createElement('iframe');
    f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0';
    document.body.appendChild(f);
    var doc = f.contentDocument;
    doc.open(); doc.write(html); doc.close();
    setTimeout(function () {
      try { f.contentWindow.focus(); f.contentWindow.print(); }
      catch (e) { WM.alert('Orion Learn', 'This browser would not open the print dialog. Use Download instead.', win); }
      setTimeout(function () { f.remove(); }, 1200);
    }, 300);
  }

  // ================================================================== app
  function launchLearn(args) {
    var win = WM.create({
      appId: 'learn', title: 'Orion Learn', icon: 'orionlearn',
      width: 1040, height: 720, minWidth: 580, minHeight: 440
    });

    var mode = (args && args.mode) || 'practice';
    var busy = false, result = null, error = null, refusal = null;
    var photo = null, photoName = '';
    var sheets = [], pickedSheet = null, sheetsLoaded = false;

    win.body.innerHTML =
      '<div class="lr">' +
        '<div class="lr-side">' +
          '<div class="lr-brand">' + Icons.get('orionlearn') + '<span>Orion Learn</span></div>' +
          '<button class="lr-mode" data-mode="practice">' + Icons.get('doc') +
            '<span><b>Practice sheet</b><small>New questions like yours</small></span></button>' +
          '<button class="lr-mode" data-mode="grade">' + Icons.get('check') +
            '<span><b>Mark my work</b><small>Your answers to a sheet</small></span></button>' +
          '<button class="lr-mode" data-mode="sheets">' + Icons.get('list') +
            '<span><b>My sheets</b><small>Everything you have made</small></span></button>' +
          '<div class="lr-note">' + Icons.get('shield') +
            '<span>Orion Learn only marks sheets it made itself, and never answers or ' +
            'writes an assignment for you.</span></div>' +
        '</div>' +
        '<div class="lr-main">' +
          '<div class="lr-form" data-form></div>' +
          '<div class="lr-out" data-out></div>' +
        '</div>' +
      '</div>';

    var formBox = U.$('[data-form]', win.body);
    var out = U.$('[data-out]', win.body);

    // ------------------------------------------------------------- forms
    function photoRow(label) {
      return '<div class="lr-photo">' +
        '<button class="btn" data-act="photo">' + Icons.get('image') + ' ' + label + '</button>' +
        (photo
          ? '<span class="lr-photook">' + Icons.get('check') + U.esc(photoName) +
            '<button class="e-btn" data-act="unphoto" data-tip="Remove">' + Icons.get('x') + '</button></span>'
          : '<small class="muted">or take a photo of it</small>') +
        '</div>';
    }

    function renderForm() {
      if (mode === 'practice') {
        formBox.innerHTML =
          '<label class="lr-lab">Work you are studying</label>' +
          '<textarea class="lr-src" data-src spellcheck="false" ' +
            'placeholder="Paste or type the worksheet, questions or notes you are revising from."></textarea>' +
          photoRow('Add a photo') +
          '<div class="lr-row">' +
            '<label class="lr-field">Subject<select data-subject>' +
              SUBJECTS.map(function (s) { return '<option>' + s + '</option>'; }).join('') +
            '</select></label>' +
            '<label class="lr-field">Questions<select data-count>' +
              [4, 6, 8, 10, 12, 16, 20].map(function (n) {
                return '<option' + (n === 8 ? ' selected' : '') + '>' + n + '</option>';
              }).join('') +
            '</select></label>' +
            '<label class="lr-field">Difficulty<select data-level>' +
              '<option value="easier">Easier</option>' +
              '<option value="same" selected>Same as mine</option>' +
              '<option value="harder">Harder</option>' +
            '</select></label>' +
            '<span style="flex:1"></span>' +
            '<button class="btn" data-act="open">Open from Documents</button>' +
            '<button class="btn primary" data-act="go">Make practice sheet</button>' +
          '</div>';
        return;
      }
      if (mode === 'grade') {
        formBox.innerHTML =
          '<label class="lr-lab">Which sheet did you do?</label>' +
          '<div class="lr-pick" data-pick>' +
            (!sheetsLoaded ? '<small class="muted">Loading your sheets…</small>'
              : !sheets.length ? '<small class="muted">You have not made a sheet yet. ' +
                  'Make one first — Orion Learn only marks its own sheets.</small>'
              : sheets.map(function (s) {
                  return '<button class="lr-chip' + (pickedSheet === s.id ? ' on' : '') +
                    '" data-sheet="' + U.esc(s.id) + '">' + U.esc(s.topic) +
                    '<small>' + s.count + 'q · ' + stamp(s.created_at) + '</small></button>';
                }).join('')) +
          '</div>' +
          '<label class="lr-lab">Your answers</label>' +
          '<textarea class="lr-src short" data-src spellcheck="false" ' +
            'placeholder="1) 5&#10;2) 6&#10;3) 12"></textarea>' +
          photoRow('Photo of your sheet') +
          '<div class="lr-row"><span style="flex:1"></span>' +
            '<button class="btn primary" data-act="go">Mark my work</button></div>';
        return;
      }
      formBox.innerHTML =
        '<label class="lr-lab">Practice sheets you have made</label>' +
        '<div class="lr-row"><small class="muted">Open one to print or download it again, ' +
          'or mark your answers to it.</small><span style="flex:1"></span>' +
          '<button class="btn" data-act="reloadsheets">Refresh</button></div>';
    }

    // ------------------------------------------------------------ output
    function sheetMarkup(d) {
      return '<div class="lr-sheet">' +
        '<div class="lr-sheethead"><div><h2>' + mesc(d.topic || 'Practice') + '</h2>' +
          '<small>' + U.esc(d.level || '') + ' · ' + (d.items || []).length + ' questions</small></div>' +
          '<div class="lr-sheetacts">' +
            '<button class="btn" data-act="print">Print</button>' +
            '<button class="btn" data-act="dlpdf">Download PDF</button>' +
            '<button class="btn" data-act="dldoc">Word</button>' +
            '<button class="btn" data-act="save">Save to Documents</button>' +
            '<button class="btn" data-act="key">Show answer key</button>' +
            '<button class="btn primary" data-act="markthis">Mark my answers</button>' +
          '</div></div>' +
        '<ol class="lr-items">' + (d.items || []).map(function (it) {
          var ex = extras(it, false);
          return '<li><div class="lr-q">' + mesc(it.q) + '</div>' +
            (ex || '<div class="lr-work"></div>') + '</li>';
        }).join('') + '</ol>' +
        (d.study && d.study.length
          ? '<div class="lr-study"><b>Before you start</b><ul>' +
            d.study.map(function (s) { return '<li>' + mesc(s) + '</li>'; }).join('') + '</ul></div>' : '') +
        '<div class="lr-key hidden" data-keybox><b>Answer key</b>' +
          '<p class="muted">Check yourself against it after you have attempted the questions.</p>' +
          '<ol>' + (d.items || []).map(function (it) {
            return '<li>' + mesc(it.a) + '</li>';
          }).join('') + '</ol></div>' +
      '</div>';
    }

    function reportMarkup(d) {
      var score = Math.max(0, Math.min(100, Number(d.score) || 0));
      var tone = score >= 80 ? 'good' : score >= 60 ? 'ok' : 'low';
      var right = (d.marks || []).filter(function (m) { return m.ok; }).length;
      return '<div class="lr-report">' +
        '<div class="lr-scorebar ' + tone + '">' +
          '<div class="lr-score"><b>' + score + '</b><small>/100</small></div>' +
          '<div class="lr-gradeletter">' + U.esc(d.grade || '') + '</div>' +
          '<p>' + mesc(d.summary || '') + '<br><small class="muted">' + right + ' of ' +
            (d.marks || []).length + ' correct</small></p>' +
          '<button class="btn" data-act="printreport">Print</button>' +
          '<button class="btn" data-act="dlreport">Download PDF</button>' +
        '</div>' +
        '<ol class="lr-marks">' + (d.marks || []).map(function (m) {
          return '<li class="' + (m.ok ? 'ok' : 'no') + '">' +
            '<span class="lr-tick">' + Icons.get(m.ok ? 'check' : 'x') + '</span>' +
            '<div><div class="lr-q">' + mesc(m.q) + '</div>' +
            '<div class="lr-given">You wrote <b>' + mesc(m.given || 'nothing') + '</b>' +
              (m.ok ? '' : ' · answer <b>' + mesc(m.correct) + '</b>') + '</div>' +
            (m.note ? '<div class="lr-note2">' + mesc(m.note) + '</div>' : '') +
            '</div></li>';
        }).join('') + '</ol>' +
        (d.next && d.next.length
          ? '<h3 class="lr-h">Practise next</h3><ul class="lr-list">' +
            d.next.map(function (s) { return '<li>' + mesc(s) + '</li>'; }).join('') + '</ul>'
          : '') + '</div>';
    }

    function sheetsMarkup() {
      if (!sheetsLoaded) return '<div class="lr-busy"><i></i><span>Loading…</span></div>';
      if (!sheets.length) {
        return '<div class="lr-empty">' + Icons.get('orionlearn') +
          '<b>No sheets yet</b><span>Make a practice sheet and it will be kept here, ' +
          'so you can print it again or mark your answers to it.</span></div>';
      }
      return '<div class="lr-sheetgrid">' + sheets.map(function (s) {
        return '<button class="lr-card" data-openSheet="' + U.esc(s.id) + '">' +
          Icons.get('doc') + '<b>' + U.esc(s.topic) + '</b>' +
          '<small>' + s.count + ' questions · ' + U.esc(s.subject || '') + '</small>' +
          '<small class="muted">' + stamp(s.created_at) + '</small></button>';
      }).join('') + '</div>';
    }

    function render() {
      U.$$('.lr-mode', win.body).forEach(function (b) {
        b.classList.toggle('active', b.dataset.mode === mode);
      });

      if (busy) {
        out.innerHTML = '<div class="lr-busy"><i></i><span>' +
          (mode === 'practice' ? 'Writing new questions…' : 'Marking your answers…') +
          '</span><small>Reading your photo first.</small></div>';
        return;
      }
      if (refusal) {
        out.innerHTML = '<div class="lr-refused">' + Icons.get('shield') +
          '<b>Orion Learn cannot do that</b><p>' + U.esc(refusal) + '</p></div>';
        return;
      }
      if (error) {
        out.innerHTML = '<div class="lr-refused err">' + Icons.get('warning') +
          '<b>That did not work</b><p>' + U.esc(error) + '</p>' +
          '<button class="btn" data-act="go">Try again</button></div>';
        return;
      }
      if (mode === 'sheets') { out.innerHTML = sheetsMarkup(); return; }
      if (!result) {
        out.innerHTML = '<div class="lr-empty">' + Icons.get('orionlearn') +
          '<b>' + (mode === 'practice' ? 'Turn your work into practice' : 'Mark a sheet you did') + '</b>' +
          '<span>' + (mode === 'practice'
            ? 'Paste a worksheet or photograph one. Orion Learn works out the skill and writes fresh questions on it — no hints — then you can print it or download it.'
            : 'Pick one of your sheets, then type your answers or photograph the sheet you filled in. It is marked against that sheet’s own answer key.') +
          '</span></div>';
        return;
      }
      out.innerHTML = result.mode === 'practice' ? sheetMarkup(result) : reportMarkup(result);
    }

    function setMode(m) {
      mode = m;
      error = null; refusal = null;
      if (m !== 'practice') result = result && result.mode === 'practice' && m === 'grade' ? result : null;
      if (m === 'practice') result = null;
      renderForm();
      render();
      if ((m === 'grade' || m === 'sheets') && !sheetsLoaded) loadSheets();
    }

    function loadSheets() {
      post('/sheets', {}).then(function (d) {
        sheets = d.items || [];
        sheetsLoaded = true;
        renderForm();
        render();
      }).catch(function () { sheetsLoaded = true; renderForm(); render(); });
    }

    // ------------------------------------------------------------ submit
    function submit() {
      var srcEl = U.$('[data-src]', win.body);
      var text = srcEl ? srcEl.value.trim() : '';

      if (mode === 'grade' && !pickedSheet) {
        error = 'Pick which sheet you did first. Orion Learn only marks its own sheets.';
        result = null; refusal = null; render();
        return;
      }
      if (!photo && text.length < (mode === 'grade' ? 2 : 20)) {
        error = mode === 'grade'
          ? 'Type your answers, or add a photo of the sheet you filled in.'
          : 'Add a bit more of your work first — a couple of lines, or a photo.';
        result = null; refusal = null; render();
        return;
      }

      busy = true; error = null; refusal = null; result = null;
      render();

      var body = { image: photo || '' };
      if (mode === 'practice') {
        body.text = text;
        body.subject = U.$('[data-subject]', win.body).value;
        body.count = parseInt(U.$('[data-count]', win.body).value, 10);
        body.level = U.$('[data-level]', win.body).value;
      } else {
        body.sheetId = pickedSheet;
        body.answers = text;
      }

      post(mode === 'practice' ? '/practice' : '/grade', body).then(function (d) {
        busy = false;
        photo = null; photoName = '';
        if (d.refused) { refusal = d.reason; renderForm(); render(); return; }
        if (d.error) { error = d.error; renderForm(); render(); return; }
        result = d;
        if (d.mode === 'practice') {
          pickedSheet = d.sheetId;
          sheetsLoaded = false;
          loadSheets();
        }
        renderForm();
        render();
      }).catch(function (e) {
        busy = false;
        error = e.message;
        renderForm(); render();
      });
    }

    function openFromDocs() {
      var dir = VFS.HOME + '\\Documents';
      var list = VFS.exists(dir) ? VFS.list(dir).filter(function (e) {
        return e.node.type === 'file' && /\.(odoc|txt|md)$/i.test(e.name);
      }) : [];
      if (!list.length) {
        WM.alert('Orion Learn', 'No documents in your Documents folder yet.', win);
        return;
      }
      global.Shell.picker('Open your work', list.map(function (e) {
        return { label: e.name, sub: 'Documents', icon: 'filetext', value: e.path };
      })).then(function (p) {
        if (!p) return;
        var el = U.$('[data-src]', win.body);
        if (el) { el.value = plain(VFS.read(p) || ''); el.focus(); }
      });
    }

    function saveSheet() {
      var d = result;
      var html = '<h1>' + mesc(d.topic || 'Practice') + '</h1><ol>' +
        (d.items || []).map(function (it) {
          return '<li><b>' + mesc(it.q) + '</b>' +
            (it.parts || []).map(function (p, k) {
              return '<p>' + partLabel(k) + ' ' + mesc(p) + '</p><p><br></p>';
            }).join('') + '<p><br></p></li>';
        }).join('') + '</ol><h2>Answer key</h2><ol>' +
        (d.items || []).map(function (it) { return '<li>' + mesc(it.a) + '</li>'; }).join('') + '</ol>';
      var dir = VFS.HOME + '\\Documents';
      if (!VFS.exists(dir)) VFS.mkdir(dir);
      var name = VFS.uniqueName(dir, safeName(d.topic), '.odoc');
      VFS.write(dir + '\\' + name, html, 'odoc');
      Emu.notify('Orion Learn', name + ' saved to Documents. Orion Write can open it.', 'orionlearn');
    }

    // ------------------------------------------------------------ events
    win.body.addEventListener('click', function (e) {
      var m = e.target.closest('[data-mode]');
      if (m) { setMode(m.dataset.mode); return; }

      var chip = e.target.closest('[data-sheet]');
      if (chip) { pickedSheet = chip.dataset.sheet; renderForm(); return; }

      var openS = e.target.closest('[data-openSheet]');
      if (openS) {
        var id = openS.getAttribute('data-openSheet');
        busy = true; mode = 'practice'; renderForm(); render();
        post('/sheet', { sheetId: id }).then(function (d) {
          busy = false;
          if (d.error) { error = d.error; render(); return; }
          result = d; pickedSheet = d.sheetId;
          render();
        }).catch(function (err) { busy = false; error = err.message; render(); });
        return;
      }

      var a = e.target.closest('[data-act]');
      if (!a) return;
      var k = a.dataset.act;

      if (k === 'go') submit();
      else if (k === 'open') openFromDocs();
      else if (k === 'reloadsheets') { sheetsLoaded = false; render(); loadSheets(); }
      else if (k === 'photo') {
        U.pickPhoto(1400, 0.72).then(function (url) {
          if (!url) return;
          photo = url;
          photoName = 'Photo added';
          renderForm();
        });
      }
      else if (k === 'unphoto') { photo = null; photoName = ''; renderForm(); }
      else if (k === 'markthis') {
        pickedSheet = result.sheetId;
        setMode('grade');
      }
      else if (k === 'key') {
        var box = U.$('[data-keybox]', win.body);
        box.classList.toggle('hidden');
        a.textContent = box.classList.contains('hidden') ? 'Show answer key' : 'Hide answer key';
      }
      else if (k === 'print') {
        WM.confirm('Print', 'Include the answer key on the last page?', win)
          .then(function (withKey) { printDoc(sheetDoc(result, !!withKey), win); });
      }
      else if (k === 'dlpdf') {
        WM.confirm('Download PDF', 'Include the answer key on the last page?', win)
          .then(function (withKey) {
            downloadBlob(safeName(result.topic) + '.pdf', sheetPdf(result, !!withKey));
            Emu.notify('Orion Learn', 'Sheet saved as a PDF.', 'orionlearn');
          });
      }
      else if (k === 'dldoc') {
        WM.confirm('Download for Word', 'Include the answer key on the last page?', win)
          .then(function (withKey) {
            download(safeName(result.topic) + '.doc', 'application/msword',
              sheetDoc(result, !!withKey));
            Emu.notify('Orion Learn', 'Sheet downloaded for Word.', 'orionlearn');
          });
      }
      else if (k === 'save') saveSheet();
      else if (k === 'printreport') printDoc(reportDoc(result), win);
      else if (k === 'dlreport') {
        downloadBlob(safeName(result.topic) + ' marked.pdf', reportPdf(result));
        Emu.notify('Orion Learn', 'Marked sheet saved as a PDF.', 'orionlearn');
      }
    });

    setMode(mode);
    loadSheets();
    return win;
  }

  Emu.registerApp({
    id: 'learn', name: 'Orion Learn', icon: 'orionlearn', pinned: true,
    desc: 'Practice sheets and marking', singleton: true,
    launch: launchLearn
  });
})(window);
