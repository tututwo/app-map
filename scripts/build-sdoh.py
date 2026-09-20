"""Build the community-context Shards: 2010 residents and the lab's social-determinant covariates per place.

Usage: uv run --with duckdb python scripts/build-sdoh.py <closing_covariate_full_data_08032024.xlsx> \
         <GEOID Population_Block Level_08.20.2026.parquet> <ZCTA Population_08.20.2026.parquet>

Residents come from Shelby Golden's decennial tables (lab OneDrive, "From Generate the Metrics"): census
blocks summed by GEOID prefix, which reproduces the 2010 census exactly (308,745,538) and covers every
Level, Alaska and Hawaii included. They are the denominator of the panel's rate; the per_10k columns in
the metric chunks are not used, their denominators being inflated upstream.

The workbook (lab OneDrive, "Church closing", Insang Song, August 2024) has one sheet per geography and
census year. Explore draws 2010 geography, so only state2010, county2010, tract2010 and zcta2010 are read;
there is no block-group sheet, and Alaska and Hawaii are not covered. Its "Variable availability" sheet
names the covariates the lab stands behind per geography (ZIPs lack the income, poverty, employment,
education, crowding and rent measures), and FIELDS follows it. Excel dropped the GEOIDs' leading zeros.
The older church_and_health_full_data CSV is the same table with a wrong p_unemp: do not use it.

  static/tiles/sdoh/<level>/<release>/<shard>.json.gz      {"09001": [916829, 81268, ...], ...}

A place's list follows the manifest's field order with trailing gaps cut, so a block group is `[1204]`.

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
    "pop2010": 0, "n_medincome": 0, "n_med_rent": 0, "p_poverty": 1, "p_unemp": 1, "p_edu_no_hs": 1,
    "p_renter": 1, "p_overcrowding": 1, "p_pct_65p": 1, "p_pct_black": 1, "p_pct_hisp": 1, "i_gini": 3,
    "r_commhlthcntr_100k": 1,
}
# level -> (covariate sheet or None, id length, id prefix length that names the Shard; 0 = one national Shard)
LEVELS = {
    "state": ("state2010", 2, 0), "county": ("county2010", 5, 0), "zcta": ("zcta2010", 5, 2),
    "tract": ("tract2010", 11, 2), "blockgroup": (None, 12, 2),
}
COVARIATES = [c for c in FIELDS if c != "pop2010"]


def main(workbook, blocks, zctas):
    con = duckdb.connect()
    con.sql("INSTALL excel; LOAD excel;")
    total = con.sql(f"SELECT sum(pop2010) FROM '{blocks}'").fetchone()[0]
    if total != 308_745_538:
        raise ValueError(f"Block populations sum to {total:,.0f}, not the 2010 census count")
    manifest = {"sources": [Path(f).name for f in (workbook, blocks, zctas)], "boundaryYear": 2010, "fields": list(FIELDS), "levels": {}}
    for level, (sheet, width, shard_len) in LEVELS.items():
        residents = dict(con.sql(
            f"SELECT zcta, pop2010 FROM '{zctas}' WHERE pop2010 IS NOT NULL" if level == "zcta" else
            f"SELECT substr(geoid, 1, {width}), sum(pop2010) FROM '{blocks}' WHERE pop2010 IS NOT NULL GROUP BY 1").fetchall())
        covariates = {}
        if sheet:
            select = ", ".join(f"round(TRY_CAST({c} AS DOUBLE), {FIELDS[c]}) AS {c}" for c in COVARIATES)
            rows = con.sql(f"SELECT lpad(GEOID, {width}, '0') AS id, {select} FROM read_xlsx('{workbook}', sheet = '{sheet}', all_varchar = true)").fetchall()
            covariates = {r[0]: r[1:] for r in rows}
            if len(covariates) != len(rows) or any(len(i) != width or not i.isdigit() for i in covariates):
                raise ValueError(f"{sheet}: ids must be unique and {width} digits")
        # Only places the map draws: the tables also hold Puerto Rico and water-only block groups.
        drawn = (ROOT / f"static/tiles/{level}-2010-geoids.txt").read_text().split() if level != "state" else sorted(i for i in residents if i != "72")
        if len(set(covariates) - set(drawn)) > len(covariates) // 100:
            raise ValueError(f"{sheet}: too many places without a boundary on the map")
        shards = {}
        for place in drawn:
            # Whole numbers stay whole, a missing or non-finite cell becomes null, trailing gaps are cut.
            cells = [residents.get(place), *covariates.get(place, ())]
            values = [None if v is None or v != v else int(v) if FIELDS[c] == 0 else v for c, v in zip(FIELDS, cells)]
            while values and values[-1] is None:
                values.pop()
            if values:
                shards.setdefault(place[:shard_len] if shard_len else "us", {})[place] = values
        raw = {name: json.dumps(places, separators=(",", ":")).encode() for name, places in sorted(shards.items())}
        release = hashlib.sha256(b"".join(name.encode() + body for name, body in raw.items())).hexdigest()[:12]
        shutil.rmtree(OUT / level, ignore_errors=True)  # generated output only; one release per level on disk
        (OUT / level / release).mkdir(parents=True)
        for name, body in raw.items():
            (OUT / level / release / f"{name}.json.gz").write_bytes(gzip.compress(body, 9, mtime=0))
        size = sum(f.stat().st_size for f in (OUT / level / release).iterdir())
        filled = {c: sum(len(v) > n and v[n] is not None for places in shards.values() for v in places.values()) for n, c in enumerate(FIELDS)}
        manifest["levels"][level] = {"release": release, "shards": sorted(shards), "places": sum(map(len, shards.values()))}
        print(f"{level}: {manifest['levels'][level]['places']} places, {len(shards)} files, {size / 1e6:.2f} MB gz, release {release}")
        print("   filled:", {c: n for c, n in filled.items() if n})
    MANIFEST.write_text(json.dumps(manifest, separators=(",", ":")) + "\n")


if __name__ == "__main__":
    main(*sys.argv[1:4])
