# Explore data

Explore reads the lab's full metric output: `All Metric Results/by_geoid/{state,county,tract,block_group}` and `by_zcta` on the lab's OneDrive, 33 chunk Parquet files per level (8.4 GB in all, files dated 2026-09-01), downloaded read-only on 2026-09-18. The originals stay outside the repository. `scripts/build-metrics.py` turns them into the Metric cube (see `CONTEXT.md` and the last amendment of ADR-0002).

Inspected facts: `(geoid, year, religion)` keys, GEOIDs as strings with leading zeros, 51 states/DC, census reference years 2000/2010/2020, ten religion categories, 28 metrics per window. Most chunks carry 8 windows (one has 10, two have 2 or 3) and two windows appear in two chunks, so chunks need a keyed merge, never concatenation. Together they hold **253 windows: every span of at least five inclusive years between 2000 and 2025** (2010–2014 is the shortest kind). 2010–2015 for census reference 2010 reproduces the earlier `state_combined.parquet` deliverable exactly (Alabama 1,691, California 3,434, Connecticut 476, Texas 4,851), and the block-group cube equals `block_group_combined.parquet` on all 1,097,868 values compared.

Explore selects **2010 for every window** and `no_moves`. Census reference year is independent of observation period: the three reference years hold the same closures binned into different boundaries (2010–2015, all religions: 58,060 nationally under each), so one fixed vintage loses nothing and keeps a place the same piece of land when the window changes. Connecticut has its eight pre-2022 counties under all three. No yearly values are summed, no religion categories are combined, and no national estimate is calculated. A closure follows at least four inactive years after activity, evaluated within the selected window; `no_moves` excludes businesses with multiple addresses in that window. Religion categories are not exclusive (a business can carry several classifiers), so they can add up to more than `all_religions`: California 2010–2015 sums to 3,440 against 3,434.

The source column is `closures_no_moves_any__<window>`. A missing row or a null is "no place of worship of that type was active there in the window" and stays distinct from zero.

## Withheld measures

**Only source-reported closure counts are displayed, labeled preliminary.** Their distinct-business counting has not been independently checked against ABI records.

Reported population rates fail a denominator consistency check in the actual file. For Alabama at census reference year 2010 and `all_religions`, `closed × 10,000 / rate` gives:

| Window    | Reported closures | Reported rate | Implied resident population | Reported active count |
| --------- | ----------------: | ------------: | --------------------------: | --------------------: |
| 2000–2006 |             1,566 |        0.7056 |                  22,193,878 |               190,177 |
| 2007–2024 |             9,955 |        2.9852 |                  33,347,849 |               283,974 |
| 2010–2015 |             1,691 |        0.7310 |                  23,132,695 |               137,528 |

A fixed census population cannot change with observation window. The differences are far greater than four-decimal rate rounding can explain. The implied denominator also changes by religion: Alabama's 2007–2024 Jewish-synagogue row implies about 330,806 residents while `all_religions` implies about 33.35 million. The chunk files do carry `geoid_pop` and `geoid_sqMiles`, and they show the same inflation directly: Alabama's 2010 `all_religions` rows report 17.8 to 39.3 million residents (census: 4,779,736) and 192,786 to 452,301 square miles.

