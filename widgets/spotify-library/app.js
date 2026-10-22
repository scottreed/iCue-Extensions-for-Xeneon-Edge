icueEvents ={ onDataUpdated: onProps, onICUEInitialized: onProps };
pluginMediadataproviderEvents = { onInitialized: bindMedia };
pluginLinkproviderEvents = { onInitialized: function () {} };

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = (ms) => { const s = Math.max(0, Math.round((ms || 0) / 1000)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };

function prop(name, fallback) {
  if (Object.prototype.hasOwnProperty.call(window, name)) {
    const v = window[name];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  try {
    const v = Function('return typeof ' + name + ' !== "undefined" ? ' + name + " : undefined")();
    if (v !== undefined && v !== null && v !== "") return v;
  } catch (e) {}
  return fallback;
}

const POLL_MS = 4000;
const S = {
  mock: new URLSearchParams(location.search).has("mock"),
  phase: "setup", // setup | connect | ready
  player: null, playerAt: 0, queue: [], queueKey: "",
  playlists: null, open: null, tracks: {}, trackState: "", // trackState: "" | loading | denied | error
  libKey: "", err: "", msgTimer: 0, pollTimer: 0, polling: false,
  cfgKey: "", media: null,
};

/* ---------- properties and boot ---------- */

function applyStyle() {
  const s = document.documentElement.style;
  s.setProperty("--text", prop("textColor", "#FFFFFF"));
  s.setProperty("--accent", prop("accentColor", "#1DB954"));
  s.setProperty("--bg", prop("backgroundColor", "#121212"));
}

function onProps() {
  applyStyle();
  const cfg = { clientId: prop("spotifyClientId", ""), redirectUri: prop("spotifyRedirectUri", "") };
  Auth.configure(cfg);
  const code = String(prop("spotifyAuthCode", "")).trim();
  const key = cfg.clientId + "|" + cfg.redirectUri;
  if (code && code !== Auth.lastCode() && Auth.ready() && !S.mock) {
    Auth.exchangeCode(code).then(() => { say("Connected to Spotify"); start(); }, (e) => { say("Sign-in failed: " + e.message, 8000); start(); });
    return;
  }
  if (key !== S.cfgKey || S.phase === "setup") { S.cfgKey = key; start(); }
}

function start() {
  clearTimeout(S.pollTimer);
  if (S.mock) { loadMock(); return; }
  if (Auth.hasSession()) {
    S.phase = "ready";
    render();
    loadPlaylists();
    poll();
  } else {
    S.phase = Auth.ready() ? "connect" : "setup";
    render();
  }
}

function loadMock() {
  S.phase = "ready";
  S.player = Mock.player; S.playerAt = Date.now();
  S.queue = Mock.queue.queue;
  S.playlists = Mock.playlists;
  S.tracks = Mock.tracks;
  const p = new URLSearchParams(location.search);
  if (p.get("open")) { S.open = Mock.playlists.find((x) => x.id === p.get("open")) || null; }
  if (p.get("tab")) $("app").dataset.tab = p.get("tab");
  if (p.get("view")) $("app").dataset.view = p.get("view");
  if (p.get("paused")) Mock.player.is_playing = false;
  render();
  tickProgress();
}

/* ---------- Spotify data ---------- */

async function poll() {
  if (S.polling || S.phase !== "ready") return;
  S.polling = true;
  let delay = POLL_MS;
  try {
    const p = await Api.player();
    const prevId = S.player && S.player.item && S.player.item.id;
    S.player = p; S.playerAt = Date.now();
    const id = p && p.item && p.item.id;
    if (id !== prevId || !S.queueKey) await loadQueue();
    renderNow();
    renderLists();
  } catch (e) {
    if (e.status === 429) delay = 10000;
    else if (e.status === 401 || e.code === "invalid_grant") { S.phase = Auth.hasSession() ? "ready" : "connect"; render(); }
    else say(e.message);
  }
  S.polling = false;
  S.pollTimer = setTimeout(poll, delay);
}

function pollSoon() { clearTimeout(S.pollTimer); S.pollTimer = setTimeout(poll, 700); }

async function loadQueue() {
  try {
    const q = await Api.queue();
    S.queue = (q && q.queue) || [];
    S.queueKey = S.queue.map((t) => t.id).join(",") || "empty";
  } catch (e) { if (e.status !== 429) say(e.message); }
}

async function loadPlaylists() {
  try {
    S.playlists = await Api.playlists();
    renderLists();
  } catch (e) { say("Couldn't load your library: " + e.message, 6000); }
}

async function openPlaylist(id) {
  const pl = (S.playlists || []).find((p) => p.id === id);
  if (!pl) return;
  S.open = pl;
  if (!S.tracks[id]) {
    S.trackState = "loading";
    renderLists();
    try {
      const items = await Api.playlistItems(id);
      S.tracks[id] = items.map((e) => e.item || e.track).filter((t) => t && t.uri);
      S.trackState = "";
    } catch (e) {
      S.trackState = e.status === 403 || e.status === 404 ? "denied" : "error";
    }
  }
  renderLists();
}

/* ---------- controls ---------- */

function mediaPlugin() { return window.plugins && window.plugins.Mediadataprovider; }

async function control(kind) {
  const m = mediaPlugin();
  if (S.mock) {
    if (kind === "play") Mock.player.is_playing = !Mock.player.is_playing;
    renderNow();
    return;
  }
  if (S.phase !== "ready") {
    if (!m) return;
    if (kind === "prev") m.triggerPreviousTrack(); else if (kind === "next") m.triggerNextTrack(); else m.triggerPlayPause();
    return;
  }
  try {
    if (kind === "prev") await Api.previous();
    else if (kind === "next") await Api.next();
    else if (S.player && S.player.is_playing) { S.player.is_playing = false; renderNow(); await Api.pause(); }
    else { if (S.player) S.player.is_playing = true; renderNow(); await Api.resume(); }
    pollSoon();
  } catch (e) { say(controlError(e)); pollSoon(); }
}

function controlError(e) {
  if (e.status === 403) return "Playback control needs Spotify Premium";
  if (e.status === 404) return "No active device. Start Spotify on this PC";
  return e.message;
}

async function playFrom(uri, trackUri) {
  if (S.mock) { return; }
  try { await Api.playContext(uri, trackUri); pollSoon(); } catch (e) { say(controlError(e)); }
}

function openLink(url) {
  const l = window.plugins && window.plugins.Linkprovider;
  if (l && typeof pluginLinkprovider_initialized !== "undefined" && pluginLinkprovider_initialized) l.open(url);
  else window.open(url, "_blank");
}

/* ---------- rendering ---------- */

function say(text, ms) {
  const el = $("msg");
  el.textContent = text;
  el.classList.add("show");
  clearTimeout(S.msgTimer);
  S.msgTimer = setTimeout(() => el.classList.remove("show"), ms || 4000);
}

function nowItem() {
  const it = S.player && S.player.item;
  if (it) {
    const img = (it.album && it.album.images && it.album.images[0] && it.album.images[0].url) || "";
    return { title: it.name, artist: (it.artists || []).map((a) => a.name).join(", "), art: img, playing: !!S.player.is_playing,
      progress: S.player.progress_ms || 0, duration: it.duration_ms || 0, url: (it.external_urls && it.external_urls.spotify) || "" };
  }
  const m = mediaPlugin();
  if (m && m.songName) return { title: m.songName, artist: m.artist, art: m.thumbnail || "", playing: !!m.isPlaying, progress: 0, duration: 0, url: "" };
  return null;
}

function artOf(images) { return (images && (images[images.length > 1 ? 1 : 0] || images[0]) || {}).url || ""; }

function renderNow() {
  const n = nowItem();
  $("title").textContent = n ? n.title : (S.phase === "ready" ? "Nothing playing" : "Library Player");
  $("artist").textContent = n ? n.artist : (S.phase === "ready" ? "Start Spotify on this PC" : "");
  const img = $("img");
  if (n && n.art) { if (img.getAttribute("src") !== n.art) img.src = n.art; img.classList.add("show"); } else img.classList.remove("show");
  $("app").classList.toggle("playing", !!(n && n.playing));
  $("app").classList.toggle("idle", !n);
  $("brand").style.visibility = n && n.url ? "visible" : "hidden";
  S.nowUrl = n ? n.url : "";
  tickProgress();
}

function tickProgress() {
  const n = nowItem();
  const live = n && n.playing ? Date.now() - S.playerAt : 0;
  const pos = n ? Math.min(n.duration, n.progress + live) : 0;
  $("fill").style.width = n && n.duration ? (100 * pos / n.duration).toFixed(1) + "%" : "0%";
  $("tcur").textContent = n && n.duration ? fmt(pos) : "";
  $("tdur").textContent = n && n.duration ? fmt(n.duration) : "";
}
setInterval(tickProgress, 500);

function row(html, attrs, cls) { return '<div class="row' + (cls ? " " + cls : "") + '" ' + (attrs || "") + ">" + html + "</div>"; }
function cover(url) { return '<span class="cv">' + (url ? '<img src="' + esc(url) + '" alt="" />' : "") + "</span>"; }

function renderLists() {
  renderLib();
  renderQueue();
}

function setList(el, html) {
  if (el.dataset.html === html) return;
  const top = el.scrollTop;
  el.innerHTML = html;
  el.dataset.html = html;
  el.scrollTop = top;
}

function renderLib() {
  const el = $("lib");
  if (S.phase !== "ready") { setList(el, ""); return; }
  if (!S.open) {
    if (!S.playlists) { setList(el, '<div class="hd"><span>Your library</span></div><div class="empty">Loading your playlists…</div>'); return; }
    const rows = S.playlists.slice(0, 50).map((p) => {
      const total = p.items ? p.items.total : (p.tracks ? p.tracks.total : null);
      const sub = total == null ? "Play only" : total + " songs";
      return row(cover(artOf(p.images)) + '<span class="tx"><b>' + esc(p.name) + "</b><small>" + sub + "</small></span>" + '<span class="chev">&#8250;</span>',
        'data-act="open" data-id="' + esc(p.id) + '"');
    }).join("");
    setList(el, '<div class="hd"><span>Your library</span><span>' + S.playlists.length + " playlists</span></div>" + (rows || '<div class="empty">No playlists yet.</div>'));
    return;
  }
  const pl = S.open, tr = S.tracks[pl.id] || [];
  const curId = S.player && S.player.item && S.player.item.id;
  let body;
  if (S.trackState === "loading") body = '<div class="empty">Loading songs…</div>';
  else if (S.trackState === "denied") body = '<div class="empty">Spotify doesn\'t share this playlist\'s songs with this app. You can still play it.</div>';
  else if (S.trackState === "error") body = '<div class="empty">Couldn\'t load songs. Try again.</div>';
  else body = tr.slice(0, 100).map((t, i) =>
    row('<span class="num">' + (t.id === curId ? "&#9835;" : i + 1) + '</span><span class="tx"><b>' + esc(t.name) + "</b><small>" + esc((t.artists || []).map((a) => a.name).join(", ")) + "</small></span>" +
      '<span class="dur">' + fmt(t.duration_ms) + "</span>", 'data-act="song" data-uri="' + esc(t.uri) + '"', t.id === curId ? "cur" : "")).join("") || '<div class="empty">This playlist is empty.</div>';
  setList(el, '<div class="hd"><button class="back" data-act="back" type="button">&#8249; ' + esc(pl.name) + '</button><button class="chip" data-act="playlist" type="button">Play</button></div>' + body);
}

function renderQueue() {
  const el = $("queue");
  if (S.phase !== "ready") { setList(el, ""); return; }
  const from = S.player && S.player.context && S.mock ? "From Late night drive" : "";
  const rows = S.queue.slice(0, 20).map((t) =>
    row(cover(artOf(t.album && t.album.images)) + '<span class="tx"><b>' + esc(t.name) + "</b><small>" + esc((t.artists || []).map((a) => a.name).join(", ")) + "</small></span>" +
      '<span class="dur">' + fmt(t.duration_ms) + "</span>")).join("");
  setList(el, '<div class="hd"><span>Up next</span><span>' + esc(from) + "</span></div>" + (rows || '<div class="empty">Nothing queued.</div>'));
}

function renderSetup() {
  const el = $("lib");
  let html;
  if (S.phase === "setup") {
    html = '<div class="setup"><b>Connect your Spotify account</b><p>Add your Spotify Client ID and Redirect page URL in this widget\'s settings in iCUE. The setup guide is in the project docs.</p></div>';
  } else {
    html = '<div class="setup"><b>Connect your Spotify account</b><p>1. Tap Connect and approve access in your browser. 2. Copy the code it shows. 3. Paste it into this widget\'s settings in iCUE.</p>' +
      '<button class="chip solid" data-act="connect" type="button">Connect</button></div>';
  }
  setList(el, html);
  setList($("queue"), "");
}

function render() {
  renderNow();
  if (S.phase === "ready") renderLists(); else renderSetup();
  $("app").dataset.phase = S.phase;
}

/* ---------- events ---------- */

document.addEventListener("click", (e) => {
  const t = e.target.closest("[data-act]");
  if (!t) return;
  const a = t.dataset.act;
  if (a === "prev" || a === "next" || a === "play") control(a);
  else if (a === "tab") { $("app").dataset.tab = t.dataset.tab; if (t.dataset.tab === "lib") { /* keep drill-in state */ } }
  else if (a === "browse") $("app").dataset.view = "browse";
  else if (a === "now") $("app").dataset.view = "now";
  else if (a === "open") openPlaylist(t.dataset.id);
  else if (a === "back") { S.open = null; S.trackState = ""; renderLib(); }
  else if (a === "song" && S.open) playFrom(S.open.uri, t.dataset.uri);
  else if (a === "playlist" && S.open) playFrom(S.open.uri);
  else if (a === "connect") Auth.startLogin().catch((err) => say(err.message));
  else if (a === "openspotify" && S.nowUrl) openLink(S.nowUrl);
});

/* ---------- media plugin (instant now-playing fallback and change trigger) ---------- */

let mediaBound = false;
function bindMedia() {
  const m = mediaPlugin();
  if (!m || mediaBound) return;
  mediaBound = true;
  ["songName", "artist", "album", "thumbnail", "isPlaying"].forEach((p) => {
    if (m[p + "Changed"]) m[p + "Changed"].connect(() => { renderNow(); if (S.phase === "ready" && !S.mock) pollSoon(); });
  });
  renderNow();
}

/* ---------- boot (iCUE injects its globals on its own schedule, so retry briefly) ---------- */

let bootTries = 0;
function boot() {
  const inside = typeof iCUE_initialized !== "undefined" && iCUE_initialized;
  if (inside) {
    onProps();
    if (typeof pluginMediadataprovider_initialized !== "undefined" && pluginMediadataprovider_initialized) bindMedia();
    return;
  }
  if (S.mock || bootTries++ >= 15) { onProps(); return; }
  setTimeout(boot, 100);
}
boot();
