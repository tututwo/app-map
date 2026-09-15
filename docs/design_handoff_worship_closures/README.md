# Handoff: Where Are Places of Worship Closing? — website (Yale School of Public Health)

## Overview

A public research site from the Yale School of Public Health tracking where U.S. places of worship have closed and what that means for neighborhood health. Two screens are designed: a **Landing page** (hero, search bar, then-and-now photo pairs, research papers, stories, footer) and an **Explore page** (filter toolbar, tile-grid map of the 50 states + DC with hover tooltip and selection, right-hand detail panel). The chosen direction is option **2a "Bulldog"**: white paper, a full-bleed Yale Blue hero band, Libre Caslon Text headlines, Libre Franklin UI — a New York Times-like editorial structure in Yale's identity.

## About the Design Files

The files in this bundle are **design references created in HTML** (`Worship Closures.dc.html` + `image-slot.js`). They are a prototype showing the intended look and behavior — not production code to copy. The task is to **recreate these screens in the target codebase's existing environment** (React/Next, Vue, Svelte, etc.) using its established patterns; if no environment exists yet, pick the most appropriate framework (Next.js + a CSS approach of your choice is a fine default) and implement the designs there.

The prototype supports 10 color/type "themes" via CSS custom properties. **Only the `bulldog` theme is in scope** — implement its values (listed under Design Tokens) as the site's single palette. Ignore the other themes and the theme-switch prop.

## Fidelity

**High-fidelity.** Colors, typography, spacing, copy and interactions are final for the two screens. Recreate them pixel-close. Photos are not final: every image is a placeholder slot the content team fills later (hero, 6 then/now photos, 3 research-card images, 3 partner logos).

## Global

- Page max content width **1400px** (inner container `max-width:1400px; margin:0 auto; padding-inline:60px`). Body bg `#FFFFFF`. Base font Libre Franklin 15px / 1.5, color `#3A3A3A`.
- **Nav (both pages)**: 64px tall, bg `#FFFFFF`, bottom border 1px `#E3E3E3`, `padding:0 60px`, flex space-between. Left: brand "[Project name]" (placeholder text, Libre Franklin 700 16px, `#00356B`, links home). Right: 5 links, gap 30px, Libre Franklin 500 14px `#121212`, full-height with 2px bottom border — `transparent` normally, `#00356B` for the active page ("Explore" on the Explore screen). Links: Explore, Stories, Health Impacts, Download Data, About. Stories scrolls to the Stories section of the landing page; Health Impacts / Download Data / About are placeholders (no destination yet).
- **Small-caps label style** (used for kickers, field labels, panel labels): 9.5px, 700, letter-spacing .14em, uppercase, color `#6B6B6B`. The hero kicker is the same at 10.5px in `#9CC5FF`.
- Links (default `a`): `#286DC0`; hover: underline (or `#121212` where noted).
- Primary button: bg `#00356B`, text `#FFFFFF`, 600 14px, radius 3px, hover `filter:brightness(.92)`.
- Secondary/outline button: 1px `#D2D2D2` border, text `#121212`, bg `#FFFFFF`, radius 3px, hover border `#121212`.
- Cards: bg `#FFFFFF`, 1px `#E3E3E3`, radius 4px.
- Placeholder hatch (no photo / no data): `repeating-linear-gradient(135deg,#E8E9EC 0 6px,#CFD2D8 6px 8px)`.

## Screen 1 — Landing

**1. Hero band** — full-width section, bg `#00356B`. Inner container `padding:40px 60px 64px`, 2-col grid `repeat(auto-fit,minmax(380px,1fr))`, gap 56px, `align-items:end`.

- Left column (`padding-bottom:10px`): kicker "YALE SCHOOL OF PUBLIC HEALTH · RESEARCH PROJECT" (`#9CC5FF`, margin-bottom 28px) → H1 "Where are places of worship closing?" (Libre Caslon Text 400, 46px / 1.12, letter-spacing −.012em, `#FFFFFF`, margin-bottom 26px) → paragraph (Libre Franklin 16px / 1.6, `#D6E2F2`, max-width 520px): "A research project from the Yale School of Public Health tracking where places of worship have closed across the U.S. — and what that means for the health of the neighborhoods around them."
- Right column: hero image slot, `aspect-ratio:2.15`, min-height 240px, white bg, 1px `#E3E3E3`, radius 4px, overflow hidden.

