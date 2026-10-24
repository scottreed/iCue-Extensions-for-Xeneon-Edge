# Maps and pins

## The rule
**Never estimate a coordinate by looking at a map image.** Language models cannot read pixel positions reliably, and a pin that is a few hundred pixels off looks exactly as authoritative as a correct one. A pin is written only when its position comes from the user or from a dataset they supply. Everything else becomes a checklist item or text without a pin, and goes in your report as "no coordinates given".

## Coordinates in the format
Pixel coordinates in the map image, origin at the top left, x to the right, y down (`coordinateSystem: "pixel-top-left"`). `size` is the image's width and height in pixels; every pin, route point and region point must lie inside it (the validator rejects others).

## Where coordinates can come from
1. **The user gives pixels** (they measured them on the image): use as is.
2. **The user gives game coordinates** (for example a dataset with x/z world positions): convert with a linear transform from two calibration points that the user or dataset provides (a point's game coordinates and its pixel position, for two points far apart). For each axis: `pixel = p1 + (game - g1) * (p2 - p1) / (g2 - g1)`. Check the transform on a third known point and tell the user the error. If the map is rotated or the axes are flipped, ask rather than guess.
3. **The user gives percentages** (0-100 of width/height): multiply by `size`.
4. **Nothing usable**: no pin. Keep the item in the tracker and describe where it is in words ("north cave, behind the waterfall") exactly as the source says.

## Preparing the image
- 4096 px per side at most and 8 MB; resize or convert (webp/png/jpeg) before packing. If the original is larger, tell the user a downscale changes pixel coordinates by the same ratio and rescale every coordinate with it.
- Set `size` to the final image size and register the image in `manifest.assets` with an `alt`.
- Floors, regions and variants of one map are separate `layers` (pins carry `layer`) or separate maps.

## Legend, pins, routes, regions
- `legend`: one entry per kind of marker, with a short `label`, a `#RRGGBB` colour that stays distinguishable on the map, and `defaultVisible`.
- Pins: `id`, `x`, `y`, `type` (a legend `typeId`), `title`, optional `description`, `itemId` (links to a tracker item so "Mark found" works), `pageRef`.
- Link both ways: the tracker item lists `pins: [{ mapId, pinId }]` and the pin has `itemId`.
- `routes` and `regions` follow the same coordinate rules.

## Report what you could not place
Finish every map task by listing items without pins and why, so the user can supply coordinates later (pins can be added in a later version of the guide without changing any ids).
