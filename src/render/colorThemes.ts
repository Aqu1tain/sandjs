/**
 * Color theme palettes for sunburst charts.
 * Supports qualitative (categorical), sequential, and diverging color schemes.
 */

/**
 * Qualitative color palettes for categorical data.
 * Each palette contains colors that are visually distinct for different categories.
 */
export const QUALITATIVE_PALETTES = {
  /** Default vibrant categorical palette (10 colors) */
  default: [
    '#f97316', // orange
    '#facc15', // yellow
    '#22d3ee', // cyan
    '#a855f7', // purple
    '#4ade80', // green
    '#fb7185', // pink
    '#60a5fa', // blue
    '#fbbf24', // amber
    '#34d399', // emerald
    '#f472b6', // rose
  ],

  /** Pastel colors for softer appearance (10 colors) */
  pastel: [
    '#fecaca', // red-200
    '#fed7aa', // orange-200
    '#fef08a', // yellow-200
    '#d9f99d', // lime-200
    '#bbf7d0', // green-200
    '#a7f3d0', // emerald-200
    '#99f6e4', // teal-200
    '#a5f3fc', // cyan-200
    '#bae6fd', // sky-200
    '#ddd6fe', // violet-200
  ],

  /** Bold vibrant colors (10 colors) */
  vibrant: [
    '#dc2626', // red-600
    '#ea580c', // orange-600
    '#d97706', // amber-600
    '#16a34a', // green-600
    '#0891b2', // cyan-600
    '#2563eb', // blue-600
    '#7c3aed', // violet-600
    '#c026d3', // fuchsia-600
    '#db2777', // pink-600
    '#65a30d', // lime-600
  ],

  /** Earthy natural tones (8 colors) */
  earth: [
    '#78350f', // amber-900
    '#92400e', // orange-900
    '#365314', // lime-900
    '#14532d', // green-900
    '#164e63', // cyan-900
    '#1e3a8a', // blue-900
    '#4c1d95', // violet-900
    '#831843', // pink-900
  ],

  /** Ocean blues and teals (8 colors) */
  ocean: [
    '#0c4a6e', // sky-900
    '#075985', // sky-800
    '#0369a1', // sky-700
    '#0284c7', // sky-600
    '#0891b2', // cyan-600
    '#06b6d4', // cyan-500
    '#22d3ee', // cyan-400
    '#67e8f9', // cyan-300
  ],

  /** Sunset warm tones (8 colors) */
  sunset: [
    '#7c2d12', // orange-900
    '#9a3412', // orange-800
    '#c2410c', // orange-700
    '#ea580c', // orange-600
    '#f97316', // orange-500
    '#fb923c', // orange-400
    '#fdba74', // orange-300
    '#fed7aa', // orange-200
  ],
} as const;

/**
 * Sequential color palettes for ordered data (light to dark).
 * Useful for showing progression or magnitude.
 */
export const SEQUENTIAL_PALETTES = {
  /** Blue sequential palette (9 shades) */
  blues: [
    '#eff6ff', // blue-50
    '#dbeafe', // blue-100
    '#bfdbfe', // blue-200
    '#93c5fd', // blue-300
    '#60a5fa', // blue-400
    '#3b82f6', // blue-500
    '#2563eb', // blue-600
    '#1d4ed8', // blue-700
    '#1e40af', // blue-800
  ],

  /** Green sequential palette (9 shades) */
  greens: [
    '#f0fdf4', // green-50
    '#dcfce7', // green-100
    '#bbf7d0', // green-200
    '#86efac', // green-300
    '#4ade80', // green-400
    '#22c55e', // green-500
    '#16a34a', // green-600
    '#15803d', // green-700
    '#166534', // green-800
  ],

  /** Purple sequential palette (9 shades) */
  purples: [
    '#faf5ff', // purple-50
    '#f3e8ff', // purple-100
    '#e9d5ff', // purple-200
    '#d8b4fe', // purple-300
    '#c084fc', // purple-400
    '#a855f7', // purple-500
    '#9333ea', // purple-600
    '#7e22ce', // purple-700
    '#6b21a8', // purple-800
  ],

  /** Orange sequential palette (9 shades) */
  oranges: [
    '#fff7ed', // orange-50
    '#ffedd5', // orange-100
    '#fed7aa', // orange-200
    '#fdba74', // orange-300
    '#fb923c', // orange-400
    '#f97316', // orange-500
    '#ea580c', // orange-600
    '#c2410c', // orange-700
    '#9a3412', // orange-800
  ],
} as const;

/**
 * Diverging color palettes for data with a meaningful midpoint.
 * Colors diverge from a neutral center to two extremes.
 */
export const DIVERGING_PALETTES = {
  /** Red to blue diverging palette (11 colors) */
  redBlue: [
    '#b91c1c', // red-700
    '#dc2626', // red-600
    '#ef4444', // red-500
    '#f87171', // red-400
    '#fca5a5', // red-300
    '#e5e7eb', // gray-200 (neutral)
    '#93c5fd', // blue-300
    '#60a5fa', // blue-400
    '#3b82f6', // blue-500
    '#2563eb', // blue-600
    '#1d4ed8', // blue-700
  ],

  /** Orange to purple diverging palette (11 colors) */
  orangePurple: [
    '#c2410c', // orange-700
    '#ea580c', // orange-600
    '#f97316', // orange-500
    '#fb923c', // orange-400
    '#fdba74', // orange-300
    '#e5e7eb', // gray-200 (neutral)
    '#d8b4fe', // purple-300
    '#c084fc', // purple-400
    '#a855f7', // purple-500
    '#9333ea', // purple-600
    '#7e22ce', // purple-700
  ],

  /** Green to red diverging palette (11 colors) */
  greenRed: [
    '#15803d', // green-700
    '#16a34a', // green-600
    '#22c55e', // green-500
    '#4ade80', // green-400
    '#86efac', // green-300
    '#e5e7eb', // gray-200 (neutral)
    '#fca5a5', // red-300
    '#f87171', // red-400
    '#ef4444', // red-500
    '#dc2626', // red-600
    '#b91c1c', // red-700
  ],
} as const;

export type QualitativePaletteName = keyof typeof QUALITATIVE_PALETTES;
export type SequentialPaletteName = keyof typeof SEQUENTIAL_PALETTES;
export type DivergingPaletteName = keyof typeof DIVERGING_PALETTES;

export type ColorPalette = readonly string[];
