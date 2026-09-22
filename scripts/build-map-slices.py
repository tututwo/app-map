#!/usr/bin/env python3
"""Derive national map slices from the released Metric cube, without changing its values.

    python3 scripts/build-map-slices.py [tract zcta blockgroup]

map/<level>/<release>/geoids.json.gz is the national row order. Each <religion>/<window>.bin.gz
holds one count per row, in the manifest's dtype and little-endian byte order, including its
no-observation sentinel. Every written slice is read back to reconstruct its source matrix.
"""

from array import array
import argparse
import gzip
import json
from pathlib import Path
import tempfile

ROOT = Path(__file__).resolve().parent.parent
manifest = json.loads((ROOT / "src/lib/generated/metrics-manifest.json").read_text())
windows = len(manifest["windows"])
GEOID_LENGTH = {"tract": 11, "zcta": 5, "blockgroup": 12}
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("levels", nargs="*", choices=GEOID_LENGTH, default=list(GEOID_LENGTH))
levels = parser.parse_args().levels

for level in levels:
    info = manifest["levels"][level]
    width, code = {"u8": (1, "B"), "u16": (2, "H")}[info["dtype"]]
    assert windows and array(code).itemsize == width
    source = ROOT / "static/tiles/metrics" / level / info["release"]
    target = ROOT / "static/tiles/map" / level / info["release"]

    geoids = []
    shards = []
    for shard in info["shards"]:
        folder = source / shard
        ids = json.loads(gzip.decompress((folder / "geoids.json.gz").read_bytes()))
        if not isinstance(ids, list) or any(
            not isinstance(geoid, str) or len(geoid) != GEOID_LENGTH[level] or not geoid.isascii()
            or not geoid.isdigit() or not geoid.startswith(shard) for geoid in ids
        ):
            raise ValueError(f"Invalid {level} GEOIDs in {folder}")
        geoids.extend(ids)
        shards.append((folder, len(ids)))
    if len(geoids) != info["places"] or geoids != sorted(set(geoids)):
        raise ValueError(f"{level} GEOIDs must be sorted, unique and match the manifest's place count")

    target.parent.mkdir(parents=True, exist_ok=True)
    # Finish and verify every slice before replacing any previously built files.
    with tempfile.TemporaryDirectory(prefix=".map-slices-", dir=target.parent) as temporary:
        staging = Path(temporary)
        index = gzip.compress(json.dumps(geoids, separators=(",", ":")).encode(), mtime=0)
        (staging / "geoids.json.gz").write_bytes(index)
        total = len(index)
        for religion in manifest["religions"]:
            parts = []
            for folder, rows in shards:
                path = folder / f"{religion}.bin.gz"
                data = gzip.decompress(path.read_bytes())
                if len(data) != rows * windows * width:
                    raise ValueError(f"Invalid matrix byte length: {path}")
                parts.append(data)
            original = b"".join(parts)
            matrix = array(code)
            matrix.frombytes(original)
            restored = bytearray(len(original))
            sizes = []
            folder = staging / religion
            folder.mkdir()
            for window in range(windows):
                # Slicing native-width words preserves the source bytes even on a big-endian host.
                path = folder / f"{window}.bin.gz"
                packed = gzip.compress(matrix[window::windows].tobytes(), mtime=0)
                path.write_bytes(packed)
                sizes.append(len(packed))
                actual = gzip.decompress(path.read_bytes())
                assert len(actual) == len(geoids) * width, path
                for byte in range(width):
                    restored[window * width + byte::windows * width] = actual[byte::width]
            # Exact round trip of all cells checks zero, sentinel and extreme values without special cases.
            assert restored == original, religion
            total += sum(sizes)
            print(f"{level}/{religion}: {windows} slices, {min(sizes):,}–{max(sizes):,} bytes each, {sum(sizes):,} bytes total", flush=True)

        for path in staging.rglob("*.gz"):
            destination = target / path.relative_to(staging)
            destination.parent.mkdir(parents=True, exist_ok=True)
            path.replace(destination)
    print(f"{level}: {len(geoids):,} places; {len(index):,}-byte index; {total:,} compressed bytes; all slices verified", flush=True)
