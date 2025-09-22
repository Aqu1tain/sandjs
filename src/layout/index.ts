import { LayoutArc, LayerConfig, SunburstConfig, TreeNodeInput } from '../types/index.js';

type NormalizedNode = {
  input: TreeNodeInput;
  value: number;
  expandLevels: number;
  children: NormalizedNode[];
  path: TreeNodeInput[];
  collapsed: boolean;
};

type LayerContext = {
  layer: LayerConfig;
  unitToRadius: (units: number) => number;
  layerStart: number;
  layerEnd: number;
  arcs: LayoutArc[];
};

const ZERO_TOLERANCE = 1e-6;

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

function layoutAlignedLayer(
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

function layoutSiblingsFree(params: {
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

type ArcPlacement = {
  arc: LayoutArc;
  startAngle: number;
  span: number;
};

function createArc(params: {
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
    percentage,
  };
  return { arc, startAngle: x0, span };
}

function resolveArcStart(
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

function resolveNodeOffset(node: TreeNodeInput, layer: LayerConfig): number {
  if (typeof node.offset === 'number') {
    return node.offset;
  }
  if (typeof layer.defaultArcOffset === 'number') {
    return layer.defaultArcOffset;
  }
  return 0;
}

function normalizeTree(tree: LayerConfig['tree'], parentPath: TreeNodeInput[] = []): NormalizedNode[] {
  const nodes = Array.isArray(tree) ? tree : [tree];
  const normalized: NormalizedNode[] = [];

  for (const node of nodes) {
    if (!node || node.hidden) {
      continue;
    }

    const children = Array.isArray(node.children) ? node.children : [];
    const path = parentPath.concat(node);
    const normalizedChildren = normalizeTree(children, path);
    const collapsed = Boolean(node.collapsed);
    const childrenValue = normalizedChildren.reduce((sum, child) => sum + Math.max(child.value, 0), 0);

    const rawValue = typeof node.value === 'number' ? node.value : childrenValue;
    const value = Number.isFinite(rawValue) ? Math.max(rawValue, 0) : 0;
    const expandLevels = normalizeExpandLevels(node.expandLevels);

    normalized.push({
      input: node,
      value,
      expandLevels,
      children: collapsed ? [] : normalizedChildren,
      path,
      collapsed,
    });
  }

  return normalized;
}

function normalizeExpandLevels(value: number | undefined): number {
  if (typeof value === 'number' && value > 0) {
    return value;
  }
  return 1;
}

function normalizePad(value: number | undefined): number {
  if (typeof value === 'number' && value > 0) {
    return value;
  }
  return 0;
}

function clampArcStart(value: number, min: number, max: number): number {
  if (max < min) {
    return min;
  }
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
}

function normalizeRotation(offset: number, span: number): number {
  if (!Number.isFinite(offset) || span <= ZERO_TOLERANCE) {
    return 0;
  }
  const mod = offset % span;
  return mod >= 0 ? mod : mod + span;
}
