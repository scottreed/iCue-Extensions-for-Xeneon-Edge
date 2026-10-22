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
  artists: null, recent: {}, recentLocal: null, recentAt: 0, needScope: false,
};

/* ---------- properties and boot ---------- */

function withAlpha(color, pct) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(color).trim());
  const a = Math.max(0, Math.min(100, Number(pct))) / 100;
  if (!m || isNaN(a) || a >= 1) return color;
  const n = parseInt(m[1], 16);
  return "rgba(" + (n >> 16) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + a + ")";
}

function applyStyle() {
  const s = document.documentElement.style;
  s.setProperty("--text", prop("textColor", "#FFFFFF"));
  s.setProperty("--accent", prop("accentColor", "#1DB954"));
  s.setProperty("--bg", withAlpha(prop("backgroundColor", "#121212"), prop("transparency", 100)));
}

function onProps() {
  applyStyle();
  if (S.phase === "ready" && S.playlists) renderLib();
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
  S.artists = Mock.artists;
  Mock.artists.forEach((a, k) => { S.tracks[a.id] = Array.from({ length: 10 }, (_, i) => Mock.track(i + k)); });
  S.recent["spotify:artist:a2"] = Date.now() - 1800000;
  S.recent = { "spotify:artist:a4": Date.now() - 120000, "spotify:playlist:p3": Date.now() - 60000, "spotify:playlist:p5": Date.now() - 3600000, "spotify:playlist:p2": Date.now() - 86400000 };
  S.recentLocal = {};
  const p = new URLSearchParams(location.search);
  if (p.get("open")) { S.open = Mock.playlists.concat(Mock.artists).find((x) => x.id === p.get("open")) || null; }
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
    if (p && p.context) noteContext(p.context.uri);
    if (id !== prevId || !S.queueKey) await loadQueue();
    if (id !== prevId && Date.now() - S.recentAt > 30000) loadRecent();
    renderNow();
    renderLists();
  } catch (e) {
    if (e.status === 429) delay = 10000;
    else if (e.status === 401 || e.code === "invalid_grant") { S.phase = Auth.hasSession() ? "ready" : "connect"; render(); }
    else say(friendly(e));
  }
  S.polling = false;
  S.pollTimer = setTimeout(poll, delay);
}

function pollSoon() { clearTimeout(S.pollTimer); S.pollTimer = setTimeout(poll, 700); }

// This widget is music only: queue entries that are not tracks (podcast episodes) are ignored.
const isMusic = (t) => !!t && typeof t.uri === "string" && t.uri.indexOf("spotify:track:") === 0;

async function loadQueue() {
  try {
    const q = await Api.queue();
    S.queue = ((q && q.queue) || []).filter(isMusic);
    S.queueKey = S.queue.map((t) => t.id).join(",") || "empty";
  } catch (e) { if (e.status !== 429) say(friendly(e)); }
}

/* ---------- library order: pinned (settings list), then most recently played, then Spotify order ---------- */

function recentKey() { return typeof uniqueId !== "undefined" && uniqueId ? "spotify-recent-" + uniqueId : "spotify-recent"; }
function readLocalRecent() { try { return JSON.parse(localStorage.getItem(recentKey()) || "{}"); } catch (e) { return {}; } }

// Remember playlists as they play, so the order updates instantly and works without the recently-played scope.
function noteContext(uri, force) {
  if (!uri || !/^spotify:(playlist|artist):/.test(uri)) return;
  const r = S.recentLocal || (S.recentLocal = readLocalRecent());
  if (!force && Date.now() - (r[uri] || 0) < 60000) return;
  r[uri] = Date.now();
  try { localStorage.setItem(recentKey(), JSON.stringify(r)); } catch (e) {}
}

function pinnedNames() {
  const q = S.mock ? new URLSearchParams(location.search).get("pinned") : null;
  return String(q || prop("pinnedPlaylists", "")).split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
}

function orderPlaylists(list) {
  const pins = pinnedNames();
  const local = S.recentLocal || (S.recentLocal = readLocalRecent());
  return list.map((p, i) => ({ p, i, pin: pins.indexOf(String(p.name).trim().toLowerCase()), t: Math.max(S.recent[p.uri] || 0, local[p.uri] || 0) }))
    .sort((a, b) => {
      const ap = a.pin >= 0, bp = b.pin >= 0;
      if (ap !== bp) return ap ? -1 : 1;
      if (ap) return a.pin - b.pin;
      if (a.t !== b.t) return b.t - a.t;
      return a.i - b.i;
    }).map((x) => Object.assign({}, x.p, { _pinned: x.pin >= 0 }));
}

