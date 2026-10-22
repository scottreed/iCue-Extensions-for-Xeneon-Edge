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
- **Personalization (MANDATORY for every widget, user-confirmed working 2026-10-22):** the Edge page theme and the per-widget "Custom Style" switch only drive a widget that uses the STANDARD property names. Declare exactly these, in this order, in one group titled `Widget Personalization` placed last in `x-icue-groups`:
  1. `textColor` (color, default #FFFFFF)  2. `accentColor` (color)  3. `backgroundColor` (color, default #000000)  4. `transparency` (slider, min 0, max 100, step 1, default 80, `data-unit-label="%"`).
  Never invent other names (e.g. `bgColor`): iCUE cannot feed the page theme to them and the widget ends up hard-coded.
- **Background pattern (copy Corsair's bundled Weather widget):** `html, body { background: transparent }`; one extra element `<div id="bg"></div>` before the content with `#bg { position: fixed; inset: 0; background: var(--bg); opacity: var(--bg-opacity); z-index: 0 }` and the content above it (`position: relative; z-index: 1`). JS (on `onICUEInitialized` and `onDataUpdated`) sets `--text`, `--accent`, `--bg` from the properties and `--bg-opacity` = transparency / 100 (clamped 0-100, fallback 0.8). Only the background fades; text, artwork and controls stay solid. Never put the background colour or opacity on `html`/`body` and never hard-code a background colour.
- **Check before delivering:** render the widget over a colourful backdrop at transparency 100, 50 and 15 and confirm the backdrop shows through while content stays solid. Marketing/listing images should set transparency to 100 for opaque frames (see `publish/build.mjs`).
- Optional extra: a `backgroundMedia` (media-selector) property sits between `backgroundColor` and `transparency` if a widget needs a background image; not required.

## Marketplace images (`publish/`)
Elgato Marketplace upload rules: thumbnail png/jpg <=5MB, 1920x960 (2:1); gallery min 3 items, png/jpg <=10MB at 1920x960 or mp4 <=50MB at 1920x1080.
`node publish/build.mjs` regenerates thumbnail + 3 gallery PNGs by rendering the real widget (mock media plugin, fictional artwork) through headless Edge.
Re-run after any visual change. `publish/src/` is generated and gitignored. Replace with real hardware photos if preferred.

## Library Player (`widgets/spotify-library`, started 2026-10-22)
Scope (user-confirmed): library playlists, songs inside a playlist, current queue, now playing + controls. NOT liked songs, search or add-to-queue.
Spotify rules that shaped it (docs checked 2026-10-22): Premium needed for control and for the dev-app owner; Dev Mode = 5 users, so users bring their own Client ID;
`localhost` redirects banned (HTTPS or 127.0.0.1 only); Feb 2026 changes: `/playlists/{id}/items` replaces `/tracks`, items only for playlists the user owns or collaborates on,
`/me/tracks`-style library endpoints and batch fetches changed, search limit 10. Spotify design rules: show Spotify attribution (currently a text "Play on Spotify" link; replace with official logo asset),
unaltered artwork, informational-only progress bar, no "Spotify" in the app name (display name is now "Player for Spotify").
Auth = Authorization Code + PKCE via a static GitHub Pages callback (`docs/callback/`), code pasted into a textfield setting; see `docs/SPOTIFY_SETUP.md`.
Own SHA-256 in `js/sha256.js` because `crypto.subtle` may be unavailable in a non-secure widget context (verified against Node's sha256).
Gotchas found: do NOT use `"use strict"` in app.js (bare `icueEvents = ...` assignment throws); textfield props arrive as globals like other properties;
LAYOUT: Library Player is XL ONLY (2536x696, full screen) by the user's explicit choice; no Small/Medium/Large layouts. Narrower slots (aspect < 3:1) show a "needs the full screen" message. Do not add other sizes unless asked.
Mock mode: open `index.html?mock=1` (also `&open=p1`, `&paused=1`) to render sample data in a normal browser or headless Edge.
Status: UI verified in headless renders at all slot sizes and the PKCE/token logic unit-tested offline; NOT yet tried against real Spotify or on the Edge.
Spike still to verify on hardware: `fetch` to Spotify hosts under the `url` permissions (incl. token endpoint CORS), artwork loading, localStorage persistence, followed-playlist songs ("Play only" case).

## Edge slot sizes are not declared by the manifest (2026-10-22)
No documented manifest/meta key sets or restricts a widget's size (checked the Elgato docs, the icue-widget-builder skill and the CLI). User could only pick Small for Library Player while Now Playing offered Small and Medium with near-identical manifests, so size availability is likely decided by iCUE from free space on the Edge page. Unverified: XL probably needs the whole page free.
2026-10-22 (v0.2.1): the "needs the full screen" message now also prints the slot size iCUE gives the widget (`This slot is W x H`), to diagnose why XL isn't offered. User reported seeing that message after importing v0.2.0.
Observed in iCUE (2026-10-22 screenshot): the widget settings panel has a Size selector S / M / L / XL provided by iCUE itself (not the widget). For Library Player S was selected and M/L/XL appeared greyed out, consistent with sizes being limited by free space on the Edge page. Next test: empty the page and see whether XL enables.
iCUE layout internals (read-only look at %APPDATA%/Corsair/CUE5/dashlcd/storage, 2026-10-22): each Edge page is a 6-slot grid; every placed widget stores `slotIndex` and `size` in slot units (1=S, 2=M, 4=L, 6=XL). A native full-screen widget on another page is stored as slotIndex 0, size 6. Widget files/manifests carry no size information (first-party Corsair widgets have none either). Library Player's page held two other entries after it. iCUE's log shows no size-related errors for the widget. Cause of XL not being selectable is still unconfirmed; do not claim otherwise.
Size bisect (2026-10-22): `tmp/sizetest/size-test-a.icuewidget` = Library Player without the `permissions` array and Link plugin; `size-test-b` = A plus no settings controls. Throwaway builds under gitignored `tmp/`. Import each on its own empty page and see whether XL is selectable.

## Always use the icue-widget-builder skill (user rule, 2026-10-22)
Whenever asked to build, change, debug, review or package an iCUE widget, invoke the `icue-widget-builder` skill via the Skill tool FIRST and follow its workflow, including the mandatory Phase 1 requirements questions (target devices AND which Edge sizes) before writing code, the permission audit, and the preflight checklist. Do not just read its docs ad hoc. Library Player was built without this and ended up with the wrong layouts (the user wanted XL only).

## Skill preflight + permission audit on Library Player (2026-10-22, v0.2.2)
Permission audit: 4 `url` entries (api.spotify.com, accounts.spotify.com, scdn.co, spotifycdn.com) all used, none missing, none unused; Media and Link plugins need no permission entries. Head is ASCII, uppercase DOCTYPE, self-closed, no stray `<head`.
Fixed: icon now white single-colour transparent SVG; added `transparency` personalization slider (skill says always include); `min_app_version` 5.52 (permissions + Media 1.1 need Widget API 1.9.0); JS no longer writes per-element inline styles (`--progress` var, `.off` class); blocked/offline fetch failures show a friendly message and keep last data; setup guide lists permissions and data use.
Open: skill checklist says never store tokens in localStorage, but PKCE sign-in must persist a refresh token somewhere (no other store exists). Left in localStorage pending the user's decision. Not done: translation.json (validator warns only), Now Playing still has a coloured icon and min_app_version 5.44.
None of the audit findings explain the missing XL size option.

## Re-importing a widget keeps its old placement (confirmed 2026-10-22)
The "only Small is selectable" problem was NOT the widget files: importing an updated package over an already-placed widget kept the old placement (size 1) in iCUE. Deleting the widget from the Edge page and adding it again fixed it and XL became selectable. After any re-import that changes layout or size support, remove the widget from the page and add it fresh. The size-test A/B packages in `tmp/sizetest/` are no longer needed.

## Library Player v0.3.0 (2026-10-22)
Fixed "Unexpected token" on pause/play: Spotify player commands can return 200/202 with a non-JSON body; `Api.call` now parses JSON defensively (tested offline with stubbed replies). Library order = pinned names from the `pinnedPlaylists` text setting, then most recently played, then Spotify API order. Spotify's API does NOT expose which playlists are pinned. Recents = `GET /me/player/recently-played` (new scope `user-read-recently-played`, existing sign-ins get a 403 and a "Reconnect for recents" chip) merged with a local record of playlist contexts seen playing (`spotify-recent-<uniqueId>` in localStorage, timestamps only). No manifest permission changes (scope only); version 0.3.0.

## Renamed to "Player for Spotify" (2026-10-22, v0.3.1)
Display name changed from "Library Player" to "Player for Spotify" (manifest `name` and `<title>` must match). Chosen because Spotify's design guidelines forbid "Spotify" in an app's name but allow "for Spotify"; "Spotify Player" was rejected for that reason. Widget id stays `com.scottreed.libraryplayer` on purpose: changing it would make iCUE treat it as a different widget and lose placement and settings. Folder stays `widgets/spotify-library`. Package file is now `player-for-spotify.icuewidget`. Earlier notes above still say "Library Player" (history).

## Pinned playlists: not available from Spotify's API; no in-widget pinning (2026-10-22)
Verified against Spotify's Web API reference: playlist objects have no pinned, library-order, folder or last-played field, and no endpoint exposes pins (Spotify's app pins only exist in the app). The user does NOT want a pin feature in the widget, only to "reflect what's pinned", which the API cannot do. A tap-to-pin button was prototyped and fully removed at the user's request; do not re-add it. What remains: recently played order (recently-played endpoint + local record) and the optional manual `pinnedPlaylists` text setting (empty by default).
The widget's list (13 playlists for the user) also lacks items that appear in Spotify's own library view: Liked Songs, artists/albums, and probably Spotify-generated or editorial playlists (Release Radar, Blend, All-Time Top Songs, Kickass Metal). Likely a Spotify restriction for developer apps; unverified.

## v0.4.0 (2026-10-22): artists in the library, tappable queue
Library now lists playlists AND followed artists together (`GET /me/following?type=artist`, new scope `user-follow-read`, cursor paging), ordered by the same pinned-names/recent logic; recently-played contexts of type artist count too. Opening an artist shows popular songs: `GET /artists/{id}/top-tracks` first (marked deprecated; the Feb 2026 dev-mode migration says it was removed), falling back to `GET /search?q=artist:"name"&type=track&limit=10` filtered to that artist id (unit-tested). Tapping a song plays the list via `PUT /me/player/play` with `uris` + offset (context offset is not allowed for artists); Play uses the artist context URI. Up next rows are tappable: Spotify has no play-queue-entry endpoint, so `skipTo(idx)` calls `POST /me/player/next` idx+1 times (250 ms apart, re-entrancy guarded, optimistic queue trim, unit-tested). No manifest permission changes (same api.spotify.com host); users must reconnect once for the new scope (library header chip). Not yet verified on the Edge: which artist-songs path Spotify actually allows for this app, and rate limits on multi-skip.

## Docs structure (2026-10-22)
README.md is now the single full guide (both widgets, Spotify setup incl. each user hosting their own callback page, usage, troubleshooting, permissions, limitations, development). `docs/SPOTIFY_SETUP.md` is only a pointer to the README section; do not duplicate setup steps there. Keep README free of session logs, personal paths and tooling notes. When widget behaviour, scopes, permissions or versions change, update the README tables (versions, permissions, scopes) in the same change.

## v0.4.1 (2026-10-22): Up next plays directly
Replaced the skip-forward-N-times approach (it visibly flicked through every song) with one `PUT /me/player/play` call: `playQueueItem(idx)` sends `uris` = the tapped song plus the rest of the queue (max 100, track URIs only). Trade-off: this replaces the playlist/album context, so playback stops when that list ends. Podcast episodes in the queue cannot be started from a track-URI list, so those fall back to the old `skipTo(idx)`. `Api.playUris(uris, offsetUri?)` now takes an optional offset. Unit-tested offline (single call, list contents, re-entrancy guard, error path, episode fallback, 100 cap). Not yet tried on the Edge.

## v0.4.2 (2026-10-22): music only
User: "There are no podcast episodes I want to play in this app. It's only music." Removed the podcast-episode fallback and the skip-forward `skipTo` code entirely. The queue is filtered to `spotify:track:` items only (`isMusic`), so episodes, ads and null entries never appear or get played. `playQueueItem` is now a single `PUT /me/player/play` with the tapped song plus the rest of the queue. Do not add episode/podcast support unless asked. Offline tests updated and passing.

## v0.4.3 (2026-10-22): queue tap failed on real Spotify; verify + trace; song artwork
On the user's PC, v0.4.2 (play call with `uris` only) showed "Playing <song>", then Now Playing went to "Nothing playing" and Up next emptied: Spotify accepted the command but then reported nothing playing. Reproduced the widget side with a stubbed API end to end (headless Edge + stub fetch, harness kept outside the repo); root cause on Spotify's side NOT yet known. Changes: the play call now matches the artist song-list shape (`uris` + `offset` = tapped song, which works for the user); `confirmPlaying` polls `GET /me/player` for up to ~4 s and only trims the queue when Spotify really is playing the song, otherwise shows "Spotify didn't start that song. Press play in Spotify, then try again."; `Api` keeps a trace of the last 40 requests (time, method, path, status, short note; no tokens) in localStorage key `spotify-debug-<uniqueId>` so a failure can be read afterwards from the widget's own storage (iCUE keeps one browser profile per widget instance under %APPDATA%/Corsair/CUE5/html_widgets_browser_storage; only read that debug key, never the token key). Also: song rows inside playlists and artists now show artwork like Up next. Unit + end-to-end tested offline; NOT yet confirmed on the Edge.

## v0.4.4 (2026-10-22): song-list playback does not work on the user's PC; use context + offset
Evidence from the widget's own request trace (read from its localStorage on the user's PC): `PUT /me/player/play` with `{uris:[...]}` returns 204 but Spotify then reports `playing=false item=null` EVERY time (so both Up next taps and artist song taps failed); `PUT play` with `{context_uri: playlist|album, offset:{uri}}` returns 204 and playback starts (`playing=true item=<offset track>`). `GET /artists/{id}/top-tracks` returns 403 Forbidden (removed for dev-mode apps), search works. So: never use a `uris` list for playback in this widget. `startTrack(track, contexts)` tries each context (current playing playlist/album first, then the track's own album) with the track as offset, verifies with `confirmPlaying`, falls through on a 404 (song not in that context), and forces a queue reload. Artist songs play inside their own album. `Api.playUris` and `Api.artistTopTracks` removed; `artistSongs` is search-only. Verified end to end in headless Edge against a stub that mimics this PC (normal queue tap, user-queued song, artist song) - all pass. Not yet confirmed on the Edge. The trace (key `spotify-debug-<uniqueId>`) stays in for future diagnosis.

## publish/ is now one folder per widget (2026-10-22)
`publish/now-playing/` (thumbnail + 3 gallery) and `publish/spotify-library/` (thumbnail + 4 gallery: library, playlist, artists, colours), all 1920x960 PNG, 0.2-0.3 MB each. `node publish/build.mjs [now-playing|spotify-library]` regenerates them; Player for Spotify images are rendered from the widget's real index.html in `?mock=1` mode at XL (2536x696, scaled 0.72), with colour variants injected as globals through generated copies in the gitignored `publish/src/`. Images use fictional songs/artists and the widget name "Player for Spotify" (no Spotify logo, per Spotify branding rules). Marketplace upload limits: thumbnail 2:1 <=5MB; gallery >=3 items, <=10MB each.

## v0.4.5 (2026-10-22): polling-loop bug fixed; off-screen behaviour confirmed
Evidence from the widget request trace on the user's PC: (1) while the widget is on screen it polls `GET /me/player` every 4 s; (2) after the user swiped to another Edge page the requests STOPPED completely (last request 17:27:23, none for 3+ minutes), so iCUE suspends widgets on pages that are not showing and no visibility handling is needed in the widget; (3) from a song change onward the polls came in pairs one second apart, i.e. a SECOND polling loop had started. Cause: `pollSoon()` set a new timer without cancelling the one `poll()` set when it finished, so a `pollSoon()` during an in-flight request left two self-rescheduling timers (every track change could add another loop, doubling then tripling the request rate toward Spotify's limits). Fix: `poll()` clears any pending timer before scheduling its single next one; `pollSoon()` during a request only sets `S.again` so the next poll comes after ~700 ms. Reproduced with a fake-clock unit test (10 requests in 20 s before, 5 after) and re-ran the end-to-end scenarios. Progress seconds are computed locally (setInterval 500 ms, no network). Steady state is ~15 requests/min.

## Page theme: background colour + transparency (2026-10-22; Now Playing 1.0.5, Player for Spotify 0.4.6)
User report: both widgets were hard-coded black while the Edge page personalization (Device Background image, Widget Text Color, Widget Accent Color, Widget Background, Widget Transparency) should drive them. Cause: Now Playing used a non-standard property `bgColor` and had no `transparency`, so iCUE could not feed the page theme for the background (accent/text already worked because they use the standard names, which is why its play button was already blue); Player for Spotify used the right names but put an opaque-by-default colour on html/body (transparency default 100, parsed with a brittle hex-to-rgba helper). Fix = Corsair's own pattern (checked in the bundled Weather widget): standard names `textColor`, `accentColor`, `backgroundColor`, `transparency` (slider 0-100, default 80, unit %), personalization group titled "Widget Personalization" last; `html, body` background transparent; a separate `#bg` layer (`position: fixed; background: var(--bg); opacity: var(--bg-opacity)`) behind the content, so only the background fades and text/controls stay solid; JS sets `--bg` and `--bg-opacity` (= transparency/100). With the per-widget "Custom Style" switch OFF iCUE supplies the page theme through those same globals; ON uses the widget's own values. Verified in a browser over a colourful backdrop at 100/50/15. NEVER name the background property `bgColor`; always use the standard four names so Custom Style works. Listing-image builder sets opaque frames (transparency 100) so images look as before. NOT yet confirmed on the Edge.
