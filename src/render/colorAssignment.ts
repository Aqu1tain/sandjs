import type { LayoutArc } from '../types/index.js';
import type { ColorThemeOptions } from './types.js';
import {
  QUALITATIVE_PALETTES,
  SEQUENTIAL_PALETTES,
  DIVERGING_PALETTES,
  type ColorPalette,
} from './colorThemes.js';

/**
 * Resolves a color for a given arc based on theme configuration.
 * Returns the color string, or null if no theme is configured.
 */
export function createColorAssigner(
  themeOptions: ColorThemeOptions | undefined,
  allArcs: LayoutArc[],
): ((arc: LayoutArc, index: number) => string | null) {
  if (!themeOptions) {
    return () => null;
  }

  const palette = resolvePalette(themeOptions);
  const assignBy = themeOptions.assignBy ?? getDefaultAssignBy(themeOptions.type);
  const deriveKey = themeOptions.deriveKey;

  // Pre-compute value range for O(n) performance
  let valueRange: { min: number; max: number; range: number } | null = null;
  if (assignBy === 'value') {
    const values = allArcs.map(a => a.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    valueRange = { min, max, range: max - min };
  }

  // Build key->color mapping for consistent colors
  const keyColorMap = new Map<string | number, string>();
  const usedKeys = new Set<string | number>();

  // Pre-process arcs to build consistent mappings
  if (deriveKey || assignBy === 'key') {
    allArcs.forEach((arc, idx) => {
      const key = deriveKey ? deriveKey(arc) : getAssignmentKey(arc, idx, assignBy, allArcs, valueRange);
      if (key != null && !usedKeys.has(key)) {
        usedKeys.add(key);
        const colorIndex = usedKeys.size - 1;
        keyColorMap.set(key, palette[colorIndex % palette.length]);
      }
    });
  }

  return (arc: LayoutArc, index: number): string | null => {
    // Node color override takes precedence
    if (arc.data.color) {
      return null; // Let the renderer use arc.data.color
    }

    const key = deriveKey ? deriveKey(arc) : getAssignmentKey(arc, index, assignBy, allArcs, valueRange);

    if (key == null) {
      return palette[0]; // Fallback to first color
    }

    // For key-based assignment, use consistent mapping
    if (deriveKey || assignBy === 'key') {
      return keyColorMap.get(key) ?? palette[0];
    }

    // For numeric assignments (depth, index, value), map directly to palette
    if (typeof key === 'number') {
      const paletteIndex = Math.floor(key) % palette.length;
      return palette[paletteIndex];
    }

    // For string keys, hash to index
    return palette[hashString(key) % palette.length];
  };
}

function resolvePalette(options: ColorThemeOptions): ColorPalette {
  const { type, palette } = options;

  // If palette is an array, use it directly
  if (Array.isArray(palette)) {
    return palette;
  }

  // Otherwise resolve from built-in palettes
  if (type === 'qualitative') {
    return QUALITATIVE_PALETTES[palette as keyof typeof QUALITATIVE_PALETTES] ?? QUALITATIVE_PALETTES.default;
  }

  if (type === 'sequential') {
    return SEQUENTIAL_PALETTES[palette as keyof typeof SEQUENTIAL_PALETTES] ?? SEQUENTIAL_PALETTES.blues;
  }

  if (type === 'diverging') {
    return DIVERGING_PALETTES[palette as keyof typeof DIVERGING_PALETTES] ?? DIVERGING_PALETTES.redBlue;
  }

  return QUALITATIVE_PALETTES.default;
}

function getDefaultAssignBy(type: ColorThemeOptions['type']): 'depth' | 'key' | 'index' | 'value' {
  if (type === 'qualitative') {
    return 'key';
  }
  return 'depth'; // Sequential and diverging default to depth
}

function getAssignmentKey(
  arc: LayoutArc,
  index: number,
  assignBy: 'depth' | 'key' | 'index' | 'value',
  allArcs: LayoutArc[],
  valueRange: { min: number; max: number; range: number } | null,
): string | number {
  switch (assignBy) {
    case 'depth':
      return arc.depth;

    case 'key':
      return arc.key ?? `${arc.layerId}:${arc.pathIndices.join('.')}`;

    case 'index':
      return index;

    case 'value': {
      // Use pre-computed value range for O(n) performance
      if (!valueRange || valueRange.range === 0) {
        return 0;
      }
      const normalized = (arc.value - valueRange.min) / valueRange.range;
      return normalized; // Return 0-1 value, will be mapped to palette later
    }

    default:
      return arc.depth;
  }
}

/**
 * Simple string hash function for consistent color assignment
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.codePointAt(i) ?? 0;
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}
