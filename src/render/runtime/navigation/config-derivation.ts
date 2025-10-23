import type { SunburstConfig, TreeNodeInput } from '../../../types/index.js';
import type { FocusTarget } from './types.js';
import { findNodeByKey } from './tree-utils.js';

/**
 * Derives a focused config from the base config
 */
export function deriveConfig(
  base: SunburstConfig,
  focus: FocusTarget,
  sourceMap: WeakMap<TreeNodeInput, TreeNodeInput>,
  pathMap: WeakMap<TreeNodeInput, number[]>,
  pathStore: WeakMap<TreeNodeInput, number[]>,
): SunburstConfig {
  return {
    ...base,
    layers: base.layers.map((layer) => {
      const nextTree = deriveLayerTree(layer.tree, layer.id, focus, sourceMap, pathMap, pathStore);
      if (nextTree === layer.tree) {
        return layer;
      }
      return {
        ...layer,
        tree: nextTree,
      };
    }),
  };
}

/**
 * Derives the tree for a layer based on the focus
 */
function deriveLayerTree(
  tree: TreeNodeInput | TreeNodeInput[],
  layerId: string,
  focus: FocusTarget,
  sourceMap: WeakMap<TreeNodeInput, TreeNodeInput>,
  pathMap: WeakMap<TreeNodeInput, number[]>,
  pathStore: WeakMap<TreeNodeInput, number[]>,
): TreeNodeInput | TreeNodeInput[] {
  if (layerId === focus.layerId) {
    return cloneFocusedNode(focus.node, focus.pathIndices, sourceMap, pathMap, pathStore);
  }
  if (!focus.key) {
    return tree;
  }
  const match = findNodeByKey(tree, focus.key, []);
  if (!match) {
    return tree;
  }
  return cloneFocusedNode(match.node, match.path, sourceMap, pathMap, pathStore);
}

/**
 * Clones a focused node and its children, updating source and path maps
 */
function cloneFocusedNode(
  node: TreeNodeInput,
  path: number[],
  sourceMap: WeakMap<TreeNodeInput, TreeNodeInput>,
  pathMap: WeakMap<TreeNodeInput, number[]>,
  pathStore: WeakMap<TreeNodeInput, number[]>,
): TreeNodeInput {
  const clone: TreeNodeInput = { ...node };
  sourceMap.set(clone, node);
  pathMap.set(clone, path);
  pathStore.set(clone, path);
  if (Array.isArray(node.children)) {
    clone.children = node.children.map((child, index) =>
      cloneFocusedNode(child, path.concat(index), sourceMap, pathMap, pathStore),
    );
  }
  return clone;
}
