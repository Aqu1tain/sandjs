import { layout } from '../../layout/index.js';
import { LayoutArc, SunburstConfig } from '../../types/index.js';
import {
  RenderSvgOptions,
  RenderHandle,
  RenderSvgUpdateInput,
} from '../types.js';
import { describeArcPath } from '../geometry.js';
import { resolveTransition } from '../transition.js';
import { resolveDocument, resolveHostElement } from '../runtime/document.js';
import { createArcKey } from '../keys.js';
import { cloneSunburstConfig } from '../config.js';
import { createColorAssigner } from '../colorAssignment.js';
import type { RuntimeSet, AnimationDrivers, ManagedPath } from './types.js';
import { createRuntimeSet, disposeRuntimeSet } from './runtime-creation.js';
import { isSunburstConfig, ensureLabelDefs, extractConfigFromUpdate } from './utils.js';
import { createAnimationDrivers } from './animation.js';
import { cancelPendingRemoval, scheduleManagedRemoval } from './removal.js';
import { createManagedPath, updateManagedPath } from './path-management.js';

/**
 * Encapsulates all mutable render state for better lifecycle management
 */
class RenderState {
  currentOptions: RenderSvgOptions;
  baseConfig: SunburstConfig;
  pathRegistry: Map<string, ManagedPath>;
  runtimes: RuntimeSet;
  getArcColor: (arc: LayoutArc, index: number) => string | null;
  isRendering: boolean = false;
  pendingRender: boolean = false;

  constructor(
    options: RenderSvgOptions,
    runtimes: RuntimeSet,
  ) {
    this.currentOptions = options;
    this.baseConfig = cloneSunburstConfig(options.config);
    this.pathRegistry = new Map();
    this.runtimes = runtimes;

    // Create color assigner once based on full config for consistent colors during navigation
    const baseArcs = layout(this.baseConfig);
    this.getArcColor = createColorAssigner(this.currentOptions.colorTheme, baseArcs);
  }

  updateConfig(nextOptions: RenderSvgOptions, nextConfig: SunburstConfig): void {
    this.baseConfig = cloneSunburstConfig(nextConfig);
    this.currentOptions = {
      ...nextOptions,
      config: this.baseConfig,
    };
    // Recreate color assigner with new base config for consistent colors
    const newBaseArcs = layout(this.baseConfig);
    this.getArcColor = createColorAssigner(this.currentOptions.colorTheme, newBaseArcs);
  }

  dispose(host: SVGElement): void {
    disposeRuntimeSet(this.runtimes);
    for (const managed of this.pathRegistry.values()) {
      managed.dispose();
      if (managed.element.parentNode === host) {
        host.removeChild(managed.element);
      }
    }
    this.pathRegistry.clear();
  }
}

export function renderSVG(options: RenderSvgOptions): RenderHandle {
  const doc = resolveDocument(options.document);
  const host = resolveHostElement(options.el, doc);
  const labelDefs = ensureLabelDefs(host, doc);

  const normalizedOptions: RenderSvgOptions = {
    ...options,
    el: host,
    document: doc,
    config: cloneSunburstConfig(options.config),
  };

  const drivers = createAnimationDrivers(doc);
  const handle = [] as unknown as RenderHandle;

  let state: RenderState;

  const requestRender = createRenderLoop(
    () => state,
    handle,
    () => executeRender(state, host, doc, labelDefs, drivers),
  );

  const runtimes = createRuntimeSet(doc, normalizedOptions, {
    baseConfig: normalizedOptions.config,
    requestRender,
  });

  state = new RenderState(normalizedOptions, runtimes);
  requestRender();

  handle.update = (input: RenderSvgUpdateInput) => {
    const nextOptions = normalizeUpdateOptions(state.currentOptions, input, host, doc);
    const nextConfigInput = extractConfigFromUpdate(input, state.baseConfig);
    const nextConfig = cloneSunburstConfig(nextConfigInput);
    const finalOptions = { ...nextOptions, config: nextConfig };

    state.updateConfig(finalOptions, nextConfig);
    disposeRuntimeSet(state.runtimes);
    state.runtimes = createRuntimeSet(doc, finalOptions, {
      baseConfig: nextConfig,
      requestRender,
    });
    requestRender();
    return handle;
  };

  handle.destroy = () => {
    state.dispose(host);
    handle.length = 0;
  };

  handle.getOptions = () => ({ ...state.currentOptions });

  handle.resetNavigation = () => {
    state.runtimes.navigation?.reset();
  };

  return handle;
}

function createRenderLoop(
  getState: () => RenderState,
  handle: RenderHandle,
  execute: () => LayoutArc[],
): () => void {
  return () => {
    const state = getState();
    state.pendingRender = true;
    if (state.isRendering) return;

    state.isRendering = true;
    do {
      state.pendingRender = false;
      const arcs = execute();
      handle.length = 0;
      handle.push(...arcs);
    } while (state.pendingRender);
    state.isRendering = false;
  };
}

