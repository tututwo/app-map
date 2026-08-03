# ADR-0001: Year Window legality is data-driven

Date: 2026-08-03 · Status: accepted

## Context

"Minimum 5 years" was implemented three independent ways: the URL parser and
the map_data validator accepted 5 calendar years inclusive (`to − from + 1 ≥ 5`),
while the brush and the generated data required a gap of 5 (`to − from ≥ 5`,
smallest window 2001–2006). URLs like `?from=2001&to=2005` passed validation
and then 404ed, because the source CSV contains no gap-4 columns — the app
cannot compute windows itself; they arrive precomputed from upstream.

The product intent **is** 5 calendar years inclusive. The data does not
provide it yet.

## Decision

The code holds no opinion about which windows are legal. The prebuild derives
`{minYear, maxYear, minGap}` from the discovered ranges, asserts the generated
set is exactly "every window within bounds meeting the minimum gap" (build
fails otherwise), and emits `src/lib/generated/year-window-bounds.json`.
`src/lib/domain/yearWindow.ts` is the single owner of parsing, clamping, and
validation; the parser and the brush share one clamp algebra
(`clampYearWindow`), and illegal URLs clamp to the nearest legal window rather
than falling back to defaults.

## Consequences

- The three implementations cannot disagree again; the 404-after-validation
  path is impossible by construction.
- When upstream ships gap-4 columns, parser, endpoint, and brush loosen
  automatically — no code change. Until then, do not hardcode 5-inclusive
  (or 6-inclusive) anywhere; future reviews should not re-suggest either.
- Regenerated data with an irregular window set fails the build loudly instead
  of shipping windows the validators would reject.
