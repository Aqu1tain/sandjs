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

type NodeMappings = {
  nodeToBase: WeakMap<TreeNodeInput, TreeNodeInput>;
  baseToPath: WeakMap<TreeNodeInput, number[]>;
  derivedToPath: WeakMap<TreeNodeInput, number[]>;
};

type NavigationState = {
  baseConfig: SunburstConfig;
  focus: FocusTarget | null;
  derivedConfig: SunburstConfig | null;
  mappings: NodeMappings;
  arcByIdentifier: Map<string, LayoutArc>;
  pendingTransition: NavigationTransitionContext | undefined;
};

function createInitialState(config: SunburstConfig): NavigationState {
  const mappings: NodeMappings = {
    nodeToBase: new WeakMap(),
    baseToPath: new WeakMap(),
    derivedToPath: new WeakMap(),
  };
  const state: NavigationState = {
    baseConfig: cloneSunburstConfig(config),
    focus: null,
    derivedConfig: null,
    mappings,
    arcByIdentifier: new Map(),
    pendingTransition: undefined,
  };
  indexBaseConfig(state.baseConfig, mappings.nodeToBase, mappings.baseToPath);
  return state;
}

function resetMappings(state: NavigationState): void {
  state.mappings = {
    nodeToBase: new WeakMap(),
    baseToPath: new WeakMap(),
    derivedToPath: new WeakMap(),
  };
}

function registerSingleArc(arc: LayoutArc, state: NavigationState): void {
  const { nodeToBase, baseToPath, derivedToPath } = state.mappings;

  const baseNode = nodeToBase.get(arc.data) ?? arc.data;
  nodeToBase.set(arc.data, baseNode);
  nodeToBase.set(baseNode, baseNode);

  const basePath = derivedToPath.get(arc.data) ?? baseToPath.get(baseNode) ?? arc.pathIndices;
  if (!basePath) return;

  baseToPath.set(baseNode, basePath);
  derivedToPath.set(arc.data, basePath);

  const identifier = arcIdentifierFromPath(arc.layerId, basePath);
  state.arcByIdentifier.set(identifier, arc);

  if (arc.data !== baseNode) {
    derivedToPath.set(baseNode, basePath);
  }

  const baseNodes = collectNodesAlongPath(state.baseConfig, arc.layerId, basePath);
  if (baseNodes) {
    arc.path = baseNodes;
  }
  arc.pathIndices = basePath.slice();
}

