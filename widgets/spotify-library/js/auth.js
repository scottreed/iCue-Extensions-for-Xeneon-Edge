// Spotify Authorization Code + PKCE, no client secret. Tokens live in this widget's localStorage entry.
const Auth = (() => {
  const SCOPES = "playlist-read-private user-read-playback-state user-read-currently-playing user-modify-playback-state";
  const AUTHORIZE = "https://accounts.spotify.com/authorize";
  const TOKEN = "https://accounts.spotify.com/api/token";
  let cfg = { clientId: "", redirectUri: "" };

  function storeKey() { return typeof uniqueId !== "undefined" && uniqueId ? "spotify-" + uniqueId : "spotify-library"; }
  function load() { try { return JSON.parse(localStorage.getItem(storeKey()) || "{}"); } catch (e) { return {}; } }
  function save(patch) { try { localStorage.setItem(storeKey(), JSON.stringify(Object.assign(load(), patch))); } catch (e) {} }

  function b64url(bytes) {
    let s = "";
    bytes.forEach((b) => { s += String.fromCharCode(b); });
    return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function randomVerifier() {
    const a = new Uint8Array(48);
    crypto.getRandomValues(a);
    return b64url(a);
  }
  const form = (o) => Object.keys(o).map((k) => encodeURIComponent(k) + "=" + encodeURIComponent(o[k])).join("&");

  async function tokenRequest(params) {
    const r = await fetch(TOKEN, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: form(params) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      const err = new Error(j.error_description || j.error || "Token request failed (" + r.status + ")");
      err.status = r.status; err.code = j.error;
      throw err;
    }
    return j;
  }
  function keep(j) {
    save({
      access_token: j.access_token,
      expires_at: Date.now() + (j.expires_in || 3600) * 1000 - 60000,
      refresh_token: j.refresh_token || load().refresh_token,
    });
  }

  return {
    configure(c) { cfg = { clientId: (c.clientId || "").trim(), redirectUri: (c.redirectUri || "").trim() }; },
    ready() { return !!(cfg.clientId && cfg.redirectUri); },
    hasSession() { return !!load().refresh_token; },
    lastCode() { return load().last_code || ""; },
    expire() { save({ expires_at: 0 }); },
    signOut() { save({ access_token: "", expires_at: 0, refresh_token: "", verifier: "", last_code: "" }); },

    // Opens Spotify's consent page in the system browser.
    async startLogin() {
      const verifier = randomVerifier();
      save({ verifier });
      const challenge = b64url(sha256(new TextEncoder().encode(verifier)));
      const url = AUTHORIZE + "?" + form({
        client_id: cfg.clientId, response_type: "code", redirect_uri: cfg.redirectUri,
        code_challenge_method: "S256", code_challenge: challenge, scope: SCOPES,
      });
      const link = window.plugins && window.plugins.Linkprovider;
      if (link && typeof pluginLinkprovider_initialized !== "undefined" && pluginLinkprovider_initialized) link.open(url);
      else window.open(url, "_blank");
      return url;
    },

    // Accepts either the bare code or the whole redirect URL pasted by the user.
    async exchangeCode(pasted) {
      let code = (pasted || "").trim();
      const m = code.match(/[?&]code=([^&#\s]+)/);
      if (m) code = decodeURIComponent(m[1]);
      const verifier = load().verifier;
      if (!verifier) throw new Error("Tap Connect first, then paste the code");
      save({ last_code: pasted });
      keep(await tokenRequest({
        client_id: cfg.clientId, grant_type: "authorization_code", code,
        redirect_uri: cfg.redirectUri, code_verifier: verifier,
      }));
    },

    async accessToken() {
      const s = load();
      if (s.access_token && s.expires_at > Date.now()) return s.access_token;
      if (!s.refresh_token) throw Object.assign(new Error("Not signed in"), { status: 401 });
      try {
        keep(await tokenRequest({ client_id: cfg.clientId, grant_type: "refresh_token", refresh_token: s.refresh_token }));
      } catch (e) {
        if (e.code === "invalid_grant") this.signOut();
        throw e;
      }
      return load().access_token;
    },
  };
})();
