import { describe, expect, it, vi } from "vitest";

import { createMapAssetsLoader } from "$lib/map/static-assets";

const urls = {
  countiesTopology: "/counties.json",
  countyCameras: "/county-cameras.json",
};

describe("map static asset loader", () => {
  it("shares one fetch and parse promise across concurrent map instances", async () => {
    const payloads = {
      [urls.countiesTopology]: { type: "Topology", arcs: [] },
      [urls.countyCameras]: {
        "01001": { longitude: -86.67483441666667, latitude: 32.48966849914469, zoom: 8.81 },
      },
    };
    const fetchAsset = vi.fn(async (assetUrl: string) =>
      Response.json(payloads[assetUrl as keyof typeof payloads])
    );
    const loadMapAssets = createMapAssetsLoader(fetchAsset, urls);

    const first = loadMapAssets();
    const second = loadMapAssets();

    expect(second).toBe(first);
    await expect(first).resolves.toEqual({
      countiesTopology: payloads[urls.countiesTopology],
      countyCameras: payloads[urls.countyCameras],
    });
    expect(fetchAsset).toHaveBeenCalledTimes(2);
    expect(fetchAsset).toHaveBeenCalledWith(urls.countiesTopology);
    expect(fetchAsset).toHaveBeenCalledWith(urls.countyCameras);
  });

  it("evicts a rejected asset so a later map instance can retry", async () => {
    let cameraAttempts = 0;
    const fetchAsset = vi.fn(async (assetUrl: string) => {
      if (assetUrl === urls.countyCameras && cameraAttempts++ === 0) {
        return new Response(null, { status: 503, statusText: "Unavailable" });
      }

      return Response.json(assetUrl === urls.countiesTopology ? { type: "Topology" } : {});
    });
    const loadMapAssets = createMapAssetsLoader(fetchAsset, urls);

    await expect(loadMapAssets()).rejects.toThrow(
      "Failed to load map asset /county-cameras.json: 503 Unavailable"
    );
    await expect(loadMapAssets()).resolves.toEqual({
      countiesTopology: { type: "Topology" },
      countyCameras: {},
    });

    expect(fetchAsset.mock.calls.filter(([url]) => url === urls.countiesTopology)).toHaveLength(1);
    expect(fetchAsset.mock.calls.filter(([url]) => url === urls.countyCameras)).toHaveLength(2);
  });
});