**2. Search bar** — straddles the band's bottom edge: container `margin-top:-36px; position:relative; z-index:2`, same inner padding. Card: white, 1px `#E3E3E3`, radius 4px, shadow `0 1px 2px rgba(0,0,0,.05), 0 14px 34px -18px rgba(0,0,0,.22)`, flex row (wraps on narrow widths). Cells `padding:14px 20px 13px`, separated by 1px `#E3E3E3` right borders, each = small-caps label above a 14px 600 `#121212` control:

- WHERE — text input, flex `1 1 320px`, placeholder "ZIP, city, county or state — or leave empty for the whole U.S." (placeholder color `#7A7A7A`).
- FROM (select, years 2000–2018, default 2010) — an em dash "—" (`#7A7A7A`) — TO · 5+ YEARS LATER (select, years ≥ From+5 up to 2023, default 2015). Same pair as on Explore. Selects are `appearance:none` with a 10×6 chevron icon (`#6B6B6B`) at the right.
- TYPE (select, flex `1 1 220px`): All places of worship (default) / Christian congregations / Synagogues / Mosques / Temples & other.
- Button cell `padding:8px`: primary button "Explore →", min-height 48px, padding 0 24px.
- Helper line under the card: "Rates are calculated over the whole period · minimum 5 years." 11.5px `#7A7A7A`, `padding:10px 18px 0`.

**3. Then and now** — `padding:96px 60px 0`. H2 "Then and now" (Libre Caslon Text 400 30px / 1.15 `#121212`); **directly under it** (gap 14px) the intro paragraph, 15px / 1.55 `#6B6B6B`, max-width 640px: "Each pair is the same address a few years apart — a congregation in use, then the building after it closed. [Paragraph placeholder; the research team supplies final wording.]" Then 30px, then a 3-col grid `repeat(auto-fit,minmax(300px,1fr))`, gap 40px. Each figure: photo pair = 2-col grid, gap 2px, `aspect-ratio:2.68`, radius 3px, overflow hidden; each half is an image slot on `#E8E9EC` with a tag pill at top (10px inset; left photo top-left "THEN · 2012", right photo top-right "NOW · 2023"): white bg, `#121212`, 8.5px 700 .12em uppercase, `padding:4px 7px`, radius 2px. Caption 12px margin-top, 12.5px / 1.5 `#3A3A3A`, name bold `#121212`:

- **1485 Gates Ave** · open 2012 → closed 2023 · Brooklyn, NY
- **St. Casimir** · open 2004 → closed 2019 · Gary, IN
- **Mt. Zion AME** · open 2006 → closed 2018 · Milwaukee, WI

**4. From our research** — `padding:104px 60px 0`. Header row (space-between, baseline, margin-bottom 28px): H2 "From our research" + link "See all research →" (13px 600 `#286DC0`). 3-col grid `repeat(auto-fit,minmax(300px,1fr))`, gap 24px. Card: `padding:22px 22px 20px`, flex column gap 10px:

- Topic tag pill: 9px 700 .12em uppercase, `#00356B` on `#DCE5F1`, `padding:4px 8px`, radius 2px.
- Title: Libre Caslon Text 400 20px / 1.3 `#121212`.
- Meta: 12.5px `#6B6B6B` — "Journal · Year".
- Image slot: `aspect-ratio:1.9`, radius 3px, bg `#E8E9EC`.
- "Read the paper →" 13px 600 `#286DC0`, pushed to the bottom (`margin-top:auto; padding-top:8px`).
  Content: NEIGHBORHOOD HEALTH — "Closures of places of worship and neighborhood mortality, 2000–2020" — American Journal of Public Health · 2024 · image: a church behind bare trees. DATA & METHODS — "Mapping places of worship at the census-tract level: a national dataset" — Health & Place · 2023 · image: national dot map. SOCIAL COHESION — "Loss of religious infrastructure and social cohesion in U.S. counties" — Social Science & Medicine · 2025 · image: inscription on a stone facade.

**5. Stories** — `padding:96px 60px 0`. H2 "Stories" (margin-bottom 28px). Grid `repeat(auto-fit,minmax(280px,1fr))`, gap 24px, `align-items:start`. Two quote articles: top border 1px `#00356B`, `padding-top:22px`, column gap 12px — blockquote Libre Caslon Text 23px / 1.3 `#121212` in curly quotes, attribution 12px `#6B6B6B`, link "Read the story →" 13px 600 `#286DC0`.

- "The building is a dollar store now. The food pantry moved twice, then stopped." — A former member · Gary, IN · placeholder
- "We still meet — in a living room, eleven of us." — A congregant · Brooklyn, NY · placeholder
  Third column: card `padding:24px`, gap 18px: text 15px `#121212` "Did a place of worship near you close? Tell us what changed." + pill button "Share your story" (42px tall, 1.5px `#00356B` border, `#00356B` text, 13.5px 600, radius 999px; hover fills `#00356B` with white text).

