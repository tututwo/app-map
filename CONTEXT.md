# Domain glossary

Terms used by the app-map dashboard. Use these names in code, tests, and reviews.

## Year Window

A contiguous span of calendar years `[from, to]` that the dashboard's map data
is aggregated over. Legality is **data-driven**: the bounds (min/max year) and
minimum gap are derived by `scripts/prebuild-data.mjs` from the windows the
source CSV actually provides, and published to the runtime via
`src/lib/generated/year-window-bounds.json`. The owning module is
`src/lib/domain/yearWindow.ts` — parsing, clamping, and validation all go
through it. Today the data provides 2001–2021 with a minimum gap of 5 years
(smallest window: 2001–2006). See ADR-0001 for why this is not hardcoded.

## National aggregate (geoid `00000`)

The sentinel geoid meaning "all locations / the United States". Owned by
`src/lib/domain/countyGeoid.ts` as `NATIONAL_GEOID` / `isNationalGeoid()` —
never compare against the string literal.

## County Selection

The one owner of "which county is selected and why":
`src/lib/dashboard/county-selection.svelte.ts`, instantiated by the dashboard
route. Selection intents (search, map click, geolocation) race, and the newest
choice always wins. Async selectors open an **intent** (`newIntent()` →
`AbortSignal`) before resolving and pass the signal back when committing; any
newer selection aborts the intent, and the abort tells the opener (the map's
geolocate control) to stand down. The optimistic geoid and display-name
override live here; the settled geoid stays in the URL.

## County geoid

Five-digit FIPS identifier for a county. Connecticut planning-region geoids
(`091x0`) are display-level aliases; South Central (`09170`) is normalized to
New Haven County (`09009`) because every dataset has that proven fallback
(`normalizeCountyGeoid`).

## Remote functions (the data plane)

All dashboard data flows through SvelteKit remote functions in
`src/lib/dashboard/data.remote.ts` (experimental flags enabled in
`svelte.config.js`). Every function is a `prerender`: its enumerated inputs
(every legal Year Window, every geoid) are compiled to static payloads served
from the CDN and cached client-side via the browser Cache API, with
`dynamic: true` keeping a server fallback. Page `load` functions await the
same queries so server-rendered HTML ships with data; components hold the
deduplicated instances reactively (`.ready` / `.current` / `.error`). The only
hand-written HTTP endpoint left is `/api/download_data` (ZIP export).

## Level, Coarse level, Fine level, Reveal zoom, Shard

Explore colours exactly one **Level** at a time: state, county, ZIP (a ZCTA),
tract, or block group. State and county are **Coarse levels**, drawn nationwide
at every zoom. Tract, ZIP and block group are **Fine levels**, drawn only when
the viewport is past the level's **Reveal zoom** (tract and ZIP: 7, block
group: 8); below it the map keeps the state level on screen and asks the user to
zoom in.
Metrics are delivered per **Shard**: tracts and block groups by state (GEOID
prefix 2), ZIPs by their first two digits; state and county are one national
Shard each. The product glossary is
`docs/UBIQUITOUS_LANGUAGE.md`; the delivery decision is ADR-0002.

## Focus, Selection, Gazetteer, Geocoder

The Query holds a **Focus**, a point (`at` in the URL), and the **Selection** is
the Unit of the Query's Level that contains it: derived, never stored on its own
and never re-read at another Level (ADR-0003). `src/lib/explore/locate.ts` is the
only reader of the tile archives outside the map: it finds the Unit under a point
and the bounds the camera frames. The explore page's `look()` is the one place a
Selection is made, for a click, a search and a Level change alike; `where` in the
URL is its result, written down so the server can render a shared link.
`src/lib/explore/gazetteer.ts` searches the **Gazetteer**
(`scripts/build-gazetteer.py`), and `src/routes/api/geocode` is the **Geocoder**'s
only caller. The product glossary has the definitions.

## Metric cube

Explore's counts: reported closures (`closures_no_moves_any`, 2010 census
reference) for every Level, every published Year Window (253: each span of at
least five inclusive years in 2000-2025) and every Type (the lab's ten religion
classifiers, which are not exclusive, so Types can add up to more than "All
places of worship"). A Year Window is a lookup key into the cube, never a
computation: the lab evaluates closures inside each window, so yearly values
cannot be summed. `scripts/build-metrics.py` builds it from the lab's chunk files
and asserts that the window list has no gaps, that chunks never disagree, that
every Level summed by state equals the state Level, and that every place with
counts has a boundary on the map (2010 geography throughout: Census cartographic
files for county, ZIP and tract, the lab's GeoPackages for block groups). `src/lib/explore/metrics.ts` is the only
reader; a Shard file holds all windows, so changing the window makes no request.

## Community context

What the panel shows under a selected place. First its 2010 census residents, from
Shelby Golden's block-level decennial table summed by GEOID prefix (every Level,
every state), which is also the denominator of the panel's rate per 10,000. Then the lab's
2010 covariates (`closing_covariate_full_data_08032024.xlsx`, Insang Song, on the
lab's OneDrive) for states, counties, ZIPs and tracts in the contiguous United
States. There is no block-group sheet, Alaska and Hawaii are not covered, and ZIPs
carry only the population-based fields; the workbook's "Variable availability"
sheet is the authority on what exists where, and the panel lists only what is
published for the place. The figures describe the place around 2010, not the
selected Year Window. `scripts/build-sdoh.py` writes them as Shards that follow
the Metric cube's Shard rule; `src/lib/explore/sdoh.ts` is the only reader. The
older `church_and_health_full_data` CSV (and the legacy dashboard's
`data-raw/sideMetricData.csv`, cut from it) has a wrong unemployment column.
