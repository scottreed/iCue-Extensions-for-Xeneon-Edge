// Assembles manifest.json and data.json for the Black Flag Resynced guide from research/*.json (notes written in the guide author's own words).
// Re-run after any research file changes: node guides/black-flag-resynced/build.mjs
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const rd = (f) => { const p = join(dir, "research", f); if (!existsSync(p)) return null; try { return JSON.parse(readFileSync(p, "utf8")); } catch (e) { console.error("BAD JSON", f, e.message); return null; } };
const slug = (s, n = 40) => String(s).toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, n).replace(/-+$/g, "");
const num = (i) => String(i + 1).padStart(2, "0");
// guide text is plain: no HTML, no markdown links to anywhere but guide targets
const clean = (s, max = 1500) => String(s == null ? "" : s).replace(/[<>]/g, "").replace(/\]\(/g, "] (").replace(/\*/g, "").replace(/\s+/g, " ").trim().slice(0, max);

/* ---------------- story ---------------- */
const seqs = [
  { t: "Edward Takes the Robes", s: "Edward takes the identity of a dead Assassin.", m: ["Edward Kenway"] },
  { t: "Edward Meets the Templars", s: "A visit to Havana ends with Edward captured, then escaping on a Spanish treasure fleet.", m: ["Lively Havana", "...And My Sugar?", "Mister Walpole, I Presume?", "A Man They Call the Sage", "Claiming What's Due", "The Treasure Fleet"] },
  { t: "Building the Jackdaw", s: "Edward builds up his ship, crew and reputation, and takes control of Great Inagua.", m: ["This Tyro Captain", "Now Hiring", "Prizes and Plunder", "Raise the Black Flag", "Sugarcane and Its Yields", "Proper Defenses", "A Single Madman"] },
  { t: "Tulum and the Sage", s: "Edward arrives at Tulum and learns more about the Sage and the Observatory.", m: ["This Old Cove", "Nothing Is True...", "The Sage's Buried Secret", "Overrun and Outnumbered"] },
  { t: "Mary Read Reveals Herself", s: "Edward chases the Sage through Torres and Prins, and Kidd's true identity comes out (the sequence title says it is Mary Read).", m: ["The Forts", "Traveling Salesman", "Unmanned"] },
  { t: "Blackbeard's Last Campaign", s: "Blackbeard and Edward work together to get medicine for Nassau.", m: ["Diving for Medicines", "Devil's Advocate", "The Siege of Charles-Towne"] },
  { t: "Nassau Falls", s: "Woodes Rogers arrives with a pardon and military force, and the pirate settlement of Nassau collapses.", m: ["We Demand a Parlay", "The Gunpowder Plot", "Commodore Eighty-Sixed", "The Fireship"] },
  { t: "Blackbeard, Rackham, and Vane", s: "Blackbeard dies, Rackham mutinies, and Vane's alliance with Edward ends.", m: ["Do Not Go Gently", "Vainglorious Bastards", "Marooned"] },
  { t: "Finding Roberts", s: "Edward finds Roberts at Principe and the two become partners.", m: ["Imagine My Surprise", "Trust Is Earned"] },
  { t: "The Observatory", s: "Edward reaches the Observatory, then Roberts betrays him.", m: ["Black Bart's Gambit", "Murder and Mayhem", "The Observatory"] },
  { t: "Edward Changes Course", s: "Edward rescues Mary Read, who dies, and he starts to change his path.", m: ["To Suffer Without Dying", "Delirium", "...Everything Is Permitted"] },
  { t: "The Final Hunt", s: "Edward goes after his remaining targets, including Rogers, Roberts and Torres, and ends the Observatory conflict.", m: ["A Governor No Longer", "Royal Misfortune", "Tainted Blood", "Ever a Splinter"] },
];

