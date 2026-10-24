# Game Guide Pack (.ggp) format, version 1.0

A `.ggp` is a zip file (deflate, UTF-8 names, forward slashes) holding:

```
manifest.json     identity, credits, asset registry
data.json         the guide content
assets/...        png, jpeg, webp or svg images only
```

The validator `scripts/ggp.mjs validate` is the authority; this page describes what it checks.
All ids match `[a-z0-9._-]{1,64}`. Nothing is positional: everything is linked by id.

## Limits (the widget enforces the same ones)
| What | Limit |
|---|---|
| Archive | 60 MB; at most 5000 entries; 300 MB uncompressed in total |
| `data.json` / `manifest.json` | 5 MB / 256 KB |
| Image | 8 MB and 4096 px per side |
| Pins per map | 2000 |
| Navigation depth | 6 levels |
| Any text string | 20,000 characters |
| Paths | no `..`, no `.`, no leading `/`, no drive letters, no backslashes |

## manifest.json
```json
{
  "formatVersion": "1.0",
  "guide":   { "id": "kebab-id", "title": "", "subtitle": "", "version": "1.0.0", "language": "en",
               "spoilerPolicy": "all | progressive", "cover": "asset-id", "replaces": ["old-guide-id"] },
  "game":    { "title": "", "platforms": ["PC"] },
  "credits": { "authors": ["name"], "license": "CC0-1.0 | personal-use | ...",
               "sources": [{ "title": "", "url": "", "licence": "", "retrieved": "2026-10-24" }],
               "attribution": "text shown on the credits screen" },
  "assets":  [{ "id": "", "path": "assets/x.png", "alt": "", "credit": "" }],
  "stats":   { }
}
```
`guide.id` never changes between versions (progress is stored under it). `replaces` lets a renamed guide inherit progress.
`ggp pack` fills `assets[].mime/bytes/sha256/width/height` and `stats`; the validator checks them in a `.ggp`.

## data.json sections
`navigation`, `pages`, `collections`, `maps`, `trees`, `tables`, `glossary` (all arrays; `navigation` and `pages` required).

**navigation** nodes `{ id, title, icon?, type: page|map|collection|tree|table|group, ref, children? }`. Only `group` has `children` and no `ref`.

**pages** `{ id, title, summary?, tags[], area?, spoilerLevel 0-3, minutes?, blocks[] }`.

**blocks** (`type`): `text {text}`, `heading {text, level 1-3}`, `steps {items:[{text, itemRef?}]}`,
`callout {kind: tip|warning|missable|boss|note, title?, text}`, `image {asset, caption?}`, `gallery {images:[{asset, caption?}]}`,
`table {columns[], rows[][]}`, `keyValue {items:[{key, value}]}`, `pageLink {page, label?}`, `mapLink {map, pin?, label?}`,
`collectionLink {collection, label?}`, `divider`.

**Text** is plain text with `**bold**`, `*italic*` and links of the form `[label](page:id)` (also `map:`, `collection:`, `tree:`, `table:`).
No HTML, no external links.

**collections** (trackers) `{ id, title, kind: missables|collectibles|quests|achievements|steps, groupBy?, items[] }`,
item `{ id, label, detail?, tags[], area?, missable?, pointOfNoReturn?, requires[] (item ids), pins:[{mapId, pinId}], pageRef?, images[] }`.
Item ids are unique across the whole guide because progress is saved by item id.

**maps** `{ id, title, coordinateSystem: "pixel-top-left", image:{asset}, size:{w,h}, layers[], legend[], pins[], routes[], regions[], initialView? }`.
Coordinates are image pixels, x to the right, y down, inside `size`. Legend `{ typeId, label, colour "#RRGGBB", icon?, defaultVisible? }`.
Pin `{ id, x, y, type (a legend typeId), title, description?, itemId?, pageRef?, layer? }`. Route `{ id, title, points [[x,y], ...>=2], pageRef? }`. Region `{ id, title, points >=3 }`.
`initialView` is { x, y, zoom }: x,y is the map point to centre, zoom is a multiple of the "fit whole map" scale (1 = whole map visible, 3 = three times closer). The widget remembers where you left each map.
(Tiled maps are reserved for 1.1.)

**trees** `{ id, title, background?, nodes:[{id,label,x,y,maxPoints 1-99,description?,requires[]}], edges:[{from,to}], presets:[{id,title,allocations:{nodeId:points}}] }`.
Node x,y are the node centres in any consistent unit (they are laid out as given, with a margin). A node cannot get points until every node in its `requires` has at least one; `requires` pairs are drawn as lines even when not listed in `edges`. The widget saves the points you allocate per tree.

In the widget, tapping a pin shows its card (title, description, a "Mark found" button when the pin has an `itemId`, and a link to its page). Pins are drawn at a constant size whatever the zoom. Legend types and layers become filter chips.

**tables** `{ id, title, columns:[{id,label,type: text|number|bool}], rows:[[...]] }`, each cell matching its column type.

**glossary** `[{ term, definition, pageRefs[] }]`.

## What the validator also reports as warnings
Pages, maps, collections, trees or tables not reachable from the navigation; unused assets; assets without alt text; no sources listed;
files outside `manifest.json`, `data.json` and `assets/`; text that looks like HTML.

## Commands
```
node scripts/ggp.mjs init <folder> [--title "My Guide"]
node scripts/ggp.mjs validate <folder|file.ggp> [--json]
node scripts/ggp.mjs pack <folder> [-o out.ggp] [--force]
node scripts/ggp.mjs inspect <folder|file.ggp>
```
Install once with `npm install` inside `skills/ggp-guide-builder`. Run the tests with `npm test`. `examples/mini-guide` is a complete fictional guide.
