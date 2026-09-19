"""Extract block-group closure counts from the combined deliverable. Requires offline DuckDB, not an app dependency.

Usage: uv run --with duckdb python scripts/extract-blockgroup.py /path/to/block_group_combined.parquet <gpkg dir>

<gpkg dir> is the directory given to scripts/build-tiles.sh. Its bg_statefp_XX_2000_2010_2020.gpkg files
decide which states are extracted, so metrics and tiles always cover the same states.
"""
import csv
import hashlib
import json
import re
import sys
from pathlib import Path

import duckdb

ROOT = Path(__file__).resolve().parent.parent
WINDOWS = ["2000_2006", "2007_2024", "2010_2015"]
VINTAGE = 2010


def main(parquet, gpkg_dir):
    source = Path(parquet)
    gpkgs = sorted(Path(gpkg_dir).expanduser().glob("bg_statefp_*_2000_2010_2020.gpkg"))
    states = [re.search(r"bg_statefp_(\d{2})_", gpkg.name).group(1) for gpkg in gpkgs]
    if not states:
        raise ValueError(f"No bg_statefp_XX_2000_2010_2020.gpkg in {gpkg_dir}")
    sha = hashlib.sha256(source.read_bytes()).hexdigest()
    connection = duckdb.connect()
    connection.sql("INSTALL spatial; LOAD spatial;")
    table = connection.read_parquet(str(source))
    table.create_view("source")
    if connection.sql("SELECT count(*) FROM (SELECT geoid, year, religion FROM source GROUP BY ALL HAVING count(*) > 1)").fetchone()[0]:
        raise ValueError("Duplicate source keys; this extractor expects the combined deliverable, not stacked chunks")
    connection.sql(f"""
        CREATE VIEW slice AS SELECT geoid, {", ".join(f'closures_no_moves_any__{w} AS "{w}"' for w in WINDOWS)}
        FROM source WHERE year = {VINTAGE} AND religion = 'all_religions' AND substr(geoid, 1, 2) IN ({", ".join(f"'{s}'" for s in states)})
    """)
    connection.sql(" UNION ALL ".join(f"SELECT geoid FROM ST_Read('{gpkg}', layer = 'bg_{VINTAGE}')" for gpkg in gpkgs)).create_view("geometry")
    orphans = connection.sql("SELECT geoid FROM slice ANTI JOIN geometry USING (geoid) ORDER BY geoid").fetchall()
    if orphans:
        raise ValueError(f"{len(orphans)} block groups have metrics but no boundary, e.g. {orphans[0][0]}")

    # Consistency check only: both deliverables come from the same upstream run, so agreement says the
    # block-group file is complete for these states, not that either count is correct.
    with (ROOT / "data-raw/state_metrics.csv").open() as handle:
        state_counts = {(row["geoid"], row["window"]): int(row["closed"]) for row in csv.DictReader(handle) if row["closed"]}
    for window in WINDOWS:
        for state, total in connection.sql(f'SELECT substr(geoid, 1, 2), sum("{window}") FROM slice GROUP BY 1').fetchall():
            if state_counts.get((state, window)) != total:
                raise ValueError(f"State {state} {window}: block groups sum to {total}, state deliverable has {state_counts.get((state, window))}")

    rows = connection.sql("SELECT * FROM slice ORDER BY geoid").fetchall()
    with (ROOT / "data-raw/blockgroup_metrics.csv").open("w", newline="") as output:
        writer = csv.writer(output, lineterminator="\n")
        writer.writerow(["geoid", *WINDOWS])
        writer.writerows(rows)
    release = {
        "release": f"blockgroup-preview-{sha[:12]}-{VINTAGE}",
        "boundaryYear": VINTAGE,
        "metric": "closed",
        "metricLabel": "Reported closures",
        "unit": "places of worship",
        "breaks": [1, 2, 4, 8],
        "states": states,
        "source": {
            "file": source.name,
            "sha256": sha,
            "location": "SOCAH LAB / Church closing / Church-Closures-Dashboard GitHub LOCAL ONLY Files / Data / Results / KEEP LOCAL / From Generate the Metrics / PART D Confirm Deliverables",
            "rows": table.shape[0],
            "columns": len(table.columns),
        },
        "geometry": {
            "archive": f"bg-{VINTAGE}.pmtiles",
            "sourceLayer": "blockgroups",
            "revealZoom": 8,
            "boundaryYear": VINTAGE,
            "source": f"Lab TIGER/Line GeoPackages bg_statefp_XX_2000_2010_2020.gpkg, layer bg_{VINTAGE}; water-only block groups dropped.",
        },
        "validation": {
            "status": "preliminary",
            "closed": "Source-reported no_moves counts; distinct business counts have not been independently verified against ABI records.",
            "consistency": "Block-group counts summed by state equal the state deliverable for every extracted state and window. Both files come from the same upstream run, so this is a completeness check, not validation.",
            "withheld": "Population and area rates and active counts are not extracted: their implied denominators change with the window for the same block group.",
        },
    }
    (ROOT / "data-raw/blockgroup-release.json").write_text(json.dumps(release, indent=2) + "\n")
    print(f"Extracted {len(rows)} block groups in {len(states)} state(s) from {source.name}; SHA-256 {sha}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
