# Game Guide: Marketplace listing (version 1.0.0)

Everything below is ready to paste or tick. Section B (inside the code block) is the only part meant to be pasted as plain text, and it must stay under 4,000 characters.

## A. Basics

- **Title:** Game Guide
- **Tagline:** Walkthroughs, checklists and maps beside your game. Import any guide, tick things off, tap a pin.
- **Suggested category:** Gaming (or Utilities if there is no Gaming category)
- **Suggested tags:** game guide, walkthrough, checklist, map, collectibles, skill tree, XENEON EDGE, touch, offline
- **Author:** Scott Reed Development
- **Version:** 1.0.0
- **Widget id:** com.scottreed.gameguide

## B. DESCRIPTION (paste-ready)

**Limit: the Marketplace description field allows at most 4,000 characters. The text below is 3,473 characters (counted with plain line breaks, spaces included). If you edit it, keep it under 4,000.**

```
WHAT GAME GUIDE IS
Game Guide turns the whole XENEON EDGE screen into a reader for game guides: walkthroughs, collectible checklists, interactive maps and skill trees, right beside your game. It comes with no guides for specific games. You import guide files (.ggp) and keep as many as you like. A small sample guide for a fictional game is installed on first run so you can try everything.

GETTING GUIDES IN
Tap Library, then Import guide, and choose a .ggp file (the chooser opens on the Edge). Importing a newer version of a guide updates it and keeps your progress. In the library, Open starts a guide, Hide and Show move it in and out of the quick switcher, and Delete (tap twice) removes it and its progress. Tap the guide title at the top to switch guides.

READING
The list on the left shows the contents. Pages mix text, numbered steps, callouts (tips, warnings, missables, bosses), pictures, tables and key facts, and links jump to other pages, checklists, maps or skill trees. Tap any picture to see it full screen.

CHECKLISTS
Tick items off with a tap. Groups show counts, the top bar shows overall progress, and Hide completed removes finished items. Items can carry Missable and Needs notes, and walkthrough steps can tick a checklist item. Progress is saved per guide.

MAPS
Drag to move, pinch with two fingers (or use + and -) to zoom, and Fit to see the whole map. Pins open a card and can be marked found, which also ticks the checklist item. Checklist items have a Map button that jumps to their pin. Legend and layer chips hide or show pins, Hide found clears collected ones, and routes and regions are drawn on top. Full screen gives a map the whole widget.

SKILL TREES
Tap a skill, then + or - to spend points. Skills stay locked until the ones they need have a point, and you cannot remove a point another skill depends on. Load preset builds with one tap; your points are remembered.

TWO PANES
Two panes splits the screen into two equal halves that can each show a page, checklist, table, map or skill tree. Open in Left / Right above the list decides where the next tap opens. Links open in the same half, except map and skill tree links, which open in the other half so you keep reading. Each pane has a Back button that remembers its last 10 steps, including scroll position.

YOUR LOOK
Text, accent and background colour and transparency follow your Edge page theme, or use Custom Style for your own. Only the background fades.

OFFLINE AND PRIVATE
Works fully offline with no account. Guides and progress are stored inside the widget, survive iCUE restarts, and are lost if you delete the widget. Nothing is sent anywhere. No permissions or plugins are needed.

REQUIREMENTS AND LIMITS
XENEON EDGE, iCUE 5.47 or newer, Windows, Extra Large slot only. Guide files up to 60 MB. The screen supports two touches at once. Maps show pins only where the guide author supplied coordinates.

MAKE YOUR OWN GUIDES
A guide is a .ggp file (a zip with a manifest, data and images). The open-source ggp-guide-builder skill for Claude Code, in the project repository, builds comprehensive guides from your notes, wiki text, checklists and map data: step-by-step walkthroughs, collectibles, areas and tips, validated, with credits and sources, written in its own words and never guessing map coordinates. Copy skills/ggp-guide-builder to ~/.claude/skills/ and run npm install inside it once, then ask Claude: Make a Game Guide for [game] from these notes.
```

## C. What's new in 1.0.0

First public release. Game Guide 1.0.0 brings together everything built during testing: a library with import, hide, show and delete; pages with steps, callouts, images and tables; checklists with progress, missable and requirement warnings; interactive maps with pins, legends, routes, regions and full screen; skill trees with presets; two equal panes with the Open in chooser and a Back button for each pane; a credits screen; and personalization that follows the Edge page theme.

## D. Submission checklist

| Item | Value |
|---|---|
| Package | `game-guide.icuewidget` (repo root) |
| Version / author | 1.0.0 / Scott Reed Development |
| Thumbnail | `publish/game-guide/thumbnail.png` (1920x960, PNG, about 0.3 MB; limit 5 MB) |
| Gallery 1 | `publish/game-guide/gallery-1-two-panes.png` (1920x960, about 0.2 MB) |
| Gallery 2 | `publish/game-guide/gallery-2-checklist-map.png` (1920x960, about 0.2 MB) |
| Gallery 3 | `publish/game-guide/gallery-3-skill-tree.png` (1920x960, about 0.2 MB) |
| Gallery 4 | `publish/game-guide/gallery-4-fullscreen.png` (1920x960, about 0.16 MB) |
| Gallery 5 | `publish/game-guide/gallery-5-colours.png` (1920x960, about 0.3 MB) |
| Limits met | Thumbnail PNG/JPG up to 5 MB at 1920x960; gallery at least 3 items, PNG/JPG up to 10 MB at 1920x960 |
| Validation | `icuewidget validate widgets/game-guide` passes (one warning: no translation.json) |
| Permissions / plugins | none |
| Supported device / size | XENEON EDGE (dashboard_lcd), Extra Large only, Windows |
| Minimum iCUE | 5.47 (manifest `min_app_version`) |

I could not verify which other fields the Elgato/Corsair Marketplace form asks for (for example category list, support link, licence, price). Nothing in the widget-builder skill's references describes the form beyond the image limits above, so fill in whatever the form shows.

The gallery images use a fictional game ("Lantern Isle") and no real game artwork or logos.

## E. Claims to double-check before submitting

- "iCUE 5.47 or newer": taken from the manifest; the project notes say the Marketplace lists 5.44+ for another widget, so confirm 5.47 is right for this one.
- "Images up to 4096 pixels on a side" and "up to 2000 pins per map": enforced by the guide checker and format spec (skills/ggp-guide-builder/references/format.md), not by the widget's own code, which only checks the 60 MB file size and its own size limits when opening.
- "Survives iCUE restarts": the code stores in IndexedDB and localStorage, and a restart test with a 100 MB file was recorded during development, but confirm on your hardware with the final package.
- "Follows the Edge page theme": uses the standard personalization property names; confirm the Custom Style switch behaves the same on the Edge for this widget.
- Marketplace category and tag names are suggestions; pick from the form's actual lists.
- The ggp-guide-builder skill must be publicly reachable in the repository for the "found in the project repository" sentence to be useful; add the repository URL to the description if the form allows links.
- The Missable, Needs and Hide completed behaviour and the first-run sample guide were checked against the code, but not exercised on hardware in this release step.
