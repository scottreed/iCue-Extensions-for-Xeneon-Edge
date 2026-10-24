icueEvents = { onDataUpdated: onProps, onICUEInitialized: onProps };

const $ = (id) => document.getElementById(id);

function prop(name, fallback) {
  if (Object.prototype.hasOwnProperty.call(window, name)) {
    const v = window[name];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  try {
    const v = Function("return typeof " + name + ' !== "undefined" ? ' + name + " : undefined")();
    if (v !== undefined && v !== null && v !== "") return v;
  } catch (e) {}
  return fallback;
}

const S = {
  mock: new URLSearchParams(location.search).has("mock"),
  metas: [],          // guide library (metadata only)
  guide: null,        // the open guide: { meta, arc, manifest, data, idx, gs }
  fullCtl: null,       // the map, tree or image open full screen
  panes: [null, null], // what each pane shows: { type: page|collection|table|credits|map|tree, ref, pin } or null
  ctls: [null, null],  // controllers of open map / tree views, per pane
  hist: [[], []],      // per pane: the last HIST_MAX things it showed, newest last, for the Back button
  split: false,        // two equal panes
  active: 0,           // the pane the list on the left opens things in
  hideDone: false,
  confirm: "",        // guide id waiting for a second tap to delete
  confirmTimer: 0,
  assets: {},         // asset id -> Promise<dataUrl> (cleared when the guide changes)
  msgTimer: 0,
  booted: false,
  libNote: "",
};

/* ---------- properties ---------- */

function applyStyle() {
  const s = document.documentElement.style;
  s.setProperty("--text", prop("textColor", "#FFFFFF"));
  s.setProperty("--accent", prop("accentColor", "#3B82F6"));
  s.setProperty("--bg", prop("backgroundColor", "#000000"));
  const tr = Number(prop("transparency", S.mock ? 100 : 80)); // browser preview (?mock) is opaque so it reads on a white page
  s.setProperty("--bg-opacity", String(Number.isFinite(tr) ? Math.max(0, Math.min(100, tr)) / 100 : 0.8));
}

function onProps() {
  applyStyle();
  $("xlsize").textContent = "This slot is " + innerWidth + " x " + innerHeight + ".";
  if (!S.booted) { S.booted = true; boot(); }
}

/* ---------- small helpers ---------- */

function say(text, ms) {
  const m = $("msg");
  m.textContent = text;
  m.classList.add("show");
  clearTimeout(S.msgTimer);
  S.msgTimer = setTimeout(() => m.classList.remove("show"), ms || 3500);
}
const setView = (v) => { document.body.setAttribute("data-view", v); };
const fmtSize = (n) => (n >= 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB");
const b64ToBytes = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
const isoDay = () => new Date().toISOString().slice(0, 10);

/* ---------- library (storage) ---------- */

async function refreshMetas() {
  const list = await Store.guides.list();
  S.metas = list.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
}

// Validates and stores a guide archive. Throws an Error with .friendly for problems the user should read.
async function installBytes(bytes, opts) {
  const arc = GGP.open(bytes);
  const g = arc.manifest.guide;
  const prev = S.metas.find((m) => m.id === g.id);
  const items = (Array.isArray(arc.data.collections) ? arc.data.collections : []).reduce((n, c) => n + (c && Array.isArray(c.items) ? c.items.length : 0), 0);
  const meta = {
    id: g.id, title: g.title, subtitle: g.subtitle || "", game: (arc.manifest.game && arc.manifest.game.title) || "",
    version: g.version || "", size: arc.size, pages: arc.data.pages.length, items,
    importedAt: Date.now(), enabled: prev ? prev.enabled !== false : true, builtin: !!(opts && opts.builtin),
  };
  const copy = bytes.buffer && bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength ? bytes.buffer.slice(0) : bytes.slice().buffer;
  await Store.guides.put(meta, copy);
  await refreshMetas();
  return { meta, updated: !!prev, prevVersion: prev && prev.version };
}

async function importFile(file) {
  if (!file) return;
  say("Importing " + file.name + " ...", 20000);
  try {
    if (file.size > GGP.LIMITS.zip) throw Object.assign(new Error("This file is larger than 60 MB, the biggest guide the widget accepts."), { friendly: true });
    const bytes = new Uint8Array(await file.arrayBuffer());
    const r = await installBytes(bytes, {});
    S.libNote = "";
    say(r.updated ? "Updated " + r.meta.title + " (" + (r.prevVersion || "?") + " to " + r.meta.version + "). Your progress was kept." : "Added " + r.meta.title, 5000);
    renderLibrary();
  } catch (e) {
    say(e && e.friendly ? e.message : "Could not import that file: " + (e && e.message ? e.message : e), 9000);
  }
}

/* ---------- opening a guide ---------- */

function buildIndex(data) {
  const idx = { pages: {}, collections: {}, maps: {}, trees: {}, tables: {}, items: {}, itemColl: {}, nav: {}, parent: {}, total: 0 };
  const put = (map, arr) => (Array.isArray(arr) ? arr : []).forEach((x) => { if (x && typeof x.id === "string") map[x.id] = x; });
  put(idx.pages, data.pages); put(idx.collections, data.collections); put(idx.maps, data.maps); put(idx.trees, data.trees); put(idx.tables, data.tables);
  Object.keys(idx.collections).forEach((cid) => (Array.isArray(idx.collections[cid].items) ? idx.collections[cid].items : []).forEach((it) => {
    if (it && typeof it.id === "string" && !idx.items[it.id]) { idx.items[it.id] = it; idx.itemColl[it.id] = cid; idx.total++; }
  }));
  const walk = (nodes, parentId, depth) => (Array.isArray(nodes) ? nodes : []).forEach((n) => {
    if (!n || typeof n.id !== "string" || depth > 8) return;
    idx.nav[n.id] = n; idx.parent[n.id] = parentId;
    if (n.type === "group") walk(n.children, n.id, depth + 1);
  });
  walk(data.navigation, "", 1);
  return idx;
}

const isSideType = (t) => t === "map" || t === "tree";
const HIST_MAX = 10;

async function openGuide(id) {
  if (S.fullCtl) closeFull();
  setView("guide");
  S.guide = null;
  S.assets = {};
  S.panes = [null, null]; S.ctls = [null, null];
  $("pane0").querySelector(".pbody").textContent = "Loading guide ...";
  try {
    const buf = await Store.guides.bytes(id);
    if (!buf) throw Object.assign(new Error("That guide is no longer stored. Import it again."), { friendly: true });
    const arc = GGP.open(new Uint8Array(buf));
    const meta = S.metas.find((m) => m.id === id) || { id, title: arc.manifest.guide.title };
    S.guide = { meta, arc, manifest: arc.manifest, data: arc.data, idx: buildIndex(arc.data), gs: Store.guideState(id) };
  } catch (e) {
    S.libNote = (e && e.friendly ? e.message : "This guide could not be opened: " + (e && e.message ? e.message : e));
    Store.state.last = null; Store.save();
    showLibrary();
    return;
  }
  Store.state.last = id; Store.save();
  const ui = S.guide.gs.ui;
  S.hideDone = !!ui.hide;
  S.open = {};
  const valid = (p) => p && typeof p.type === "string" && (p.type === "credits" || (p.ref && findNavFor(p.type, p.ref)));
  const make = (p) => (valid(p) ? { type: p.type, ref: p.ref || "", pin: "" } : null);
  if (Array.isArray(ui.panes)) {
    S.panes = [make(ui.panes[0]), make(ui.panes[1])];
    S.split = !!ui.split;
    S.active = ui.active === 1 ? 1 : 0;
  } else {
    // first visit (or a save from before two panes): reader on the left, first map or skill tree on the right
    const c = ui.cur && !isSideType(ui.cur.type) ? make(ui.cur) : null;
    const sd = make(ui.side) || (firstSide() && make(firstSide()));
    S.panes = [c || (firstTarget() && make(firstTarget())), sd];
    S.split = !!(S.panes[0] && sd);
    S.active = 0;
  }
  if (!S.panes[0] && S.panes[1]) { S.panes = [S.panes[1], null]; S.split = false; }
  if (!S.split) S.active = 0;
  S.hist = [[], []];
  if (Array.isArray(ui.hist)) ui.hist.slice(0, 2).forEach((h, i) => { S.hist[i] = (Array.isArray(h) ? h : []).filter(valid).slice(-HIST_MAX).map((e) => ({ type: e.type, ref: e.ref || "", scroll: Number(e.scroll) || 0 })); });
  revealCurrent();
  renderGuide();
}

function firstOf(pred) {
  let found = null;
  const walk = (nodes) => (Array.isArray(nodes) ? nodes : []).forEach((n) => {
    if (found || !n) return;
    if (n.type === "group") walk(n.children); else if (n.ref && pred(n.type)) found = { type: n.type, ref: n.ref };
  });
  walk(S.guide.data.navigation);
  return found;
}
const firstTarget = () => firstOf((t) => !isSideType(t));
const firstSide = () => firstOf(isSideType);

function findNavFor(type, ref) {
  const nav = S.guide.idx.nav;
  for (const id in nav) if (nav[id].type === type && nav[id].ref === ref) return nav[id];
  // targets reachable by link but not in the navigation (e.g. a page only linked from another page) still open
  const idx = S.guide.idx;
  const map = { page: idx.pages, map: idx.maps, collection: idx.collections, tree: idx.trees, table: idx.tables }[type];
  return map && map[ref] ? { id: "", type, ref } : null;
}
function revealCurrent() {
  S.panes.forEach((c) => {
    const n = c && c.ref && findNavFor(c.type, c.ref);
    let p = n && n.id ? S.guide.idx.parent[n.id] : "";
    while (p) { S.open[p] = true; p = S.guide.idx.parent[p]; }
  });
}

function persist() {
  if (!S.guide) return;
  const ui = S.guide.gs.ui;
  ui.panes = S.panes.map((p) => (p ? { type: p.type, ref: p.ref } : null));
  ui.split = S.split; ui.active = S.active;
  ui.hist = S.hist.map((h) => h.map((e) => ({ type: e.type, ref: e.ref, scroll: e.scroll || 0 })));
  delete ui.cur; delete ui.side;
  Store.save();
}

/* Which pane opens something. A tap in the list opens in the side picked with Open in Left / Right. A link inside a pane opens in
   that same pane, except links to a map or skill tree, which open in the OTHER pane so you keep reading. */
function pickPane(type, from) {
  if (!S.split) return 0;
  if (from === undefined) return S.active;
  return isSideType(type) ? 1 - from : from;
}

function openIn(i, spec) {
  const was = S.panes[i];
  if (was && (was.type !== spec.type || was.ref !== spec.ref)) {
    // remember what this pane showed (and how far it was scrolled) so Back can return to it
    const body = $("pane" + i).querySelector(".pbody");
    S.hist[i].push({ type: was.type, ref: was.ref, scroll: body ? body.scrollTop : 0 });
    if (S.hist[i].length > HIST_MAX) S.hist[i].shift();
  }
  S.panes[i] = spec;
  persist(); revealCurrent();
  if (was && was.type === spec.type && was.ref === spec.ref && S.ctls[i] && S.ctls[i].focusPin && spec.pin) S.ctls[i].focusPin(spec.pin);
  else renderPane(i, false);
  renderNav();
}

function goto(type, ref, pin, from) {
  if (!S.guide || !findNavFor(type, ref)) { say("That link points to something missing from this guide."); return; }
  // reading a page in a single pane and following a map link: open the map beside it
  if (!S.split && from !== undefined && isSideType(type) && S.panes[0] && !isSideType(S.panes[0].type)) { S.split = true; S.panes[1] = null; updateChrome(); }
  openIn(pickPane(type, from), { type, ref, pin: pin || "" });
}

/* Going back to one pane remembers the other pane, so two panes again brings back exactly what was open
   (the pane you were reading stays where it was; if you opened something else meanwhile, that takes its place). */
function setSplit(on) {
  if (on === S.split || !S.guide) return;
  const ui = S.guide.gs.ui;
  const slim = (p) => (p ? { type: p.type, ref: p.ref } : null);
  if (on) {
    const m = ui.splitMem;
    if (m && (m.other === null || (m.other && (m.other.type === "credits" || findNavFor(m.other.type, m.other.ref))))) {
      const k = m.kept === 1 ? 1 : 0, cur = S.panes[0];
      S.panes = [null, null];
      S.panes[k] = cur;
      S.panes[1 - k] = m.other ? { type: m.other.type, ref: m.other.ref || "", pin: "" } : null;
      S.active = m.active === 1 ? 1 : 0;
      const h0 = S.hist[0];
      S.hist = [[], []];
      S.hist[k] = h0;
      S.hist[1 - k] = Array.isArray(m.otherHist) ? m.otherHist : [];
    } else {
      const sd = firstSide(), p0 = S.panes[0];
      S.panes[1] = sd && !(p0 && p0.type === sd.type && p0.ref === sd.ref) ? { type: sd.type, ref: sd.ref, pin: "" } : null;
      S.active = 1;
    }
    S.split = true;
  } else {
    const k = S.active;
    ui.splitMem = { kept: k, other: slim(S.panes[1 - k]), active: S.active, otherHist: S.hist[1 - k].slice() };
    S.hist = [S.hist[k], []];
    S.panes = [S.panes[k] || S.panes[0], null];
    S.split = false; S.active = 0;
  }
  persist(); revealCurrent(); renderPanes(); renderNav();
}

function back(i) {
  const h = S.hist[i];
  let e = null;
  while (h.length && !e) { const c = h.pop(); if (c.type === "credits" || findNavFor(c.type, c.ref)) e = c; }
  if (!e) { updateChrome(); return; }
  S.panes[i] = { type: e.type, ref: e.ref, pin: "" };
  persist(); revealCurrent();
  renderPane(i, false);
  $("pane" + i).querySelector(".pbody").scrollTop = e.scroll || 0;
  renderNav();
}

function activate(i) { if (!S.split) return; S.active = i; persist(); updateChrome(); renderNav(); }

/* ---------- progress ---------- */

const isDone = (id) => !!(S.guide && S.guide.gs.done[id]);
function doneCount() { let n = 0; if (S.guide) for (const id in S.guide.idx.items) if (S.guide.gs.done[id]) n++; return n; }
function toggleItem(id) {
  if (!S.guide || !S.guide.idx.items[id]) return;
  if (S.guide.gs.done[id]) delete S.guide.gs.done[id]; else S.guide.gs.done[id] = 1;
  Store.save();
  renderTop(); renderNav(); refreshPanes();
}

function ctx() {
  const g = S.guide;
  return {
    hideDone: S.hideDone,
    isDone,
    hasItem: (id) => !!g.idx.items[id],
    itemLabel: (id) => (g.idx.items[id] && g.idx.items[id].label) || id,
    title: (type, ref) => { const m = { page: g.idx.pages, map: g.idx.maps, collection: g.idx.collections }[type]; return m && m[ref] ? m[ref].title : ""; },
    alt: (id) => { const a = g.arc.assetInfo(id); return a ? a.alt : ""; },
    asset: (id) => {
      if (!S.assets[id]) {
        const a = g.arc.assetInfo(id);
        S.assets[id] = a ? new Promise((res) => setTimeout(res, 0)).then(() => GGP.toDataUrl(g.arc.read(a.path), a.mime)) : Promise.resolve("");
      }
      return S.assets[id];
    },
  };
}

/* ---------- rendering ---------- */

function renderGuide() { renderTop(); renderPanes(); renderNav(); closeSwitcher(); }

function host() {
  const x = ctx();
  return { gs: S.guide.gs, ctx: x, isDone, hasItem: x.hasItem, itemLabel: x.itemLabel, toggleItem, say, save: () => Store.save(), openFull, closeFull };
}

const KIND = { page: "Page", collection: "Checklist", table: "Table", map: "Map", tree: "Skill tree", credits: "Credits" };
function paneTitle(p) {
  if (!p) return "";
  const g = S.guide.idx, m = { page: g.pages, collection: g.collections, table: g.tables, map: g.maps, tree: g.trees }[p.type];
  return p.type === "credits" ? "" : (m && m[p.ref] && m[p.ref].title) || "";
}

/* the bits around the panes: layout mode, outline on the active pane, header labels */
function updateChrome() {
  document.body.setAttribute("data-split", S.split ? "1" : "0");
  [0, 1].forEach((i) => {
    const el = $("pane" + i), p = S.panes[i];
    el.querySelector(".back").classList.toggle("none", !S.hist[i].length);
    el.querySelector(".pk").textContent = p ? (KIND[p.type] || "") + (paneTitle(p) ? "  \u00B7  " + paneTitle(p) : "") : "Empty";
  });
  $("splitbtn").textContent = S.split ? "One pane" : "Two panes";
}

function renderPanes() {
  updateChrome();
  renderPane(0, false);
  if (S.split) renderPane(1, false); else { $("pane1").querySelector(".pbody").textContent = ""; S.ctls[1] = null; }
}

function renderPane(i, keep) {
  const g = S.guide, body = $("pane" + i).querySelector(".pbody"), p = S.panes[i];
  const top = body.scrollTop;
  body.textContent = "";
  body.classList.remove("sidebody");
  S.ctls[i] = null;
  if (p && isSideType(p.type)) {
    const spec = p.type === "map" ? g.idx.maps[p.ref] : g.idx.trees[p.ref];
    if (!spec) { S.panes[i] = null; renderPane(i, false); return; }
    body.classList.add("sidebody");
    const ctl = p.type === "map" ? Side.map(spec, host(), { pin: p.pin }) : Side.tree(spec, host(), {});
    body.appendChild(ctl.el);
    S.ctls[i] = ctl;
    ctl.mount();
  } else {
    const x = ctx();
    let node;
    if (!p) node = R.el("div", "empty", S.split ? "Nothing here yet. Choose something in the list on the left: it opens in the side chosen above the list." : "Nothing to read here yet. Pick something from the list.");
    else if (p.type === "credits") node = credits();
    else if (p.type === "page" && g.idx.pages[p.ref]) node = R.page(g.idx.pages[p.ref], x);
    else if (p.type === "collection" && g.idx.collections[p.ref]) node = R.collection(g.idx.collections[p.ref], x);
    else if (p.type === "table" && g.idx.tables[p.ref]) node = R.table(g.idx.tables[p.ref], x);
    else node = R.el("div", "empty", "That page is missing from this guide.");
    body.appendChild(node);
    body.scrollTop = keep ? top : 0;
  }
  updateChrome();
}

/* Full screen: a map, skill tree or image takes over the whole widget until closed. It always starts fitted to the screen and does not change the saved map view. */
function openFull(spec) {
  const g = S.guide;
  if (!g || !spec) return;
  let ctl = null;
  if (spec.type === "map" && g.idx.maps[spec.ref]) ctl = Side.map(g.idx.maps[spec.ref], host(), { pin: spec.pin, full: true });
  else if (spec.type === "tree" && g.idx.trees[spec.ref]) ctl = Side.tree(g.idx.trees[spec.ref], host(), { full: true });
  else if (spec.type === "image") ctl = Side.image(spec.asset, spec.caption, host());
  if (!ctl) return;
  closeSwitcher();
  const body = $("full").querySelector(".fbody");
  body.textContent = "";
  body.appendChild(ctl.el);
  S.fullCtl = ctl;
  document.body.setAttribute("data-full", "1");
  ctl.mount();
}
function closeFull() {
  S.fullCtl = null;
  $("full").querySelector(".fbody").textContent = "";
  document.body.setAttribute("data-full", "0");
  if (S.guide) refreshPanes();
}

// after a tick: readers are rebuilt (keeping their scroll), maps and trees just repaint
function refreshPanes() {
  if (S.fullCtl) S.fullCtl.refresh();
  [0, S.split ? 1 : -1].forEach((i) => {
    if (i < 0) return;
    if (S.ctls[i]) S.ctls[i].refresh(); else renderPane(i, true);
  });
}

function renderTop() {
  const g = S.guide;
  if (!g) return;
  $("gt").textContent = g.manifest.guide.title;
  $("gs").textContent = (g.manifest.game && g.manifest.game.title) || g.manifest.guide.subtitle || "";
  const total = g.idx.total, d = doneCount();
  $("pbar").style.display = total ? "" : "none";
  $("ptxt").textContent = total ? d + " / " + total + " done" : "";
  $("pfill").style.setProperty("--p", total ? d / total : 0);
}

function renderNav() {
  const g = S.guide, nav = $("nav");
  const top = nav.scrollTop;
  nav.textContent = "";
  if (S.split) {
    const ch = R.el("div", "chooser");
    ch.appendChild(R.el("span", "cl", "Open in"));
    [0, 1].forEach((i) => ch.appendChild(R.btn("seg" + (S.active === i ? " on" : ""), i ? "Right" : "Left", "activate", { pane: i })));
    nav.appendChild(ch);
  }
  const match = (p, n) => p && n.ref && p.type === n.type && p.ref === n.ref;
  const walk = (nodes, depth) => (Array.isArray(nodes) ? nodes : []).forEach((n) => {
    if (!n || typeof n.id !== "string") return;
    const isGroup = n.type === "group";
    const inActive = !isGroup && match(S.panes[S.active], n);
    const inOther = !isGroup && S.split && match(S.panes[1 - S.active], n);
    const row = R.btn("nrow" + (inActive ? " on" : inOther ? " also" : "") + (isGroup ? " grp" : ""), "", isGroup ? "navgroup" : "goto", isGroup ? { id: n.id } : { type: n.type, ref: n.ref });
    row.style.setProperty("--d", depth - 1);
    row.appendChild(R.icon(isGroup ? "group" : n.type));
    row.appendChild(R.el("span", "t", n.title));
    if (S.split && !isGroup) [0, 1].forEach((i) => { if (match(S.panes[i], n)) row.appendChild(R.el("span", "pb" + (S.active === i ? " on" : ""), i ? "R" : "L")); });
    if (n.type === "collection" && g.idx.collections[n.ref]) {
      const items = Array.isArray(g.idx.collections[n.ref].items) ? g.idx.collections[n.ref].items : [];
      row.appendChild(R.el("span", "cnt", items.filter((i) => i && isDone(i.id)).length + "/" + items.length));
    }
    if (isGroup) row.appendChild(R.el("span", "cnt", S.open[n.id] ? "\u25BE" : "\u25B8"));
    nav.appendChild(row);
    if (isGroup && S.open[n.id]) walk(n.children, depth + 1);
  });
  walk(g.data.navigation, 1);
  nav.scrollTop = top;
}

function credits() {
  const m = S.guide.manifest, cr = m.credits || {};
  const d = R.el("div", "page");
  d.appendChild(R.el("div", "p-title", "Credits"));
  const kv = R.el("div", "b-kv");
  const add = (k, v) => { if (v) { kv.appendChild(R.el("span", "k", k)); kv.appendChild(R.el("span", "v", v)); } };
  add("Guide", m.guide.title + (m.guide.version ? "  v" + m.guide.version : ""));
  add("Game", m.game && m.game.title);
  add("Authors", Array.isArray(cr.authors) ? cr.authors.join(", ") : "");
  add("Licence", cr.license);
  add("Language", m.guide.language);
  if (cr.generator) add("Made with", [cr.generator.tool, cr.generator.version].filter(Boolean).join(" "));
  d.appendChild(kv);
  if (cr.attribution) d.appendChild(R.el("div", "b-text", cr.attribution));
  const src = Array.isArray(cr.sources) ? cr.sources : [];
  if (src.length) {
    d.appendChild(R.el("div", "b-h b-h2", "Sources"));
    src.forEach((s) => { if (s) d.appendChild(R.el("div", "b-text", [s.title, s.licence, s.url, s.retrieved].filter(Boolean).join("  ·  "))); });
  }
  return d;
}

function showLibrary() { if (S.fullCtl) closeFull(); setView("library"); closeSwitcher(); renderLibrary(); }

function renderLibrary() {
  const lib = $("library");
  lib.textContent = "";
  const head = R.el("div", "lib-head");
  head.appendChild(R.el("div", "p-title", "Guides"));
  const right = R.el("div", "lib-actions");
  if (S.guide) right.appendChild(R.btn("chip", "Back to guide", "backtoguide"));
  right.appendChild(R.btn("chip solid", "Import guide", "import"));
  head.appendChild(right);
  lib.appendChild(head);
  if (S.libNote) lib.appendChild(R.el("div", "banner", S.libNote));
  if (Store.degraded) lib.appendChild(R.el("div", "banner", "Saving to disk is unavailable here, so guides are kept only until the widget closes."));

  const on = S.metas.filter((m) => m.enabled !== false), off = S.metas.filter((m) => m.enabled === false);
  if (!S.metas.length) {
    lib.appendChild(R.el("div", "empty", "No guides yet. Tap Import guide and choose a .ggp file. The file chooser opens on this screen, and the guide stays saved in the widget."));
    return;
  }
  const grid = R.el("div", "cards");
  on.forEach((m) => grid.appendChild(card(m, true)));
  lib.appendChild(grid);
  if (off.length) {
    lib.appendChild(R.el("div", "g-head", "Hidden guides"));
    const g2 = R.el("div", "cards");
    off.forEach((m) => g2.appendChild(card(m, false)));
    lib.appendChild(g2);
  }
}

function card(m, enabled) {
  const c = R.el("div", "card" + (enabled ? "" : " off"));
  c.appendChild(R.el("b", "ct", m.title));
  c.appendChild(R.el("div", "cs", [m.game, m.subtitle].filter(Boolean).join("  ·  ") || " "));
  const done = (Store.state.guides[m.id] && Store.state.guides[m.id].done) ? Object.keys(Store.state.guides[m.id].done).length : 0;
  const bar = R.el("div", "c-bar"); const fill = R.el("i"); fill.style.setProperty("--p", m.items ? Math.min(1, done / m.items) : 0); bar.appendChild(fill);
  c.appendChild(bar);
  c.appendChild(R.el("div", "cm", [m.version && "v" + m.version, m.pages + " pages", m.items ? Math.min(done, m.items) + "/" + m.items + " done" : "", fmtSize(m.size || 0)].filter(Boolean).join("  ·  ")));
  const row = R.el("div", "crow");
  if (enabled) row.appendChild(R.btn("chip solid", "Open", "open", { id: m.id }));
  row.appendChild(R.btn("chip", enabled ? "Hide" : "Show", "enable", { id: m.id, on: enabled ? "0" : "1" }));
  row.appendChild(R.btn("chip" + (S.confirm === m.id ? " danger" : ""), S.confirm === m.id ? "Tap again to delete" : "Delete", "delete", { id: m.id }));
  c.appendChild(row);
  return c;
}

function renderSwitcher() {
  const s = $("switcher");
  s.textContent = "";
  const box = R.el("div", "sw-box");
  box.appendChild(R.el("div", "g-head", "Switch guide"));
  S.metas.filter((m) => m.enabled !== false).forEach((m) => {
    const b = R.btn("nrow" + (S.guide && S.guide.meta.id === m.id ? " on" : ""), "", "open", { id: m.id });
    b.appendChild(R.el("span", "t", m.title));
    box.appendChild(b);
  });
  box.appendChild(R.btn("chip", "Manage guides", "library"));
  s.appendChild(box);
}
function openSwitcher() { renderSwitcher(); $("switcher").classList.add("show"); }
function closeSwitcher() { $("switcher").classList.remove("show"); }

/* ---------- events ---------- */

document.addEventListener("click", (ev) => {
  const sw = $("switcher");
  if (sw.classList.contains("show") && ev.target === sw) { closeSwitcher(); return; }
  const t = ev.target.closest("[data-act]");
  if (!t) return;
  const a = t.getAttribute("data-act"), d = (k) => t.getAttribute("data-" + k);
  if (S.fullCtl && a === "goto") closeFull(); // a link inside the full-screen view opens its target in the panes
  switch (a) {
    case "library": showLibrary(); break;
    case "backtoguide": if (S.guide) { setView("guide"); renderGuide(); } break;
    case "switcher": if (sw.classList.contains("show")) closeSwitcher(); else openSwitcher(); break;
    case "credits": if (S.guide) openIn(S.split ? S.active : 0, { type: "credits", ref: "", pin: "" }); break;
    case "split": setSplit(!S.split); break;
    case "back": back(Number(d("pane"))); break;
    case "viewimg": { const cap = t.querySelector("figcaption"); openFull({ type: "image", asset: d("asset"), caption: cap ? cap.textContent : "" }); break; }
    case "activate": activate(Number(d("pane"))); break;
    case "goto": { const slot = t.closest(".slot"); goto(d("type"), d("ref"), d("pin") || "", slot ? Number(slot.getAttribute("data-pane")) : undefined); break; }
    case "navgroup": S.open[d("id")] = !S.open[d("id")]; renderNav(); break;
    case "toggle": toggleItem(d("item")); break;
    case "hidedone": S.hideDone = !S.hideDone; S.guide.gs.ui.hide = S.hideDone; Store.save(); refreshPanes(); break;
    case "import": $("file").click(); break;
    case "open": S.libNote = ""; openGuide(d("id")); break;
    case "enable": {
      const m = S.metas.find((x) => x.id === d("id"));
      if (m) { m.enabled = d("on") === "1"; Store.guides.setMeta(m).then(renderLibrary, () => say("Could not save that change.")); renderLibrary(); }
      break;
    }
    case "delete": {
      const id = d("id");
      clearTimeout(S.confirmTimer);
      if (S.confirm !== id) { S.confirm = id; S.confirmTimer = setTimeout(() => { S.confirm = ""; renderLibrary(); }, 3500); renderLibrary(); break; }
      S.confirm = "";
      deleteGuide(id);
      break;
    }
    default: break;
  }
});

$("file").addEventListener("change", (ev) => { const f = ev.target.files && ev.target.files[0]; ev.target.value = ""; importFile(f); });

async function deleteGuide(id) {
  try {
    await Store.guides.remove(id);
    const m = S.metas.find((x) => x.id === id);
    if (m && m.builtin) Store.state.sampleDone = true;
    delete Store.state.guides[id];
    if (Store.state.last === id) Store.state.last = null;
    if (S.guide && S.guide.meta.id === id) S.guide = null;
    Store.save();
    await refreshMetas();
    say("Deleted. Progress for that guide was removed too.", 4000);
    renderLibrary();
  } catch (e) { say("Could not delete that guide."); }
}

/* ---------- boot ---------- */

async function boot() {
  Store.load(typeof uniqueId !== "undefined" ? uniqueId : "dev");
  if (new URLSearchParams(location.search).has("mem")) Store.useMemory(); // test aid: keep guides in memory only
  Store.onSaveError = () => say("Progress could not be saved (storage is full).", 8000);
  try {
    await refreshMetas();
    if (!S.metas.length && !Store.state.sampleDone) {
      await installBytes(b64ToBytes(window.SAMPLE_GGP_B64), { builtin: true });
      Store.state.sampleDone = true; Store.save();
    }
  } catch (e) { S.libNote = "Storage is not available: " + (e && e.message ? e.message : e); }
  const params = new URLSearchParams(location.search);
  const want = params.get("open") || Store.state.last;
  const m = S.metas.find((x) => x.id === want && x.enabled !== false) || (S.metas.length === 1 && S.metas[0].enabled !== false ? S.metas[0] : null);
  if (m) {
    await openGuide(m.id);
    if (params.get("active")) activate(Number(params.get("active")));
    const cur = params.get("page");
    if (cur) goto(params.get("type") || "page", cur, params.get("pin") || "");
    if (params.get("credits")) openIn(S.split ? S.active : 0, { type: "credits", ref: "", pin: "" });
    if (params.get("full")) { const fs = params.get("full").split(":"); openFull({ type: fs[0], ref: fs[1], asset: fs[1], pin: params.get("pin") || "" }); }
    if (params.get("split") === "1") setSplit(true);
    if (params.get("split") === "0") setSplit(false);
    if (params.get("switcher")) openSwitcher();
  } else showLibrary();
}

// Outside iCUE (browser preview) there are no property events, so start by hand.
if (S.mock || typeof iCUE === "undefined") setTimeout(onProps, 0);
