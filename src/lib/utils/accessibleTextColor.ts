/**
 * Calculate relative luminance of a color according to WCAG guidelines
 * @param {string} hexColor - Hex color string (with or without #)
 * @returns {number} Relative luminance value between 0 and 1
 */
function getRelativeLuminance(hexColor: string): number {
  // Remove the # if present
  const hex = hexColor.replace("#", "");

  // Convert to RGB values between 0 and 1
  const r = parseInt(hex.substr(0, 2), 16) / 255;
  const g = parseInt(hex.substr(2, 2), 16) / 255;
  const b = parseInt(hex.substr(4, 2), 16) / 255;

  // Apply gamma correction for each channel
  const gammaCorrect = (value: number) => {
    return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
  };

  const rLinear = gammaCorrect(r);
  const gLinear = gammaCorrect(g);
  const bLinear = gammaCorrect(b);

  // Calculate relative luminance using WCAG formula
  return 0.2126 * rLinear + 0.7152 * gLinear + 0.0722 * bLinear;
}

/** Choose whichever text color has the higher WCAG contrast ratio. */
export function getAccessibleTextColor(backgroundColor: string): string {
  const luminance = getRelativeLuminance(backgroundColor);
  const contrastWithWhite = 1.05 / (luminance + 0.05);
  const contrastWithBlack = (luminance + 0.05) / 0.05;
  return contrastWithWhite > contrastWithBlack ? "#FFFFFF" : "#000000";
}
