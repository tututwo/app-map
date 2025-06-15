/**
 * Calculate relative luminance of a color according to WCAG guidelines
 * @param {string} hexColor - Hex color string (with or without #)
 * @returns {number} Relative luminance value between 0 and 1
 */
function getRelativeLuminance(hexColor) {
  // Remove the # if present
  const hex = hexColor.replace("#", "");

  // Convert to RGB values between 0 and 1
  const r = parseInt(hex.substr(0, 2), 16) / 255;
  const g = parseInt(hex.substr(2, 2), 16) / 255;
  const b = parseInt(hex.substr(4, 2), 16) / 255;

  // Apply gamma correction for each channel
  const gammaCorrect = (value) => {
    return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
  };

  const rLinear = gammaCorrect(r);
  const gLinear = gammaCorrect(g);
  const bLinear = gammaCorrect(b);

  // Calculate relative luminance using WCAG formula
  return 0.2126 * rLinear + 0.7152 * gLinear + 0.0722 * bLinear;
}

/**
 * Calculate contrast ratio between two colors according to WCAG guidelines
 * @param {number} luminance1 - Relative luminance of first color
 * @param {number} luminance2 - Relative luminance of second color
 * @returns {number} Contrast ratio between 1 and 21
 */
function getContrastRatio(luminance1, luminance2) {
  const lighter = Math.max(luminance1, luminance2);
  const darker = Math.min(luminance1, luminance2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Determine the best text color (black or white) for a given background color
 * @param {string} backgroundColor - Hex color string (with or without #)
 * @param {string} textSize - 'normal' or 'large' (affects contrast requirements)
 * @returns {string} Either '#000000' (black) or '#FFFFFF' (white)
 */
export function getAccessibleTextColor(backgroundColor, textSize = "normal") {
  const bgLuminance = getRelativeLuminance(backgroundColor);

  // Calculate contrast ratios with pure black and white
  const contrastWithWhite = getContrastRatio(1, bgLuminance);
  const contrastWithBlack = getContrastRatio(bgLuminance, 0);

  // WCAG AAA requirements
  const requiredContrast = textSize === "large" ? 4.5 : 7.0;

  // Check which colors meet AAA standards
  const whitePassesAAA = contrastWithWhite >= requiredContrast;
  const blackPassesAAA = contrastWithBlack >= requiredContrast;

  // Decision logic:
  // 1. If both pass AAA, choose the one with better contrast
  // 2. If only one passes AAA, use that one
  // 3. If neither passes AAA, choose the one with better contrast

  if (whitePassesAAA && blackPassesAAA) {
    // Both pass, choose better contrast
    return contrastWithWhite > contrastWithBlack ? "#FFFFFF" : "#000000";
  } else if (whitePassesAAA) {
    // Only white passes
    return "#FFFFFF";
  } else if (blackPassesAAA) {
    // Only black passes
    return "#000000";
  } else {
    // Neither passes AAA, choose better contrast
    // For AA fallback: requirement is 4.5 for normal text, 3.0 for large
    const fallbackRequirement = textSize === "large" ? 3.0 : 4.5;

    // Check AA compliance
    const whitePassesAA = contrastWithWhite >= fallbackRequirement;
    const blackPassesAA = contrastWithBlack >= fallbackRequirement;

    if (whitePassesAA && !blackPassesAA) {
      return "#FFFFFF";
    } else if (blackPassesAA && !whitePassesAA) {
      return "#000000";
    }

    // If still no clear winner, use the one with better contrast
    return contrastWithWhite > contrastWithBlack ? "#FFFFFF" : "#000000";
  }
}

/**
 * Get detailed contrast information for debugging
 * @param {string} backgroundColor - Hex color string
 * @param {string} textSize - 'normal' or 'large'
 * @returns {object} Detailed contrast information
 */
export function getContrastInfo(backgroundColor, textSize = "normal") {
  const bgLuminance = getRelativeLuminance(backgroundColor);
  const contrastWithWhite = getContrastRatio(1, bgLuminance);
  const contrastWithBlack = getContrastRatio(bgLuminance, 0);
  const requiredContrastAAA = textSize === "large" ? 4.5 : 7.0;
  const requiredContrastAA = textSize === "large" ? 3.0 : 4.5;

  const recommendedColor = getAccessibleTextColor(backgroundColor, textSize);
  const recommendedContrast =
    recommendedColor === "#FFFFFF" ? contrastWithWhite : contrastWithBlack;

  return {
    backgroundColor,
    backgroundLuminance: bgLuminance.toFixed(4),
    contrastWithWhite: contrastWithWhite.toFixed(2),
    contrastWithBlack: contrastWithBlack.toFixed(2),
    recommendedTextColor: recommendedColor,
    recommendedContrast: recommendedContrast.toFixed(2),
    meetsAAA: recommendedContrast >= requiredContrastAAA,
    meetsAA: recommendedContrast >= requiredContrastAA,
    whitePassesAAA: contrastWithWhite >= requiredContrastAAA,
    blackPassesAAA: contrastWithBlack >= requiredContrastAAA,
    textSize,
  };
}