**6. Footer** — `margin-top:96px`, bg `#F4F4F2`, top border 1px `#E3E3E3`, inner `padding:52px 60px 40px`. Flex row space-between (wraps): links column (Methodology / Get the data / Contact — 13px 600 `#121212`, gap 12px, hover underline); SHARE label + chips row (gap 10px): pill buttons 30px tall, `padding:0 14px 0 12px`, white, 1px `#E3E3E3`, 11.5px 600 `#121212`, a 9px `#00356B` dot before the label — LinkedIn, Facebook, Email, Copy link (copies URL, label becomes "Copied" for 1.6s), Substack; logos row: three 112×40 hatch placeholders labeled "YSPH logo", "YCGS logo", "YDS logo" (monospace 10px `#6B6B6B`). Disclaimer `margin-top:44px`, 11.5px / 1.5 `#7A7A7A`: "Data and estimates are for research purposes and may contain errors; they do not constitute medical, legal or financial advice. © Yale School of Public Health."

## Screen 2 — Explore

Layout: `<main>` is a column filling the viewport under the nav: `height:max(720px, calc(100vh - 65px))`. Toolbar on top, then a flex row (no wrap) of map area (flex 1) + right panel (fixed 440px, scrolls internally).

**Toolbar** — white, bottom border 1px `#E3E3E3`, cells **56px tall**, `padding:0 20px`, separated by 1px `#E3E3E3` right borders:

- FIND A PLACE (flex `0 1 320px`, min 240px): 18px search icon (`#6B6B6B`), label + text input (16px `#121212`, default value = selected state name, e.g. "Indiana"), 18px crosshair "Use my location" button. While typing, a dropdown (white, 1px `#E3E3E3`, shadow `0 16px 28px -14px rgba(0,0,0,.3)`) lists up to 6 matching states: name (14px) left, "6.3% · 620 closed" (12px `#6B6B6B`) right; row hover bg `#FFFFFF`→`#F4F4F2`; Enter picks the first match, Esc closes.
- FROM select — "—" — TO · 5+ YEARS LATER select (16px 500).
- TYPE select (16px 500).
- Right-aligned group (gap 12px): "View by" 12.5px `#6B6B6B`; segmented control (bg `#EEEFF1`, padding 3px, radius 5px) with State / County / ZIP / Tract buttons (13px 500 `#121212`, `padding:6px 11px`, radius 3px; active = white bg + shadow `0 1px 2px rgba(0,0,0,.14)`); "RESET" outline button (34px tall, 11px 700 .1em uppercase).

**Map area** — bg `#F2F3F5` with a 36px grid of 1px lines `rgba(0,30,70,.06)`; `overflow:hidden`. The tile map is centered with padding `50px 100px 130px 60px`, width `min(100%, 900px, max(620px, calc(150vh - 470px)))`, CSS grid 12 columns, gap 5px; tiles are square (`aspect-ratio:1`), radius 3px, label = state abbreviation 10.5px 700 .04em. Grid positions (col,row, 0-indexed):

```
row0: AK(0) ME(11)
row1: WI(5) VT(9) NH(10)
row2: WA(0) ID(1) MT(2) ND(3) MN(4) IL(5) MI(6) NY(8) MA(9)
row3: OR(0) NV(1) WY(2) SD(3) IA(4) IN(5) OH(6) PA(7) NJ(8) CT(9) RI(10)
row4: CA(0) UT(1) CO(2) NE(3) MO(4) KY(5) WV(6) VA(7) MD(8) DE(9)
row5: AZ(1) NM(2) KS(3) AR(4) TN(5) NC(6) SC(7) DC(8)
row6: OK(3) LA(4) MS(5) AL(6) GA(7)
row7: HI(0) TX(3) FL(8)
```

Tile fill by closure-rate class (fixed breaks): <2% `#DCE5F1`, 2–3.9% `#A6BEDF`, 4–5.9% `#6C93C7`, 6–8.9% `#3565A8`, 9%+ `#00356B`. Label color `#1F3D6B` on the two lightest classes, `#FFFFFF` otherwise. "No data" (fewer than 15 places in the baseline year): hatch `repeating-linear-gradient(135deg,#E8E9EC 0 5px,#CFD2D8 5px 7px)`, label `#6B6B6B`.

