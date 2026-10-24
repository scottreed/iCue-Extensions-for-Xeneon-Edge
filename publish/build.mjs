// Renders the Marketplace listing images (1920x960 PNG) for every widget from the real widget code with mock data.
// Output: publish/now-playing/*.png and publish/spotify-library/*.png
// Usage: node publish/build.mjs            (all widgets)
//        node publish/build.mjs now-playing | spotify-library | game-guide
// Needs Microsoft Edge or Chrome installed.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, "src");              // generated helper pages (gitignored)
mkdirSync(src, { recursive: true });
const only = process.argv[2];

const browsers = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
];
const browser = browsers.find(existsSync);
if (!browser) throw new Error("Edge or Chrome not found");

/* ---------- shared composition helpers ---------- */
function dev(w, h, scale, params, file = "frame.html") {
  const qs = new URLSearchParams(params).toString();
  return `<div class="dev" style="width:${w * scale + 24}px;height:${h * scale + 24}px"><div class="clip" style="width:${w * scale}px;height:${h * scale}px"><iframe src="${file}?${qs}" width="${w}" height="${h}" style="transform:scale(${scale})"></iframe></div></div>`;
}
const baseCss = (glow) => `*{box-sizing:border-box;margin:0}html,body{width:1920px;height:960px;overflow:hidden}
body{font-family:"Segoe UI",sans-serif;color:#fff;background:radial-gradient(1200px 700px at 78% 30%,${glow} 0%,#0b0b14 60%),#0b0b14;position:relative}
.dev{background:#16161d;border-radius:28px;padding:12px;box-shadow:0 30px 80px rgba(0,0,0,.55),0 0 0 2px #2a2a35;flex:none}
.clip{border-radius:18px;overflow:hidden;position:relative}
iframe{border:0;transform-origin:0 0;display:block}
h1{font-size:104px;font-weight:700;letter-spacing:-2px;line-height:1}
h2{font-size:64px;font-weight:700;letter-spacing:-1px}
p.sub{font-size:34px;opacity:.7;line-height:1.35}
.tag{display:inline-block;font-size:24px;letter-spacing:3px;text-transform:uppercase;color:#7dd3fc;margin-bottom:24px}
.cap{font-size:28px;opacity:.75;text-align:center;margin-top:22px}`;
const pageWith = (css) => (inner) => `<!DOCTYPE html><html><head><meta charset="UTF-8" /><style>${css}</style></head><body>${inner}</body></html>`;

function shoot(name, html, outDir) {
  mkdirSync(outDir, { recursive: true });
  const htmlPath = join(src, `${outDir.split(/[\\/]/).pop()}__${name}.html`);
  writeFileSync(htmlPath, html);
  execFileSync(browser, [
    "--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1",
    "--allow-file-access-from-files", "--virtual-time-budget=6000", "--window-size=1920,960",
    `--screenshot=${join(outDir, name + ".png")}`, pathToFileURL(htmlPath).href,
  ], { stdio: "ignore" });
  console.log("wrote", outDir.split(/[\\/]/).pop() + "/" + name + ".png");
}

