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
