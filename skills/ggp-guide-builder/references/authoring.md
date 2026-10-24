# Authoring guide content

How to shape source material into `data.json`. The field-by-field spec is in `format.md`; `../examples/mini-guide/` shows every feature working together.

## Start from how the guide will be used
The widget shows two panes side by side on a 32:9 touch screen while the player is in a game. Players glance, tap, tick a box, and go back to the game. So write short, scannable pages and use trackers for anything they will want to tick off.

## Navigation
- One flat list for small guides (under about 12 entries); `group` nodes for chapters or areas for bigger ones. Depth 3 is plenty (limit 6).
- Order follows how people play: Start here, Walkthrough (chapters in game order), then the trackers (collectibles, missables, quests), then maps, trees and tables.
- Every page, map, collection, tree and table should be reachable from the navigation or linked from a page. The validator warns about the ones that are not.

## Pages and blocks
- A page is one screen of reading: roughly 150-400 words of blocks. Split long chapters into several pages (one per area or objective).
- `summary` is one sentence that says what the page gets the player (it shows under the title and helps them pick).
- A walkthrough page must let the player act without any other source: the objective, the steps in order (usually 5-12), what makes the optional objectives succeed, and the one or two things that commonly go wrong, all taken from your sources. One memory or mission is one `heading` plus one `steps` block; a sequence or chapter page chains them. A page that only says what the chapter is about is an overview, not a walkthrough.
- Typical walkthrough page: `heading` (objective), `steps` (what to do, in order), `callout` (warnings: `missable` for things that can be lost, `boss` for fight notes, `tip` for shortcuts), then `mapLink` / `pageLink` chips to related places.
- Use `steps` for sequences, `text` for explanation, `table`/`keyValue` for small facts. Bigger or reusable tables belong in `tables`.
- Put a `spoilerLevel` on pages (0 safe, 1 mild, 2 story, 3 major) when the source distinguishes them.
- Images need an `alt` in the manifest (what the picture shows) and a `caption` when it helps. Do not embed text that matters only inside a screenshot; also write it as text.

## Trackers (collections)
- `kind` says what the list is: `collectibles`, `missables`, `quests`, `achievements`, `steps`.
- Give each item a stable, readable id with its area first when useful (`shore-lantern`, `cave-lantern`). Ids are how progress is saved, so keep them unchanged in later versions; if you must rename a guide, list the old guide id in `guide.replaces`.
- `groupBy: "area"` plus an `area` on each item gives the player grouped sections with counts.
- `missable: true` and `pointOfNoReturn: true` come only from the source. They show warning tags, so a wrong one frightens people.
- `requires` lists item ids that must be done first. `pageRef` links to the walkthrough page. `pins` links to map pins (see maps-and-pins.md).
- Link a `steps` entry to an item with `itemRef` when ticking the step should tick the item.

## Trees and builds
- Each node: `id`, `label`, `x`, `y`, `maxPoints`, `description`, `requires`. Lay `x`/`y` out so the tree reads left to right or top to bottom; any consistent unit works.
- `presets` are named builds as `allocations: { nodeId: points }`. Check each preset against `maxPoints` and `requires`; the widget caps points at `maxPoints`, so a preset that exceeds it silently changes. If the source's build is inconsistent, say so in your report instead of fixing it quietly.

## Writing style
- Imperative, concrete, short sentences ("Take the left door", not "You may want to consider going left"). Name things exactly as the game does.
- No filler, no jokes the player has to parse mid-fight, no marketing words.
- Do not copy a source's sentences. Restate facts in your own words; the facts themselves are not protected, the wording is. Short quotes only when needed, in quotation marks, credited.

## Self-check before validating
Every `pageRef`, `itemRef`, `mapId`/`pinId`, `asset` and `[..](page:id)` points at something that exists; every checklist item the walkthrough mentions is in a tracker; numbers and names match the source; nothing is in the guide that the user did not provide or confirm.
