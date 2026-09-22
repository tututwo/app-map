import { expect, test } from "vitest";
import { COLORS, FIXED_BREAKS, colorIndexOf, legendFor } from "$lib/explore/model";
import { PALETTES, paletteFor } from "$lib/explore/palettes";

test("all sequential palettes keep ten colors and preserve the existing classes", () => {
  expect(PALETTES).toHaveLength(19);
  expect(new Set(PALETTES.map(({ id }) => id)).size).toBe(19);
  expect(paletteFor(null).id).toBe("yale");
  expect(paletteFor("unknown").colors).toBe(COLORS);
  expect(paletteFor("yale").colors).toBe(COLORS);
  expect(PALETTES.filter(({ group }) => group === "Single hue")).toHaveLength(6);
  expect(PALETTES.filter(({ group }) => group === "Multi hue")).toHaveLength(12);
  for (const palette of PALETTES) {
    expect(palette.colors).toHaveLength(10);
    expect(new Set(palette.colors).size).toBe(10);
    expect(palette.colors.every((color) => /^#[0-9a-f]{6}$/.test(color))).toBe(true);
    expect(paletteFor(palette.id)).toBe(palette);
    for (const breaks of [FIXED_BREAKS.tract, [1, 8], []]) {
      const original = legendFor(breaks);
      const selected = legendFor(breaks, palette.colors);
      expect(selected.breaks).toBe(breaks);
      expect(selected.classes.map(({ label }) => label)).toEqual(
        original.classes.map(({ label }) => label)
      );
      expect(selected.classes.map(({ color }) => color)).toEqual(
        [0, ...breaks].map((low) => palette.colors[colorIndexOf(low, breaks)])
      );
    }
  }
});
