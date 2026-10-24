import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, cpSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { zipSync, strToU8 } from "fflate";
import { readArchive, readDir, writeArchive } from "../scripts/lib/archive.mjs";
import { validateGuide } from "../scripts/lib/validate.mjs";
import { packDir } from "../scripts/lib/pack.mjs";
import { LIMITS } from "../scripts/lib/limits.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const example = join(root, "examples", "mini-guide");
const cli = join(root, "scripts", "ggp.mjs");

const packed = () => packDir(example);
const guideFiles = () => readArchive(packed().bytes).files;
const codes = (r) => r.errors.map((e) => e.code);

// Edit data.json / manifest.json of the packed example and re-validate it (strict, as the widget would).
function mutate(fn, { manifest } = {}) {
  const files = new Map(guideFiles());
  const name = manifest ? "manifest.json" : "data.json";
  const j = JSON.parse(new TextDecoder().decode(files.get(name)));
  fn(j);
  files.set(name, strToU8(JSON.stringify(j)));
  return validateGuide(files, { strictHashes: true });
}

test("example guide validates clean as a folder", () => {
  const { files } = readDir(example);
  const r = validateGuide(files, { strictHashes: false });
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.warnings, []);
});

test("pack produces a clean archive with stats and hashes filled in", () => {
  const p = packed();
  assert.equal(p.report.ok, true, JSON.stringify(p.report.errors));
  assert.equal(p.manifest.stats.pins, 3);
  assert.match(p.manifest.assets[0].sha256, /^[0-9a-f]{64}$/);
  assert.equal(p.manifest.assets[0].width, 1200);
});

test("pack is deterministic", () => {
  assert.deepEqual(packed().bytes, packed().bytes);
});

test("round trip: archive -> files -> same guide", () => {
  const { files, errors } = readArchive(packed().bytes);
  assert.deepEqual(errors, []);
  assert.deepEqual([...files.keys()].sort(), ["assets/island-map.png", "assets/lighthouse.png", "data.json", "manifest.json"]);
});

// ---------------- content errors ----------------
test("unresolved page reference", () => assert.ok(codes(mutate((d) => { d.navigation[0].ref = "nope"; })).includes("ref.unresolved")));
test("duplicate item id across collections", () => assert.ok(codes(mutate((d) => { d.collections.push({ id: "c2", title: "x", kind: "steps", items: [{ id: "lantern-shore", label: "dup" }] }); })).includes("id.duplicate")));
test("pin outside the map", () => assert.ok(codes(mutate((d) => { d.maps[0].pins[0].x = 99999; })).includes("pin.bounds")));
test("pin type not in legend", () => assert.ok(codes(mutate((d) => { d.maps[0].pins[0].type = "ghost"; })).includes("ref.unresolved")));
test("collection item points at a missing pin", () => assert.ok(codes(mutate((d) => { d.collections[0].items[0].pins[0].pinId = "ghost"; })).includes("ref.unresolved")));
test("bad id characters", () => assert.ok(codes(mutate((d) => { d.pages[0].id = "Bad Id!"; })).includes("id.invalid")));
test("unknown block type", () => assert.ok(codes(mutate((d) => { d.pages[0].blocks.push({ type: "html", html: "<b>x</b>" }); })).includes("block.type")));
test("external link in text is refused", () => assert.ok(codes(mutate((d) => { d.pages[0].blocks[0].text = "see [here](https://evil.example)"; })).includes("link.scheme")));
test("javascript: link is refused", () => assert.ok(codes(mutate((d) => { d.pages[0].blocks[0].text = "[x](javascript:alert(1))"; })).includes("link.scheme")));
test("link to a missing page is refused", () => assert.ok(codes(mutate((d) => { d.pages[0].blocks[0].text = "[x](page:ghost)"; })).includes("ref.unresolved")));
test("links to a tree and a table are allowed", () => assert.equal(mutate((d) => { d.pages[0].blocks[0].text = "see [skills](tree:skills) and [prices](table:shops)"; }).ok, true));
test("link to a missing tree is refused", () => assert.ok(codes(mutate((d) => { d.pages[0].blocks[0].text = "[x](tree:ghost)"; })).includes("ref.unresolved")));
test("tree preset above max points", () => assert.ok(codes(mutate((d) => { d.trees[0].presets[0].allocations.swim = 9; })).includes("range")));
test("table row with wrong cell type", () => assert.ok(codes(mutate((d) => { d.tables[0].rows[0][1] = "twelve"; })).includes("table.cell")));
test("image block pointing at an unknown asset", () => assert.ok(codes(mutate((d) => { d.pages[0].blocks[2].asset = "ghost"; })).includes("ref.unresolved")));
test("too many pins", () => {
  const files = new Map(guideFiles());
  const d = JSON.parse(new TextDecoder().decode(files.get("data.json")));
  d.maps[0].pins = Array.from({ length: 12 }, (_, i) => ({ id: "p" + i, x: 1, y: 1, type: "lantern", title: "t" }));
  files.set("data.json", strToU8(JSON.stringify(d)));
  assert.ok(codes(validateGuide(files, { limits: { ...LIMITS, pinsPerMap: 10 } })).includes("limit.pins"));
});
test("navigation too deep", () => {
  const files = new Map(guideFiles());
  const d = JSON.parse(new TextDecoder().decode(files.get("data.json")));
  let n = { id: "leaf", title: "l", type: "page", ref: "start" };
  for (let i = 0; i < 8; i++) n = { id: "g" + i, title: "g", type: "group", children: [n] };
  d.navigation = [n];
  files.set("data.json", strToU8(JSON.stringify(d)));
  assert.ok(codes(validateGuide(files)).includes("limit.depth"));
});

