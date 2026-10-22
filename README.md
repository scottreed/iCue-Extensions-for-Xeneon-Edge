# iCUE Widgets for XENEON EDGE

## Status
| Widget | State |
|---|---|
| Now Playing (`widgets/now-playing`) | v1.0.0: imports and displays on hardware; buttons confirmed working; v1.0.3 fixes Medium layout, awaiting retest. |

## Now Playing
Features implemented (matching the marketplace description): title/artist/album, album art with crossfade,
placeholder tile when no art, prev / play-pause / next touch buttons (dimmed when idle), custom text/accent/background colours.
Data comes from iCUE's Media Data Provider plugin (Windows media session: Spotify, Apple Music, browsers, etc.).

Not yet done: themes (Glass, Terminal, Cozy, Cyberpunk, Retro), effects, text-size setting, transparent background,
separate Small/Medium layouts, translation.json.

## Build
```bash
npm install -g icuewidget-cli
icuewidget validate widgets/now-playing
icuewidget package widgets/now-playing
```
Install: iCUE > Widgets > "+" > select `now-playing.icuewidget`. Requires iCUE 5.44+ and a XENEON EDGE.

## Log
- 2026-10-22: Researched docs; wrote now-playing widget; fixed validator issues (see CLAUDE.md); packaged.
- 2026-10-22: User imported v1: widget displayed but buttons did nothing and looked poor. Rebuilt buttons (round SVG icons, large primary play button) and rewired controls (bound at load, pointer+touch+click with debounce, lazy plugin lookup, on-screen error). Cause of dead buttons unconfirmed - awaiting retest.
- 2026-10-22 (v1.0.1): Root cause of dead buttons: manifest `interactive: true` was missing (default false disables touch clicks). Added it, and centred text+controls beside the art with wider spacing. Awaiting retest.
- 2026-10-22: Buttons confirmed working with `interactive: true`. Medium slot was broken (art sized to full height squeezed text). v1.0.3 adds stacked layout via `@media (max-aspect-ratio: 11/5)` and caps art width at 46%. Awaiting retest on Medium.
- 2026-10-22: Initialised git (branch `main`), added .gitignore (ignores `.icuewidget` builds and local AI files; CLAUDE.md is tracked) and .gitattributes (LF endings).
- 2026-10-22: Installed Corsair's `icue-widget-builder` skill (github.com/Corsair-Labs/icue-widget-builder) to `~/.claude/skills/` (user level, not in this repo). Restart Claude Code to load it.
