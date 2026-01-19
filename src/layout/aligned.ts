import type { LayoutArc } from '../types/index.js';
import { ZERO_TOLERANCE } from '../render/geometry.js';
import type { NormalizedNode } from './normalization.js';
import { normalizePad, normalizeRotation } from './normalization.js';
import type { LayerContext } from './shared.js';
import { createArc } from './shared.js';
import { layoutSiblingsFree } from './free.js';

function getSourceLayer(
  layerId: string,
  alignWith: string | undefined,
  previousLayers: Map<string, LayoutArc[]>,
): LayoutArc[] {
  if (!alignWith) {
    throw new Error(`Layer "${layerId}" is set to angleMode="align" but has no alignWith target`);
  }
  const sourceLayer = previousLayers.get(alignWith);
  if (!sourceLayer) {
    throw new Error(`Layer "${layerId}" references unknown alignWith layer "${alignWith}"`);
  }
  return sourceLayer;
}

function buildRootSourceMap(sourceLayer: LayoutArc[], alignWith: string): Map<string, LayoutArc> {
  const map = new Map<string, LayoutArc>();
  for (const arc of sourceLayer) {
    if (arc.depth === 0 && arc.key && !map.has(arc.key)) {
      map.set(arc.key, arc);
    }
  }
  if (map.size === 0) {
    throw new Error(`Layer "${alignWith}" does not expose keyed root arcs for alignment`);
  }
  return map;
}

function getAlignedSlot(
  node: NormalizedNode,
  rootSourceByKey: Map<string, LayoutArc>,
  layerId: string,
  alignWith: string,
): LayoutArc {
  const key = node.input.key;
  if (!key) {
    throw new Error(`Layer "${layerId}" uses align mode but node "${node.input.name}" is missing a key`);
  }
  const slot = rootSourceByKey.get(key);
  if (!slot) {
    throw new Error(`Layer "${layerId}" could not find aligned arc for key "${key}" on layer "${alignWith}"`);
  }
  return slot;
}

function computeTrimmedBounds(slot: LayoutArc, layerPad: number): { start: number; end: number } | null {
  const span = slot.x1 - slot.x0;
  if (span < ZERO_TOLERANCE) return null;

  const start = slot.x0 + layerPad * 0.5;
  const end = slot.x1 - layerPad * 0.5;
  if (end - start < ZERO_TOLERANCE) return null;

  return { start, end };
}

function layoutAlignedNode(
  node: NormalizedNode,
  bounds: { start: number; end: number },
  baseRotation: number,
  layerPad: number,
  context: LayerContext,
): void {
  const localSpan = bounds.end - bounds.start;
  const rotation = normalizeRotation(baseRotation, localSpan);
  const startAngle = bounds.start + rotation;

  const placement = createArc({
    node,
    context,
    startAngle,
    span: localSpan,
    parentStart: bounds.start,
    parentEnd: bounds.end,
    depthUnits: 0,
    depth: 0,
    percentage: 1,
  });
  context.arcs.push(placement.arc);

  if (node.children.length === 0) return;

  layoutSiblingsFree({
    siblings: node.children,
    context,
    startAngle: placement.startAngle,
    span: placement.span,
    depthUnits: node.expandLevels,
    depth: 1,
    padAngle: normalizePad(node.input.padAngle ?? layerPad),
  });
}

function fallbackToFreeLayout(roots: NormalizedNode[], context: LayerContext, totalAngle: number): void {
  const { layer } = context;
  const startAngle = normalizeRotation(typeof layer.baseOffset === 'number' ? layer.baseOffset : 0, totalAngle);
  layoutSiblingsFree({
    siblings: roots,
    context,
    startAngle,
    span: totalAngle,
    depthUnits: 0,
    depth: 0,
    padAngle: normalizePad(layer.padAngle),
  });
}

export function layoutAlignedLayer(
  roots: NormalizedNode[],
  context: LayerContext,
  totalAngle: number,
  previousLayers: Map<string, LayoutArc[]>,
): LayoutArc[] {
  const { layer } = context;
  const alignWith = layer.alignWith!;

  const sourceLayer = getSourceLayer(layer.id, layer.alignWith, previousLayers);
  const rootSourceByKey = buildRootSourceMap(sourceLayer, alignWith);

  const layerPad = normalizePad(layer.padAngle);
  const baseRotation = typeof layer.baseOffset === 'number' ? layer.baseOffset : 0;

  for (const node of roots) {
    const slot = getAlignedSlot(node, rootSourceByKey, layer.id, alignWith);
    const bounds = computeTrimmedBounds(slot, layerPad);
    if (!bounds) continue;

    layoutAlignedNode(node, bounds, baseRotation, layerPad, context);
    rootSourceByKey.delete(node.input.key!);
  }

  if (context.arcs.length === 0) {
    fallbackToFreeLayout(roots, context, totalAngle);
  }

  return context.arcs;
}
