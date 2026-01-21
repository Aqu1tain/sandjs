import type { TreeNodeInput, SunburstConfig } from '../src/index.js';

export type TreeShape = 'balanced' | 'deep' | 'wide' | 'realistic';

export interface GeneratorOptions {
  nodeCount: number;
  shape?: TreeShape;
  maxDepth?: number;
  branchingFactor?: number;
}

export function generateTree(options: GeneratorOptions): TreeNodeInput {
  const { nodeCount, shape = 'balanced' } = options;

  switch (shape) {
    case 'deep':
      return generateDeepTree(nodeCount, options.maxDepth ?? 8);
    case 'wide':
      return generateWideTree(nodeCount);
    case 'realistic':
      return generateRealisticTree(nodeCount);
    default:
      return generateBalancedTree(nodeCount, options.branchingFactor ?? 5);
  }
}

function generateBalancedTree(nodeCount: number, branchingFactor: number): TreeNodeInput {
  let created = 0;
  const maxDepth = Math.min(Math.ceil(Math.log(nodeCount) / Math.log(branchingFactor)), 6);

  function createNode(depth: number): TreeNodeInput {
    created++;
    const remaining = nodeCount - created;
    const node: TreeNodeInput = {
      name: `Node-${created}`,
      value: Math.floor(Math.random() * 100) + 1,
    };

    if (remaining <= 0 || depth >= maxDepth) return node;

    const childCount = Math.min(branchingFactor, remaining);
    if (childCount > 0) {
      node.children = [];
      for (let i = 0; i < childCount && created < nodeCount; i++) {
        node.children.push(createNode(depth + 1));
      }
    }

    return node;
  }

  return createNode(0);
}

function generateDeepTree(nodeCount: number, maxDepth: number): TreeNodeInput {
  const depthToUse = Math.min(nodeCount - 1, maxDepth);
  let remaining = nodeCount;

  function createNode(depth: number): TreeNodeInput {
    remaining--;
    const node: TreeNodeInput = {
      name: `Deep-${nodeCount - remaining}`,
      value: Math.floor(Math.random() * 100) + 1,
    };

    if (remaining <= 0 || depth >= depthToUse) return node;

    const siblingCount = Math.min(Math.ceil(remaining / Math.max(1, depthToUse - depth)), 5);
    node.children = [];

    for (let i = 0; i < siblingCount && remaining > 0; i++) {
      node.children.push(createNode(depth + 1));
    }

    return node;
  }

  return createNode(0);
}

function generateWideTree(nodeCount: number): TreeNodeInput {
  const root: TreeNodeInput = {
    name: 'Root',
    value: 100,
    children: [],
  };

  for (let i = 1; i < nodeCount; i++) {
    root.children!.push({
      name: `Wide-${i}`,
      value: Math.floor(Math.random() * 100) + 1,
    });
  }

  return root;
}

function generateRealisticTree(nodeCount: number): TreeNodeInput {
  let created = 0;
  const maxDepth = 5;
  const baseChildren = Math.ceil(Math.pow(nodeCount, 1 / maxDepth));

  function createNode(depth: number): TreeNodeInput {
    created++;
    const node: TreeNodeInput = {
      name: `Item-${created}`,
      value: Math.floor(Math.random() * 1000) + 1,
    };

    const remaining = nodeCount - created;
    if (remaining <= 0 || depth >= maxDepth) return node;

    const levelsLeft = maxDepth - depth;
    const targetChildren = Math.min(
      Math.ceil(Math.pow(remaining, 1 / levelsLeft)),
      baseChildren,
      remaining
    );

    if (targetChildren > 0) {
      node.children = [];
      for (let i = 0; i < targetChildren && created < nodeCount; i++) {
        node.children.push(createNode(depth + 1));
      }
    }

    return node;
  }

  return createNode(0);
}

export function getTreeDepth(node: TreeNodeInput, depth = 0): number {
  if (!node.children || node.children.length === 0) return depth;
  return Math.max(...node.children.map(c => getTreeDepth(c, depth + 1)));
}

export function createConfig(tree: TreeNodeInput, expandLevels?: number): SunburstConfig {
  const depth = getTreeDepth(tree);
  const levels = expandLevels ?? depth + 2;

  return {
    size: { radius: 300 },
    layers: [
      {
        id: 'main',
        radialUnits: [0, levels],
        angleMode: 'free',
        tree,
      },
    ],
  };
}

export function countNodes(node: TreeNodeInput): number {
  let count = 1;
  if (node.children) {
    for (const child of node.children) {
      count += countNodes(child);
    }
  }
  return count;
}
