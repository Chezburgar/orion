/* ===== A very small PDF writer =====
   Enough of PDF 1.4 to lay out a worksheet: wrapped text, rules, tables,
   answer lines and the little axes-and-curve figures. Everything is drawn
   with vector operators and the standard fonts, so the output is real
   selectable text rather than a picture of a page, and nothing is fetched
   from anywhere - this file is the whole dependency.                     */
(function (global) {
  'use strict';

  var PT = 2.834645669;                       // points per millimetre
  var PAGE = { w: 595.28, h: 841.89 };        // A4
  var MARGIN = { top: 56, bottom: 56, left: 56, right: 56 };

  // ------------------------------------------------------------- widths
  // Glyph widths per 1000 units, for the two standard fonts we use. Only
  // ASCII is tabulated; everything else falls back to an average, which is
  // close enough that a line never overruns the margin.
  var W_REG = ('278 278 355 556 556 889 667 191 333 333 389 584 278 333 278 278 ' +
    '556 556 556 556 556 556 556 556 556 556 278 278 584 584 584 556 ' +
    '1015 667 667 722 722 667 611 778 722 278 500 667 556 833 722 778 ' +
    '667 778 722 667 611 722 667 944 667 667 611 278 278 278 469 556 ' +
    '333 556 556 500 556 556 278 556 556 222 222 500 222 833 556 556 ' +
    '556 556 333 500 278 556 500 722 500 500 500 334 260 334 584').split(' ').map(Number);
  var W_BOLD = ('278 333 474 556 556 889 722 238 333 333 389 584 278 333 278 278 ' +
    '556 556 556 556 556 556 556 556 556 556 333 333 584 584 584 611 ' +
    '975 722 722 722 722 667 611 778 722 278 556 722 611 833 722 778 ' +
    '667 778 722 667 611 722 667 944 667 667 611 333 278 333 584 556 ' +
    '333 556 611 556 611 556 333 611 611 278 278 556 278 889 611 611 ' +
    '611 611 389 556 333 611 556 778 556 556 500 389 280 389 584').split(' ').map(Number);

  // ------------------------------------------------------------ encoding
  // Characters outside WinAnsi are drawn from the Symbol font instead, and
  // super/subscripts are drawn as smaller glyphs nudged off the baseline.
  var WIN = { '\u20ac': 128, '\u2026': 133, '\u2018': 145, '\u2019': 146, '\u201c': 147,
    '\u201d': 148, '\u2022': 149, '\u2013': 150, '\u2014': 151, '\u2122': 153 };
  var SYM = {
    '\u03b1': 97, '\u03b2': 98, '\u03b3': 103, '\u03b4': 100, '\u03b5': 101, '\u03b8': 113,
    '\u03bb': 108, '\u03bc': 109, '\u03c0': 112, '\u03c1': 114, '\u03c3': 115, '\u03c4': 116,
    '\u03c6': 102, '\u03c8': 121, '\u03c9': 119, '\u0394': 68, '\u03a9': 87, '\u03a3': 83,
    '\u03a0': 80, '\u03a6': 70, '\u0398': 81,
    '\u221e': 165, '\u2264': 163, '\u2265': 179, '\u2260': 185, '\u2248': 187,
    '\u221a': 214, '\u2208': 206, '\u2209': 207, '\u222a': 200, '\u2229': 199,
    '\u2282': 204, '\u2286': 205, '\u2192': 174, '\u2190': 172, '\u2194': 171,
    '\u21d2': 222, '\u21d4': 219, '\u2211': 229, '\u220f': 213, '\u222b': 242,
    '\u2202': 182, '\u2207': 209, '\u2205': 198, '\u2220': 208, '\u2234': 92,
    '\u221d': 181, '\u2227': 217, '\u2228': 218, '\u00ac': 216, '\u2261': 186,
    '\u2245': 64, '\u2200': 34, '\u2203': 36, '\u22c5': 215,
    '\u22a5': 94, '\u2032': 162, '\u2033': 178
  };
  var SUP = { '\u2070': '0', '\u00b9': '1', '\u00b2': '2', '\u00b3': '3', '\u2074': '4',
    '\u2075': '5', '\u2076': '6', '\u2077': '7', '\u2078': '8', '\u2079': '9',
    '\u207a': '+', '\u207b': '-', '\u207c': '=', '\u207d': '(', '\u207e': ')',
    '\u207f': 'n', '\u02b3': 'r', '\u02e3': 'x' };
  var SUB = { '\u2080': '0', '\u2081': '1', '\u2082': '2', '\u2083': '3', '\u2084': '4',
    '\u2085': '5', '\u2086': '6', '\u2087': '7', '\u2088': '8', '\u2089': '9',
    '\u208a': '+', '\u208b': '-', '\u208c': '=', '\u208d': '(', '\u208e': ')',
    '\u2093': 'x', '\u2099': 'n' };
  // No glyph anywhere in the three fonts, so these are spelled out instead.
  var FALLBACK = {
    '\u2153': '1/3', '\u2154': '2/3', '\u2155': '1/5', '\u2156': '2/5',
    '\u211d': 'R', '\u2124': 'Z', '\u2115': 'N', '\u211a': 'Q', '\u2102': 'C',
    '\u2212': '-', '\u2012': '-', '\u2010': '-', '\u2213': '-/+', '\u221b': '\u00b3\u221a', '\u221c': '\u2074\u221a',
    '\u22ef': '...', '\u22ee': '...', '\u2225': '||', '\u2044': '/', '\u226a': '<<', '\u226b': '>>',
    // lookalikes that are not the Greek letter or arrow the fonts carry
    '\u2206': '\u0394', '\u27f6': '\u2192', '\u27f5': '\u2190', '\u27f9': '\u21d2', '\u27fa': '\u21d4',
    '\u2217': '*', '\u2219': '\u00b7', '\u02b9': "'"
  };

  /**
   * Break a string into runs, each drawable with one font at one offset.
   * Runs look like { s: text, font: 'F1'|'F2'|'F3', rise: 0|1|-1 }.
   */
  function runs(text, bold) {
    var out = [], base = bold ? 'F2' : 'F1', cur = null;
    function push(ch, font, rise) {
      if (cur && cur.font === font && cur.rise === rise) { cur.s += ch; return; }
      cur = { s: ch, font: font, rise: rise };
      out.push(cur);
    }
    // Typographic spaces first - a narrow no-break space between a term and
    // its operator is common in generated maths and has no glyph of its own.
    // Then the spelled-out substitutes, so their own characters (the 3 of a
    // cube root, say) get encoded like anything else.
    var s = String(text == null ? '' : text)
      .replace(/[\u200b-\u200d\ufeff]/g, '')
      .replace(/[\u2000-\u200a\u202f\u205f\u3000]/g, ' ')
      .replace(/[\u2010-\u2012\u2043]/g, '-')
      .replace(/[^\x00-\xff]/g, function (ch) {
        return Object.prototype.hasOwnProperty.call(FALLBACK, ch) ? FALLBACK[ch] : ch;
      });
    for (var i = 0; i < s.length; i++) {
      var c = s[i], code = c.charCodeAt(0);
      if (SUP[c]) { push(SUP[c], base, 1); continue; }
      if (SUB[c]) { push(SUB[c], base, -1); continue; }
      if (SYM[c]) { push(String.fromCharCode(SYM[c]), 'F3', 0); continue; }
      if (WIN[c]) { push(String.fromCharCode(WIN[c]), base, 0); continue; }
      if (code <= 255) { push(c, base, 0); continue; }
      push('?', base, 0);
    }
    return out;
  }

  function runWidth(r, size) {
    var tbl = r.font === 'F2' ? W_BOLD : W_REG, sz = r.rise ? size * 0.62 : size, w = 0;
    for (var i = 0; i < r.s.length; i++) {
      var c = r.s.charCodeAt(i);
      if (r.font === 'F3') { w += 549; continue; }
      w += (c >= 32 && c <= 126) ? tbl[c - 32] : 556;
    }
    return w / 1000 * sz;
  }

  function measure(text, size, bold) {
    return runs(text, bold).reduce(function (a, r) { return a + runWidth(r, size); }, 0);
  }

  function esc(s) {
    return s.replace(/[\\()]/g, '\\$&').replace(/[\x80-\xff]/g, function (c) {
      return '\\' + ('00' + c.charCodeAt(0).toString(8)).slice(-3);
    });
  }

  /**
   * Split a point list into the runs drawn as one stroke. A null is an
   * explicit break; so is leaving the window, or a curve running off the top
   * returns as a straight line across the graph.
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

  // --------------------------------------------------------------- doc
  function doc(opts) {
    opts = opts || {};
    var pages = [], cur = null, y = 0;
    var left = MARGIN.left, right = PAGE.w - MARGIN.right;
    var colW = right - left;

    function newPage() {
      cur = { ops: [] };
      pages.push(cur);
      y = PAGE.h - MARGIN.top;
      return cur;
    }
    newPage();

    function need(h) { if (y - h < MARGIN.bottom) newPage(); }
    function op(s) { cur.ops.push(s); }
    function n(v) { return (Math.round(v * 100) / 100).toString(); }

    /** One line of already-fitted runs, drawn at an exact baseline. */
    function drawRuns(list, x, baseline, size) {
      for (var i = 0; i < list.length; i++) {
        var r = list[i];
        if (!r.s) continue;
        var sz = r.rise ? size * 0.62 : size;
        var dy = r.rise > 0 ? size * 0.33 : r.rise < 0 ? -size * 0.16 : 0;
        op('BT /' + r.font + ' ' + n(sz) + ' Tf 1 0 0 1 ' + n(x) + ' ' + n(baseline + dy) + ' Tm (' +
          esc(r.s) + ') Tj ET');
        x += runWidth(r, size);
      }
      return x;
    }

    /** Greedy word wrap that keeps run boundaries intact. */
    function wrap(text, size, bold, width) {
      var words = String(text == null ? '' : text).split(/(\s+)/);
      var lines = [], line = '', w = 0;
      for (var i = 0; i < words.length; i++) {
        var word = words[i];
        if (!word) continue;
        var ww = measure(word, size, bold);
        if (w + ww > width && line.trim()) {
          lines.push(line.replace(/\s+$/, ''));
          if (/^\s+$/.test(word)) { line = ''; w = 0; continue; }
          line = word; w = ww;
        } else { line += word; w += ww; }
      }
      if (line.trim()) lines.push(line.replace(/\s+$/, ''));
      return lines.length ? lines : [''];
    }

    var api = {
      width: colW,

      text: function (s, o) {
        o = o || {};
        var size = o.size || 11, bold = !!o.bold, lead = o.lead || size * 1.42;
        var x = left + (o.indent || 0), w = (o.width || colW) - (o.indent || 0);
        var lines = wrap(s, size, bold, w);
        for (var i = 0; i < lines.length; i++) {
          need(lead);
          y -= lead;
          var lr = runs(lines[i], bold), startX = x;
          if (o.align === 'center') startX = x + (w - measure(lines[i], size, bold)) / 2;
          if (o.align === 'right') startX = x + w - measure(lines[i], size, bold);
          if (o.gray) op(n(o.gray) + ' g');
          drawRuns(lr, startX, y, size);
          if (o.gray) op('0 g');
        }
        return api;
      },

      space: function (h) { need(h); y -= h; return api; },

      rule: function (gray) {
        need(10); y -= 7;
        op(n(gray == null ? 0.75 : gray) + ' G 0.7 w ' + n(left) + ' ' + n(y) + ' m ' +
          n(right) + ' ' + n(y) + ' l S 0 G');
        y -= 3;
        return api;
      },

      /** Ruled answer space, in millimetres per line. */
      lines: function (count, mm) {
        var h = (mm || 9) * PT;
        for (var i = 0; i < count; i++) {
          need(h); y -= h;
          op('0.78 G 0.6 w ' + n(left + 6) + ' ' + n(y) + ' m ' + n(right) + ' ' + n(y) + ' l S 0 G');
        }
        y -= 4;
        return api;
      },

      table: function (t) {
        if (!t) return api;
        var head = (t.head && t.head.length) ? t.head : null;
        var body = t.rows || [];
        var cols = Math.max(head ? head.length : 0,
          body.reduce(function (m, r) { return Math.max(m, r.length); }, 0));
        if (!cols) return api;

        var cw = Math.min(colW, cols * 78) / cols, rowH = 20, size = 9.5;
        var tw = cw * cols;
        var all = (head ? [head] : []).concat(body);
        need(rowH * all.length + 12);
        y -= 8;

        for (var r = 0; r < all.length; r++) {
          var top = y, bot = y - rowH, isHead = head && r === 0;
          if (isHead) op('0.93 g ' + n(left) + ' ' + n(bot) + ' ' + n(tw) + ' ' + n(rowH) + ' re f 0 g');
          for (var c = 0; c < cols; c++) {
            var x = left + c * cw;
            op('0.55 G 0.7 w ' + n(x) + ' ' + n(bot) + ' ' + n(cw) + ' ' + n(rowH) + ' re S 0 G');
            var cell = String((all[r][c] == null ? '' : all[r][c]));
            if (!cell) continue;
            var tx = x + (cw - measure(cell, size, isHead)) / 2;
            drawRuns(runs(cell, isHead), tx, bot + 6.5, size);
          }
          y = bot;
        }
        y -= 8;
        return api;
      },

      /** The same axes-and-curve figure the app draws, as vectors. */
      figure: function (f) {
        if (!f || !f.x || !f.y) return api;
        var W = 250, H = 175, pad = 22;
        need(H + 14);
        y -= 8;
        var oy = y - H, ox = left + 4;
        var x0 = f.x[0], x1 = f.x[1], y0 = f.y[0], y1 = f.y[1];
        var px = function (v) { return ox + pad + (v - x0) / (x1 - x0) * (W - pad * 2); };
        var py = function (v) { return oy + pad + (v - y0) / (y1 - y0) * (H - pad * 2); };
        var stp = function (span) {
          var raw = span / 8, mag = Math.pow(10, Math.floor(Math.log(raw || 1) / Math.LN10));
          var k = raw / mag;
          return (k >= 5 ? 5 : k >= 2 ? 2 : 1) * mag;
        };
        var sx = stp(x1 - x0), sy = stp(y1 - y0), g;

        op('0.85 G 0.5 w');
        for (g = Math.ceil(x0 / sx) * sx; g <= x1 + 1e-9; g += sx) {
          op(n(px(g)) + ' ' + n(oy + pad) + ' m ' + n(px(g)) + ' ' + n(oy + H - pad) + ' l S');
        }
        for (g = Math.ceil(y0 / sy) * sy; g <= y1 + 1e-9; g += sy) {
          op(n(ox + pad) + ' ' + n(py(g)) + ' m ' + n(ox + W - pad) + ' ' + n(py(g)) + ' l S');
        }
        op('0.25 G 1 w');
        if (y0 <= 0 && y1 >= 0) op(n(ox + pad) + ' ' + n(py(0)) + ' m ' + n(ox + W - pad) + ' ' + n(py(0)) + ' l S');
        if (x0 <= 0 && x1 >= 0) op(n(px(0)) + ' ' + n(oy + pad) + ' m ' + n(px(0)) + ' ' + n(oy + H - pad) + ' l S');
        op('0.45 G 0.7 w ' + n(ox + pad) + ' ' + n(oy + pad) + ' ' + n(W - pad * 2) + ' ' +
          n(H - pad * 2) + ' re S 0 G');

        var lab = function (t, x, yy, align) {
          var s = String(t), w = measure(s, 7.5, false);
          drawRuns(runs(s, false), align === 'end' ? x - w : x - w / 2, yy, 7.5);
        };
        lab(x0, px(x0), oy + pad - 10);
        lab(x1, px(x1), oy + pad - 10);
        lab(y0, ox + pad - 4, py(y0) - 2, 'end');
        lab(y1, ox + pad - 4, py(y1) - 2, 'end');

        // Asymptotes under the curve, dashed, so the curve stays dominant.
        var asym = f.asymptotes || {}, i;
        op('0.55 G 0.9 w [3 3] 0 d');
        (asym.v || []).forEach(function (v) {
          if (v <= x0 || v >= x1) return;
          op(n(px(v)) + ' ' + n(oy + pad) + ' m ' + n(px(v)) + ' ' + n(oy + H - pad) + ' l S');
        });
        (asym.h || []).forEach(function (v) {
          if (v <= y0 || v >= y1) return;
          op(n(ox + pad) + ' ' + n(py(v)) + ' m ' + n(ox + W - pad) + ' ' + n(py(v)) + ' l S');
        });
        op('[] 0 d 0 G');

        if (f.kind === 'plot' && f.points && f.points.length > 1) {
          // A null breaks the curve - without it a function with a vertical
          // asymptote is drawn straight through the gap.
          op('0.1 G 1.4 w');
          segments(f.points, x0, x1, y0, y1).forEach(function (seg) {
            if (seg.length < 2) return;
            op(n(px(seg[0][0])) + ' ' + n(py(seg[0][1])) + ' m');
            for (var k = 1; k < seg.length; k++) op(n(px(seg[k][0])) + ' ' + n(py(seg[k][1])) + ' l');
            op('S');
          });
          op('0 G');
          if (f.label) drawRuns(runs(f.label, false), ox + W - pad - measure(f.label, 8, false) - 3,
            oy + H - pad - 11, 8);
        }

        // Marked features on top: intercepts, turning points, and the open
        // circles that say a point is missing.
        (f.marks || []).forEach(function (mk) {
          if (mk.x < x0 || mk.x > x1 || mk.y < y0 || mk.y > y1) return;
          var cx = px(mk.x), cy = py(mk.y), r = 2.6;
          // a circle from four Bezier arcs - PDF has no circle operator
          var k = r * 0.5523;
          op(n(cx - r) + ' ' + n(cy) + ' m ' +
             n(cx - r) + ' ' + n(cy + k) + ' ' + n(cx - k) + ' ' + n(cy + r) + ' ' + n(cx) + ' ' + n(cy + r) + ' c ' +
             n(cx + k) + ' ' + n(cy + r) + ' ' + n(cx + r) + ' ' + n(cy + k) + ' ' + n(cx + r) + ' ' + n(cy) + ' c ' +
             n(cx + r) + ' ' + n(cy - k) + ' ' + n(cx + k) + ' ' + n(cy - r) + ' ' + n(cx) + ' ' + n(cy - r) + ' c ' +
             n(cx - k) + ' ' + n(cy - r) + ' ' + n(cx - r) + ' ' + n(cy - k) + ' ' + n(cx - r) + ' ' + n(cy) + ' c h ' +
             (mk.type === 'open' ? '1 g 0 G 1.1 w B' : '0 g 0 G 1.1 w B') + ' 0 g');
          if (mk.label) drawRuns(runs(mk.label, false), cx + 4.5, cy + 4, 7);
        });
        y = oy - 8;
        return api;
      },

      pageBreak: function () { newPage(); return api; },

      // ------------------------------------------------------ serialise
      bytes: function () {
        var objs = [], out = '';
        function add(body) { objs.push(body); return objs.length; }

        var fontIds = {
          F1: add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'),
          F2: add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'),
          F3: add('<< /Type /Font /Subtype /Type1 /BaseFont /Symbol >>')
        };
        var res = '<< /Font << /F1 ' + fontIds.F1 + ' 0 R /F2 ' + fontIds.F2 +
          ' 0 R /F3 ' + fontIds.F3 + ' 0 R >> >>';

        var pagesId = objs.length + 1 + pages.length * 2;
        var kids = [];
        pages.forEach(function (p) {
          var stream = p.ops.join('\n');
          var sid = add('<< /Length ' + stream.length + ' >>\nstream\n' + stream + '\nendstream');
          var pid = add('<< /Type /Page /Parent ' + pagesId + ' 0 R /MediaBox [0 0 ' +
            PAGE.w.toFixed(2) + ' ' + PAGE.h.toFixed(2) + '] /Resources ' + res +
            ' /Contents ' + sid + ' 0 R >>');
          kids.push(pid + ' 0 R');
        });
        add('<< /Type /Pages /Count ' + pages.length + ' /Kids [' + kids.join(' ') + '] >>');
        var catalogId = add('<< /Type /Catalog /Pages ' + pagesId + ' 0 R >>');
        var infoId = add('<< /Title (' + esc(String(opts.title || 'Document')) +
          ') /Producer (Orion) >>');

        out = '%PDF-1.4\n';
        var offsets = [0];
        objs.forEach(function (body, i) {
          offsets.push(out.length);
          out += (i + 1) + ' 0 obj\n' + body + '\nendobj\n';
        });
        var xref = out.length;
        out += 'xref\n0 ' + (objs.length + 1) + '\n0000000000 65535 f \n';
        for (var i = 1; i <= objs.length; i++) {
          out += ('0000000000' + offsets[i]).slice(-10) + ' 00000 n \n';
        }
        out += 'trailer\n<< /Size ' + (objs.length + 1) + ' /Root ' + catalogId +
          ' 0 R /Info ' + infoId + ' 0 R >>\nstartxref\n' + xref + '\n%%EOF';

        // Latin-1 out: every byte was written as a byte, so widen nothing.
        var buf = new Uint8Array(out.length);
        for (var k = 0; k < out.length; k++) buf[k] = out.charCodeAt(k) & 0xff;
        return buf;
      },

      blob: function () { return new Blob([api.bytes()], { type: 'application/pdf' }); }
    };
    return api;
  }

  global.Pdf = { doc: doc, measure: measure, PT: PT };
})(window);
