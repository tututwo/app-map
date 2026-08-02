export type DeckColor = [number, number, number] | [number, number, number, number];

function expandHex(hex: string): string {
  return hex.length === 3 || hex.length === 4
    ? [...hex].map((character) => character + character).join("")
    : hex;
}

export function toDeckGLColor(color: string, alpha?: number): DeckColor {
  const hex = expandHex(color.replace(/^#/, ""));
  if (!/^[\da-f]{6}([\da-f]{2})?$/i.test(hex)) {
    throw new Error(`Unsupported map color: ${color}`);
  }

  const channels: DeckColor = [
    Number.parseInt(hex.slice(0, 2), 16),
    Number.parseInt(hex.slice(2, 4), 16),
    Number.parseInt(hex.slice(4, 6), 16),
  ];
  const encodedAlpha = hex.length === 8 ? Number.parseInt(hex.slice(6, 8), 16) : undefined;

  if (alpha !== undefined || encodedAlpha !== undefined) {
    return [...channels, alpha ?? encodedAlpha!] as [number, number, number, number];
  }
  return channels;
}