// ---------------- manifest errors ----------------
test("missing credits", () => assert.ok(codes(mutate((m) => { delete m.credits; }, { manifest: true })).includes("type")));
test("bad semver", () => assert.ok(codes(mutate((m) => { m.guide.version = "one"; }, { manifest: true })).includes("semver")));
test("wrong format version", () => assert.ok(codes(mutate((m) => { m.formatVersion = "2.0"; }, { manifest: true })).includes("manifest.version")));
test("tampered asset hash", () => assert.ok(codes(mutate((m) => { m.assets[0].sha256 = "0".repeat(64); }, { manifest: true })).includes("asset.sha256")));
test("asset missing from archive", () => {
  const files = new Map(guideFiles());
  files.delete("assets/lighthouse.png");
  assert.ok(codes(validateGuide(files)).includes("asset.missing"));
});
test("asset that is not really a png", () => {
  const files = new Map(guideFiles());
  files.set("assets/lighthouse.png", strToU8("not an image at all, just text padding padding"));
  assert.ok(codes(validateGuide(files)).includes("asset.content"));
});
test("svg with a script is refused", () => {
  const files = new Map(guideFiles());
  const m = JSON.parse(new TextDecoder().decode(files.get("manifest.json")));
  m.assets.push({ id: "bad", path: "assets/bad.svg", mime: "image/svg+xml", bytes: 0, sha256: "0".repeat(64) });
  files.set("manifest.json", strToU8(JSON.stringify(m)));
  files.set("assets/bad.svg", strToU8('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'));
  assert.ok(codes(validateGuide(files)).includes("asset.svg"));
});
test("oversized image dimensions", () => {
  const files = new Map(guideFiles());
  assert.ok(codes(validateGuide(files, { limits: { ...LIMITS, imagePx: 1000 } })).includes("limit.imagepx"));
});

// ---------------- hostile archives ----------------
const zip = (entries) => zipSync(Object.fromEntries(Object.entries(entries).map(([k, v]) => [k, typeof v === "string" ? strToU8(v) : v])));

