// Programmatic grader for the ggp-guide-builder evals.
// Usage: node evals/grade.mjs <iteration-dir>   (writes grading.json into every <case>/<variant>/ run directory)
import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readArchive } from "../scripts/lib/archive.mjs";
import { validateGuide } from "../scripts/lib/validate.mjs";

const root = process.argv[2];
if (!root) { console.error("usage: node evals/grade.mjs <iteration-dir>"); process.exit(2); }

function find(dir, pred, out = []) {
  if (!existsSync(dir)) return out;
  for (const n of readdirSync(dir)) {
    if (n === "node_modules") continue;
    const p = join(dir, n);
    if (statSync(p).isDirectory()) find(p, pred, out); else if (pred(n)) out.push(p);
  }
  return out;
}

function load(outDir) {
  const ggps = find(outDir, (n) => n.endsWith(".ggp"));
  const msgFile = find(outDir, (n) => /^final-message\.md$/i.test(n))[0];
  const message = msgFile ? readFileSync(msgFile, "utf8") : "";
  if (!ggps.length) return { ggp: null, message };
  const bytes = new Uint8Array(readFileSync(ggps[0]));
  const { files, errors } = readArchive(bytes);
  const rep = validateGuide(files, { strictHashes: true });
  const errs = [...errors, ...rep.errors];
  return { ggp: ggps[0], message, errs, manifest: rep.manifest, data: rep.data || {}, files };
}

const strings = (v, out = []) => { if (typeof v === "string") out.push(v); else if (Array.isArray(v)) v.forEach((x) => strings(x, out)); else if (v && typeof v === "object") Object.values(v).forEach((x) => strings(x, out)); return out; };
const items = (d) => (d.collections || []).flatMap((c) => c.items || []);
const T = (passed, evidence) => ({ passed: !!passed, evidence });