const pages = [], navWalk = [], items = [], gaps = [], sources = new Map();
const addSource = (url, title) => { if (!url) return; const u = Array.isArray(url) ? url : [url]; for (const x of u) if (x && !sources.has(x)) sources.set(x, title || x); };
const titleFromUrl = (u, who) => who + ": " + String(u).replace(/^https?:\/\/[^/]+\//, "").replace(/\/$/, "").split("/").pop().replace(/assassins-creed-4-black-flag-resynced-|assassins-creed-black-flag-resynced-/g, "").replace(/-/g, " ");

const memPageIds = [];
seqs.forEach((q, i) => memPageIds.push(q.m.map((n) => `s${num(i)}-${slug(n, 40)}`)));
const flat = memPageIds.flat();
const flatTitles = seqs.flatMap((q) => q.m);

seqs.forEach((q, i) => {
  const r = rd(`seq-${num(i)}.json`);
  if (r) addSource(r.source, titleFromUrl(r.source, "ConsolePulse"));
  const children = [];
  // overview page of the sequence
  const ovId = `seq-${num(i)}`;
  const ovBlocks = [
    { type: "text", text: clean(q.s) },
    { type: "heading", text: q.m.length === 1 ? "Memory" : "Memories, in order", level: 2 },
    ...q.m.map((n, k) => ({ type: "pageLink", page: memPageIds[i][k], label: `${k + 1}. ${n}` })),
  ];
  pages.push({ id: ovId, title: `Sequence ${i + 1}: ${q.t}`, summary: clean(q.s), tags: ["walkthrough"], area: `Sequence ${i + 1}`, spoilerLevel: 2, minutes: 1, blocks: ovBlocks });
  children.push({ id: "nav-" + ovId, title: "Overview", type: "page", ref: ovId });
  q.m.forEach((name, k) => {
    const mem = r && r.memories && (r.memories[k] || r.memories.find((x) => slug(x.name) === slug(name)));
    const pid = memPageIds[i][k], itemId = `mem-${num(i)}-${slug(name, 40)}`;
    const blocks = [];
    if (mem) {
      if (mem.objective) blocks.push({ type: "text", text: clean(mem.objective) });
      if ((mem.steps || []).length) { blocks.push({ type: "heading", text: "Steps", level: 2 }); blocks.push({ type: "steps", items: mem.steps.map((t) => ({ text: clean(t, 600) })) }); }
      if ((mem.optional || []).length) { blocks.push({ type: "heading", text: "Optional extras", level: 2 }); blocks.push({ type: "steps", items: mem.optional.map((t) => ({ text: clean(t, 600) })) }); }
      for (const t of mem.tips || []) blocks.push({ type: "callout", kind: "tip", text: clean(t, 600) });
      (mem.gaps || []).forEach((g) => gaps.push({ where: `${name} (Sequence ${i + 1})`, text: clean(g, 400) }));
    } else blocks.push({ type: "text", text: "Step-by-step notes for this memory are not available in this guide." });
    blocks.push({ type: "heading", text: "Finished?", level: 2 });
    blocks.push({ type: "steps", items: [{ text: "Memory complete", itemRef: itemId }] });
    const idx = flat.indexOf(pid);
    if (idx > 0) blocks.push({ type: "pageLink", page: flat[idx - 1], label: "Previous: " + flatTitles[idx - 1] });
    if (idx < flat.length - 1) blocks.push({ type: "pageLink", page: flat[idx + 1], label: "Next: " + flatTitles[idx + 1] });
    pages.push({ id: pid, title: name, summary: mem && mem.objective ? clean(mem.objective, 300) : `Sequence ${i + 1}, memory ${k + 1}`, tags: ["walkthrough"], area: `Sequence ${i + 1}`, spoilerLevel: 2, minutes: 3, blocks });
    items.push({ id: itemId, label: name, area: `Sequence ${i + 1}: ${q.t}`, pageRef: pid });
    children.push({ id: "nav-" + pid, title: `${k + 1}. ${name}`, type: "page", ref: pid });
  });
  navWalk.push({ id: `nav-grp-${num(i)}`, title: `${i + 1}. ${q.t}`, type: "group", children });
});

/* Sources write regions in many shapes ("Zone - Place", "Place (x, y)", loose text). Reduce each to one canonical area label:
   a known place if one is named, else the map region ("<Zone> region"), else a catch-all. */
const PLACES = ["Cape Bonavista", "Havana", "Matanzas", "Florida", "Salt Key Bank", "Andreas Island", "Nassau", "Abaco Island", "Cat Island", "Jiguey", "Salt Lagoon", "Black Island", "Crooked Island", "Mariguana Island", "Great Inagua", "Tortuga", "Caracol", "Petite Caverne", "Cumberland Bay", "San Juan", "Grand Cayman", "Cayman Sound", "Pinos Isle", "Arroyos", "Sacrifice Island", "Tulum", "Santanillas", "Corozal", "Ambergris Key", "Misteriosa", "New Bone", "Isla Providencia", "Anotto Bay", "Long Bay", "The Blue Hole", "Kingston", "Port Royal", "Ile a Vache", "Mystery Island", "Principe"].sort((x, y) => y.length - x.length);
const ZONES = ["Dry Tortuga", "Eleuthera", "Gibara", "Punta Guarico", "Cruz", "Castillo de Jagua", "Conttoyor", "Chinchorro", "Serranilla", "Charlotte", "Navassa", "Principe"];
function normRegion(raw) {
  const r = clean(raw || "", 120);
  if (!r || /^(not (named|specified|stated)|unspecified|unknown|n\/a)/i.test(r)) return "Unspecified";
  if (/\bonline\b|\bdlc\b/i.test(r)) return "Online and DLC";
  if (/^fleet/i.test(r)) return "Fleet missions";
  // the place is the part after "Zone - "; otherwise take the text with the zone names removed ("Dry Tortuga" must not match the place "Tortuga")
  let rest = r.includes(" - ") ? r.split(" - ").pop() : r;
  if (!r.includes(" - ")) ZONES.forEach((z) => { rest = rest.replace(new RegExp(z, "ig"), " "); });
  const low = rest.toLowerCase();
  const place = PLACES.find((x) => low.includes(x.toLowerCase()) || (x === "The Blue Hole" && low.includes("blue hole")) || (x === "Ile a Vache" && /(ile|isle)\s+a\s+vache/.test(low)));
  if (place) return place;
  const zone = ZONES.find((x) => r.toLowerCase().includes(x.toLowerCase()));
  if (zone) return zone + " region";
  if (/store|story|reward/i.test(r)) return "Shops and rewards";
  return "Other";
}

/* ---------------- categories (item lists) ---------------- */
const CATS = [
  // file, id, title, kind, group
  ["viewpoints", "viewpoints", "Viewpoints", "collectibles", "collect"],
  ["shanties", "shanties", "Shanties (song sheets)", "collectibles", "collect"],
  ["treasure-maps", "treasure-maps", "Treasure maps", "collectibles", "collect"],
  ["stelae", "stelae", "Mayan stelae", "collectibles", "collect"],
  ["secrets", "secrets", "Secrets", "collectibles", "collect"],
  ["chests", "chests", "Chests", "collectibles", "collect"],
  ["shipwrecks", "shipwrecks", "Underwater shipwreck chests", "collectibles", "collect"],
  ["animals", "animals", "Friendly animals", "collectibles", "collect"],
  ["portraits", "portraits", "Character portraits", "collectibles", "collect"],
  ["paintings", "paintings", "Paintings", "collectibles", "collect"],
  ["art-pieces", "art-pieces", "Art collection pieces", "collectibles", "collect"],
  ["cartographers", "cartographers", "Cartographers", "collectibles", "collect"],
  ["warehouses", "warehouses", "Warehouses", "collectibles", "collect"],
  ["taverns", "taverns", "Taverns", "collectibles", "collect"],
  ["data-files", "data-files", "Data files", "collectibles", "collect"],
  ["buried-treasure", "buried-treasure", "Buried treasure", "collectibles", "collect"],
  ["assassin-contracts", "assassin-contracts", "Assassin contracts", "quests", "side"],
  ["officers", "officers", "Officers", "quests", "side"],
  ["naval-contracts", "naval-contracts", "Naval contracts", "quests", "ships"],
  ["forts", "forts", "Forts", "collectibles", "ships"],
  ["legendary-ships", "legendary-ships", "Legendary ships", "collectibles", "ships"],
  ["ship-models", "ship-models", "Ship models", "collectibles", "ships"],
  ["ultimate-plans", "ultimate-plans", "Ultimate upgrade plans", "collectibles", "ships"],
  ["swords", "swords", "Swords", "collectibles", "gear"],
  ["pistols", "pistols", "Pistols", "collectibles", "gear"],
  ["outfits", "outfits", "Outfits", "collectibles", "gear"],
  ["trinkets", "trinkets", "Trinkets", "collectibles", "gear"],
];
const collections = [{ id: "memories", title: "Main memories", kind: "steps", groupBy: "area", items }];
const navGroups = { collect: [], side: [], ships: [], gear: [] };
const regionData = new Map(); // slug -> { name, rows: [{cat, name, where, gate, reward}] }
const catCounts = [];
for (const [file, id, title, kind, grp] of CATS) {
  const r = rd(file + ".json");
  if (!r || !Array.isArray(r.items) || !r.items.length) { if (r) gaps.push({ where: title, text: "No items could be captured from the source page." }); continue; }
  addSource(r.source, titleFromUrl(r.source, "PowerPyx"));
  const used = new Set();
  const its = r.items.map((x, n) => {
    const name = clean(x.name || `${title} ${n + 1}`, 160);
    let iid = `${id}-${slug(x.region || "x", 14)}-${slug(name, 30)}`.slice(0, 60).replace(/-+$/g, "");
    let k = 2; const base = iid; while (used.has(iid)) iid = `${base.slice(0, 56)}-${k++}`;
    used.add(iid);
    const bits = [clean(x.where, 500)];
    if (x.gate) bits.push("Needs: " + clean(x.gate, 200));
    if (x.reward) bits.push("Reward: " + clean(x.reward, 200));
    let region = normRegion(x.region);
    if (/ region$|^Unspecified$|^Other$/.test(region)) { const byName = normRegion(name); if (!/ region$|^Unspecified$|^Other$/.test(byName)) region = byName; } // e.g. "Viewpoint 4 (Havana #2)" in a zone-only row
    if (region) { const rs = slug(region, 40); if (!regionData.has(rs)) regionData.set(rs, { name: region, rows: [] }); regionData.get(rs).rows.push({ cat: title, name, where: clean(x.where, 300), gate: clean(x.gate, 120), reward: clean(x.reward, 120) }); }
    return { id: iid, label: name, detail: bits.filter(Boolean).join(" "), area: region || undefined, tags: [title] };
  });
  collections.push({ id, title: `${title} (${its.length})`, kind, groupBy: "area", items: its });
  catCounts.push([title, its.length, r.stated_total]);
  (r.gaps || []).forEach((g) => gaps.push({ where: title, text: clean(g, 400) }));
  if (r.stated_total && r.stated_total !== its.length) gaps.push({ where: title, text: `The source says ${r.stated_total} in total; this guide lists ${its.length}.` });
  navGroups[grp].push({ id: "nav-" + id, title: `${title}`, type: "collection", ref: id });
}

/* ---------------- trophies ---------------- */
const tro = rd("trophies.json");
const progressNav = [{ id: "nav-memories", title: "Main memories", type: "collection", ref: "memories" }];
if (tro && (tro.trophies || []).length) {
  addSource(tro.source, titleFromUrl(tro.source, "PowerPyx"));
  const used = new Set();
  collections.push({ id: "trophies", title: `Trophies and achievements (${tro.trophies.length})`, kind: "achievements", items: tro.trophies.map((t, n) => { let iid = "trophy-" + slug(t.name || n, 40); let k = 2; const b = iid; while (used.has(iid)) iid = b + "-" + k++; used.add(iid); return { id: iid, label: clean(t.name, 120), detail: clean(t.how, 500), missable: !!t.missable }; }) });
  progressNav.push({ id: "nav-trophies", title: "Trophies and achievements", type: "collection", ref: "trophies" });
  (tro.gaps || []).forEach((g) => gaps.push({ where: "Trophies", text: clean(g, 400) }));
  if ((tro.roadmap || []).length) pages.push({ id: "trophy-roadmap", title: "Trophy roadmap", summary: "What order to play in for the trophies and what to avoid.", tags: ["trophies"], spoilerLevel: 1, minutes: 2, blocks: [{ type: "steps", items: tro.roadmap.map((t) => ({ text: clean(t, 600) })) }] });
}

/* ---------------- upgrades ---------------- */
const upg = rd("upgrades.json");
const shipsNav = [];
if (upg) {
  addSource(upg.source, "PowerPyx: ship and crafting upgrades");
  const tbl = (title, rows) => rows && rows.length ? [{ type: "heading", text: title, level: 2 }, { type: "table", columns: ["Upgrade", "Effect", "Cost", "Needs"], rows: rows.map((u) => [clean(u.name, 80), clean(u.effect, 200), clean(u.cost, 120), clean(u.requires, 120)]) }] : [];
  const blocks = [...(upg.advice || []).length ? [{ type: "heading", text: "Advice", level: 2 }, { type: "steps", items: upg.advice.map((t) => ({ text: clean(t, 600) })) }] : [], ...tbl("Jackdaw upgrades", upg.ship_upgrades), ...tbl("Crafting", upg.crafting)];
  if (blocks.length) { pages.push({ id: "upgrades", title: "Upgrades and crafting", summary: "Jackdaw upgrades and crafting: effects, costs and what they need.", tags: ["ships"], spoilerLevel: 0, minutes: 4, blocks }); shipsNav.push({ id: "nav-upgrades", title: "Upgrades and crafting", type: "page", ref: "upgrades" }); }
  (upg.gaps || []).forEach((g) => gaps.push({ where: "Upgrades", text: clean(g, 400) }));
}

/* ---------------- tips ---------------- */
const tips = rd("tips.json");
const tipsNav = [];
if (tips) {
  addSource(tips.sources, "Tips sources");
  (tips.topics || []).forEach((tp) => {
    if (!tp.tips || !tp.tips.length) return;
    const id = "tips-" + slug(tp.topic, 40);
    pages.push({ id, title: clean(tp.topic, 80), summary: `${tp.tips.length} tips`, tags: ["tips"], spoilerLevel: 0, minutes: 3, blocks: [{ type: "steps", items: tp.tips.map((t) => ({ text: clean(t.tip, 600) })) }] });
    tipsNav.push({ id: "nav-" + id, title: clean(tp.topic, 80), type: "page", ref: id });
  });
  if ((tips.mission_order_advice || []).length || (tips.unlocks || []).length) {
    const blocks = [];
    if (tips.mission_order_advice.length) blocks.push({ type: "heading", text: "Order of play", level: 2 }, { type: "steps", items: tips.mission_order_advice.map((t) => ({ text: clean(t, 600) })) });
    if ((tips.unlocks || []).length) blocks.push({ type: "heading", text: "What unlocks when", level: 2 }, { type: "table", columns: ["Unlocks", "When"], rows: tips.unlocks.map((u) => [clean(u.what, 200), clean(u.when, 200)]) });
    pages.push({ id: "planning", title: "Planning and unlocks", summary: "When to do what, and what unlocks at which point.", tags: ["tips"], spoilerLevel: 1, minutes: 3, blocks });
    tipsNav.unshift({ id: "nav-planning", title: "Planning and unlocks", type: "page", ref: "planning" });
  }
  (tips.gaps || []).forEach((g) => gaps.push({ where: "Tips", text: clean(g, 400) }));
}

/* ---------------- areas ---------------- */
const regions = [...regionData.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name));
const areaNav = [];
if (regions.length) {
  pages.push({
    id: "areas-overview", title: "Areas overview", summary: "What is in each area, with counts.", tags: ["areas"], spoilerLevel: 0, minutes: 2,
    blocks: [
      { type: "text", text: "Each area page lists what can be found there, from the trackers in this guide. Counts only include items the guide lists." },
      { type: "table", columns: ["Area", "Items", "What is there"], rows: regions.map(([, r]) => { const by = {}; r.rows.forEach((x) => { by[x.cat] = (by[x.cat] || 0) + 1; }); return [r.name, String(r.rows.length), Object.entries(by).map(([k, v]) => `${k} ${v}`).join(", ").slice(0, 480)]; }) },
    ],
  });
  areaNav.push({ id: "nav-areas-overview", title: "Areas overview", type: "page", ref: "areas-overview" });
  for (const [rs, r] of regions) {
    const by = new Map(); r.rows.forEach((x) => { if (!by.has(x.cat)) by.set(x.cat, []); by.get(x.cat).push(x); });
    const blocks = [{ type: "text", text: `${r.rows.length} items listed in this guide for ${r.name}.` }];
    for (const [cat, rows] of by) { blocks.push({ type: "heading", text: `${cat} (${rows.length})`, level: 2 }); blocks.push({ type: "table", columns: ["Item", "Where", "Needs / reward"], rows: rows.map((x) => [x.name, x.where.slice(0, 480), [x.gate && "Needs: " + x.gate, x.reward && "Reward: " + x.reward].filter(Boolean).join(" ").slice(0, 300)]) }); }
    const pid = "area-" + rs;
    pages.push({ id: pid, title: r.name, summary: `${r.rows.length} items`, tags: ["areas"], area: r.name, spoilerLevel: 0, minutes: 2, blocks });
    areaNav.push({ id: "nav-" + pid, title: r.name, type: "page", ref: pid });
  }
}

