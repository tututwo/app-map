#!/usr/bin/env bash
# Build the block-group boundary archive from the lab's TIGER GeoPackages.
# Maintainer-side only: needs ogr2ogr, tippecanoe and tile-join, none is an app dependency.
# The national build takes about twelve minutes and roughly 9 GB of free disk.
#
# Usage: scripts/build-tiles.sh <dir holding bg_statefp_XX_2000_2010_2020.gpkg> [vintage=2010]
# Every matching GeoPackage in the directory goes into one archive, so one state is a prototype
# and all 51 are the national build.
set -euo pipefail

src=${1:?directory holding bg_statefp_*_2000_2010_2020.gpkg}
vintage=${2:-2010}
root=$(cd "$(dirname "$0")/.." && pwd)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

for gpkg in "$src"/bg_statefp_*_2000_2010_2020.gpkg; do
  # geoid is the only property: metrics join at runtime (ADR-0002) and the Shard is its prefix.
  # Water-only block groups (blkgrpce 0) never hold a place of worship.
  ogr2ogr -f GeoJSONSeq "$tmp/$(basename "$gpkg" .gpkg).geojsonl" "$gpkg" \
    -t_srs EPSG:4326 -ct_opt WARN_ABOUT_DIFFERENT_COORD_OP=NO \
    -sql "SELECT geoid, geom FROM bg_$vintage WHERE blkgrpce <> '0'"
done

# No limit may drop a feature: a missing feature is a GEOID the metric join cannot colour.
common=(--quiet --force -l blockgroups --no-feature-limit --no-tile-size-limit --simplification=10)

# z2-z6: retain each visible block group's own GEOID and simplify shared borders consistently.
# Subpixel shapes can collapse at tile resolution; zooming restores their detailed boundaries.
tippecanoe "${common[@]}" -o "$tmp/national.pmtiles" -Z2 -z6 \
  --no-tiny-polygon-reduction --no-simplification-of-shared-nodes "$tmp"/*.geojsonl

# z7-z8, unchanged metro tiles. The smallest city block groups are under a
# pixel here, so tippecanoe's tiny-polygon reduction stands in for them with pixel squares that each
# keep one member's geoid, which holds the densest tile under 300 KB.
tippecanoe "${common[@]}" -o "$tmp/low.pmtiles" -Z7 -z8 "$tmp"/*.geojsonl

# z9-z12, where block groups are several pixels wide: every one is kept with its own shape and
# shared borders simplify identically. MapLibre overzooms past z12.
tippecanoe "${common[@]}" -o "$tmp/high.pmtiles" -Z9 -z12 \
  --no-tiny-polygon-reduction --no-simplification-of-shared-nodes \
  --simplification-at-maximum-zoom=1 "$tmp"/*.geojsonl

mkdir -p "$root/static/tiles"
# tile-join warns about mismatched maxzooms: the parts cover disjoint zoom ranges on purpose.
tile-join -f -pk -o "$root/static/tiles/bg-$vintage-v2.pmtiles" \
  "$tmp/national.pmtiles" "$tmp/low.pmtiles" "$tmp/high.pmtiles"
