import type { LayoutArc, LayerConfig, TreeNodeInput } from '../types/index.js';
import { ZERO_TOLERANCE } from '../render/geometry.js';
import type { NormalizedNode } from './normalization.js';
import { clampArcStart } from './normalization.js';

export type LayerContext = {
  layer: LayerConfig;
  unitToRadius: (units: number) => number;
  layerStart: number;
  layerEnd: number;
  arcs: LayoutArc[];
};

export type ArcPlacement = {
  arc: LayoutArc;
  startAngle: number;
  span: number;
};

/**
 * Creates an arc with proper bounds and placement
 */
export function createArc(params: {
  node: NormalizedNode;
  context: LayerContext;
  startAngle: number;
  span: number;
  parentStart: number;
  parentEnd: number;
  depthUnits: number;
  depth: number;
  percentage: number;
}): ArcPlacement {
  const { node, context, startAngle, span, parentStart, parentEnd, depthUnits, depth, percentage } = params;
  const { unitToRadius, layerStart, layerEnd, layer } = context;

  const y0Units = layerStart + depthUnits;
  const y1Units = Math.min(layerEnd, y0Units + node.expandLevels);

  if (y1Units - y0Units < ZERO_TOLERANCE) {
    throw new Error(`Layer "${layer.id}" ran out of radial space while placing node "${node.input.name}"`);
  }

  const x0 = clampArcStart(
    resolveArcStart(startAngle, span, parentStart, parentEnd, node.input, layer),
    parentStart,
    parentEnd - span,
  );
  const x1 = x0 + span;

  const arc: LayoutArc = {
    layerId: layer.id,
    data: node.input,
    x0,
    x1,
    y0: unitToRadius(y0Units),
    y1: unitToRadius(y1Units),
    depth,
    key: node.input.key,
    value: node.value,
    path: node.path,
    pathIndices: node.pathIndices,
    percentage,
  };
  return { arc, startAngle: x0, span };
}

/**
 * Resolves the arc start angle with offsets applied
 */
export function resolveArcStart(
  baseStart: number,
  span: number,
  parentStart: number,
  parentEnd: number,
  node: TreeNodeInput,
  layer: LayerConfig,
): number {
  const offset = resolveNodeOffset(node, layer);
  if (!offset) {
    return baseStart;
  }

  const mode = layer.arcOffsetMode ?? 'relative';
  if (mode === 'absolute') {
    return baseStart + offset;
  }

  const available = Math.max(parentEnd - parentStart, 0);
  const scaled = available > 0 ? offset * available : 0;
  return baseStart + scaled;
}

/**
 * Resolves the offset for a node, preferring node-level over layer defaults
 */
export function resolveNodeOffset(node: TreeNodeInput, layer: LayerConfig): number {
  if (typeof node.offset === 'number') {
    return node.offset;
  }
  if (typeof layer.defaultArcOffset === 'number') {
    return layer.defaultArcOffset;
  }
  return 0;
}
