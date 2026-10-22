// Offline sample data, used only when the page is opened with ?mock (layout checks and marketplace images).
const Mock = (() => {
  const palettes = [["#ff5f6d", "#2b1055"], ["#00c6ff", "#06142e"], ["#b24bf3", "#1a0b2e"], ["#f7971e", "#3a1c00"], ["#43cea2", "#0b2a24"], ["#f857a6", "#2e0a1f"]];
  const art = (i) => {
    const p = palettes[i % palettes.length];
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="' + p[1] + '"/><circle cx="64" cy="38" r="26" fill="' + p[0] + '"/><circle cx="34" cy="72" r="34" fill="' + p[0] + '" opacity=".35"/></svg>';
    return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
  };
  const names = [["Afterglow", "Violet Static"], ["Neon skyline", "The Midnight Tapes"], ["Harbour lights", "Glass Harbour"], ["Paper moons", "The Midnight Tapes"],
    ["Low tide", "Aurora Drive"], ["Static bloom", "Violet Static"], ["Night shift", "Glass Harbour"], ["Slow burn", "Aurora Drive"], ["City hum", "The Midnight Tapes"], ["Afterimage", "Violet Static"]];
  const track = (i) => ({
    id: "t" + i, uri: "spotify:track:t" + i, name: names[i % names.length][0], duration_ms: 170000 + i * 9000,
    artists: [{ name: names[i % names.length][1] }], album: { name: "Side " + "AB"[i % 2], images: [{ url: art(i) }] },
    external_urls: { spotify: "https://open.spotify.com" },
  });
  const pl = (id, name, n, i, own) => ({
    id, name, uri: "spotify:playlist:" + id, images: [{ url: art(i) }], items: own ? { total: n } : undefined, owner: { id: own ? "me" : "spotify" },
  });
  const playlists = [pl("p1", "Late night drive", 64, 0, true), pl("p2", "Gym rotation", 41, 3, true), pl("p3", "Focus", 120, 4, true),
    pl("p4", "Daily mix 1", 50, 5, false), pl("p5", "Road trip", 88, 2, true), pl("p6", "Sunday morning", 33, 1, true)];
  const tracks = {};
  playlists.forEach((p, k) => { tracks[p.id] = Array.from({ length: 12 }, (_, i) => track(i + k)); });
  return {
    playlists, tracks, track,
    artists: [["a1", "Violet Static", 0], ["a2", "Glass Harbour", 2], ["a3", "Aurora Drive", 4], ["a4", "The Midnight Tapes", 1]].map((a) => ({
      id: a[0], name: a[1], type: "artist", uri: "spotify:artist:" + a[0], images: [{ url: art(a[2]) }],
    })),
    player: { is_playing: true, progress_ms: 84000, item: track(1), device: { name: "This PC" }, context: { uri: "spotify:playlist:p1" } },
    queue: { currently_playing: track(1), queue: [2, 3, 4, 5, 6, 7].map(track) },
  };
})();
