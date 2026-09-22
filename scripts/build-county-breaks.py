#!/usr/bin/env python3
"""Write src/lib/generated/county-breaks.json: the county legend's classes for every Type and Year Window.

    python3 scripts/build-county-breaks.py      after scripts/build-metrics.py

The legend's breaks are quintiles of the counties' counts (breaksFor in src/lib/explore/model.ts) and depend
on nothing but the release, so they are worked out here once. The page used to fetch the counties' whole
matrix for them, and a shared county link carried 823 KB of it, base64, inside its HTML.
"""

import gzip
import json
import math
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
manifest = json.loads((ROOT / "src/lib/generated/metrics-manifest.json").read_text())
county = manifest["levels"]["county"]
folder = ROOT / "static/tiles/metrics/county" / county["release"] / "us"
WINDOWS = len(manifest["windows"])
MISSING = 255 if county["dtype"] == "u8" else 65535
dtype = np.dtype("u1" if county["dtype"] == "u8" else "<u2")


def nice(value: int) -> int:
    """Two significant digits. floor(x + 0.5) is Math.round for a positive number; round() is not."""
    unit = 10 ** max(0, math.floor(math.log10(value)) - 1)
    return math.floor(value / unit + 0.5) * unit


def breaks_for(values) -> list[int]:
    """breaksFor in src/lib/explore/model.ts, to the letter: zero and No observation are left out."""
    counts = sorted(int(v) for v in values if v and v != MISSING)
    breaks = []
    for q in (0.2, 0.4, 0.6, 0.8):
        i = math.floor(q * len(counts))
        b = nice(counts[i]) if i < len(counts) else 0
        if b > 0 and b not in breaks:
            breaks.append(b)
    return breaks


places = len(json.loads(gzip.decompress((folder / "geoids.json.gz").read_bytes())))
breaks = {}
for religion in manifest["religions"]:
    matrix = np.frombuffer(gzip.decompress((folder / f"{religion}.bin.gz").read_bytes()), dtype).reshape(places, WINDOWS)
    breaks[religion] = [breaks_for(matrix[:, window]) for window in range(WINDOWS)]

out = ROOT / "src/lib/generated/county-breaks.json"
out.write_text(json.dumps({"release": county["release"], "breaks": breaks}, separators=(",", ":")) + "\n")
print(f"{out.relative_to(ROOT)}: {len(breaks)} types x {WINDOWS} windows, {out.stat().st_size / 1024:.0f} KB, release {county['release']}")
