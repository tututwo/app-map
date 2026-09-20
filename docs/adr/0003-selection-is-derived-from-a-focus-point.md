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
tiles, and links from before this decision still open.

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
