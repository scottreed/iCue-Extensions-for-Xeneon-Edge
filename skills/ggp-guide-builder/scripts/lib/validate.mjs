// Validates a guide (a Map of path -> bytes) against format v1.0: structure, references, assets, limits.
import { createHash } from "node:crypto";
import { LIMITS, ID_RE, SEMVER_RE, IMAGE_TYPES } from "./limits.mjs";
import { badPath } from "./archive.mjs";
import { sniffImage, svgIsUnsafe } from "./images.mjs";

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const isStr = (v) => typeof v === "string";
const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const isInt = (v) => Number.isInteger(v);
const arr = (v) => (Array.isArray(v) ? v : []);

const NAV_TYPES = ["page", "map", "collection", "tree", "table", "group"];
const BLOCKS = ["text", "heading", "steps", "callout", "image", "gallery", "table", "keyValue", "pageLink", "mapLink", "collectionLink", "divider"];
const CALLOUTS = ["tip", "warning", "missable", "boss", "note"];
const COLLECTION_KINDS = ["missables", "collectibles", "quests", "achievements", "steps"];
const COLUMN_TYPES = ["text", "number", "bool"];
const TOP_KEYS = ["navigation", "pages", "collections", "maps", "trees", "tables", "glossary"];

export function validateGuide(files, { strictHashes = true, limits = LIMITS } = {}) {
  const errors = [];
  const warnings = [];
  const err = (code, path, msg) => errors.push({ code, path, msg });
  const warn = (code, path, msg) => warnings.push({ code, path, msg });
  const result = (manifest, data, stats) => ({ ok: errors.length === 0, errors, warnings, manifest, data, stats });

  // ---- load the two JSON files ----
  const load = (name, cap) => {
    const b = files.get(name);
    if (!b) { err("file.missing", name, `${name} is missing`); return null; }
    if (b.length > cap) { err("limit.entry", name, `${name} is ${b.length} bytes, limit ${cap}`); return null; }
    try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(b)); }
    catch (e) { err("json.invalid", name, `${name} is not valid UTF-8 JSON: ${e.message}`); return null; }
  };
  const manifest = load("manifest.json", limits.manifestBytes);
  const data = load("data.json", limits.dataBytes);
  if (!isObj(manifest) || !isObj(data)) {
    if (manifest !== null && !isObj(manifest)) err("type", "manifest.json", "must be a JSON object");
    if (data !== null && !isObj(data)) err("type", "data.json", "must be a JSON object");
    return result(manifest, data, null);
  }

  for (const f of files.keys()) {
    const bad = badPath(f);
    if (bad) err("zip.path", f, `path ${bad}`);
    else if (f !== "manifest.json" && f !== "data.json" && !f.startsWith("assets/")) warn("file.unexpected", f, "file is outside manifest.json, data.json and assets/ and is ignored");
  }
  for (const k of Object.keys(data)) if (!TOP_KEYS.includes(k)) warn("key.unknown", `data.${k}`, "unknown top-level section (ignored)");

  // ---- helpers ----
  const str = (p, v, { req = true, max = limits.stringLen, empty = false } = {}) => {
    if (v === undefined || v === null) { if (req) err("required", p, "is required"); return false; }
    if (!isStr(v)) { err("type", p, "must be a string"); return false; }
    if (!empty && v.trim() === "") { err("empty", p, "must not be empty"); return false; }
    if (v.length > max) { err("limit.string", p, `longer than ${max} characters`); return false; }
    return true;
  };
  const idOf = (p, v) => {
    if (!isStr(v) || !ID_RE.test(v)) { err("id.invalid", p, "id must match [a-z0-9._-]{1,64}"); return false; }
    return true;
  };
  const list = (p, v, { req = false } = {}) => {
    if (v === undefined) { if (req) err("required", p, "is required"); return []; }
    if (!Array.isArray(v)) { err("type", p, "must be an array"); return []; }
    return v;
  };
  const obj = (p, v) => { if (!isObj(v)) { err("type", p, "must be an object"); return false; } return true; };

  const ids = { page: new Map(), map: new Map(), collection: new Map(), tree: new Map(), table: new Map(), nav: new Map(), item: new Map(), asset: new Map() };
  const mapInfo = new Map(); // map id -> { pins:Set, w, h, legend:Set, layers:Set }
  const register = (kind, id, p) => {
    if (!idOf(p + ".id", id)) return;
    if (ids[kind].has(id)) err("id.duplicate", p + ".id", `duplicate ${kind} id "${id}"`);
    else ids[kind].set(id, p);
  };

  // ---- manifest ----
  if (manifest.formatVersion !== "1.0") err("manifest.version", "manifest.formatVersion", 'must be "1.0"');
  const g = manifest.guide;
  if (obj("manifest.guide", g)) {
    if (idOf("manifest.guide.id", g.id) === false) { /* reported */ }
    str("manifest.guide.title", g.title, { max: 120 });
    str("manifest.guide.subtitle", g.subtitle, { req: false, max: 200 });
    if (!isStr(g.version) || !SEMVER_RE.test(g.version)) err("semver", "manifest.guide.version", "must be a semantic version like 1.0.0");
    if (!isStr(g.language) || !/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(g.language)) err("language", "manifest.guide.language", 'must be a language tag like "en" or "en-GB"');
    if (!["all", "progressive"].includes(g.spoilerPolicy)) err("enum", "manifest.guide.spoilerPolicy", 'must be "all" or "progressive"');
    list("manifest.guide.replaces", g.replaces).forEach((r, i) => idOf(`manifest.guide.replaces[${i}]`, r));
  }
  const gm = manifest.game;
  if (obj("manifest.game", gm)) {
    str("manifest.game.title", gm.title, { max: 120 });
    list("manifest.game.platforms", gm.platforms).forEach((s, i) => str(`manifest.game.platforms[${i}]`, s, { max: 40 }));
  }
  const cr = manifest.credits;
  if (obj("manifest.credits", cr)) {
    const authors = list("manifest.credits.authors", cr.authors, { req: true });
    if (authors.length === 0) err("required", "manifest.credits.authors", "needs at least one author");
    authors.forEach((s, i) => str(`manifest.credits.authors[${i}]`, s, { max: 120 }));
    if (str("manifest.credits.license", cr.license, { max: 80 })) { /* free text: SPDX id, "personal-use", ... */ }
    str("manifest.credits.attribution", cr.attribution, { req: false });
    const sources = list("manifest.credits.sources", cr.sources, { req: true });
    if (sources.length === 0) warn("credits.sources", "manifest.credits.sources", "no sources listed; say where the content came from");
    sources.forEach((s, i) => {
      const p = `manifest.credits.sources[${i}]`;
      if (!obj(p, s)) return;
      str(p + ".title", s.title, { max: 200 });
      str(p + ".url", s.url, { req: false, max: 500 });
      str(p + ".licence", s.licence, { req: false, max: 80 });
      str(p + ".retrieved", s.retrieved, { req: false, max: 40 });
    });
  }

  // ---- assets (manifest registry + files) ----
  const assetUsed = new Set();
  const assets = list("manifest.assets", manifest.assets);
  assets.forEach((a0, i) => {
    let a = a0;
    const p = `manifest.assets[${i}]`;
    if (!obj(p, a)) return;
    register("asset", a.id, p);
    if (!isStr(a.path) || badPath(a.path) || !a.path.startsWith("assets/")) { err("asset.path", p + ".path", "must be a safe path under assets/"); return; }
    if (!strictHashes && a.mime === undefined && isStr(a.path)) a = { ...a, mime: Object.keys(IMAGE_TYPES).find((m) => IMAGE_TYPES[m].some((e) => a.path.toLowerCase().endsWith(e))) };
    const types = IMAGE_TYPES[a.mime];
    if (!types) { err("asset.mime", p + ".mime", `must be one of ${Object.keys(IMAGE_TYPES).join(", ")}`); return; }
    if (!types.some((ext) => a.path.toLowerCase().endsWith(ext))) err("asset.ext", p + ".path", `extension does not match ${a.mime}`);
    const b = files.get(a.path);
    if (!b) { err("asset.missing", p + ".path", `${a.path} is not in the guide`); return; }
    if (b.length > limits.imageBytes) err("limit.image", a.path, `${b.length} bytes, limit ${limits.imageBytes}`);
    const info = sniffImage(b, a.mime);
    if (!info.ok) { err("asset.content", a.path, `file content is not a valid ${a.mime}`); return; }
    if (a.mime === "image/svg+xml" && svgIsUnsafe(b)) err("asset.svg", a.path, "SVG contains scripts, event handlers or external entities");
    const w = info.width ?? a.width, h = info.height ?? a.height;
    if (w > limits.imagePx || h > limits.imagePx) err("limit.imagepx", a.path, `${w}x${h}, limit ${limits.imagePx} px per side`);
    const mism = strictHashes ? err : warn;
    const hint = strictHashes ? "" : " (run ggp pack to refresh)";
    if (strictHashes || a.bytes !== undefined) if (a.bytes !== b.length) mism("asset.bytes", p + ".bytes", `manifest says ${a.bytes}, file is ${b.length}${hint}`);
    const sha = createHash("sha256").update(b).digest("hex");
    if (strictHashes || a.sha256 !== undefined) if (a.sha256 !== sha) mism("asset.sha256", p + ".sha256", `hash does not match the file${hint}`);
    if (info.width !== undefined && ((a.width !== undefined && a.width !== info.width) || (a.height !== undefined && a.height !== info.height))) mism("asset.size", p, `width/height do not match the image (${info.width}x${info.height})${hint}`);
    if (!isStr(a.alt) || !a.alt.trim()) warn("asset.alt", p + ".alt", "no alt text");
  });
  const assetDims = (id) => { const a = assets.find((x) => isObj(x) && x.id === id); return a && files.has(a.path) ? sniffImage(files.get(a.path), a.mime) : null; };
  const needAsset = (p, id) => {
    if (!isStr(id) || !ids.asset.has(id)) { err("ref.unresolved", p, `asset "${id}" is not in manifest.assets`); return; }
    assetUsed.add(id);
  };
  if (g && g.cover !== undefined) needAsset("manifest.guide.cover", g.cover);

  // ---- id registration pass (so references can point forward) ----
  arr(data.pages).forEach((x, i) => isObj(x) && register("page", x.id, `data.pages[${i}]`));
  arr(data.collections).forEach((c, i) => {
    if (!isObj(c)) return;
    register("collection", c.id, `data.collections[${i}]`);
    arr(c.items).forEach((it, j) => {
      if (!isObj(it)) return;
      const p = `data.collections[${i}].items[${j}]`;
      if (!idOf(p + ".id", it.id)) return;
      if (ids.item.has(it.id)) err("id.duplicate", p + ".id", `duplicate item id "${it.id}" (item ids must be unique across the whole guide, progress is stored by id)`);
      else ids.item.set(it.id, p);
    });
  });
  arr(data.maps).forEach((m, i) => {
    if (!isObj(m)) return;
    const p = `data.maps[${i}]`;
    register("map", m.id, p);
    const info = { pins: new Set(), w: m.size?.w, h: m.size?.h, legend: new Set(arr(m.legend).map((l) => l?.typeId)), layers: new Set(arr(m.layers).map((l) => l?.id)) };
    arr(m.pins).forEach((pin) => isObj(pin) && isStr(pin.id) && info.pins.add(pin.id));
    if (isStr(m.id)) mapInfo.set(m.id, info);
  });
  arr(data.trees).forEach((x, i) => isObj(x) && register("tree", x.id, `data.trees[${i}]`));
  arr(data.tables).forEach((x, i) => isObj(x) && register("table", x.id, `data.tables[${i}]`));

  // ---- reference helpers ----
  const need = (kind, p, id) => { if (!isStr(id) || !ids[kind].has(id)) err("ref.unresolved", p, `${kind} "${id}" does not exist in this guide`); };
  const LINK = /\[([^\]]*)\]\(([^)]*)\)/g;
  const inline = (p, v, { req = true } = {}) => {
    if (!str(p, v, { req })) return;
    for (const m of v.matchAll(LINK)) {
      const t = m[2].match(/^(page|map|collection|tree|table):([a-z0-9._-]+)$/);
      if (!t) err("link.scheme", p, `link "${m[2].slice(0, 40)}" is not allowed; links may only be page:ID, map:ID, collection:ID, tree:ID or table:ID`);
      else need(t[1], p, t[2]);
    }
    if (/<[a-z!/][^>]*>/i.test(v)) warn("text.html", p, "looks like HTML; guide text is plain text with **bold**, *italic* and [label](page:id) only");
  };

  // ---- pages and blocks ----
  const pages = list("data.pages", data.pages);
  pages.forEach((pg, i) => {
    const p = `data.pages[${i}]`;
    if (!obj(p, pg)) return;
    str(p + ".title", pg.title, { max: 160 });
    inline(p + ".summary", pg.summary, { req: false });
    list(p + ".tags", pg.tags).forEach((t, k) => str(`${p}.tags[${k}]`, t, { max: 40 }));
    str(p + ".area", pg.area, { req: false, max: 80 });
    if (pg.spoilerLevel !== undefined && !(isInt(pg.spoilerLevel) && pg.spoilerLevel >= 0 && pg.spoilerLevel <= 3)) err("range", p + ".spoilerLevel", "must be an integer 0-3");
    if (pg.minutes !== undefined && !(isNum(pg.minutes) && pg.minutes >= 0)) err("range", p + ".minutes", "must be a number >= 0");
    list(p + ".blocks", pg.blocks, { req: true }).forEach((b, k) => block(`${p}.blocks[${k}]`, b));
  });
  function block(p, b) {
    if (!obj(p, b)) return;
    if (!BLOCKS.includes(b.type)) { err("block.type", p + ".type", `must be one of ${BLOCKS.join(", ")}`); return; }
    switch (b.type) {
      case "text": inline(p + ".text", b.text); break;
      case "heading": str(p + ".text", b.text, { max: 160 }); if (b.level !== undefined && ![1, 2, 3].includes(b.level)) err("range", p + ".level", "must be 1, 2 or 3"); break;
      case "steps": {
        const items = list(p + ".items", b.items, { req: true });
        if (items.length === 0) err("empty", p + ".items", "needs at least one step");
        items.forEach((s, k) => { const q = `${p}.items[${k}]`; if (!obj(q, s)) return; inline(q + ".text", s.text); if (s.itemRef !== undefined) need("item", q + ".itemRef", s.itemRef); });
        break;
      }
      case "callout":
        if (!CALLOUTS.includes(b.kind)) err("enum", p + ".kind", `must be one of ${CALLOUTS.join(", ")}`);
        str(p + ".title", b.title, { req: false, max: 120 }); inline(p + ".text", b.text); break;
      case "image": needAsset(p + ".asset", b.asset); str(p + ".caption", b.caption, { req: false, max: 300 }); break;
      case "gallery": {
        const imgs = list(p + ".images", b.images, { req: true });
        imgs.forEach((im, k) => { const q = `${p}.images[${k}]`; if (!obj(q, im)) return; needAsset(q + ".asset", im.asset); str(q + ".caption", im.caption, { req: false, max: 300 }); });
        break;
      }
      case "table": {
        const cols = list(p + ".columns", b.columns, { req: true });
        cols.forEach((c, k) => str(`${p}.columns[${k}]`, c, { max: 80 }));
        list(p + ".rows", b.rows, { req: true }).forEach((r, k) => {
          if (!Array.isArray(r) || r.length !== cols.length) err("table.row", `${p}.rows[${k}]`, `must be an array with ${cols.length} cells`);
          else r.forEach((c, m) => str(`${p}.rows[${k}][${m}]`, c, { empty: true, max: 500 }));
        });
        break;
      }
      case "keyValue":
        list(p + ".items", b.items, { req: true }).forEach((kv, k) => { const q = `${p}.items[${k}]`; if (!obj(q, kv)) return; str(q + ".key", kv.key, { max: 120 }); str(q + ".value", kv.value, { empty: true, max: 500 }); });
        break;
      case "pageLink": need("page", p + ".page", b.page); str(p + ".label", b.label, { req: false, max: 160 }); break;
      case "collectionLink": need("collection", p + ".collection", b.collection); str(p + ".label", b.label, { req: false, max: 160 }); break;
      case "mapLink": {
        need("map", p + ".map", b.map);
        const mi = mapInfo.get(b.map);
        if (mi && b.pin !== undefined && !mi.pins.has(b.pin)) err("ref.unresolved", p + ".pin", `pin "${b.pin}" is not on map "${b.map}"`);
        str(p + ".label", b.label, { req: false, max: 160 });
        break;
      }
      default: break; // divider
    }
  }

  // ---- collections ----
  const collections = list("data.collections", data.collections);
  collections.forEach((c, i) => {
    const p = `data.collections[${i}]`;
    if (!obj(p, c)) return;
    str(p + ".title", c.title, { max: 160 });
    if (!COLLECTION_KINDS.includes(c.kind)) err("enum", p + ".kind", `must be one of ${COLLECTION_KINDS.join(", ")}`);
    str(p + ".groupBy", c.groupBy, { req: false, max: 40 });
    list(p + ".items", c.items, { req: true }).forEach((it, j) => {
      const q = `${p}.items[${j}]`;
      if (!obj(q, it)) return;
      str(q + ".label", it.label, { max: 200 });
      inline(q + ".detail", it.detail, { req: false });
      list(q + ".tags", it.tags).forEach((t, k) => str(`${q}.tags[${k}]`, t, { max: 40 }));
      str(q + ".area", it.area, { req: false, max: 80 });
      for (const f of ["missable", "pointOfNoReturn"]) if (it[f] !== undefined && typeof it[f] !== "boolean") err("type", `${q}.${f}`, "must be true or false");
      list(q + ".requires", it.requires).forEach((r, k) => need("item", `${q}.requires[${k}]`, r));
      if (it.pageRef !== undefined) need("page", q + ".pageRef", it.pageRef);
      list(q + ".pins", it.pins).forEach((pn, k) => {
        const r = `${q}.pins[${k}]`;
        if (!obj(r, pn)) return;
        need("map", r + ".mapId", pn.mapId);
        const mi = mapInfo.get(pn.mapId);
        if (mi && !mi.pins.has(pn.pinId)) err("ref.unresolved", r + ".pinId", `pin "${pn.pinId}" is not on map "${pn.mapId}"`);
      });
      list(q + ".images", it.images).forEach((a, k) => needAsset(`${q}.images[${k}]`, a));
    });
  });

  // ---- maps ----
  const maps = list("data.maps", data.maps);
  maps.forEach((m, i) => {
    const p = `data.maps[${i}]`;
    if (!obj(p, m)) return;
    str(p + ".title", m.title, { max: 160 });
    if (m.coordinateSystem !== "pixel-top-left") err("enum", p + ".coordinateSystem", 'must be "pixel-top-left" (x to the right, y down, in image pixels)');
    if (obj(p + ".image", m.image)) needAsset(p + ".image.asset", m.image.asset);
    const w = m.size?.w, h = m.size?.h;
    if (!isObj(m.size) || !isNum(w) || !isNum(h) || w <= 0 || h <= 0) err("map.size", p + ".size", "needs positive numbers w and h (the image size in pixels)");
    else if (m.image && isStr(m.image.asset)) {
      const d = assetDims(m.image.asset);
      if (d && d.width && (d.width !== w || d.height !== h)) warn("map.size", p + ".size", `size ${w}x${h} differs from the image (${d.width}x${d.height}); pin coordinates use the declared size`);
    }
    const inBounds = (x, y) => isNum(x) && isNum(y) && x >= 0 && y >= 0 && (!isNum(w) || x <= w) && (!isNum(h) || y <= h);
    const layers = new Set();
    list(p + ".layers", m.layers).forEach((l, k) => { const q = `${p}.layers[${k}]`; if (!obj(q, l)) return; if (idOf(q + ".id", l.id)) { if (layers.has(l.id)) err("id.duplicate", q + ".id", "duplicate layer id"); layers.add(l.id); } str(q + ".title", l.title, { max: 80 }); });
    const legend = new Set();
    list(p + ".legend", m.legend).forEach((l, k) => {
      const q = `${p}.legend[${k}]`;
      if (!obj(q, l)) return;
      if (idOf(q + ".typeId", l.typeId)) { if (legend.has(l.typeId)) err("id.duplicate", q + ".typeId", "duplicate legend type"); legend.add(l.typeId); }
      str(q + ".label", l.label, { max: 80 });
      if (!isStr(l.colour) || !/^#[0-9a-fA-F]{6}$/.test(l.colour)) err("colour", q + ".colour", 'must be a #RRGGBB colour');
      str(q + ".icon", l.icon, { req: false, max: 40 });
      if (l.defaultVisible !== undefined && typeof l.defaultVisible !== "boolean") err("type", q + ".defaultVisible", "must be true or false");
    });
    const pins = list(p + ".pins", m.pins);
    if (pins.length > limits.pinsPerMap) err("limit.pins", p + ".pins", `${pins.length} pins, limit ${limits.pinsPerMap}`);
    const pinIds = new Set();
    pins.forEach((pn, k) => {
      const q = `${p}.pins[${k}]`;
      if (!obj(q, pn)) return;
      if (idOf(q + ".id", pn.id)) { if (pinIds.has(pn.id)) err("id.duplicate", q + ".id", `duplicate pin id "${pn.id}"`); pinIds.add(pn.id); }
      if (!inBounds(pn.x, pn.y)) err("pin.bounds", q, `x,y (${pn.x}, ${pn.y}) must be numbers inside the map (0..${w}, 0..${h})`);
      if (!legend.has(pn.type)) err("ref.unresolved", q + ".type", `type "${pn.type}" is not in this map's legend`);
      if (pn.layer !== undefined && !layers.has(pn.layer)) err("ref.unresolved", q + ".layer", `layer "${pn.layer}" is not defined`);
      str(q + ".title", pn.title, { max: 160 });
      inline(q + ".description", pn.description, { req: false });
      if (pn.itemId !== undefined) need("item", q + ".itemId", pn.itemId);
      if (pn.pageRef !== undefined) need("page", q + ".pageRef", pn.pageRef);
    });
    for (const [key, min] of [["routes", 2], ["regions", 3]]) {
      const seenIds = new Set();
      list(`${p}.${key}`, m[key]).forEach((r, k) => {
        const q = `${p}.${key}[${k}]`;
        if (!obj(q, r)) return;
        if (idOf(q + ".id", r.id)) { if (seenIds.has(r.id)) err("id.duplicate", q + ".id", "duplicate id"); seenIds.add(r.id); }
        str(q + ".title", r.title, { max: 160 });
        const pts = list(q + ".points", r.points, { req: true });
        if (pts.length < min) err("map.points", q + ".points", `needs at least ${min} points`);
        pts.forEach((pt, n) => { if (!Array.isArray(pt) || pt.length !== 2 || !inBounds(pt[0], pt[1])) err("pin.bounds", `${q}.points[${n}]`, "must be [x, y] inside the map"); });
        if (r.pageRef !== undefined) need("page", q + ".pageRef", r.pageRef);
      });
    }
    if (m.initialView !== undefined && !(isObj(m.initialView) && isNum(m.initialView.x) && isNum(m.initialView.y) && isNum(m.initialView.zoom) && m.initialView.zoom > 0)) err("map.view", p + ".initialView", "must be { x, y, zoom } with zoom > 0");
  });

  // ---- trees ----
  list("data.trees", data.trees).forEach((t, i) => {
    const p = `data.trees[${i}]`;
    if (!obj(p, t)) return;
    str(p + ".title", t.title, { max: 160 });
    if (t.background !== undefined) needAsset(p + ".background", t.background);
    const nodes = new Map();
    list(p + ".nodes", t.nodes, { req: true }).forEach((n, k) => {
      const q = `${p}.nodes[${k}]`;
      if (!obj(q, n)) return;
      if (idOf(q + ".id", n.id)) { if (nodes.has(n.id)) err("id.duplicate", q + ".id", "duplicate node id"); nodes.set(n.id, n); }
      str(q + ".label", n.label, { max: 120 });
      inline(q + ".description", n.description, { req: false });
      if (!isNum(n.x) || !isNum(n.y)) err("type", q, "x and y must be numbers");
      if (!(isInt(n.maxPoints) && n.maxPoints >= 1 && n.maxPoints <= 99)) err("range", q + ".maxPoints", "must be an integer 1-99");
    });
    list(p + ".nodes", t.nodes).forEach((n, k) => isObj(n) && list(`${p}.nodes[${k}].requires`, n.requires).forEach((r, m) => { if (!nodes.has(r)) err("ref.unresolved", `${p}.nodes[${k}].requires[${m}]`, `node "${r}" does not exist`); }));
    list(p + ".edges", t.edges).forEach((e, k) => { const q = `${p}.edges[${k}]`; if (!obj(q, e)) return; for (const f of ["from", "to"]) if (!nodes.has(e[f])) err("ref.unresolved", `${q}.${f}`, `node "${e[f]}" does not exist`); });
    const pre = new Set();
    list(p + ".presets", t.presets).forEach((pr, k) => {
      const q = `${p}.presets[${k}]`;
      if (!obj(q, pr)) return;
      if (idOf(q + ".id", pr.id)) { if (pre.has(pr.id)) err("id.duplicate", q + ".id", "duplicate preset id"); pre.add(pr.id); }
      str(q + ".title", pr.title, { max: 120 });
      if (!obj(q + ".allocations", pr.allocations)) return;
      for (const [nid, pts] of Object.entries(pr.allocations)) {
        const n = nodes.get(nid);
        if (!n) err("ref.unresolved", `${q}.allocations.${nid}`, `node "${nid}" does not exist`);
        else if (!isInt(pts) || pts < 0 || pts > n.maxPoints) err("range", `${q}.allocations.${nid}`, `must be an integer 0-${n.maxPoints}`);
      }
    });
  });

  // ---- tables ----
  list("data.tables", data.tables).forEach((t, i) => {
    const p = `data.tables[${i}]`;
    if (!obj(p, t)) return;
    str(p + ".title", t.title, { max: 160 });
    const cols = list(p + ".columns", t.columns, { req: true });
    const colIds = new Set();
    cols.forEach((c, k) => {
      const q = `${p}.columns[${k}]`;
      if (!obj(q, c)) return;
      if (idOf(q + ".id", c.id)) { if (colIds.has(c.id)) err("id.duplicate", q + ".id", "duplicate column id"); colIds.add(c.id); }
      str(q + ".label", c.label, { max: 80 });
      if (c.type !== undefined && !COLUMN_TYPES.includes(c.type)) err("enum", q + ".type", `must be one of ${COLUMN_TYPES.join(", ")}`);
    });
    list(p + ".rows", t.rows, { req: true }).forEach((r, k) => {
      const q = `${p}.rows[${k}]`;
      if (!Array.isArray(r) || r.length !== cols.length) { err("table.row", q, `must be an array with ${cols.length} cells`); return; }
      r.forEach((cell, m) => {
        const type = cols[m]?.type || "text";
        const ok = type === "number" ? isNum(cell) : type === "bool" ? typeof cell === "boolean" : isStr(cell) && cell.length <= 500;
        if (!ok) err("table.cell", `${q}[${m}]`, `must be a ${type}`);
      });
    });
  });

  // ---- glossary ----
  list("data.glossary", data.glossary).forEach((e, i) => {
    const p = `data.glossary[${i}]`;
    if (!obj(p, e)) return;
    str(p + ".term", e.term, { max: 80 });
    inline(p + ".definition", e.definition);
    list(p + ".pageRefs", e.pageRefs).forEach((r, k) => need("page", `${p}.pageRefs[${k}]`, r));
  });

  // ---- navigation ----
  const reachable = new Set();
  const nav = list("data.navigation", data.navigation, { req: true });
  if (nav.length === 0) err("empty", "data.navigation", "needs at least one entry");
  const walk = (nodes, p, depth) => {
    if (depth > limits.navDepth) { err("limit.depth", p, `navigation is deeper than ${limits.navDepth} levels`); return; }
    list(p, nodes).forEach((n, i) => {
      const q = `${p}[${i}]`;
      if (!obj(q, n)) return;
      register("nav", n.id, q);
      str(q + ".title", n.title, { max: 120 });
      str(q + ".icon", n.icon, { req: false, max: 40 });
      if (!NAV_TYPES.includes(n.type)) { err("enum", q + ".type", `must be one of ${NAV_TYPES.join(", ")}`); return; }
      if (n.type === "group") { if (n.ref !== undefined) err("nav.ref", q + ".ref", "a group has no ref"); walk(n.children, q + ".children", depth + 1); }
      else {
        need(n.type, q + ".ref", n.ref);
        if (n.type === "page" && isStr(n.ref)) reachable.add(n.ref);
        if (n.children !== undefined) err("nav.children", q + ".children", "only groups can have children");
      }
    });
  };
  walk(nav, "data.navigation", 1);
  // pages linked from elsewhere also count as reachable
  const noteLinks = (v) => { if (isStr(v)) for (const m of v.matchAll(LINK)) { const t = m[2].match(/^page:(.+)$/); if (t) reachable.add(t[1]); } };
  pages.forEach((pg) => isObj(pg) && arr(pg.blocks).forEach((b) => { if (isObj(b)) { if (b.type === "pageLink") reachable.add(b.page); noteLinks(b.text); arr(b.items).forEach((s) => noteLinks(s?.text)); } }));
  collections.forEach((c) => isObj(c) && arr(c.items).forEach((it) => isObj(it) && it.pageRef && reachable.add(it.pageRef)));
  for (const [id, p] of ids.page) if (!reachable.has(id)) warn("page.unreachable", p, `page "${id}" is not in the navigation and no other page links to it`);
  for (const [id, p] of ids.asset) if (!assetUsed.has(id)) warn("asset.unused", p, `asset "${id}" is never used`);
  for (const [kind, label] of [["map", "maps"], ["collection", "collections"], ["tree", "trees"], ["table", "tables"]]) {
    const inNav = new Set();
    const collect = (ns) => arr(ns).forEach((n) => { if (isObj(n)) { if (n.type === kind) inNav.add(n.ref); collect(n.children); } });
    collect(nav);
    for (const [id, p] of ids[kind]) if (!inNav.has(id)) warn(`${kind}.unreachable`, p, `${label.slice(0, -1)} "${id}" is not in the navigation`);
  }

  const stats = {
    pages: pages.length, collections: collections.length,
    items: collections.reduce((n, c) => n + arr(c?.items).length, 0),
    maps: maps.length, pins: maps.reduce((n, m) => n + arr(m?.pins).length, 0),
    trees: arr(data.trees).length, tables: arr(data.tables).length, glossary: arr(data.glossary).length, assets: assets.length,
  };
  if (isObj(manifest.stats)) for (const [k, v] of Object.entries(stats)) if (manifest.stats[k] !== v) (strictHashes ? err : warn)("stats.mismatch", `manifest.stats.${k}`, `says ${manifest.stats[k]}, guide has ${v}` + (strictHashes ? "" : " (run ggp pack to refresh)"));
  return result(manifest, data, stats);
}
