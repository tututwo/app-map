import { describe, expect, it, vi } from "vitest";

import { createMapAssetsLoader } from "$lib/map/static-assets";
import { featureBounds, topologyToFeatureCollection } from "$lib/map/topology";
import topology from "$data/counties-10m.json";

const urls = {
  countiesTopology: "/counties.json",
  countyCameras: "/county-cameras.json",
};

describe("map static asset loader", () => {
  it("selects the named state geometry and fits Alaska across the dateline", () => {
    const states = topologyToFeatureCollection(topology, "states");
    expect(states.features).toHaveLength(56);
    expect(states.features.every((feature) => /^\d{2}$/.test(String(feature.id)))).toBe(true);
    expect(topologyToFeatureCollection(topology).features.length).toBeGreaterThan(3000);
    expect(() => topologyToFeatureCollection(topology, "missing")).toThrow(
      "missing object not found"
    );

    const alaska = states.features.find((feature) => feature.id === "02")!;
    const [[west, south], [east, north]] = featureBounds(alaska);
    expect(west).toBeLessThan(-180);
    expect(east - west).toBeGreaterThan(50);
    expect(east - west).toBeLessThan(65);
    expect(north).toBeGreaterThan(south);
    for (const geoid of ["15", "60", "66", "69", "72", "78"]) {
      const [[left, bottom], [right, top]] = featureBounds(
        states.features.find((feature) => feature.id === geoid)!
      );
      expect(right).toBeGreaterThan(left);
      expect(right - left).toBeLessThan(10);
      expect(top).toBeGreaterThan(bottom);
    }
  });

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
