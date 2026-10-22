icueEvents = { onICUEInitialized: init, onDataUpdated: applyStyle };
pluginMediadataproviderEvents = { onInitialized: bindMedia };

const $ = (id) => document.getElementById(id);
const prop = (n, d) => { const v = window[n]; return v !== undefined && v !== null && v !== "" ? v : d; };
let bound = false;

function applyStyle() {
  const s = document.documentElement.style;
  s.setProperty("--text", prop("textColor", "#FFFFFF"));
  s.setProperty("--accent", prop("accentColor", "#1DB954"));
  s.setProperty("--bg", prop("bgColor", "#14141C"));
}

function media() { return window.plugins && window.plugins.Mediadataprovider; }

function render() {
  const m = media(); if (!m) return;
  $("title").textContent = m.songName || "Nothing playing";
  $("artist").textContent = m.artist || "";
  $("album").textContent = m.album || "";
  const img = $("img");
  if (m.thumbnail) { img.src = m.thumbnail; img.classList.add("show"); }
  else img.classList.remove("show");
  $("app").classList.toggle("playing", !!m.isPlaying);
  $("app").classList.toggle("idle", !m.songName && !m.isPlaying);
}

function bindMedia() {
  const m = media(); if (!m || bound) return;
  bound = true;
  ["songName", "artist", "album", "thumbnail", "isPlaying"].forEach((p) => {
    if (m[p + "Changed"]) m[p + "Changed"].connect(render);
  });
  render();
}

// Buttons are wired immediately; the plugin is looked up when pressed so they never depend on init order.
function press(btn, method) {
  let last = 0;
  const fire = (e) => {
    e.preventDefault();
    const now = Date.now();
    if (now - last < 350) return; // pointer + touch + click can all fire for one tap
    last = now;
    btn.classList.add("pressed");
    setTimeout(() => btn.classList.remove("pressed"), 150);
    try {
      const m = media();
      if (!m) throw new Error("media plugin not available");
      bindMedia();
      m[method]();
    } catch (err) {
      console.error("Now Playing:", err);
      $("album").textContent = "Control error: " + err.message;
    }
  };
  ["pointerup", "touchend", "click"].forEach((ev) => btn.addEventListener(ev, fire));
}
press($("prev"), "triggerPreviousTrack");
press($("play"), "triggerPlayPause");
press($("next"), "triggerNextTrack");

function init() { applyStyle(); bindMedia(); }
if (typeof iCUE_initialized !== "undefined" && iCUE_initialized) init();
