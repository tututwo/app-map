# Modernization plan v2 — data architecture, map migration, perf (owner-approved directions)

## Context

The full audit of `app-map` (`main`) surfaced, among 160 findings: hand-rolled `$effect` fetches with stale-response races (P1-1), a year-old vendored fork of `svelte-maplibre-gl@0.1.6` with phantom `maplibre-gl`/`@deck.gl` dependencies (P1-11), ~96MB of CSV-inlined server modules + ~8.6MB eager client JS (P1-12), and a desktop-only fixed layout (P1-13). Owner feedback resolved direction on all four; three design agents then verified every framework fact against installed sources and live registries.

**Answered on the way in:** GSAP does not help P1-1 (animation engine; cannot cancel HTTP). `AbortController` is a web-platform primitive, not a library; it ends up hidden inside one module, while the primary staleness guarantee comes from SvelteKit itself.

## Owner decisions (locked)

1. **P1-1 → Option A: URL-as-state + universal `load`.** `?from&to&geoid` becomes the single source of truth; SvelteKit's navigation runtime discards superseded in-flight loads (source-verified in installed kit 2.20.8: `nav_token` check rejects stale navigations). Remote functions rejected for now: verified experimental (2 opt-in flags, "subject to change") + would force a kit upgrade — revisit when stable; the URL seam migrates cleanly to `query()` later.
2. **Initial `LoadingProgress` overlay is dropped** — data arrives in the SSR HTML once the 96MB cold start is gone; `LoadingError` (failure/timeout/retry) is preserved.
3. **P1-11 → migrate to `svelte-maplibre-gl@2.2.0` + `@svelte-maplibre-gl/deckgl@2.0.2`**, delete the vendored fork; re-vendor only a minimal component if a demonstrated blocker appears.
4. **P1-12 → full data pipeline overhaul** (prebuild + `read()` + CDN caching), API URL contracts preserved byte-identically.
5. **P1-13 responsive → descoped** (desktop-only by design). Related responsive P2s dropped.
6. **Sequencing: architecture first**, correctness fixes (incl. P0 fabricated PDF stats) after — per owner's explicit choice.

## Slice sequence

### Slice 1 — Test harness + contract snapshots + phantom-dep pinning (pure addition)

- Add `vitest` + `@playwright/test` (mirror configs from the `v2-202608` branch, minus the access gate).
- **Contract snapshot tests of CURRENT behavior** (written before any refactor):
  - Vitest, importing the three GET handlers directly: `map_data` (happy 2003–2011; min-span 2001–2005; short-span→400 msg; out-of-range→400; missing params→400; absent range→404; `geoid=01001` filter; `geoid=99999`→404), `line`/`stacked` (no geoid; `00000`; `01001`; unknown→404). Assert thrown HttpError status+message on error paths.
  - Playwright `request` against `vite preview`: `download_data` zip entry names + extracted CSV text.
- Pin the phantom deps at their currently-resolved versions in `package.json` (`maplibre-gl@5.4.0`, `@deck.gl/core|layers|mapbox@9.1.11`) so `npm ci` can never drop the map stack — the migration slice bumps them later.
- Validation: `npm run test:unit -- --run`; `npm run build && npm run preview && npx playwright test tests/contract`.

### Slice 2 — Server data pipeline (P1-12 server half)

