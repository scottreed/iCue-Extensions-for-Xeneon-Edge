# iCUE widgets (XENEON EDGE)

Goal: build iCUE widgets for the Corsair XENEON EDGE. First target: a Now Playing tile
matching the Elgato Marketplace "Now Playing" widget (by Atomic). We write our own
implementation from the public docs; we do not copy the marketplace package.

## Layout
- `widgets/<name>/` one folder per widget (manifest.json, index.html, style.css, app.js, resources/)
- `*.icuewidget` packaged output at repo root (build artefact)
- README.md holds user-facing status; keep it updated as work progresses

## Commands (CLI: `npm i -g icuewidget-cli`, v0.5.1)
- `icuewidget validate widgets/now-playing`
- `icuewidget package widgets/now-playing` (writes `<widget-name>.icuewidget` in the PARENT of the widget folder, i.e. `widgets/`; move it to the repo root)
- Install: iCUE > Widgets > "+" > pick the `.icuewidget` (or double-click it)

## Hard-won rules (validator-enforced; docs are partly stale)
- manifest needs `min_app_version` (string) even though docs omit it; docs say iCUE 5.47+, marketplace says 5.44+.
- `<head>` is parsed as strict XML: self-close void tags (`<meta ... />`, `<link ... />`), no inline `<style>`/`<script>` in head
  (only the `x-icue-groups` JSON script). Put CSS/JS in external files referenced from `<body>`.
- `<title>` is evaluated as JS: use `<title>'Now Playing'</title>` or `tr('...')`.
- Settings: `<meta name="x-icue-property" content="name" data-label="tr('..')" data-type="color" data-default="'#fff'" />`;
  value appears as global `window[name]`; refresh in `icueEvents.onDataUpdated`.
- Media: manifest `"required_plugins": ["widgetbuilder.mediadataprovider:Media:1.1"]`;
  `window.plugins.Mediadataprovider` has props songName/artist/album/thumbnail(base64 PNG data URL)/isPlaying,
  signals `<prop>Changed.connect(fn)`, controls triggerPlayPause/NextTrack/PreviousTrack.
  Init flag `pluginMediadataprovider_initialized`; callbacks `pluginMediadataproviderEvents = { onInitialized }`.
  No position/duration/seek API exists in the plugin, so no progress bar.
- Slot sizes: Small 840x344 to XL 2536x696 (horizontal). Use vh units / responsive CSS, not fixed px.
- Test on real hardware; browser preview renders differently. `iCUE.isPreview` tells you which.

## Docs
https://docs.elgato.com/icue/widgets/ (+ /references/plugins/media-data-provider, /references/icue-global-object)
https://www.corsair.com/uk/en/explorer/diy-builder/accessories/how-to-create-a-custom-widget-for-the-xeneon-edge/

## Working agreement
README.md is public-facing: keep it free of session logs, personal paths and tooling/skill setup. Put working notes here in CLAUDE.md and update the assistant memory files after each meaningful step.

## Controls gotcha (2026-10-22)
First build bound button `onclick` only inside the plugin `onInitialized` path; on hardware the buttons did nothing.
Now buttons are wired at load, listen to pointerup/touchend/click (350ms debounce), look up `window.plugins.Mediadataprovider` at press time,
and surface errors in the album line. `icuewidget package` writes the file into the parent of the widget folder (`widgets/`), not the CWD.

## Touch needs `"interactive": true` (2026-10-22)
Manifest key `interactive` (boolean, default false) enables click handling on touch devices. Without it widget buttons silently do nothing
(no JS error). Found in https://docs.elgato.com/icue/widgets/specification. Other optional keys: `permissions`, `modules`, `required_plugins`.
`supported_devices` entries accept `features` (e.g. `sensor-screen`). Meta `x-icue-widget-preview` = 128x56 preview image.

