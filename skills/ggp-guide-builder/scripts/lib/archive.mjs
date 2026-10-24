// Reading and writing .ggp archives (zip), and reading a guide folder, as a map of path -> bytes.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { unzipSync, zipSync, strToU8 } from "fflate";
import { LIMITS } from "./limits.mjs";

// CRC-32 of the decompressed bytes, compared with the value the zip directory declares.
const CRC_TABLE = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
function crc32(b) { let c = -1; for (let i = 0; i < b.length; i++) c = CRC_TABLE[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; }

// Reads { name -> crc } from the zip central directory (null when it cannot be parsed).
function declaredCrcs(u) {
  const dv = new DataView(u.buffer, u.byteOffset, u.byteLength);
  let e = u.length - 22;
  while (e >= 0 && e > u.length - 22 - 65536 && dv.getUint32(e, true) !== 0x06054b50) e--;
  if (e < 0 || dv.getUint32(e, true) !== 0x06054b50) return null;
  const count = dv.getUint16(e + 10, true);
  let o = dv.getUint32(e + 16, true);
  const out = new Map();
  for (let i = 0; i < count; i++) {
    if (o + 46 > u.length || dv.getUint32(o, true) !== 0x02014b50) return null;
    const nl = dv.getUint16(o + 28, true), xl = dv.getUint16(o + 30, true), cl = dv.getUint16(o + 32, true);
    const name = new TextDecoder().decode(u.subarray(o + 46, o + 46 + nl));
    out.set(name, dv.getUint32(o + 16, true));
    o += 46 + nl + xl + cl;
  }
  return out;
}

export function badPath(name) {
  if (!name || name.length > 200) return "empty or too long";
  if (name.includes("\0")) return "contains a null byte";
  if (name.includes("\\")) return "contains a backslash";
  if (name.startsWith("/") || /^[A-Za-z]:/.test(name)) return "is an absolute path";
  if (name.split("/").some((s) => s === ".." || s === ".")) return "escapes the archive (.. or . segment)";
  if (/[\u0000-\u001f]/.test(name)) return "contains control characters";
  return null;
}

// Returns { files: Map<string, Uint8Array>, errors: [{code, path, msg}] }. Never throws.
export function readArchive(bytes, limits = LIMITS) {
  const errors = [];
  const files = new Map();
  const err = (code, path, msg) => errors.push({ code, path, msg });
  if (bytes.length > limits.zipBytes) { err("limit.zip", "", `archive is ${bytes.length} bytes, limit ${limits.zipBytes}`); return { files, errors }; }
  if (bytes.length < 22 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) { err("zip.invalid", "", "not a zip archive"); return { files, errors }; }

  // Pass 1: look at the directory only (nothing is decompressed).
  const entries = [];
  try {
    unzipSync(bytes, { filter: (f) => { entries.push({ name: f.name, size: f.size, originalSize: f.originalSize, compression: f.compression }); return false; } });
  } catch (e) { err("zip.invalid", "", "cannot read zip directory: " + e.message); return { files, errors }; }

  if (entries.length > limits.entries) { err("limit.entries", "", `${entries.length} entries, limit ${limits.entries}`); return { files, errors }; }
  const seen = new Set();
  let total = 0;
  const wanted = new Set();
  for (const e of entries) {
    if (e.name.endsWith("/")) continue;
    const bad = badPath(e.name);
    if (bad) { err("zip.path", e.name, `entry name ${bad}`); continue; }
    if (seen.has(e.name)) { err("zip.duplicate", e.name, "duplicate entry name"); continue; }
    seen.add(e.name);
    if (e.compression !== 0 && e.compression !== 8) { err("zip.method", e.name, `unsupported compression method ${e.compression}`); continue; }
    total += e.originalSize;
    const cap = e.name === "data.json" ? limits.dataBytes : e.name === "manifest.json" ? limits.manifestBytes : limits.imageBytes;
    if (e.originalSize > cap) { err("limit.entry", e.name, `${e.originalSize} bytes uncompressed, limit ${cap}`); continue; }
    wanted.add(e.name);
  }
  if (total > limits.uncompressedBytes) { err("limit.uncompressed", "", `total uncompressed size ${total} bytes, limit ${limits.uncompressedBytes}`); return { files, errors }; }

  // Pass 2: decompress only accepted entries, and check the real size matches what was declared.
  const crcs = declaredCrcs(bytes);
  const declared = new Map(entries.map((e) => [e.name, e.originalSize]));
  for (const name of wanted) {
    try {
      const out = unzipSync(bytes, { filter: (f) => f.name === name });
      const data = out[name];
      if (!data || data.length !== declared.get(name)) { err("zip.size-lie", name, "decompressed size differs from the size the archive declares"); continue; }
      if (crcs && crcs.has(name) && crcs.get(name) !== crc32(data)) { err("zip.corrupt", name, "contents do not match the checksum in the archive"); continue; }
      files.set(name, data);
    } catch (e) { err("zip.corrupt", name, "cannot decompress: " + e.message); }
  }
  return { files, errors };
}

// Reads a guide folder. Dot files and folders are ignored. Returns { files, errors }.
export function readDir(dir, limits = LIMITS) {
  const files = new Map();
  const errors = [];
  const walk = (abs, rel) => {
    for (const name of readdirSync(abs)) {
      if (name.startsWith(".")) continue;
      const p = join(abs, name);
      const r = rel ? rel + "/" + name : name;
      const st = statSync(p);
      if (st.isDirectory()) walk(p, r);
      else if (files.size >= limits.entries) { errors.push({ code: "limit.entries", path: r, msg: "too many files" }); return; }
      else files.set(r, new Uint8Array(readFileSync(p)));
    }
  };
  walk(dir, "");
  return { files, errors };
}

// Deterministic zip: sorted entries, fixed timestamp, one compression level.
export function writeArchive(entries) {
  const stamp = new Date(1980, 0, 1, 0, 0, 0);
  const out = {};
  for (const name of [...entries.keys()].sort()) {
    const data = entries.get(name);
    out[name] = [typeof data === "string" ? strToU8(data) : data, { level: name.endsWith(".json") ? 9 : 0, mtime: stamp }];
  }
  return zipSync(out);
}
