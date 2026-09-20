"""Build the community-context Shards: the lab's 2010 social-determinant covariates per place.

Usage: uv run --with duckdb python scripts/build-sdoh.py /path/to/closing_covariate_full_data_08032024.xlsx

The workbook (lab OneDrive, "Church closing", Insang Song, August 2024) has one sheet per geography and
census year. Explore draws 2010 geography, so only state2010, county2010, tract2010 and zcta2010 are read;
there is no block-group sheet, and Alaska and Hawaii are not covered. Its "Variable availability" sheet
names the covariates the lab stands behind per geography (ZIPs lack the income, poverty, employment,
education, crowding and rent measures), and FIELDS follows it. Excel dropped the GEOIDs' leading zeros.
The older church_and_health_full_data CSV is the same table with a wrong p_unemp: do not use it.

  static/tiles/sdoh/<level>/<release>/<shard>.json.gz      {"09001": [897661, 81268, ...], ...}

Field order, release and Shard list go to src/lib/generated/sdoh-manifest.json. Shards match the Metric
cube's: one national file for state and county, a state per tract file, two ZIP digits per ZIP file.
"""
import gzip
import hashlib
import json
import shutil
import sys
from pathlib import Path

import duckdb

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "static/tiles/sdoh"
MANIFEST = ROOT / "src/lib/generated/sdoh-manifest.json"
# column -> decimals kept. Shares are percentages, the Gini index runs 0-1.
FIELDS = {
    "n_pop_total": 0, "n_medincome": 0, "n_med_rent": 0, "p_poverty": 1, "p_unemp": 1, "p_edu_no_hs": 1,
    "p_renter": 1, "p_overcrowding": 1, "p_pct_65p": 1, "p_pct_black": 1, "p_pct_hisp": 1, "i_gini": 3,
    "r_commhlthcntr_100k": 1,
}
# level -> (sheet, id length, id prefix length that names the Shard; 0 = one national Shard)
LEVELS = {"state": ("state2010", 2, 0), "county": ("county2010", 5, 0), "zcta": ("zcta2010", 5, 2), "tract": ("tract2010", 11, 2)}


def main(workbook):
    con = duckdb.connect()
    con.sql("INSTALL excel; LOAD excel;")
    manifest = {"source": Path(workbook).name, "boundaryYear": 2010, "fields": list(FIELDS), "levels": {}}
    for level, (sheet, width, shard_len) in LEVELS.items():
        select = ", ".join(f"round(TRY_CAST({c} AS DOUBLE), {d}) AS {c}" for c, d in FIELDS.items())
        rows = con.sql(f"SELECT lpad(GEOID, {width}, '0') AS id, {select} FROM read_xlsx('{workbook}', sheet = '{sheet}', all_varchar = true) ORDER BY 1").fetchall()
        ids = [r[0] for r in rows]
        if len(set(ids)) != len(ids) or any(len(i) != width or not i.isdigit() for i in ids):
            raise ValueError(f"{sheet}: ids must be unique and {width} digits")
        drawn = ROOT / f"static/tiles/{level}-2010-geoids.txt"
        if drawn.exists():
            orphans = sorted(set(ids) - set(drawn.read_text().split()))
            if len(orphans) > len(ids) // 100:
                raise ValueError(f"{sheet}: {len(orphans)} places have no boundary on the map, e.g. {orphans[:5]}")
        shards = {}
        for row in rows:
            # Whole numbers stay whole, a missing or non-finite cell becomes null.
            values = [None if v is None or v != v else int(v) if FIELDS[c] == 0 else v for c, v in zip(FIELDS, row[1:])]
            if any(v is not None for v in values):
                shards.setdefault(row[0][:shard_len] if shard_len else "us", {})[row[0]] = values
        raw = {name: json.dumps(places, separators=(",", ":")).encode() for name, places in sorted(shards.items())}
        release = hashlib.sha256(b"".join(name.encode() + body for name, body in raw.items())).hexdigest()[:12]
        shutil.rmtree(OUT / level, ignore_errors=True)  # generated output only; one release per level on disk
        (OUT / level / release).mkdir(parents=True)
        for name, body in raw.items():
            (OUT / level / release / f"{name}.json.gz").write_bytes(gzip.compress(body, 9, mtime=0))
        size = sum(f.stat().st_size for f in (OUT / level / release).iterdir())
        filled = {c: sum(places[i][n] is not None for places in shards.values() for i in places) for n, c in enumerate(FIELDS)}
        manifest["levels"][level] = {"release": release, "shards": sorted(shards), "places": sum(map(len, shards.values()))}
        print(f"{level}: {manifest['levels'][level]['places']} places, {len(shards)} files, {size / 1e6:.2f} MB gz, release {release}")
        print("   filled:", {c: n for c, n in filled.items()})
    MANIFEST.write_text(json.dumps(manifest, separators=(",", ":")) + "\n")


if __name__ == "__main__":
    main(sys.argv[1])