/* ---------- Now Playing ---------- */
function buildNowPlaying() {
  const widget = join(here, "..", "widgets", "now-playing");
  const index = readFileSync(join(widget, "index.html"), "utf8");
  const body = index.match(/<body>([\s\S]*)<\/body>/)[1]
    .replace(/<link[^>]*>/g, "")
    .replace(/<script[^>]*><\/script>/g, "");
  // frame.html: the real widget markup + CSS + JS with a mocked iCUE media plugin driven by query params
  const frame = `<!DOCTYPE html>
<html><head><meta charset="UTF-8" /><title>frame</title>
<link rel="stylesheet" href="../../widgets/now-playing/style.css" /></head>
<body>${body}
<script>
const q = new URLSearchParams(location.search);
const palettes = {
  1: ["#ff5f6d", "#ffc371", "#2b1055"],
  2: ["#00c6ff", "#0072ff", "#06142e"],
  3: ["#b24bf3", "#ff7ac6", "#1a0b2e"],
};
const p = palettes[q.get("art") || 1];
const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + p[0] + '"/><stop offset="1" stop-color="' + p[2] + '"/></linearGradient></defs><rect width="200" height="200" fill="url(#g)"/><circle cx="130" cy="70" r="46" fill="' + p[1] + '" opacity=".9"/><circle cx="70" cy="140" r="64" fill="' + p[0] + '" opacity=".35"/><path d="M0 150 Q50 110 100 140 T200 120 V200 H0Z" fill="' + p[2] + '" opacity=".7"/></svg>';
const sig = () => ({ connect() {} });
window.plugins = { Mediadataprovider: {
  songName: q.get("title") || "Neon Skyline", artist: q.get("artist") || "The Midnight Tapes", album: q.get("album") || "After Hours",
  thumbnail: "data:image/svg+xml;utf8," + encodeURIComponent(svg), isPlaying: q.get("playing") !== "0",
  songNameChanged: sig(), artistChanged: sig(), albumChanged: sig(), thumbnailChanged: sig(), isPlayingChanged: sig(),
  triggerPlayPause() {}, triggerNextTrack() {}, triggerPreviousTrack() {},
} };
window.backgroundColor = "#14141c"; window.transparency = 100; // opaque in listing images
["textColor", "accentColor", "backgroundColor", "transparency"].forEach((k) => { if (q.get(k)) window[k] = q.get(k); });
window.iCUE_initialized = true;
</script>
<script src="../../widgets/now-playing/app.js"></script>
</body></html>`;
  writeFileSync(join(src, "frame.html"), frame);

  const W = 840;
  const page = pageWith(baseCss("#1d2350"));
  const pages = {
    thumbnail: page(`
    <div style="position:absolute;left:110px;top:0;bottom:0;width:760px;display:flex;flex-direction:column;justify-content:center">
      <span class="tag">XENEON EDGE widget</span><h1>Now<br>Playing</h1>
      <p class="sub" style="margin-top:36px">Track, album art and big touch controls for whatever is playing on your PC.</p></div>
    <div style="position:absolute;left:900px;top:120px">${dev(W, 344, 1.0, { art: 1 })}</div>
    <div style="position:absolute;left:1010px;top:560px">${dev(W, 344, 0.9, { art: 2, accentColor: "#38bdf8", title: "Aurora Drive", artist: "Glass Harbour", album: "Low Tide" })}</div>`),
    "gallery-1-overview": page(`
    <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center">
      <h2 style="margin-bottom:56px">Your music, at a glance</h2>${dev(W, 344, 1.9, { art: 1 })}</div>`),
    "gallery-2-sizes": page(`
    <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:48px">
      <h2>Adapts to every slot</h2>
      <div style="display:flex;gap:60px;align-items:flex-end">
        <div>${dev(W, 344, 0.95, { art: 3, title: "Midnight Tape", artist: "Violet Static", album: "Side B" })}<p class="cap">Small</p></div>
        <div>${dev(W, 696, 0.62, { art: 3, title: "Midnight Tape", artist: "Violet Static", album: "Side B" })}<p class="cap">Medium</p></div>
      </div></div>`),
    "gallery-3-colours": page(`
    <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:48px">
      <h2>Make it yours</h2>
      <div style="display:flex;gap:40px">
        <div>${dev(W, 696, 0.6, { art: 1, accentColor: "#1db954" })}<p class="cap">Accent colour</p></div>
        <div>${dev(W, 696, 0.6, { art: 2, accentColor: "#38bdf8", backgroundColor: "#0b1220", title: "Aurora Drive", artist: "Glass Harbour", album: "Low Tide" })}<p class="cap">Background colour</p></div>
        <div>${dev(W, 696, 0.6, { art: 3, accentColor: "#f472b6", textColor: "#fde68a", backgroundColor: "#1a0b2e", title: "Midnight Tape", artist: "Violet Static", album: "Side B" })}<p class="cap">Text colour</p></div>
      </div></div>`),
  };
  for (const [name, html] of Object.entries(pages)) shoot(name, html, join(here, "now-playing"));
}

/* ---------- Player for Spotify (Extra Large, 2536 x 696, rendered from the widget's own mock mode) ---------- */
function buildSpotify() {
  const widget = join(here, "..", "widgets", "spotify-library");
  const baseHref = pathToFileURL(widget).href + "/";

  // One copy of the real index.html per colour variant. <base> lets it load the widget's own CSS and scripts;
  // the globals set before app.js are what iCUE's settings controls would normally provide.
  function variant(file, globals) {
    let h = readFileSync(join(widget, "index.html"), "utf8");
    const pre = "<script>" + Object.entries(globals).map(([k, v]) => `window.${k}=${JSON.stringify(v)};`).join("") + "</script>\n";
    h = h.replace("<head>", `<head>\n<base href="${baseHref}" />`).replace('<script src="js/sha256.js"></script>', pre + '<script src="js/sha256.js"></script>');
    writeFileSync(join(src, file), h);
  }
  variant("sp-default.html", { backgroundColor: "#121212", transparency: 100 });
  variant("sp-pink.html", { accentColor: "#f472b6", textColor: "#fde68a", backgroundColor: "#1a0b2e", transparency: 100 });
  variant("sp-blue.html", { accentColor: "#38bdf8", backgroundColor: "#0b1220", transparency: 100 });

  const xl = (file, extra, scale) => dev(2536, 696, scale, { mock: 1, ...extra }, file);
  const S = 0.72; // 2536 x 0.72 = 1826 px wide, fits the 1920 canvas
  const page = pageWith(baseCss("#10301f") + ".sub2{font-size:30px;opacity:.7;text-align:center}");
  const centred = (heading, inner, sub) => page(`
    <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:44px">
      <h2>${heading}</h2>${inner}${sub ? `<p class="sub2">${sub}</p>` : ""}</div>`);

  const pages = {
    thumbnail: page(`
    <div style="position:absolute;left:70px;top:64px;width:1780px">
      <span class="tag" style="color:#86efac">XENEON EDGE widget &middot; full screen</span>
      <h1 style="font-size:96px;white-space:nowrap">Player for Spotify</h1>
      <p class="sub" style="margin-top:22px;font-size:32px">Your playlists and artists, your queue and what's playing, all on one screen. Tap to play.</p></div>
    <div style="position:absolute;left:35px;top:396px">${xl("sp-default.html", {}, S)}</div>`),
    "gallery-1-library": centred("Your whole library, full screen",
      xl("sp-default.html", {}, S), "Playlists and artists &middot; Up next &middot; Now playing"),
    "gallery-2-playlist": centred("Open a playlist, tap a song",
      xl("sp-default.html", { open: "p1" }, S), "Songs with artwork, and the song that is playing is highlighted"),
    "gallery-3-artists": centred("Follow an artist, play their songs",
      xl("sp-default.html", { open: "a1" }, S), "Your followed artists sit alongside your playlists, most recent first"),
    "gallery-4-colours": page(`
    <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:30px">
      <h2>Make it yours</h2>
      ${xl("sp-pink.html", {}, 0.48)}
      ${xl("sp-blue.html", { open: "a1" }, 0.48)}
    </div>`),
  };
  for (const [name, html] of Object.entries(pages)) shoot(name, html, join(here, "spotify-library"));
}

