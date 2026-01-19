/**
 * Converts a CSS color string to RGB values.
 * Supports hex (#RGB, #RRGGBB), rgb(), rgba() formats.
 */
function parseColor(color: string): { r: number; g: number; b: number } | null {
  // Handle hex colors
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    let r: number, g: number, b: number;

    if (hex.length === 3) {
      r = Number.parseInt(hex[0] + hex[0], 16);
      g = Number.parseInt(hex[1] + hex[1], 16);
      b = Number.parseInt(hex[2] + hex[2], 16);
    } else if (hex.length === 6) {
      r = Number.parseInt(hex.slice(0, 2), 16);
      g = Number.parseInt(hex.slice(2, 4), 16);
      b = Number.parseInt(hex.slice(4, 6), 16);
    } else {
      return null;
    }

    return { r, g, b };
  }

  // Handle rgb() and rgba() formats
  const rgbMatch = new RegExp(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i).exec(color);
  if (rgbMatch) {
    return {
      r: Number.parseInt(rgbMatch[1], 10),
      g: Number.parseInt(rgbMatch[2], 10),
      b: Number.parseInt(rgbMatch[3], 10),
    };
  }

  return null;
}

/**
 * Calculates the relative luminance of an RGB color.
 * Uses the WCAG formula for luminance calculation.
 * https://www.w3.org/TR/WCAG20/#relativeluminancedef
 */
function getRelativeLuminance(r: number, g: number, b: number): number {
  const rsRGB = r / 255;
  const gsRGB = g / 255;
  const bsRGB = b / 255;

  const rLinear = rsRGB <= 0.03928 ? rsRGB / 12.92 : Math.pow((rsRGB + 0.055) / 1.055, 2.4);
  const gLinear = gsRGB <= 0.03928 ? gsRGB / 12.92 : Math.pow((gsRGB + 0.055) / 1.055, 2.4);
  const bLinear = bsRGB <= 0.03928 ? bsRGB / 12.92 : Math.pow((bsRGB + 0.055) / 1.055, 2.4);

  return 0.2126 * rLinear + 0.7152 * gLinear + 0.0722 * bLinear;
}

/**
 * Determines if a color is light or dark based on its relative luminance.
 * Returns true if the color is light (white text should be used).
 */
function isLightColor(color: string): boolean {
  const rgb = parseColor(color);
  if (!rgb) {
    // Default to assuming light background if we can't parse
    return true;
  }

  const luminance = getRelativeLuminance(rgb.r, rgb.g, rgb.b);
  // Threshold of 0.5 (midpoint) - adjust if needed for better contrast
  return luminance > 0.5;
}

/**
 * Gets the appropriate text color (black or white) for a given background color.
 * Uses WCAG luminance calculation for optimal contrast.
 */
export function getContrastTextColor(backgroundColor: string): string {
  return isLightColor(backgroundColor) ? '#000000' : '#ffffff';
}