/* ---------------- quests: Templar hunts, side quests, rifts ---------------- */
const kv = (pairs) => ({ type: "keyValue", items: pairs.filter(([, v]) => v && String(v).trim()).map(([k, v]) => ({ key: k, value: clean(v, 400) })) });
const stepsBlock = (arr) => ({ type: "steps", items: arr.map((x) => ({ text: clean(x, 600) })) });
const addQuestGaps = (where, list) => (list || []).forEach((g) => gaps.push({ where, text: clean(g, 400) }));
const hasSteps = (q) => Array.isArray(q.steps) && q.steps.length > 0;
function questBlocks(q, extraPairs = []) {
  const b = [];
  const k = kv([["Starts", q.start], ["Unlocks", q.unlock], ["Where", q.where], ...extraPairs, ["Reward", q.reward]]);
  if (k.items.length) b.push(k);
  if (hasSteps(q)) { b.push({ type: "heading", text: "Steps", level: 2 }, stepsBlock(q.steps)); }
  else b.push({ type: "text", text: "The sources used for this guide give no step-by-step for this one." });
  for (const tip of q.tips || []) b.push({ type: "callout", kind: "tip", text: clean(tip, 600) });
  return b;
}
const questItems = (list, id) => list;

const th = rd("templar-hunts.json");
if (th && (th.hunts || []).length) {
  const children = [], its = [];
  for (const h of th.hunts) {
    addSource(h.source, titleFromUrl(h.source || "", "Templar hunt"));
    const hid = "hunt-" + slug(h.name, 40);
    const blocks = [];
    const k = kv([["Starts", h.start], ["Reward", h.reward]]); if (k.items.length) blocks.push(k);
    for (const m of h.missions || []) {
      blocks.push({ type: "heading", text: clean(m.name, 100), level: 2 });
      if ((m.steps || []).length) blocks.push(stepsBlock(m.steps)); else blocks.push({ type: "text", text: "No steps were given by the sources for this mission." });
      for (const tip of m.tips || []) blocks.push({ type: "callout", kind: "tip", text: clean(tip, 600) });
      addQuestGaps("Templar hunt: " + h.name + " / " + m.name, m.gaps);
      its.push({ id: hid + "-" + slug(m.name, 30), label: clean(h.name + ": " + m.name, 120), area: clean(h.name, 60), pageRef: hid });
    }
    addQuestGaps("Templar hunt: " + h.name, h.gaps);
    pages.push({ id: hid, title: "Templar hunt: " + clean(h.name, 60), summary: clean(h.start || "", 200), tags: ["templar-hunts"], spoilerLevel: 1, minutes: 5, blocks });
    children.push({ id: "nav-" + hid, title: clean(h.name, 60), type: "page", ref: hid });
  }
  addQuestGaps("Templar hunts", th.gaps);
  collections.push({ id: "templar-hunts", title: "Templar hunts (" + its.length + " missions)", kind: "quests", groupBy: "area", items: its });
  navGroups.side.push({ id: "nav-g-templar", title: "Templar hunts", type: "group", children: [{ id: "nav-templar-hunts", title: "Tracker", type: "collection", ref: "templar-hunts" }, ...children] });
}