- Hover: 1px `#121212` outline (offset 2px), tile raised above neighbors, tooltip above the tile: bg `#00356B`, text `#FFFFFF` 12.5px 500, `padding:11px 14px`, radius 5px, 6px down-arrow, 150ms fade-in. Text: "Indiana · 2010–2015 · 620 of 9,800 closed · 6.3%" (or "… · too few places to report").
- Selected: 2px `#121212` outline, offset 2px.
- Zoom control: top-right (20px/22px), white, 1px `#E3E3E3`, radius 3px, two 42×42 buttons "+" / "−" separated by a border; scales the tile grid 0.6–2.0 in 0.25 steps (transform, 250ms ease).
- Legend card: bottom-left (24px), width `min(470px, 100% - 48px)`, white, 1px `#E3E3E3`, radius 4px, `padding:18px 22px 16px`, shadow `0 6px 20px -10px rgba(0,0,0,.18)`. Row 1: "Closure rate over 5 years" (15px 600 `#121212`, the number = To − From) and a text button "How are colors chosen?" (13px `#286DC0`). Row 2: five equal segments (10px tall) in the five class colors with labels beneath (11.5px `#3A3A3A`): Under 2% · 2–3.9% · 4–5.9% · 6–8.9% · 9%+, then a 68px hatch segment labeled "No data". Clicking "How are colors chosen?" toggles an explanation (12.5px `#6B6B6B`, top border): "Fixed breaks at 2, 4, 6 and 9 percent, so the same shade means the same closure rate in every view and time window. Areas with fewer than 15 places of worship in the baseline year are hatched rather than colored."
- Credit bottom-right (22px/20px): "Data: [project] · U.S. Census Bureau" 11px `#7A7A7A`.
- When View by ≠ State: tile map dims to 35% and a centered white card says "County view — in build" (14px 600) / "Finer geographies arrive with the full dataset. The state view is live." (12.5px `#6B6B6B`).

**Right panel** — 440px, white, left border 1px `#E3E3E3`, `padding:30px 34px 34px`, column gap 18px, `overflow:auto`, 1px `#E3E3E3` dividers between groups:

