/* Storage. Guides live in IndexedDB (verified on the Edge: 100 MB fine, survives iCUE restarts).
   Progress and UI state are small and live in localStorage (about 4.75 MB available there). Both belong to this widget instance. */
var Store = (function () {
  var dbp = null;

  function db() {
    if (dbp) return dbp;
    dbp = new Promise(function (resolve, reject) {
      var r = indexedDB.open("gameguide", 1);
      r.onupgradeneeded = function () { r.result.createObjectStore("meta", { keyPath: "id" }); r.result.createObjectStore("files"); };
      r.onsuccess = function () { resolve(r.result); };
      r.onerror = function () { reject(r.error); };
    });
    return dbp;
  }
  function req(r) { return new Promise(function (res, rej) { r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); }; }); }
  function done(tx) { return new Promise(function (res, rej) { tx.oncomplete = res; tx.onerror = function () { rej(tx.error); }; tx.onabort = function () { rej(tx.error || new Error("storage aborted")); }; }); }

  /* If IndexedDB is unavailable (e.g. a plain browser preview), fall back to memory so the widget still works until it is closed. */
  var useMem = false, mem = { meta: {}, files: {} };
  function run(real, fake) {
    if (useMem) return Promise.resolve(fake());
    return db().then(real, function () { useMem = true; Store.degraded = true; return fake(); });
  }
  var guides = {
    list: function () {
      return run(function (d) { return req(d.transaction("meta").objectStore("meta").getAll()); }, function () { return Object.keys(mem.meta).map(function (k) { return mem.meta[k]; }); });
    },
    bytes: function (id) {
      return run(function (d) { return req(d.transaction("files").objectStore("files").get(id)); }, function () { return mem.files[id]; });
    },
    put: function (meta, buffer) {
      return run(function (d) {
        var tx = d.transaction(["meta", "files"], "readwrite");
        tx.objectStore("meta").put(meta);
        tx.objectStore("files").put(buffer, meta.id);
        return done(tx);
      }, function () { mem.meta[meta.id] = meta; mem.files[meta.id] = buffer; });
    },
    setMeta: function (meta) {
      return run(function (d) { var tx = d.transaction("meta", "readwrite"); tx.objectStore("meta").put(meta); return done(tx); }, function () { mem.meta[meta.id] = meta; });
    },
    remove: function (id) {
      return run(function (d) {
        var tx = d.transaction(["meta", "files"], "readwrite");
        tx.objectStore("meta").delete(id);
        tx.objectStore("files").delete(id);
        return done(tx);
      }, function () { delete mem.meta[id]; delete mem.files[id]; });
    },
  };

  /* progress: { last, sampleDone, guides: { <guideId>: { done: {itemId: 1}, ui: { cur, hide } } } } */
  var state = null, key = "gameguide-state", timer = 0, warned = false;
  function load(uid) {
    key = "gameguide-state-" + (uid || "dev");
    try { state = JSON.parse(localStorage.getItem(key) || "null"); } catch (e) { state = null; }
    if (!state || typeof state !== "object" || typeof state.guides !== "object" || !state.guides) state = { last: null, sampleDone: false, guides: {} };
    return state;
  }
  function save() {
    clearTimeout(timer);
    timer = setTimeout(function () {
      try { localStorage.setItem(key, JSON.stringify(state)); warned = false; }
      catch (e) { if (!warned && Store.onSaveError) { warned = true; Store.onSaveError(e); } }
    }, 250);
  }
  function guideState(id) {
    if (!state.guides[id]) state.guides[id] = { done: {}, ui: {} };
    var g = state.guides[id];
    if (!g.done) g.done = {};
    if (!g.ui) g.ui = {};
    return g;
  }

  return { guides: guides, load: load, save: save, guideState: guideState, get state() { return state; }, onSaveError: null, degraded: false, useMemory: function () { useMem = true; } };
})();
