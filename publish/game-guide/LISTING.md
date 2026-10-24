# Game Guide: Marketplace listing (version 1.0.0)

Everything below is ready to paste or tick. Section B is the only part meant to be pasted as plain text.

## A. Basics

- **Title:** Game Guide
- **Tagline:** Walkthroughs, checklists and maps beside your game. Import any guide, tick things off, tap a pin.
- **Suggested category:** Gaming (or Utilities if there is no Gaming category)
- **Suggested tags:** game guide, walkthrough, checklist, map, collectibles, skill tree, XENEON EDGE, touch, offline
- **Author:** Scott Reed Development
- **Version:** 1.0.0
- **Widget id:** com.scottreed.gameguide

## B. DESCRIPTION (paste-ready)

WHAT GAME GUIDE IS
Game Guide turns the whole XENEON EDGE screen into a reader for game guides: walkthroughs, collectible checklists, interactive maps and skill trees, right beside your game. It does not come with guides for specific games. You import guide files (.ggp), and you can keep as many as you like. A small sample guide for a fictional game is installed the first time so you can try every feature straight away.

IMPORTING GUIDES
Tap Library, then Import guide, and choose a .ggp file. The file chooser opens on the Edge. If you import a newer version of a guide you already have, it is updated and your progress is kept.

THE LIBRARY
Each guide shows as a card with its version, number of pages, progress and size. Open starts a guide. Hide takes a guide out of the quick switcher (it moves to a Hidden guides section and Show brings it back). Delete removes a guide and its progress; tap it twice to confirm. Inside a guide, tap the guide title at the top to switch quickly to another guide, or choose Manage guides to return to the library.

PAGES AND LISTS
The list on the left shows the guide's contents, with folders you can open and close. Pages can contain text, headings, numbered steps, callouts (tips, warnings, missable items and bosses), pictures, galleries, tables and key facts. Links inside pages jump to other pages, checklists or maps.

CHECKLISTS
Tick items off with a tap. Items can be grouped, and each group shows its own count. Items can carry a Missable tag and a Needs line that names what you must do first. Walkthrough steps can be tied to a checklist item, so you can tick them as you read. The top bar shows overall progress, and Hide completed removes finished items so only what is left remains. Progress is saved per guide.

MAPS
Drag to move a map and pinch with two fingers to zoom, or use the plus and minus buttons. Fit shows the whole map again. Colour-coded pins open a card with a description; if the pin belongs to a checklist item you can mark it found right there, and the checklist ticks too. Checklist items have a Map button that jumps straight to their pin. Legend chips and layer chips show or hide kinds of pins, and Hide found clears the ones you have already collected. Routes and regions are drawn over the map and can be tapped for details. Full screen gives the map the whole widget; tap Close to return. Skill trees have Full screen too.

SKILL TREES
Tap a skill, then plus or minus to spend or take back points. A skill stays locked until the skills it needs have a point, and you cannot remove a point from a skill that another one still depends on. Preset builds can be loaded with one tap, Reset clears the tree, and your points are remembered.

PICTURES
Tap any picture in a page to see it full screen, then drag and pinch to look closer.

TWO PANES
Two panes splits the screen into two equal halves, and each half can show anything: a page, a checklist, a table, a map or a skill tree. Above the list is an Open in chooser (Left or Right) that decides where the next thing you tap opens, and small L and R badges show what each half is showing. A link inside a half opens in that same half, except links to a map or a skill tree, which open in the other half so you can keep reading. One pane goes back to a single pane, and Two panes again brings back what each half was showing.

BACK BUTTON
Each pane has its own Back button at the top right. It returns to what that pane showed before, including how far you had scrolled, and remembers the last 10 steps for each pane.

CREDITS
The Credits button shows who made the guide, its version, language, licence, the tool it was made with, and the sources it drew on.

PERSONALIZATION
Text Color, Accent Color, Background Color and Background Transparency are available in the widget settings, and the widget follows your Edge page theme unless you switch on Custom Style. Only the background fades with transparency; text, maps and buttons stay solid.

OFFLINE, STORAGE AND PRIVACY
Game Guide works completely offline and needs no account, no sign-in and no internet connection. Guides and your progress are stored inside the widget, so they survive restarts of iCUE. They are lost if you delete the widget from the Edge page. Nothing is sent anywhere.

REQUIREMENTS AND PERMISSIONS
XENEON EDGE with iCUE 5.47 or newer on Windows. The widget is made for the Extra Large slot only, because it needs the full screen, and it is designed for touch. It asks for no permissions and uses no plugins.

LIMITATIONS
Extra Large slot only. Guides can be up to 60 MB as a file, with up to 5 MB of guide data and images up to 4096 pixels on a side. The touch screen supports two fingers at once, so you cannot press two buttons at the same moment. Maps show pins only where the guide author has supplied coordinates.

HOW GUIDES ARE MADE
A guide is a .ggp file: a zip containing a manifest, a data file and images. You can make your own with the open-source ggp-guide-builder skill for Claude Code, found in the project repository (folder skills/ggp-guide-builder). It aims for comprehensive guides: it turns your notes, wiki text, checklists, map coordinates and skill-tree data into a validated .ggp with full step-by-step walkthroughs, every collectible type, areas, tips and trophies where the sources allow, writes in its own words, records credits and sources, and never guesses map coordinates. It includes a command-line checker (validate, pack, inspect, init). To install it, copy the folder to ~/.claude/skills/ggp-guide-builder and run npm install inside it once. Then ask Claude something like: Make a Game Guide for [game] from these notes, with a checklist of every collectible.

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
