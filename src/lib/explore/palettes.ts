import {
  interpolateBlues,
  interpolateBuGn,
  interpolateBuPu,
  interpolateGnBu,
  interpolateGreens,
  interpolateGreys,
  interpolateOranges,
  interpolateOrRd,
  interpolatePuBu,
  interpolatePuBuGn,
  interpolatePuRd,
  interpolatePurples,
  interpolateRdPu,
  interpolateReds,
  interpolateYlGn,
  interpolateYlGnBu,
  interpolateYlOrBr,
  interpolateYlOrRd,
  rgb,
} from "d3";
import { COLORS } from "./model";

// ColorBrewer: Cynthia Brewer, Mark Harrower and Penn State, https://colorbrewer2.org/.
// Its discrete sequential schemes stop at nine colors. These ten-color ramps sample D3's
// ColorBrewer interpolators equally over [0, 1]; they are not official ten-class Brewer schemes.
// https://d3js.org/d3-scale-chromatic/sequential
const schemes = [
  ["Blues", "Single hue", interpolateBlues],
  ["Greens", "Single hue", interpolateGreens],
  ["Greys", "Single hue", interpolateGreys],
  ["Oranges", "Single hue", interpolateOranges],
  ["Purples", "Single hue", interpolatePurples],
  ["Reds", "Single hue", interpolateReds],
  ["BuGn", "Multi hue", interpolateBuGn],
  ["BuPu", "Multi hue", interpolateBuPu],
  ["GnBu", "Multi hue", interpolateGnBu],
  ["OrRd", "Multi hue", interpolateOrRd],
  ["PuBu", "Multi hue", interpolatePuBu],
  ["PuBuGn", "Multi hue", interpolatePuBuGn],
  ["PuRd", "Multi hue", interpolatePuRd],
  ["RdPu", "Multi hue", interpolateRdPu],
  ["YlGn", "Multi hue", interpolateYlGn],
  ["YlGnBu", "Multi hue", interpolateYlGnBu],
  ["YlOrBr", "Multi hue", interpolateYlOrBr],
  ["YlOrRd", "Multi hue", interpolateYlOrRd],
] as const;

export const PALETTES: {
  id: string;
  label: string;
  group: "Original" | "Single hue" | "Multi hue";
  colors: readonly string[];
}[] = [
  { id: "yale", label: "Yale blue", group: "Original", colors: COLORS },
  ...schemes.map(([id, group, interpolate]) => ({
    id,
    label: id,
    group,
    colors: Array.from({ length: COLORS.length }, (_, index) =>
      rgb(interpolate(index / (COLORS.length - 1))).formatHex()
    ),
  })),
];

export const paletteFor = (id: string | null) =>
  PALETTES.find((palette) => palette.id === id) ?? PALETTES[0];