/* ---------- Game Guide (Extra Large, 2536 x 696, rendered from the widget's own mock mode with the built-in sample guide) ---------- */
function buildGameGuide() {
  const widget = join(here, "..", "widgets", "game-guide");
  const baseHref = pathToFileURL(widget).href + "/";
  function variant(file, globals) {
    let h = readFileSync(join(widget, "index.html"), "utf8");
    const pre = "<script>" + Object.entries(globals).map(([k, v]) => `window.${k}=${JSON.stringify(v)};`).join("") + "</script>\n";
    h = h.replace("<head>", `<head>\n<base href="${baseHref}" />`).replace('<script src="js/fflate.js"></script>', pre + '<script src="js/fflate.js"></script>');
    writeFileSync(join(src, file), h);
  }
  variant("gg-default.html", { backgroundColor: "#0e1116", transparency: 100 });
  variant("gg-amber.html", { accentColor: "#f5a524", textColor: "#fff3d6", backgroundColor: "#1c1208", transparency: 100 });
  variant("gg-green.html", { accentColor: "#34d399", backgroundColor: "#06180f", transparency: 100 });

  const xl = (file, extra, scale) => dev(2536, 696, scale, { mock: 1, mem: 1, ...extra }, file);
  const S = 0.72;
  const page = pageWith(baseCss("#10223d") + ".sub2{font-size:30px;opacity:.7;text-align:center}");
  const centred = (heading, inner, sub) => page(`
    <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:44px">
      <h2>${heading}</h2>${inner}${sub ? `<p class="sub2">${sub}</p>` : ""}</div>`);

  const pages = {
    thumbnail: page(`
    <div style="position:absolute;left:70px;top:64px;width:1780px">
      <span class="tag">XENEON EDGE widget &middot; full screen</span>
      <h1 style="font-size:96px;white-space:nowrap">Game Guide</h1>
      <p class="sub" style="margin-top:22px;font-size:32px">Walkthroughs, checklists and maps beside your game. Import any guide, tick things off, tap a pin.</p></div>
    <div style="position:absolute;left:35px;top:396px">${xl("gg-default.html", { page: "ch1" }, S)}</div>`),
    "gallery-1-two-panes": centred("Read and look, side by side", xl("gg-default.html", { page: "ch1" }, S), "Two equal panes: a page, a checklist, a table, a map or a skill tree in either"),
    "gallery-2-checklist-map": centred("Tick it off, find it on the map", xl("gg-default.html", { page: "lanterns", type: "collection" }, S), "Checklists with missable warnings and requirements, linked to pins on the map"),
    "gallery-3-skill-tree": centred("Plan your build", xl("gg-default.html", { active: 1, page: "skills", type: "tree" }, S), "Skill trees with requirements and preset builds"),
    "gallery-4-fullscreen": centred("Maps at full size", xl("gg-default.html", { full: "map:island" }, S), "Drag, pinch to zoom, and open any map or picture full screen"),
    "gallery-5-colours": page(`
    <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:30px">
      <h2>Make it yours</h2>
      ${xl("gg-amber.html", { page: "ch2" }, 0.48)}
      ${xl("gg-green.html", { page: "lanterns", type: "collection" }, 0.48)}
    </div>`),
  };
  for (const [name, html] of Object.entries(pages)) shoot(name, html, join(here, "game-guide"));
}

if (!only || only === "now-playing") buildNowPlaying();
if (!only || only === "spotify-library") buildSpotify();
if (!only || only === "game-guide") buildGameGuide();
