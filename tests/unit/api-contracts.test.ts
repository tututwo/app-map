import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("$app/server", () => ({
  read(asset: string) {
    const pathname = decodeURIComponent(new URL(asset, "http://localhost").pathname);
    const filePath = pathname.startsWith("/@fs/")
      ? pathname.slice("/@fs".length)
      : resolve(process.cwd(), pathname.replace(/^\//, ""));
    return new Response(readFileSync(filePath));
  },
}));

import {
  readLineSeries,
  readSideMetric,
  readStackedSeries,
} from "../../src/lib/server/data/by-geoid";
import { readMapRange } from "../../src/lib/server/data/map-data";

/**
 * Byte-level contracts on the generated datasets that the remote functions
 * (src/lib/dashboard/data.remote.ts) serve verbatim. The pinned bytes and
 * hashes are unchanged from the retired HTTP endpoints, which returned these
 * exact JSON serializations.
 */

function contract(text: string) {
  const body = JSON.parse(text) as unknown;
  const rows = Array.isArray(body) ? body : [];

  return {
    bytes: Buffer.byteLength(text),
    sha256: createHash("sha256").update(text).digest("hex"),
    rows: rows.length,
    first: rows.at(0),
    last: rows.at(-1),
  };
}

describe("map ranges", () => {
  it("returns the full ordered 2003–2011 dataset byte-for-byte", async () => {
    const text = await readMapRange("2003-2011");

    expect(text).toBeDefined();
    expect(contract(text!)).toEqual({
      bytes: 405193,
      sha256: "3b9d5e9f0d2617547d4aaec5fd351fc8102cd9c64c471d04d4d38f8b8ad16513",
      rows: 3229,
      first: {
        geoid: "01001",
        name: "Autauga County, AL",
        closure: 3,
        closure_rate_per_10000: 0,
        persistence: 4,
        reopening: 0,
      },
      last: {
        geoid: "00000",
        name: "US, United States",
        closure: 0.403393158,
        closure_rate_per_10000: 0.265811726,
        persistence: 0.526358164,
        reopening: 0.549317021,
      },
    });
  });

  it("has no file for a window below the generated minimum gap", async () => {
    expect(await readMapRange("2002-2006")).toBeUndefined();
    expect(await readMapRange("2001-2005")).toBeUndefined();
  });
});

describe("line series", () => {
  it("provides the national aggregate under the sentinel geoid", async () => {
    const { bytes, sha256, rows } = contract(JSON.stringify(await readLineSeries("00000")));

    expect({ bytes, sha256, rows }).toEqual({
      bytes: 610,
      sha256: "bd987bebcbfe07017393054ee15e1083b5164ec30ac4c02d1a42620ab4fbf0cd",
      rows: 21,
    });
  });

  it("returns the ordered series for geoid 01001", async () => {
    const { bytes, sha256, rows } = contract(JSON.stringify(await readLineSeries("01001")));

    expect({ bytes, sha256, rows }).toEqual({
      bytes: 527,
      sha256: "7675638db59fda41f777d53bb66484c4e417416dd7c4aebe88721d1a29bbb207",
      rows: 21,
    });
  });

  it("returns undefined for an unknown geoid", async () => {
    expect(await readLineSeries("99999")).toBeUndefined();
  });

  it("enumerates every geoid including the national sentinel", async () => {
    const keys = await readLineSeries.keys();

    expect(keys.length).toBeGreaterThan(3000);
    expect(keys).toContain("00000");
    expect(keys).toContain("09110");
  });
});

describe("stacked series", () => {
  it("provides the national aggregate under the sentinel geoid", async () => {
    const { bytes, sha256, rows } = contract(JSON.stringify(await readStackedSeries("00000")));

    expect({ bytes, sha256, rows }).toEqual({
      bytes: 1453,
      sha256: "fa9d7e2005765fc85c97582bc0538c4d8f9a9ce4551c54ff2a82c8b25dee9037",
      rows: 22,
    });
  });

  it("returns the ordered series for geoid 01001", async () => {
    const { bytes, sha256, rows } = contract(JSON.stringify(await readStackedSeries("01001")));

    expect({ bytes, sha256, rows }).toEqual({
      bytes: 1215,
      sha256: "2a8b76e0c16931f9e337fb9e93b652c2aec1dfadb5749b5d8ea5f76124322cad",
      rows: 22,
    });
  });

  it("returns undefined for an unknown geoid", async () => {
    expect(await readStackedSeries("99999")).toBeUndefined();
  });
});

describe("side metrics", () => {
  it("publishes no national row — the remote function supplies the sentinel", async () => {
    expect(await readSideMetric("00000")).toBeUndefined();
    expect((await readSideMetric.keys()).includes("00000")).toBe(false);
  });

  it("returns the county row for geoid 01001", async () => {
    const metric = await readSideMetric("01001");

    expect(metric).toBeDefined();
    expect(metric!.geoid).toBe("01001");
  });

  it("returns undefined for an unknown geoid", async () => {
    expect(await readSideMetric("99999")).toBeUndefined();
  });
});
