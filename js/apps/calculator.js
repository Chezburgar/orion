/* ===== Calculator ===== */
(function (global) {
  'use strict';

  var Emu = global.Emu, U = Emu.util, WM = global.WM;

  var KEYS = [
    ['%', 'fn'], ['CE', 'fn'], ['C', 'fn'], ['⌫', 'fn'],
    ['1/x', 'fn'], ['x²', 'fn'], ['²√x', 'fn'], ['÷', 'fn'],
    ['7', ''], ['8', ''], ['9', ''], ['×', 'fn'],
    ['4', ''], ['5', ''], ['6', ''], ['−', 'fn'],
    ['1', ''], ['2', ''], ['3', ''], ['+', 'fn'],
    ['±', ''], ['0', ''], ['.', ''], ['=', 'eq']
  ];

  function launchCalc() {
    var win = WM.create({
      appId: 'calculator', title: 'Calculator', icon: 'calculator',
      width: 340, height: 520, minWidth: 280, minHeight: 400
    });

    var cur = '0', acc = null, op = null, fresh = true, expr = '';

    win.body.innerHTML =
      '<div class="calc">' +
        '<div class="calc-mode">Standard</div>' +
        '<div class="calc-display"><div class="calc-expr"></div><div class="calc-val">0</div></div>' +
        '<div class="calc-keys">' + KEYS.map(function (k) {
          return '<button class="' + k[1] + '" data-k="' + k[0] + '">' + k[0] + '</button>';
        }).join('') + '</div>' +
      '</div>';

    var valEl = U.$('.calc-val', win.body);
    var exprEl = U.$('.calc-expr', win.body);

    function show() {
      var n = parseFloat(cur);
      valEl.textContent = isFinite(n) && Math.abs(n) >= 1000
        ? n.toLocaleString(undefined, { maximumFractionDigits: 10 })
        : cur;
      exprEl.textContent = expr;
    }

    function apply(a, b, o) {
      switch (o) {
        case '+': return a + b;
        case '−': return a - b;
        case '×': return a * b;
        case '÷': return b === 0 ? NaN : a / b;
        default: return b;
      }
    }

    function digit(d) {
      if (fresh) { cur = d === '.' ? '0.' : d; fresh = false; }
      else if (d === '.') { if (cur.indexOf('.') < 0) cur += '.'; }
      else cur = cur === '0' ? d : cur + d;
      show();
    }

    function setOp(o) {
      var n = parseFloat(cur);
      if (acc == null) acc = n;
      else if (!fresh) acc = apply(acc, n, op);
      op = o;
      fresh = true;
      expr = fmt(acc) + ' ' + o;
      cur = String(acc);
      show();
    }

    function fmt(n) {
      if (!isFinite(n)) return 'Cannot divide by zero';
      return String(Math.round(n * 1e12) / 1e12);
    }

    function equals() {
      var n = parseFloat(cur);
      if (op != null && acc != null) {
        expr = fmt(acc) + ' ' + op + ' ' + fmt(n) + ' =';
        acc = apply(acc, n, op);
        cur = fmt(acc);
        op = null;
        acc = null;
      } else expr = fmt(n) + ' =';
      fresh = true;
      show();
    }

    function press(k) {
      if (/^[0-9.]$/.test(k)) return digit(k);
      switch (k) {
        case 'C': cur = '0'; acc = null; op = null; expr = ''; fresh = true; break;
        case 'CE': cur = '0'; fresh = true; break;
        case '⌫': cur = cur.length > 1 ? cur.slice(0, -1) : '0'; break;
        case '±': cur = cur.startsWith('-') ? cur.slice(1) : (cur === '0' ? '0' : '-' + cur); break;
        case '%': cur = fmt(parseFloat(cur) / 100); fresh = true; break;
        case '1/x': cur = fmt(1 / parseFloat(cur)); expr = '1/(' + cur + ')'; fresh = true; break;
        case 'x²': cur = fmt(Math.pow(parseFloat(cur), 2)); fresh = true; break;
        case '²√x': cur = fmt(Math.sqrt(parseFloat(cur))); fresh = true; break;
        case '+': case '−': case '×': case '÷': return setOp(k);
        case '=': return equals();
      }
      show();
    }

    win.body.addEventListener('click', function (e) {
      var b = e.target.closest('[data-k]');
      if (b) press(b.dataset.k);
    });

    function onKey(e) {
      if (WM.focused !== win) return;
      var map = { '/': '÷', '*': '×', '-': '−', '+': '+', 'Enter': '=', '=': '=', 'Backspace': '⌫', 'Escape': 'C', 'Delete': 'CE', '%': '%' };
      var k = /^[0-9.]$/.test(e.key) ? e.key : map[e.key];
      if (!k) return;
      e.preventDefault();
      press(k);
      var btn = win.body.querySelector('[data-k="' + k.replace(/"/g, '') + '"]');
      if (btn) { btn.style.filter = 'brightness(1.5)'; setTimeout(function () { btn.style.filter = ''; }, 90); }
    }
    document.addEventListener('keydown', onKey);
    win.onClose = function () { document.removeEventListener('keydown', onKey); };

    show();
    return win;
  }

  Emu.registerApp({
    id: 'calculator', name: 'Calculator', icon: 'calculator', pinned: true,
    desc: 'Standard calculator', launch: launchCalc
  });
})(window);