The [inspected upstream implementation](https://github.com/SOCAH-Lab/Church-Closures-Dashboard/blob/194e893fa98562e6f8607e8cf335b3faddee433d/Code/Generate%20the%20Metrics_2026%20Format.R#L932-L941) attaches geography population and activity totals to business rows. Its [rollup helper](https://github.com/SOCAH-Lab/Church-Closures-Dashboard/blob/194e893fa98562e6f8607e8cf335b3faddee433d/Code/Support%20Functions/For%20Generate%20the%20Metrics_2026%20Format.R#L1083-L1086) sums numeric fields. A minimal reproduction already demonstrates inflated denominators and `n_open` in that implementation. The generating commit of the downloaded file is not verified; the actual rate inconsistency above is independent evidence, while the active-count issue remains a source-validation concern.

Consequently the cube holds counts only, and the panel shows a dash for the rate and the active count. They are not corrected using an external denominator. `n_open` means activity at any time within a window, never the number open at its start. Re-enabling these measures requires source population/area denominators joined once per target geography, and distinct ABI counts validated at that geography.

## Display geography and coverage

`src/data/counties-10m.json` is structurally identical to [us-atlas 3 counties-10m](https://cdn.jsdelivr.net/npm/us-atlas@3/counties-10m.json). Its `states` object contains 56 generalized 2017 Census cartographic boundaries; [us-atlas documents this source](https://github.com/topojson/us-atlas#counties-10mjson). This is display geography joined by two-digit state GEOID, **not exact 2010 boundary geometry**. The five territories (`60`, `66`, `69`, `72`, `78`) have no source observations and display No data. This approach is for states only: counties, ZIPs and tracts draw the Census Bureau's 2010 cartographic boundaries and block groups the lab's 2010 GeoPackages, so every finer Level matches the counts' census reference (last amendment of ADR-0002).

State classes are quintiles of the states' counts for the selected window and type, rounded to two significant digits: a five-year window and the 26-year one differ about twentyfold, and types by more, so no fixed break list serves every selection. A color therefore does not mean the same count in another window. Block groups keep fixed breaks at 1, 2, 4 and 8, because their counts are small whole numbers in every window. These are descriptive display thresholds, not population-adjusted risk or significance thresholds.

## Community context (social determinants)

Three places were checked for social-determinant data: the lab's reports (none; they only credit "demographics by Nick Begotka"), its GitHub repository (none; only decennial total population for the withheld rates) and its OneDrive, where the "Church closing" folder holds Insang Song's covariate tables. `closing_covariate_full_data_08032024.xlsx` is the one Explore uses: one sheet per geography and census year (state, county, tract, ZCTA, MSA for 2000 and 2010, plus NYC community health districts), and a "Variable availability" sheet that names thirteen covariates. For 2010 all of them exist for state, county and tract; ZCTAs have only population density, elderly, Black, Hispanic, rented housing and community health centers. There is **no block-group sheet**, and Alaska and Hawaii are absent (49 state rows, 3,103 counties, 71,138 tracts, 32,446 ZCTAs). Median household income matches ACS 2006–2010 (Connecticut $67,740, California $60,883, Texas $49,646).

Of the places with closure counts, 49 of 51 states, 3,100 of 3,140 counties, 29,600 of 29,983 ZIPs and 69,176 of 70,705 tracts have context. Besides Alaska and Hawaii, the tract sheet has no rows for six counties: Miami-Dade, Broward, Collier and Monroe in Florida, Hidalgo and Cameron in Texas (1,094 tracts), a gap to raise with the lab rather than fill from another source.

Two traps: Excel dropped the GEOIDs' leading zeros (the build pads them back), and the older `church_and_health_full_data_05282024.csv.gz`, from which the legacy dashboard's `data-raw/sideMetricData.csv` was cut, has a wrong `p_unemp` (county median 25% against 7.2% in the August workbook). The figures describe the place around 2010 and do not change with the Year Window.

## Reproduce

DuckDB and numpy are needed only for the offline build, with no added application dependency. Rename the downloaded chunks `<level>__chunk_NNNN.parquet` (levels `state`, `county`, `tract`, `block_group`, `zcta`), then:

```sh
scripts/build-census-tiles.sh county && scripts/build-census-tiles.sh tract && scripts/build-census-tiles.sh zcta
uv run --with duckdb --with numpy python scripts/build-metrics.py ~/Downloads --gpkg ~/Downloads
PATH=/opt/homebrew/opt/node@22/bin:$PATH npx vitest run tests/unit/explore-model.test.ts
uv run --with duckdb python scripts/build-sdoh.py ~/Downloads/closing_covariate_full_data_08032024.xlsx
scripts/publish-metrics.sh                     # uploads static/tiles/metrics and static/tiles/sdoh to the R2 bucket
scripts/publish-tiles.sh county-2010.pmtiles   # likewise tract-2010, zcta-2010, bg-2010
```

The cube build takes about three minutes and refuses to write a level when the window list has gaps, when two chunks disagree on a populated value, when a level summed by state differs from the state level for any window and type, or when a place with counts has no boundary on the map (`static/tiles/<level>-2010-geoids.txt`, written by the tile builds; `--gpkg`, the directory of the lab's `bg_statefp_XX_2000_2010_2020.gpkg` files, writes the block-group list). These are consistency checks within one upstream run, not validation of the counts. It writes:

- `static/tiles/metrics/<level>/<release>/<shard>/…` (gitignored, 27 MB): the Shard files the site fetches.
- `src/lib/generated/metrics-manifest.json`: window order, religions, and per level the release hash, dtype and Shard list.
- `static/tiles/sdoh/<level>/<release>/<shard>.json.gz` (gitignored, 2.5 MB) and `src/lib/generated/sdoh-manifest.json`: the community-context Shards and their field order.

Publish the files before deploying a manifest that names a new release; old releases can stay in the bucket.
