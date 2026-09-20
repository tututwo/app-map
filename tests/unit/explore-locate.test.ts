import { expect, test } from "vitest";
import { inRings, tilePoint } from "$lib/explore/locate";
import { plain, looksLikeAddress } from "$lib/explore/gazetteer";

test("a point lands in the right tile, at the right place inside it", () => {
  // The Focus used throughout the docs: downtown New Haven, in the block-group archive's top zoom.
  const { x, y, px, py } = tilePoint([-72.9279, 41.3083], 12, 4096);
  expect([x, y]).toEqual([1218, 1531]);
  expect(px).toBeGreaterThan(0);
  expect(px).toBeLessThan(4096);
  expect(py).toBeGreaterThan(0);
  expect(py).toBeLessThan(4096);
  // The whole world is one tile at zoom 0, and Null Island is its centre.
  expect(tilePoint([0, 0], 0, 4096)).toMatchObject({ x: 0, y: 0, px: 2048, py: 2048 });
});

test("even-odd handles holes and multipolygons", () => {
  const square = (x: number, y: number, size: number) => [
    { x, y },
    { x: x + size, y },
    { x: x + size, y: y + size },
    { x, y: y + size },
  ];
  const donut = [square(0, 0, 10), square(4, 4, 2)];
  expect(inRings(donut, 1, 1)).toBe(true);
  expect(inRings(donut, 5, 5)).toBe(false); // in the hole
  expect(inRings(donut, 11, 5)).toBe(false);
  const islands = [square(0, 0, 2), square(10, 10, 2)];
  expect(inRings(islands, 11, 11)).toBe(true);
  expect(inRings(islands, 5, 5)).toBe(false);
});

test("search text is compared without punctuation, and a house number means an address", () => {
  expect(plain("Houston, Texas")).toBe("houston tx");
  expect(plain("  New   Haven, CT ")).toBe("new haven ct");
  expect(plain("St. Louis")).toBe("st louis");
  expect(looksLikeAddress("60 College St, New Haven")).toBe(true);
  expect(looksLikeAddress("221B Baker Street")).toBe(true);
  expect(looksLikeAddress("06511")).toBe(false);
  expect(looksLikeAddress("New Haven")).toBe(false);
});
