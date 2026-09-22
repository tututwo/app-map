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

## Amendment 2026-09-18 (night): a Shard holds every Year Window

The Decision above keeps metrics as JSON slices per (window, religion, shard). With the lab's full
output in hand (33 chunks per level, 253 windows, 10 religions) that shape does not hold: a window is
a lookup key, not a computation, because closures are evaluated inside each window and yearly values
cannot be added up, so every window has to ship; and measured on the block-group file, about 90% of a
JSON slice is repeated GEOID keys (California, one window: 36 KB gzipped as JSON, 4 KB as bytes).
Extending the slice design would have meant 12,903 files and about 107 MB per religion.

What stands: the Metric cube. `scripts/build-metrics.py` writes, per Level and Shard, one
`geoids.json.gz` (row order) and one `<religion>.bin.gz` per Type, a row-major rows x windows matrix
of u8 or u16 counts with the dtype's maximum as "no observation". Window order, religions, dtype and
the Shard list live in `src/lib/generated/metrics-manifest.json`; paths carry a content hash per
Level, so files are immutable. The whole cube, five Levels x 253 windows x 10 Types, is 27 MB gzipped
(California block groups, every window: 347 KB). Files sit under `metrics/` next to the tile archive
and are inflated in the browser with `DecompressionStream`, so any static host works.

Consequences: changing the Year Window never makes a request, the stale-response guard is only needed
for a Type change, and feature-state carries the colour class rather than the count, so one paint
expression serves every Level and the state legend can follow the data (quintiles per window and
Type; block groups keep fixed breaks). The prerendered remote functions for Explore, their prebuild
scripts and the per-window payloads are gone. Considered and rejected: a database or API (a round
trip per window for read-only, fully precomputed data), Parquet range reads in the browser (a new
dependency for the same result), and storing yearly counts to sum on the client (wrong, see above).
State, county and ZIP are one national Shard each; ZIP (2.3 MB for all places of worship) should be
split once its tiles exist and a viewport can name the Shards.

## Amendment 2026-09-18 (night): county, tract and ZIP boundaries; ZIP Shards

The lab's OneDrive holds block-group GeoPackages and `core_areas.gpkg` (CBSA, CSA, ZCTA) only, so
the other Levels draw the Census Bureau's 2010 cartographic boundary files (`GENZ2010`, 1:500k):
3,143 counties, 72,891 tracts and 32,989 ZCTAs without Puerto Rico. `scripts/build-census-tiles.sh`
builds `county-2010.pmtiles` (z2 to z9, 4 MB, five seconds), `tract-2010.pmtiles` (z7 to z11, 37 MB,
one minute) and `zcta-2010.pmtiles` (z7 to z11, 68 MB, six minutes), the two Fine levels with the
block-group recipe, plus `county-names.json`, the ZIP Shard boxes and one id list per Level that
`scripts/build-metrics.py` checks the counts against: every county, tract and ZIP with counts has a
boundary. One archive per Level, as the first amendment explains.

Later boundaries do not fit the counts. The 2017 county outlines already in the repo lack Wade
Hampton AK (02270), Shannon SD (46113) and Bedford city VA (51515), and anything from 2022 on replaces
Connecticut's eight counties, which the lab keeps under all three census references, with planning
regions, changing every tract and block-group GEOID in the state. The legacy dashboard's county
tables are of that later kind, which is where its Connecticut trouble came from.

County is a Coarse level: one national Shard, drawn from the map's minimum zoom, quintile breaks
like the state level. Tract and ZIP are Fine levels with Reveal zoom 7 and fixed breaks. ZIPs shard
by their first two digits, 98 compact regions whose bounding boxes
(`src/lib/generated/zcta-shard-bounds.json`) name the Shards a viewport needs; this replaces both
the national ZIP Shard of the previous amendment (a first click fetched 5.6 MB of Type files, now
about 60 KB) and the ZCTA-to-state relationship of the original Decision, since a prefix needs no
lookup table. Five digits in a link are a county unless the ZIP view is on or no county has that
GEOID.

## Amendment 2026-09-20: community context rides the same rails

The lab's social-determinant covariates (see `docs/state-data.md`) ship like the Metric cube:
release-hashed, immutable, gzipped Shard files under `sdoh/<level>/<release>/<shard>.json.gz` in the
same bucket, with the same Shard rule (national for state and county, a state per tract file, two ZIP
digits per ZIP file) and the same delivery route, whose allow-list names them. They are JSON rather
than typed arrays because they are thirteen mixed-unit numbers per place with gaps, read for one
selected place at a time and never painted on the map: 2.5 MB in all, 222 KB for California's tracts.

## Amendment 2026-09-22: tract boundaries at the national view

The tract Reveal zoom of 7 was a product restriction, inherited from the block-group experiment;
the original tract archive also had no tiles below z7. Tracts now draw from z2. The tract build
writes a separate `tract-2010-v2.pmtiles`, adding z2–z6 to the existing z7–z11 recipes, so publishing
it does not replace bytes under an old client's archive URL. Publish it before deploying the map
configuration that names it. County, ZIP and block-group archives are unchanged.

The added zooms use `--no-tiny-polygon-reduction --no-simplification-of-shared-nodes` and the existing
`--simplification=10`. They retain each visible tract's own GEOID and simplify shared borders
consistently; they do not sample neighbours or assign one tract's count to a merged area. At tile
resolution some subpixel polygons collapse: z2 retains 69,860 distinct tracts, z3 72,498, z4 72,881,
z5 72,887 and z6 72,889 of 72,891 source tracts. All 50 states and DC represented by the source
remain covered at every added zoom. Zooming in restores the more detailed boundaries.