test("zip-slip: .. path is rejected and nothing is extracted", () => {
  const r = readArchive(zip({ "manifest.json": "{}", "../evil.txt": "x", "assets/../../evil.txt": "x" }));
  assert.ok(r.errors.filter((e) => e.code === "zip.path").length >= 2);
  assert.ok(![...r.files.keys()].some((k) => k.includes("..")));
});
test("absolute and drive paths are rejected", () => {
  const r = readArchive(zip({ "/etc/passwd": "x", "C:/Windows/x": "x", "a\\b": "x" }));
  assert.equal(r.errors.filter((e) => e.code === "zip.path").length, 3);
  assert.equal(r.files.size, 0);
});
test("not a zip", () => assert.equal(readArchive(strToU8("hello world, definitely not a zip file")).errors[0].code, "zip.invalid"));
test("truncated zip does not throw", () => {
  const b = packed().bytes;
  const r = readArchive(b.subarray(0, Math.floor(b.length / 2)));
  assert.ok(r.errors.length > 0);
});
test("archive larger than the limit is refused before reading", () => assert.equal(readArchive(packed().bytes, { ...LIMITS, zipBytes: 1000 }).errors[0].code, "limit.zip"));
test("decompression bomb: huge declared total is refused without inflating", () => {
  const bomb = zip({ "manifest.json": "{}", "assets/zeros.bin": new Uint8Array(3 * 1024 * 1024) });
  const r = readArchive(bomb, { ...LIMITS, uncompressedBytes: 1024 * 1024, imageBytes: 8 * 1024 * 1024 });
  assert.ok(codes(r).includes("limit.uncompressed"));
  assert.equal(r.files.size, 0);
});
test("a single entry above its cap is refused", () => {
  const r = readArchive(zip({ "data.json": new Uint8Array(2000) }), { ...LIMITS, dataBytes: 1000 });
  assert.ok(codes(r).includes("limit.entry"));
});
test("too many entries", () => {
  const many = {};
  for (let i = 0; i < 20; i++) many["assets/f" + i + ".png"] = "x";
  assert.ok(codes(readArchive(zip(many), { ...LIMITS, entries: 10 })).includes("limit.entries"));
});
test("lying size in the directory is caught, not trusted", () => {
  const b = zip({ "data.json": "x".repeat(5000) });
  // central directory header: signature 50 4b 01 02, uncompressed size at offset 24
  const i = b.findIndex((_, k) => b[k] === 0x50 && b[k + 1] === 0x4b && b[k + 2] === 0x01 && b[k + 3] === 0x02);
  const lie = new Uint8Array(b); lie[i + 24] = 10; lie[i + 25] = 0; lie[i + 26] = 0; lie[i + 27] = 0;
  let r;
  assert.doesNotThrow(() => { r = readArchive(lie); });
  assert.equal(r.files.size, 0);
  assert.ok(r.errors.length > 0);
});
test("deep and hostile JSON values do not crash the validator", () => {
  const files = new Map(guideFiles());
  files.set("data.json", strToU8('{"navigation":[null,1,"x",{"type":"group","children":[[]]}],"pages":[null,{"blocks":[{"type":"steps","items":"no"}]}],"maps":[{"pins":[null]}],"__proto__":{"x":1}}'));
  assert.doesNotThrow(() => validateGuide(files));
  assert.equal(validateGuide(files).ok, false);
});
test("invalid JSON and invalid UTF-8 are reported", () => {
  const files = new Map(guideFiles());
  files.set("data.json", strToU8("{not json"));
  assert.ok(codes(validateGuide(files)).includes("json.invalid"));
  files.set("data.json", new Uint8Array([0x7b, 0xff, 0xfe, 0x7d]));
  assert.ok(codes(validateGuide(files)).includes("json.invalid"));
});

// ---------------- CLI ----------------
test("CLI: init, validate, pack, inspect end to end", () => {
  const tmp = mkdtempSync(join(tmpdir(), "ggp-"));
  try {
    const dir = join(tmp, "my-guide");
    const run = (...a) => execFileSync(process.execPath, [cli, ...a], { encoding: "utf8" });
    run("init", dir, "--title", "Test Guide");
    assert.match(run("validate", dir), /0 error/);
    const out = join(tmp, "out.ggp");
    run("pack", dir, "-o", out);
    assert.match(run("validate", out), /0 error/);
    assert.match(run("inspect", out), /Test Guide/);
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});
test("CLI: validate exits 1 on a broken guide", () => {
  const tmp = mkdtempSync(join(tmpdir(), "ggp-"));
  try {
    const dir = join(tmp, "g");
    cpSync(example, dir, { recursive: true });
    const p = join(dir, "data.json");
    writeFileSync(p, readFileSync(p, "utf8").replace('"ref": "start"', '"ref": "ghost"'));
    assert.throws(() => execFileSync(process.execPath, [cli, "validate", dir], { stdio: "pipe" }), (e) => e.status === 1);
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});
test("writeArchive output is readable by readArchive", () => {
  const m = new Map([["manifest.json", "{}"], ["data.json", "{}"]]);
  const r = readArchive(writeArchive(m));
  assert.deepEqual([...r.files.keys()].sort(), ["data.json", "manifest.json"]);
});
