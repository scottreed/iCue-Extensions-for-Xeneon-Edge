// Reads image width/height from file headers (no image library needed) and checks the magic bytes.

export function sniffImage(bytes, mime) {
  const u = bytes;
  const be32 = (o) => ((u[o] << 24) | (u[o + 1] << 16) | (u[o + 2] << 8) | u[o + 3]) >>> 0;
  if (mime === "image/png") {
    const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    if (u.length < 24 || sig.some((b, i) => u[i] !== b)) return { ok: false };
    return { ok: true, width: be32(16), height: be32(20) };
  }
  if (mime === "image/jpeg") {
    if (u.length < 4 || u[0] !== 0xff || u[1] !== 0xd8) return { ok: false };
    let o = 2;
    while (o + 9 < u.length) {
      if (u[o] !== 0xff) { o++; continue; }
      const m = u[o + 1];
      if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7) || m === 0xff) { o += m === 0xff ? 1 : 2; continue; }
      const len = (u[o + 2] << 8) | u[o + 3];
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
        return { ok: true, height: (u[o + 5] << 8) | u[o + 6], width: (u[o + 7] << 8) | u[o + 8] };
      }
      if (len < 2) break;
      o += 2 + len;
    }
    return { ok: true };
  }
  if (mime === "image/webp") {
    const tag = (o) => String.fromCharCode(u[o], u[o + 1], u[o + 2], u[o + 3]);
    if (u.length < 30 || tag(0) !== "RIFF" || tag(8) !== "WEBP") return { ok: false };
    const kind = tag(12);
    if (kind === "VP8X") return { ok: true, width: 1 + (u[24] | (u[25] << 8) | (u[26] << 16)), height: 1 + (u[27] | (u[28] << 8) | (u[29] << 16)) };
    if (kind === "VP8L") {
      const b = u[21] | (u[22] << 8) | (u[23] << 16) | (u[24] << 24);
      return { ok: true, width: 1 + (b & 0x3fff), height: 1 + ((b >> 14) & 0x3fff) };
    }
    if (kind === "VP8 ") return { ok: true, width: (u[26] | (u[27] << 8)) & 0x3fff, height: (u[28] | (u[29] << 8)) & 0x3fff };
    return { ok: true };
  }
  if (mime === "image/svg+xml") {
    const text = new TextDecoder("utf-8").decode(u.subarray(0, Math.min(u.length, 4096)));
    return { ok: /<svg[\s>]/i.test(text) };
  }
  return { ok: false };
}

// SVG is shown through <img>, where scripts do not run, but we still refuse active content.
export function svgIsUnsafe(bytes) {
  const text = new TextDecoder("utf-8").decode(bytes);
  return /<script[\s>]|\son[a-z]+\s*=|<foreignObject|javascript:|<!ENTITY/i.test(text);
}
