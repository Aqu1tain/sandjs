import type { LayoutArc, SunburstConfig, TreeNodeInput } from '../../types/index.js';
import type {
  BreadcrumbTrailItem,
  NavigationFocusState,
  NavigationOptions,
  RenderSvgOptions,
} from '../types.js';
import type { BreadcrumbRuntime } from './breadcrumbs.js';
import { arcIdentifierFromPath, resolveArcKey } from '../keys.js';
import { cloneSunburstConfig } from '../config.js';

export type NavigationRuntime = {
  setBaseConfig: (config: SunburstConfig) => void;
  getActiveConfig: () => SunburstConfig;
  registerArcs: (arcs: LayoutArc[]) => void;
  handleArcClick: (arc: LayoutArc) => boolean;
  handlesBreadcrumbs: () => boolean;
  reset: () => void;
  dispose: () => void;
  consumeTransitionOverride: () => RenderSvgOptions['transition'] | undefined;
};

type FocusTarget = {
  layerId: string;
  pathIndices: number[];
  node: TreeNodeInput;
  pathNodes: TreeNodeInput[];
  key: string | null;
  identifier: string;
  arc?: LayoutArc;
};

type NavigationDeps = {
  breadcrumbs: BreadcrumbRuntime | null;
  requestRender: () => void;
};

