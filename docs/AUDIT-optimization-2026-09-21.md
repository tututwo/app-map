# Codebase optimization audit, 2026-09-21

Follow-up to [the performance handoff](HANDOFF-perf-2026-09-21.md). Existing uncommitted work was preserved. All 202 release-matched `rows.bin` files were uploaded to R2 and verified through the Worker before removing the temporary matrix fallback.

Applied:

- `delete:` Removed unused Yale font declarations, typography utilities and six font assets (383,292 bytes). No application consumers. [src/app.css](../src/app.css)
- `shrink:` Replaced the redundant AAA/AA text-color decision tree with the higher of the two contrast ratios; removed its unused text-size argument. Sampled old/new results agree for 140,608 RGB colors at both old text sizes. [accessibleTextColor.ts](../src/lib/utils/accessibleTextColor.ts)
- `delete:` Removed unused hover-color props, PDF border/marker options, county-search callbacks, constants and a type helper. Legacy/PDF functionality remains available. Removed SocialShare props and reactive state with no consumers; sharing reads the current page URL and title at the time of the click. [src/components](../src/components)
- `native:` Load MapLibre CSS with the map components through Vite's existing CSS splitting. Built root CSS falls from 130,804 to 58,678 bytes; the 69,961-byte map stylesheet loads with a map. [StateMap.svelte](../src/components/explore/StateMap.svelte), [maplibre-map.svelte](../src/components/map/maplibre-map.svelte)
- `delete:` Skip the names lookup for unsupported tract/block-group center lookups before loading the gazetteer. Avoids 1,873,662 raw bytes (522,017 gzip) and name indexing on those links. [gazetteer.ts](../src/lib/explore/gazetteer.ts)
- `shrink:` Cache parsed community-data shards in the browser, following the existing metrics cache pattern; server requests remain isolated and failed fetches retry. A California block-group shard previously decoded/parsed 504,779 bytes each navigation (about 4.4 ms on this Mac). [sdoh.ts](../src/lib/explore/sdoh.ts)
- `shrink:` Give each data reader ownership of its final cached representation. Raw inflated buffers are no longer retained beside parsed GEOIDs/community data (764,925 duplicate bytes for the measured California block-group pair). Use native ten-second fetch deadlines and clear settled loader timers.
- `delete:` Remove root platform-specific optional dependencies; Rollup and Lightning CSS retain their own platform packages. A clean Linux x64 install and native processing validate resolution. Both bundles also compiled under emulation; final Linux packaging was killed by the emulator memory limit (exit 137), so that run is not claimed as a successful full build.
- `shrink:` Read selected-place counts using two byte ranges instead of ten matrices; validate row offsets and decoded length. Publish failures now fail the command, and incomplete metric shards are rejected.
- `native:` Reuse installed Wrangler for uploads and the existing polling-enabled Worker preview script. Default contract tests use Vite/local tiles; `PLAYWRIGHT_WORKER=1` explicitly tests Worker/R2 delivery. [README.md](../README.md)

Wrangler stays: it is [Cloudflare's CLI](https://developers.cloudflare.com/workers/wrangler/), and the installed SvelteKit Cloudflare adapter imports it and declares it as a peer dependency. It deploys the Worker, uploads R2 objects and generates binding types. Normal development uses Vite. The handoff's `spawn EBADF` was reproduced without polling and resolved by the existing `preview:worker` script; reinstalling was unnecessary.

Validation: 121 unit tests pass; production build succeeds; `svelte-check` has zero errors and six existing warnings. Worker contracts verify real R2 archives, validators and both u8/u16 row delivery against every source type/window. All 202 local row files passed offset/length checks, and 6,060 sampled place/type rows matched their source matrices. County legend equality is mandatory in clean checkouts through a compact fixture; the optional full local matrix check also passes. Twelve local browser contracts and nine map/PDF regression tests pass, plus all three real R2 delivery contracts. Formatting and diff checks pass. Browser checks followed a sequential build: concurrent SvelteKit sync/build can produce mismatched hydration globals, so these commands must not share the output directory while running.

Measurement scope: the CSS reduction is in the root/render-blocking stylesheet; map views still load MapLibre CSS. The Gazetteer 56-to-13 ms figure in the experiment report is an indexing microbenchmark, not full keystroke latency.
Remaining findings, ranked (conditional, not applied):

- `delete:` Retire `/legacy`, `/PDF`, `/api/download_data` and their exclusive imports only when those features are no longer needed: 49 source files plus the prebuild script, 5,551 lines and 15 dependencies. Keep shared Tooltip/topology/asset-loader code. [src/routes/legacy](../src/routes/legacy), [src/routes/PDF](../src/routes/PDF), [scripts/prebuild-data.mjs](../scripts/prebuild-data.mjs)
- `delete:` Two unreferenced source CSVs total 175 lines / 11 KB; remove only if they are not retained as research provenance. [brushLine.csv](../src/data/line/brushLine.csv), [CT_FIPS_Codes_forPlanningRegions.csv](../src/data/countyID/CT_FIPS_Codes_forPlanningRegions.csv)
- `shrink:` The legacy county search duplicates state-name identity data. Extract a shared table only if maintaining legacy; importing the public model would also pull its county names and metric manifest. [searchCounty2010Census.js](../src/lib/utils/searchCounty2010Census.js)

net: -5,726 lines, -15 deps possible. Conditional on retiring the older features and removing unused source data; excludes completed cuts, tests, binary assets and the uncounted state-table consolidation.
