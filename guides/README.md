# Guides

Game guides for the [Game Guide widget](../README.md#game-guide), published as `.ggp` files plus their source folders.

| Guide | Game | Version | Download | What it has |
|---|---|---|---|---|
| Black Flag Resynced | Assassin's Creed IV: Black Flag Resynced (PC) | 0.2.0 | [black-flag-resynced.ggp](black-flag-resynced.ggp) | A page for every story memory with steps and tips, trackers for collectibles, side content, gear and trophies, an area page for each island and town, tips and common problems, and a map picture. Details and gaps are listed on the guide's own Known gaps page |

## Using a guide
Download the `.ggp`, then in the Game Guide widget tap **Library**, then **Import guide**, and choose the file.

## Layout
Each guide has a source folder and a packed file:
```
guides/
  <game>.ggp          the packed guide (what you import)
  <game>/             manifest.json, data.json, assets/ (the source the .ggp is packed from)
    research/         notes the guide was assembled from, in the author's own words, with their sources
    build.mjs         optional: assembles manifest.json and data.json from research/ (run it, then pack)
    outline.md        what the guide covers and what it leaves out
```
Build a guide with the [ggp-guide-builder](../skills/ggp-guide-builder) skill, then check and pack it:
```bash
node skills/ggp-guide-builder/scripts/ggp.mjs validate guides/<game>
node skills/ggp-guide-builder/scripts/ggp.mjs pack guides/<game> -o guides/<game>.ggp
```

## Credits and licences
Every guide lists its sources on its **Credits** screen. Guide text is written in the author's own words from facts in those public sources. Game names, artwork and trademarks belong to their owners, and the guides are not affiliated with or endorsed by the publishers. The Black Flag guide includes one map picture (Ubisoft artwork, from a public guide site) unaltered, and all rights in it remain with their owners. Guides are free to use unmodified, not to resell or republish.
