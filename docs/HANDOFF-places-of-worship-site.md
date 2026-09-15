# Handoff — Places of Worship Closures website (Yale YSPH × YCGS)

**Written:** 2026-09-14 (Monday) · **From:** a claude.ai design/product thread with Gordon Tu · **For:** a fresh Claude Code session

**Assumed purpose of the next session** (no argument was passed): stand up a new SvelteKit repo and run the idea → ship flow on it — `/setup-matt-pocock-skills` → `/grill-with-docs` → `/to-spec` → `/to-tickets` → `/implement`. Everything below is the thinking that session should start from, so it grills only the gaps.

**How to read the tags.** Each decision carries its provenance so the grill session knows what to challenge and what to leave alone:

- `[agreed]` — settled between Gordon and Yusuf (the client) on the 2026-09-11 call or in the 2026-08-02 email. Don't reopen.
- `[gordon]` — Gordon's own design/engineering call. He has authority to make these; reopen only if there's a concrete reason.
- `[proposed]` — recommended in the critique thread, not yet explicitly confirmed by Gordon. Confirm before building on it.

---

## 1. What this is

A public research website from the Yale School of Public Health about where places of worship in the U.S. have closed, with a single interactive map at its core. It replaces an earlier single-page dashboard that failed user testing (4 testers: 2 GIS-savvy doctoral students, 2 community members).

The whole site serves one action: **enter a place and a time window → see how many places of worship closed there, the closure rate, and how that compares to the state and the U.S. → take away a one-page summary, share it, or request the data.** Every other page (About, Stories, Health Impacts, Methodology, Contact) is context for that action, not a feature.

It is **not** a real-time closure monitor, a time-series tool, or a place to compute health effects on the map. `[agreed]`

## 2. People

| Person                                    | Role                                                                                                                                                                                                                                                            | Relevance to the build                                              |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| **Gordon Tu**                             | Data-viz designer/developer, YCGS consultant. Owns **design + engineering** of the site. Does **not** clean data, compute metrics or rebuild the pipeline.                                                                                                      | Product owner for this repo.                                        |
| **Yusuf Ransome**                         | Associate Professor, YSPH. Client; leads the research project; runs user testing. Sends page content, the one-pager template and the data-request form questions. Travels a lot this fall — prefers Wednesday meetings, accepts async Figma walkthrough videos. | Source of all copy and the final say on wording/metrics.            |
| **Ryan**                                  | YCGS colleague who took over the data work from Shelby. Will load real data after Gordon's build is done.                                                                                                                                                       | Counterpart for the data contract. Joins the 9/16 and 9/23 calls.   |
| **Shelby**                                | Produced the original closure data; has a GitHub/website with the methodology report.                                                                                                                                                                           | Methodology page links to her page (Gordon has the URL bookmarked). |
| **Nick**                                  | Built the ACS/Census SDOH data and is merging it with closures by tract/ZIP.                                                                                                                                                                                    | Source of SDOH fields for the summary page.                         |
| **James**                                 | Owns the README and the explainer video (with Mike Hornsberger).                                                                                                                                                                                                | The site links the video once it exists.                            |
| **Ron's group (DISC, Yale data science)** | Will handle actual delivery of research data to requesters.                                                                                                                                                                                                     | The site only collects requests; it never serves files.             |
| Simon, Miriam, Jennifer, Magali, Katelyn  | Ran user testing / GIS support / YCGS leadership / communications.                                                                                                                                                                                              | Not build-relevant.                                                 |

## 3. Timeline (the Aug-2 "launch Sept 23" plan is superseded) `[agreed]`

| Date             | What                                                                                                                                                                                                               |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Mon 9/14 (today) | Yusuf sends remaining page content, the one-pager template, and the Qualtrics form questions.                                                                                                                      |
| Wed 9/16         | Meeting: homepage, About, Blog. Ryan joins. **Only small design changes are acceptable at this point.** If Yusuf can't join, Gordon records a Figma walkthrough video + AI summary and sends it to Yusuf and Ryan. |
| By 9/18          | Ryan's reactions.                                                                                                                                                                                                  |
| Wed 9/23         | Meeting: one-page summary + wrap-up of remaining pages. Ryan joins.                                                                                                                                                |
| **Thu 9/25**     | **Gordon's design + engineering done.** Ryan starts loading real data (Yusuf hopes ~10/1; Ryan gives his own estimate on 9/16).                                                                                    |
| After            | Internal review → second round of user testing on the real site with real data (4–8 testers, survey-style) → public launch. Yusuf floated Oct 31 as an example; nothing is fixed.                                  |

