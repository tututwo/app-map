import { afterEach, describe, expect, it, vi } from "vitest";

import { normalizeCountyGeoid } from "$lib/domain/countyGeoid";
import { reverseGeocodeCounty, searchCounties } from "$lib/utils/searchCounty2010Census";

describe("Connecticut county GEOID normalization", () => {
  it("maps South Central Connecticut to the app's complete legacy county dataset", () => {
    expect(normalizeCountyGeoid("09170")).toBe("09009");
  });

  it("leaves other planning regions, ordinary counties, and the national GEOID unchanged", () => {
    expect(normalizeCountyGeoid("00000")).toBe("00000");
    expect(normalizeCountyGeoid("01001")).toBe("01001");
    expect(normalizeCountyGeoid("09110")).toBe("09110");
    expect(normalizeCountyGeoid("09190")).toBe("09190");
  });
});

describe("Nominatim county results", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("normalizes South Central search results without duplicating the state", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json([
          {
            display_name: "New Haven, Connecticut, United States",
            address: {
              county: "South Central Connecticut Planning Region",
              state: "Connecticut",
            },
          },
        ])
      )
    );

    await expect(searchCounties("New Haven")).resolves.toEqual([
      expect.objectContaining({
        geoid: "09009",
        county: "New Haven County",
        displayName: "New Haven County, CT",
        originalCountyName: "South Central Connecticut Planning Region",
      }),
    ]);
  });

  it("normalizes a planning-region reverse-geocode result", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          address: {
            county: "South Central Connecticut Planning Region",
            state: "Connecticut",
          },
        })
      )
    );

    await expect(reverseGeocodeCounty(41.31, -72.92)).resolves.toMatchObject({
      geoid: "09009",
      county: "New Haven County",
      displayName: "New Haven County, CT",
      originalCountyName: "South Central Connecticut Planning Region",
    });
  });

  it("preserves a planning region when no complete legacy-county fallback exists", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json([
          {
            display_name: "Bridgeport, Connecticut, United States",
            address: {
              county: "Greater Bridgeport Planning Region",
              state: "Connecticut",
            },
          },
        ])
      )
    );

    await expect(searchCounties("Bridgeport")).resolves.toEqual([
      expect.objectContaining({
        geoid: "09120",
        county: "Greater Bridgeport Planning Region",
        displayName: "Greater Bridgeport Planning Region, CT",
      }),
    ]);
  });
});
