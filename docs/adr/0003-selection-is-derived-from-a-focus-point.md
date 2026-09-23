# ADR-0003: The Selection is derived from a Focus point, read straight from the tile archive

Date: 2026-09-20 · Status: accepted

## Context

Explore stored one string, `where`, and read it according to the current Level.
Two documents disagreed about what it meant: the glossary said a Selection is
always a Unit at the Query's Level, while the handoff (§6.3) kept the state in
the panel after a switch to counties. The code followed neither. With Los
Angeles County (`06037`) selected, pressing ZIP showed "ZIP 06037", a place in
Connecticut, because a five-digit id is both a county and a ZIP. A switch to a
Fine level below its Reveal zoom left a flat state on screen, search knew only
states, and a shared tract link framed the whole state. Two independent
browser audits on 2026-09-20 reached the same verdict: every Level answers once
a polygon is clicked, and none of the three ways to get there works below the
state Level.

Gordon's own statement of the model settled it: a place only says where to
look; the Level buttons decide what is shown there.

## Decision

The Query holds a **Focus**, a point (`at=lng,lat` in the URL), instead of a
stored Selection. The **Selection** is the Unit at the Query's Level that
contains the Focus. Changing the Level keeps the Focus and re-derives the
Selection, so one Focus answers at all five Levels and a GEOID is never re-read
at another Level. A map click moves the Focus. Search only sets the Focus: a
Location that is itself a Unit (state, county, ZIP) also sets the Level to its
own; a City or an Address leaves the Level alone. The URL keeps the derived
`where` beside `at` so a shared link renders on the server without decoding
tiles; the browser derives it again from `at` on load, so the Focus stays the
authority even in an edited link. Links from before this decision still open:
a Unit without a Focus gets one from the Gazetteer.

The containing Unit is found by reading one tile at the archive's highest zoom
directly from the PMTiles archive, decoding it, and testing the point against
its polygons, not by asking the rendered map. Going up the census hierarchy
needs no tile at all: the parent is a GEOID prefix. The same read gives the
camera the Unit's bounds, from a lower zoom when the Unit runs past its tile, so
a search, a Level change and a shared link frame the Unit itself. A click on a
Unit never moves the camera.

Cities, counties and ZIPs resolve to a point through the Census 2010 Gazetteer,
shipped as static tables. A street address goes to the Census Geocoder only
when the user submits it, through a POST route on the Worker: the service
sends no CORS header, and an address in a URL would reach the Worker's sampled
request logs.

## Considered options

- **Clear the Selection on every Level change.** Simplest, and honours the
  glossary, but each switch costs a click and a keyboard user still cannot
  reach a tract or block group.
- **Let the Selection carry its own Level** (`county:09009` beside
  `level=tract`), the handoff's drill-down. It keeps the mismatch between the
  panel and the map that both audits reported as confusing.
- **A separate Scope** (a parent that frames, dims and filters). The richest
  model, and one more concept, URL parameter and piece of UI than the goal
  needs.
- **`queryRenderedFeatures`** for the lookup. No decoding code, but the answer
  waits for the camera and an `idle` event, never arrives in a background tab,
  and low-zoom tiles drop or simplify small polygons.
- **Level follows zoom** ("semantic zoom"). Rejected: the Level stays part of
  the Query regardless of zoom, and with a Focus each Level button already
  produces a new answer and moves the camera.

## Consequences

- Measured against the published archives on R2 (six points from Manhattan to
  rural Kansas, four Levels): decode plus point-in-polygon 0.05–2 ms (the
  densest block-group tile holds 843 features), 50–230 ms and at most 25 KB on
  the wire per lookup, 64–324 ms once per archive for its header. Block groups
  are no slower than tracts. The panel's breakdown costs what a click already
  cost: one state Shard, at most 857 KB (California), then nothing.
- Handoff §6.3 (the panel keeps the state, other states dim, tracts need a
  state first) is superseded.
- Search reaches every Level without the pointer: a city or a ZIP, then a Level
  button.
- The Geocoder has no autocomplete and matches street addresses only, so an
  address is an explicit submit and the Gazetteer is not optional. The provider
  is easy to swap; the Focus model is not.
- A Focus on a boundary can land on either side: tile coordinates are exact to
  about two metres. Accepted; a click nearby moves it.

## Amendment, 2026-09-22: a click frames a Unit it cannot see yet

Gordon asked for a click on any state, county, ZCTA, tract or block group to zoom in to it. "A click on a
Unit never moves the camera" is replaced by this rule (`clickMove` in `StateMap.svelte`):

- A Unit the map shows at less than half the size a frame could give it (current zoom below its fit zoom
  minus one) is framed, as a search would frame it. From the national view every click lands on its Unit.
- Nearer in, a click moves nothing unless the edge of the map cuts the Unit off. A Unit that fits at the
  current zoom is then centred without zooming, so walking from one neighbour to the next stays at one
  scale. A Unit bigger than the view leaves the camera alone: the user zoomed in on purpose.
- Below a Level's outline zoom (fine polygons are specks: at the national view a pixel holds hundreds of
  city block groups), the polygon drawn under the pointer is a guess. The click is then treated like a
  search for its point: the Selection is the Unit that contains the point, read from the archive, and
  the Focus dot lands inside the framed outline. At and above the outline zoom the drawn Unit is trusted,
  as before. The tooltip says "Click to zoom in" when a click would frame.

Framing needs the Unit's whole bounds. A Unit that crosses a tile edge is now pieced together from its
neighbouring tiles at the highest zoom where it spans at most four (`spanOf`), instead of being read again
one zoom lower until one tile holds it. The old walk never ended for a Unit on an edge that exists at
every zoom: Shelby County, Tennessee (Memphis) and Orleans Parish sit on 90°W, and a click there fell
back to a fixed zoom.

Measured in Chromium on the same machine (GPU, 1440×900), before and after this change:

| Scenario                                     | main thread blocked, before |          after |
| -------------------------------------------- | --------------------------: | -------------: |
| Pointer across 28 block groups, zoomed in    |                    8,792 ms |           0 ms |
| Three drags of the zoomed-in block-group map |                      977 ms |         100 ms |
| National block-group view, click one         |            382 ms (no zoom) | 0 ms, flies in |

The hover cost was not the outline: hover and Selection outlines were filter layers on the coloured
source, and MapLibre rebuilds every tile of a source when a filter changes, then replays every
feature-state (157,000 block groups) onto each rebuilt tile. The outlines now have their own source on
the same archive, whose tiles hold one or two features, so a filter change rebuilds tiles in 2 ms and the
coloured tiles never. Both sources share one request per tile.

Rejected while doing this: colour classes as one MapLibre global-state object (MapLibre 5.19 copies the
whole global state into every tile's reply: zooming out blocked the main thread 3.8 s); colouring only
the states in view (MapLibre never forgets a feature-state id, so the per-tile cost stays after the
national view has painted every block group). Loading a block-group tile still costs about 17 ms of main
thread for that replay; a MapLibre that iterated a tile's features instead of every state would remove it.