function executeRender(
  state: RenderState,
  host: SVGElement,
  doc: Document,
  labelDefs: SVGDefsElement,
  drivers: AnimationDrivers,
): LayoutArc[] {
  const { runtimes: runtime } = state;
  const { navigation } = runtime;

  const activeConfig = navigation?.getActiveConfig() ?? state.currentOptions.config;
  state.currentOptions = { ...state.currentOptions, config: activeConfig };

  const arcs = layout(activeConfig);
  navigation?.registerArcs(arcs);

  applySvgDimensions(host, activeConfig.size.radius);

  runtime.tooltip?.hide();
  if (!navigation?.handlesBreadcrumbs()) {
    runtime.breadcrumbs?.clear();
  }

  const navigationTransition = navigation?.consumeTransitionOverride();
  const transitionSource = navigationTransition?.transition ?? state.currentOptions.transition;
  const navigationMorph = Boolean(navigationTransition?.morph);
  const transition = resolveTransition(transitionSource);

  const cx = activeConfig.size.radius;
  const cy = activeConfig.size.radius;

  const usedKeys = processArcs({
    arcs,
    state,
    runtime,
    host,
    doc,
    labelDefs,
    drivers,
    transition,
    navigationMorph,
    cx,
    cy,
  });

  scheduleRemovals({ state, host, usedKeys, transition, drivers, cx, cy, navigationMorph });

  return arcs;
}

function applySvgDimensions(host: SVGElement, radius: number): void {
  const diameter = radius * 2;
  host.setAttribute('viewBox', `0 0 ${diameter} ${diameter}`);
  host.setAttribute('width', `${diameter}`);
  host.setAttribute('height', `${diameter}`);
}

function processArcs(params: {
  arcs: LayoutArc[];
  state: RenderState;
  runtime: RuntimeSet;
  host: SVGElement;
  doc: Document;
  labelDefs: SVGDefsElement;
  drivers: AnimationDrivers;
  transition: ReturnType<typeof resolveTransition>;
  navigationMorph: boolean;
  cx: number;
  cy: number;
}): Set<string> {
  const { arcs, state, runtime, host, doc, labelDefs, drivers, transition, navigationMorph, cx, cy } = params;
  const usedKeys = new Set<string>();

  const batchTargets = createBatchTargets(doc, host);
  let hasNewElements = false;

  for (let index = 0; index < arcs.length; index += 1) {
    const arc = arcs[index];
    const d = describeArcPath(arc, cx, cy);
    if (!d) continue;

    const key = createArcKey(arc);
    usedKeys.add(key);

    let managed = state.pathRegistry.get(key);
    let previousArc: LayoutArc | null = null;
    const isNew = !managed;

    if (managed) {
      previousArc = { ...managed.arc };
      cancelPendingRemoval(managed);
    } else {
      managed = createManagedPath({ key, arc, options: state.currentOptions, runtime, doc, labelDefs });
      state.pathRegistry.set(key, managed);
      hasNewElements = true;
    }

    updateManagedPath(managed, {
      arc,
      options: state.currentOptions,
      runtime,
      pathData: d,
      previousArc,
      transition,
      drivers,
      cx,
      cy,
      navigationMorph,
      index,
      getArcColor: state.getArcColor,
    });

    if (isNew) {
      batchTargets.append(managed.element, managed.labelElement);
    }
  }

  if (hasNewElements) {
    batchTargets.flush();
  }

  return usedKeys;
}

type BatchTargets = {
  append: (element: SVGElement, label: SVGElement) => void;
  flush: () => void;
};

function createBatchTargets(doc: Document, host: SVGElement): BatchTargets {
  if (typeof doc.createDocumentFragment !== 'function') {
    return {
      append: (element, label) => {
        host.appendChild(element);
        host.appendChild(label);
      },
      flush: () => {},
    };
  }

  const fragment = doc.createDocumentFragment();
  const labelFragment = doc.createDocumentFragment();

  return {
    append: (element, label) => {
      fragment.appendChild(element);
      labelFragment.appendChild(label);
    },
    flush: () => {
      host.appendChild(fragment);
      host.appendChild(labelFragment);
    },
  };
}

function scheduleRemovals(params: {
  state: RenderState;
  host: SVGElement;
  usedKeys: Set<string>;
  transition: ReturnType<typeof resolveTransition>;
  drivers: AnimationDrivers;
  cx: number;
  cy: number;
  navigationMorph: boolean;
}): void {
  const { state, host, usedKeys, transition, drivers, cx, cy, navigationMorph } = params;
  for (const [key, managed] of state.pathRegistry) {
    if (usedKeys.has(key)) continue;
    scheduleManagedRemoval({
      key,
      managed,
      host,
      registry: state.pathRegistry,
      transition,
      drivers,
      cx,
      cy,
      navigationMorph,
      debug: state.currentOptions.debug ?? false,
      renderOptions: state.currentOptions,
    });
  }
}

function normalizeUpdateOptions(
  current: RenderSvgOptions,
  input: RenderSvgUpdateInput,
  host: SVGElement,
  doc: Document,
): RenderSvgOptions {
  if (isSunburstConfig(input)) {
    return {
      ...current,
      config: input,
      el: host,
      document: doc,
    };
  }

  const nextConfig = input.config ?? current.config;
  return {
    ...current,
    ...input,
    config: nextConfig,
    el: host,
    document: doc,
  };
}