Consequence for the build: **the site must be built and demoable against fixture data**, with real data swapped in as a final step.

## 4. Data model — hard constraints

Most of the old dashboard's confusion came from the UI implying data that doesn't exist. These constraints are the design.

- **The only map metric is a closure rate over a window**: closures during [start, end] ÷ places open at the start year. There is no yearly value, no trend, no "rate for 2008". Sliders, line charts and per-year bar charts are banned for this reason. `[agreed]`
- **Windows**: start and end years are free to choose, but must be **≥ 5 years apart** (stability rule). `[gordon, confirmed 9/14]`
- **Levels**: state, county, ZCTA ("ZIP" in the UI), census tract. Tract and ZIP boundaries are harmonized across years by the data team. Block group exists in the data but **is out of scope for the map** `[gordon]`. City is a _search_ target, not a statistical unit.
- **Type**: church, mosque, temple, etc., with "All places of worship" as default. Whether every type has reliable numerators/denominators is unconfirmed (see §8).
- **No reopening / existing categories, no "new churches"** — dropped from the dataset. `[agreed]`
- **SDOH (community indicators)** come from the decennial census matched by decade: closures in 2000–2010 use Census 2000, 2010–2020 use 2010, 2020–2025 use 2020. Candidate fields: median household income, % poverty, % high-school diploma, % employed (medians where the data team says so). SDOH appear **only on the summary page**, never on the map. `[agreed]`
- Data coverage is roughly 2000–2025 (inferred from the census-matching rule; confirm with Ryan).
- **Small-denominator problem is parked**: tract-level baselines of 1–3 places will produce 33%/50%/100% rates. Gordon has decided not to handle suppression or per-level breaks for now. `[gordon]` Keep the door open in the data contract (baseline is always present) but do not build for it.

## 5. Site map and page responsibilities

Nav: **Explore · Stories · Health Impacts · Request data · About** `[gordon; "Request data" rename is proposed — was "Download Data"]`. Methodology and Contact live in the footer. One-page summary is **not** a nav item — it's reached from a map selection. `[gordon]`

| Route                         | Responsibility                                                                                                                                                                                                                                                                                                                                                                       | Content source                              | Status                                                                                   |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `/` Home                      | Explain the project in one sentence; national headline number; the search entry point; "How to use · 1 min" video link; "Then and now" photo pairs of real closed buildings. A landing page — the only input is the search bar; the map here is a static teaser.                                                                                                                     | Gordon; copy from Yusuf                     | Wireframed                                                                               |
| `/explore`                    | The one map. Omnibar (Where / Period / Type), map, selection panel (rate · closed · open at baseline · comparison · summary/share/request). Drill by level.                                                                                                                                                                                                                          | Gordon                                      | Wireframed                                                                               |
| `/summary` (one-page summary) | Detail/print page for the **selected place × window**: header with place and period; one map of the selected geography; closed count, rate, baseline; comparison ladder (selected → parent → U.S.); SDOH block with its census reference year; sources/notes. Print CSS.                                                                                                             | Yusuf sends a template 9/14; discussed 9/23 | Not designed                                                                             |
| `/request-data`               | A form (Yusuf prefers Qualtrics, Yale licence), **independent of the map**: name, email, organisation, affiliation/role, project description, interest in collaborating; which levels (multi-select) and which years. Submissions go to Ron's group; every submission counts as "impact". Can be prefilled from the map (level + window), but never locked to the current selection. | Yusuf sends questions                       | **Do not design yet** `[gordon]` — build a placeholder route that can embed a form later |
| `/stories`                    | Blog posts + a "share your story" text box (typing or phone dictation). v1: editorial content plus a lightweight form that a named person receives; no moderation/consent workflow.                                                                                                                                                                                                  | Yusuf (blog done)                           | —                                                                                        |
| `/health-impacts`             | The three published papers + a story.                                                                                                                                                                                                                                                                                                                                                | Yusuf sends 9/14                            | —                                                                                        |
| `/about`                      | Done by Yusuf.                                                                                                                                                                                                                                                                                                                                                                       | Yusuf                                       | —                                                                                        |
| Methodology                   | A paragraph + link to Shelby's GitHub/site. Footer.                                                                                                                                                                                                                                                                                                                                  | Yusuf                                       | —                                                                                        |
| Contact                       | mailto. Footer.                                                                                                                                                                                                                                                                                                                                                                      | —                                           | —                                                                                        |
| Share (component)             | Copy link · Email · Facebook · LinkedIn · Substack (Bluesky removed). Shares the **applied** state via URL.                                                                                                                                                                                                                                                                          | Gordon's existing component                 | Change channels                                                                          |

