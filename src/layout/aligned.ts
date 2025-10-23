import type { LayoutArc } from '../types/index.js';
import { ZERO_TOLERANCE } from '../render/geometry.js';
import type { NormalizedNode } from './normalization.js';
import { normalizePad, normalizeRotation } from './normalization.js';
import type { LayerContext } from './shared.js';
import { createArc } from './shared.js';
import { layoutSiblingsFree } from './free.js';

/**
 * Layouts a layer in aligned mode, matching arcs to keyed arcs from a previous layer
 */
export function layoutAlignedLayer(
  roots: NormalizedNode[],
  context: LayerContext,
  totalAngle: number,
  previousLayers: Map<string, LayoutArc[]>,
): LayoutArc[] {
  const { layer } = context;
  const alignWith = layer.alignWith;
  if (!alignWith) {
    throw new Error(`Layer "${layer.id}" is set to angleMode="align" but has no alignWith target`);
  }

  const sourceLayer = previousLayers.get(alignWith);
  if (!sourceLayer) {
    throw new Error(`Layer "${layer.id}" references unknown alignWith layer "${alignWith}"`);
  }

  const rootSourceByKey = new Map<string, LayoutArc>();
  for (const arc of sourceLayer) {
    if (arc.depth === 0 && arc.key) {
      if (!rootSourceByKey.has(arc.key)) {
        rootSourceByKey.set(arc.key, arc);
      }
    }
  }

  if (rootSourceByKey.size === 0) {
    throw new Error(`Layer "${alignWith}" does not expose keyed root arcs for alignment`);
  }

  const layerPad = normalizePad(layer.padAngle);
  const baseRotation = typeof layer.baseOffset === 'number' ? layer.baseOffset : 0;

  for (const node of roots) {
    const key = node.input.key;
    if (!key) {
      throw new Error(`Layer "${layer.id}" uses align mode but node "${node.input.name}" is missing a key`);
    }

    const slot = rootSourceByKey.get(key);
    if (!slot) {
      throw new Error(`Layer "${layer.id}" could not find aligned arc for key "${key}" on layer "${alignWith}"`);
    }

    const span = slot.x1 - slot.x0;
    if (span < ZERO_TOLERANCE) {
      continue;
    }

    const trimmedStart = slot.x0 + layerPad * 0.5;
    const trimmedEnd = slot.x1 - layerPad * 0.5;
    if (trimmedEnd - trimmedStart < ZERO_TOLERANCE) {
      continue;
    }

    const localSpan = trimmedEnd - trimmedStart;
    const rotation = normalizeRotation(baseRotation, localSpan > ZERO_TOLERANCE ? localSpan : span);
    const baseStart = trimmedStart + rotation;

    const placement = createArc({
      node,
      context,
      startAngle: baseStart,
      span: localSpan,
      parentStart: trimmedStart,
      parentEnd: trimmedEnd,
      depthUnits: 0,
      depth: 0,
      percentage: 1,
    });
    context.arcs.push(placement.arc);

    if (node.children.length > 0) {
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

    rootSourceByKey.delete(key);
  }

  if (context.arcs.length === 0) {
    // No aligned arcs were created; fallback to free layout so layer still renders.
    const startAngle = normalizeRotation(
      typeof layer.baseOffset === 'number' ? layer.baseOffset : 0,
      totalAngle,
    );
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

  return context.arcs;
}