- **New `scripts/prebuild-data.mjs`** (`prebuild`/`predev` npm hooks, mtime-guarded): moves the 4 big CSVs to `data-raw/`, emits to gitignored `src/lib/server/data/generated/`:
  - `map/{from}-{to}.json` × 136 (ranges enumerated from CSV headers, never hardcoded; exact response shape incl. the real `00000` US row — it exists in the CSV, line 3230, not synthesized).
  - `line_by_geoid.json`, `stacked_by_geoid.json` (with precomputed `00000` aggregates replicating current grouping), `side_metric_by_geoid.json` (**string values preserved** — dsv doesn't autotype and `createSideMetricData` expects strings).
- Reimplement `map_data`/`line_chart_data`/`stacked_bar_chart_data` over `read()` from `$app/server` (the only docs-sanctioned file access on Vercel) + `import.meta.glob(..., '?url')`; identical params/validation/messages/shapes — **definition of done: slice-1 snapshots pass byte-identically**. `download_data` keeps its `event.fetch` fan-out; its side-metric source switches to the keyed JSON. Port `/api/side_metric_data` from `v2-202608` (geoid-regex → 400, missing → 404).
- Caching: `Cache-Control: public, max-age=300, s-maxage=31536000, stale-while-revalidate=86400` on the three GET endpoints (Vercel edge keys on full URL incl. query; purged per deploy). **Not ISR** (query-params footgun, zero benefit here).
- `svelte.config.js`: `adapter({ runtime: 'nodejs22.x' })` + `engines: {"node":"22.x"}` (fixes the local Node-25 build failure).
- De-risk: deploy a Vercel preview with ONE converted endpoint to smoke-test `read()`+glob before converting the rest.
- Validation: contract suite green; `npx vercel build` + `du -sh .vercel/output/functions/*` (expect <10MB vs ~96MB); double-`curl` a preview endpoint → `x-vercel-cache: HIT`.
- Rollback: revert `src/routes/api/**` + scripts; CSVs still in `data-raw/`; client untouched.

### Slice 3 — Client URL-as-state architecture (P1-1 + P1-12 client half)

New deep modules (small interfaces, complexity hidden):

- `src/lib/dashboard/params.ts` — `parseDashboardParams(url)`: reads `from/to/geoid` via `url.searchParams.get()` (per-param rerun tracking), clamps 2001–2021 / ≥5-year span / `\d{5}`, defaults `2003/2011/00000`.
- `src/lib/dashboard/navigate.ts` — `setDashboardParams(partial)`: the ONLY URL writer; `goto('?…', { replaceState: true, keepFocus: true, noScroll: true })`.
- `src/lib/dashboard/data.ts` — `loadDashboardData(fetch, params, parts)` → per-part `Result<T>` (`{ok,data} | {ok:false,kind,message}`); parallel fetches, `AbortSignal.timeout(10_000)` hidden inside, `response.ok` checks, never throws (so endpoint failures don't swap in `+error.svelte`), `depends('app:dashboard')` for retry-via-`invalidate`.
- `src/lib/dashboard/last-good.svelte.ts` — 15-line latch preserving "keep existing chart data on error".
- `src/routes/+page.js` and `src/routes/PDF/+page.js` — 5-line adapters over `loadDashboardData` (PDF gets real URL/SSR handling for free, replacing `window.location`-in-`onMount`).

Modified:

- [src/routes/+page.svelte](src/routes/+page.svelte) — delete 3 fetchers, 3 fetch `$effect`s, `sleep()`, 7 loading/error booleans, timeout `onMount`, `retryDataFetch`, the `sideMetricData.csv` import, unused imports. Read `data` prop; function bindings (Svelte 5.9+): `bind:yearRange={() => yr, v => setDashboardParams({from: v[0], to: v[1]})}` on LineChartBrush; same pattern for `geoid` on CountySearch/MapLibreMap (`displayName` stays local presentation state). `LoadingError` driven by error Results; retry = `invalidate('app:dashboard')`.
- [LineChartBrush.svelte](src/components/lineChartBrush/LineChartBrush.svelte) — **the `sleep(300)` replacement**: publish `updateYearRange` from the snap transition's `end` callback when snapping (immediately otherwise). The magic number dies; the map fetch provably starts after the animation.
- [maplibre-map.svelte](src/components/map/maplibre-map.svelte) — `counties-10m.json` and the zoom table become `?url` imports fetched on mount (hashed, immutable-cached assets); convert `calculateStateViews.ts` → `state-views.json` and delete the .ts (dead `zoomToWhichState` dropped).
- Delete: `src/routes/+page.server.js` (dead), `LoadingProgress` usage from the initial path.
- E2E (Playwright): SSR HTML contains data; brushend updates URL+map; **race regression test** (delay-intercept `/api/map_data`, interleave brush+search, assert UI matches final URL); error overlay + retry; `/PDF?from=2004&to=2012&geoid=01001` SSRs correct county.
- Expected: route `/` JS ~8.6MB → **~1.2–1.5MB**; `+page.svelte` 604 → ~420 lines.
- Rollback: revert client commits; slice 2 stands alone.

### Slice 4 — Map library migration (P1-11)

Fork forensics (verified by full diff against installed 0.1.6): 12 of 15 vendored files are upstream-identical; only real deltas are (a) a `preserveDrawingBuffer` prop that never reaches the Map constructor (the reason `maplibre-patch.ts` monkey-patches canvas globally), a dead `isFlyingProgrammatically` guard, and a `flyTo` camera-sync rewrite with an always-true `if (padding)` bug; (b) app business logic grafted into GeolocateControl (Nominatim → geoid/displayName, private-internals force-stop); (c) icon CSS in two controls.

Steps:

1. `package.json`: bump `maplibre-gl@^5.19` (**not v6 yet** — deck.gl v6 compat rests on an undocumented shim; v6 + the required `svelte-maplibre-gl/vite` worker import is a later isolated bump), `@deck.gl/*@^9.3`, add `svelte-maplibre-gl@^2.2` + `@svelte-maplibre-gl/deckgl@^2`, remove the 0.1.6 devDep.
2. Delete `src/components/map/maplibreLib/` (15 files); repoint the 6 imports in `maplibre-map.svelte` (`DeckGLOverlay` now from `@svelte-maplibre-gl/deckgl`; same prop shape `interleaved {layers}`; all control names unchanged upstream).
3. Delete `src/lib/maplibre-patch.ts` + both side-effect imports; pass `canvasContextAttributes={{ preserveDrawingBuffer: true, antialias: true, stencil: true, alpha: true }}` on `<MapLibre>` (everything the monkey-patch forced — PDF capture depends on it).
4. Geolocate seam: stock `<GeolocateControl bind:control ongeolocate={…}>`; reverse-geocode → county resolution moves into `maplibre-map.svelte`; stop tracking via **public** `control.trigger()` (loop while `control._watchState !== 'OFF'` — read-only, declared in the published d.ts; BACKGROUND state needs a second trigger). Expose the disable flag as a bindable prop → also fixes audit P1 "search can't stop geolocation".
5. Move the icon-CSS overrides into `maplibre-map.svelte`'s `<style>`; retest whether `z-index:100000000` is still needed.
6. Accept stock `jumpTo` camera sync (app does its own `flyTo` via `bind:map`; the fork's flyTo sync was fighting it). Bonus: 2.x fixes a GeolocateControl infinite-`$effect` bug the fork still carries.

- Verify: initial US view (fork gated sync on `isStyleLoaded()`, upstream doesn't), county click→flyTo, reset control, geolocate→county, deck.gl interleaving under `beforeId:"waterway"`, PDF capture, `npm run check` delta (fork contributed ~8 errors).
- Fallback: re-vendor only the minimal blocked component.

### Slice 5 — Correctness fixes (deferred here by owner choice)

The previously-designed side-metric slice, now running on the new architecture: shared `src/lib/config/sideMetrics.ts` (fixes wrong types/labels/averages), guard in `sideMetricTransformation.js` (crash on 27 geoids), **P0: PDF page renders real per-county statistics** instead of the hardcoded placeholder array, `download_data` geoid default + CT planning-region data gaps, CT geoid normalization in `searchCounty2010Census.js`. (Note: until this slice ships, exported PDFs continue to carry fabricated statistics.)

## Descoped

- P1-13 responsive design and related responsive P2s — desktop-only by design.
- maplibre-gl v6 upgrade — later isolated bump.
- Remote functions — revisit when stable; URL seam is forward-compatible.

## Verification (cross-slice)

- Slice-1 snapshots are the contract net for everything server-side; byte-identical is the bar.
- `npm run check` must not increase its error count in any slice (baseline 79; slices 3–4 should reduce it).
- `svelte-autofixer` re-run on every modified `.svelte`/`.svelte.ts` until clean (per project tooling mandate).
- Bundle budgets: route `/` chunk < 1.6MB (slice 3); Vercel function < 10MB (slice 2); `x-vercel-cache: HIT` on repeat API hits.
- Manual passes: brush feel after `sleep(300)` removal (slice 3); full map interaction sweep (slice 4).

## Key risks

1. `read()`+glob at 136-file scale on Vercel — mitigated by single-endpoint preview smoke test first.
2. Navigation-superseding is source-verified, not docs-contracted — pinned by the Playwright race test; kit stays pinned until it passes.
3. Brush `goto` re-entrancy — covered by existing `_preventReEnter`/`untrack` guards + E2E tripwire.
4. deck.gl 9.1→9.3 bump alongside the wrapper migration (slice 4) — if layer behavior shifts, bisect by pinning 9.1.11 first, then bumping.
