# Sources, licences and credits

## What is protected and what is not
Facts (where an item is, what a boss is weak to, which step comes next) are free to use. The wording, structure and images of a particular guide, wiki page or video are protected. So the policy is: **learn the facts, write them in your own words, credit the source, and only use images you may use.**

## What to do with each kind of material
| Material | How to use it |
|---|---|
| The user's own notes, screenshots, maps | Use freely. Credit the user as author; licence `personal-use` unless they choose another. |
| A web page, wiki or guide the user points at | Read it for facts, restate in your own words, list it in `credits.sources` with its title, URL, licence if stated, and the date you read it. Do not paste its paragraphs. Short quotes (a sentence at most) in quotation marks only when the exact wording matters. |
| Community wikis with an open licence (CC BY-SA etc.) | Facts as above. If the user wants to reuse the text itself, the licence usually requires attribution and the same licence on the result; put that in `attribution` and set `credits.license` accordingly, and tell the user it is a share-alike guide. |
| Game screenshots, maps and art | Publisher-owned. Only include them when the user supplied them for their own use (then mark the guide `personal-use` and tell them not to publish it), or the source licence allows it. When unsure, leave the image out and describe it in text. |
| Data from a spreadsheet or dataset the user supplies | Fine to use; credit the dataset in `sources`. |

## What goes in the manifest
- `credits.authors`: the people who wrote the guide (the user, plus anyone they name).
- `credits.license`: an SPDX id (`CC0-1.0`, `CC-BY-4.0`, ...) or `personal-use`.
- `credits.sources`: one entry per source: `title`, `url`, `licence`, `retrieved` (date).
- `credits.attribution`: a sentence or two shown on the Credits screen (for example "Written from the author's own play notes. Map image supplied by the author, not for redistribution.").
- Per image, `assets[].credit` when the picture is someone else's.
- `credits.generator`: `{ "tool": "ggp-guide-builder", "version": "1.0.0" }`.

## Tell the user plainly
If a guide contains material they cannot publish (publisher art, share-alike text), say so in the final report, and say what to remove before sharing it. The licence in the file is the user's responsibility; your job is to make the record accurate.