Content pages should be markdown-driven so Yusuf's text can change without code changes. `[proposed]`

## 6. Decisions already made

### Explore — interaction model

1. **Four concepts, kept separate** `[proposed, Gordon's critique thread converged on this]`:
   _Search_ locates. _Level_ (View by) decides which unit is coloured. _Selection_ is the unit whose numbers fill the panel and the summary, set only by clicking a unit (or by a search that resolves to a unit). _Viewport_ is where the map is panned/zoomed and never changes the selection. Hover is a preview and never replaces a locked selection.
2. **Search resolution** `[proposed]`: state / county / ZIP → select it directly. Street address → free geocoder (Census Geocoder assumed) returns the tract → select it. City → zoom to the city extent, switch View by to ZIP, select nothing, panel says "ZIP codes in Gary, IN — click one for details". Aggregating tracts inside a city boundary is Ryan's work and is parked.
3. **Drill-down**: Where = Indiana + View by = County colours only Indiana's counties (other states dimmed). Switching level does not auto-select anything; the panel keeps the state and adds "Showing Indiana by county". Tract is unavailable until a state is selected (whole-U.S. tracts would be ~80k polygons). `[proposed]`
4. **No apply button — live update.** Period and Type are discrete choices and apply immediately; Where applies when a search result is chosen. The panel header always restates the applied condition ("Indiana · 2015–2020 · all places of worship"). Share and Summary use applied state only. `[proposed — Gordon must confirm; the wireframe still shows a "Show closures" button. The alternative, if he keeps the button: a visible "Changes not applied" state.]`
5. **URL carries the whole state** — where, from, to, type, level — so Share restores the same view, the summary and request routes are addressable, and Yusuf can send testers links. `[proposed, no disagreement]`
6. **Period control = preset windows first** ("2010–2015 / 2015–2020 / 2020–2025 / Custom…"); Custom reveals two dropdowns where TO only lists years ≥ FROM+5. Reason: the rate is cumulative, so a 15-year window reads two to three times darker than a 5-year one on the same fixed legend; presets keep maps comparable and align with the SDOH decade rule. This is the one item that changes Yusuf's stated "two dropdowns" — Gordon will explain the comparability reason in the 9/16 walkthrough. `[proposed]`
7. **Comparison ladder**: selected → parent → U.S. (two rows for a state, three for a county). Sentence form: "0.2 percentage points below the U.S. rate" — never "0.2 points", never "0.2% lower". `[proposed]`
8. **KPI sentence** under the three numbers: "620 of the 9,800 places of worship open in 2010 closed during 2010–2015." `[proposed]`
9. **Colour encoding**: classed choropleth with fixed, round, explained breaks (wireframe: <2%, 2–3.9%, 4–5.9%, 6–8.9%, ≥9%) plus a "How are colors chosen?" explainer. Not a continuous heatmap. Legend lives on the map (bottom-left), not in the panel, and includes a grey "No data" swatch distinct from the lowest class. Selection stroke must survive the darkest class (white inner + dark outer, or an accent colour outside the ramp). Breaks are constant across windows of the same length; per-level breaks are parked. `[gordon, with proposed refinements]`
10. **"No data" vs "0 closures" vs "no baseline"** must not share a swatch. With a Type filter and zero baseline, show "No mosques recorded in 2010", not 0%. `[proposed]`
11. **View by moves to the map's top-left** as a map title + segmented control ("Indiana · View by State / County / ZIP / Tract"); the panel's "Choose County, ZIP or Tract below the map" sentence goes away. `[proposed]`
12. Panel primary actions: "View one-page summary →" (with a value line: "Local context, community indicators and sources."), "Share", and "Request this data →" (prefilled). `[gordon; value line proposed]`
13. A "How to use" (▶) entry also exists on Explore; it links James's video once it exists and has a graceful empty state until then. `[proposed]`

