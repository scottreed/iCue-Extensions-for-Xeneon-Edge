#!/usr/bin/env node
// ggp: validate, pack, inspect and scaffold Game Guide Pack (.ggp) files.
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { readArchive, readDir } from "./lib/archive.mjs";
import { validateGuide } from "./lib/validate.mjs";
import { packDir } from "./lib/pack.mjs";

const HELP = `ggp - Game Guide Pack tool

  ggp validate <folder|file.ggp> [--json]   check a guide (exit code 1 on errors)
  ggp pack <folder> [-o out.ggp] [--force]   build a .ggp (refuses if validation fails unless --force)
  ggp inspect <folder|file.ggp>              print a readable summary
  ggp init <folder> [--title "My Guide"]     create a starter guide folder
`;

function load(target) {
  if (!existsSync(target)) return { fail: `not found: ${target}` };
  if (statSync(target).isDirectory()) {
    const { files, errors } = readDir(target);
    return { files, readErrors: errors, strict: false };
  }
  const { files, errors } = readArchive(new Uint8Array(readFileSync(target)));
  return { files, readErrors: errors, strict: true };
}

function printReport(report, readErrors = []) {
  const errors = [...readErrors, ...report.errors];
  for (const e of errors) console.log(`ERROR   ${e.path || "-"}  ${e.msg}  [${e.code}]`);
  for (const w of report.warnings) console.log(`warning ${w.path || "-"}  ${w.msg}  [${w.code}]`);
  console.log(`${errors.length} error(s), ${report.warnings.length} warning(s)`);
  return errors.length;
}

function cmdValidate(args) {
  const target = args.find((a) => !a.startsWith("-"));
  if (!target) return usage();
  const l = load(target);
  if (l.fail) { console.error(l.fail); return 2; }
  const report = l.readErrors.length && !l.files.size ? { ok: false, errors: [], warnings: [], stats: null } : validateGuide(l.files, { strictHashes: l.strict });
  if (args.includes("--json")) { console.log(JSON.stringify({ errors: [...l.readErrors, ...report.errors], warnings: report.warnings, stats: report.stats }, null, 2)); return l.readErrors.length + report.errors.length ? 1 : 0; }
  const n = printReport(report, l.readErrors);
  if (n === 0 && report.stats) console.log("OK  " + JSON.stringify(report.stats));
  return n ? 1 : 0;
}

function cmdPack(args) {
  const dir = args.find((a, i) => !a.startsWith("-") && args[i - 1] !== "-o");
  if (!dir) return usage();
  if (!existsSync(dir) || !statSync(dir).isDirectory()) { console.error("pack needs a guide folder"); return 2; }
  const oi = args.indexOf("-o");
  const out = oi >= 0 ? args[oi + 1] : resolve(dirname(resolve(dir)), basename(resolve(dir)) + ".ggp");
  const { bytes, report } = packDir(dir);
  const n = printReport(report);
  if (!bytes || (n && !args.includes("--force"))) { console.error("not written"); return 1; }
  writeFileSync(out, bytes);
  console.log(`wrote ${out} (${bytes.length} bytes)`);
  return n ? 1 : 0;
}

function cmdInspect(args) {
  const target = args.find((a) => !a.startsWith("-"));
  if (!target) return usage();
  const l = load(target);
  if (l.fail) { console.error(l.fail); return 2; }
  const r = validateGuide(l.files, { strictHashes: l.strict });
  const m = r.manifest, d = r.data;
  if (!m || !d) { printReport(r, l.readErrors); return 1; }
  const g = m.guide || {};
  console.log(`${g.title || "(untitled)"}  v${g.version}  [${g.id}]  ${g.language}`);
  console.log(`Game: ${m.game?.title}  (${(m.game?.platforms || []).join(", ")})`);
  console.log(`Credits: ${(m.credits?.authors || []).join(", ")}  licence ${m.credits?.license}  sources ${(m.credits?.sources || []).length}`);
  if (r.stats) console.log("Content: " + Object.entries(r.stats).map(([k, v]) => `${v} ${k}`).join(", "));
  const tree = (nodes, ind) => (Array.isArray(nodes) ? nodes : []).forEach((n) => { console.log(`${ind}${n.type === "group" ? "+" : "-"} ${n.title}${n.type !== "group" ? `  (${n.type}:${n.ref})` : ""}`); tree(n.children, ind + "  "); });
  console.log("Navigation:"); tree(d.navigation, "  ");
  console.log(`Validation: ${r.errors.length + l.readErrors.length} error(s), ${r.warnings.length} warning(s)`);
  return r.errors.length ? 1 : 0;
}

function cmdInit(args) {
  const dir = args.find((a, i) => !a.startsWith("-") && args[i - 1] !== "--title");
  if (!dir) return usage();
  if (existsSync(dir) && readDir(dir).files.size) { console.error("folder is not empty"); return 2; }
  const ti = args.indexOf("--title");
  const title = ti >= 0 ? args[ti + 1] : "My Guide";
  const id = (basename(resolve(dir)).toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "my-guide").slice(0, 64);
  mkdirSync(resolve(dir, "assets"), { recursive: true });
  const manifest = {
    formatVersion: "1.0",
    guide: { id, title, version: "0.1.0", language: "en", spoilerPolicy: "all", replaces: [] },
    game: { title: "Game title", platforms: ["PC"] },
    credits: { authors: ["Your name"], license: "personal-use", sources: [] },
    assets: [],
  };
  const data = {
    navigation: [{ id: "nav-start", title: "Start here", type: "page", ref: "start" }],
    pages: [{ id: "start", title: "Start here", summary: "Replace this page.", tags: [], spoilerLevel: 0, blocks: [{ type: "text", text: "Write your guide here." }] }],
    collections: [], maps: [], trees: [], tables: [], glossary: [],
  };
  writeFileSync(resolve(dir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  writeFileSync(resolve(dir, "data.json"), JSON.stringify(data, null, 2) + "\n");
  console.log(`created ${dir}  (edit it, then: ggp validate ${dir} && ggp pack ${dir})`);
  return 0;
}

function usage() { console.log(HELP); return 2; }

const [cmd, ...rest] = process.argv.slice(2);
const table = { validate: cmdValidate, pack: cmdPack, inspect: cmdInspect, init: cmdInit };
process.exitCode = table[cmd] ? table[cmd](rest) : usage();
