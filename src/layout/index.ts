import { LayoutArc, LayerConfig, SunburstConfig, TreeNodeInput } from '../types';

type NormalizedNode = {
  input: TreeNodeInput;
  value: number;
  expandLevels: number;
  children: NormalizedNode[];
};

type LayerContext = {
  layer: LayerConfig;
  unitToRadius: (units: number) => number;
  layerStart: number;
  layerEnd: number;
  arcs: LayoutArc[];
};

const ZERO_TOLERANCE = 1e-6;

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

  const startAngle = typeof layer.baseOffset === 'number' ? layer.baseOffset : 0;
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

  for (const node of roots) {
    const key = node.input.key;
    if (!key) {
      throw new Error(`Layer "${layer.id}" uses align mode but node "${node.input.name}" is missing a key`);
    }

    const slot = rootSourceByKey.get(key);
    if (!slot) {
      throw new Error(`Layer "${layer.id}" could not find aligned arc for key "${key}" on layer "${alignWith}"`);
    }

    const padAngle = normalizePad(layer.padAngle);
    const span = slot.x1 - slot.x0;
    if (span < ZERO_TOLERANCE) {
      continue;
    }

    const arc = createArc({
      node,
      context,
      startAngle: slot.x0,
      span,
      depthUnits: 0,
      depth: 0,
      percentage: slot.percentage,
    });
    context.arcs.push(arc);

    if (node.children.length > 0) {
      layoutSiblingsFree({
        siblings: node.children,
        context,
        startAngle: slot.x0,
        span,
        depthUnits: node.expandLevels,
        depth: 1,
        padAngle,
      });
    }

    rootSourceByKey.delete(key);
  }

  if (context.arcs.length === 0) {
    // No aligned arcs were created; fallback to free layout so layer still renders.
    const startAngle = typeof layer.baseOffset === 'number' ? layer.baseOffset : 0;
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

  const totalValue = visible.reduce((sum, node) => sum + Math.max(node.value, 0), 0);
  const gapCount = Math.max(visible.length - 1, 0);
  const gapTotal = padAngle * gapCount;
  const availableSpan = Math.max(span - gapTotal, 0);

  let cursor = startAngle;
  const denominator = totalValue > 0 ? totalValue : visible.length;

  visible.forEach((node, index) => {
    const weight = totalValue > 0 ? Math.max(node.value, 0) : 1;
    const share = denominator > 0 ? weight / denominator : 0;
    const nodeSpan = share * availableSpan;

    if (nodeSpan < ZERO_TOLERANCE) {
      cursor += index < visible.length - 1 ? padAngle : 0;
      return;
    }

    const arc = createArc({
      node,
      context,
      startAngle: cursor,
      span: nodeSpan,
      depthUnits,
      depth,
      percentage: share,
    });
    context.arcs.push(arc);

    if (node.children.length > 0) {
      layoutSiblingsFree({
        siblings: node.children,
        context,
        startAngle: cursor,
        span: nodeSpan,
        depthUnits: depthUnits + node.expandLevels,
        depth: depth + 1,
        padAngle,
      });
    }

    cursor = cursor + nodeSpan + (index < visible.length - 1 ? padAngle : 0);
  });
}

function createArc(params: {
  node: NormalizedNode;
  context: LayerContext;
  startAngle: number;
  span: number;
  depthUnits: number;
  depth: number;
  percentage: number;
}): LayoutArc {
  const { node, context, startAngle, span, depthUnits, depth, percentage } = params;
  const { unitToRadius, layerStart, layerEnd, layer } = context;

  const y0Units = layerStart + depthUnits;
  const y1Units = Math.min(layerEnd, y0Units + node.expandLevels);

  if (y1Units - y0Units < ZERO_TOLERANCE) {
    throw new Error(`Layer "${layer.id}" ran out of radial space while placing node "${node.input.name}"`);
  }

  const x0 = startAngle;
  const x1 = startAngle + span;

  return {
    layerId: layer.id,
    data: node.input,
    x0,
    x1,
    y0: unitToRadius(y0Units),
    y1: unitToRadius(y1Units),
    depth,
    key: node.input.key,
    percentage,
  };
}

function normalizeTree(tree: LayerConfig['tree']): NormalizedNode[] {
  const nodes = Array.isArray(tree) ? tree : [tree];
  const normalized: NormalizedNode[] = [];

  for (const node of nodes) {
    if (!node || node.hidden) {
      continue;
    }

    const children = Array.isArray(node.children) ? node.children : [];
    const normalizedChildren = normalizeTree(children);
    const childrenValue = normalizedChildren.reduce((sum, child) => sum + Math.max(child.value, 0), 0);

    const rawValue = typeof node.value === 'number' ? node.value : childrenValue;
    const value = Number.isFinite(rawValue) ? Math.max(rawValue, 0) : 0;
    const expandLevels = normalizeExpandLevels(node.expandLevels);

    normalized.push({
      input: node,
      value,
      expandLevels,
      children: normalizedChildren,
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
