import type { LayoutArc, TreeNodeInput } from '../../../types/index.js';
import type { NavigationOptions, RenderSvgOptions } from '../../types.js';
import { arcIdentifierFromPath, resolveArcKey, resolveNodeKey } from '../../keys.js';
import type { FocusTarget, NavigationTransitionContext } from './types.js';
import { collectNodesAlongPath } from './tree-utils.js';
import type { SunburstConfig } from '../../../types/index.js';

/**
 * Creates a focus target from an arc
 */
export function createFocusTargetFromArc(
  arc: LayoutArc,
  nodeSourceMap: WeakMap<TreeNodeInput, TreeNodeInput>,
  nodePathMap: WeakMap<TreeNodeInput, number[]>,
  sourcePathMap: WeakMap<TreeNodeInput, number[]>,
  storedBaseConfig: SunburstConfig,
): FocusTarget | null {
  const baseNodeInfo = getBaseNodeInfo(arc, nodeSourceMap, nodePathMap, sourcePathMap);
  if (!baseNodeInfo) {
    return null;
  }
  const layerId = arc.layerId;
  const pathNodes = collectNodesAlongPath(storedBaseConfig, layerId, baseNodeInfo.pathIndices);
  if (!pathNodes) {
    return null;
  }
  const identifier = arcIdentifierFromPath(layerId, baseNodeInfo.pathIndices);
  return {
    layerId,
    pathIndices: baseNodeInfo.pathIndices,
    node: baseNodeInfo.node,
    pathNodes,
    key: baseNodeInfo.key,
    identifier,
    arc,
  };
}

/**
 * Creates a focus target from a path
 */
export function createFocusTargetFromPath(
  layerId: string,
  pathIndices: number[],
  storedBaseConfig: SunburstConfig,
  nodePathMap: WeakMap<TreeNodeInput, number[]>,
  arcByIdentifier: Map<string, LayoutArc>,
  getNodeAtPath: (config: SunburstConfig, layerId: string, pathIndices: number[]) => TreeNodeInput | null,
): FocusTarget | null {
  const node = getNodeAtPath(storedBaseConfig, layerId, pathIndices);
  if (!node) {
    return null;
  }
  const pathNodes = collectNodesAlongPath(storedBaseConfig, layerId, pathIndices);
  if (!pathNodes) {
    return null;
  }
  const identifier = arcIdentifierFromPath(layerId, pathIndices);
  const key = resolveNodeKey(node);
  const arc = arcByIdentifier.get(identifier);
  return {
    layerId,
    pathIndices,
    node,
    pathNodes,
    key,
    identifier,
    arc,
  };
}

/**
 * Gets base node info from an arc
 */
function getBaseNodeInfo(
  arc: LayoutArc,
  nodeSourceMap: WeakMap<TreeNodeInput, TreeNodeInput>,
  nodePathMap: WeakMap<TreeNodeInput, number[]>,
  sourcePathMap: WeakMap<TreeNodeInput, number[]>,
): {
  node: TreeNodeInput;
  pathIndices: number[];
  key: string | null;
} | null {
  const sourceNode = nodeSourceMap.get(arc.data) ?? arc.data;
  const path = sourcePathMap.get(arc.data) ?? nodePathMap.get(sourceNode) ?? arc.pathIndices;
  if (!path) {
    return null;
  }
  const key = resolveArcKey(arc);
  nodeSourceMap.set(sourceNode, sourceNode);
  nodePathMap.set(sourceNode, path);
  return {
    node: sourceNode,
    pathIndices: path,
    key,
  };
}

/**
 * Computes the transition for focus changes
 */
export function computeFocusTransition(
  value: NavigationOptions['focusTransition'],
): RenderSvgOptions['transition'] {
  if (value === false) {
    return false;
  }
  if (value === undefined || value === true) {
    return true;
  }
  return value;
}

/**
 * Creates a transition context for navigation
 */
export function createTransitionContext(
  value: NavigationOptions['focusTransition'],
): NavigationTransitionContext {
  const transition = computeFocusTransition(value);
  return {
    transition,
    morph: transition !== false,
  };
}

/**
 * Checks if two focus targets are the same
 */
export function isSameFocus(a: FocusTarget, b: FocusTarget): boolean {
  if (a.layerId !== b.layerId) {
    return false;
  }
  if (a.pathIndices.length !== b.pathIndices.length) {
    return false;
  }
  return a.pathIndices.every((value, index) => value === b.pathIndices[index]);
}
