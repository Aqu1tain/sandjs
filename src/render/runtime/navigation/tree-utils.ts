import type { SunburstConfig, TreeNodeInput } from '../../../types/index.js';

/**
 * Finds a node by key within a tree structure
 */
export function findNodeByKey(
  tree: TreeNodeInput | TreeNodeInput[],
  key: string,
  prefix: number[],
): { node: TreeNodeInput; path: number[] } | null {
  const nodes = Array.isArray(tree) ? tree : [tree];
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index];
    const path = prefix.concat(index);
    if (node?.key === key) {
      return { node, path };
    }
    if (Array.isArray(node?.children)) {
      const match = findNodeByKey(node.children, key, path);
      if (match) {
        return match;
      }
    }
  }
  return null;
}

/**
 * Gets a node at a specific path in the config
 */
export function getNodeAtPath(
  config: SunburstConfig,
  layerId: string,
  pathIndices: number[],
): TreeNodeInput | null {
  const layer = config.layers.find((candidate) => candidate.id === layerId);
  if (!layer) {
    return null;
  }
  const nodes = Array.isArray(layer.tree) ? layer.tree : [layer.tree];
  let current: TreeNodeInput | null = null;
  let siblings = nodes;
  for (const index of pathIndices) {
    current = siblings[index] ?? null;
    if (!current) {
      return null;
    }
    siblings = Array.isArray(current.children) ? current.children : [];
  }
  return current;
}

/**
 * Collects all nodes along a path
 */
export function collectNodesAlongPath(
  config: SunburstConfig,
  layerId: string,
  pathIndices: number[],
): TreeNodeInput[] | null {
  const layer = config.layers.find((candidate) => candidate.id === layerId);
  if (!layer) {
    return null;
  }
  const result: TreeNodeInput[] = [];
  const nodes = Array.isArray(layer.tree) ? layer.tree : [layer.tree];
  let siblings = nodes;
  for (const index of pathIndices) {
    const node = siblings[index];
    if (!node) {
      return null;
    }
    result.push(node);
    siblings = Array.isArray(node.children) ? node.children : [];
  }
  return result;
}

/**
 * Indexes a layer tree with source and path maps
 */
export function indexLayerTree(
  tree: TreeNodeInput | TreeNodeInput[],
  prefix: number[],
  sourceMap: WeakMap<TreeNodeInput, TreeNodeInput>,
  pathMap: WeakMap<TreeNodeInput, number[]>,
): void {
  const nodes = Array.isArray(tree) ? tree : [tree];
  nodes.forEach((node, index) => {
    const path = prefix.concat(index);
    sourceMap.set(node, node);
    pathMap.set(node, path);
    if (Array.isArray(node.children)) {
      indexLayerTree(node.children, path, sourceMap, pathMap);
    }
  });
}

/**
 * Indexes the entire base config with source and path maps
 */
export function indexBaseConfig(
  config: SunburstConfig,
  sourceMap: WeakMap<TreeNodeInput, TreeNodeInput>,
  pathMap: WeakMap<TreeNodeInput, number[]>,
): void {
  for (const layer of config.layers) {
    indexLayerTree(layer.tree, [], sourceMap, pathMap);
  }
}