### Home

14. The search bar is the single primary action; the hero's "Explore the map" becomes a text link ("Explore the whole U.S. →"). `[proposed]`
15. The hero number and static map are a **fixed national overview**, labelled as such ("National overview · 2010–2015"), computed from the same aggregate and breaks as Explore — never hand-typed, never a fake-coloured map next to a real number. `[proposed]`
16. Default window = the most recent _complete_ window (confirm with Ryan). Hero number, Explore default and "Then and now" photo years should agree. `[proposed]`
17. Headline tense: wireframe says "Where are places of worship _closing_?"; "Where have places of worship closed?" was proposed because the old testers misread temporal semantics. Yusuf chooses. The subtitle's health framing stays (it's the research question); Yusuf owns the wording.
18. "Then and now" captions distinguish _photographed_ year from _confirmed_ closure year; photos, rights and naming of real congregations come from the content team. `[proposed]`
19. Search affordances: search icon, label "Find a place", result rows show "Gary · City · Indiana", locate icon has a "Use my location" tooltip. Helper text ≥ 14px. `[proposed]`

### Summary page

20. It's a real route with print CSS (a "Download PDF" can be browser print), not a modal. Shows the closure observation window and the SDOH reference year **separately**. `[proposed]`

### Data request

21. The map may **prefill** the request (level, years) but never **limit** it; the nav entry is the generic form. Qualtrics supports URL embedded-data, so prefill can travel as query-string parameters. `[gordon for prefill; mechanism proposed]`

### Engineering