export function createNavigationRuntime(
  input: RenderSvgOptions['navigation'],
  deps: NavigationDeps,
  baseConfig: SunburstConfig,
): NavigationRuntime | null {
  if (!input) {
    return null;
  }

  const options: NavigationOptions =
    input === true ? {} : typeof input === 'object' && input !== null ? (input as NavigationOptions) : {};

  const allowedLayers = options.layers ? new Set(options.layers) : null;

  let storedBaseConfig = cloneSunburstConfig(baseConfig);
  let focus: FocusTarget | null = null;
  let cachedDerivedConfig: SunburstConfig | null = null;
  const requestRender = deps.requestRender;
  const breadcrumbs = deps.breadcrumbs;
  const handlesBreadcrumbs = Boolean(breadcrumbs?.handlesTrail);

  let nodeSourceMap = new WeakMap<TreeNodeInput, TreeNodeInput>();
  let nodePathMap = new WeakMap<TreeNodeInput, number[]>();
  let sourcePathMap = new WeakMap<TreeNodeInput, number[]>();
  const arcByIdentifier = new Map<string, LayoutArc>();
  let pendingTransition: RenderSvgOptions['transition'] | undefined;

  indexBaseConfig(storedBaseConfig, nodeSourceMap, nodePathMap);
  updateBreadcrumbTrail();

  function setBaseConfig(config: SunburstConfig): void {
    storedBaseConfig = cloneSunburstConfig(config);
    focus = null;
    cachedDerivedConfig = null;
    pendingTransition = undefined;
    nodeSourceMap = new WeakMap<TreeNodeInput, TreeNodeInput>();
    nodePathMap = new WeakMap<TreeNodeInput, number[]>();
    sourcePathMap = new WeakMap<TreeNodeInput, number[]>();
    arcByIdentifier.clear();
    indexBaseConfig(storedBaseConfig, nodeSourceMap, nodePathMap);
    updateBreadcrumbTrail();
  }

  function getActiveConfig(): SunburstConfig {
    if (!focus) {
      cachedDerivedConfig = null;
      return storedBaseConfig;
    }
    if (!cachedDerivedConfig) {
      cachedDerivedConfig = deriveConfig(
        storedBaseConfig,
        focus,
        nodeSourceMap,
        nodePathMap,
        sourcePathMap,
      );
    }
    return cachedDerivedConfig;
  }

  function registerArcs(arcs: LayoutArc[]): void {
    arcByIdentifier.clear();
    for (const arc of arcs) {
      const baseNode = nodeSourceMap.get(arc.data) ?? arc.data;
      nodeSourceMap.set(arc.data, baseNode);
      nodeSourceMap.set(baseNode, baseNode);

      const basePath = sourcePathMap.get(arc.data) ?? nodePathMap.get(baseNode) ?? arc.pathIndices;
      if (basePath) {
        nodePathMap.set(baseNode, basePath);
        sourcePathMap.set(arc.data, basePath);
        const identifier = arcIdentifierFromPath(arc.layerId, basePath);
        arcByIdentifier.set(identifier, arc);
        if (arc.data !== baseNode) {
          sourcePathMap.set(baseNode, basePath);
        }
      }
    }
    validateFocus();
    updateBreadcrumbTrail();
  }

  function handleArcClick(arc: LayoutArc): boolean {
    if (allowedLayers && !allowedLayers.has(arc.layerId)) {
      return false;
    }

    const target = createFocusTargetFromArc(arc);
    if (!target) {
      return false;
    }

    if (focus && isSameFocus(target, focus)) {
      return false;
    }

    focus = target;
    pendingTransition = computeFocusTransition(options.focusTransition);
    cachedDerivedConfig = null;
    notifyFocusChange(target);
    updateBreadcrumbTrail();
    requestRender();
    return true;
  }

  function handlesBreadcrumbsFlag(): boolean {
    return handlesBreadcrumbs;
  }

  function reset(): void {
    if (!focus) {
      return;
    }
    focus = null;
    cachedDerivedConfig = null;
    pendingTransition = computeFocusTransition(options.focusTransition);
    notifyFocusChange(null);
    updateBreadcrumbTrail();
    requestRender();
  }

  function dispose(): void {
    focus = null;
    cachedDerivedConfig = null;
    arcByIdentifier.clear();
    breadcrumbs?.setTrail?.(null);
    pendingTransition = undefined;
  }

  function notifyFocusChange(target: FocusTarget | null): void {
    if (typeof options.onFocusChange !== 'function') {
      return;
    }
    if (!target) {
      options.onFocusChange(null);
      return;
    }
    const arc = target.arc ?? arcByIdentifier.get(target.identifier);
    options.onFocusChange({
      layerId: target.layerId,
      path: target.pathNodes,
      pathIndices: target.pathIndices,
      arc,
    });
  }

  function updateBreadcrumbTrail(): void {
    if (!handlesBreadcrumbs) {
      return;
    }
    const trail: BreadcrumbTrailItem[] = [];
    const rootLabel = options.rootLabel ?? 'All';
    trail.push({
      id: 'root',
      label: rootLabel,
      active: !focus,
      onSelect: focus ? () => reset() : undefined,
    });

    if (focus) {
      const activeFocus = focus;
      activeFocus.pathNodes.forEach((node, index) => {
        const pathSlice = activeFocus.pathIndices.slice(0, index + 1);
        const identifier = arcIdentifierFromPath(activeFocus.layerId, pathSlice);
        trail.push({
          id: identifier,
          label: node?.name ?? `#${index + 1}`,
          active: index === activeFocus.pathNodes.length - 1,
          arcIdentifier: identifier,
          onSelect:
            index === activeFocus.pathNodes.length - 1
              ? undefined
              : () => applyFocusPath(activeFocus.layerId, pathSlice),
        });
      });
    }

    breadcrumbs?.setTrail?.(trail);
  }

  function applyFocusPath(layerId: string, pathIndices: number[]): void {
    const target = createFocusTargetFromPath(layerId, pathIndices);
    if (!target) {
      return;
    }
    focus = target;
    cachedDerivedConfig = null;
    notifyFocusChange(target);
    updateBreadcrumbTrail();
    requestRender();
  }

  function validateFocus(): void {
    if (!focus) {
      return;
    }
    const node = getNodeAtPath(storedBaseConfig, focus.layerId, focus.pathIndices);
    if (!node) {
      focus = null;
      cachedDerivedConfig = null;
      notifyFocusChange(null);
      updateBreadcrumbTrail();
    }
  }

  function createFocusTargetFromArc(arc: LayoutArc): FocusTarget | null {
    const baseNodeInfo = getBaseNodeInfo(arc);
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

  function createFocusTargetFromPath(layerId: string, pathIndices: number[]): FocusTarget | null {
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

  function getBaseNodeInfo(arc: LayoutArc): {
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

  return {
    setBaseConfig,
    getActiveConfig,
    registerArcs,
    handleArcClick,
    handlesBreadcrumbs: handlesBreadcrumbsFlag,
    reset,
    dispose,
    consumeTransitionOverride() {
      if (pendingTransition === undefined) {
        return undefined;
      }
      const result = pendingTransition;
      pendingTransition = undefined;
      return result;
    },
  };
}

function computeFocusTransition(
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

function isSameFocus(a: FocusTarget, b: FocusTarget): boolean {
  if (a.layerId !== b.layerId) {
    return false;
  }
  if (a.pathIndices.length !== b.pathIndices.length) {
    return false;
  }
  return a.pathIndices.every((value, index) => value === b.pathIndices[index]);
}

function indexBaseConfig(
  config: SunburstConfig,
  sourceMap: WeakMap<TreeNodeInput, TreeNodeInput>,
  pathMap: WeakMap<TreeNodeInput, number[]>,
): void {
  for (const layer of config.layers) {
    indexLayerTree(layer.tree, [], sourceMap, pathMap);
  }
}

function indexLayerTree(
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

function deriveConfig(
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

function findNodeByKey(
  tree: TreeNodeInput | TreeNodeInput[],
  key: string,
  prefix: number[],
): { node: TreeNodeInput; path: number[] } | null {
  const nodes = Array.isArray(tree) ? tree : [tree];
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index];
    const path = prefix.concat(index);
    if (node && node.key === key) {
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

function getNodeAtPath(
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

function collectNodesAlongPath(
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

function resolveNodeKey(node: TreeNodeInput): string | null {
  if (typeof node.key === 'string' && node.key.length > 0) {
    return node.key;
  }
  return null;
}