async function loadRecent() {
  S.recentAt = Date.now();
  try {
    const r = await Api.recentlyPlayed();
    const map = {};
    ((r && r.items) || []).forEach((it) => {
      const c = it.context, t = Date.parse(it.played_at) || 0;
      if (c && (c.type === "playlist" || c.type === "artist") && c.uri && t > (map[c.uri] || 0)) map[c.uri] = t;
    });
    S.recent = map; S.needScope = false;
  } catch (e) { if (e.status === 403) S.needScope = true; }
  renderLib();
}

async function loadArtists() {
  try { S.artists = await Api.followedArtists(); }
  catch (e) { S.artists = []; if (e.status === 403) S.needScope = true; }
  renderLib();
}

// Songs for an artist: Spotify refuses its "top tracks" call to developer apps (403), so search for the artist's songs instead.
async function artistSongs(artist) {
  const r = await Api.searchTracks(artist.name);
  return ((r && r.tracks && r.tracks.items) || []).filter((t) => t && t.uri && (t.artists || []).some((a) => a.id === artist.id));
}

async function loadPlaylists() {
  try {
    S.playlists = await Api.playlists();
    renderLists();
    loadRecent();
    loadArtists();
  } catch (e) { say("Couldn't load your library: " + friendly(e), 6000); }
}

