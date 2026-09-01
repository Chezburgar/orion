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
      U.esc(d.topic || 'Practice') + '</title><style>' + css + '</style></head><body>' +
      '<h1>' + U.esc(d.topic || 'Practice') + '</h1>' +
      '<p class="sub">' + U.esc(d.level || '') + ' &middot; ' + (d.items || []).length +
        ' questions &middot; Orion Learn</p>' +
      '<p class="name">Name: ________________________     Date: ____________</p>' +
      '<ol>' + (d.items || []).map(function (it) {
        return '<li><div class="q">' + U.esc(it.q) + '</div><div class="work"></div></li>';
      }).join('') + '</ol>' +
      (d.study && d.study.length
        ? '<div class="study"><b>Before you start</b><ul>' +
          d.study.map(function (s) { return '<li>' + U.esc(s) + '</li>'; }).join('') + '</ul></div>'
        : '') +
      (withKey
        ? '<div class="key"><h2>Answer key</h2><ol>' +
          (d.items || []).map(function (it) { return '<li>' + U.esc(it.a) + '</li>'; }).join('') +
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
      '<h1>' + U.esc(d.topic || 'Marked') + '</h1>' +
      '<p class="sub">Score ' + (Number(d.score) || 0) + '/100 &middot; ' + U.esc(d.grade || '') +
        ' &middot; Orion Learn</p><p>' + U.esc(d.summary || '') + '</p><ol>' +
      (d.marks || []).map(function (m) {
        return '<li><div class="q">' + U.esc(m.q) + '</div>' +
          '<div class="tag ' + (m.ok ? 'ok' : 'no') + '">' + (m.ok ? 'Correct' : 'Not correct') +
          ' &mdash; you wrote: ' + U.esc(m.given || 'blank') +
          (m.ok ? '' : ' &middot; answer: ' + U.esc(m.correct)) + '</div>' +
          (m.note ? '<div class="note">' + U.esc(m.note) + '</div>' : '') + '</li>';
      }).join('') + '</ol>' +
      (d.next && d.next.length
        ? '<h2>Practise next</h2><ul>' +
          d.next.map(function (s) { return '<li>' + U.esc(s) + '</li>'; }).join('') + '</ul>'
        : '') + '</body></html>';
  }

  function safeName(s) {
    return String(s || 'Orion Learn').replace(/[\\/:*?"<>|]+/g, '').trim().slice(0, 48) || 'Orion Learn';
  }

  /** Real file download - a blob and an <a download>, no server round trip. */
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
        '<div class="lr-sheethead"><div><h2>' + U.esc(d.topic || 'Practice') + '</h2>' +
          '<small>' + U.esc(d.level || '') + ' · ' + (d.items || []).length + ' questions</small></div>' +
          '<div class="lr-sheetacts">' +
            '<button class="btn" data-act="print">Print</button>' +
            '<button class="btn" data-act="dlhtml">Download</button>' +
            '<button class="btn" data-act="dldoc">Word</button>' +
            '<button class="btn" data-act="save">Save to Documents</button>' +
            '<button class="btn" data-act="key">Show answer key</button>' +
            '<button class="btn primary" data-act="markthis">Mark my answers</button>' +
          '</div></div>' +
        '<ol class="lr-items">' + (d.items || []).map(function (it) {
          return '<li><div class="lr-q">' + U.esc(it.q) + '</div><div class="lr-work"></div></li>';
        }).join('') + '</ol>' +
        (d.study && d.study.length
          ? '<div class="lr-study"><b>Before you start</b><ul>' +
            d.study.map(function (s) { return '<li>' + U.esc(s) + '</li>'; }).join('') + '</ul></div>' : '') +
        '<div class="lr-key hidden" data-keybox><b>Answer key</b>' +
          '<p class="muted">Check yourself against it after you have attempted the questions.</p>' +
          '<ol>' + (d.items || []).map(function (it) {
            return '<li>' + U.esc(it.a) + '</li>';
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
          '<p>' + U.esc(d.summary || '') + '<br><small class="muted">' + right + ' of ' +
            (d.marks || []).length + ' correct</small></p>' +
          '<button class="btn" data-act="printreport">Print</button>' +
          '<button class="btn" data-act="dlreport">Download</button>' +
        '</div>' +
        '<ol class="lr-marks">' + (d.marks || []).map(function (m) {
          return '<li class="' + (m.ok ? 'ok' : 'no') + '">' +
            '<span class="lr-tick">' + Icons.get(m.ok ? 'check' : 'x') + '</span>' +
            '<div><div class="lr-q">' + U.esc(m.q) + '</div>' +
            '<div class="lr-given">You wrote <b>' + U.esc(m.given || 'nothing') + '</b>' +
              (m.ok ? '' : ' · answer <b>' + U.esc(m.correct) + '</b>') + '</div>' +
            (m.note ? '<div class="lr-note2">' + U.esc(m.note) + '</div>' : '') +
            '</div></li>';
        }).join('') + '</ol>' +
        (d.next && d.next.length
          ? '<h3 class="lr-h">Practise next</h3><ul class="lr-list">' +
            d.next.map(function (s) { return '<li>' + U.esc(s) + '</li>'; }).join('') + '</ul>'
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
      var html = '<h1>' + U.esc(d.topic || 'Practice') + '</h1><ol>' +
        (d.items || []).map(function (it) {
          return '<li><b>' + U.esc(it.q) + '</b><p><br></p></li>';
        }).join('') + '</ol><h2>Answer key</h2><ol>' +
        (d.items || []).map(function (it) { return '<li>' + U.esc(it.a) + '</li>'; }).join('') + '</ol>';
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
      else if (k === 'dlhtml') {
        WM.confirm('Download', 'Include the answer key on the last page?', win)
          .then(function (withKey) {
            download(safeName(result.topic) + '.html', 'text/html;charset=utf-8',
              sheetDoc(result, !!withKey));
            Emu.notify('Orion Learn', 'Sheet downloaded. Open it to print it.', 'orionlearn');
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
        download(safeName(result.topic) + ' marked.html', 'text/html;charset=utf-8', reportDoc(result));
        Emu.notify('Orion Learn', 'Marked sheet downloaded.', 'orionlearn');
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