const checks = {
  "walkthrough-from-notes": (g) => [
    () => g.errs.length === 0 ? T(true, "0 validation errors") : T(false, g.errs.slice(0, 3).map((e) => e.msg).join("; ")),
    () => {
      const want = [/dock/i, /furnace/i, /tower|lantern/i];
      const pages = g.data.pages || [];
      const hit = want.map((r) => pages.some((p) => r.test(p.title || "") || r.test(p.id || "")));
      const nav = JSON.stringify(g.data.navigation || []);
      const reachable = pages.filter((p) => nav.includes(`"${p.id}"`)).length;
      return T(hit.every(Boolean) && reachable >= 3, `chapter pages found: ${hit.join(",")}, pages in navigation: ${reachable}/${pages.length}`);
    },
    () => {
      const callouts = (g.data.pages || []).flatMap((p) => (p.blocks || []).filter((b) => b.type === "callout" && b.kind === "missable" && /ledger/i.test(b.text + (b.title || ""))));
      const it = items(g.data).filter((i) => i.missable && /ledger/i.test((i.label || "") + (i.detail || "")));
      return T(callouts.length + it.length > 0, `missable ledger callouts: ${callouts.length}, items: ${it.length}`);
    },
    () => {
      const c = g.manifest.credits || {};
      const own = /own|notes|author|play/i.test((c.attribution || "") + JSON.stringify(c.sources || []));
      return T((c.authors || []).length > 0 && /personal/i.test(c.license || "") && own, `authors=${JSON.stringify(c.authors)} license=${c.license} attribution=${(c.attribution || "").slice(0, 80)}`);
    },
    () => {
      const bad = strings(g.data).filter((s) => /<[a-z!\/][^>]*>/i.test(s) || /https?:\/\//i.test(s));
      return T(bad.length === 0, bad.length ? "found: " + bad[0].slice(0, 80) : "no HTML or external links");
    },
    () => T(g.message && /\.ggp/i.test(g.message) && /assum/i.test(g.message), g.message ? `message ${g.message.length} chars; mentions .ggp: ${/\.ggp/i.test(g.message)}; assumptions: ${/assum/i.test(g.message)}` : "no final-message.md"),
  ],
  "collectibles-with-map": (g) => {
    const want = ["140,520", "255,430", "410,360", "640,280", "780,120"];
    const pins = (g.data.maps || []).flatMap((m) => m.pins || []);
    const it = items(g.data);
    const noPinRe = /cave|cellar|gull/i;
    return [
      () => g.errs.length === 0 ? T(true, "0 validation errors") : T(false, g.errs.slice(0, 3).map((e) => e.msg).join("; ")),
      () => T(it.length === 8, `${it.length} items`),
      () => { const got = pins.map((p) => `${p.x},${p.y}`).sort(); return T(pins.length === 5 && want.every((w) => got.includes(w)), `pins: ${got.join(" | ")}`); },
      () => {
        const nopin = it.filter((i) => noPinRe.test(i.label || "") || noPinRe.test(i.id || ""));
        const linked = nopin.filter((i) => (i.pins || []).length || pins.some((p) => p.itemId === i.id));
        return T(nopin.length === 3 && linked.length === 0 && nopin.every((i) => (i.detail || "").length > 8), `unpinned-by-design items found: ${nopin.length}, wrongly pinned: ${linked.length}`);
      },
      () => T(g.message && /cave/i.test(g.message) && /cellar|lighthouse/i.test(g.message) && /gull/i.test(g.message) && /(no|not|without|missing|unmeasured|never).{0,60}(coordinate|position|measur|pin)|(coordinate|position|measur|pin).{0,60}(no|not|missing|unmeasured)/i.test(g.message), g.message ? "checked message for the three shards and a reason" : "no final-message.md"),
      () => {
        const pier = it.find((i) => /pier/i.test((i.label || "") + i.id));
        const tower = it.find((i) => /tower/i.test((i.label || "") + i.id));
        return T(pier && pier.missable === true && tower && tower.pointOfNoReturn === true, `pier.missable=${pier && pier.missable} tower.pointOfNoReturn=${tower && tower.pointOfNoReturn}`);
      },
      () => { const m = (g.data.maps || [])[0]; const a = (g.manifest.assets || []).length; return T(m && a >= 1 && m.size && m.size.w === 1000 && m.size.h === 700, `assets=${a} size=${m && JSON.stringify(m.size)}`); },
    ];
  },
  "build-planner-tree": (g) => {
    const t = (g.data.trees || [])[0] || { nodes: [], presets: [] };
    const exp = { spark: [3, []], ignite: [2, ["spark"]], blaze: [1, ["ignite"]], sprint: [3, []], vault: [1, ["sprint"]], grit: [3, []], brace: [2, ["grit"]], "second wind": [1, ["brace"]] };
    const byId = Object.fromEntries((t.nodes || []).map((n) => [n.id, n]));
    const lab = (id) => ((byId[id] && byId[id].label) || "").toLowerCase();
    return [
      () => g.errs.length === 0 ? T(true, "0 validation errors") : T(false, g.errs.slice(0, 3).map((e) => e.msg).join("; ")),
      () => {
        const bad = [];
        for (const [name, [max, req]] of Object.entries(exp)) {
          const n = (t.nodes || []).find((x) => (x.label || "").toLowerCase() === name);
          if (!n) { bad.push(name + " missing"); continue; }
          const reqLabels = (n.requires || []).map(lab).sort().join(",");
          if (n.maxPoints !== max || reqLabels !== req.join(",")) bad.push(`${name}: max ${n.maxPoints} needs ${reqLabels}`);
        }
        return T((t.nodes || []).length === 8 && !bad.length, bad.length ? bad.join("; ") : "8 nodes match the table");
      },
      () => { const titles = (t.presets || []).map((p) => (p.title || "").toLowerCase()); return T(titles.some((x) => /fire/.test(x)) && titles.some((x) => /runner/.test(x)), `presets: ${titles.join(", ")}`); },
      () => { const over = []; for (const p of t.presets || []) for (const [id, v] of Object.entries(p.allocations || {})) if (byId[id] && v > byId[id].maxPoints) over.push(`${p.title}:${id}=${v}>${byId[id].maxPoints}`); return T(!over.length && (t.presets || []).length >= 2, over.length ? over.join(", ") : "no preset exceeds max points"); },
      () => T(g.message && /ignite/i.test(g.message) && /(max|exceed|more than|over|cap|limit)/i.test(g.message), g.message ? "checked message for Ignite and the over-max explanation" : "no final-message.md"),
      () => { const c = g.manifest.credits || {}; return T((c.authors || []).length > 0 && /personal/i.test(c.license || ""), `authors=${JSON.stringify(c.authors)} license=${c.license}`); },
    ];
  },
};

for (const c of readdirSync(root)) {
  const cdir = join(root, c);
  if (!existsSync(join(cdir, "eval_metadata.json")) || !checks[c]) continue;
  const meta = JSON.parse(readFileSync(join(cdir, "eval_metadata.json"), "utf8"));
  for (const v of readdirSync(cdir)) {
    const run = join(cdir, v);
    if (!existsSync(join(run, "outputs"))) continue;
    const g = load(join(run, "outputs"));
    let results;
    if (!g.ggp) results = meta.assertions.map((text) => ({ text, passed: false, evidence: "no .ggp file was produced" }));
    else results = checks[c](g).map((fn, i) => { let r; try { r = fn() || T(false, "check returned nothing"); } catch (e) { r = T(false, "check crashed: " + e.message); } return { text: meta.assertions[i], passed: r.passed, evidence: r.evidence }; });
    const passed = results.filter((r) => r.passed).length;
    writeFileSync(join(run, "grading.json"), JSON.stringify({ expectations: results, summary: { passed, failed: results.length - passed, total: results.length, pass_rate: Math.round((passed / results.length) * 100) / 100 } }, null, 2));
    console.log(`${c}/${v}: ${passed}/${results.length}${results.filter((r) => !r.passed).map((r) => "\n   FAIL: " + r.text + " -- " + r.evidence).join("")}`);
  }
}