const sq = rd("side-quests.json");
if (sq && (sq.quests || []).length) {
  const byGroup = new Map(), its = [];
  const used = new Set();
  for (const q of sq.quests) {
    addSource(q.source, titleFromUrl(q.source || "", "Side quest"));
    let qid = "quest-" + slug(q.name, 44), n = 2; const base = qid; while (used.has(qid)) qid = base.slice(0, 40) + "-" + n++; used.add(qid);
    const blocks = questBlocks(q);
    pages.push({ id: qid, title: clean(q.name, 90), summary: clean(q.start || q.group || "", 200), tags: ["side-quests"], area: clean(q.group || "", 60), spoilerLevel: 1, minutes: 3, blocks });
    addQuestGaps("Side quest: " + q.name, q.gaps);
    const g = clean(q.group || "Other", 60); if (!byGroup.has(g)) byGroup.set(g, []); byGroup.get(g).push({ id: "nav-" + qid, title: clean(q.name, 80), type: "page", ref: qid });
    its.push({ id: qid, label: clean(q.name, 120), detail: clean(q.reward ? "Reward: " + q.reward : "", 300) || undefined, area: g, pageRef: qid });
  }
  addQuestGaps("Side quests", sq.gaps);
  if (sq.stated_total && sq.stated_total !== sq.quests.length) gaps.push({ where: "Side quests", text: "A public checklist counts " + sq.stated_total + " side quests; this guide lists " + sq.quests.length + "." });
  collections.push({ id: "side-quests", title: "Side quests (" + its.length + ")", kind: "quests", groupBy: "area", items: its });
  navGroups.side.push({ id: "nav-g-sidequests", title: "Side quests", type: "group", children: [{ id: "nav-side-quests", title: "Tracker", type: "collection", ref: "side-quests" }, ...[...byGroup.entries()].map(([g, kids], i) => ({ id: "nav-g-sq-" + i, title: g, type: "group", children: kids }))] });
}

