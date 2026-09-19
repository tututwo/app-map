#!/usr/bin/env bash
# Build a boundary archive from the Census Bureau's 2010 cartographic boundary files, and for counties
# the name table too. Maintainer-side only: needs curl, ogr2ogr, tippecanoe and tile-join.
#
# Usage: scripts/build-census-tiles.sh <county|tract|zcta> [download dir=~/Downloads/census-2010]
#
# Why these files: the lab's OneDrive holds block-group boundaries only, and the counts use 2010
# geography. Later boundaries do not fit them: Connecticut's planning regions replaced its eight counties
# in 2022 (every tract GEOID there changed with them), and even the 2017 county outlines lack Wade
# Hampton AK (02270), Shannon SD (46113) and Bedford city VA (51515).
set -euo pipefail

level=${1:?county, tract or zcta}
src=${2:-"$HOME/Downloads/census-2010"}
root=$(cd "$(dirname "$0")/.." && pwd)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
states="01 02 04 05 06 08 09 10 11 12 13 15 16 17 18 19 20 21 22 23 24 25 26 27 28 29 30 31 32 33 34 35 36 37 38 39 40 41 42 44 45 46 47 48 49 50 51 53 54 55 56"

# geoid joins the counts at runtime (ADR-0002) and is all a tile carries. Puerto Rico has no counts.
case $level in
  county) files=(gz_2010_us_050_00_500k); layer=counties; geoid="STATE || COUNTY"; keep="STATE <> '72'" ;;
  tract) files=(); for s in $states; do files+=("gz_2010_${s}_140_00_500k"); done
    layer=tracts; geoid="STATE || COUNTY || TRACT"; keep="1 = 1" ;;
  zcta) files=(gz_2010_us_860_00_500k); layer=zctas; geoid="ZCTA5"; keep="ZCTA5 NOT BETWEEN '00600' AND '00999'" ;;
  *) echo "unknown level $level" >&2; exit 1 ;;
esac

mkdir -p "$src"
for name in "${files[@]}"; do
  [ -f "$src/$name.shp" ] || {
    curl -sS -L --fail --retry 3 -o "$src/$name.zip" "https://www2.census.gov/geo/tiger/GENZ2010/$name.zip"
    unzip -o -q "$src/$name.zip" -d "$src"
  }
  # The 2010 DBF is Latin-1 (Doña Ana County) and declares no encoding. LSAD abbreviates the long county
  # suffixes; DC and Carson City have none. name only feeds the county table below.
  ogr2ogr -f GeoJSONSeq "$tmp/$name.geojsonl" "$src/$name.shp" -oo ENCODING=ISO-8859-1 \
    -t_srs EPSG:4326 -ct_opt WARN_ABOUT_DIFFERENT_COORD_OP=NO -dialect sqlite -sql "
    SELECT $geoid AS geoid,
           trim(NAME || ' ' || CASE coalesce(LSAD, '') WHEN 'CA' THEN 'Census Area' WHEN 'Cty&Bor' THEN 'City and Borough'
                                    WHEN 'Muny' THEN 'Municipality' ELSE coalesce(LSAD, '') END) AS name,
           geometry
    FROM $name WHERE $keep"
done

# No limit may drop a feature: a missing feature is a GEOID the metric join cannot colour.
common=(--quiet --force -l "$layer" -x name --no-feature-limit --no-tile-size-limit)
mkdir -p "$root/static/tiles"
out="$root/static/tiles/$level-2010.pmtiles"
if [ "$level" = county ]; then
  # A Coarse level, drawn nationwide from the map's minimum zoom.
  tippecanoe "${common[@]}" -Z2 -z9 --no-tiny-polygon-reduction --no-simplification-of-shared-nodes \
    --simplification=6 -o "$out" "$tmp"/*.geojsonl
else
  # A Fine level, built like the block groups: z7-z8 just past the Reveal zoom lets tippecanoe stand in
  # for sub-pixel city polygons with pixel squares that keep one member's geoid; z9-z11 keeps every shape
  # and shared borders simplify identically. MapLibre overzooms past z11.
  tippecanoe "${common[@]}" -Z7 -z8 --simplification=10 -o "$tmp/low.pmtiles" "$tmp"/*.geojsonl
  tippecanoe "${common[@]}" -Z9 -z11 --no-tiny-polygon-reduction --no-simplification-of-shared-nodes \
    --simplification=10 --simplification-at-maximum-zoom=1 -o "$tmp/high.pmtiles" "$tmp"/*.geojsonl
  tile-join -f -pk -o "$out" "$tmp/low.pmtiles" "$tmp/high.pmtiles"
fi

if [ "$level" = zcta ]; then
  # ZIP counts shard by the first two digits; the map loads the Shards whose box meets the viewport.
  ogr2ogr -f CSV /vsistdout/ "$src/${files[0]}.shp" -dialect sqlite -sql "
    SELECT substr(ZCTA5, 1, 2) AS shard, min(ST_MinX(geometry)) AS west, min(ST_MinY(geometry)) AS south,
           max(ST_MaxX(geometry)) AS east, max(ST_MaxY(geometry)) AS north
    FROM ${files[0]} WHERE $keep GROUP BY 1 ORDER BY 1" | python3 -c '
import csv, json, sys
bounds = {r["shard"]: [round(float(r[k]), 3) for k in ("west", "south", "east", "north")] for r in csv.DictReader(sys.stdin)}
json.dump(bounds, open(sys.argv[1], "w"), separators=(",", ":"))
' "$root/src/lib/generated/zcta-shard-bounds.json"
fi

# Ids with a boundary, for scripts/build-metrics.py to check the counts against.
cat "$tmp"/*.geojsonl | python3 -c '
import json, sys
names = {}
for line in sys.stdin:
    p = json.loads(line)["properties"]
    names[p["geoid"]] = p["name"]
level, root = sys.argv[1], sys.argv[2]
open(f"{root}/static/tiles/{level}-2010-geoids.txt", "w").write("\n".join(sorted(names)) + "\n")
if level == "county":
    # The panel names a selected county without any tile, e.g. on a shared link: "Fairfield County, CT".
    usps = dict(zip("01 02 04 05 06 08 09 10 11 12 13 15 16 17 18 19 20 21 22 23 24 25 26 27 28 29 30 31 32 33 34 35 36 37 38 39 40 41 42 44 45 46 47 48 49 50 51 53 54 55 56".split(),
                    "AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY".split()))
    table = {geoid: f"{name}, {usps[geoid[:2]]}" for geoid, name in sorted(names.items())}
    json.dump(table, open(f"{root}/src/lib/generated/county-names.json", "w"), ensure_ascii=False, separators=(",", ":"))
print(f"{level}: {len(names)} boundaries")
' "$level" "$root"
ls -la "$out"
