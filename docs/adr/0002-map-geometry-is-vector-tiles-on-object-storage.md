# ADR-0002: Map geometry ships as vector tiles on object storage; metrics join at runtime

Date: 2026-09-16 · Status: accepted

## Context

Explore colours one Level at a time out of five: state, county, ZIP, tract,
block group. Fine-level geometry is large (2010: 73,057 tracts, 217,740 block
groups, ~33,000 ZCTAs per vintage) and the metric space is larger still
(253 windows × 10 religions × 3 vintages, growing with each data release).
Two ways to ship fine geometry were on the table: static per-shard
GeoJSON/TopoJSON files inside the Vercel deployment (no new infrastructure,
~1 MB per state or county shard, tiled client-side on every load) or vector
tiles in a PMTiles archive on object storage (viewport-driven, pre-simplified
per zoom, needs a host that serves HTTP Range requests with CORS — Vercel's
CDN does not cache Range requests, so the archive cannot live in `static/`).
Gordon's stated priority is the smoothest pan/zoom and the lowest first paint,
ahead of operational simplicity.

## Decision

Geometry is vector tiles. One PMTiles archive per boundary vintage, five
source layers (`states`, `counties`, `zctas`, `tracts`, `blockgroups`), built
with tippecanoe from Census cartographic boundary files and hosted on
Cloudflare R2 — Gordon's account first, to be moved to a lab-owned account;
the app knows only the URL. Fine levels are built from their reveal zoom up
(tract and ZIP from z7, block group from z9), so the national view never
requests fine tiles. Feature ids are the GEOID string via `promoteId`.

Metrics never go into tiles. They stay shard-keyed JSON slices per
(release, level, boundary year, window, religion, shard) — tracts sharded by
state, block groups by county, ZIPs by state through the Census ZCTA
relationship — and are applied with MapLibre feature-state. Every tile
feature carries its shard key as a property, so the loader is the same for
every level: for each rendered feature, ensure its shard's slice is loaded.

## Considered options

- **Static per-shard files in the repo.** Zero infrastructure and well within
  budget under the reveal-zoom model. Rejected because the first shard and
  every cross-state pan cost a visible stall, and a second vintage doubles
  tens of MB of committed files.
- **Baking metric values into tile properties.** Instant window switching
  while there are three windows. Rejected because 253 windows × 10 religions
  per feature makes tiles unusable and couples every data release to a
  geometry rebuild.
- **GitHub Pages as the tile host.** Serves Range requests, but the
  block-group archive exceeds git's 100 MB file limit and Pages does not
  serve LFS content.

## Consequences

- A second hosting system with CORS and ETag configuration; the only
  coupling is one URL, so moving accounts is a config change.
- The state view moves from the `counties-10m` GeoJSON source to the same
  tile source; the legacy Deck map is untouched.
- The metric join must be feature-state for every level, never a property
  merge into GeoJSON.
- New front-end dependency: `pmtiles` (protocol only); build-time tools
  tippecanoe and ogr2ogr are maintainer-side, not app dependencies.

## Amendment 2026-09-18: block groups shard by state

Measured on `block_group_combined.parquet` (2010 vintage, all religions): one
window of block-group counts is 48 KB gzipped for California, the largest
state, and 493 KB for the whole country, while county shards would mean 3,139
files per slice and 12 to 25 requests on reveal. Block-group metrics therefore
shard by state (GEOID prefix 2), like tracts. The shard key is read from the
promoted GEOID, so block-group and tract tiles carry `geoid` and nothing else.

The first archive, `bg-2010.pmtiles`, is built from the lab's TIGER/Line
GeoPackages (`bg_statefp_XX_2000_2010_2020.gpkg`) rather than cartographic
boundary files: their GEOIDs are the ones the deliverables were computed on,
and every metric GEOID joins. It holds one source layer. MapLibre overzooms per
source, not per source layer, so levels with different maximum zooms cannot
share an archive without every layer being built to the deepest zoom.

## Amendment 2026-09-18 (later): Reveal zoom 8, and the state level below it

Switching to Block group at the U.S. view used to show an empty map and a
request to zoom, which Gordon found unfriendly. Drawing block groups at every
zoom was built and dropped the same day: about 130,000 polygons on screen and
all 51 metric shards made the national view sluggish, and city block groups,
smaller than a pixel there, left the picture to large rural ones.

What stands: the block-group Reveal zoom is 8, one level earlier than first
planned. Below it the Block group view keeps the state level on screen with its
own legend and a line asking the user to zoom in, so the map is never empty.
The archive is built in two parts that `tile-join` merges. z7 and z8 use
tippecanoe's tiny-polygon reduction, which replaces sub-pixel block groups with
pixel squares that each keep one member's GEOID, so the join still colours them
(largest tile 257 KB gzipped; z7 is only there so the Reveal zoom can be tried
one level lower without a rebuild). z9 to z12 keeps every block group with its
own shape. Shards to load are the states whose bounding boxes meet the viewport,
which needs no tile and lets counts load alongside the boundaries.

The national 2010 archive (217,182 block groups, z7 to z12, about twelve minutes
and 9 GB of free disk to build) is live in the R2 bucket
`worship-closures-tiles` on Gordon's account, read through `PUBLIC_TILES_URL`.
Its largest z9 tile, New York with New Jersey, is 180 KB gzipped. The bucket
answers on its `r2.dev` address, which Cloudflare rate-limits and does not
cache; production traffic needs a custom domain on the bucket.
`scripts/publish-tiles.sh` uploads a rebuilt archive.
