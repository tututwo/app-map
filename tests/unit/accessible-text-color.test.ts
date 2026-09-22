import { expect, test } from "vitest";
import { getAccessibleTextColor } from "$lib/utils/accessibleTextColor";

test("chooses higher-contrast text at the crossover and for dashboard palettes", () => {
  for (const [background, text] of [
    ["#000000", "#FFFFFF"],
    ["#FFFFFF", "#000000"],
    ["#757575", "#FFFFFF"],
    ["#767676", "#000000"],
    ["#B01169", "#FFFFFF"],
    ["#D476AA", "#000000"],
    ["#B96308", "#000000"],
    ["#5C168E", "#FFFFFF"],
    ["#A272C5", "#000000"],
  ]) {
    expect(getAccessibleTextColor(background)).toBe(text);
  }
});
