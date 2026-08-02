import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { RequestHandler } from "@sveltejs/kit";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("$app/server", () => ({
  read(asset: string) {
    const pathname = decodeURIComponent(new URL(asset, origin).pathname);
    const filePath = pathname.startsWith("/@fs/")
      ? pathname.slice("/@fs".length)
      : resolve(process.cwd(), pathname.replace(/^\//, ""));
    return new Response(readFileSync(filePath));
  },
}));

import { GET as getLineChartData } from "../../src/routes/api/line_chart_data/+server";
import { GET as getMapData } from "../../src/routes/api/map_data/+server";
import { GET as getSideMetricData } from "../../src/routes/api/side_metric_data/+server";
import { GET as getStackedBarData } from "../../src/routes/api/stacked_bar_chart_data/+server";

type GetHandler = RequestHandler;

const origin = "http://localhost";

async function call(handler: GetHandler, path: string): Promise<Response> {
  return handler({ url: new URL(path, origin) } as Parameters<GetHandler>[0]);
}

async function responseContract(response: Response) {
  const text = await response.text();
  const body = JSON.parse(text) as unknown;
  const rows = Array.isArray(body) ? body : [];

  return {
    status: response.status,
    contentType: response.headers.get("content-type"),
    bytes: Buffer.byteLength(text),
    sha256: createHash("sha256").update(text).digest("hex"),
    rows: rows.length,
    first: rows.at(0),
    last: rows.at(-1),
  };
}

async function responseText(handler: GetHandler, path: string): Promise<string> {
  return (await call(handler, path)).text();
}

async function expectHttpError(handler: GetHandler, path: string, status: number, message: string) {
  await expect(call(handler, path)).rejects.toMatchObject({
    status,
    body: { message },
  });
}

describe("current dashboard endpoint contracts", () => {
  beforeAll(() => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  describe("map data", () => {
    it("returns the full ordered 2003–2011 response byte-for-byte", async () => {
      expect(
        await responseContract(await call(getMapData, "/api/map_data?from=2003&to=2011"))
      ).toEqual({
        status: 200,
        contentType: "application/json",
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

    it("accepts a five-year inclusive span before reporting absent data", async () => {
      await expectHttpError(
        getMapData,
        "/api/map_data?from=2001&to=2005",
        404,
        "Data not available for year range 2001-2005"
      );
    });

    it("rejects a shorter span", async () => {
      await expectHttpError(
        getMapData,
        "/api/map_data?from=2001&to=2004",
        400,
        "Minimum 5-year span required"
      );
    });

    it("rejects years outside the supported range", async () => {
      await expectHttpError(
        getMapData,
        "/api/map_data?from=2000&to=2005",
        400,
        "Year range must be within 2001-2021"
      );
    });

    it("rejects missing parameters", async () => {
      await expectHttpError(
        getMapData,
        "/api/map_data",
        400,
        "Missing required parameters: from and to"
      );
    });

    it("reports a valid but absent range", async () => {
      await expectHttpError(
        getMapData,
        "/api/map_data?from=2002&to=2006",
        404,
        "Data not available for year range 2002-2006"
      );
    });

    it("filters the response to GEOID 01001", async () => {
      expect(
        await responseContract(
          await call(getMapData, "/api/map_data?from=2003&to=2011&geoid=01001")
        )
      ).toEqual({
        status: 200,
        contentType: "application/json",
        bytes: 116,
        sha256: "3d77f0af1cba1c6286438c5ec7b5ce78e9528c59302577d877be6b1e91356b05",
        rows: 1,
        first: {
          geoid: "01001",
          name: "Autauga County, AL",
          closure: 3,
          closure_rate_per_10000: 0,
          persistence: 4,
          reopening: 0,
        },
        last: {
          geoid: "01001",
          name: "Autauga County, AL",
          closure: 3,
          closure_rate_per_10000: 0,
          persistence: 4,
          reopening: 0,
        },
      });
    });

    it("reports an unknown GEOID", async () => {
      await expectHttpError(
        getMapData,
        "/api/map_data?from=2003&to=2011&geoid=99999",
        404,
        "County with geoid 99999 not found"
      );
    });
  });

  describe("line-chart data", () => {
    it("treats omitted GEOID and 00000 as the same aggregate", async () => {
      const omitted = await responseText(getLineChartData, "/api/line_chart_data");
      const national = await responseText(getLineChartData, "/api/line_chart_data?geoid=00000");

      expect(national).toBe(omitted);
      expect(
        await responseContract(
          new Response(omitted, { headers: { "content-type": "application/json" } })
        )
      ).toEqual({
        status: 200,
        contentType: "application/json",
        bytes: 610,
        sha256: "bd987bebcbfe07017393054ee15e1083b5164ec30ac4c02d1a42620ab4fbf0cd",
        rows: 21,
        first: { year: 2001, close: 177144 },
        last: { year: 2021, close: 178599 },
      });
    });

    it("returns the ordered series for GEOID 01001", async () => {
      expect(
        await responseContract(await call(getLineChartData, "/api/line_chart_data?geoid=01001"))
      ).toEqual({
        status: 200,
        contentType: "application/json",
        bytes: 527,
        sha256: "7675638db59fda41f777d53bb66484c4e417416dd7c4aebe88721d1a29bbb207",
        rows: 21,
        first: { year: 2001, close: 87 },
        last: { year: 2021, close: 79 },
      });
    });

    it("reports an unknown GEOID", async () => {
      await expectHttpError(
        getLineChartData,
        "/api/line_chart_data?geoid=99999",
        404,
        "No data found for geoid 99999"
      );
    });
  });

  describe("stacked-bar data", () => {
    it("treats omitted GEOID and 00000 as the same aggregate", async () => {
      const omitted = await responseText(getStackedBarData, "/api/stacked_bar_chart_data");
      const national = await responseText(
        getStackedBarData,
        "/api/stacked_bar_chart_data?geoid=00000"
      );

      expect(national).toBe(omitted);
      expect(
        await responseContract(
          new Response(omitted, { headers: { "content-type": "application/json" } })
        )
      ).toEqual({
        status: 200,
        contentType: "application/json",
        bytes: 1453,
        sha256: "fa9d7e2005765fc85c97582bc0538c4d8f9a9ce4551c54ff2a82c8b25dee9037",
        rows: 22,
        first: { year: 2000, negative: -33920, neutral: 180320, positive: 33767 },
        last: { year: 2021, negative: -34262, neutral: 175813, positive: 34118 },
      });
    });

    it("returns the ordered series for GEOID 01001", async () => {
      expect(
        await responseContract(
          await call(getStackedBarData, "/api/stacked_bar_chart_data?geoid=01001")
        )
      ).toEqual({
        status: 200,
        contentType: "application/json",
        bytes: 1215,
        sha256: "2a8b76e0c16931f9e337fb9e93b652c2aec1dfadb5749b5d8ea5f76124322cad",
        rows: 22,
        first: { year: 2000, negative: -15, neutral: 20, positive: 19 },
        last: { year: 2021, negative: -8, neutral: 100, positive: 20 },
      });
    });

    it("reports an unknown GEOID", async () => {
      await expectHttpError(
        getStackedBarData,
        "/api/stacked_bar_chart_data?geoid=99999",
        404,
        "No data found for geoid 99999"
      );
    });
  });

  describe("side-metric data", () => {
    it("defaults to the national row and preserves source strings", async () => {
      const response = await call(getSideMetricData, "/api/side_metric_data");
      const body = (await response.json()) as Record<string, string>;

      expect(response.status).toBe(200);
      expect(body.geoid).toBe("00000");
      expect(body.n_med_rent).toBe("585");
      expect(body.p_renter).toBe("30.3518461695817");
    });

    it("rejects malformed GEOIDs", async () => {
      await expectHttpError(
        getSideMetricData,
        "/api/side_metric_data?geoid=bad",
        400,
        "Invalid geoid"
      );
    });

    it("reports a well-formed unknown GEOID", async () => {
      await expectHttpError(
        getSideMetricData,
        "/api/side_metric_data?geoid=99999",
        404,
        "Data not found"
      );
    });
  });
});
