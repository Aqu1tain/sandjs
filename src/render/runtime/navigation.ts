import type { LayoutArc, SunburstConfig, TreeNodeInput } from '../../types/index.js';
import type {
  BreadcrumbTrailItem,
  NavigationOptions,
  RenderSvgOptions,
} from '../types.js';
import type { BreadcrumbRuntime } from './breadcrumbs.js';
import { arcIdentifierFromPath } from '../keys.js';
import { cloneSunburstConfig } from '../config.js';
import type { FocusTarget, NavigationTransitionContext } from './navigation/types.js';
import { indexBaseConfig, getNodeAtPath, collectNodesAlongPath } from './navigation/tree-utils.js';
import { deriveConfig } from './navigation/config-derivation.js';
import {
  createFocusTargetFromArc,
  createFocusTargetFromPath,
  createTransitionContext,
  isSameFocus,
} from './navigation/focus-helpers.js';

export type NavigationRuntime = {
  setBaseConfig: (config: SunburstConfig) => void;
  getActiveConfig: () => SunburstConfig;
  registerArcs: (arcs: LayoutArc[]) => void;
  handleArcClick: (arc: LayoutArc) => boolean;
  handlesBreadcrumbs: () => boolean;
  reset: () => void;
  dispose: () => void;
  consumeTransitionOverride: () => NavigationTransitionContext | undefined;
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
  let pendingTransition: NavigationTransitionContext | undefined;

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
      const baseNodes = collectNodesAlongPath(storedBaseConfig, arc.layerId, basePath);
      if (baseNodes) {
        arc.path = baseNodes;
      }
      arc.pathIndices = basePath.slice();
    }
    }
    validateFocus();
    updateBreadcrumbTrail();
  }

  function handleArcClick(arc: LayoutArc): boolean {
    if (allowedLayers && !allowedLayers.has(arc.layerId)) {
      return false;
    }

    const target = createFocusTargetFromArcWrapper(arc);
    if (!target) {
      return false;
    }

    if (focus && isSameFocus(target, focus)) {
      if (!focus.pathIndices || focus.pathIndices.length === 0) {
        return false;
      }
      const parentPath = focus.pathIndices.slice(0, -1);
      if (parentPath.length === 0) {
        reset();
        return true;
      }
      applyFocusPath(focus.layerId, parentPath);
      return true;
    }

    focus = target;
    pendingTransition = createTransitionContext(options.focusTransition);
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
    pendingTransition = createTransitionContext(options.focusTransition);
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
    const target = createFocusTargetFromPathWrapper(layerId, pathIndices);
    if (!target) {
      return;
    }
    focus = target;
    pendingTransition = createTransitionContext(options.focusTransition);
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

  function createFocusTargetFromArcWrapper(arc: LayoutArc): FocusTarget | null {
    return createFocusTargetFromArc(arc, nodeSourceMap, nodePathMap, sourcePathMap, storedBaseConfig);
  }

  function createFocusTargetFromPathWrapper(layerId: string, pathIndices: number[]): FocusTarget | null {
    return createFocusTargetFromPath(layerId, pathIndices, storedBaseConfig, nodePathMap, arcByIdentifier, getNodeAtPath);
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