const rf = rd("rifts.json");
if (rf && ((rf.rifts || []).length || (rf.dark_animus || []).length || (rf.animus_hub || []).length)) {
  addSource(rf.sources, "Rifts sources");
  const children = [], its = [];
  for (const r of rf.rifts || []) {
    const rid = "rift-" + slug(r.name, 40);
    pages.push({ id: rid, title: "Rift: " + clean(r.name, 60), summary: clean(r.unlock || r.where || "", 200), tags: ["rifts"], spoilerLevel: 2, minutes: 4, blocks: questBlocks({ ...r, start: undefined }) });
    addQuestGaps("Rift: " + r.name, r.gaps);
    children.push({ id: "nav-" + rid, title: clean(r.name, 60), type: "page", ref: rid });
    its.push({ id: rid, label: clean(r.name, 100), area: "Rifts", detail: clean(r.reward ? "Reward: " + r.reward : "", 300) || undefined, pageRef: rid });
  }
  for (const d of rf.dark_animus || []) {
    const did = "dark-animus-" + slug(d.name, 36);
    pages.push({ id: did, title: "Dark Animus: " + clean(d.name, 60), summary: clean(d.unlock || d.where || "", 200), tags: ["rifts"], spoilerLevel: 2, minutes: 3, blocks: questBlocks({ ...d, start: undefined }) });
    addQuestGaps("Dark Animus: " + d.name, d.gaps);
    children.push({ id: "nav-" + did, title: "Dark Animus: " + clean(d.name, 50), type: "page", ref: did });
    its.push({ id: did, label: "Dark Animus: " + clean(d.name, 80), area: "Dark Animus", detail: clean(d.reward ? "Reward: " + d.reward : "", 300) || undefined, pageRef: did });
  }
  if ((rf.animus_hub || []).length) {
    pages.push({ id: "animus-hub", title: "Animus hub and projects", summary: "How the Animus hub, projects and data fragments work.", tags: ["rifts"], spoilerLevel: 0, minutes: 2, blocks: [stepsBlock(rf.animus_hub)] });
    children.push({ id: "nav-animus-hub", title: "Animus hub and projects", type: "page", ref: "animus-hub" });
  }
  addQuestGaps("Rifts and Animus", rf.gaps);
  if (its.length) collections.push({ id: "rifts", title: "Rifts and Dark Animus (" + its.length + ")", kind: "quests", groupBy: "area", items: its });
  navGroups.side.push({ id: "nav-g-rifts", title: "Rifts and Animus", type: "group", children: [...(its.length ? [{ id: "nav-rifts", title: "Tracker", type: "collection", ref: "rifts" }] : []), ...children] });
}

