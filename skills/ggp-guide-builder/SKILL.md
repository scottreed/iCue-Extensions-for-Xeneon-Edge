---
name: ggp-guide-builder
description: Builds comprehensive Game Guide Pack (.ggp) files for the "Game Guide" iCUE widget on the Corsair XENEON EDGE: full step-by-step walkthroughs plus the collectibles, areas, bosses, tips and pain points a player would normally look up. Turns walkthrough notes, wiki text, checklists, map coordinates, skill trees or build notes into a validated .ggp archive (guide data, images, credits, sources). Use this whenever the user wants to make, convert, generate, update, validate or pack a game guide, walkthrough, collectibles or missables checklist, map with pins, skill tree or build planner, or mentions a .ggp file or the Game Guide widget - even if they only say "turn these notes into a guide for my Edge" or "make a guide for [game]".
---

# Game Guide Pack builder

A `.ggp` file is a zip with `manifest.json`, `data.json` and images that the Game Guide widget imports on the Edge. You turn the user's material (notes, pasted wiki text, files, spreadsheets) into one, and prove it is valid with the bundled CLI. The full format is in `references/format.md`; read it before writing any JSON.

## The goal: a guide the player does not have to leave
A guide made with this skill should contain what a player would otherwise go and look up while playing, so they can keep it open beside the game and not need anything else. By default that means the **whole game, comprehensively**: the full story walkthrough with real steps, every side activity, every collectible type (how many, where, how to get each, what it unlocks), what is in each area, bosses and set pieces, upgrades and economy, missables and points of no return, achievements, and the **pain points** (parts people get stuck on, hidden requirements, common mistakes, poorly explained mechanics). `references/coverage.md` is the checklist; read it at the start and use it for the outline, the research and the final report. Only narrow the scope when the user explicitly asks for less, and then record what is left out. A short summary-style guide is a failure of this skill, not a safe default.

## Why the rules below exist
Guides are shared with other people and shown on a touch screen mid-game. So: the text must be the guide author's own wording with credit given (copyright), every id must stay the same between versions (players' progress is saved by id), and nothing may be invented that looks authoritative (a wrong map pin costs a player real time). The widget also refuses unsafe or oversized files, so the CLI enforces the same limits.

## Setup
The CLI is `scripts/ggp.mjs` in this skill's folder (Node 18+). Run `npm install` once in that folder (one dependency, `fflate`). Commands:
```
node scripts/ggp.mjs init <folder> --title "..."     starter guide
node scripts/ggp.mjs validate <folder|file.ggp>      errors and warnings; exit 1 on errors
node scripts/ggp.mjs pack <folder> -o <name>.ggp     fills hashes and stats, validates, writes the zip
node scripts/ggp.mjs inspect <file.ggp>              readable summary
```
`examples/mini-guide/` is a complete small guide that uses every feature; copy its shapes.

## Workflow
1. **Ask first** (one grouped message, skip what the user already said): the game and platform; whole game or some sections; what material they have (files, notes, URLs) and whether they wrote it; spoiler policy (`all` or `progressive`); language; licence they want on the guide (default `personal-use` if it is their own notes for themselves, else ask); which images they own; whether maps need pins and where the coordinates come from. If the user is not available to answer, state your assumptions in `outline.md` and continue.
2. **Gather** the source material and note where each part came from (you will need it for credits). Read `references/sources-and-credits.md` if anything came from a website, wiki or another guide. A source page that gives only an overview is not enough for step-by-step content: fetch the pages that carry the steps themselves, and read them fully. For a big game, split the research (for example one chunk of chapters per helper agent) and have each write structured notes in your own words to a `research/` folder, then assemble the guide from those notes so nothing depends on memory or on a single long read.
3. **Outline**: write `outline.md` in the guide folder (a coverage table with a status for every category in `references/coverage.md`, then the navigation tree, pages, checklists, maps, trees, tables, what is deliberately left out, assumptions) and stop for approval when the user is present. A wrong structure is cheap to fix here and expensive later. For every kind of page, state the **content it will actually hold** (for a walkthrough page: the ordered steps, optional objectives and tips for each mission) and which source supplies it. If your sources cannot support what the user asked for (for example they asked for a walkthrough but you only found plot summaries), say so now and either research deeper or agree a smaller promise; never call something a walkthrough that is only a summary.
4. **Generate** `data.json` and `manifest.json` in chunks (one chapter or area at a time for big sources). Follow `references/authoring.md` for structure, ids and style. Use your own wording; keep any quoted text short and credited.
5. **Maps and pins**: read `references/maps-and-pins.md` before touching a map. Only write coordinates that came from the user or a dataset they supplied. Never estimate positions from an image.
6. **Depth check, then validate.** Open a few generated pages as the player would: could someone follow this page to finish the mission, find the item or complete the build? A page that is only a title and a one-line summary fails that test, so go back and research or say plainly in your report that the page is a summary. Count the content (steps per walkthrough page, items per tracker) and compare with what the outline promised. Then validate and fix until `validate` reports 0 errors, then read the warnings (unreachable pages, unused images, missing alt text, no sources) and fix the ones that matter.
7. **Pack** with `pack`, run `inspect` on the result, and tell the user: where the `.ggp` is, the coverage table with a status per category, what it contains (counts of missions, steps and collectible items, and how much detail a typical page has), what you left out or could not do (for example pins you could not place because no coordinates were given, or missions where the source gave no steps), and how to load it (Game Guide widget, Library, Import guide). Describe the depth honestly: "sequence summaries only" and "step-by-step for every mission" are different products and the user will judge the guide by what it can do mid-game.

## Hard rules
- Ids match `[a-z0-9._-]{1,64}`, are meaningful (`lantern-shore`, not `item-17`), and never change once a guide has been shared. Item ids are unique across the whole guide.
- Text is plain: `**bold**`, `*italic*`, and `[label](page:id)` links only (targets: page, map, collection, tree, table). No HTML, no external links, no Markdown headings inside text blocks (use `heading` blocks).
- Credits are mandatory: authors, a licence, and every source with its licence. Do not leave `sources` empty unless the content is entirely the user's own; say so in `attribution`.
- Do not invent facts, coordinates, stats or item locations. If the source is silent or contradictory, keep the item without the detail, and list the gap in your final report.
- A "walkthrough" means actionable steps in order (what to do, where to go, what to avoid). A guide made only of summaries, titles and checklists must not be described as a walkthrough, to the user or in the guide's own page titles and summaries.
- Keep within the limits (zip 60 MB, data 5 MB, images 4096 px and 8 MB, 2000 pins per map). Prefer webp/png/jpeg; resize big images before packing.
- Write guide folders outside this skill's folder unless the user says otherwise, and never edit `examples/`.
