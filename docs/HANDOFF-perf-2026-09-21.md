# Handoff: performance and search work, 2026-09-21

Everything below is in the working tree, **uncommitted**. 109 unit tests pass (`npx vitest run tests/unit`),
`svelte-check` reports 0 errors, `prettier --check .` is clean except two files this work never touched
(`src/routes/+layout.svelte`, `src/lib/generated/year-window-bounds.json`, the latter modified before this work).
Node 22 is required: `export PATH="$HOME/.nvm/versions/node/v22.18.0/bin:$PATH"` before any npm/npx.
`.env` holds `PUBLIC_TILES_URL=/tiles` (local data under `static/tiles/`, gitignored) and a `TYPESAFE_API_KEY`
that must never be printed or committed.

## 1. Done, verified in the dev server

| change                                                                                    |              before |     after | files   |
| ----------------------------------------------------------------------------------------- | ------------------: | --------: | ------- |
| A shared county link, server HTML (`/explore?where=06037&level=county&from=2010&to=2015`) |            3,263 KB |    328 KB | B, C, D |
| A block-group link (California), server HTML                                              |            1,528 KB |    402 KB | B, D    |
| Explore's state outlines on the wire (gzip)                                               |              267 KB |     51 KB | E       |
| State bounding boxes at a Fine level                                                      | 4.5 ms per map move | 4 ms once | F       |
| First keystroke in Find a place (main thread)                                             |               56 ms |     13 ms | A       |
| Find a place, 50 hand-labelled inputs right (`docs/jev-experiments/2026-09-21/`)          |                  19 |        33 | A       |

**A. Find a place** — `src/lib/explore/gazetteer.ts`, `src/components/explore/FindPlace.svelte`,
`tests/unit/explore-locate.test.ts`.
`fold()` lowercases, drops apostrophes, turns `. , / -` into spaces, spells Saint→St, Ft→Fort, and Mt→Mount
only when a name follows (`MT` alone is Montana). `plain()` tries the longest state-name ending first (the old
code turned "Charleston, West Virginia" into "charleston west va") and leaves a state's own name alone. A five-digit
ZIP among other words is found ("New Haven 06511", "zip 06511", "06511-1234"); numbers are stripped before the
name search; address-looking text is still searched for a ZIP inside it while Enter keeps the Geocoder;
`warm()` starts the names download on focus. The keys array is built with `fold()` once (was `plain()` per row).

**B. One place from `rows.bin`** — `scripts/build-rows.py` (new), `src/lib/explore/metrics.ts`
(`loadPlace`, `loadBreakdown`), `src/routes/map-assets/[...path]/+server.ts` (allow-list admits
`metrics/<level>/<release>/<shard>/rows.bin`), `scripts/publish-metrics.sh` (uploads `rows.bin` too),
`tests/unit/explore-metrics.test.ts`, `tests/unit/tile-delivery.test.ts`.
Why: SvelteKit writes every file a `load` fetches on the server into the HTML as base64; a county link
carried ten Type matrices (2.2 MB) for one place's counts. `rows.bin` beside every Shard = `(places+1)`
little-endian uint32 offsets, then each place's counts raw-deflated (Types × Year Windows, the Level's dtype,
row order of `geoids.json`). The reader makes two ranged fetches (8 bytes, then a few hundred), slices a 200
whole-file answer, caches per place in the browser, and **falls back to the ten matrices when `rows.bin` is
missing** (the `ponytail:` comment in `loadBreakdown` marks the fallback to delete once the files are on R2).
Built locally: 202 files, 34.7 MB, under `static/tiles/metrics/<level>/<release>/<shard>/rows.bin`; every one
of the 286,857 places was checked equal to the matrices. Not yet on R2 (see §2).

**C. County legend without the county matrix** — `scripts/build-county-breaks.py` (new) →
`src/lib/generated/county-breaks.json` (19 KB, one break list per Type × Year Window, release-stamped),
`src/lib/explore/load.ts` (`levelBreaks(states, type, yearWindow)`; `load` no longer fetches the county matrix;
in the browser it fires an unawaited prefetch of the county Shard + matrix so the map's own request is in
flight early), both pages under `src/routes/(site)/`, `tests/unit/county-breaks.test.ts` (asserts the release
matches the manifest; when `static/tiles` is present, recomputes every Type × window with `breaksFor` and
compares). The legend is now correct in server HTML and in print, with no pending state.

**D. `src/hooks.server.ts`** (new). SvelteKit answers a `load`'s fetch for one of its own static files by
reading it whole, ignoring `Range`; a ranged request for `/tiles/…` is sent to Vite instead. Production
uses `/map-assets` and never hits this.

**E. States-only topology** — `scripts/build-states-topology.mjs` (new) writes `src/data/states-10m.json`
from `counties-10m.json` (geometry asserted identical); `src/lib/map/static-assets.ts` `loadTopology` reads it;
`.prettierignore` keeps it minified.

**F. `src/components/explore/StateMap.svelte`**: state bounding boxes in a `$derived` instead of per `moveend`.

**G. Fonts**: the Google Fonts stylesheet moved from an `@import` in `src/app.css` to `<link>` + two
`preconnect`s in `src/app.html`.

