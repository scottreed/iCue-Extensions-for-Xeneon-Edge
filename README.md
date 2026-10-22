# iCUE Widgets for XENEON EDGE

Custom HTML widgets for the Corsair XENEON EDGE touchscreen, built with the iCUE Widget API.

## Widgets
| Widget | Version | Description |
|---|---|---|
| [Now Playing](widgets/now-playing) | 1.0.3 | Current track, album art and touch media controls |

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
This creates `now-playing.icuewidget` in the current folder. In iCUE, open Widgets, click **+**, and select the file (or double-click it).

## Project layout
```
widgets/
  now-playing/
    manifest.json
    index.html
    style.css
    app.js
    resources/icon.svg
```

## Documentation
- [iCUE Widgets docs](https://docs.elgato.com/icue/widgets/)
- [Media Data Provider plugin](https://docs.elgato.com/icue/widgets/references/plugins/media-data-provider)
- [How to create a custom widget for the XENEON EDGE](https://www.corsair.com/uk/en/explorer/diy-builder/accessories/how-to-create-a-custom-widget-for-the-xeneon-edge/)

## Notes
This is an independent implementation written from the public iCUE documentation. It is not affiliated with Corsair, Elgato or the authors of any Marketplace widget.
