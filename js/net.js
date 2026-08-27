/* ===== Emulator network stack =====
   Relays, page fetching, HTML sanitising/rewriting and search providers.
   This is what lets the emulated browser render real pages itself instead
   of handing the URL to an iframe.                                        */
(function (global) {
  'use strict';

  var Emu = global.Emu, U = Emu.util;

  // ------------------------------------------------------------- relays
  // A "relay" is a public CORS proxy: it fetches the page server-side and
  // returns it with permissive CORS headers. It is NOT encryption and it is
  // NOT anonymity - see the disclosure in the VPN app.
  var RELAYS = {
    direct: {
      id: 'direct', name: 'Direct', host: '(no relay)', kind: 'html',
      note: 'Only works for sites that already allow cross-origin reads.',
      url: function (target) { return target; }
    },
    corsproxy: {
      id: 'corsproxy', name: 'Relay A', host: 'corsproxy.io', kind: 'html',
      note: 'Returns the page HTML so the engine can render it.',
      url: function (target) { return 'https://corsproxy.io/?url=' + encodeURIComponent(target); }
    },
    jina: {
      id: 'jina', name: 'Relay B', host: 'r.jina.ai', kind: 'text',
      note: 'Returns a clean text version of the page. Great for reading, no layout.',
      url: function (target) { return 'https://r.jina.ai/' + target; }
    }
  };

  var LOCATIONS = [
    { id: 'auto', city: 'Fastest available', cc: 'AUTO', relay: 'corsproxy', ping: 38 },
    { id: 'ams', city: 'Amsterdam', cc: 'NL', relay: 'corsproxy', ping: 42 },
    { id: 'fra', city: 'Frankfurt', cc: 'DE', relay: 'corsproxy', ping: 47 },
    { id: 'lon', city: 'London', cc: 'UK', relay: 'corsproxy', ping: 51 },
    { id: 'nyc', city: 'New York', cc: 'US', relay: 'corsproxy', ping: 63 },
    { id: 'tor', city: 'Toronto', cc: 'CA', relay: 'jina', ping: 71 },
    { id: 'sfo', city: 'San Francisco', cc: 'US', relay: 'jina', ping: 88 },
    { id: 'sgp', city: 'Singapore', cc: 'SG', relay: 'jina', ping: 164 }
  ];

  var stats = { requests: 0, bytes: 0, blocked: 0, started: 0, errors: 0 };
  var cache = {};

  function relay() {
    var s = Emu.state.net;
    if (!s.connected) return RELAYS.direct;
    return RELAYS[s.relay] || RELAYS.corsproxy;
  }

  function timedFetch(url, ms, asBlob) {
    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, ms || 15000);
    return fetch(url, { signal: ctrl.signal, redirect: 'follow' }).then(function (r) {
      clearTimeout(timer);
      return (asBlob ? r.blob() : r.text()).then(function (body) {
        return { status: r.status, ok: r.ok, body: body };
      });
    }).catch(function (e) {
      clearTimeout(timer);
      throw e;
    });
  }

  var Net = {
    RELAYS: RELAYS,
    LOCATIONS: LOCATIONS,
    stats: stats,

    relay: relay,
    relayFor: function (id) { return RELAYS[id] || RELAYS.direct; },
    isConnected: function () { return !!Emu.state.net.connected; },

    /** Bring the tunnel up. Returns a promise that resolves once a probe succeeds. */
    connect: function (locationId) {
      var s = Emu.state.net;
      var loc = LOCATIONS.filter(function (l) { return l.id === (locationId || s.location); })[0] || LOCATIONS[0];
      s.location = loc.id;
      s.relay = loc.relay;
      s.connected = true;
      s.since = Date.now();
      stats.started = stats.started || Date.now();
      Emu.save();
      Emu.emit('net');
      return Net.probe().then(function (ms) {
        Emu.emit('net');
        return { location: loc, ms: ms };
      });
    },

    disconnect: function () {
      var s = Emu.state.net;
      s.connected = false;
      s.since = 0;
      Emu.save();
      Emu.emit('net');
    },

    /** Round-trip test through the current relay. */
    probe: function () {
      var t0 = performance.now();
      return timedFetch(relay().url('https://example.com'), 12000).then(function (r) {
        var ms = Math.round(performance.now() - t0);
        Emu.state.net.lastPing = ms;
        Emu.state.net.lastProbe = r.ok ? 'ok' : ('http ' + r.status);
        Emu.save();
        return ms;
      }).catch(function () {
        Emu.state.net.lastProbe = 'unreachable';
        Emu.save();
        return -1;
      });
    },

    /** Simulated public address - the relay does not actually hide anything. */
    exitIp: function () {
      var s = Emu.state.net;
      if (!s.connected) return 'your real address';
      var loc = LOCATIONS.filter(function (l) { return l.id === s.location; })[0] || LOCATIONS[0];
      var seed = 0;
      for (var i = 0; i < loc.id.length; i++) seed += loc.id.charCodeAt(i);
      return '185.' + (40 + seed % 60) + '.' + (10 + seed % 200) + '.' + (2 + seed % 250);
    },

    // ------------------------------------------------------------ fetching
    /**
     * Fetch a page for the emulated browser.
     * Resolves with { kind:'html'|'text', body, url, via, status }.
     */
    fetchPage: function (url, opts) {
      opts = opts || {};
      var key = (opts.mode || 'auto') + '|' + url;
      if (!opts.noCache && cache[key] && Date.now() - cache[key].ts < 120000) {
        return Promise.resolve(Object.assign({}, cache[key].res, { cached: true }));
      }

      var chain = [];
      if (opts.mode === 'reader') chain = [RELAYS.jina];
      else if (Emu.state.net.connected) chain = [relay(), relay().id === 'jina' ? RELAYS.corsproxy : RELAYS.jina];
      else chain = [RELAYS.direct, RELAYS.corsproxy];

      var attempt = 0;
      function next(lastErr) {
        if (attempt >= chain.length) {
          stats.errors++;
          return Promise.reject(lastErr || new Error('All relays failed'));
        }
        var r = chain[attempt++];
        stats.requests++;
        return timedFetch(r.url(url), r.id === 'jina' ? 20000 : 15000).then(function (res) {
          if (!res.ok && r.id !== 'direct') throw new Error('HTTP ' + res.status);
          if (!res.body || res.body.length < 8) throw new Error('Empty response');
          stats.bytes += res.body.length;
          var out = {
            kind: r.kind, body: res.body, url: url, via: r, status: res.status,
            bytes: res.body.length
          };
          cache[key] = { ts: Date.now(), res: out };
          return out;
        }).catch(function (e) { return next(e); });
      }
      return next(null);
    },

    /** Route an asset (image, stylesheet) through the active relay. */
    assetUrl: function (url) {
      if (!/^https?:/i.test(url)) return url;
      var r = Emu.state.net.connected ? relay() : RELAYS.corsproxy;
      if (r.id === 'jina') r = RELAYS.corsproxy;   // jina cannot serve binaries
      return r.url(url);
    },

    clearCache: function () { cache = {}; Emu.emit('net'); },
    cacheSize: function () { return Object.keys(cache).length; },

    // -------------------------------------------------------------- search
    /**
     * Real web search. Combines three providers, all of which are reachable
     * from a static page: Wikipedia and DuckDuckGo answer APIs speak CORS
     * directly; full web results come through the reader relay.
     */
    search: function (query) {
      var q = String(query || '').trim();
      var out = { query: q, answer: null, results: [], wiki: [], related: [], errors: [] };
      if (!q) return Promise.resolve(out);

      var jobs = [];

      // 1. DuckDuckGo instant answer (direct CORS)
      jobs.push(timedFetch('https://api.duckduckgo.com/?q=' + encodeURIComponent(q) +
        '&format=json&no_html=1&skip_disambig=1', 9000).then(function (r) {
        var d = JSON.parse(r.body);
        if (d.AbstractText) {
          out.answer = {
            text: d.AbstractText,
            source: d.AbstractSource || 'DuckDuckGo',
            url: d.AbstractURL || '',
            image: d.Image ? (/^https?:/.test(d.Image) ? d.Image : 'https://duckduckgo.com' + d.Image) : ''
          };
        }
        (d.RelatedTopics || []).slice(0, 6).forEach(function (t) {
          if (t.Text && t.FirstURL) out.related.push({ title: t.Text.slice(0, 90), url: t.FirstURL });
        });
      }).catch(function () { out.errors.push('answers'); }));

      // 2. Wikipedia search (direct CORS)
      jobs.push(timedFetch('https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=' +
        encodeURIComponent(q) + '&srlimit=4&format=json&origin=*', 9000).then(function (r) {
        var d = JSON.parse(r.body);
        (((d.query || {}).search) || []).forEach(function (s) {
          out.wiki.push({
            title: s.title,
            url: 'https://en.wikipedia.org/wiki/' + encodeURIComponent(s.title.replace(/ /g, '_')),
            desc: String(s.snippet || '').replace(/<[^>]+>/g, '')
          });
        });
      }).catch(function () { out.errors.push('wikipedia'); }));

      // 3. Full web results, parsed out of the reader relay's markdown
      jobs.push(timedFetch(RELAYS.jina.url('https://html.duckduckgo.com/html/?q=' +
        encodeURIComponent(q)), 20000).then(function (r) {
        out.results = parseDdg(r.body);
      }).catch(function () { out.errors.push('web'); }));

      return Promise.all(jobs).then(function () { return out; });
    },

    suggest: function (q) {
      return timedFetch('https://duckduckgo.com/ac/?q=' + encodeURIComponent(q) + '&type=list', 5000)
        .then(function (r) {
          var d = JSON.parse(r.body);
          return (d[1] || []).slice(0, 6);
        }).catch(function () { return []; });
    },

    // -------------------------------------------------- HTML -> renderable
    /**
     * Sanitise and rewrite a fetched document so the emulator can render it
     * in a shadow root: scripts and frames are dropped, URLs are absolutised
     * and assets are routed through the relay.
     */
    buildDocument: function (html, baseUrl, opts) {
      opts = opts || {};
      var doc;
      try { doc = new DOMParser().parseFromString(html, 'text/html'); }
      catch (e) { return { title: baseUrl, body: '<p>Could not parse this page.</p>', styles: '', links: 0 }; }

      var base = baseUrl;
      var baseTag = doc.querySelector('base[href]');
      if (baseTag) { try { base = new URL(baseTag.getAttribute('href'), baseUrl).href; } catch (e) {} }

      function abs(href) {
        try { return new URL(href, base).href; } catch (e) { return null; }
      }

      // --- strip anything executable or framing
      var killed = 0;
      ['script', 'iframe', 'frame', 'frameset', 'object', 'embed', 'applet', 'noscript',
       'base', 'meta[http-equiv="refresh"]'].forEach(function (sel) {
        U.$$(sel, doc).forEach(function (n) { killed++; n.remove(); });
      });
      stats.blocked += killed;

      // --- inline styles the page shipped with
      var styles = [];
      U.$$('style', doc).forEach(function (s) {
        styles.push(rewriteCss(s.textContent, base));
        s.remove();
      });

      var sheetLinks = [];
      U.$$('link[rel~="stylesheet" i][href]', doc).forEach(function (l) {
        var href = abs(l.getAttribute('href'));
        if (href) sheetLinks.push(href);
        l.remove();
      });

      // --- rewrite every element
      var linkCount = 0;
      U.$$('*', doc.body || doc).forEach(function (el) {
        // event handlers
        Array.prototype.slice.call(el.attributes || []).forEach(function (a) {
          if (/^on/i.test(a.name)) el.removeAttribute(a.name);
        });

        if (el.tagName === 'A') {
          var href = el.getAttribute('href') || '';
          if (/^\s*javascript:/i.test(href)) { el.removeAttribute('href'); return; }
          var full = abs(href);
          if (full) {
            el.setAttribute('data-emu-href', full);
            el.setAttribute('href', full);
            el.setAttribute('title', full);
            linkCount++;
          }
          return;
        }

        if (el.tagName === 'IMG') {
          el.removeAttribute('srcset');
          el.removeAttribute('loading');
          var src = el.getAttribute('src') || el.getAttribute('data-src') || '';
          var fullSrc = abs(src);
          if (!fullSrc || !opts.images) { el.remove(); return; }
          el.setAttribute('src', Net.assetUrl(fullSrc));
          el.setAttribute('loading', 'lazy');
          el.setAttribute('referrerpolicy', 'no-referrer');
          return;
        }

        if (el.tagName === 'SOURCE' || el.tagName === 'VIDEO' || el.tagName === 'AUDIO') { el.remove(); return; }

        if (el.tagName === 'FORM') {
          var action = abs(el.getAttribute('action') || base);
          el.setAttribute('data-emu-form', action || '');
          el.setAttribute('data-emu-method', (el.getAttribute('method') || 'get').toLowerCase());
          el.removeAttribute('action');
          return;
        }

        if (el.getAttribute && el.getAttribute('style')) {
          el.setAttribute('style', rewriteCss(el.getAttribute('style'), base));
        }
      });

      // password fields never go anywhere near a third-party relay
      var creds = U.$$('input[type="password" i]', doc).length;
      if (creds) {
        U.$$('input[type="password" i]', doc).forEach(function (i) {
          i.setAttribute('disabled', 'disabled');
          i.setAttribute('placeholder', 'Sign-in is disabled in the emulated browser');
        });
      }

      return {
        title: (doc.querySelector('title') || {}).textContent || baseUrl,
        body: (doc.body || doc.documentElement).innerHTML,
        styles: styles.join('\n'),
        sheets: sheetLinks.slice(0, 3),
        links: linkCount,
        blocked: killed,
        credentials: creds,
        base: base
      };
    },

    /** Fetch the page's own stylesheets through the relay (best effort). */
    fetchSheets: function (urls) {
      if (!urls || !urls.length) return Promise.resolve('');
      return Promise.all(urls.map(function (u) {
        return timedFetch(Net.assetUrl(u), 9000).then(function (r) {
          stats.bytes += r.body.length;
          return r.body.length > 400000 ? '' : rewriteCss(r.body, u);
        }).catch(function () { return ''; });
      })).then(function (parts) { return parts.join('\n'); });
    },

    /** Turn the reader relay's markdown into simple HTML. */
    readerToHtml: function (text) {
      var lines = String(text).split('\n');
      var meta = { title: '', source: '' };
      var out = [];
      lines.forEach(function (raw) {
        var line = raw;
        if (/^Title:\s*/.test(line)) { meta.title = line.replace(/^Title:\s*/, ''); return; }
        if (/^URL Source:\s*/.test(line)) { meta.source = line.replace(/^URL Source:\s*/, ''); return; }
        if (/^(Published Time|Markdown Content|Warning):/.test(line)) return;

        line = U.esc(line)
          .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
          .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g,
            '<a data-emu-href="$2" href="$2">$1</a>')
          .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');

        var h = line.match(/^(#{1,6})\s+(.*)$/);
        if (h) { out.push('<h' + h[1].length + '>' + h[2] + '</h' + h[1].length + '>'); return; }
        if (/^\s*[-*]\s+/.test(line)) { out.push('<li>' + line.replace(/^\s*[-*]\s+/, '') + '</li>'); return; }
        if (!line.trim()) { out.push(''); return; }
        out.push('<p>' + line + '</p>');
      });
      return { title: meta.title || 'Reader', source: meta.source, html: out.join('\n') };
    }
  };

  function rewriteCss(css, base) {
    return String(css || '').replace(/url\(\s*['"]?([^'")]+)['"]?\s*\)/gi, function (m, u) {
      if (/^(data:|#)/i.test(u)) return m;
      try { return 'url("' + Net.assetUrl(new URL(u, base).href) + '")'; }
      catch (e) { return m; }
    }).replace(/@import[^;]+;/gi, '');
  }

  function parseDdg(md) {
    var out = [], seen = {};
    var re = /##\s+\[([^\]]+)\]\((https:\/\/duckduckgo\.com\/l\/\?uddg=([^&)]+)[^)]*)\)/g;
    var m;
    while ((m = re.exec(md)) && out.length < 12) {
      var title = m[1].replace(/\*\*/g, '').trim();
      var url;
      try { url = decodeURIComponent(m[3]); } catch (e) { continue; }
      if (seen[url] || !/^https?:/.test(url)) continue;
      seen[url] = 1;

      // the snippet is the longest bracketed run before the next result
      var after = md.slice(re.lastIndex, re.lastIndex + 2600);
      var stop = after.indexOf('\n## ');
      if (stop > 0) after = after.slice(0, stop);
      var best = '';
      var sre = /\[([^\]]{25,600})\]\(https:\/\/duckduckgo\.com\/l\//g, sm;
      while ((sm = sre.exec(after))) {
        var t = sm[1].replace(/\*\*/g, '').replace(/!\[[^\]]*\]/g, '').trim();
        if (t.length > best.length) best = t;
      }
      var host = '';
      try { host = new URL(url).hostname.replace(/^www\./, ''); } catch (e) {}
      out.push({ title: title, url: url, host: host, desc: best.slice(0, 300) });
    }
    return out;
  }

  global.Net = Net;
})(window);