/* ---------------- start, overview, gaps ---------------- */
const totalItems = collections.reduce((n, c) => n + c.items.length, 0);
pages.unshift({
  id: "start", title: "Start here", summary: "How this guide is organised, and what it covers.", tags: ["intro"], spoilerLevel: 0, minutes: 1,
  blocks: [
    { type: "text", text: "This guide covers **Assassin's Creed IV: Black Flag Resynced** (the 2026 remake) on PC. It is built from public guides, rewritten in my own words (see Credits)." },
    { type: "heading", text: "Where things are", level: 2 },
    { type: "keyValue", items: [
      { key: "Walkthrough", value: "Every sequence, with a page per memory: steps, optional extras and tips." },
      { key: "Collectibles", value: "Trackers for viewpoints, shanties, treasure maps, secrets, chests and more, by area." },
      { key: "Side content", value: "Templar hunts, side quests, rifts, assassin contracts and officer quests, with steps." },
      { key: "Areas", value: "What is in each island or town." },
      { key: "Ships and upgrades", value: "Naval contracts, forts, legendary ships, upgrades and crafting." },
      { key: "Gear", value: "Swords, pistols, outfits and trinkets." },
      { key: "Tips", value: "Tips by topic, order of play, unlocks and common problems." },
      { key: "Progress", value: "Main memories and trophies." },
    ] },
    { type: "callout", kind: "note", title: "Good to know", text: "Controls in the walkthrough are given for PlayStation and Xbox controllers; use your own PC bindings. Some details are missing where the sources did not give them: see [Known gaps](page:gaps). The Caribbean map is a picture only, with no pins." },
    { type: "mapLink", map: "caribbean", label: "Open the Caribbean map" },
  ],
});
const ov = rd("collectibles-overview.json");
if (ov) { addSource(ov.source, "PowerPyx: collectibles guide, 100% completion"); (ov.gaps || []).forEach((g) => gaps.push({ where: "Collectibles overview", text: clean(g, 400) })); }
const ovBlocks = [
  { type: "text", text: "Open a tracker from the Collectibles, Side content, Ships and Gear groups. Items are grouped by area, and each shows where it is and anything needed to get it. The table shows how many items this guide lists next to the number the source states." },
  { type: "table", columns: ["Type", "Listed here", "Source total"], rows: catCounts.map(([n, c, t2]) => [n, String(c), t2 ? String(t2) : "not stated"]) },
];
if (ov && (ov.general_advice || []).length) ovBlocks.push({ type: "heading", text: "General advice", level: 2 }, { type: "steps", items: ov.general_advice.map((x) => ({ text: clean(x, 600) })) });
if (ov && (ov.types || []).length) ovBlocks.push({ type: "heading", text: "What each type gives you", level: 2 }, { type: "table", columns: ["Type", "Total", "Reward", "Advice"], rows: ov.types.map((x) => [clean(x.type, 80), String(x.total || ""), clean(x.reward, 200), clean(x.advice, 300)]) });
pages.push({ id: "collectibles-overview", title: "Collectibles overview", summary: "The collectible types in this guide, what they give, and general advice.", tags: ["collectibles"], spoilerLevel: 0, minutes: 3, blocks: ovBlocks });
gaps.push({ where: "Side quests", text: "A World Without Gold (the eight-mission officer chapter for Tobias Smith) is not covered here." }, { where: "Side quests", text: "Source counts differ (20 side quests plus 11 or 15 officer quests, depending on the page), so the quest lists in this guide may not match a checklist you see elsewhere." }, { where: "Data files and buried treasure", text: "Regions for many data files and buried treasure sites were matched by name against a second source and may be wrong; the checklist source gives none." });
const gapBlocks = [{ type: "text", text: "Things the source pages did not say, or where this guide has fewer items than the source claims. Use the in-game map and another guide for these." }];
const byWhere = new Map(); gaps.forEach((g) => { if (!byWhere.has(g.where)) byWhere.set(g.where, []); byWhere.get(g.where).push(g.text); });
for (const [w, list] of byWhere) { gapBlocks.push({ type: "heading", text: w, level: 3 }); gapBlocks.push({ type: "steps", items: list.slice(0, 30).map((t) => ({ text: t })) }); }
pages.push({ id: "gaps", title: "Known gaps", summary: "What is missing or uncertain in this guide.", tags: ["info"], spoilerLevel: 0, minutes: 3, blocks: gapBlocks });

