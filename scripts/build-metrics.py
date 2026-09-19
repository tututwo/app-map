"""Build the Metric cube: reported closures for every published Year Window, per Level, as typed-array Shards.

Usage: uv run --with duckdb --with numpy python scripts/build-metrics.py <chunk dir> [--gpkg <dir>] [level ...]

<chunk dir> holds the lab's "All Metric Results" chunks renamed <prefix>__chunk_NNNN.parquet, where prefix is
state, county, tract, block_group or zcta. Offline tool: DuckDB and numpy are not app dependencies.

A Year Window is a lookup key, never a computation: closures are evaluated inside each window upstream, so
yearly values cannot be added up. One Shard file holds every window, which makes switching windows free:

  static/tiles/metrics/<level>/<release>/<shard>/geoids.json.gz      ["01", "02", ...] row order
  static/tiles/metrics/<level>/<release>/<shard>/<religion>.bin.gz   rows x windows, row-major, u8 or u16 LE

Window order, religions, dtype and shard list go to src/lib/generated/metrics-manifest.json.
A level is also checked against the boundaries the map draws, static/tiles/<level>-2010-geoids.txt, which
scripts/build-census-tiles.sh writes for county, tract and zcta; --gpkg <dir> (the directory given to
scripts/build-tiles.sh) writes the block-group list from the lab GeoPackages when it is missing.
"""
import gzip
import hashlib
import json
import re
import shutil
import sys
from pathlib import Path

import duckdb
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "static/tiles/metrics"
MANIFEST = ROOT / "src/lib/generated/metrics-manifest.json"
METRIC = "closures_no_moves_any"
VINTAGE = 2010
MISSING = 65535  # in-memory "no observation"; files use the dtype's own maximum
# level -> (chunk prefix, id column, id prefix length that names the Shard; 0 = one national Shard).
# Tracts and block groups shard by state, ZIPs by their first two digits (98 compact regions).
LEVELS = {
    "state": ("state", "geoid", 0),
    "county": ("county", "geoid", 0),
    "zcta": ("zcta", "zcta", 2),
    "tract": ("tract", "geoid", 2),
    "blockgroup": ("block_group", "geoid", 2),
}


def read_level(con, files, id_col):
    """Keyed merge of the chunks: each holds a few windows, two windows appear twice, row sets differ."""
    names = ", ".join(f"'{f}'" for f in files)
    ids = np.array([r[0] for r in con.sql(f"SELECT DISTINCT {id_col} FROM read_parquet([{names}], union_by_name = true) WHERE year = {VINTAGE} ORDER BY 1").fetchall()])
    religions = [r[0] for r in con.sql(f"SELECT DISTINCT religion FROM read_parquet([{names}], union_by_name = true) ORDER BY 1").fetchall()]
    per_file = []
    for f in files:
        columns = [r[0] for r in con.sql(f"DESCRIBE SELECT * FROM '{f}'").fetchall()]
        per_file.append(sorted(tuple(map(int, m.groups())) for c in columns if (m := re.fullmatch(rf"{METRIC}__(\d{{4}})_(\d{{4}})", c))))
    windows = sorted({w for ws in per_file for w in ws})
    first, last = windows[0][0], max(w[1] for w in windows)
    span = min(w[1] - w[0] for w in windows)
    expected = [(a, b) for a in range(first, last + 1) for b in range(a + span, last + 1)]
    if windows != expected:
        raise ValueError(f"Window list has gaps: {len(windows)} found, {len(expected)} expected for {first}-{last} with to-from >= {span}")
    column = {w: i for i, w in enumerate(windows)}
    cube = {religion: np.full((len(ids), len(windows)), MISSING, np.uint16) for religion in religions}
    for f, ws in zip(files, per_file):
        select = ", ".join(f"coalesce({METRIC}__{a}_{b}, -1)::DOUBLE AS w{a}_{b}" for a, b in ws)
        data = con.sql(f"SELECT religion, {id_col} AS id, {select} FROM '{f}' WHERE year = {VINTAGE}").fetchnumpy()
        rows = np.searchsorted(ids, data["id"])
        for religion, matrix in cube.items():
            mask = data["religion"] == religion
            for a, b in ws:
                values = data[f"w{a}_{b}"][mask]
                if (values != np.floor(values)).any() or values.max(initial=0) >= MISSING:
                    raise ValueError(f"{f.name} {religion} {a}_{b}: counts must be whole numbers below {MISSING}")
                new = np.where(values < 0, MISSING, values).astype(np.uint16)
                old = matrix[rows[mask], column[(a, b)]]
                if ((old != MISSING) & (new != MISSING) & (old != new)).any():
                    raise ValueError(f"{f.name} {religion} {a}_{b}: chunks disagree on a populated value")
                matrix[rows[mask], column[(a, b)]] = np.where(new != MISSING, new, old)
    return ids, windows, religions, cube


