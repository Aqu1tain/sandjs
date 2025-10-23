import type { LayerConfig, TreeNodeInput } from '../types/index.js';
import { ZERO_TOLERANCE } from '../render/geometry.js';

export type NormalizedNode = {
  input: TreeNodeInput;
  value: number;
  expandLevels: number;
  children: NormalizedNode[];
  path: TreeNodeInput[];
  pathIndices: number[];
  collapsed: boolean;
  subtreeThickness: number;
};

/**
 * Normalizes the tree structure, computing values and expand levels
 */
export function normalizeTree(
  tree: LayerConfig['tree'],
  parentPath: TreeNodeInput[] = [],
  parentIndices: number[] = [],
): NormalizedNode[] {
  const nodes = Array.isArray(tree) ? tree : [tree];
  const normalized: NormalizedNode[] = [];

  nodes.forEach((node, index) => {
    if (!node || node.hidden) {
      return;
    }

    const children = Array.isArray(node.children) ? node.children : [];
    const path = parentPath.concat(node);
    const pathIndices = parentIndices.concat(index);
    const normalizedChildren = normalizeTree(children, path, pathIndices);
    const collapsed = Boolean(node.collapsed);
    const childrenValue = normalizedChildren.reduce((sum, child) => sum + Math.max(child.value, 0), 0);
    const childThickness = normalizedChildren.reduce(
      (max, child) => Math.max(max, child.subtreeThickness),
      0,
    );

    const rawValue = typeof node.value === 'number' ? node.value : childrenValue;
    const value = Number.isFinite(rawValue) ? Math.max(rawValue, 0) : 0;
    const baseExpand = normalizeExpandLevels(node.expandLevels);
    const expandLevels = collapsed ? baseExpand + childThickness : baseExpand;
    const subtreeThickness = expandLevels + (collapsed ? 0 : childThickness);

    normalized.push({
      input: node,
      value,
      expandLevels,
      children: collapsed ? [] : normalizedChildren,
      path,
      pathIndices,
      collapsed,
      subtreeThickness,
    });
  });

  return normalized;
}

/**
 * Normalizes expandLevels to a positive number, defaults to 1
 */
export function normalizeExpandLevels(value: number | undefined): number {
  if (typeof value === 'number' && value > 0) {
    return value;
  }
  return 1;
}

/**
 * Normalizes padding values to non-negative numbers
 */
export function normalizePad(value: number | undefined): number {
  if (typeof value === 'number' && value > 0) {
    return value;
  }
  return 0;
}

/**
 * Clamps arc start position within min/max range
 */
export function clampArcStart(value: number, min: number, max: number): number {
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

/**
 * Normalizes rotation offset within the span
 */
export function normalizeRotation(offset: number, span: number): number {
  if (!Number.isFinite(offset) || span <= ZERO_TOLERANCE) {
    return 0;
  }
  const mod = offset % span;
  return mod >= 0 ? mod : mod + span;
}