22. **SvelteKit**, fresh repo, built from scratch (the old dashboard is not a starting point). `[gordon]`
23. Build against **fixture data** that matches the data contract; swap in Ryan's data last. `[proposed, follows from the timeline]`
24. Lightweight analytics events (search, select, level_change, summary_open, share, request) so the second test round and Yusuf's manuscript get objective usage numbers. `[proposed — Gordon's call, not raised with Yusuf]`
25. Mobile: the Explore panel becomes a bottom sheet; community members will open shared links on phones. `[proposed]`

### Explicitly rejected (user-testing suggestions that were _translated_, not followed)

- Continuous heatmap instead of a classed choropleth — hides the cut-point question rather than answering it.
- Video/README as a gate before the dashboard — the UI must teach itself; video stays optional.
- "A slider instead of quartiles for number of churches" — a misunderstanding; count + baseline + rate on the panel is the real need.
- Extra metrics (mobility limitations, % of population, persistence, food pantries, mental-health prevalence) — v1 has one metric; the last two aren't census data.
- Side-by-side SDOH maps (AIDSVu-style) — v1 puts SDOH on the summary. Keep the data model open so a "Colour by: closure rate | median income | poverty" toggle is cheap later.

## 7. Open questions (route through `/to-questionnaire` to Ryan; not blocking 9/16)

1. **Exact definition of "closed"** — the Aug-2 email's readme notes say "closure no longer in dataset" (category dropped? field dropped? typo?). This decides whether every "Closed" label is accurate.
2. **Is the underlying data yearly?** If each closure has a year and open-at-year counts exist, any ≥5-year window can be computed; if closures are only known between snapshots, windows must be precomputed and the "Custom" control must be constrained to what exists. This decides the data contract's shape (§10, option A vs B).
3. **SDOH reference year for windows that cross a decade** (e.g. 2008–2015): start-year decade? majority overlap?
4. **Type coverage** — does every type have a reliable numerator and denominator at every level?
5. **Most recent complete window** — for the default and the hero number.
6. **National / state comparison values** must be computed from summed numerators and denominators, not averaged percentages. Confirm the data team supplies them (or the site derives them from the same aggregates).
7. Hosting/deployment target (Yale infrastructure? static host?) — never discussed.
8. Map rendering approach — SVG/D3 is fine for state/county; tract-within-a-state may need canvas or MapLibre. Not discussed; a grill topic.

## 8. Parked — recorded so nobody re-derives them

Tract small-denominator suppression and per-level breaks · block group on the map · city-level aggregation · SDOH map layer toggle · request-data page design · story-submission moderation/consent workflow · dual maps · heatmap · extra indicators · exposing "persistence" or any second metric.

## 9. Glossary seed (becomes `CONTEXT.md` via `/ubiquitous-language` / `/grill-with-docs`)

| Term                        | Meaning                                                                                                                                    | Not to be confused with                                           |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| Place of worship            | A church, mosque, temple or similar congregation site in the dataset. Used everywhere in UI copy; "church" only when Yusuf's copy says so. | Building (a building can change use without a dataset "closure"). |
| Closure                     | A place of worship recorded as closed during a window, per the dataset's definition (see §7 Q1).                                           | Photographed-as-closed.                                           |
| Baseline                    | Number of places open at the window's start year. The denominator.                                                                         | Total ever recorded.                                              |
| Closure rate                | Closures during the window ÷ baseline. Cumulative over the window; never annual.                                                           | Annual rate; trend.                                               |
| Window                      | [start, end], end − start ≥ 5. Preset windows are 5-year; Custom is free within the rule.                                                  | "Year" (a single year has no value).                              |
| Level                       | The statistical unit the map colours: state, county, ZIP (ZCTA), tract.                                                                    | Search type (city, address).                                      |
| Selection                   | The one unit whose numbers fill the panel and the summary.                                                                                 | Viewport; hover; search query.                                    |
| Viewport                    | Where the map is panned/zoomed.                                                                                                            | Selection.                                                        |
| Applied query               | The (where, window, type, level) currently reflected in the map, panel, URL, share link and summary.                                       | Draft edits in the omnibar.                                       |
| Comparison ladder           | Selected → parent → U.S., same window and type, each from its own summed numerator/denominator.                                            | Average of child percentages.                                     |
| Summary                     | The one-page, printable detail of a selection × window, including SDOH.                                                                    | A PDF export of the panel.                                        |
| Data request                | A form submission asking for research data; fulfilled by Ron's group.                                                                      | A download.                                                       |
| SDOH / community indicators | Census-derived neighbourhood measures with a reference year matched by decade.                                                             | Live or window-matched data.                                      |

## 10. Data contract — draft to put in front of Ryan (not yet agreed)

Purpose: the interface between Ryan's outputs and the site. Gordon owns this document; Ryan produces data in this shape; the site never computes metrics beyond division and summation.

**Aggregates (choose A or B after §7 Q2):**

- **A — yearly series per geography** (preferred if the data is yearly): `level, geoid, name, parent_geoid, type, year, closures, open_at_start` for every year in coverage. Any window's closures = Σ closures over [start, end); baseline = open_at_start at `start`; rate derived. Comparison values derive by summing over the parent. Compact enough for static JSON per level (tracts split per state).
- **B — precomputed windows** (if the data is snapshot-based): `level, geoid, name, parent_geoid, type, window_start, window_end, closures, baseline, rate` for every supported window; the Custom control is then restricted to the windows present.

**Either way:** GEOIDs are the join key and follow the same vintage as the geometry files; `baseline` is always present even when rate is undefined; missing data is explicit (`null`), never `0`; a `source_version` string is included; numbers arrive unformatted (the site adds commas).

**Geometry:** TopoJSON per level, simplified for the web, one file for states, one for counties, one for ZCTAs, tracts split per state; each file states its boundary vintage and the GEOID field name.

**SDOH:** `level, geoid, census_year, median_household_income, pct_poverty, pct_hs_diploma, pct_employed, …` (final field list from Nick/Yusuf) plus a rule for which `census_year` a window uses.

**Lookups the site needs that are not Ryan's:** a places gazetteer (city name → state, centroid, bounding box) and a geocoder for street addresses returning a tract GEOID.

**Fixtures:** the first build ticket generates synthetic data in exactly this shape (plausible magnitudes: national rate ≈ 6–7% per 5-year window; state rates 2–9%), so every later ticket is demoable before real data lands.

## 11. Proposed ticket shape (input to `/to-tickets`, not a decision)

Vertical slices, each demoable alone; blockers in parentheses.

01 SvelteKit scaffold, routes, nav/footer, fixture generator + loader (none)
02 Explore: U.S. map by state from fixtures, URL ↔ state, selection panel with KPIs and comparison (01)
03 Explore: search resolution (state/county/ZIP/address/city rules), View by drill-down, level availability (02)
04 Home: hero number + static map from the same aggregate, search bar → `/explore` (01, 02)
05 Summary route from a selection: comparison ladder, SDOH block with reference year, print CSS (02)
06 Request-data route: placeholder now; Qualtrics embed with query-string prefill when the form exists (02)
07 Content pages, markdown-driven (01)
08 States: initial U.S., hover preview, selected, updating, no data; mobile bottom sheet (02, 03)
09 Share component (applied-state URL, five channels) + analytics events (02)
10 Swap fixtures for Ryan's data; verify against the contract (all)

## 12. Suggested skills for the next session

Run in this order, in one unbroken context window through `/to-tickets`; `/handoff` again if the window gets long.

1. `/setup-matt-pocock-skills` — configure the tracker (local `.scratch` files are enough) and doc layout. Precondition for everything below.
2. Add the Svelte MCP server (mcp.svelte.dev, already connected in Gordon's claude.ai) so implementation can look up Svelte 5 / SvelteKit docs. If the `svelte-code-writer` and `svelte-core-bestpractices` skills are available, use them for every `.svelte` file.
3. `/grill-with-docs` — feed this document, the glossary seed (§9), the design-handoff spec(s) and the data contract draft (§10). Say up front: "`[agreed]` and `[gordon]` items are settled; grill the `[proposed]` items and §7." It will write `CONTEXT.md` and ADRs as they crystallise. ADR candidates that meet all three bars: preset windows over free dropdowns; URL as the single source of state; live update instead of an apply button; request-not-download; data contract option A vs B.
4. `/prototype` (optional) — the Explore state model (URL ↔ applied query ↔ selection ↔ viewport) is the one thing hard to settle on paper; a throwaway prototype answers it before `/to-spec`.
5. `/to-spec` → `/to-tickets` (start from §11) → `/implement` per ticket in a fresh context (drives `/tdd`, closes with `/code-review`).
6. `/to-questionnaire` — package §7 for Ryan before or alongside step 3.

Skills deliberately **not** used: `/wayfinder` (the fog is already cleared), `/triage` (no incoming issues), the PM plugin's `write-spec` (duplicates `/to-spec`), `design-system` (nothing to audit yet).

## 13. Source materials (on Gordon's machine / in the claude.ai thread)

- Meeting transcript, Yusuf ↔ Gordon, Zoom, Fri 2026-09-11 (Yusuf's recording + AI summary).
- `Next_Steps___Revised_Timeline__Dashboard_Launch_September_23.pdf` — Yusuf's 2026-08-02 email with phase plan, roles, and the user-testing summary (superseded timeline; findings still valid).
- Wireframes (Claude Design), 2026-09-14: `CleanShot_2026-09-14_at_13_53_09.png` (Home), `CleanShot_2026-09-14_at_13_53_26.png` (Explore). A design-handoff spec is to be generated from these with `/design:design-handoff` before the repo session.
- A second critique of the same materials by a junior colleague (Chinese, long-form); its useful additions are folded into §6 (items 7, 8, 14, 15, 18, "Request data" rename).
- Yusuf's one-pager template and form questions: expected 2026-09-14 by email.
- Shelby's methodology page/GitHub: URL in Gordon's bookmarks.
