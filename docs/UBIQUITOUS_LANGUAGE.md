# Ubiquitous Language — Places of Worship Closures site

Extracted 2026-09-14 from the Yusuf ↔ Gordon call (2026-09-11), Yusuf's 2026-08-02 email and user-testing summary, the Home/Explore wireframes, two design critiques, and the handoff document. Canonical terms are **bold**; everything in "Aliases to avoid" is a word someone on the team has used for the same thing and should stop using in specs, tickets, code, UI copy, and explanations to Yusuf.

## Measurement

| Term                 | Definition                                                                                                                     | Aliases to avoid                                                                       |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| **Place of worship** | A congregation site in the dataset — a church, mosque, temple, synagogue or similar.                                           | church (in UI, specs and code), congregation, religious site, building                 |
| **Closure**          | A place of worship recorded as closed during a window, under the dataset's definition of closed.                               | closing, church closing, "closed" as an event flag, repurposed, photographed-as-closed |
| **Closures**         | The count of closures in a unit during a window. The numerator.                                                                | number closed, total, closed count, closings                                           |
| **Baseline**         | The number of places of worship open in a unit at the start year of a window. The denominator.                                 | open at baseline, open in 2010, existing, starting count, how many were there          |
| **Closure rate**     | Closures ÷ baseline for one unit, one window, one type — a cumulative share, not an annual figure.                             | rate, closure %, church closing rate, trend, annual rate, persistence                  |
| **Window**           | A start year and an end year at least five years apart over which closures are counted.                                        | period, time range, time span, years, from/to, five-year period, timeline              |
| **Preset window**    | One of the fixed five-year windows the UI offers first (e.g. 2010–2015).                                                       | default period, quick pick                                                             |
| **Custom window**    | Any window the user builds from start and end dropdowns, still subject to the five-year rule.                                  | arbitrary range, free range                                                            |
| **Coverage**         | The span of years the dataset can answer for (assumed 2000–2025; unconfirmed).                                                 | data range, available years                                                            |
| **Type**             | The broad category of a place of worship used as a filter: church, mosque, temple, …; "All places of worship" when unfiltered. | denomination, category, kind, religion                                                 |

## Geography

| Term             | Definition                                                                                                                              | Aliases to avoid                                                  |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| **Level**        | The kind of statistical unit the map colours: state, county, ZIP, tract, or block group.                                                | geography, geographic level, granularity, layer, view, resolution |
| **Unit**         | One statistical geography at a level, identified by a GEOID (Indiana, Marion County, ZIP 46201, a tract).                               | geography, region, area, polygon, feature, neighborhood           |
| **GEOID**        | The Census identifier that uniquely keys a unit within a level and vintage.                                                             | id, code, FIPS (partially), key                                   |
| **Parent**       | The unit at the next level up that contains a unit; the U.S. is the parent of every state.                                              | containing area, higher level, upper geography                    |
| **ZIP**          | The UI name for a ZCTA (ZIP Code Tabulation Area), the Census approximation of a postal ZIP code.                                       | ZIP code (implies postal), zipcode, postal code                   |
| **Tract**        | A census tract; a fine level.                                                                                                           | neighborhood, census area                                         |
| **Block group**  | A sub-tract Census level; the finest level shown on the map.                                                                            | block (a block is smaller and never shown)                        |
| **Vintage**      | The boundary year a set of unit geometries and GEOIDs belongs to (e.g. 2010 tracts).                                                    | version, boundary year, edition                                   |
| **Location**     | What a user searches for: a state, county, ZIP, city, or street address.                                                                | where, place, area, spot, search term                             |
| **City**         | A location that can be searched but is not a unit; it resolves to a viewport and a level, never to a selection.                         | census place, place, town, municipality                           |
| **Address**      | A location that resolves, via geocoding, to the tract unit containing it.                                                               | street address, point                                             |
| **Viewport**     | The extent of the map currently panned and zoomed into view.                                                                            | view, map position, extent, zoom                                  |
| **Coarse level** | State or county: drawn at every zoom, nationwide.                                                                                       | overview level                                                    |
| **Fine level**   | Tract, block group, or ZIP: drawn only when the viewport is zoomed in past the level's reveal zoom.                                     | detail level, drill-down level                                    |
| **Reveal zoom**  | The minimum viewport zoom at which a fine level's units are drawn; below it the map shows the state level and asks the user to zoom in. | min zoom, threshold                                               |

## Exploring