1. SHOWING label → name (Libre Caslon Text 400 40px / 1.08 `#121212`, e.g. "Indiana" or "United States") → "2010–2015 · 5-year window · all places of worship" (13.5px `#6B6B6B`).
2. Three stats, space-between: value Libre Caslon Text 34px / 1 (closure rate in `#00356B`, others `#121212`) + small-caps label: CLOSURE RATE 6.3% · CLOSED 620 · OPEN IN 2010 9,800.
3. Sentence 15px / 1.55 `#3A3A3A`: "620 of the 9,800 places of worship open in 2010 closed during 2010–2015."
4. COMPARED WITH: two bar rows (name 118px | track 8px tall `#DCE5F1`, fill width = rate/14 | value 44px right-aligned) — selected state in 600 with `#00356B` fill; "United States" regular with `#6C93C7` fill; then "0.2 percentage points below the U.S. rate (6.5%)." 13.5px `#6B6B6B`. When nothing is selected (US view) show instead a note with a 2px `#E3E3E3` left rule: "Click a state on the map to compare it with the national rate."
5. One-page summary row: 110×142 mini-document thumbnail (1px `#E3E3E3`, shadow `0 1px 3px rgba(0,0,0,.08)`, decorative bars in `#3565A8` / `#E3E3E3` and a hatch block) + ONE-PAGE SUMMARY label, text 14px "A printable page for this selection: the map, closure counts and neighborhood indicators — poverty, education, income.", mono 11px `#7A7A7A` "preview placeholder · layout designed later".
6. Buttons row (gap 10px): primary "View one-page summary →" (flex 1, 46px) + outline "Share" (84px; copies URL, label "Copied" for 1.6s).
7. "Local context, community indicators and sources." 14px; link "Request this data →" 14px 600 `#286DC0`; "Short form, prefilled with Marion County, IN, 2010–2015." 13.5px `#6B6B6B` (county = the state's largest county; see data table in the HTML).
8. "How to use this map" row: 90×52 hatch thumbnail with a 26px white play disc, title 14px 600, "Video · 1 min · opens in a dialog" 12px `#6B6B6B`.

**One-page summary modal** — overlay `rgba(10,14,22,.55)`, white sheet `min(680px,100%)`, `padding:44px 56px 52px`, shadow `0 30px 80px -20px rgba(0,0,0,.5)`: header row with small-caps "YALE SCHOOL OF PUBLIC HEALTH · ONE-PAGE SUMMARY" and "Close ✕", 2px `#1A1A1A` rule; name 36px Libre Caslon; window line; three stats at 30px; a 220px hatch block "map · closure counts · neighborhood indicators — layout designed later". Closes on backdrop click.

## Interactions & Behavior

- Nav brand → landing; "Explore" → Explore page; "Stories" → landing, smooth-scroll to Stories (offset 24px).
- Landing "Explore →" / Enter in WHERE: resolve the text to a state (exact name or abbreviation, else prefix match); open Explore with that state selected (or the U.S. if empty/no match). From/To/Type carry over.
- From/To/Type are shared between the landing bar and the Explore toolbar. Changing From bumps To to at least From+5. To options = From+5 … 2023.
- Map: hover tooltip; click selects (updates panel, input text and the "prefilled with" county); locate button selects Connecticut (demo); RESET → U.S. view, 2010–2015, all types, State view, zoom 1, legend info closed.
- Data model (prototype): each state has baseline `open` (2010) and a 5-year `rate`. For a window of N years, rate = base × typeFactor × (N/5)^0.85 (capped at 60%); open = baseline × typeShare; closed = round(open × rate/100); "no data" when open < 15. U.S. rate = Σclosed/Σopen. Type shares/factors: all 1/1, Christian .87/.97, Synagogues .011/.8, Mosques .008/.55, Temples & other .024/.9. Indiana baseline: 9,800 open, 6.327% → 620 closed. Full table in `Worship Closures.dc.html` (`STATES`). Replace with the real API.
- Transitions: tooltip fade 150ms; zoom 250ms ease; bar widths 300ms; button hover `brightness(.92)`.
- Responsive: landing grids use `auto-fit` minmax columns and wrap naturally; the search bar wraps; Explore is desktop-first (min height 720px, panel fixed 440px).

## State Management

`page` (landing | explore), `from`, `to`, `type`, `where` (landing input), `find` + `findOpen` (Explore input/dropdown), `sel` (state id | null = U.S.), `hover`, `view` (State/County/ZIP/Tract), `zoom`, `legendInfo`, `copied`, `summary` (modal). Derived: per-state stats, U.S. totals, selected stats, comparison, tile fills. Persist `from/to/type/sel` in the URL query so Share links reproduce the view.

## Design Tokens (theme "bulldog")

Colors: paper/surface `#FFFFFF` · ink `#121212` · text `#3A3A3A` · muted `#6B6B6B` · faint `#7A7A7A` · rule `#E3E3E3` · strong rule / nav active `#00356B` · link `#286DC0` · button `#00356B` on `#FFFFFF` · hero bg `#00356B`, hero ink `#FFFFFF`, hero text `#D6E2F2`, kicker `#9CC5FF` · footer bg `#F4F4F2` · map bg `#F2F3F5`, grid `rgba(0,30,70,.06)` · no-data `#E8E9EC` / hatch `#CFD2D8` · tooltip `#00356B`/`#FFFFFF` · selection outline `#121212` · field border `#D2D2D2` · segmented bg `#EEEFF1` · map scale `#DCE5F1 #A6BEDF #6C93C7 #3565A8 #00356B`.
Type: Libre Caslon Text (Google Fonts; 400/700) for H1 46/1.12, H2 30/1.15, panel name 40/1.08, stats 34/1, card titles 20/1.3, quotes 23/1.3. Libre Franklin (300–800) for everything else: body 15–16, controls 14–16, meta 12–13.5, labels 9.5 small-caps .14em.
Radii: cards 4px, controls 3px, tiles 3px, pills 999px. Spacing: section gaps 96/104px, container padding 60px, card padding 22–26px, panel gap 18px.
Shadows: search card `0 1px 2px rgba(0,0,0,.05), 0 14px 34px -18px rgba(0,0,0,.22)`; legend `0 6px 20px -10px rgba(0,0,0,.18)`; dropdown `0 16px 28px -14px rgba(0,0,0,.3)`; tooltip `0 10px 24px -10px rgba(0,0,0,.45)`.

## Assets

No final imagery. All photos/logos are drop-in slots (hero, 3 then/now pairs, 3 research images, 3 partner logos: YSPH, YCGS, YDS). Icons are tiny inline SVGs (search, crosshair, chevron, play) — use the codebase's icon set. Fonts from Google Fonts: Libre Caslon Text, Libre Franklin. Yale identity colors (Yale Blue `#00356B`, medium blue `#286DC0`, light blue `#63AAFF`) should come from the university's brand system if one exists in the codebase.

## Files

- `Worship Closures.dc.html` — the working prototype (landing + Explore; data table, theme values and all copy live in its script block). Open it in a browser; the `theme` prop defaults to `bulldog`.
- `image-slot.js` — placeholder image component used by the prototype (not needed in production).
- Source mockups: `uploads/` screenshots of the original wireframes (landing, Explore, research-card reference).