The local build took 66 seconds with the downloaded Census files and produced 44,631,278 bytes,
7.47 MB larger than the previous archive. Across the country, z3 contains eight tiles, 1.33 MB
compressed and 568,378 vertices; its largest tile is 517 KB compressed. Simplification 2 kept the
same GEOIDs while adding vertices and transfer size, so it was not used. All added zooms were
decoded and checked against the source GEOID list; 25 sampled tiles at z7–z11 across New York,
Los Angeles, Chicago, Honolulu and Anchorage were byte-identical to the previous archive.

A nationwide tract view previously loaded 51 Metric cube Shards: 3.53 MB compressed for
all-religion counts, 165 KB for GEOID lists and 35.8 MB inflated counts. It now reads a derived
national map slice from `map/tract/<release>/<religion>/<windowIndex>.bin.gz`, plus one national
`geoids.json.gz` index. The release and dtype are the original matrix release and dtype; the row
order is the sorted concatenation of its state Shards. No counts or no-observation sentinels change.

`scripts/build-map-slices.py` uses the standard library to write all 2,530 combinations and checks
every output cell by reconstructing the source matrices from the written slices. The index is
165,812 bytes compressed; one all-religion slice is 12,002–51,289 bytes compressed and 141,410 bytes
inflated. Selecting another uncached Year Window fetches one such slice. The existing matrices
still serve other Levels, while place details continue to use the per-place `rows.bin` ranges.

Hover outlines only change their tile filter once the outline zoom is reached. At national scale the
tooltip still names the tract, but moving it no longer reparses the visible vector tiles. The inactive
state-hover filter also stays empty for tract GEOIDs. National feature-state updates yield after
4,000 changed features so one complete slice does not block input; a new refresh invalidates pending
batches. Recent eight map slices are cached, and stale window, Type or source responses cannot paint.

Local production comparison (2026-09-22): same 1440×1000 viewport, 2000–2025/all religions, new
Chromium process and disabled cache each run, empty basemap to isolate our data. Across three runs
with 4× CPU throttling, 10 Mbps and 80 ms latency, metric requests fell from 98 to 2, metric payload
from 3,671,481 to 217,101 bytes, and geometry stayed at 1,338,005 bytes. Median time to verify correct
hover counts at three national positions fell from 12.94 to 7.09 seconds; the first central count
alone changed from 6.84 to 6.39 seconds. Median largest main-thread task fell from 342 to 181 ms,
and pan p95 frame gap from 250.5 to 117.6 ms. Six hover moves triggered 48 tile reparses before and
zero afterward. These are comparative headless measurements, not device or production latency
guarantees. Unbatched slice painting finished sooner but made an 805 ms task; the shipped batches
trade some completion speed for shorter interruptions.

## Amendment 2026-09-22 (later): ZIP and block-group national views

ZIP and block group now use the same national map-column reader as tract. State and county keep
their small cached matrices; all three fine levels request one national GEOID index and one column
for the selected Type and Year Window. The map no longer calculates which state or ZIP-prefix
shards intersect its viewport, and the obsolete ZIP-prefix bounding-box artifact is removed.
The original cube sharding and per-place detail reads remain unchanged. The common reader preserves
ZIP/tract uint16 counts and block-group uint8 counts, including their distinct no-observation
sentinels. The builder checks every column by reconstructing the original matrices byte for byte.

The new `zcta-2010-v2.pmtiles` and `bg-2010-v2.pmtiles` archives add z2–z6 with the tract recipe,
retaining each surviving polygon's own GEOID. Existing z7–z11 ZIP and z7–z12 block-group tiles are
preserved. Both levels now draw from the map's minimum zoom, with their fixed legends and tooltips;
small polygons regain detail on zoom. They share the hover-filter guard, batches of 4,000 changed
feature states, stale-response cancellation and print readiness checks. Publish both new archives
and the new `map/zcta` and `map/blockgroup` release directories before deploying this configuration.

For 2000–2025/all religions, the national ZIP index plus column is 96,094 compressed bytes
(68,374 + 27,720), versus 2,414,622 bytes for all original ZIP indexes and matrices. Block group
is 508,233 bytes (421,989 + 86,244), versus 4,650,030 bytes for all original state shards. These
compare nationwide metric payloads only: the previous national camera showed state proxies and
did not request these fine-level metrics. All 5,060 new Type/window slices passed reconstruction;
all ZIP slices occupy 16,937,163 bytes and all block-group slices 48,192,688 bytes.

The ZIP archive is 73,026,684 bytes (+5,516,865); z2–z6 retain 32,599 / 32,841 / 32,938 /
32,978 / 32,989 distinct IDs out of 32,989 source polygons. The block-group archive is
166,938,704 bytes (+18,309,237); the same zooms retain 185,889 / 210,070 / 216,374 / 217,163 /
217,182 of 217,182 source polygons, with all 50 states and DC represented at every zoom. All
emitted low-zoom GEOIDs were checked against the source; 25 ZIP and 30 block-group detail tiles
sampled across New York, Los Angeles, Chicago, Honolulu and Anchorage were byte-identical to the
old archives. At z3 the whole-country geometry is 905,144 bytes for ZIP and 3,203,581 bytes for
block group; these are tiled requests, not full-archive downloads.

Production browser checks cover national polygons, source-matrix counts, fixed legends, clicks that
preserve the camera, window/Type changes and rapid ZIP/block-group/tract/county switches. Each fine
level makes two initial map-data requests and no full-matrix request. Six national pointer moves
at ZIP and block-group levels each produced zero additional `reloadTile` or `updateLayers` worker
messages. No load-time comparison is made against the old national view's lighter state proxies.
