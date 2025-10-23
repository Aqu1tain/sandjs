import { LayoutArc, LayerConfig, SunburstConfig } from '../types/index.js';
import { normalizeTree, normalizePad, normalizeRotation } from './normalization.js';
import { layoutAlignedLayer } from './aligned.js';
import { layoutSiblingsFree } from './free.js';
import type { LayerContext } from './shared.js';

/**
 * Computes the polar coordinates for every visible arc in the provided configuration.
 *
 * @public
 */
export function layout(config: SunburstConfig): LayoutArc[] {
  if (!config.size || !(config.size.radius > 0)) {
    throw new Error('Sunburst size.radius must be a positive number');
  }

  if (!Array.isArray(config.layers) || config.layers.length === 0) {
    return [];
  }

  const maxUnit = config.layers.reduce((max, layer) => {
    const [, end] = layer.radialUnits;
    return Math.max(max, end);
  }, 0);

  if (!(maxUnit > 0)) {
    throw new Error('Layer radialUnits must define a positive range');
  }

  const unitToRadius = (units: number) => (units / maxUnit) * config.size.radius;
  const totalAngle = typeof config.size.angle === 'number' ? config.size.angle : Math.PI * 2;

  const result: LayoutArc[] = [];
  const computedLayers = new Map<string, LayoutArc[]>();

  for (const layer of config.layers) {
    const layerArcs = layoutLayer({
      layer,
      config,
      totalAngle,
      unitToRadius,
      previousLayers: computedLayers,
    });
    result.push(...layerArcs);
    computedLayers.set(layer.id, layerArcs);
  }

  return result;
}

function layoutLayer(params: {
  layer: LayerConfig;
  config: SunburstConfig;
  totalAngle: number;
  unitToRadius: (units: number) => number;
  previousLayers: Map<string, LayoutArc[]>;
}): LayoutArc[] {
  const { layer, unitToRadius, totalAngle, previousLayers } = params;
  const [layerStart, layerEnd] = layer.radialUnits;

  if (!(layerEnd > layerStart)) {
    throw new Error(`Layer "${layer.id}" must declare radialUnits with end > start`);
  }

  const roots = normalizeTree(layer.tree);
  if (roots.length === 0) {
    return [];
  }

  const context: LayerContext = {
    layer,
    unitToRadius,
    layerStart,
    layerEnd,
    arcs: [],
  };

  if (layer.angleMode === 'align') {
    return layoutAlignedLayer(roots, context, totalAngle, previousLayers);
  }

  const startAngle = normalizeRotation(
    typeof layer.baseOffset === 'number' ? layer.baseOffset : 0,
    totalAngle,
  );
  const span = totalAngle;
  layoutSiblingsFree({
    siblings: roots,
    context,
    startAngle,
    span,
    depthUnits: 0,
    depth: 0,
    padAngle: normalizePad(layer.padAngle),
  });

  return context.arcs;
}