## Slot sizes need aspect-ratio layouts (2026-10-22)
Slots are not just wider versions of Small: Medium is much squarer (est. ~1.2-1.5:1; Small 840x344 is ~2.4:1). A height-based layout (art = 100% height)
breaks there. Use `@media (max-aspect-ratio: 11/5)` to stack vertically, vh-based sizes, and cap art `max-width`. Verify the real Medium size on hardware.
`interactive: true` confirmed fixing touch buttons.

## Git
Repo root is this folder, branch `main`. `.icuewidget` builds are gitignored (publish them via GitHub Releases). `.claude/` and other local AI files are ignored; CLAUDE.md is tracked.

## Skill
`icue-widget-builder` (Corsair-Labs) is installed at user level in `~/.claude/skills/`. Its bundled docs track Widget API 1.9.0 / iCUE 5.52; prefer its `docs/` over web fetches. It mandates a requirements-gathering step before building new widgets, and warns: keep `<head>` ASCII-only (comments too).

## Verified Edge slot sizes (from icue-widget-builder docs)
Small 840x344 H / 696x416 V; Medium 840x696 H / 696x840 V; Large 1688x696 H / 696x1688 V; XL 2536x696 H / 696x2536 V.
`interactive: true` limits a widget to dashboard_lcd only (fine here). Skill confirmed loading in the Claude Code desktop app (2026-10-22).

## Defaults for every new widget
- Manifest `author` is always `"Scott Reed Development"`.
- Bump the manifest `version` on every repackage so iCUE treats the import as new.

## Marketplace images (`publish/`)
Elgato Marketplace upload rules: thumbnail png/jpg <=5MB, 1920x960 (2:1); gallery min 3 items, png/jpg <=10MB at 1920x960 or mp4 <=50MB at 1920x1080.
`node publish/build.mjs` regenerates thumbnail + 3 gallery PNGs by rendering the real widget (mock media plugin, fictional artwork) through headless Edge.
Re-run after any visual change. `publish/src/` is generated and gitignored. Replace with real hardware photos if preferred.

## Library Player (`widgets/spotify-library`, started 2026-10-22)
Scope (user-confirmed): library playlists, songs inside a playlist, current queue, now playing + controls. NOT liked songs, search or add-to-queue.
Spotify rules that shaped it (docs checked 2026-10-22): Premium needed for control and for the dev-app owner; Dev Mode = 5 users, so users bring their own Client ID;
`localhost` redirects banned (HTTPS or 127.0.0.1 only); Feb 2026 changes: `/playlists/{id}/items` replaces `/tracks`, items only for playlists the user owns or collaborates on,
`/me/tracks`-style library endpoints and batch fetches changed, search limit 10. Spotify design rules: show Spotify attribution (currently a text "Play on Spotify" link; replace with official logo asset),
unaltered artwork, informational-only progress bar, no "Spotify" in the app name (display name is "Library Player").
Auth = Authorization Code + PKCE via a static GitHub Pages callback (`docs/callback/`), code pasted into a textfield setting; see `docs/SPOTIFY_SETUP.md`.
Own SHA-256 in `js/sha256.js` because `crypto.subtle` may be unavailable in a non-secure widget context (verified against Node's sha256).
Gotchas found: do NOT use `"use strict"` in app.js (bare `icueEvents = ...` assignment throws); textfield props arrive as globals like other properties;
CSS layout switches by aspect ratio AND width (Small and Large share a ~2.44:1 ratio, so width splits them): XL >=3:1 three panes, Large (<=3:1, >=1300px) now playing + tabs,
Small (<1300px, >=9:5) now playing + Browse button, Medium/vertical (<9:5) stacked.
Mock mode: open `index.html?mock=1` (also `&open=p1`, `&tab=queue`, `&view=browse`, `&paused=1`) to render sample data in a normal browser or headless Edge.
Status: UI verified in headless renders at all slot sizes and the PKCE/token logic unit-tested offline; NOT yet tried against real Spotify or on the Edge.
Spike still to verify on hardware: `fetch` to Spotify hosts under the `url` permissions (incl. token endpoint CORS), artwork loading, localStorage persistence, followed-playlist songs ("Play only" case).
