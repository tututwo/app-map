import * as topojson from "topojson-client";

import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
/**
 * Converts TopoJSON to GeoJSON with various options
 * @param {Object} topoData - The TopoJSON data
 * @param {Object} options - Conversion options
 * @param {string} options.objectName - Specific object to convert (optional)
 * @param {boolean} options.extractAll - Whether to extract all objects (default: false)
 * @param {boolean} options.includeProperties - Whether to preserve properties (default: true)
 * @returns {Object|Object[]} - GeoJSON FeatureCollection(s)
 */
export function topoToGeo(topoData, options = {}) {
  // Validate input
  if (!topoData || !topoData.objects) {
    throw new Error("Invalid TopoJSON: missing objects property");
  }

  const { objectName = null, extractAll = false, includeProperties = true } = options;

  // If objectName is specified, use it
  if (objectName && topoData.objects[objectName]) {
    return topojson.feature(topoData, topoData.objects[objectName]);
  }

  // Get all object names
  const objectNames = Object.keys(topoData.objects);

  if (objectNames.length === 0) {
    throw new Error("No objects found in TopoJSON");
  }

  // If extractAll is true, return an object with all GeoJSON objects
  if (extractAll) {
    const result = {};
    objectNames.forEach((name) => {
      result[name] = topojson.feature(topoData, topoData.objects[name]);
    });
    return result;
  }

  // Otherwise, return the first object (common case)
  return topojson.feature(topoData, topoData.objects[objectNames[0]]);
}

// Process the data for easy access
export function processCSVData(real_data) {
  // Create lookup maps for quick data access

  const realDataMap = new Map(real_data.map((d) => [d.geoid, d]));
  return {
    realData: realDataMap,
    // Helper function to get all data for a county
    getCountyData: (id) => {
      const realD = realDataMap.get(id);
      if (!realD) return null;

      return {
        ...realD,
      };
    },
  };
}

//IMPORTANT:to deckgl color
/**
 * Color conversion utilities for deck.gl
 *
 * This module provides functions to convert various color formats
 * to the RGB/RGBA arrays that deck.gl accepts.
 */

/**
 * Convert hex color string to RGB or RGBA array
 * @param {string} hex - Hex color like '#RRGGBB' or '#RRGGBBAA'
 * @returns {number[]} - [r, g, b] or [r, g, b, a] array (values 0-255)
 */
function hexToRgb(hex) {
  // Remove # if present
  hex = hex.replace(/^#/, "");

  // Parse hex values
  let r, g, b, a;

  if (hex.length === 3) {
    // #RGB format
    r = parseInt(hex.charAt(0) + hex.charAt(0), 16);
    g = parseInt(hex.charAt(1) + hex.charAt(1), 16);
    b = parseInt(hex.charAt(2) + hex.charAt(2), 16);
    return [r, g, b];
  } else if (hex.length === 4) {
    // #RGBA format
    r = parseInt(hex.charAt(0) + hex.charAt(0), 16);
    g = parseInt(hex.charAt(1) + hex.charAt(1), 16);
    b = parseInt(hex.charAt(2) + hex.charAt(2), 16);
    a = parseInt(hex.charAt(3) + hex.charAt(3), 16);
    return [r, g, b, a];
  } else if (hex.length === 6) {
    // #RRGGBB format
    r = parseInt(hex.substring(0, 2), 16);
    g = parseInt(hex.substring(2, 4), 16);
    b = parseInt(hex.substring(4, 6), 16);
    return [r, g, b];
  } else if (hex.length === 8) {
    // #RRGGBBAA format
    r = parseInt(hex.substring(0, 2), 16);
    g = parseInt(hex.substring(2, 4), 16);
    b = parseInt(hex.substring(4, 6), 16);
    a = parseInt(hex.substring(6, 8), 16);
    return [r, g, b, a];
  }

  throw new Error(`Invalid hex color format: ${hex}`);
}

/**
 * Convert RGB/RGBA object to array
 * @param {object} color - {r, g, b} or {r, g, b, a} object
 * @returns {number[]} - [r, g, b] or [r, g, b, a] array
 */
function rgbObjectToArray(color) {
  if (color.a !== undefined) {
    return [color.r, color.g, color.b, color.a];
  }
  return [color.r, color.g, color.b];
}

/**
 * Convert HSL color to RGB array
 * @param {number} h - Hue (0-360)
 * @param {number} s - Saturation (0-100)
 * @param {number} l - Lightness (0-100)
 * @param {number} [a=255] - Alpha (0-255)
 * @returns {number[]} - [r, g, b] or [r, g, b, a] array
 */
function hslToRgb(h, s, l, a = 255) {
  // Convert HSL percentages to decimals
  s /= 100;
  l /= 100;

  const k = (n) => (n + h / 30) % 12;
  const a1 = s * Math.min(l, 1 - l);
  const f = (n) => l - a1 * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));

  // Convert to RGB (0-255)
  const r = Math.round(255 * f(0));
  const g = Math.round(255 * f(8));
  const b = Math.round(255 * f(4));

  return a === 255 ? [r, g, b] : [r, g, b, a];
}

