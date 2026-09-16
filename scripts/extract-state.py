"""Extract the inspected combined state deliverable. Requires offline DuckDB, not an app dependency.

Usage: python scripts/extract-state.py /path/to/state_combined.parquet
"""
import csv
import hashlib
import json
import sys
from pathlib import Path

import duckdb

ROOT = Path(__file__).resolve().parent.parent
WINDOWS = ["2000_2006", "2007_2024", "2010_2015"]
VINTAGE = 2010


def main(path):
    source = Path(path)
    sha = hashlib.sha256(source.read_bytes()).hexdigest()
    connection = duckdb.connect()
    table = connection.read_parquet(str(source))
    table.create_view("source")
    if connection.sql("SELECT count(*) FROM (SELECT geoid, year, religion FROM source GROUP BY ALL HAVING count(*) > 1)").fetchone()[0]:
        raise ValueError("Duplicate source keys; this extractor expects the combined deliverable, not stacked chunks")
    rows = []
    for window in WINDOWS:
        rows.extend(connection.sql(f"""
            SELECT geoid, year, '{window}', religion,
                   closures_no_moves_any__{window}, closures_no_moves_per_10k__{window}, n_open__{window}
            FROM source WHERE year = {VINTAGE} AND religion = 'all_religions' ORDER BY geoid
        """).fetchall())
    if len(rows) != 153 or len({row[0] for row in rows}) != 51:
        raise ValueError("Expected the inspected 51 states/DC and three windows; review new source coverage before publishing")
    with (ROOT / "data-raw/state_metrics.csv").open("w", newline="") as output:
        writer = csv.writer(output, lineterminator="\n")
        writer.writerow(["geoid", "boundaryYear", "window", "religion", "closed", "per10k", "nOpen"])
        writer.writerows(rows)
    alabama = [row for row in rows if row[0] == "01"]
    release = {
        "release": f"state-preview-{sha[:12]}-{VINTAGE}",
        "boundaryYear": VINTAGE,
        "vintageNote": "All windows use the source's 2010 census reference, selected explicitly for comparison; this is not inferred from window start.",
        "metric": "closed",
        "metricLabel": "Reported closures",
        "unit": "places of worship",
        "breaks": [500, 1500, 5000, 15000],
        "withheldMetrics": ["per10k", "nOpen"],
        "source": {
            "file": source.name,
            "sha256": sha,
            "location": "SOCAH LAB / Church closing / Church-Closures-Dashboard GitHub LOCAL ONLY Files / Data / Results / KEEP LOCAL / From Generate the Metrics / PART D Confirm Deliverables",
            "rows": table.shape[0],
            "columns": len(table.columns),
            "inspectedOn": "2026-09-16",
            "methodReference": "https://github.com/SOCAH-Lab/Church-Closures-Dashboard/blob/194e893fa98562e6f8607e8cf335b3faddee433d/Code/Generate%20the%20Metrics_2026%20Format.R",
            "releaseCommitVerified": False,
        },
        "geometry": {
            "asset": "src/data/counties-10m.json",
            "object": "states",
            "boundaryYear": 2017,
            "source": "https://cdn.jsdelivr.net/npm/us-atlas@3/counties-10m.json",
            "note": "Generalized 2017 Census state display boundaries, joined by state GEOID; not an exact match to the 2010 source reference vintage.",
        },
        "coverage": "50 states and District of Columbia; territories have no observations in this deliverable.",
        "validation": {
            "status": "preliminary",
            "closed": "Source-reported no_moves counts; distinct business counts have not been independently verified against ABI records.",
            "per10k": "Withheld: the population implied by count/rate changes with window and religion for the same state and census reference.",
            "nOpen": "Withheld: upstream aggregation repeats geography-wide activity counts on business rows; distinct active counts require source validation.",
            "alabama2010ImpliedPopulations": [
                {"window": row[2], "closed": row[4], "reportedPer10k": row[5], "impliedPopulation": row[4] * 10000 / row[5], "reportedNOpen": row[6]}
                for row in alabama
            ],
        },
        "dataNotes": [
            "Preliminary source-reported closures exclude businesses with multiple addresses in the observation window.",
            "Population rates and active counts are withheld pending source validation; no national comparison is calculated.",
            "Counts depend on the observation window and must not be added across overlapping windows.",
        ],
    }
    (ROOT / "data-raw/state-release.json").write_text(json.dumps(release, indent=2) + "\n")
    print(f"Extracted {len(rows)} rows from {source.name}; SHA-256 {sha}")


if __name__ == "__main__":
    main(sys.argv[1])
