// Thin Spotify Web API client: bearer auth, one 401 retry, 429 back-off via Retry-After.
const Api = (() => {
  const BASE = "https://api.spotify.com/v1";
  let blockedUntil = 0;

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
      if (r.status === 204) return null;
      const text = await r.text();
      const json = text ? JSON.parse(text) : null;
      if (!r.ok) throw Object.assign(new Error((json && json.error && json.error.message) || "Spotify error " + r.status), { status: r.status });
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
    playlists: () => paged("/me/playlists", 3),
    playlistItems: (id) => paged("/playlists/" + encodeURIComponent(id) + "/items", 2),
    next: () => call("/me/player/next", { method: "POST" }),
    previous: () => call("/me/player/previous", { method: "POST" }),
    pause: () => call("/me/player/pause", { method: "PUT" }),
    resume: () => call("/me/player/play", { method: "PUT" }),
    playContext: (contextUri, offsetUri) =>
      call("/me/player/play", { method: "PUT", body: offsetUri ? { context_uri: contextUri, offset: { uri: offsetUri } } : { context_uri: contextUri } }),
  };
})();
