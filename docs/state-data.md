# State data preview

The Explore state view uses the real `state_combined.parquet` aggregate downloaded read-only from the lab's OneDrive on 2026-09-16. The original Parquet remains outside the repository. Its SHA-256 is `2ceece1723be1e31de3924d388183817ab784c313c699c58d7a7949e293b20f6`.

The inspected file has 1,380 rows and 87 columns. `(geoid, year, religion)` is unique; GEOIDs are strings with leading zeros. It contains 51 states/DC, census reference years 2000/2010/2020, ten religion categories, and these three complete precomputed observation windows:

| Window    | State rows for all religions at reference year 2010 |
| --------- | --------------------------------------------------: |
| 2000–2006 |                                                  51 |
| 2007–2024 |                                                  51 |
| 2010–2015 |                                                  51 |

This preview explicitly selects **2010 for every window**, `all_religions`, and `no_moves`. Census reference year is independent of observation period. No yearly values are summed, no religion categories are combined, and no national estimate is calculated. A closure follows at least four inactive years after activity, evaluated within the selected window; `no_moves` excludes businesses with multiple addresses in that window.

The source columns are `closures_no_moves_any__<window>`, `closures_no_moves_per_10k__<window>`, and `n_open__<window>`. CSV columns `closed`, `per10k`, and `nOpen` preserve those reported values. All 153 selected rows have non-null values in all three fields. This confirms their presence and format, not research validity.

## Withheld measures

**Only source-reported closure counts are displayed, labeled preliminary.** Their distinct-business counting has not been independently checked against ABI records.

Reported population rates fail a denominator consistency check in the actual file. For Alabama at census reference year 2010 and `all_religions`, `closed × 10,000 / rate` gives:

| Window    | Reported closures | Reported rate | Implied resident population | Reported active count |
| --------- | ----------------: | ------------: | --------------------------: | --------------------: |
| 2000–2006 |             1,566 |        0.7056 |                  22,193,878 |               190,177 |
| 2007–2024 |             9,955 |        2.9852 |                  33,347,849 |               283,974 |
| 2010–2015 |             1,691 |        0.7310 |                  23,132,695 |               137,528 |

A fixed census population cannot change with observation window. The differences are far greater than four-decimal rate rounding can explain. The implied denominator also changes by religion: Alabama's 2007–2024 Jewish-synagogue row implies about 330,806 residents while `all_religions` implies about 33.35 million. The combined file omits population columns, so a correct denominator cannot be recovered from it.

The [inspected upstream implementation](https://github.com/SOCAH-Lab/Church-Closures-Dashboard/blob/194e893fa98562e6f8607e8cf335b3faddee433d/Code/Generate%20the%20Metrics_2026%20Format.R#L932-L941) attaches geography population and activity totals to business rows. Its [rollup helper](https://github.com/SOCAH-Lab/Church-Closures-Dashboard/blob/194e893fa98562e6f8607e8cf335b3faddee433d/Code/Support%20Functions/For%20Generate%20the%20Metrics_2026%20Format.R#L1083-L1086) sums numeric fields. A minimal reproduction already demonstrates inflated denominators and `n_open` in that implementation. The generating commit of the downloaded file is not verified; the actual rate inconsistency above is independent evidence, while the active-count issue remains a source-validation concern.

Consequently, generated runtime rows set both `per10k` and `nOpen` to `null`. Raw reported values remain in `data-raw/state_metrics.csv` for audit. They are not corrected using an external denominator. `n_open` means activity at any time within a window, never the number open at its start. Re-enabling these measures requires source population/area denominators joined once per target geography, and distinct ABI counts validated at that geography.

## Display geography and coverage

`src/data/counties-10m.json` is structurally identical to [us-atlas 3 counties-10m](https://cdn.jsdelivr.net/npm/us-atlas@3/counties-10m.json). Its `states` object contains 56 generalized 2017 Census cartographic boundaries; [us-atlas documents this source](https://github.com/topojson/us-atlas#counties-10mjson). This is display geography joined by two-digit state GEOID, **not exact 2010 boundary geometry**. The importer verifies every metric GEOID joins. The five territories (`60`, `66`, `69`, `72`, `78`) have no source observations and display No data. This approach must not be extrapolated to county or tract boundaries.

The count legend uses fixed breaks 500, 1,500, 5,000, and 15,000 across all three windows. Selected observed counts span 67–30,167. Equal colors represent equal reported count intervals across windows; these are descriptive display thresholds, not population-adjusted risk or significance thresholds.

## Reproduce

DuckDB is needed only for offline import, with no added application dependency:

```sh
python3 -m venv /tmp/church-state-import-venv
/tmp/church-state-import-venv/bin/pip install duckdb==1.5.5
/tmp/church-state-import-venv/bin/python scripts/extract-state.py /path/to/state_combined.parquet
PATH=/opt/homebrew/opt/node@22/bin:$PATH npm run generate:data
PATH=/opt/homebrew/opt/node@22/bin:$PATH npx vitest run tests/unit/prebuild-state.test.ts
```

The extractor intentionally accepts the inspected **combined deliverable**, not stacked chunk files: it rejects duplicate source keys and requires the three complete 51-row slices. It writes the raw CSV and `data-raw/state-release.json` provenance/validation metadata. The Node build validates fields, nonnegative finite numbers, integer counts, state identities, geometry joins, duplicate keys and explicit reference vintage, then generates:

- `src/lib/generated/state-manifest.json`: client-safe windows, breaks, provenance, coverage and validation status.
- `src/lib/server/data/generated-state/state-metrics.json`: server-only rows with withheld measures set to null.

To import a new source, review its schema, coverage, metric validation and chosen census reference first. Chunk files split window columns; they require a keyed merge after checking conflicting populated values, never concatenation and summation. No full chunk merge is needed for this preview.
