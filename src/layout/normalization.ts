import type { LayerConfig, TreeNodeInput } from '../types';
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
 * Represents a group of nodes that share the same parent keys
 */
export type MultiParentGroup = {
  parentKeys: string[];
  children: NormalizedNode[];
};

/**
 * Result of normalization including multi-parent groups
 */
export type NormalizationResult = {
  nodes: NormalizedNode[];
  multiParentGroups: MultiParentGroup[];
};

function isMultiParentNode(node: TreeNodeInput): boolean {
  return Boolean(node.parents && Array.isArray(node.parents) && node.parents.length > 1);
}

function warnMultiParentFeature(warnOnce: { warned: boolean }): void {
  if (warnOnce.warned) return;
  console.warn(
    '[Sand.js] ⚠️  EXPERIMENTAL FEATURE: Multi-parent nodes detected. ' +
    'Parent nodes with matching keys will be unified into a single combined arc. ' +
    'Use at your own risk.'
  );
  warnOnce.warned = true;
}

function addToMultiParentGroup(
  node: TreeNodeInput,
  index: number,
  parentPath: TreeNodeInput[],
  parentIndices: number[],
  multiParentGroups: Map<string, MultiParentGroup>,
): void {
  const sortedKeys = node.parents!.slice().sort((a, b) => a.localeCompare(b));
  const parentKey = sortedKeys.join(',');

  let group = multiParentGroups.get(parentKey);
  if (!group) {
    group = { parentKeys: sortedKeys, children: [] };
    multiParentGroups.set(parentKey, group);
  }

  const value = normalizeValue(node.value, 0);
  const baseExpand = normalizeExpandLevels(node.expandLevels);

  group.children.push({
    input: node,
    value,
    expandLevels: baseExpand,
    children: [],
    path: parentPath.concat(node),
    pathIndices: parentIndices.concat(index),
    collapsed: false,
    subtreeThickness: baseExpand,
  });
}

function normalizeValue(raw: number | undefined, fallback: number): number {
  const value = typeof raw === 'number' ? raw : fallback;
  return Number.isFinite(value) ? Math.max(value, 0) : 0;
}

/**
 * Normalizes the tree structure, computing values and expand levels.
 * Also extracts nodes with `parents` property into multi-parent groups.
 */
export function normalizeTree(
  tree: LayerConfig['tree'],
  parentPath: TreeNodeInput[] = [],
  parentIndices: number[] = [],
  multiParentGroups: Map<string, MultiParentGroup> = new Map(),
  warnOnce: { warned: boolean } = { warned: false },
): NormalizationResult {
  const nodes = Array.isArray(tree) ? tree : [tree];
  const isRoot = parentPath.length === 0;
  const normalized: NormalizedNode[] = [];

  nodes.forEach((node, index) => {
    if (!node || node.hidden) return;

    if (isMultiParentNode(node)) {
      warnMultiParentFeature(warnOnce);
      addToMultiParentGroup(node, index, parentPath, parentIndices, multiParentGroups);
      return;
    }

    normalized.push(normalizeNode(node, index, parentPath, parentIndices, multiParentGroups, warnOnce));
  });

  if (isRoot) {
    return { nodes: normalized, multiParentGroups: Array.from(multiParentGroups.values()) };
  }
  return { nodes: normalized, multiParentGroups: [] };
}

function normalizeNode(
  node: TreeNodeInput,
  index: number,
  parentPath: TreeNodeInput[],
  parentIndices: number[],
  multiParentGroups: Map<string, MultiParentGroup>,
  warnOnce: { warned: boolean },
): NormalizedNode {
  const children = Array.isArray(node.children) ? node.children : [];
  const path = parentPath.concat(node);
  const pathIndices = parentIndices.concat(index);
  const childResult = normalizeTree(children, path, pathIndices, multiParentGroups, warnOnce);
  const normalizedChildren = childResult.nodes;

  const collapsed = Boolean(node.collapsed);
  const childrenValue = normalizedChildren.reduce((sum, child) => sum + Math.max(child.value, 0), 0);
  const childThickness = normalizedChildren.reduce((max, child) => Math.max(max, child.subtreeThickness), 0);

  const value = normalizeValue(node.value, childrenValue);
  const baseExpand = normalizeExpandLevels(node.expandLevels);
  const expandLevels = collapsed ? baseExpand + childThickness : baseExpand;
  const subtreeThickness = expandLevels + (collapsed ? 0 : childThickness);

  return {
    input: node,
    value,
    expandLevels,
    children: collapsed ? [] : normalizedChildren,
    path,
    pathIndices,
    collapsed,
    subtreeThickness,
  };
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
