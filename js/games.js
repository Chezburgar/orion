/* ===== Games =====
   Each game is a self-contained app the Microsoft Store can install and
   uninstall. Nothing here loads until the user installs it.             */
(function (global) {
  'use strict';

  var Emu = global.Emu, U = Emu.util, Icons = global.Icons, WM = global.WM;

  /** Per-game high scores, kept with the rest of the emulator state. */
  function best(id, score) {
    var s = Emu.state.scores || (Emu.state.scores = {});
    if (score != null && score > (s[id] || 0)) { s[id] = score; Emu.save(); }
    return s[id] || 0;
  }

  /** Bind keys only while this game's window has focus. */
  function keys(win, handler) {
    function on(e) {
      if (WM.focused !== win) return;
      if (handler(e) !== false) e.preventDefault();
    }
    document.addEventListener('keydown', on);
    var prev = win.onClose;
    win.onClose = function () {
      document.removeEventListener('keydown', on);
      return prev ? prev() : true;
    };
  }

  function loop(win, fn, fps) {
    var last = 0, raf = 0, dead = false;
    function tick(t) {
      if (dead) return;
      raf = requestAnimationFrame(tick);
      if (t - last < 1000 / (fps || 60)) return;
      last = t;
      fn();
    }
    raf = requestAnimationFrame(tick);
    var prev = win.onClose;
    win.onClose = function () {
      dead = true;
      cancelAnimationFrame(raf);
      return prev ? prev() : true;
    };
    return { stop: function () { dead = true; cancelAnimationFrame(raf); } };
  }

  function bar(html) { return '<div class="game-bar">' + html + '</div>'; }

  // ------------------------------------------------------------ Minesweeper
  function minesweeper(win) {
    var LEVELS = { Beginner: [9, 9, 10], Intermediate: [16, 16, 40], Expert: [24, 16, 99] };
    var level = 'Beginner', W, H, M, grid, over, flags, revealed, started, t0, timer;

    win.body.innerHTML = '<div class="game ms">' + bar(
      '<select class="st-select" data-level>' + Object.keys(LEVELS).map(function (k) {
        return '<option' + (k === level ? ' selected' : '') + '>' + k + '</option>';
      }).join('') + '</select>' +
      '<button class="btn" data-new>New game</button>' +
      '<span class="game-stat" data-mines></span><span class="game-stat" data-time></span>' +
      '<span class="game-msg" data-msg></span>') +
      '<div class="ms-board" data-board></div></div>';

    var board = U.$('[data-board]', win.body);

    function reset() {
      var L = LEVELS[level];
      W = L[0]; H = L[1]; M = L[2];
      grid = []; over = false; flags = 0; revealed = 0; started = false;
      clearInterval(timer); t0 = 0;
      for (var i = 0; i < W * H; i++) grid.push({ m: false, r: false, f: false, n: 0 });
      draw();
    }

    function plant(safe) {
      var placed = 0;
      while (placed < M) {
        var k = Math.floor(Math.random() * W * H);
        if (grid[k].m || k === safe || nb(safe).indexOf(k) >= 0) continue;
        grid[k].m = true; placed++;
      }
      grid.forEach(function (c, i) { c.n = nb(i).filter(function (j) { return grid[j].m; }).length; });
    }

    function nb(i) {
      var x = i % W, y = (i / W) | 0, out = [];
      for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        var nx = x + dx, ny = y + dy;
        if (nx >= 0 && nx < W && ny >= 0 && ny < H) out.push(ny * W + nx);
      }
      return out;
    }

    function reveal(i) {
      var c = grid[i];
      if (c.r || c.f || over) return;
      c.r = true; revealed++;
      if (c.m) {
        over = 'lost';
        grid.forEach(function (g) { if (g.m) g.r = true; });
        clearInterval(timer);
        return;
      }
      if (c.n === 0) nb(i).forEach(reveal);
      if (revealed === W * H - M) {
        over = 'won';
        clearInterval(timer);
        best('minesweeper-' + level, Math.max(1, 999 - Math.floor((Date.now() - t0) / 1000)));
      }
    }

    function draw() {
      var COLORS = ['', '#4aa3e8', '#3fae55', '#e35d5d', '#7c5cf0', '#c98a2a', '#28a3a3', '#b0b0b0', '#8a8a8a'];
      board.style.gridTemplateColumns = 'repeat(' + W + ',26px)';
      board.innerHTML = grid.map(function (c, i) {
        var label = c.r ? (c.m ? '&#10039;' : (c.n || '')) : (c.f ? '&#9873;' : '');
        var cls = 'ms-cell' + (c.r ? ' open' : '') + (c.r && c.m ? ' boom' : '') + (c.f ? ' flag' : '');
        return '<button class="' + cls + '" data-i="' + i + '" style="color:' +
          (c.r && !c.m ? COLORS[c.n] : '') + '">' + label + '</button>';
      }).join('');
      U.$('[data-mines]', win.body).textContent = '⚑ ' + (M - flags);
      U.$('[data-msg]', win.body).innerHTML = over
        ? (over === 'won' ? '<b style="color:#3fae55">Cleared!</b>' : '<b style="color:#e35d5d">Boom.</b>') : '';
    }

    function tickTime() {
      U.$('[data-time]', win.body).textContent = '⏱ ' + Math.floor((Date.now() - t0) / 1000) + 's';
    }

    win.body.addEventListener('click', function (e) {
      if (e.target.closest('[data-new]')) return reset();
      var cell = e.target.closest('[data-i]');
      if (!cell || over) return;
      var i = +cell.dataset.i;
      if (!started) {
        started = true; plant(i); t0 = Date.now();
        timer = setInterval(tickTime, 500);
      }
      reveal(i);
      draw();
    });
    win.body.addEventListener('contextmenu', function (e) {
      var cell = e.target.closest('[data-i]');
      if (!cell) return;
      e.preventDefault(); e.stopPropagation();
      var c = grid[+cell.dataset.i];
      if (!c.r && !over) { c.f = !c.f; flags += c.f ? 1 : -1; draw(); }
    });
    win.body.addEventListener('change', function (e) {
      if (e.target.dataset.level !== undefined) { level = e.target.value; reset(); }
    });
    var prev = win.onClose;
    win.onClose = function () { clearInterval(timer); return prev ? prev() : true; };
    reset();
  }

  // ---------------------------------------------------------------- 2048
  function g2048(win) {
    var N = 4, cells, score, over, won;

    win.body.innerHTML = '<div class="game g2048">' + bar(
      '<button class="btn" data-new>New game</button>' +
      '<span class="game-stat">Score <b data-score>0</b></span>' +
      '<span class="game-stat">Best <b data-best>0</b></span>' +
      '<span class="game-msg" data-msg></span>') +
      '<div class="g2048-board" data-board></div>' +
      '<p class="muted" style="text-align:center;font-size:12px">Arrow keys or WASD to move</p></div>';

    var board = U.$('[data-board]', win.body);

    function reset() {
      cells = new Array(N * N).fill(0);
      score = 0; over = false; won = false;
      add(); add(); draw();
    }
    function add() {
      var free = [];
      cells.forEach(function (v, i) { if (!v) free.push(i); });
      if (!free.length) return;
      cells[free[Math.floor(Math.random() * free.length)]] = Math.random() < 0.9 ? 2 : 4;
    }
    function slide(row) {
      var a = row.filter(Boolean), out = [];
      for (var i = 0; i < a.length; i++) {
        if (a[i] === a[i + 1]) { out.push(a[i] * 2); score += a[i] * 2; if (a[i] * 2 === 2048) won = true; i++; }
        else out.push(a[i]);
      }
      while (out.length < N) out.push(0);
      return out;
    }
    function move(dir) {
      var before = cells.join(',');
      for (var i = 0; i < N; i++) {
        var line = [];
        for (var j = 0; j < N; j++) {
          line.push(dir === 'l' || dir === 'r' ? cells[i * N + j] : cells[j * N + i]);
        }
        if (dir === 'r' || dir === 'd') line.reverse();
        line = slide(line);
        if (dir === 'r' || dir === 'd') line.reverse();
        for (j = 0; j < N; j++) {
          if (dir === 'l' || dir === 'r') cells[i * N + j] = line[j];
          else cells[j * N + i] = line[j];
        }
      }
      if (cells.join(',') !== before) { add(); check(); draw(); }
    }
    function check() {
      if (cells.indexOf(0) >= 0) return;
      for (var i = 0; i < N; i++) for (var j = 0; j < N; j++) {
        var v = cells[i * N + j];
        if (j < N - 1 && cells[i * N + j + 1] === v) return;
        if (i < N - 1 && cells[(i + 1) * N + j] === v) return;
      }
      over = true;
      best('2048', score);
    }
    function draw() {
      var TINT = { 2: '#eee4da', 4: '#ede0c8', 8: '#f2b179', 16: '#f59563', 32: '#f67c5f', 64: '#f65e3b',
        128: '#edcf72', 256: '#edcc61', 512: '#edc850', 1024: '#edc53f', 2048: '#edc22e' };
      board.innerHTML = cells.map(function (v) {
        return '<div class="g2048-cell" style="background:' + (v ? TINT[v] || '#3c3a32' : 'rgba(238,228,218,.35)') +
          ';color:' + (v > 4 ? '#f9f6f2' : '#776e65') + ';font-size:' + (v > 999 ? 22 : v > 99 ? 26 : 30) + 'px">' +
          (v || '') + '</div>';
      }).join('');
      U.$('[data-score]', win.body).textContent = score;
      U.$('[data-best]', win.body).textContent = best('2048');
      U.$('[data-msg]', win.body).innerHTML = over ? '<b style="color:#e35d5d">Game over</b>'
        : won ? '<b style="color:#edc22e">2048!</b>' : '';
    }

    keys(win, function (e) {
      var k = e.key.toLowerCase();
      var map = { arrowleft: 'l', a: 'l', arrowright: 'r', d: 'r', arrowup: 'u', w: 'u', arrowdown: 'd', s: 'd' };
      if (!map[k]) return false;
      if (!over) move(map[k]);
    });
    win.body.addEventListener('click', function (e) { if (e.target.closest('[data-new]')) reset(); });
    reset();
  }

  // ---------------------------------------------------------------- Snake
  function snake(win) {
    var G = 21, CELL = 18, body, dir, nextDir, food, dead, score, speed;

    win.body.innerHTML = '<div class="game">' + bar(
      '<button class="btn" data-new>New game</button>' +
      '<span class="game-stat">Score <b data-score>0</b></span>' +
      '<span class="game-stat">Best <b data-best>0</b></span>' +
      '<span class="game-msg" data-msg></span>') +
      '<div class="game-canvas-wrap"><canvas width="' + G * CELL + '" height="' + G * CELL + '"></canvas></div>' +
      '<p class="muted" style="text-align:center;font-size:12px">Arrow keys or WASD</p></div>';

    var cv = U.$('canvas', win.body), ctx = cv.getContext('2d');

    function reset() {
      body = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }];
      dir = { x: 1, y: 0 }; nextDir = dir; dead = false; score = 0; speed = 9;
      dropFood(); draw();
    }
    function dropFood() {
      do {
        food = { x: Math.floor(Math.random() * G), y: Math.floor(Math.random() * G) };
      } while (body.some(function (s) { return s.x === food.x && s.y === food.y; }));
    }
    function step() {
      if (dead) return;
      dir = nextDir;
      var head = { x: body[0].x + dir.x, y: body[0].y + dir.y };
      if (head.x < 0 || head.y < 0 || head.x >= G || head.y >= G ||
          body.some(function (s) { return s.x === head.x && s.y === head.y; })) {
        dead = true; best('snake', score); draw(); return;
      }
      body.unshift(head);
      if (head.x === food.x && head.y === food.y) {
        score += 10; speed = Math.min(18, 9 + score / 60); dropFood();
      } else body.pop();
      draw();
    }
    function draw() {
      ctx.fillStyle = '#0d1f14';
      ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.strokeStyle = 'rgba(255,255,255,.04)';
      for (var i = 0; i <= G; i++) {
        ctx.beginPath(); ctx.moveTo(i * CELL, 0); ctx.lineTo(i * CELL, G * CELL); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i * CELL); ctx.lineTo(G * CELL, i * CELL); ctx.stroke();
      }
      ctx.fillStyle = '#f87171';
      ctx.beginPath();
      ctx.arc(food.x * CELL + CELL / 2, food.y * CELL + CELL / 2, CELL / 2 - 2, 0, 7);
      ctx.fill();
      body.forEach(function (s, i) {
        ctx.fillStyle = i === 0 ? '#86efac' : 'rgb(' + (34 + i) + ',' + Math.max(120, 200 - i * 3) + ',' + (94 + i) + ')';
        ctx.fillRect(s.x * CELL + 1, s.y * CELL + 1, CELL - 2, CELL - 2);
      });
      U.$('[data-score]', win.body).textContent = score;
      U.$('[data-best]', win.body).textContent = best('snake');
      U.$('[data-msg]', win.body).innerHTML = dead ? '<b style="color:#e35d5d">Game over</b>' : '';
    }

    var acc = 0;
    loop(win, function () {
      acc++;
      if (acc >= Math.round(60 / speed)) { acc = 0; step(); }
    }, 60);

    keys(win, function (e) {
      var k = e.key.toLowerCase();
      var m = { arrowleft: [-1, 0], a: [-1, 0], arrowright: [1, 0], d: [1, 0],
        arrowup: [0, -1], w: [0, -1], arrowdown: [0, 1], s: [0, 1] };
      if (!m[k]) return false;
      var n = { x: m[k][0], y: m[k][1] };
      if (n.x === -dir.x && n.y === -dir.y) return;
      nextDir = n;
    });
    win.body.addEventListener('click', function (e) { if (e.target.closest('[data-new]')) reset(); });
    reset();
  }

  // --------------------------------------------------------------- Blocks
  function blocks(win) {
    var COLS = 10, ROWS = 20, CELL = 22;
    var SHAPES = {
      I: { c: '#22d3ee', r: [[[0, 1], [1, 1], [2, 1], [3, 1]], [[2, 0], [2, 1], [2, 2], [2, 3]]] },
      O: { c: '#facc15', r: [[[1, 0], [2, 0], [1, 1], [2, 1]]] },
      T: { c: '#a855f7', r: [[[1, 0], [0, 1], [1, 1], [2, 1]], [[1, 0], [1, 1], [2, 1], [1, 2]], [[0, 1], [1, 1], [2, 1], [1, 2]], [[1, 0], [0, 1], [1, 1], [1, 2]]] },
      S: { c: '#4ade80', r: [[[1, 0], [2, 0], [0, 1], [1, 1]], [[1, 0], [1, 1], [2, 1], [2, 2]]] },
      Z: { c: '#f87171', r: [[[0, 0], [1, 0], [1, 1], [2, 1]], [[2, 0], [1, 1], [2, 1], [1, 2]]] },
      J: { c: '#60a5fa', r: [[[0, 0], [0, 1], [1, 1], [2, 1]], [[1, 0], [2, 0], [1, 1], [1, 2]], [[0, 1], [1, 1], [2, 1], [2, 2]], [[1, 0], [1, 1], [0, 2], [1, 2]]] },
      L: { c: '#fb923c', r: [[[2, 0], [0, 1], [1, 1], [2, 1]], [[1, 0], [1, 1], [1, 2], [2, 2]], [[0, 1], [1, 1], [2, 1], [0, 2]], [[0, 0], [1, 0], [1, 1], [1, 2]]] }
    };
    var keysList = Object.keys(SHAPES);
    var field, cur, score, lines, level, over, dropAcc, paused;

    win.body.innerHTML = '<div class="game">' + bar(
      '<button class="btn" data-new>New game</button>' +
      '<span class="game-stat">Score <b data-score>0</b></span>' +
      '<span class="game-stat">Lines <b data-lines>0</b></span>' +
      '<span class="game-stat">Best <b data-best>0</b></span>' +
      '<span class="game-msg" data-msg></span>') +
      '<div class="game-canvas-wrap"><canvas width="' + COLS * CELL + '" height="' + ROWS * CELL + '"></canvas></div>' +
      '<p class="muted" style="text-align:center;font-size:12px">← → move · ↑ rotate · ↓ soft drop · Space hard drop · P pause</p></div>';

    var cv = U.$('canvas', win.body), ctx = cv.getContext('2d');

    function reset() {
      field = [];
      for (var i = 0; i < COLS * ROWS; i++) field.push(null);
      score = 0; lines = 0; level = 1; over = false; dropAcc = 0; paused = false;
      spawn(); draw();
    }
    function spawn() {
      var k = keysList[Math.floor(Math.random() * keysList.length)];
      cur = { k: k, rot: 0, x: 3, y: -1 };
      if (hits(cur)) { over = true; best('blocks', score); }
    }
    function shape(p) { var r = SHAPES[p.k].r; return r[p.rot % r.length]; }
    function hits(p) {
      return shape(p).some(function (c) {
        var x = p.x + c[0], y = p.y + c[1];
        if (x < 0 || x >= COLS || y >= ROWS) return true;
        if (y < 0) return false;
        return !!field[y * COLS + x];
      });
    }
    function lock() {
      shape(cur).forEach(function (c) {
        var x = cur.x + c[0], y = cur.y + c[1];
        if (y >= 0) field[y * COLS + x] = SHAPES[cur.k].c;
      });
      var cleared = 0;
      for (var y = ROWS - 1; y >= 0; y--) {
        var full = true;
        for (var x = 0; x < COLS; x++) if (!field[y * COLS + x]) { full = false; break; }
        if (full) {
          field.splice(y * COLS, COLS);
          for (var i = 0; i < COLS; i++) field.unshift(null);
          cleared++; y++;
        }
      }
      if (cleared) {
        lines += cleared;
        score += [0, 100, 300, 500, 800][cleared] * level;
        level = 1 + Math.floor(lines / 10);
      }
      spawn();
    }
    function move(dx, dy) {
      var p = { k: cur.k, rot: cur.rot, x: cur.x + dx, y: cur.y + dy };
      if (!hits(p)) { cur = p; return true; }
      return false;
    }
    function rotate() {
      var p = { k: cur.k, rot: cur.rot + 1, x: cur.x, y: cur.y };
      if (!hits(p)) { cur = p; return; }
      p.x--; if (!hits(p)) { cur = p; return; }
      p.x += 2; if (!hits(p)) cur = p;
    }
    function draw() {
      ctx.fillStyle = '#101527';
      ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.strokeStyle = 'rgba(255,255,255,.05)';
      for (var i = 0; i <= COLS; i++) { ctx.beginPath(); ctx.moveTo(i * CELL, 0); ctx.lineTo(i * CELL, cv.height); ctx.stroke(); }
      for (i = 0; i <= ROWS; i++) { ctx.beginPath(); ctx.moveTo(0, i * CELL); ctx.lineTo(cv.width, i * CELL); ctx.stroke(); }
      function cell(x, y, c) {
        ctx.fillStyle = c;
        ctx.fillRect(x * CELL + 1, y * CELL + 1, CELL - 2, CELL - 2);
        ctx.fillStyle = 'rgba(255,255,255,.22)';
        ctx.fillRect(x * CELL + 1, y * CELL + 1, CELL - 2, 4);
      }
      field.forEach(function (c, i) { if (c) cell(i % COLS, (i / COLS) | 0, c); });
      if (cur && !over) {
        // ghost
        var g = { k: cur.k, rot: cur.rot, x: cur.x, y: cur.y };
        while (!hits({ k: g.k, rot: g.rot, x: g.x, y: g.y + 1 })) g.y++;
        shape(g).forEach(function (c) {
          if (g.y + c[1] < 0) return;
          ctx.fillStyle = 'rgba(255,255,255,.10)';
          ctx.fillRect((g.x + c[0]) * CELL + 1, (g.y + c[1]) * CELL + 1, CELL - 2, CELL - 2);
        });
        shape(cur).forEach(function (c) {
          if (cur.y + c[1] < 0) return;
          cell(cur.x + c[0], cur.y + c[1], SHAPES[cur.k].c);
        });
      }
      U.$('[data-score]', win.body).textContent = score;
      U.$('[data-lines]', win.body).textContent = lines;
      U.$('[data-best]', win.body).textContent = best('blocks');
      U.$('[data-msg]', win.body).innerHTML = over ? '<b style="color:#e35d5d">Game over</b>'
        : paused ? '<b>Paused</b>' : '';
    }

    loop(win, function () {
      if (over || paused) return;
      dropAcc++;
      if (dropAcc >= Math.max(6, 34 - level * 3)) {
        dropAcc = 0;
        if (!move(0, 1)) lock();
      }
      draw();
    }, 60);

    keys(win, function (e) {
      if (over) return false;
      var k = e.key.toLowerCase();
      if (k === 'p') { paused = !paused; draw(); return; }
      if (paused) return false;
      if (k === 'arrowleft' || k === 'a') move(-1, 0);
      else if (k === 'arrowright' || k === 'd') move(1, 0);
      else if (k === 'arrowdown' || k === 's') { if (move(0, 1)) score++; }
      else if (k === 'arrowup' || k === 'w') rotate();
      else if (k === ' ') { while (move(0, 1)) score += 2; lock(); }
      else return false;
      draw();
    });
    win.body.addEventListener('click', function (e) { if (e.target.closest('[data-new]')) reset(); });
    reset();
  }

  // ----------------------------------------------------------------- Pong
  function pong(win) {
    var W = 640, H = 400;
    var ball, p1, p2, s1, s2, running, difficulty = 0.075;

    win.body.innerHTML = '<div class="game">' + bar(
      '<button class="btn" data-new>New game</button>' +
      '<select class="st-select" data-diff><option value="0.055">Easy</option>' +
      '<option value="0.075" selected>Normal</option><option value="0.105">Hard</option></select>' +
      '<span class="game-stat">You <b data-s1>0</b></span>' +
      '<span class="game-stat">CPU <b data-s2>0</b></span>' +
      '<span class="game-msg" data-msg></span>') +
      '<div class="game-canvas-wrap"><canvas width="' + W + '" height="' + H + '"></canvas></div>' +
      '<p class="muted" style="text-align:center;font-size:12px">Move the mouse over the court, or use ↑ ↓ · first to 7</p></div>';

    var cv = U.$('canvas', win.body), ctx = cv.getContext('2d');

    function reset(full) {
      if (full) { s1 = 0; s2 = 0; }
      p1 = H / 2 - 34; p2 = H / 2 - 34;
      serve(Math.random() < 0.5 ? 1 : -1);
      running = true;
    }
    function serve(dir) {
      ball = { x: W / 2, y: H / 2, vx: dir * 4.4, vy: (Math.random() * 4 - 2) };
    }
    function step() {
      if (!running) return;
      ball.x += ball.vx; ball.y += ball.vy;
      if (ball.y < 6 || ball.y > H - 6) { ball.vy *= -1; ball.y = U.clamp(ball.y, 6, H - 6); }

      // paddles
      if (ball.x < 26 && ball.x > 14 && ball.y > p1 && ball.y < p1 + 68 && ball.vx < 0) {
        ball.vx = Math.abs(ball.vx) * 1.045;
        ball.vy += ((ball.y - (p1 + 34)) / 34) * 2.6;
      }
      if (ball.x > W - 26 && ball.x < W - 14 && ball.y > p2 && ball.y < p2 + 68 && ball.vx > 0) {
        ball.vx = -Math.abs(ball.vx) * 1.045;
        ball.vy += ((ball.y - (p2 + 34)) / 34) * 2.6;
      }
      ball.vy = U.clamp(ball.vy, -7, 7);

      // CPU tracks with a lag so it is beatable
      p2 += ((ball.y - (p2 + 34)) * difficulty);
      p2 = U.clamp(p2, 0, H - 68);

      if (ball.x < 0) { s2++; score(); }
      if (ball.x > W) { s1++; score(); }
      draw();
    }
    function score() {
      if (s1 >= 7 || s2 >= 7) {
        running = false;
        if (s1 >= 7) best('pong', s1 * 100 - s2 * 10);
      } else serve(ball.x < 0 ? -1 : 1);
      U.$('[data-s1]', win.body).textContent = s1;
      U.$('[data-s2]', win.body).textContent = s2;
      U.$('[data-msg]', win.body).innerHTML = running ? ''
        : (s1 >= 7 ? '<b style="color:#4ade80">You win!</b>' : '<b style="color:#e35d5d">CPU wins</b>');
    }
    function draw() {
      ctx.fillStyle = '#0b0f16';
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(255,255,255,.18)';
      ctx.setLineDash([8, 12]);
      ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(14, p1, 10, 68);
      ctx.fillRect(W - 24, p2, 10, 68);
      ctx.fillStyle = '#4ade80';
      ctx.beginPath(); ctx.arc(ball.x, ball.y, 6, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.10)';
      ctx.font = 'bold 64px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(s1, W / 2 - 70, 74);
      ctx.fillText(s2, W / 2 + 70, 74);
    }

    cv.addEventListener('pointermove', function (e) {
      var r = cv.getBoundingClientRect();
      p1 = U.clamp((e.clientY - r.top) * (H / r.height) - 34, 0, H - 68);
    });
    keys(win, function (e) {
      if (e.key === 'ArrowUp') p1 = U.clamp(p1 - 26, 0, H - 68);
      else if (e.key === 'ArrowDown') p1 = U.clamp(p1 + 26, 0, H - 68);
      else return false;
    });
    win.body.addEventListener('click', function (e) {
      if (e.target.closest('[data-new]')) { reset(true); score(); }
    });
    win.body.addEventListener('change', function (e) {
      if (e.target.dataset.diff !== undefined) difficulty = +e.target.value;
    });

    loop(win, step, 60);
    reset(true);
    draw();
  }

  // ------------------------------------------------------------- Solitaire
  function solitaire(win) {
    var SUITS = [{ s: '♠', r: 'b' }, { s: '♥', r: 'r' }, { s: '♦', r: 'r' }, { s: '♣', r: 'b' }];
    var RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    var stock, waste, found, tab, moves, sel;

    win.body.innerHTML = '<div class="game sol">' + bar(
      '<button class="btn" data-new>New deal</button>' +
      '<span class="game-stat">Moves <b data-moves>0</b></span>' +
      '<span class="game-msg" data-msg></span>' +
      '<span class="muted" style="font-size:11.5px">Click a card to move it. Click the deck to deal.</span>') +
      '<div class="sol-top"><div class="sol-stock" data-stock></div><div class="sol-waste" data-waste></div>' +
      '<div class="sol-found" data-found></div></div>' +
      '<div class="sol-tab" data-tab></div></div>';

    function reset() {
      var deck = [];
      SUITS.forEach(function (su, si) {
        RANKS.forEach(function (r, ri) {
          deck.push({ suit: si, rank: ri, red: su.r === 'r', up: false });
        });
      });
      for (var i = deck.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var t = deck[i]; deck[i] = deck[j]; deck[j] = t;
      }
      tab = [[], [], [], [], [], [], []];
      for (var c = 0; c < 7; c++) {
        for (var k = 0; k <= c; k++) {
          var card = deck.pop();
          card.up = k === c;
          tab[c].push(card);
        }
      }
      found = [[], [], [], []];
      waste = [];
      stock = deck;
      moves = 0; sel = null;
      draw();
    }

    function cardHtml(c, extra) {
      if (!c) return '';
      if (!c.up) return '<div class="card back' + (extra || '') + '"></div>';
      return '<div class="card' + (c.red ? ' red' : '') + (extra || '') + '">' +
        '<span>' + RANKS[c.rank] + '</span><b>' + SUITS[c.suit].s + '</b></div>';
    }

    function canFound(c, pile) {
      var top = pile[pile.length - 1];
      if (!top) return c.rank === 0;
      return top.suit === c.suit && c.rank === top.rank + 1;
    }
    function canTab(c, col) {
      var top = col[col.length - 1];
      if (!top) return c.rank === 12;
      return top.up && top.red !== c.red && c.rank === top.rank - 1;
    }

    function autoMove(card, from, idx) {
      // foundations first, then any tableau column
      for (var f = 0; f < 4; f++) {
        if (from.type === 'found' && from.i === f) continue;
        if (canFound(card, found[f]) && (from.type !== 'tab' || idx === from.pile.length - 1)) {
          take(from, idx).forEach(function (c) { found[f].push(c); });
          return true;
        }
      }
      for (var t = 0; t < 7; t++) {
        if (from.type === 'tab' && from.i === t) continue;
        if (canTab(card, tab[t])) {
          take(from, idx).forEach(function (c) { tab[t].push(c); });
          return true;
        }
      }
      return false;
    }

    function take(from, idx) {
      var moved;
      if (from.type === 'waste') moved = [waste.pop()];
      else if (from.type === 'found') moved = [found[from.i].pop()];
      else {
        moved = tab[from.i].slice(idx);
        tab[from.i].length = idx;
        var last = tab[from.i][tab[from.i].length - 1];
        if (last && !last.up) last.up = true;
      }
      moves++;
      return moved;
    }

    function won() { return found.every(function (f) { return f.length === 13; }); }

    function draw() {
      U.$('[data-stock]', win.body).innerHTML = stock.length
        ? '<div class="card back"></div>'
        : '<div class="card empty">↻</div>';
      U.$('[data-waste]', win.body).innerHTML = waste.length
        ? cardHtml(waste[waste.length - 1], sel && sel.type === 'waste' ? ' sel' : '')
        : '<div class="card empty"></div>';
      U.$('[data-found]', win.body).innerHTML = found.map(function (f, i) {
        return '<div class="slot" data-f="' + i + '">' +
          (f.length ? cardHtml(f[f.length - 1]) : '<div class="card empty">' + SUITS[i].s + '</div>') + '</div>';
      }).join('');
      U.$('[data-tab]', win.body).innerHTML = tab.map(function (col, i) {
        return '<div class="sol-col" data-c="' + i + '">' +
          (col.length ? col.map(function (c, j) {
            return '<div class="sol-slot" data-c="' + i + '" data-j="' + j + '" style="top:' + (j * 24) + 'px">' +
              cardHtml(c, sel && sel.type === 'tab' && sel.i === i && sel.j === j ? ' sel' : '') + '</div>';
          }).join('') : '<div class="sol-slot" data-c="' + i + '" data-j="0"><div class="card empty"></div></div>') +
          '</div>';
      }).join('');
      U.$('[data-moves]', win.body).textContent = moves;
      U.$('[data-msg]', win.body).innerHTML = won()
        ? '<b style="color:#4ade80">You won in ' + moves + ' moves!</b>' : '';
      if (won()) best('solitaire', Math.max(1, 500 - moves));
    }

    win.body.addEventListener('click', function (e) {
      if (e.target.closest('[data-new]')) return reset();

      if (e.target.closest('[data-stock]')) {
        if (stock.length) {
          var c = stock.pop(); c.up = true; waste.push(c);
        } else {
          stock = waste.reverse().map(function (x) { x.up = false; return x; });
          waste = [];
        }
        moves++; sel = null; draw();
        return;
      }

      if (e.target.closest('[data-waste]') && waste.length) {
        autoMove(waste[waste.length - 1], { type: 'waste' }, 0);
        sel = null; draw();
        return;
      }

      var slot = e.target.closest('[data-c]');
      if (slot) {
        var i = +slot.dataset.c, j = slot.dataset.j != null ? +slot.dataset.j : tab[i].length - 1;
        var col = tab[i], card = col[j];
        if (!card) {
          // empty column: drop a selected king / waste card
          if (sel && sel.type === 'tab' && canTab(tab[sel.i][sel.j], col)) {
            take({ type: 'tab', i: sel.i, pile: tab[sel.i] }, sel.j).forEach(function (c) { col.push(c); });
          }
          sel = null; draw(); return;
        }
        if (!card.up) {
          if (j === col.length - 1) { card.up = true; moves++; }
          sel = null; draw(); return;
        }
        if (sel && sel.type === 'tab' && !(sel.i === i && sel.j === j)) {
          var moving = tab[sel.i][sel.j];
          if (j === col.length - 1 && canTab(moving, col)) {
            take({ type: 'tab', i: sel.i, pile: tab[sel.i] }, sel.j).forEach(function (c) { col.push(c); });
            sel = null; draw(); return;
          }
        }
        if (autoMove(card, { type: 'tab', i: i, pile: col }, j)) { sel = null; draw(); return; }
        sel = (sel && sel.type === 'tab' && sel.i === i && sel.j === j) ? null : { type: 'tab', i: i, j: j };
        draw();
        return;
      }

      var f = e.target.closest('[data-f]');
      if (f) { sel = null; draw(); }
    });

    reset();
  }

  // ------------------------------------------------------------- catalogue
  var GAMES = {
    minesweeper: {
      name: 'Minesweeper', icon: 'mine', size: 42, cat: 'Puzzle', rating: 4.6,
      desc: 'The classic. Three difficulties, flags, timer and a first-click that is always safe.',
      w: 560, h: 620, mount: minesweeper
    },
    solitaire: {
      name: 'Solitaire', icon: 'cards', size: 58, cat: 'Card', rating: 4.4,
      desc: 'Klondike with click-to-move: tap a card and it flies to the best legal spot.',
      w: 900, h: 680, mount: solitaire
    },
    '2048': {
      name: '2048', icon: 'tiles', size: 28, cat: 'Puzzle', rating: 4.7,
      desc: 'Slide tiles, merge matching numbers, try to reach 2048 without filling the board.',
      w: 480, h: 640, mount: g2048
    },
    snake: {
      name: 'Snake', icon: 'snake', size: 24, cat: 'Arcade', rating: 4.2,
      desc: 'Eat, grow, do not bite yourself. Speeds up as your score climbs.',
      w: 480, h: 620, mount: snake
    },
    blocks: {
      name: 'Blocks', icon: 'blocks', size: 46, cat: 'Arcade', rating: 4.8,
      desc: 'Falling tetrominoes with ghost piece, hard drop, levels and line scoring.',
      w: 420, h: 700, mount: blocks
    },
    pong: {
      name: 'Pong', icon: 'pong', size: 19, cat: 'Arcade', rating: 4.0,
      desc: 'Mouse or keyboard against a CPU that is good, but not that good. First to seven.',
      w: 720, h: 560, mount: pong
    }
  };

  /** Register an installed game as a launchable app. */
  function register(id) {
    var g = GAMES[id];
    if (!g || Emu.apps[id]) return;
    Emu.registerApp({
      // startPinned keeps games in the Start grid without crowding the taskbar.
      id: id, name: g.name, icon: g.icon, desc: g.desc, game: true, startPinned: true,
      launch: function () {
        var win = WM.create({
          appId: id, title: g.name, icon: g.icon,
          width: g.w, height: g.h, minWidth: 360, minHeight: 320
        });
        g.mount(win);
        return win;
      }
    });
  }

  function unregister(id) {
    WM.closeAll(id);
    delete Emu.apps[id];
    Emu.appOrder = Emu.appOrder.filter(function (x) { return x !== id; });
  }

  global.Games = { list: GAMES, register: register, unregister: unregister, best: best };

  // Re-register anything installed in a previous session. Deferred so the
  // built-in apps claim their place in the app order first.
  function restore() { (Emu.state.installed || []).forEach(register); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', restore);
  else restore();
})(window);
