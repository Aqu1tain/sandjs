import type { SunburstConfig, TreeNodeInput } from '../types/index.js';

export function cloneSunburstConfig(source: SunburstConfig): SunburstConfig {
  return {
    size: { ...source.size },
    layers: source.layers.map((layer) => ({
      ...layer,
      radialUnits: [...layer.radialUnits] as [number, number],
      tree: cloneTree(layer.tree),
    })),
  };
}

export function cloneTree(tree: TreeNodeInput | TreeNodeInput[]): TreeNodeInput | TreeNodeInput[] {
  if (Array.isArray(tree)) {
    return tree.map((node) => cloneNode(node));
  }
  return cloneNode(tree);
}

export function cloneNode(node: TreeNodeInput): TreeNodeInput {
  const clone: TreeNodeInput = { ...node };
  if (Array.isArray(node.children)) {
    clone.children = node.children.map((child) => cloneNode(child));
  }
  return clone;
}
