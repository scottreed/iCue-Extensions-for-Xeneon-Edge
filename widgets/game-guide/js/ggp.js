/* Safe reader for .ggp archives (format v1.0). Mirrors skills/ggp-guide-builder/scripts/lib/archive.mjs: same limits, same path rules.
   Never trusts the sizes a zip declares: it checks the directory first, then the real size and CRC-32 of each entry it reads. */
var GGP = (function () {
  var MB = 1024 * 1024;
  var LIM = { zip: 60 * MB, data: 5 * MB, manifest: 256 * 1024, image: 8 * MB, uncompressed: 300 * MB, entries: 5000 };
  var MIME = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", svg: "image/svg+xml" };
  var ID_RE = /^[a-z0-9._-]{1,64}$/;

  function fail(msg) { var e = new Error(msg); e.friendly = true; return e; }

  function badPath(n) {
    if (!n || n.length > 200) return "empty or too long";
    if (n.indexOf("\0") >= 0) return "contains a null byte";
    if (n.indexOf("\\") >= 0) return "contains a backslash";
    if (n.charAt(0) === "/" || /^[A-Za-z]:/.test(n)) return "is an absolute path";
    if (n.split("/").some(function (s) { return s === ".." || s === "."; })) return "escapes the archive";
    return null;
  }

  var CRC = (function () { var t = new Int32Array(256); for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; } return t; })();
  function crc32(b) { var c = -1; for (var i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; }

  function declaredCrcs(u) {
    var dv = new DataView(u.buffer, u.byteOffset, u.byteLength);
    var e = u.length - 22;
    while (e >= 0 && e > u.length - 22 - 65536 && dv.getUint32(e, true) !== 0x06054b50) e--;
    if (e < 0 || dv.getUint32(e, true) !== 0x06054b50) return null;
    var count = dv.getUint16(e + 10, true), o = dv.getUint32(e + 16, true), out = {};
    var dec = new TextDecoder();
    for (var i = 0; i < count; i++) {
      if (o + 46 > u.length || dv.getUint32(o, true) !== 0x02014b50) return null;
      var nl = dv.getUint16(o + 28, true), xl = dv.getUint16(o + 30, true), cl = dv.getUint16(o + 32, true);
      out[dec.decode(u.subarray(o + 46, o + 46 + nl))] = dv.getUint32(o + 16, true);
      o += 46 + nl + xl + cl;
    }
    return out;
  }

  function parseJson(bytes, what) {
    try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
    catch (e) { throw fail(what + " is not valid JSON"); }
  }

  /* Opens an archive. Throws an Error with .friendly = true and a short message that can be shown to the user.
     Returns { manifest, data, read(path) -> Uint8Array, assetInfo(id) -> {path, mime} | null, size }. */
  function open(bytes) {
    if (!(bytes instanceof Uint8Array)) bytes = new Uint8Array(bytes);
    if (bytes.length > LIM.zip) throw fail("This file is larger than 60 MB, the biggest guide the widget accepts.");
    if (bytes.length < 22 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) throw fail("This is not a guide file (not a zip archive).");

    var entries = [];
    try { fflate.unzipSync(bytes, { filter: function (f) { entries.push({ name: f.name, originalSize: f.originalSize, compression: f.compression }); return false; } }); }
    catch (e) { throw fail("This guide file is damaged (cannot read its contents list)."); }
    if (entries.length > LIM.entries) throw fail("This guide has too many files.");

    var table = {}, total = 0;
    entries.forEach(function (e) {
      if (e.name.charAt(e.name.length - 1) === "/") return;
      var bad = badPath(e.name);
      if (bad) throw fail("This guide is unsafe: a file name " + bad + ".");
      if (Object.prototype.hasOwnProperty.call(table, e.name)) throw fail("This guide is damaged (duplicate file names).");
      if (e.compression !== 0 && e.compression !== 8) throw fail("This guide uses an unsupported zip compression.");
      var cap = e.name === "data.json" ? LIM.data : e.name === "manifest.json" ? LIM.manifest : LIM.image;
      if (e.originalSize > cap) throw fail("A file inside this guide is too large (" + e.name + ").");
      total += e.originalSize;
      table[e.name] = e.originalSize;
    });
    if (total > LIM.uncompressed) throw fail("This guide would expand to more than 300 MB.");

    var crcs = declaredCrcs(bytes);
    function read(path) {
      if (!Object.prototype.hasOwnProperty.call(table, path)) throw fail("The guide is missing " + path + ".");
      var out;
      try { out = fflate.unzipSync(bytes, { filter: function (f) { return f.name === path; } })[path]; }
      catch (e) { throw fail("Could not unpack " + path + " (the guide may be damaged)."); }
      if (!out || out.length !== table[path]) throw fail("The guide is damaged (" + path + " has the wrong size).");
      if (crcs && Object.prototype.hasOwnProperty.call(crcs, path) && crcs[path] !== crc32(out)) throw fail("The guide is damaged (" + path + " failed its checksum).");
      return out;
    }

    var manifest = parseJson(read("manifest.json"), "manifest.json");
    var data = parseJson(read("data.json"), "data.json");
    var g = manifest && manifest.guide;
    if (!manifest || typeof manifest !== "object" || manifest.formatVersion !== "1.0") throw fail("This guide was made for a different format version.");
    if (!g || typeof g.id !== "string" || !ID_RE.test(g.id) || typeof g.title !== "string" || !g.title) throw fail("This guide has no valid id or title.");
    if (!data || typeof data !== "object" || !Array.isArray(data.navigation) || !Array.isArray(data.pages)) throw fail("This guide has no contents.");

    var assets = {};
    (Array.isArray(manifest.assets) ? manifest.assets : []).forEach(function (a) {
      if (!a || typeof a.id !== "string" || typeof a.path !== "string" || badPath(a.path) || a.path.indexOf("assets/") !== 0 || !Object.prototype.hasOwnProperty.call(table, a.path)) return;
      var ext = a.path.split(".").pop().toLowerCase();
      if (MIME[ext]) assets[a.id] = { path: a.path, mime: MIME[ext], alt: typeof a.alt === "string" ? a.alt : "" };
    });
    return { manifest: manifest, data: data, read: read, assetInfo: function (id) { return Object.prototype.hasOwnProperty.call(assets, id) ? assets[id] : null; }, size: bytes.length };
  }

  /* Image bytes -> data: URL (data: URLs are known to work inside iCUE; blob: is untested). */
  function toDataUrl(bytes, mime) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(String(r.result)); };
      r.onerror = function () { reject(r.error); };
      r.readAsDataURL(new Blob([bytes], { type: mime }));
    });
  }

  return { open: open, toDataUrl: toDataUrl, LIMITS: LIM };
})();