/* ---------------- navigation ---------------- */
const grp = (id, title, children) => (children.length ? [{ id: "nav-g-" + id, title, type: "group", children }] : []);
const navigation = [
  { id: "nav-start", title: "Start here", type: "page", ref: "start" },
  { id: "nav-walkthrough", title: "Walkthrough", type: "group", children: navWalk },
  ...grp("collect", "Collectibles", [{ id: "nav-collectibles-overview", title: "Overview", type: "page", ref: "collectibles-overview" }, ...navGroups.collect]),
  ...grp("areas", "Areas", areaNav),
  ...grp("ships", "Ships and upgrades", [...shipsNav, ...navGroups.ships]),
  ...grp("side", "Side content", navGroups.side),
  ...grp("gear", "Gear", navGroups.gear),
  ...grp("tips", "Tips and planning", tipsNav),
  ...grp("progress", "Progress", [...progressNav, ...(pages.some((p) => p.id === "trophy-roadmap") ? [{ id: "nav-trophy-roadmap", title: "Trophy roadmap", type: "page", ref: "trophy-roadmap" }] : [])]),
  { id: "nav-map", title: "Caribbean map", type: "map", ref: "caribbean" },
  { id: "nav-gaps", title: "Known gaps", type: "page", ref: "gaps" },
];

