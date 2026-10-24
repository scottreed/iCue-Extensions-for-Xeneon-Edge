// Builds a .ggp from a guide folder: fills asset hashes/sizes and stats, validates, writes a deterministic zip.
import { createHash } from "node:crypto";
import { IMAGE_TYPES } from "./limits.mjs";
import { readDir, readArchive, writeArchive } from "./archive.mjs";
import { sniffImage } from "./images.mjs";
import { validateGuide } from "./validate.mjs";

const mimeOf = (path) => {
  const p = path.toLowerCase();
  return Object.keys(IMAGE_TYPES).find((m) => IMAGE_TYPES[m].some((e) => p.endsWith(e)));
};

// Returns { bytes, manifest, report } where report is the strict validation of the finished archive.
export function packDir(dir) {
  const { files, errors: readErrors } = readDir(dir);
  if (readErrors.length) return { bytes: null, report: { ok: false, errors: readErrors, warnings: [] } };
  let manifest;
  try { manifest = JSON.parse(new TextDecoder().decode(files.get("manifest.json"))); }
  catch (e) { return { bytes: null, report: { ok: false, errors: [{ code: "json.invalid", path: "manifest.json", msg: "manifest.json is missing or not valid JSON" }], warnings: [] } }; }

  // Only these end up in the archive.
  const out = new Map();
  for (const a of Array.isArray(manifest.assets) ? manifest.assets : []) {
    const b = a && files.get(a.path);
    if (!b) continue;
    a.mime = mimeOf(a.path) || a.mime;
    a.bytes = b.length;
    a.sha256 = createHash("sha256").update(b).digest("hex");
    const info = sniffImage(b, a.mime);
    if (info.ok && info.width) { a.width = info.width; a.height = info.height; }
    out.set(a.path, b);
  }
  const pre = validateGuide(new Map([...files, ["manifest.json", new TextEncoder().encode(JSON.stringify(manifest))]]), { strictHashes: false });
  if (pre.stats) manifest.stats = pre.stats;
  out.set("manifest.json", JSON.stringify(manifest, null, 2) + "\n");
  if (files.has("data.json")) out.set("data.json", files.get("data.json"));

  const bytes = writeArchive(out);
  const { files: back, errors } = readArchive(bytes);
  const report = validateGuide(back, { strictHashes: true });
  report.errors.unshift(...errors);
  report.ok = report.errors.length === 0;
  return { bytes, manifest, report };
}