| Term                  | Definition                                                                                                                      | Aliases to avoid                                               |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| **Query**             | The set of conditions the map answers: window, type, level, and at most one selection.                                          | filters, criteria, settings, conditions, parameters            |
| **Applied query**     | The query currently reflected in the map, panel, URL, share link, and summary.                                                  | current state, active filters                                  |
| **Draft query**       | Edits to the omnibar not yet applied (only exists if an apply button is kept).                                                  | pending changes, unsaved filters                               |
| **Default view**      | The applied query on first load: whole U.S., the default preset window, all types, by state, no selection.                      | home state, initial state, national view                       |
| **Selection**         | The single unit whose numbers fill the panel and the summary; set by clicking a unit or by a location that resolves to one.     | selected area, focus, highlighted region, current place        |
| **Hover preview**     | Temporary display of a unit's numbers while the pointer is over it; never replaces the selection.                               | hover state, tooltip (as a concept)                            |
| **Class**             | One of the fixed rate bands the map colours (e.g. 4–5.9%).                                                                      | bin, bucket, category, quartile, quintile                      |
| **Break**             | The rate value at the boundary between two classes; fixed across windows of equal length.                                       | cut point, threshold, break point                              |
| **Legend**            | The on-map key listing the classes, their colours, and the "No data" swatch.                                                    | color key, scale                                               |
| **No data**           | A unit for which the rate is undefined or absent, drawn in a swatch distinct from the lowest class.                             | 0%, missing, blank, grey area                                  |
| **Reference rate**    | The closure rate of a parent or of the U.S. for the same window and type, computed from the parent's own closures and baseline. | average, U.S. average, state average, national rate, benchmark |
| **Comparison ladder** | The ordered list of rates for the selection, its parent(s), and the U.S., shown with a difference in percentage points.         | compared with, comparison bars, benchmark section              |
| **Percentage points** | The unit of difference between two closure rates.                                                                               | points, percent difference, % lower                            |

## Community indicators

| Term                     | Definition                                                                                                            | Aliases to avoid                                                    |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| **Community indicators** | Census-derived measures of the selection's neighbourhood conditions shown on the summary (UI name for SDOH).          | social determinants, SDOH (in UI copy), context, neighborhood stats |
| **SDOH**                 | The data team's name for community indicators; use it in data files and team talk only.                               | social determinants of health (spelled out in UI)                   |
| **Indicator**            | One community indicator field, e.g. median household income, % below poverty, % with high-school diploma, % employed. | metric, variable, stat, SDOH value                                  |
| **Reference year**       | The decennial census year an indicator value is taken from, chosen by the window's decade rule (2000 / 2010 / 2020).  | census year, matched year, ACS year                                 |

## Outputs

| Term                   | Definition                                                                                                          | Aliases to avoid                                             |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| **Summary**            | The printable one-page detail of one selection under one applied query, including its community indicators.         | one-pager, one-page summary report, report, PDF, export      |
| **Share link**         | A URL that reproduces exactly one applied query.                                                                    | share, permalink, link                                       |
| **Data request**       | A form submission by a requester asking for research data at chosen levels and windows, fulfilled outside the site. | download, download data, data download, get the data, export |
| **Requester**          | A person who submits a data request.                                                                                | user, downloader, applicant                                  |
| **Fulfilment**         | Delivery of requested data to a requester by DISC after any data use agreement.                                     | download, data delivery, sending the data                    |
| **Data use agreement** | The terms DISC has a requester accept before fulfilment.                                                            | DUA (fine in team talk), terms, consent                      |

## Content

| Term                 | Definition                                                                                                                                  | Aliases to avoid                         |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| **Story**            | An editorial piece about closures published by the research team on the Stories page.                                                       | blog, blog post, article, people's story |
| **Story submission** | A visitor's own account of a closure, sent through the Stories page form to a named team member.                                            | story, comment, testimonial, feedback    |
| **Photo pair**       | A "then and now" pair of photographs of one closed building, captioned with photographed years and, separately, its confirmed closure year. | before/after, evidence photos, case      |
| **Explainer video**  | The short "how to use" video produced by James and Mike Hornsberger, linked from Home and Explore.                                          | tutorial, walkthrough, README video      |
| **Health impacts**   | The page presenting the team's published papers on closures and health.                                                                     | research page, publications, evidence    |
| **Methodology**      | The page explaining how closures, baselines, rates, classes, and indicators are defined, linking to Shelby's report.                        | README, methods, about the data, GitHub  |

## People

