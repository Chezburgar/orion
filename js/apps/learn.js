/* ===== Orion Learn =====
   A study tool, deliberately built as a narrow one.

   There is no prompt box anywhere in this app, and there never should be. The
   only things it sends are the student's own material, a subject picked from a
   list, and two numbers. Every instruction the model sees is written on the
   server, alongside the API key - see the `learn` edge function. That is what
   stops this being a general chatbot with a study-themed skin.

   Two things it does: make NEW practice work modelled on what you are
   studying, and mark work you have already written yourself.               */
(function (global) {
  'use strict';

  var Emu = global.Emu, U = Emu.util, Icons = global.Icons, WM = global.WM, VFS = global.VFS;

  var API = 'https://bgoxonxxutkporbqbtbh.supabase.co/functions/v1/learn';

  var SUBJECTS = ['Maths', 'English', 'Science', 'Biology', 'Chemistry', 'Physics',
    'History', 'Geography', 'Languages', 'Computing', 'Business', 'Other'];

  function post(route, body) {
    return fetch(API + route, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
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

  function launchLearn(args) {
    var win = WM.create({
      appId: 'learn', title: 'Orion Learn', icon: 'orionlearn',
      width: 1020, height: 700, minWidth: 560, minHeight: 420
    });

    var mode = (args && args.mode) || 'practice';
    var busy = false, result = null, error = null, refusal = null;

    win.body.innerHTML =
      '<div class="lr">' +
        '<div class="lr-side">' +
          '<div class="lr-brand">' + Icons.get('orionlearn') + '<span>Orion Learn</span></div>' +
          '<button class="lr-mode" data-mode="practice">' + Icons.get('doc') +
            '<span><b>Practice sheet</b><small>New questions like yours, to print</small></span></button>' +
          '<button class="lr-mode" data-mode="grade">' + Icons.get('check') +
            '<span><b>Mark my work</b><small>A grade and what to fix</small></span></button>' +
          '<div class="lr-note">' + Icons.get('shield') +
            '<span>Orion Learn will not answer or write an assignment for you. ' +
            'It only makes new practice work and marks what you wrote yourself.</span></div>' +
        '</div>' +

        '<div class="lr-main">' +
          '<div class="lr-form">' +
            '<label class="lr-lab" data-srclabel>Your work</label>' +
            '<textarea class="lr-src" data-src spellcheck="false" ' +
              'placeholder="Paste or type your worksheet, notes or answers here."></textarea>' +
            '<div class="lr-row">' +
              '<label class="lr-field">Subject<select data-subject>' +
                SUBJECTS.map(function (s) { return '<option>' + s + '</option>'; }).join('') +
              '</select></label>' +
              '<label class="lr-field lr-only-practice">Questions<select data-count>' +
                [4, 6, 8, 10, 12, 16, 20].map(function (n) {
                  return '<option' + (n === 8 ? ' selected' : '') + '>' + n + '</option>';
                }).join('') +
              '</select></label>' +
              '<label class="lr-field lr-only-practice">Difficulty<select data-level>' +
                '<option value="easier">Easier</option>' +
                '<option value="same" selected>Same as mine</option>' +
                '<option value="harder">Harder</option>' +
              '</select></label>' +
              '<span style="flex:1"></span>' +
              '<button class="btn" data-act="open">Open from Documents</button>' +
              '<button class="btn primary" data-act="go">Make practice sheet</button>' +
            '</div>' +
          '</div>' +
          '<div class="lr-out" data-out></div>' +
        '</div>' +
      '</div>';

    var srcEl = U.$('[data-src]', win.body);
    var out = U.$('[data-out]', win.body);

    function setMode(m) {
      mode = m;
      result = null; error = null; refusal = null;
      U.$$('.lr-mode', win.body).forEach(function (b) {
        b.classList.toggle('active', b.dataset.mode === mode);
      });
      U.$$('.lr-only-practice', win.body).forEach(function (el) {
        el.style.display = mode === 'practice' ? '' : 'none';
      });
      U.$('[data-act="go"]', win.body).textContent =
        mode === 'practice' ? 'Make practice sheet' : 'Mark my work';
      U.$('[data-srclabel]', win.body).textContent =
        mode === 'practice' ? 'Work you are studying' : 'Work you wrote yourself';
      srcEl.placeholder = mode === 'practice'
        ? 'Paste or type the worksheet, questions or notes you are revising from.'
        : 'Paste or type the answers, paragraph or essay you wrote, and it will be marked.';
      render();
    }

    // ------------------------------------------------------------- output
    function esc(s) { return U.esc(s); }

    function practiceMarkup(d) {
      return '<div class="lr-sheet" data-sheet>' +
        '<div class="lr-sheethead"><div><h2>' + esc(d.topic || 'Practice') + '</h2>' +
          '<small>' + esc(d.level || '') + ' · ' + (d.items || []).length + ' questions</small></div>' +
          '<div class="lr-sheetacts">' +
            '<button class="btn" data-act="print">Print</button>' +
            '<button class="btn" data-act="save">Save to Documents</button>' +
            '<button class="btn" data-act="key">Show answer key</button>' +
          '</div></div>' +
        '<ol class="lr-items">' + (d.items || []).map(function (it) {
          return '<li><div class="lr-q">' + esc(it.q) + '</div>' +
            (it.hint ? '<div class="lr-hint">Hint: ' + esc(it.hint) + '</div>' : '') +
            '<div class="lr-work"></div></li>';
        }).join('') + '</ol>' +
        (d.study && d.study.length
          ? '<div class="lr-study"><b>Before you start</b><ul>' +
            d.study.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul></div>' : '') +
        '<div class="lr-key hidden" data-keybox><b>Answer key</b>' +
          '<p class="muted">For the questions above, so you can check yourself after attempting them.</p>' +
          '<ol>' + (d.items || []).map(function (it) {
            return '<li>' + esc(it.a) + '</li>';
          }).join('') + '</ol></div>' +
      '</div>';
    }

    function gradeMarkup(d) {
      var score = Math.max(0, Math.min(100, Number(d.score) || 0));
      var tone = score >= 80 ? 'good' : score >= 60 ? 'ok' : 'low';
      return '<div class="lr-report">' +
        '<div class="lr-scorebar ' + tone + '">' +
          '<div class="lr-score"><b>' + score + '</b><small>/100</small></div>' +
          '<div class="lr-gradeletter">' + esc(d.grade || '') + '</div>' +
          '<p>' + esc(d.summary || '') + '</p>' +
          '<button class="btn" data-act="printreport">Print</button>' +
        '</div>' +
        (d.strengths && d.strengths.length
          ? '<h3 class="lr-h">What worked</h3><ul class="lr-list good">' +
            d.strengths.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul>' : '') +
        (d.improve && d.improve.length
          ? '<h3 class="lr-h">What to fix</h3><div class="lr-improve">' +
            d.improve.map(function (i) {
              return '<div class="lr-imp"><b>' + esc(i.point) + '</b>' +
                '<small>' + esc(i.why) + '</small>' +
                '<span>' + esc(i.fix) + '</span></div>';
            }).join('') + '</div>' : '') +
        (d.next && d.next.length
          ? '<h3 class="lr-h">Practise next</h3><ul class="lr-list">' +
            d.next.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul>' +
            '<button class="btn primary" data-act="practisenext">Make a practice sheet on this</button>' : '') +
      '</div>';
    }

    function render() {
      if (busy) {
        out.innerHTML = '<div class="lr-busy"><i></i><span>' +
          (mode === 'practice' ? 'Writing new questions…' : 'Marking your work…') +
          '</span><small>Checking it is study use first.</small></div>';
        return;
      }
      if (refusal) {
        out.innerHTML = '<div class="lr-refused">' + Icons.get('shield') +
          '<b>Orion Learn cannot do that</b><p>' + esc(refusal) + '</p></div>';
        return;
      }
      if (error) {
        out.innerHTML = '<div class="lr-refused err">' + Icons.get('warning') +
          '<b>That did not work</b><p>' + esc(error) + '</p>' +
          '<button class="btn" data-act="go">Try again</button></div>';
        return;
      }
      if (!result) {
        out.innerHTML = '<div class="lr-empty">' + Icons.get('orionlearn') +
          '<b>' + (mode === 'practice' ? 'Turn your work into practice' : 'Get your work marked') + '</b>' +
          '<span>' + (mode === 'practice'
            ? 'Paste a worksheet or your notes. Orion Learn works out the skill and writes fresh questions on it, with an answer key you can check yourself against.'
            : 'Paste something you have written. You get a score, what worked, and what to revise — never a rewritten version.') +
          '</span></div>';
        return;
      }
      out.innerHTML = result.mode === 'practice' ? practiceMarkup(result) : gradeMarkup(result);
    }

    // -------------------------------------------------------------- print
    /**
     * Print through an isolated iframe. Printing the page itself would put the
     * whole desktop, taskbar and window chrome on the paper.
     */
    function printDoc(title, inner) {
      var f = document.createElement('iframe');
      f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0';
      document.body.appendChild(f);
      var d = f.contentDocument;
      d.open();
      d.write('<!doctype html><html><head><meta charset="utf-8"><title>' + U.esc(title) + '</title>' +
        '<style>' +
        'body{font:13pt/1.65 Georgia,"Times New Roman",serif;color:#111;margin:22mm 18mm;}' +
        'h1{font-size:19pt;margin:0 0 2mm}h2{font-size:13pt;margin:8mm 0 3mm}' +
        '.sub{font-size:10pt;color:#555;margin:0 0 8mm;border-bottom:1px solid #bbb;padding-bottom:3mm}' +
        'ol{padding-left:7mm}li{margin:0 0 7mm;page-break-inside:avoid}' +
        '.q{font-weight:600}.hint{font-size:9.5pt;color:#666;font-style:italic;margin-top:1mm}' +
        '.work{border-bottom:1px solid #ccc;height:16mm;margin-top:3mm}' +
        '.study{background:#f3f3f3;padding:4mm 6mm;border-radius:2mm;font-size:11pt}' +
        '.key{page-break-before:always}.key li{margin:0 0 3mm}' +
        '.imp{margin:0 0 5mm}.imp b{display:block}.imp small{color:#555;display:block;font-size:10pt}' +
        '.name{margin:0 0 8mm;font-size:11pt;color:#444}' +
        '</style></head><body>' + inner + '</body></html>');
      d.close();
      // Give the iframe a tick to lay out before the print dialog opens.
      setTimeout(function () {
        try { f.contentWindow.focus(); f.contentWindow.print(); }
        catch (e) { WM.alert('Orion Learn', 'This browser would not open the print dialog.', win); }
        setTimeout(function () { f.remove(); }, 1000);
      }, 250);
    }

    function printSheet(withKey) {
      var d = result;
      var inner = '<h1>' + U.esc(d.topic || 'Practice') + '</h1>' +
        '<p class="sub">' + U.esc(d.level || '') + ' &middot; ' + (d.items || []).length +
        ' questions &middot; Orion Learn</p>' +
        '<p class="name">Name: ________________________     Date: ____________</p>' +
        '<ol>' + (d.items || []).map(function (it) {
          return '<li><div class="q">' + U.esc(it.q) + '</div>' +
            (it.hint ? '<div class="hint">Hint: ' + U.esc(it.hint) + '</div>' : '') +
            '<div class="work"></div></li>';
        }).join('') + '</ol>' +
        (d.study && d.study.length ? '<div class="study"><b>Before you start</b><ul>' +
          d.study.map(function (s) { return '<li>' + U.esc(s) + '</li>'; }).join('') + '</ul></div>' : '') +
        (withKey ? '<div class="key"><h2>Answer key</h2><ol>' +
          (d.items || []).map(function (it) { return '<li>' + U.esc(it.a) + '</li>'; }).join('') +
          '</ol></div>' : '');
      printDoc(d.topic || 'Practice sheet', inner);
    }

    function printReport() {
      var d = result;
      var inner = '<h1>Feedback</h1>' +
        '<p class="sub">Score ' + (Number(d.score) || 0) + '/100 &middot; ' + U.esc(d.grade || '') +
        ' &middot; Orion Learn</p><p>' + U.esc(d.summary || '') + '</p>' +
        (d.strengths && d.strengths.length ? '<h2>What worked</h2><ul>' +
          d.strengths.map(function (s) { return '<li>' + U.esc(s) + '</li>'; }).join('') + '</ul>' : '') +
        (d.improve && d.improve.length ? '<h2>What to fix</h2>' +
          d.improve.map(function (i) {
            return '<div class="imp"><b>' + U.esc(i.point) + '</b><small>' + U.esc(i.why) +
              '</small>' + U.esc(i.fix) + '</div>';
          }).join('') : '') +
        (d.next && d.next.length ? '<h2>Practise next</h2><ul>' +
          d.next.map(function (s) { return '<li>' + U.esc(s) + '</li>'; }).join('') + '</ul>' : '');
      printDoc('Feedback', inner);
    }

    function saveSheet() {
      var d = result;
      var html = '<h1>' + U.esc(d.topic || 'Practice') + '</h1>' +
        '<p><i>' + U.esc(d.level || '') + '</i></p><ol>' +
        (d.items || []).map(function (it) {
          return '<li><b>' + U.esc(it.q) + '</b>' +
            (it.hint ? '<br><small>Hint: ' + U.esc(it.hint) + '</small>' : '') + '<p><br></p></li>';
        }).join('') + '</ol><h2>Answer key</h2><ol>' +
        (d.items || []).map(function (it) { return '<li>' + U.esc(it.a) + '</li>'; }).join('') + '</ol>';
      var dir = VFS.HOME + '\\Documents';
      if (!VFS.exists(dir)) VFS.mkdir(dir);
      var name = VFS.uniqueName(dir, (d.topic || 'Practice').replace(/[\\/:*?"<>|]/g, '').slice(0, 40), '.odoc');
      VFS.write(dir + '\\' + name, html, 'odoc');
      Emu.notify('Orion Learn', name + ' saved to Documents. Orion Write can open it.', 'orionlearn');
    }

    // ------------------------------------------------------------- submit
    function submit() {
      var text = srcEl.value.trim();
      if (text.length < 20) {
        error = 'Add a bit more of your work first — at least a couple of lines.';
        result = null; refusal = null;
        render();
        return;
      }
      busy = true; error = null; refusal = null; result = null;
      render();

      var body = { text: text, subject: U.$('[data-subject]', win.body).value };
      if (mode === 'practice') {
        body.count = parseInt(U.$('[data-count]', win.body).value, 10);
        body.level = U.$('[data-level]', win.body).value;
      }

      post(mode === 'practice' ? '/practice' : '/grade', body).then(function (d) {
        busy = false;
        if (d.refused) { refusal = d.reason; render(); return; }
        if (d.error) { error = d.error; render(); return; }
        result = d;
        render();
      }).catch(function (e) {
        busy = false;
        error = e.message;
        render();
      });
    }

    function openFromDocs() {
      var dir = VFS.HOME + '\\Documents';
      var list = VFS.exists(dir) ? VFS.list(dir).filter(function (e) {
        return e.node.type === 'file' && /\.(odoc|txt|md)$/i.test(e.name);
      }) : [];
      if (!list.length) {
        WM.alert('Orion Learn', 'No documents in your Documents folder yet.\n' +
          'Write one in Orion Write or Notepad first.', win);
        return;
      }
      global.Shell.picker('Open your work', list.map(function (e) {
        return { label: e.name, sub: 'Documents', icon: 'filetext', value: e.path };
      })).then(function (p) {
        if (!p) return;
        srcEl.value = plain(VFS.read(p) || '');
        srcEl.focus();
      });
    }

    win.body.addEventListener('click', function (e) {
      var m = e.target.closest('[data-mode]');
      if (m) { setMode(m.dataset.mode); return; }

      var a = e.target.closest('[data-act]');
      if (!a) return;
      var k = a.dataset.act;
      if (k === 'go') submit();
      else if (k === 'open') openFromDocs();
      else if (k === 'save') saveSheet();
      else if (k === 'print') {
        WM.confirm('Print', 'Include the answer key on the last page?', win)
          .then(function (withKey) { printSheet(!!withKey); });
      }
      else if (k === 'printreport') printReport();
      else if (k === 'key') {
        var box = U.$('[data-keybox]', win.body);
        box.classList.toggle('hidden');
        a.textContent = box.classList.contains('hidden') ? 'Show answer key' : 'Hide answer key';
      }
      else if (k === 'practisenext') {
        // Feed the feedback's own "practise next" list back in as source.
        srcEl.value = (result.next || []).join('\n');
        setMode('practice');
        submit();
      }
    });

    setMode(mode);
    return win;
  }

  Emu.registerApp({
    id: 'learn', name: 'Orion Learn', icon: 'orionlearn', pinned: true,
    desc: 'Practice sheets and marking', singleton: true,
    launch: launchLearn
  });
})(window);
