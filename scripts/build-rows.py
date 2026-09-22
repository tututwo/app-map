#!/usr/bin/env python3
"""Write rows.bin beside every Shard of the Metric cube: the same counts, stored one place at a time.

    python3 scripts/build-rows.py          after scripts/build-metrics.py, before scripts/publish-metrics.sh

A Shard's ten <religion>.bin.gz files are what the map paints from. The panel needs ONE place, and reading
it from those files means fetching all ten (California's block groups: 877 KB; a shared county link put
3 MB of them into its HTML). rows.bin answers with two small ranged reads instead:

    (places + 1) little-endian uint32 offsets, then each place's counts, raw-deflated:
    religions (manifest order) x Year Windows, in the Level's dtype.

Row order is geoids.json's. The file sits outside the release hash: it is derived from the release's own
files, so the same release always gives the same counts.
"""

import gzip
import json
import zlib
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "static/tiles/metrics"
manifest = json.loads((ROOT / "src/lib/generated/metrics-manifest.json").read_text())
WINDOWS, RELIGIONS = len(manifest["windows"]), manifest["religions"]


def deflated(raw: bytes) -> bytes:
    packer = zlib.compressobj(9, zlib.DEFLATED, -15)  # raw deflate: DecompressionStream("deflate-raw")
    return packer.compress(raw) + packer.flush()


for level, info in manifest["levels"].items():
    dtype = np.dtype("u1" if info["dtype"] == "u8" else "<u2")
    size = 0
    for shard in info["shards"]:
        folder = OUT / level / info["release"] / shard
        places = len(json.loads(gzip.decompress((folder / "geoids.json.gz").read_bytes())))
        # places x religions x windows
        cube = np.stack(
            [np.frombuffer(gzip.decompress((folder / f"{religion}.bin.gz").read_bytes()), dtype).reshape(places, WINDOWS) for religion in RELIGIONS],
            axis=1,
        )
        rows = [deflated(cube[place].tobytes()) for place in range(places)]
        offsets = np.cumsum([0, *map(len, rows)])
        assert offsets[-1] < 2**32, (level, shard)
        packed = offsets.astype("<u4").tobytes() + b"".join(rows)
        (folder / "rows.bin").write_bytes(packed)
        size += len(packed)

        # Read the last place back the way the site does.
        start, end = np.frombuffer(packed, "<u4", 2, 4 * (places - 1))
        data = 4 * (places + 1)
        again = np.frombuffer(zlib.decompress(packed[data + start : data + end], -15), dtype)
        assert (again.reshape(len(RELIGIONS), WINDOWS) == cube[-1]).all(), (level, shard)
    print(f"{level}: {info['places']} places in {len(info['shards'])} rows.bin files, {size / 1e6:.1f} MB")
