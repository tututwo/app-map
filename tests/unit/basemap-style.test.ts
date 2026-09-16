import { expect, test } from "vitest";
import { validateStyleMin, type StyleSpecification } from "@maplibre/maplibre-gl-style-spec";
import basemap from "../../static/maps/yale-light.json";

test("Yale Light is valid and keeps geographic context above thematic fills", () => {
  const style = basemap as StyleSpecification;
  expect(validateStyleMin(style).map((error) => error.message)).toEqual([]);

  const anchor = style.layers.findIndex((layer) => layer.id === "waterway");
  expect(anchor).toBeGreaterThan(0);
  expect(style.layers.findIndex((layer) => layer.id === "water")).toBeGreaterThan(anchor);
  expect(style.layers.slice(anchor + 1, anchor + 4).map((layer) => layer.id)).toEqual([
    "boundary-state",
    "boundary-country",
    "water",
  ]);

  for (const [index, layer] of style.layers.entries()) {
    const sourceLayer = "source-layer" in layer ? layer["source-layer"] : undefined;
    if (layer.type === "background" || (layer.type === "fill" && sourceLayer !== "water")) {
      expect(index, layer.id).toBeLessThan(anchor);
    }
    if (layer.type === "symbol" || sourceLayer === "boundary" || sourceLayer === "water") {
      expect(index, layer.id).toBeGreaterThan(anchor);
    }
  }
});