export function createNavigationRuntime(
  input: RenderSvgOptions['navigation'],
  deps: NavigationDeps,
  baseConfig: SunburstConfig,
): NavigationRuntime | null {
  if (!input) return null;

  const options: NavigationOptions =
    input === true ? {} : typeof input === 'object' && input !== null ? (input as NavigationOptions) : {};

  const allowedLayers = options.layers ? new Set(options.layers) : null;
  const { requestRender, breadcrumbs } = deps;
  const handlesBreadcrumbs = Boolean(breadcrumbs?.handlesTrail);

  const state = createInitialState(baseConfig);
  updateBreadcrumbTrail();

  function setBaseConfig(config: SunburstConfig): void {
    state.baseConfig = cloneSunburstConfig(config);
    state.focus = null;
    state.derivedConfig = null;
    state.pendingTransition = undefined;
    resetMappings(state);
    state.arcByIdentifier.clear();
    indexBaseConfig(state.baseConfig, state.mappings.nodeToBase, state.mappings.baseToPath);
    updateBreadcrumbTrail();
  }

  function getActiveConfig(): SunburstConfig {
    if (!state.focus) {
      state.derivedConfig = null;
      return state.baseConfig;
    }
    if (!state.derivedConfig) {
      const { nodeToBase, baseToPath, derivedToPath } = state.mappings;
      state.derivedConfig = deriveConfig(state.baseConfig, state.focus, nodeToBase, baseToPath, derivedToPath);
    }
    return state.derivedConfig;
  }

  function registerArcs(arcs: LayoutArc[]): void {
    state.arcByIdentifier.clear();
    for (const arc of arcs) {
      registerSingleArc(arc, state);
    }
    validateFocus();
    updateBreadcrumbTrail();
  }

  function handleArcClick(arc: LayoutArc): boolean {
    if (allowedLayers && !allowedLayers.has(arc.layerId)) return false;

    const target = createFocusTargetFromArcWrapper(arc);
    if (!target) return false;

    if (state.focus && isSameFocus(target, state.focus)) {
      if (!state.focus.pathIndices || state.focus.pathIndices.length === 0) return false;

      const parentPath = state.focus.pathIndices.slice(0, -1);
      if (parentPath.length === 0) {
        reset();
        return true;
      }
      applyFocusPath(state.focus.layerId, parentPath);
      return true;
    }

    setFocus(target);
    return true;
  }

  function setFocus(target: FocusTarget): void {
    state.focus = target;
    state.pendingTransition = createTransitionContext(options.focusTransition);
    state.derivedConfig = null;
    notifyFocusChange(target);
    updateBreadcrumbTrail();
    requestRender();
  }

  function handlesBreadcrumbsFlag(): boolean {
    return handlesBreadcrumbs;
  }

  function reset(): void {
    if (!state.focus) return;

    state.focus = null;
    state.derivedConfig = null;
    state.pendingTransition = createTransitionContext(options.focusTransition);
    notifyFocusChange(null);
    updateBreadcrumbTrail();
    requestRender();
  }

  function dispose(): void {
    state.focus = null;
    state.derivedConfig = null;
    state.arcByIdentifier.clear();
    breadcrumbs?.setTrail?.(null);
    state.pendingTransition = undefined;
  }

  function notifyFocusChange(target: FocusTarget | null): void {
    if (typeof options.onFocusChange !== 'function') return;

    if (!target) {
      options.onFocusChange(null);
      return;
    }
    const arc = target.arc ?? state.arcByIdentifier.get(target.identifier);
    options.onFocusChange({
      layerId: target.layerId,
      path: target.pathNodes,
      pathIndices: target.pathIndices,
      arc,
    });
  }

  function updateBreadcrumbTrail(): void {
    if (!handlesBreadcrumbs) return;

    const trail: BreadcrumbTrailItem[] = [];
    const rootLabel = options.rootLabel ?? 'All';
    trail.push({
      id: 'root',
      label: rootLabel,
      active: !state.focus,
      onSelect: state.focus ? () => reset() : undefined,
    });

    if (state.focus) {
      const { focus } = state;
      focus.pathNodes.forEach((node, index) => {
        const pathSlice = focus.pathIndices.slice(0, index + 1);
        const identifier = arcIdentifierFromPath(focus.layerId, pathSlice);
        const isLast = index === focus.pathNodes.length - 1;
        trail.push({
          id: identifier,
          label: node?.name ?? `#${index + 1}`,
          active: isLast,
          arcIdentifier: identifier,
          onSelect: isLast ? undefined : () => applyFocusPath(focus.layerId, pathSlice),
        });
      });
    }

    breadcrumbs?.setTrail?.(trail);
  }

  function applyFocusPath(layerId: string, pathIndices: number[]): void {
    const target = createFocusTargetFromPathWrapper(layerId, pathIndices);
    if (!target) return;
    setFocus(target);
  }

  function validateFocus(): void {
    if (!state.focus) return;

    const node = getNodeAtPath(state.baseConfig, state.focus.layerId, state.focus.pathIndices);
    if (node) return;

    state.focus = null;
    state.derivedConfig = null;
    notifyFocusChange(null);
    updateBreadcrumbTrail();
  }

  function createFocusTargetFromArcWrapper(arc: LayoutArc): FocusTarget | null {
    const { nodeToBase, baseToPath, derivedToPath } = state.mappings;
    return createFocusTargetFromArc(arc, nodeToBase, baseToPath, derivedToPath, state.baseConfig);
  }

  function createFocusTargetFromPathWrapper(layerId: string, pathIndices: number[]): FocusTarget | null {
    return createFocusTargetFromPath(layerId, pathIndices, state.baseConfig, state.mappings.baseToPath, state.arcByIdentifier, getNodeAtPath);
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
      const result = state.pendingTransition;
      state.pendingTransition = undefined;
      return result;
    },
  };
}