**H. `.claude/launch.json`**: the duplicate `dev-r2` entry replaced by `worker-local`
(`wrangler dev --env-file .env.example --port 8787 --local`). It does not start on this Mac: wrangler 4.135's
bundled esbuild 0.28.1 dies with `spawn EBADF` in every environment tried, including a login-shell terminal
tab. Try `rm -rf node_modules/wrangler && npm i`, then `npm run preview:worker`. Not a blocker for deploying.

Also: one glossary paragraph in `CONTEXT.md` (Metric cube), and `docs/jev-experiments/2026-09-21/` (the
TypeSafe/Jev experiment, benchmarks, labelled cases and README; throwaway evidence, commit or not).

## 2. To do, in order

1. **Upload `rows.bin` to R2** (needs `wrangler login` on the owning account; ~35 MB, 202 objects):
   ```bash
   cd static/tiles && find metrics -name rows.bin -print0 | xargs -0 -P 4 -n 1 sh -c 'npx --yes wrangler@4 r2 object put "worship-closures-tiles/$0" --file "$0" --remote --content-type application/octet-stream --cache-control "public, max-age=31536000, immutable"'
   ```
   Order does not matter: the code falls back until the files exist, and the files are unused until the code ships.
2. **Commit** (suggested split): (a) `Find a place: fold spellings, find a ZIP among words, prefetch on focus`;
   (b) `Explore: one place from rows.bin, precomputed county legend, states-only topology, fonts in head`.
   Include the new files: `src/hooks.server.ts`, `scripts/build-rows.py`, `scripts/build-county-breaks.py`,
   `scripts/build-states-topology.mjs`, `src/data/states-10m.json`, `src/lib/generated/county-breaks.json`,
   `tests/unit/county-breaks.test.ts`, `.claude/launch.json`, `.prettierignore`, `CONTEXT.md`.
3. **Deploy** (`npm run deploy`) and verify on the live site:
   ```bash
   curl -s -D - -o /dev/null -H "Range: bytes=0-7" https://<site>/map-assets/metrics/county/d81fb9c34763/us/rows.bin | grep -iE "^HTTP|content-range"
   ```
   expects `206` and `Content-Range: bytes 0-7/1943498`; and
   `curl -s "https://<site>/explore?where=06037&level=county&from=2010&to=2015" | wc -c` expects about 330 KB
   (it was 3.3 MB). This is the one measurement this work could not take locally (see H).
4. After 1–3: delete the fallback in `loadBreakdown` (below the `ponytail:` comment) and the `!browser` branch
   it keeps alive; `tests/unit/explore-metrics.test.ts` then loses its "without rows.bin" case.

## 3. Known, not fixed (from an adversarial review of this diff)

- `rows.bin` is cached immutable for a year under a path that does not encode its own bytes: a format change
  in `build-rows.py` must come with a new release (or put a hash/version in the file name and the manifest).
- `tests/unit/county-breaks.test.ts` skips the equality check where `static/tiles` is absent (CI); the release
  check still runs. A small fixture (one Type's county matrix) would make it run everywhere.
- A five-digit house number that is also a ZIP ("12345 Main St") shows a ZIP option beside the address option.
- Stripping numbers before the name search hides the handful of Census labels that contain one
  ("Kickapoo Site 1, KS").

## 4. Planned, not started

1. **Next inlined bytes**: on a county link the largest remaining inline is the SDOH file (`sdoh/county/…/us.json.gz`,
   110 KB) and on a block-group link `06.json.gz` (146 KB) plus `geoids.json.gz` (53 KB). Same recipe as
   `rows.bin`: a per-Shard ranged file for one place's context, and a fixed-width sorted GEOID index so the row
   number needs one small read instead of the whole list.
2. **Explore bundle**: `county-names.json` (~25 KB gz) rides in every Explore visit for county names; the
   MapLibre chunk (276 KB gz) is inherent.
3. **Product decision, not a code call**: retiring `/legacy`, `/PDF` and `/api/download_data` removes ~5,650
   lines and 15 dependencies (deck.gl ×3, `@svelte-maplibre-gl/deckgl`, gsap, jspdf, html-to-image, jszip,
   bits-ui, clsx, tailwind-merge, tw-animate-css, runed, `@rollup/plugin-dsv`, `@standard-schema/spec`), both
   experimental flags in `svelte.config.js`, and the `generate:data` prebuild hooks. The public site's import
   closure needs only maplibre-gl, svelte-maplibre-gl, pmtiles, pbf, @mapbox/vector-tile, topojson-client,
   d3-geo (declare it directly in place of `d3`) and lucide-svelte. Full ranked audit (73 confirmed items,
   almost all inside the legacy routes) is in the session's workflow output; the rest are small.
4. Dead brand assets: `static/Yale_typeface/*.otf` (383 KB) and the four `@font-face` blocks in `src/app.css`
   are never requested (no class uses `--font-display`); delete if the Yale typeface is not coming back.
5. **Not doing**: a Jev (TypeSafe) fallback for zero-hit searches. Measured at 46/50 vs 33/50 with no wrong
   suggestion, but it sends typed text (including street addresses) to a third party on a public page with no
   rate limit, against the site's own no-logging design for addresses. Evidence and an 80-line design sketch in
   `docs/jev-experiments/2026-09-21/README.md` if that decision changes.

## Follow-up

The optimization and deployment follow-up is recorded in [the codebase audit](AUDIT-optimization-2026-09-21.md). All 202 row files have been uploaded to R2 and the temporary matrix fallback removed after real Worker range checks. Worker preview works through the polling-enabled `npm run preview:worker` script.
