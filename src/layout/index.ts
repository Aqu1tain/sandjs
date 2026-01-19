import { LayoutArc, LayerConfig, SunburstConfig } from '../types/index.js';
import { normalizeTree, normalizePad, normalizeRotation, type MultiParentGroup } from './normalization.js';
import { layoutAlignedLayer } from './aligned.js';
import { layoutSiblingsFree } from './free.js';
import type { LayerContext } from './shared.js';

/**
 * Computes the polar coordinates for every visible arc in the provided configuration.
 *
 * @public
 */
export function layout(config: SunburstConfig): LayoutArc[] {
  if (!config.size || config.size.radius <= 0) {
    throw new Error('Sunburst size.radius must be a positive number');
  }

  if (!Array.isArray(config.layers) || config.layers.length === 0) {
    return [];
  }

  const maxUnit = config.layers.reduce((max, layer) => {
    const [, end] = layer.radialUnits;
    return Math.max(max, end);
  }, 0);

  if (maxUnit <= 0) {
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

  if (layerEnd <= layerStart) {
    throw new Error(`Layer "${layer.id}" must declare radialUnits with end > start`);
  }

  const normalizationResult = normalizeTree(layer.tree);
  const roots = normalizationResult.nodes;
  const multiParentGroups = normalizationResult.multiParentGroups;

  if (roots.length === 0 && multiParentGroups.length === 0) {
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

  // Layout normal nodes first
  layoutSiblingsFree({
    siblings: roots,
    context,
    startAngle,
    span,
    depthUnits: 0,
    depth: 0,
    padAngle: normalizePad(layer.padAngle),
  });

  // Layout multi-parent groups
  layoutMultiParentGroups({
    groups: multiParentGroups,
    context,
    padAngle: normalizePad(layer.padAngle),
  });

  return context.arcs;
}

/**
 * Layouts multi-parent groups by finding parent arcs and creating unified parent spans
 */
function layoutMultiParentGroups(params: {
  groups: MultiParentGroup[];
  context: LayerContext;
  padAngle: number;
}): void {
  const { groups, context, padAngle } = params;

  for (const group of groups) {
    // Find all arcs with keys matching the parent keys
    const parentArcs = context.arcs.filter(arc =>
      arc.key && group.parentKeys.includes(arc.key)
    );

    if (parentArcs.length === 0) {
      console.warn(
        `[Sand.js] Multi-parent group references non-existent parent keys: ${group.parentKeys.join(', ')}`
      );
      continue;
    }

    if (parentArcs.length !== group.parentKeys.length) {
      const foundKeys = new Set(parentArcs.map(arc => arc.key).filter(Boolean));
      const missingKeys = group.parentKeys.filter(key => !foundKeys.has(key));
      console.warn(
        `[Sand.js] Multi-parent group is missing parent arcs for keys: ${missingKeys.join(', ')}`
      );
    }

    // Validate: parent nodes should NOT have children
    const parentsWithChildren = parentArcs.filter(arc =>
      arc.data.children && arc.data.children.length > 0
    );

    if (parentsWithChildren.length > 0) {
      const invalidKeys = parentsWithChildren.map(arc => arc.key).filter(Boolean);
      console.error(
        `[Sand.js] ❌ Multi-parent validation failed: Parent nodes [${invalidKeys.join(', ')}] have children. ` +
        `Parent nodes referenced in 'parents' arrays should NOT have their own children. ` +
        `Skipping multi-parent group for: ${group.children.map(c => c.input.name).join(', ')}`
      );
      continue; // Skip this multi-parent group
    }

    // Calculate combined angular span
    const startAngle = Math.min(...parentArcs.map(arc => arc.x0));
    const endAngle = Math.max(...parentArcs.map(arc => arc.x1));
    const span = endAngle - startAngle;

    // Calculate depth (use maximum depth of parent arcs + 1)
    const maxParentDepth = Math.max(...parentArcs.map(arc => arc.depth));
    const depth = maxParentDepth + 1;

    // Calculate radial position in units (not pixels!)
    // Parent nodes are validated to have NO children, so we just use their y1
    const pixelsPerUnit = context.unitToRadius(1) - context.unitToRadius(0);
    const radiusToUnit = (pixels: number) => pixels / pixelsPerUnit;

    // Find the maximum y1 position in units, then subtract layerStart to get depthUnits
    const maxParentY1Units = Math.max(...parentArcs.map(arc => radiusToUnit(arc.y1)));
    const depthUnits = maxParentY1Units - context.layerStart;

    // Layout the children within the combined span
    layoutSiblingsFree({
      siblings: group.children,
      context,
      startAngle,
      span,
      depthUnits,
      depth,
      padAngle,
    });
  }
}
