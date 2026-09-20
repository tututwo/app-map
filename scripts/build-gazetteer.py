#!/usr/bin/env python3
"""Build the Gazetteer the Explore search reads (ADR-0003): a point inside every city, county and ZIP.

Source: the Census Bureau's 2010 Gazetteer files, the same vintage as the map's boundaries,
https://www2.census.gov/geo/docs/maps-data/data/gazetteer/Gaz_{places,counties,zcta}_national.zip

    python3 scripts/build-gazetteer.py ~/Downloads/census-2010/gazetteer

Writes static/gazetteer/names.json (counties and cities, most residents first, so the first matches are
the likely ones; plus a point for every state) and static/gazetteer/zips.json. A state's point is the
internal point of its most populous county: "Texas, by tract" then opens on Houston, not on ranchland.
"""

import io
import json
import re
import sys
import zipfile
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "static" / "gazetteer"
# The Census names a place with its legal kind at the end: "New Haven city", "Abanda CDP".
KIND = re.compile(r"((?:\s+(?:[a-z]+|CDP|\(balance\)))+)$")
NOUNS = {"city": "City", "town": "Town", "village": "Village", "borough": "Borough", "CDP": "Community"}


def rows(folder: Path, name: str):
    with zipfile.ZipFile(folder / f"{name}.zip") as archive:
        lines = io.TextIOWrapper(archive.open(f"{name}.txt"), encoding="latin-1").read().splitlines()
    head = [column.strip() for column in lines[0].split("\t")]
    for line in lines[1:]:
        yield dict(zip(head, (cell.strip() for cell in line.split("\t"))))


def point(row):
    return [round(float(row["INTPTLONG"]), 4), round(float(row["INTPTLAT"]), 4)]


def main(folder: Path):
    names, states = [], {}
    for row in rows(folder, "Gaz_counties_national"):
        residents = int(row["POP10"])
        names.append((residents, [f'{row["NAME"]}, {row["USPS"]}', "County", row["GEOID"], *point(row)]))
        if residents > states.get(row["GEOID"][:2], (-1,))[0]:
            states[row["GEOID"][:2]] = (residents, point(row))
    for row in rows(folder, "Gaz_places_national"):
        kind = KIND.search(row["NAME"])
        label = row["NAME"][: kind.start()] if kind else row["NAME"]
        noun = NOUNS.get(kind.group(1).strip() if kind else "", "Place")
        names.append((int(row["POP10"]), [f'{label}, {row["USPS"]}', noun, "", *point(row)]))
    names.sort(key=lambda entry: (-entry[0], entry[1][0]))
    zips = {row["GEOID"]: point(row) for row in rows(folder, "Gaz_zcta_national")}

    # The search depends on these: every state has a point, and the big names resolve where expected.
    assert len(states) == 52 and len(zips) > 33_000 and len(names) > 32_000, (len(states), len(zips))
    assert names[0][1][0] == "Los Angeles County, CA" and zips["06511"] == [-72.9273, 41.317]
    assert next(row for _, row in names if row[0] == "Houston, TX")[1] == "City"

    OUT.mkdir(parents=True, exist_ok=True)
    compact = {"separators": (",", ":"), "ensure_ascii": False}
    (OUT / "names.json").write_text(
        json.dumps({"states": {k: v[1] for k, v in sorted(states.items())}, "rows": [r for _, r in names]}, **compact)
    )
    (OUT / "zips.json").write_text(json.dumps(zips, **compact))
    for file in sorted(OUT.iterdir()):
        print(f"{file.relative_to(OUT.parent.parent)}  {file.stat().st_size / 1024:.0f} KB")


if __name__ == "__main__":
    main(Path(sys.argv[1] if len(sys.argv) > 1 else "~/Downloads/census-2010/gazetteer").expanduser())
