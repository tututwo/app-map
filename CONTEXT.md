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

## County geoid

Five-digit FIPS identifier for a county. Connecticut planning-region geoids
(`091x0`) are display-level aliases; South Central (`09170`) is normalized to
New Haven County (`09009`) because every dataset has that proven fallback
(`normalizeCountyGeoid`).
