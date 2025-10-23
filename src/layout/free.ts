import { ZERO_TOLERANCE } from '../render/geometry.js';
import type { NormalizedNode } from './normalization.js';
import { normalizePad } from './normalization.js';
import type { LayerContext } from './shared.js';
import { createArc } from './shared.js';

/**
 * Layouts siblings in free mode, distributing angular space based on values
 */
export function layoutSiblingsFree(params: {
  siblings: NormalizedNode[];
  context: LayerContext;
  startAngle: number;
  span: number;
  depthUnits: number;
  depth: number;
  padAngle: number;
}): void {
  const { siblings, context, startAngle, span, depthUnits, depth, padAngle } = params;
  let visible = siblings.filter((node) => node.value > 0 || node.children.length > 0);
  if (visible.length === 0) {
    visible = siblings.slice();
  }
  if (visible.length === 0) {
    return;
  }

  const layer = context.layer;
  const totalValue = visible.reduce((sum, node) => sum + Math.max(node.value, 0), 0);
  const gaps: number[] = visible.map((node, index) =>
    index < visible.length - 1
      ? normalizePad(node.input.padAngle ?? layer.padAngle ?? padAngle)
      : 0,
  );
  const gapTotal = gaps.reduce((sum, gap) => sum + gap, 0);
  const availableSpan = Math.max(span - gapTotal, 0);
  if (availableSpan <= ZERO_TOLERANCE) {
    return;
  }

  let cursor = startAngle;
  const denominator = totalValue > 0 ? totalValue : visible.length;

  visible.forEach((node, index) => {
    const weight = totalValue > 0 ? Math.max(node.value, 0) : 1;
    const share = denominator > 0 ? weight / denominator : 0;
    const nodeSpan = share * availableSpan;
    const gapAfter = gaps[index] ?? 0;
    const gapBefore = index > 0 ? gaps[index - 1] ?? 0 : 0;
    const slotStart = cursor;
    const slotEnd = slotStart + nodeSpan;
    const groupStart = startAngle;
    const groupEnd = startAngle + span;
    const parentStart = Math.max(groupStart, slotStart - gapBefore);
    const parentEnd = Math.min(groupEnd, slotEnd + gapAfter);

    if (nodeSpan < ZERO_TOLERANCE) {
      cursor = parentEnd + gapAfter;
      return;
    }

    const placement = createArc({
      node,
      context,
      startAngle: cursor,
      span: nodeSpan,
      parentStart,
      parentEnd,
      depthUnits,
      depth,
      percentage: share,
    });
    context.arcs.push(placement.arc);

    if (node.children.length > 0) {
      const childPad = normalizePad(node.input.padAngle ?? padAngle);
      layoutSiblingsFree({
        siblings: node.children,
        context,
        startAngle: placement.startAngle,
        span: placement.span,
        depthUnits: depthUnits + node.expandLevels,
        depth: depth + 1,
        padAngle: childPad,
      });
    }

    cursor = slotEnd + gapAfter;
  });
}