const old = JSON.parse(readFileSync(join(dir, "data.json"), "utf8"));
const data = { navigation, pages, collections, maps: old.maps || [], trees: [], tables: [], glossary: [] };

const man = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8"));
man.guide.version = "0.2.0";
man.guide.subtitle = "Walkthrough, collectibles, areas, ships, gear and tips";
addSource("https://www.powerpyx.com/assassins-creed-4-black-flag-resynced-full-world-map/", "PowerPyx: the Caribbean map picture");
man.credits.sources = [...sources.entries()].map(([url, title]) => ({ title: clean(title, 190), url: url.slice(0, 480), licence: /map picture/.test(title) ? "All rights reserved; picture used unaltered" : "All rights reserved; facts only, wording rewritten", retrieved: "2026-10-24" }));
man.credits.license = "All rights reserved; free to use unmodified, not for resale or republishing";
man.credits.attribution = "Written by the guide author. Every step, location and tip is a fact gathered from the sources listed, restated in the author's own words; where a source did not say something it is left out and listed under Known gaps. The Caribbean map picture is game artwork by Ubisoft, taken from the PowerPyx page listed under Sources and included unaltered; all rights in it remain with their owners. Game names and artwork belong to Ubisoft. Not affiliated with or endorsed by Ubisoft. Free to use unmodified; please do not resell or republish.";
writeFileSync(join(dir, "data.json"), JSON.stringify(data, null, 2) + "\n");
writeFileSync(join(dir, "manifest.json"), JSON.stringify(man, null, 2) + "\n");
console.log(`pages ${pages.length}, collections ${collections.length}, items ${totalItems}, gaps ${gaps.length}, sources ${sources.size}, regions ${regions.length}`);