def sums_by_state(ids, matrix, states):
    """Counts summed by state prefix, no observation as 0: shape (states, windows)."""
    index = np.searchsorted(states, np.array([i[:2] for i in ids]))
    out = np.zeros((len(states), matrix.shape[1]), np.int64)
    np.add.at(out, index, np.where(matrix == MISSING, 0, matrix))
    return out


def main(argv):
    gpkg_dir = argv.pop(argv.index("--gpkg") + 1) if "--gpkg" in argv else None
    argv = [a for a in argv if a != "--gpkg"]
    chunk_dir, levels = Path(argv[0]).expanduser(), argv[1:] or list(LEVELS)
    con = duckdb.connect()
    manifest = json.loads(MANIFEST.read_text()) if MANIFEST.exists() else {"levels": {}}
    state = None
    drawn = ROOT / f"static/tiles/blockgroup-{VINTAGE}-geoids.txt"
    if gpkg_dir and not drawn.exists():
        con.sql("INSTALL spatial; LOAD spatial;")
        gpkgs = sorted(Path(gpkg_dir).expanduser().glob("bg_statefp_*_2000_2010_2020.gpkg"))
        rows = con.sql(" UNION ALL ".join(f"SELECT geoid FROM ST_Read('{g}', layer = 'bg_{VINTAGE}') WHERE blkgrpce <> '0'" for g in gpkgs)).fetchall()
        drawn.write_text("\n".join(sorted(r[0] for r in rows)) + "\n")

    for level in dict.fromkeys(["state", *levels]):  # state first: every other level is checked against it
        prefix, id_col, shard_len = LEVELS[level]
        files = sorted(chunk_dir.glob(f"{prefix}__chunk_*.parquet"))
        if not files:
            raise ValueError(f"No {prefix}__chunk_*.parquet in {chunk_dir}")
        ids, windows, religions, cube = read_level(con, files, id_col)
        if level == "state":
            state = (ids, windows, religions, cube)
            if level not in levels:
                continue
        if (windows, religions) != (state[1], state[2]):
            raise ValueError(f"{level}: windows or religions differ from the state level")

        # Consistency, not validation: every level comes from the same upstream run.
        if id_col == "geoid" and level != "state":
            for religion in religions:
                if not (sums_by_state(ids, cube[religion], state[0]) == np.where(state[3][religion] == MISSING, 0, state[3][religion])).all():
                    raise ValueError(f"{level} {religion}: counts summed by state differ from the state level")
        drawn = ROOT / f"static/tiles/{level}-{VINTAGE}-geoids.txt"
        if drawn.exists():
            orphans = sorted(set(ids) - set(drawn.read_text().split()))
            if orphans:
                raise ValueError(f"{level}: {len(orphans)} places have counts but no boundary on the map, e.g. {orphans[:5]}")
        elif level != "state":
            print(f"{level}: no {drawn.name}, so counts were not checked against the map's boundaries")

        peak = max(int(np.where(m == MISSING, 0, m).max()) for m in cube.values())
        dtype = "u8" if peak < 255 else "u16"
        keys = np.array([i[:shard_len] if shard_len else "us" for i in ids])
        outputs, digest = {}, hashlib.sha256()
        for shard in sorted(set(keys)):
            rows = keys == shard
            outputs[f"{shard}/geoids.json.gz"] = json.dumps(ids[rows].tolist(), separators=(",", ":")).encode()
            for religion in religions:
                part = cube[religion][rows]
                outputs[f"{shard}/{religion}.bin.gz"] = (np.where(part == MISSING, 255, part).astype(np.uint8) if dtype == "u8" else part.astype("<u2")).tobytes()
        for name, raw in outputs.items():
            digest.update(name.encode() + raw)
        release = digest.hexdigest()[:12]
        shutil.rmtree(OUT / level, ignore_errors=True)  # generated output only; one release per level on disk
        size = 0
        for name, raw in outputs.items():
            path = OUT / level / release / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(gzip.compress(raw, 9, mtime=0))
            size += path.stat().st_size
        manifest["levels"][level] = {"release": release, "dtype": dtype, "shards": sorted(set(keys)), "places": len(ids), "max": peak}
        manifest.update(metric=METRIC, boundaryYear=VINTAGE, windows=windows, religions=religions)
        print(f"{level}: {len(ids)} places x {len(windows)} windows x {len(religions)} religions, {dtype}, max {peak}, {len(outputs)} files, {size / 1e6:.1f} MB gz, release {release}")

    MANIFEST.write_text(json.dumps(manifest, separators=(",", ":")) + "\n")


if __name__ == "__main__":
    main(sys.argv[1:])
