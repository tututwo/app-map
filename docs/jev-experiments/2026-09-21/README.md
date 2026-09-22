# Where a judgment beats parsing in this project, 2026-09-21

The question: where could Jev (TypeSafe System One, `jev-1.13.0`) stand in for fragile parsing, and what
does it cost in speed? The whole project was read for text handling. Almost all of it parses machine
formats (GEOIDs, URL parameters, Parquet column names, tile paths), where exact code is right and a model
would be slower and less reliable. One place reads what people write: **Find a place**.

## The experiment

`cases.mjs` holds 50 things people type, labelled by hand before any run (one case was added later and
says so). `search-box.test.ts` runs the real `src/lib/explore/gazetteer.ts` over them.
`exp-search-box.mjs` asks Jev two questions about each, in one request:

- `kind`: street address, ZIP code, place name, landmark, or not a place. Today this is one regex.
- `pick`: which Gazetteer row was meant, chosen among candidates that code finds (exact word runs, edit
  distance, shared prefix). The model selects; it never generates a place.

| `kind`, 49 cases           | right |
| -------------------------- | ----: |
| the regex and digit checks | 29/49 |
| Jev                        | 49/49 |

| `pick`, 25 place names               | right |
| ------------------------------------ | ----: |
| first candidate, ranked by code      |    15 |
| Jev                                  |    16 |
| candidate list held the place at all |    16 |

Latency per request, both questions: median 139 ms, p90 271 ms, max 399 ms; about 790 input tokens.

**What this says.** Jev reads what kind of text it is far better than a regex: "One Microsoft Way",
"123-45 Queens Blvd", "Apt 4, 123 Main St" and "N6W23001 Bluemound Rd" are addresses with no leading house
number; "29 Palms, CA" is a place with one. For choosing the place, code ranks as well as the model does.
The model's value there is refusing: it answered `none` where the code's first candidate was junk
("Ft Worth" gave Worth, IL), and `kind` blocks a suggestion for text that names no place ("methodist"
gave Methuen Town, MA; "how many churches closed" gave Many, LA).

## What was done with it

Most misses were plain bugs, and code fixes them at no latency. They are fixed in `gazetteer.ts`:
"Charleston, West Virginia" became "charleston west va"; hyphens and apostrophes had to be typed exactly;
Saint, Ft and Mt never matched the Census spellings; a ZIP beside other words was not seen.

| the real search, 50 cases (a wanted place must be among the first three options) | right |
| -------------------------------------------------------------------------------- | ----: |
| before                                                                           | 19/50 |
| after the code fixes (`after.json`)                                              | 33/50 |
| after, plus Jev asked only when the search finds nothing (`hybrid.mjs`)          | 46/50 |

The last row is **not built**. It would call Jev for 20 of these 50 adversarial cases, far fewer in real
use, never while typing, and it suggested no wrong place. It is a product decision, not a code one: typed
text, including street addresses, would go to a third party (the Geocoder route was written so that
addresses are never logged); each call costs money on a public page with no rate limit; and the key must
stay in a Worker secret. Still missed with it: "NYC", "29 Palms, CA", "96 SC", "pittsburg pennsylvania".

## Speed, measured

| change                                                                        |              before |     after |
| ----------------------------------------------------------------------------- | ------------------: | --------: |
| a shared county link, the server's HTML (`/explore?where=06037&level=county`) |            3,263 KB |    328 KB |
| a block-group link, the same (California)                                     |            1,528 KB |    402 KB |
| Explore's state outlines, gzip on the wire (`states-10m.json`)                |              267 KB |     51 KB |
| the same file, `JSON.parse`                                                   |              9.2 ms |    1.1 ms |
| state bounds at a Fine level (`bench-topology.mjs`)                           | 4.5 ms per map move | 4 ms once |
| Gazetteer indexing microbenchmark (`bench-gazetteer.mjs`)                     |               56 ms |     13 ms |

The document sizes are the largest win. SvelteKit writes every file a page's `load` fetches on the server
into the HTML, as base64, so the browser can replay the same `load` without asking again. A county link
fetched the counties' matrix for four legend numbers (823 KB) and every Type's matrix for one place's
counts (ten files, 2.2 MB). Now the legend's breaks for every Type and window are computed when the
release is built (`scripts/build-county-breaks.py`, 19 KB in the bundle, checked equal to `breaksFor`
by a unit test), and one place's counts come from `rows.bin` (`scripts/build-rows.py`) in two ranged
reads of a few hundred bytes. `src/hooks.server.ts` keeps development honest: SvelteKit answers a
`load`'s fetch for its own static file by reading it whole, so a ranged request is sent to Vite instead.

Times are medians of nine runs, Node 22 on an M-series Mac. The Gazetteer figure measures indexing,
not full browser keystroke latency; no phone timing was measured. The geometry of the states file is checked to be identical to the county file's
(`scripts/build-states-topology.mjs`).

Rerun: `node --env-file=.env docs/jev-experiments/2026-09-21/exp-search-box.mjs`, and
`OUT=after.json npx vitest run docs/jev-experiments/2026-09-21/search-box.test.ts`, then
`node docs/jev-experiments/2026-09-21/show.mjs after.json`.

**Read with care.** Fifty hand-written cases are a probe, not a sample of what visitors type; the set
leans on hard cases on purpose. One model's answers on one day.
