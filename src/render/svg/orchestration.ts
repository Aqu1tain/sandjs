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
  const handleArray: LayoutArc[] = [];
  const handle = handleArray as unknown as RenderHandle;

  // Create render state - will be initialized after runtime creation
  let state: RenderState;

  const execute = (): LayoutArc[] => {
    const runtime = state.runtimes;
    const navigation = runtime.navigation;
    const activeConfig = navigation ? navigation.getActiveConfig() : state.currentOptions.config;
    state.currentOptions = {
      ...state.currentOptions,
      config: activeConfig,
    };

    const arcs = layout(activeConfig);

    navigation?.registerArcs(arcs);

    const diameter = activeConfig.size.radius * 2;
    const cx = activeConfig.size.radius;
    const cy = activeConfig.size.radius;

    host.setAttribute('viewBox', `0 0 ${diameter} ${diameter}`);
    host.setAttribute('width', `${diameter}`);
    host.setAttribute('height', `${diameter}`);

    runtime.tooltip?.hide();
    if (!navigation || !navigation.handlesBreadcrumbs()) {
      runtime.breadcrumbs?.clear();
    }

    const navigationTransition = navigation?.consumeTransitionOverride();
    const transitionSource = navigationTransition ? navigationTransition.transition : state.currentOptions.transition;
    const navigationMorph = Boolean(navigationTransition?.morph);
    const transition = resolveTransition(transitionSource);
    const usedKeys = new Set<string>();

    // Batch DOM operations to reduce reflows
    // Use fragments if available (browser), fallback to direct append for test environments
    const supportsFragment = typeof doc.createDocumentFragment === 'function';
    const fragment = supportsFragment ? doc.createDocumentFragment() : null;
    const labelFragment = supportsFragment ? doc.createDocumentFragment() : null;
    const newElements: ManagedPath[] = [];

    for (let index = 0; index < arcs.length; index += 1) {
      const arc = arcs[index];
      const d = describeArcPath(arc, cx, cy);
      if (!d) {
        continue;
      }

      const key = createArcKey(arc);
      usedKeys.add(key);

      let managed = state.pathRegistry.get(key);
      let previousArc: LayoutArc | null = null;
      const isNewElement = !managed;

      if (managed) {
        previousArc = { ...managed.arc };
        cancelPendingRemoval(managed);
      } else {
        managed = createManagedPath({
          key,
          arc,
          options: state.currentOptions,
          runtime,
          doc,
          labelDefs,
        });
        state.pathRegistry.set(key, managed);
        newElements.push(managed);
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

      // Only append new elements to fragments; existing elements stay in DOM
      if (isNewElement) {
        if (supportsFragment && fragment && labelFragment) {
          fragment.appendChild(managed.element);
          labelFragment.appendChild(managed.labelElement);
        } else {
          // Fallback for test environments without createDocumentFragment
          host.appendChild(managed.element);
          host.appendChild(managed.labelElement);
        }
      }
    }

    // Batch append all new elements at once to minimize reflows
    if (newElements.length > 0 && supportsFragment && fragment && labelFragment) {
      host.appendChild(fragment);
      host.appendChild(labelFragment);
    }

    for (const [key, managed] of state.pathRegistry) {
      if (!usedKeys.has(key)) {
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

    return arcs;
  };

  const renderLoop = () => {
    if (state.isRendering) {
      state.pendingRender = true;
      return;
    }
    state.isRendering = true;
    do {
      state.pendingRender = false;
      const arcs = execute();
      handle.length = 0;
      handle.push(...arcs);
    } while (state.pendingRender);
    state.isRendering = false;
  };

  const requestRender = () => {
    state.pendingRender = true;
    if (!state.isRendering) {
      renderLoop();
    }
  };

  const runtimes = createRuntimeSet(doc, normalizedOptions, {
    baseConfig: normalizedOptions.config,
    requestRender,
  });

  // Initialize state with runtimes
  state = new RenderState(normalizedOptions, runtimes);

  requestRender();

  Object.defineProperties(handle, {
    update: {
      enumerable: false,
      value(input: RenderSvgUpdateInput) {
        const nextOptions = normalizeUpdateOptions(state.currentOptions, input, host, doc);
        const nextConfigInput = extractConfigFromUpdate(input, state.baseConfig);
        const nextConfig = cloneSunburstConfig(nextConfigInput);
        const finalOptions = {
          ...nextOptions,
          config: nextConfig,
        };
        state.updateConfig(finalOptions, nextConfig);
        disposeRuntimeSet(state.runtimes);
        state.runtimes = createRuntimeSet(doc, finalOptions, {
          baseConfig: nextConfig,
          requestRender,
        });
        requestRender();
        return handle;
      },
    },
    destroy: {
      enumerable: false,
      value() {
        state.dispose(host);
        handle.length = 0;
      },
    },
    getOptions: {
      enumerable: false,
      value() {
        return { ...state.currentOptions };
      },
    },
    resetNavigation: {
      enumerable: false,
      value() {
        state.runtimes.navigation?.reset();
      },
    },
  });

  return handle;
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