| Term                 | Definition                                                                                                                             | Aliases to avoid                                              |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| **Community member** | A member of the public — often connected to a congregation — who wants to see their own area and take away a summary.                  | general public, church member, regular user, community people |
| **Researcher**       | A visitor who wants GEOID-level data and definitions, and will submit a data request.                                                  | student, doctoral student, GIS-savvy user, analyst            |
| **Tester**           | A participant in a round of user testing.                                                                                              | interviewee, participant, subject                             |
| **Test round**       | One cycle of user testing: round 1 on the old dashboard (4 testers, Aug 2026); round 2 on the real site with real data, before launch. | user interviews, usability study                              |
| **Research team**    | Yusuf's team, which owns copy, definitions, and metrics.                                                                               | Yusuf, YSPH, the client                                       |
| **Data team**        | Ryan (data loading), Nick (SDOH), Shelby (original closures data).                                                                     | YCGS, Ryan's side, the pipeline                               |
| **DISC**             | Ron's data science group at Yale, which fulfils data requests.                                                                         | Ron, Ron's group, the data platform                           |

## Data supply

| Term                   | Definition                                                                                                                        | Aliases to avoid                                                     |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| **Aggregate**          | The closures, baseline, and rate for one unit × window × type, as supplied or derived.                                            | row, record, stats, the numbers                                      |
| **Yearly series**      | Per-unit, per-type counts of closures and open-at-start for every year in coverage, from which any window's aggregate is derived. | option A, annual data, time series (it is a source, not a chart)     |
| **Precomputed window** | An aggregate supplied ready-made for one specific window, used only if the source is not yearly.                                  | option B, snapshot, pre-baked                                        |
| **Data contract**      | The written agreement between Gordon and the data team on file shapes, fields, keys, missing-value rules, and versioning.         | schema, spec, format requirements, interface                         |
| **Fixture data**       | Synthetic data in the data contract's exact shape, used to build and demo before real data arrives.                               | dummy data, mock data, placeholder data, static files, "static crap" |
| **Source version**     | A string identifying which release of the data team's outputs a file came from.                                                   | version, date stamp, build                                           |
| **Geocoder**           | The free service that turns an address into coordinates and a tract GEOID.                                                        | address lookup, Census API                                           |
| **Gazetteer**          | The lookup table from city name to state, centroid, and bounding box.                                                             | city list, places file                                               |

## Retired terms

Words from the old dashboard and the August testing summary. They will keep appearing in old materials; do not carry them into the new site.

| Retired term                               | What it meant                                                                                                      | Use instead                                    |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------- |
| Reopening / Existing / Closed (categories) | The old dashboard's per-year status categories; testers found them meaningless and the data does not support them. | **Closures** and **Baseline** only             |
| Persistence                                | A second metric on the old map that testers could not distinguish from the rate.                                   | Nothing — one metric, **Closure rate**         |
| Trend line / timeline / slider             | The old year slider with a line chart, misread as a per-year trend.                                                | **Window** (preset or custom)                  |
| Openings / new churches                    | A category testers asked about; not in the data.                                                                   | Explain its absence on **Methodology**         |
| Heatmap                                    | Tester shorthand for "the colours confuse me"; ambiguous between a continuous ramp and a density map.              | Fixed **classes** with an explained **legend** |
| Average (U.S. / state)                     | Yusuf's shorthand for the parent's rate.                                                                           | **Reference rate**                             |
| Dashboard                                  | The old single-page product; still used to mean the whole site.                                                    | **The site**, or **Explore** for the map page  |
| Download (button / data)                   | The old direct file download.                                                                                      | **Data request**                               |
| One-pager / report                         | The old export.                                                                                                    | **Summary**                                    |

## Relationships

- A **Unit** belongs to exactly one **Level** and has exactly one **Parent**, except the U.S.
- An **Aggregate** is keyed by one **Unit** × one **Window** × one **Type**; its **Closure rate** is **Closures** ÷ **Baseline**.
- A **Window** has a start and an end year at least five years apart; a **Preset window** is a **Window** the UI offers first.
- A **Query** has exactly one **Window**, one **Type**, one **Level**, and zero or one **Selection**; a **Selection** is always a **Unit** at the **Query**'s **Level**.
- Changing the **Viewport** never changes the **Selection**; a **Hover preview** never replaces the **Selection**.
- A **Fine level** is drawn only above its **Reveal zoom**; the **Level** stays part of the **Query** regardless of zoom, so a **Query** at a fine level with the **Viewport** on the whole U.S. shows the state level and a request to zoom in, never nationwide fine units.
- A **Location** resolves to a **Selection** (state, county, ZIP, address) or to a **Viewport** plus a **Level** (city).
- A **Comparison ladder** lists the **Closure rate** of the **Selection**, then the **Reference rate** of each **Parent** up to the U.S., all for the same **Window** and **Type**.
- A **Reference rate** is computed from the **Parent**'s own **Closures** and **Baseline**, never by averaging child rates.
- A **Summary** is produced from exactly one **Applied query** that has a **Selection**, and shows that **Selection**'s **Community indicators** for one **Reference year**.
- A **Share link** encodes exactly one **Applied query**.
- A **Data request** is made by one **Requester**, may be prefilled from an **Applied query** but is never limited by it, and is fulfilled by **DISC** after a **Data use agreement**.
- A **Story** is published by the **Research team**; a **Story submission** is sent by a visitor and is not published automatically.
- **Fixture data** and real data both conform to the **Data contract** and carry a **Source version**.

