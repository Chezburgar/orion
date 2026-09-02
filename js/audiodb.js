/* ===== Local audio store =====
   Music files are megabytes each, so they cannot live in localStorage with
   the rest of Orion's state - one song would blow the whole quota. They go in
   IndexedDB as Blobs instead, and only their metadata is ever held in memory.

   This is what makes "play it in Rythem" possible: the game builds its chart
   by analysing decoded audio, so it needs the real bytes. A YouTube track has
   no readable bytes, which is why only files added here can be sent.       */
(function (global) {
  'use strict';

  var DB = 'orion.audio', STORE = 'files', VERSION = 1;
  var dbp = null;

  function open() {
    if (dbp) return dbp;
    dbp = new Promise(function (resolve, reject) {
      if (!global.indexedDB) { reject(new Error('This browser has no IndexedDB.')); return; }
      var req = indexedDB.open(DB, VERSION);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'id' });
        }
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error || new Error('Could not open the audio store.')); };
    });
    return dbp;
  }

  function tx(mode, fn) {
    return open().then(function (db) {
      return new Promise(function (resolve, reject) {
        var t = db.transaction(STORE, mode);
        var store = t.objectStore(STORE);
        var out = fn(store);
        t.oncomplete = function () { resolve(out && out.result !== undefined ? out.result : out); };
        t.onerror = function () { reject(t.error); };
        t.onabort = function () { reject(t.error || new Error('Storage transaction aborted.')); };
      });
    });
  }

  function uid() {
    return 'af-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
  }

  var AudioDB = {
    supported: function () { return !!global.indexedDB; },

    /** Store one File. Resolves with its metadata row. */
    add: function (file) {
      var row = {
        id: uid(),
        name: String(file.name || 'Track').replace(/\.[^.]+$/, ''),
        fileName: String(file.name || 'track.mp3'),
        type: file.type || 'audio/mpeg',
        size: file.size || 0,
        added: Date.now(),
        blob: file
      };
      return tx('readwrite', function (s) { s.put(row); }).then(function () {
        return meta(row);
      });
    },

    /** Metadata for every stored file, newest first. No blobs. */
    list: function () {
      return tx('readonly', function (s) { return s.getAll(); }).then(function (rows) {
        return (rows || []).map(meta).sort(function (a, b) { return b.added - a.added; });
      }).catch(function () { return []; });
    },

    /** The full row, blob included. Only call this when you need the bytes. */
    get: function (id) {
      return tx('readonly', function (s) { return s.get(id); });
    },

    remove: function (id) {
      return tx('readwrite', function (s) { s.delete(id); });
    },

    /** Total bytes held, so the app can show what it is using. */
    usage: function () {
      return AudioDB.list().then(function (rows) {
        return rows.reduce(function (n, r) { return n + (r.size || 0); }, 0);
      });
    }
  };

  function meta(r) {
    return { id: r.id, name: r.name, fileName: r.fileName, type: r.type, size: r.size, added: r.added };
  }

  global.AudioDB = AudioDB;
})(window);
