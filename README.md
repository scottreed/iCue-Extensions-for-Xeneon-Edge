# iCUE Widgets for XENEON EDGE

Custom HTML widgets for the Corsair XENEON EDGE touchscreen, built with the iCUE Widget API.

## Widgets
| Widget | Version | Description |
|---|---|---|
| [Now Playing](widgets/now-playing) | 1.0.4 | Current track, album art and touch media controls |
| [Library Player](widgets/spotify-library) | 0.1.0 (untested on hardware) | Browse your Spotify playlists and songs, see the queue, now playing with controls. [Setup guide](docs/SPOTIFY_SETUP.md) |

## Now Playing
- Title, artist and album, with album art that crossfades between tracks (colour tile when there is no art)
- Previous, play/pause and next touch buttons, dimmed when nothing is playing
- Custom text, accent and background colours
- Responsive layout: side by side on wide slots (Small, Large, XL), stacked on squarer slots (Medium)
- Works with any app that appears in Windows media controls (Spotify, Apple Music, browsers, and so on) via iCUE's Media Data Provider plugin

Planned: themes and effects, text-size setting, transparent background, translations.

## Requirements
- XENEON EDGE
- iCUE 5.44 or later (Windows)
- Node.js, for the [iCUE Widget CLI](https://www.npmjs.com/package/icuewidget-cli)

## Build and install
```bash
npm install -g icuewidget-cli
icuewidget validate widgets/now-playing
icuewidget package widgets/now-playing
```
This creates `now-playing.icuewidget` in the `widgets/` folder. In iCUE, open Widgets, click **+**, and select the file (or double-click it).

## Project layout
```
widgets/
  now-playing/
    manifest.json
    index.html
    style.css
    app.js
    resources/icon.svg
  spotify-library/   (Library Player: js/, app.js, style.css, index.html, manifest.json)
docs/                (setup guide and the GitHub Pages callback page)
publish/             (Marketplace listing images)
```

## Marketplace images
`publish/` holds the listing images (1920x960 PNG) rendered from the real widget with mock data: `node publish/build.mjs` (needs Edge or Chrome).

## Documentation
- [iCUE Widgets docs](https://docs.elgato.com/icue/widgets/)
- [Media Data Provider plugin](https://docs.elgato.com/icue/widgets/references/plugins/media-data-provider)
- [How to create a custom widget for the XENEON EDGE](https://www.corsair.com/uk/en/explorer/diy-builder/accessories/how-to-create-a-custom-widget-for-the-xeneon-edge/)

## Notes
This is an independent implementation written from the public iCUE documentation. It is not affiliated with Corsair, Elgato or the authors of any Marketplace widget.

## Library Player
Full-screen Spotify companion for the XENEON EDGE: your library, the songs inside each playlist, the current queue, and now playing with controls. Layouts adapt from Small to Extra Large. Requires Spotify Premium and your own free Spotify developer app; see the [setup guide](docs/SPOTIFY_SETUP.md). It is an independent project and is not affiliated with or endorsed by Spotify.
