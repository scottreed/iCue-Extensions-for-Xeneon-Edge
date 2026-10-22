// Thin Spotify Web API client: bearer auth, one 401 retry, 429 back-off via Retry-After.
const Api = (() => {
  const BASE = "https://api.spotify.com/v1";
  let blockedUntil = 0;

  // Keeps the last 40 requests as plain text lines (time, request, result, short note) so a problem can be diagnosed afterwards.
  function trace(method, path, status, note) {
    try {
      const key = "spotify-debug-" + (typeof uniqueId !== "undefined" && uniqueId ? uniqueId : "x");
      const lines = (localStorage.getItem(key) || "").split("\n").filter(Boolean);
      const clean = (s) => String(s == null ? "" : s).replace(/[^\x20-\x7e]/g, "?").slice(0, 160);
      lines.push(new Date().toTimeString().slice(0, 8) + " " + method + " " + clean(path).slice(0, 70) + " -> " + status + (note ? " " + clean(note) : ""));
      localStorage.setItem(key, lines.slice(-40).join("\n"));
    } catch (e) {}
  }
  function describe(path, json) {
    if (!json) return "";
    if (path.indexOf("/me/player/queue") === 0) return "queue=" + ((json.queue || []).length) + " now=" + (json.currently_playing && json.currently_playing.id);
    if (path === "/me/player") return "playing=" + json.is_playing + " item=" + (json.item && json.item.id) + " device=" + (json.device && json.device.name);
    return "";
  }

  async function call(path, opts) {
    opts = opts || {};
    if (Date.now() < blockedUntil) throw Object.assign(new Error("Rate limited, retrying shortly"), { status: 429 });
    for (let attempt = 0; attempt < 2; attempt++) {
      const token = await Auth.accessToken();
      const r = await fetch(BASE + path, {
        method: opts.method || "GET",
        headers: Object.assign({ Authorization: "Bearer " + token }, opts.body ? { "Content-Type": "application/json" } : {}),
        body: opts.body ? JSON.stringify(opts.body) : undefined,
      });
      if (r.status === 401 && attempt === 0) { Auth.expire(); continue; }
      if (r.status === 429) {
        blockedUntil = Date.now() + (parseInt(r.headers.get("Retry-After"), 10) || 5) * 1000;
        throw Object.assign(new Error("Rate limited, retrying shortly"), { status: 429 });
      }
      const method = opts.method || "GET";
      const sent = opts.body ? JSON.stringify(opts.body).slice(0, 120) : "";
      if (r.status === 204) { trace(method, path, 204, sent || "no content"); return null; }
      const text = await r.text();
      let json = null;
      try { json = text ? JSON.parse(text) : null; } catch (e) { json = null; }
      trace(method, path, r.status, (describe(path, json) || sent || "") + (r.ok ? "" : " body=" + text.slice(0, 100)));
      if (!r.ok) {
        const detail = (json && json.error && (json.error.message || json.error)) || (text && text.length < 120 && text.charAt(0) !== "<" ? text : "");
        throw Object.assign(new Error(detail ? "Spotify: " + detail : "Spotify error " + r.status), { status: r.status });
      }
      return json;
    }
  }

  async function paged(path, maxPages) {
    let out = [], url = path + (path.indexOf("?") > -1 ? "&" : "?") + "limit=50", pages = 0;
    while (url && pages < maxPages) {
      const j = await call(url);
      out = out.concat(j.items || []);
      url = j.next ? j.next.replace(BASE, "") : "";
      pages++;
    }
    return out;
  }

  return {
    player: () => call("/me/player"),
    queue: () => call("/me/player/queue"),
    recentlyPlayed: () => call("/me/player/recently-played?limit=50"),
    playlists: () => paged("/me/playlists", 3),
    followedArtists: async () => {
      let out = [], url = "/me/following?type=artist&limit=50", pages = 0;
      while (url && pages < 3) {
        const j = await call(url);
        const a = (j && j.artists) || {};
        out = out.concat(a.items || []);
        url = a.next ? a.next.replace(BASE, "") : "";
        pages++;
      }
      return out;
    },
    searchTracks: (artistName) => call("/search?type=track&limit=10&q=" + encodeURIComponent('artist:"' + artistName + '"')),
    playlistItems: (id) => paged("/playlists/" + encodeURIComponent(id) + "/items", 2),
    next: () => call("/me/player/next", { method: "POST" }),
    previous: () => call("/me/player/previous", { method: "POST" }),
    pause: () => call("/me/player/pause", { method: "PUT" }),
    resume: () => call("/me/player/play", { method: "PUT" }),
    playContext: (contextUri, offsetUri) =>
      call("/me/player/play", { method: "PUT", body: offsetUri ? { context_uri: contextUri, offset: { uri: offsetUri } } : { context_uri: contextUri } }),
  };
})();