## Example dialogue

> **Dev:** "When someone picks **2008–2015** as a **Custom window** for Marion County, which **Reference year** do the **Community indicators** on the **Summary** use — 2000 or 2010?"
>
> **Domain expert (Yusuf):** "That's the open question for Nick. The rule so far only covers windows inside one decade. Until it's answered, the **Preset windows** are all five years inside a decade, so the **Summary** always has an unambiguous **Reference year**."
>
> **Dev:** "And the **Comparison ladder** for that county — the Indiana row is Indiana's own **Closures** over Indiana's own **Baseline** for 2008–2015, not the average of its counties?"
>
> **Domain expert:** "Right. It's a **Reference rate**, never an average. Same for the U.S. row."
>
> **Dev:** "Last one: a **Community member** types 'Gary, IN'. Gary is a **City**, not a **Unit**, so we zoom the **Viewport** to Gary, switch the **Level** to ZIP, and leave the **Selection** empty until they click a ZIP?"
>
> **Domain expert:** "Yes — and the panel should say so, so they don't read Indiana's numbers as Gary's. Once they click a ZIP, that's the **Selection**, and the **Summary** and **Share link** follow it."

## Flagged ambiguities

- **"church" vs "place of worship".** Yusuf says "church closings" throughout, the project may even be named that way, and the August summary asks how "church" is defined (denomination? Christian only?). The dataset covers churches, mosques, temples and more, and the wireframe already says **Place of worship**. Recommendation: **Place of worship** everywhere in the product; "church" only inside a **Type** value or when quoting the research team. Confirm the public project name with Yusuf.
- **"place" is triple-loaded**: place of worship, Census place (a city), and the proposed search label "Find a place". Recommendation: **Location** for the search target, **City** for the Census place, **Place of worship** unchanged. The label "Find a place" is acceptable as UI copy but the model and code should say **Location**.
- **"rate"** was read three ways in testing: as an annual rate, as a trend, and as something distinct from "persistence". Recommendation: always **Closure rate**, always defined next to the number as closures over baseline across the window, and retire **Persistence** completely.
- **"average" for the U.S. and state comparison.** Yusuf means the parent's rate; a real average of child percentages would be wrong. Recommendation: **Reference rate** in the model; "U.S. rate" / "Indiana rate" in UI copy; the word "average" never appears next to a closure figure.
- **"existing" vs "baseline".** The old category "existing" was read as a per-year count; the new concept is the count open at the window's start. Recommendation: **Baseline** only, with the start year always attached ("open in 2010").
- **"ZIP" vs "ZCTA".** The UI says ZIP, the data is ZCTA. Recommendation: **ZIP** in UI and model, ZCTA only in the data contract and the Methodology page, with one sentence explaining the difference there.
- **"Type" vs "denomination".** Type is church / mosque / temple; denomination (Baptist, Methodist…) is not a filter and may not exist in the data. Recommendation: **Type** for the filter; do not introduce "denomination" until the data team confirms a field.
- **"download" vs "request".** The old dashboard downloaded files; the new site collects requests fulfilled by DISC; the current nav still says "Download Data". Recommendation: **Data request** in the model, "Request data" in nav and buttons, and the word "download" reserved for a browser action such as printing the **Summary**.
- **"report" / "one-pager" / "one-page summary".** Three names for the same artefact, plus "PDF" for its printed form. Recommendation: **Summary**.
- **"dashboard".** Used for the old product, the new Explore page, and the whole site interchangeably, including in the launch email. Recommendation: **the site** for the whole thing, **Explore** for the map page; "dashboard" only when referring to the old product.
- **"story".** An editorial **Story** and a visitor's **Story submission** are different objects with different owners and workflows; the call treated both as "a text box".
- **"geography" / "level" / "layer" / "view by".** All used for the map's unit kind. Recommendation: **Level** in the model; "View by" is the control's label only.
- **"period" / "time range" / "years" / "window".** Recommendation: **Window**, with **Preset window** and **Custom window** as the two ways to set one.
- **"closure no longer in dataset"** (August email, readme notes) contradicts the whole premise on its face. It almost certainly means the old _category_ was dropped, but the exact definition of **Closure** — including how moves and address changes are handled — is unconfirmed and is the first question for the data team.
- **"heatmap"** meant at least two things to testers (continuous colour ramp; density surface). Neither is planned; the site uses fixed **Classes**. Do not adopt the word.