async function openPlaylist(id) {
  const pl = (S.playlists || []).concat(S.artists || []).find((p) => p.id === id);
  if (!pl) return;
  S.open = pl;
  if (!S.tracks[id]) {
    S.trackState = "loading";
    renderLists();
    try {
      if (pl.type === "artist") S.tracks[id] = await artistSongs(pl);
      else {
        const items = await Api.playlistItems(id);
        S.tracks[id] = items.map((e) => e.item || e.track).filter((t) => t && t.uri);
      }
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

function friendly(e) {
  return e instanceof TypeError ? "Can't reach Spotify. Check your connection and this widget's permissions in iCUE." : e.message;
}

function controlError(e) {
  if (e.status === 403) return "Playback control needs Spotify Premium";
  if (e.status === 404) return "No active device. Start Spotify on this PC";
  return friendly(e);
}

let skipping = false;

// Spotify has no "play this queue entry" call, and on this setup playing a plain list of songs does not start playback.
// What does work is a playlist or album plus a start position, so: try the context that is playing now, then the song's own album.
async function startTrack(track, contexts) {
  let lastErr = null;
  for (const uri of contexts) {
    if (!uri) continue;
    try { await Api.playContext(uri, track.uri); } catch (e) { lastErr = e; continue; }
    if (await confirmPlaying(track.id)) { S.queueKey = ""; return true; }
  }
  if (lastErr) throw lastErr;
  return false;
}

async function playQueueItem(idx) {
  const target = S.queue[idx];
  if (skipping || S.mock || !target) return;
  const ctx = S.player && S.player.context;
  const contexts = [ctx && (ctx.type === "playlist" || ctx.type === "album") ? ctx.uri : null, target.album && target.album.uri];
  skipping = true;
  say("Starting " + target.name + "...", 4000);
  try {
    if (!(await startTrack(target, contexts))) say("Spotify didn't start that song. Press play in Spotify, then try again.", 7000);
  } catch (e) { say(controlError(e)); }
  skipping = false;
  pollSoon();
}

// Waits (up to about 4 seconds) until Spotify reports the song as the one playing.
async function confirmPlaying(trackId) {
  for (let i = 0; i < 5; i++) {
    await new Promise((r) => setTimeout(r, i === 0 ? 600 : 800));
    try {
      const p = await Api.player();
      if (p && p.item && p.item.id === trackId) {
        S.player = p; S.playerAt = Date.now();
        renderNow();
        return true;
      }
    } catch (e) { return false; }
  }
  return false;
}

async function playSongs(list, trackUri) {
  const song = list.find((x) => x.uri === trackUri);
  if (skipping || S.mock || !song) return;
  skipping = true;
  say("Starting " + song.name + "...", 4000);
  try {
    if (await startTrack(song, [song.album && song.album.uri])) { if (S.open) noteContext(S.open.uri, true); renderLib(); }
    else say("Spotify didn't start that song. Press play in Spotify, then try again.", 7000);
  } catch (e) { say(controlError(e)); }
  skipping = false;
  pollSoon();
}

async function playFrom(uri, trackUri) {
  if (S.mock) { return; }
  try { await Api.playContext(uri, trackUri); noteContext(uri, true); renderLib(); pollSoon(); } catch (e) { say(controlError(e)); }
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
  $("title").textContent = n ? n.title : (S.phase === "ready" ? "Nothing playing" : "Player for Spotify");
  $("artist").textContent = n ? n.artist : (S.phase === "ready" ? "Start Spotify on this PC" : "");
  const img = $("img");
  if (n && n.art) { if (img.getAttribute("src") !== n.art) img.src = n.art; img.classList.add("show"); } else img.classList.remove("show");
  $("app").classList.toggle("playing", !!(n && n.playing));
  $("app").classList.toggle("idle", !n);
  $("brand").classList.toggle("off", !(n && n.url));
  S.nowUrl = n ? n.url : "";
  tickProgress();
}

function tickProgress() {
  const n = nowItem();
  const live = n && n.playing ? Date.now() - S.playerAt : 0;
  const pos = n ? Math.min(n.duration, n.progress + live) : 0;
  document.documentElement.style.setProperty("--progress", n && n.duration ? (100 * pos / n.duration).toFixed(1) + "%" : "0%");
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
    const rows = orderPlaylists(S.playlists.concat(S.artists || [])).slice(0, 100).map((p) => {
      const total = p.items ? p.items.total : (p.tracks ? p.tracks.total : null);
      const sub = (p._pinned ? "Pinned · " : "") + (p.type === "artist" ? "Artist" : (total == null ? "Play only" : total + " songs"));
      return row(cover(artOf(p.images)) + '<span class="tx"><b>' + esc(p.name) + "</b><small>" + sub + "</small></span>" +
        '<span class="chev">&#8250;</span>',
        'data-act="open" data-id="' + esc(p.id) + '"');
    }).join("");
    setList(el, '<div class="hd"><span>Your library</span>' + (S.needScope ? '<button class="chip" data-act="reconnect" type="button">Reconnect for artists and recents</button>' : "<span>" + S.playlists.length + " playlists" + (S.artists && S.artists.length ? ", " + S.artists.length + " artists" : "") + "</span>") + "</div>" + (rows || '<div class="empty">No playlists yet.</div>'));
    return;
  }
  const pl = S.open, tr = S.tracks[pl.id] || [];
  const curId = S.player && S.player.item && S.player.item.id;
  let body;
  if (S.trackState === "loading") body = '<div class="empty">Loading songs…</div>';
  else if (S.trackState === "denied") body = '<div class="empty">Spotify doesn\'t share this playlist\'s songs with this app. You can still play it.</div>';
  else if (S.trackState === "error") body = '<div class="empty">Couldn\'t load songs. Try again.</div>';
  else body = tr.slice(0, 100).map((t, i) =>
    row(cover(artOf(t.album && t.album.images)) + '<span class="tx"><b>' + esc(t.name) + "</b><small>" + esc(pl.type === "artist" ? ((t.album && t.album.name) || "") : (t.artists || []).map((a) => a.name).join(", ")) + "</small></span>" +
      '<span class="dur">' + fmt(t.duration_ms) + "</span>", 'data-act="song" data-uri="' + esc(t.uri) + '"', t.id === curId ? "cur" : "")).join("") || (pl.type === "artist" ? '<div class="empty">Spotify didn\'t return songs for this artist. You can still press Play.</div>' : '<div class="empty">This playlist is empty.</div>');
  setList(el, '<div class="hd"><button class="back" data-act="back" type="button">&#8249; ' + esc(pl.name) + '</button><button class="chip" data-act="playlist" type="button">Play</button></div>' + body);
}

function renderQueue() {
  const el = $("queue");
  if (S.phase !== "ready") { setList(el, ""); return; }
  const from = S.player && S.player.context && S.mock ? "From Late night drive" : "";
  const rows = S.queue.slice(0, 20).map((t, i) =>
    row(cover(artOf(t.album && t.album.images)) + '<span class="tx"><b>' + esc(t.name) + "</b><small>" + esc((t.artists || []).map((a) => a.name).join(", ")) + "</small></span>" +
      '<span class="dur">' + fmt(t.duration_ms) + "</span>", 'data-act="queueplay" data-idx="' + i + '"')).join("");
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
  else if (a === "queueplay") playQueueItem(parseInt(t.dataset.idx, 10));
  else if (a === "open") openPlaylist(t.dataset.id);
  else if (a === "back") { S.open = null; S.trackState = ""; renderLib(); }
  else if (a === "song" && S.open) { if (S.open.type === "artist") playSongs(S.tracks[S.open.id] || [], t.dataset.uri); else playFrom(S.open.uri, t.dataset.uri); }
  else if (a === "playlist" && S.open) playFrom(S.open.uri);
  else if (a === "reconnect") Auth.startLogin().then(() => say("Approve in your browser, then paste the new code into this widget's settings", 9000)).catch((err) => say(err.message));
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

/* Diagnostic for the narrow-slot message: shows the size iCUE actually gives this widget. */
function showSize() { const el = $("xlsize"); if (el) el.textContent = "This slot is " + window.innerWidth + " x " + window.innerHeight + " (needs about 2536 x 696)"; }
window.addEventListener("resize", showSize);
showSize();