/**
 * Convert CSS color name to RGB array
 * @param {string} colorName - CSS color name like 'red', 'blue', etc.
 * @returns {number[]} - [r, g, b] array
 */
function cssColorNameToRgb(colorName) {
  // Create temporary element to compute the color
  const temp = document.createElement("div");
  temp.style.color = colorName;
  temp.style.display = "none";
  document.body.appendChild(temp);

  // Get computed color
  const computedColor = getComputedStyle(temp).color;
  document.body.removeChild(temp);

  // Parse RGB values from "rgb(r, g, b)" or "rgba(r, g, b, a)" string
  const match = computedColor.match(/rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?\)/);
  if (!match) throw new Error(`Could not parse color: ${computedColor}`);

  const r = parseInt(match[1], 10);
  const g = parseInt(match[2], 10);
  const b = parseInt(match[3], 10);

  if (match[4] !== undefined) {
    const a = Math.round(parseFloat(match[4]) * 255);
    return [r, g, b, a];
  }

  return [r, g, b];
}

/**
 * Parse any color string to deck.gl format
 * Supports: hex, rgb(), rgba(), hsl(), hsla(), and CSS color names
 * @param {string} colorStr - Color string in any format
 * @returns {number[]} - [r, g, b] or [r, g, b, a] array for deck.gl
 */
function parseColorString(colorStr) {
  // Handle hex colors
  if (colorStr.startsWith("#")) {
    return hexToRgb(colorStr);
  }

  // Handle rgb/rgba colors
  if (colorStr.startsWith("rgb")) {
    const match = colorStr.match(/rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?\)/);
    if (!match) throw new Error(`Invalid rgb/rgba color format: ${colorStr}`);

    const r = parseInt(match[1], 10);
    const g = parseInt(match[2], 10);
    const b = parseInt(match[3], 10);

    if (match[4] !== undefined) {
      const a = Math.round(parseFloat(match[4]) * 255);
      return [r, g, b, a];
    }
    return [r, g, b];
  }

  // Handle hsl/hsla colors
  if (colorStr.startsWith("hsl")) {
    const match = colorStr.match(/hsla?\((\d+), (\d+)%, (\d+)%(?:, ([\d.]+))?\)/);
    if (!match) throw new Error(`Invalid hsl/hsla color format: ${colorStr}`);

    const h = parseInt(match[1], 10);
    const s = parseInt(match[2], 10);
    const l = parseInt(match[3], 10);

    if (match[4] !== undefined) {
      const a = Math.round(parseFloat(match[4]) * 255);
      return hslToRgb(h, s, l, a);
    }
    return hslToRgb(h, s, l);
  }

  // Handle CSS color names
  try {
    return cssColorNameToRgb(colorStr);
  } catch (e) {
    throw new Error(`Could not parse color: ${colorStr}`);
  }
}

/**
 * Convert any color to deck.gl format with specified alpha
 * @param {string|number[]|object} color - Color in any format
 * @param {number} [alpha] - Optional alpha value (0-255)
 * @returns {number[]} - [r, g, b] or [r, g, b, a] array for deck.gl
 */
export function toDeckGLColor(color, alpha) {
  let result;

  if (typeof color === "string") {
    result = parseColorString(color);
  } else if (Array.isArray(color)) {
    // Already in array format
    result = [...color];
  } else if (typeof color === "object") {
    // RGB object format {r, g, b}
    result = rgbObjectToArray(color);
  } else {
    throw new Error("Unsupported color format");
  }

  // Set/override alpha if specified
  if (alpha !== undefined) {
    if (result.length === 3) {
      result.push(alpha);
    } else {
      result[3] = alpha;
    }
  }

  return result;
}

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
