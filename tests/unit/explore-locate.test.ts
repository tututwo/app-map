import { expect, test, vi } from "vitest";
import { inRings, spanOf, tilePoint, type Piece } from "$lib/explore/locate";
import { plain, looksLikeAddress, pointOf } from "$lib/explore/gazetteer";

test("tract and block-group links do not download a gazetteer that cannot locate them", async () => {
  const fetcher = vi.spyOn(globalThis, "fetch");
  try {
    expect(await pointOf({ level: "tract", id: "06037101110" })).toBeUndefined();
    expect(await pointOf({ level: "blockgroup", id: "060371011101" })).toBeUndefined();
    expect(fetcher).not.toHaveBeenCalled();
  } finally {
    fetcher.mockRestore();
  }
});

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
  // The longest state name wins ("... West Virginia" also ends with " Virginia"); a state alone stays.
  expect(plain("Charleston, West Virginia")).toBe("charleston wv");
  expect(plain("west virginia")).toBe("west virginia");
  // The Census spellings: St., Fort, Mount, and no hyphen or apostrophe to get wrong.
  expect(plain("Saint Louis MO")).toBe(plain("St. Louis, MO"));
  expect(plain("Ft. Worth")).toBe("fort worth");
  expect(plain("Mt Vernon NY")).toBe("mount vernon ny");
  expect(plain("MT")).toBe("mt");
  expect(plain("Billings, MT")).toBe(plain("Billings, Montana"));
  expect(plain("Helena MT 59601")).toBe("helena mt 59601");
  expect(plain("winston salem")).toBe(plain("Winston-Salem"));
  expect(plain("lees summit")).toBe(plain("Lee's Summit"));
  expect(looksLikeAddress("60 College St, New Haven")).toBe(true);
  expect(looksLikeAddress("221B Baker Street")).toBe(true);
  expect(looksLikeAddress("06511")).toBe(false);
  expect(looksLikeAddress("New Haven")).toBe(false);
});

test("a Unit's bounds are pieced together from the tiles it runs into, up to four", async () => {
  // A Unit covering these tiles; each piece reports the covered neighbours it runs into.
  const unit = (covered: [number, number][]) => {
    const has = (x: number, y: number) => covered.some(([cx, cy]) => cx === x && cy === y);
    const reads: string[] = [];
    const read = async (x: number, y: number): Promise<Piece | null> => {
      reads.push(`${x}/${y}`);
      if (!has(x, y)) return null;
      const beyond = (
        [
          [-1, 0],
          [1, 0],
          [0, -1],
          [0, 1],
        ] as [number, number][]
      ).filter(([dx, dy]) => has(x + dx, y + dy));
      return {
        geoid: "u",
        bounds: [
          [x, -y - 1],
          [x + 1, -y],
        ],
        beyond,
      };
    };
    return { read, reads };
  };
  const whole = unit([[5, 5]]);
  expect(await spanOf(whole.read, 5, 5)).toEqual([
    [5, -6],
    [6, -5],
  ]);
  expect(whole.reads).toEqual(["5/5"]);
  // Memphis on 90°W: two tiles side by side.
  const pair = unit([
    [5, 5],
    [6, 5],
  ]);
  expect(await spanOf(pair.read, 6, 5)).toEqual([
    [5, -6],
    [7, -5],
  ]);
  // A corner: the diagonal tile is reached through either neighbour and read once.
  const square = unit([
    [5, 5],
    [6, 5],
    [5, 6],
    [6, 6],
  ]);
  expect(await spanOf(square.read, 5, 5)).toEqual([
    [5, -7],
    [7, -5],
  ]);
  expect(square.reads.sort()).toEqual(["5/5", "5/6", "6/5", "6/6"]);
  // Six tiles is past the budget: a lower zoom is the place to look.
  const wide = unit([
    [5, 5],
    [6, 5],
    [7, 5],
    [5, 6],
    [6, 6],
    [7, 6],
  ]);
  expect(await spanOf(wide.read, 6, 5)).toBeNull();
});
