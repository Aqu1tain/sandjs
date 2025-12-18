import { layout } from '../layout/index.js';
import { LayoutArc, SunburstConfig } from '../types/index.js';
import {
  RenderSvgOptions,
  RenderHandle,
  RenderSvgUpdateInput,
  RenderSvgUpdateOptions,
} from './types.js';
import { describeArcPath, polarToCartesian, TAU, ZERO_TOLERANCE } from './geometry.js';
import { resolveTransition, interpolateArc, ResolvedTransition } from './transition.js';
import { clamp01 } from './math.js';
import { resolveDocument, resolveHostElement } from './runtime/document.js';
import { createArcKey } from './keys.js';
import { cloneSunburstConfig } from './config.js';
import { createColorAssigner } from './colorAssignment.js';
import { getContrastTextColor } from './colorUtils.js';
import {
  SVG_NS,
  XLINK_NS,
  LABEL_MIN_RADIAL_THICKNESS,
  LABEL_MIN_FONT_SIZE,
  LABEL_MAX_FONT_SIZE,
  LABEL_CHAR_WIDTH_FACTOR,
  LABEL_PADDING,
  LABEL_SAFETY_MARGIN,
} from './svg/constants.js';
import type { RuntimeSet, AnimationHandle, AnimationDrivers, ManagedPath } from './svg/types.js';
import { createRuntimeSet, disposeRuntimeSet } from './svg/runtime-creation.js';
import { isSunburstConfig, ensureLabelDefs, extractConfigFromUpdate } from './svg/utils.js';
import {
  startFade,
  stopFade,
  createAnimationDrivers,
  createCollapsedArc,
  getCurrentOpacity,
  runAnimation,
} from './svg/animation.js';

let labelIdCounter = 0;

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


function createManagedPath(params: {
  key: string;
  arc: LayoutArc;
  options: RenderSvgOptions;
  runtime: RuntimeSet;
  doc: Document;
  labelDefs: SVGDefsElement;
}): ManagedPath {
  const { key, arc, options, runtime, doc, labelDefs } = params;
  const element = doc.createElementNS(SVG_NS, 'path');

  const labelPathElement = doc.createElementNS(SVG_NS, 'path');
  const labelElement = doc.createElementNS(SVG_NS, 'text');
  const textPathElement = doc.createElementNS(SVG_NS, 'textPath');
  const labelPathId = `sand-arc-label-${labelIdCounter++}`;

  labelPathElement.setAttribute('id', labelPathId);
  labelPathElement.setAttribute('fill', 'none');
  labelPathElement.setAttribute('stroke', 'none');
  labelPathElement.setAttribute('class', 'sand-arc-label-path');
  labelPathElement.setAttribute('aria-hidden', 'true');
  labelDefs.appendChild(labelPathElement);

  labelElement.setAttribute('class', 'sand-arc-label');
  labelElement.setAttribute('text-anchor', 'middle');
  labelElement.setAttribute('dominant-baseline', 'middle');
  labelElement.setAttribute('aria-hidden', 'true');
  labelElement.style.pointerEvents = 'none';
  labelElement.style.userSelect = 'none';
  labelElement.style.display = 'none';

  textPathElement.setAttribute('startOffset', '50%');
  textPathElement.setAttribute('method', 'align');
  textPathElement.setAttribute('spacing', 'auto');
  textPathElement.setAttribute('text-anchor', 'middle');
  textPathElement.setAttribute('class', 'sand-arc-label-textpath');
  textPathElement.textContent = '';
  textPathElement.style.pointerEvents = 'none';
  textPathElement.setAttributeNS(XLINK_NS, 'xlink:href', `#${labelPathId}`);
  textPathElement.setAttribute('href', `#${labelPathId}`);

  labelElement.appendChild(textPathElement);

  const abortController = new AbortController();

  const managed: ManagedPath = {
    key,
    element,
    labelElement,
    labelPathElement,
    textPathElement,
    labelPathId,
    arc,
    options,
    runtime,
    animation: null,
    fade: null,
    pendingRemoval: false,
    labelVisible: false,
    labelHiddenReason: null,
    labelPendingLogReason: null,
    abortController,
    dispose: () => {
      stopManagedAnimations(managed);
      managed.pendingRemoval = false;
      managed.abortController.abort();
      if (labelElement.parentNode) {
        labelElement.parentNode.removeChild(labelElement);
      }
      if (labelPathElement.parentNode) {
        labelPathElement.parentNode.removeChild(labelPathElement);
      }
    },
  };

  const handleEnter = (event: PointerEvent) => {
    const currentArc = managed.arc;
    managed.runtime.tooltip?.show(event, currentArc);
    managed.runtime.highlight?.pointerEnter(currentArc, element);
    if (!managed.runtime.navigation?.handlesBreadcrumbs()) {
      managed.runtime.breadcrumbs?.show(currentArc);
    }
    managed.options.onArcEnter?.({ arc: currentArc, path: element, event });
  };

  const handleMove = (event: PointerEvent) => {
    const currentArc = managed.arc;
    managed.runtime.tooltip?.move(event);
    managed.runtime.highlight?.pointerMove(currentArc, element);
    managed.options.onArcMove?.({ arc: currentArc, path: element, event });
  };

  const handleLeave = (event: PointerEvent) => {
    const currentArc = managed.arc;
    managed.runtime.tooltip?.hide();
    managed.runtime.highlight?.pointerLeave(currentArc, element);
    if (!managed.runtime.navigation?.handlesBreadcrumbs()) {
      managed.runtime.breadcrumbs?.clear();
    }
    managed.options.onArcLeave?.({ arc: currentArc, path: element, event });
  };

  const handleClick = (event: MouseEvent) => {
    const currentArc = managed.arc;
    managed.runtime.highlight?.handleClick?.(currentArc, element, event);
    managed.runtime.navigation?.handleArcClick(currentArc);
    managed.options.onArcClick?.({ arc: currentArc, path: element, event });
  };

  const { signal } = abortController;
  element.addEventListener('pointerenter', handleEnter, { signal });
  element.addEventListener('pointermove', handleMove, { signal });
  element.addEventListener('pointerleave', handleLeave, { signal });
  element.addEventListener('pointercancel', handleLeave, { signal });
  element.addEventListener('click', handleClick, { signal });

  return managed;
}

function updateManagedPath(
  managed: ManagedPath,
  params: {
    arc: LayoutArc;
    options: RenderSvgOptions;
    runtime: RuntimeSet;
    pathData: string;
    previousArc: LayoutArc | null;
    transition: ResolvedTransition | null;
    drivers: AnimationDrivers;
    cx: number;
    cy: number;
    navigationMorph: boolean;
    index: number;
    getArcColor: (arc: LayoutArc, index: number) => string | null;
  },
): void {
  const { arc, options, runtime, pathData, previousArc, transition, drivers, cx, cy, navigationMorph, index, getArcColor } =
    params;

  managed.arc = arc;
  managed.options = options;
  managed.runtime = runtime;
  managed.pendingRemoval = false;

  stopFade(managed);

  const element = managed.element;
  let animationFrom: LayoutArc | null = previousArc ? { ...previousArc } : null;

  if (!animationFrom && navigationMorph && transition) {
    animationFrom = createCollapsedArc(arc);
    const collapsedPath = describeArcPath(animationFrom, cx, cy);
    if (collapsedPath) {
      applyPathData(element, collapsedPath);
    }
  }

  // Apply color from theme or node.color override
  const themeColor = getArcColor(arc, index);
  const fillColor = arc.data.color ?? themeColor ?? 'currentColor';
  element.setAttribute('fill', fillColor);

  const animateArc = Boolean(transition && animationFrom && hasArcGeometryChanged(animationFrom, arc));
  if (animateArc) {
    startArcAnimation({
      managed,
      from: animationFrom!,
      to: arc,
      finalPath: pathData,
      transition: transition!,
      drivers,
      cx,
      cy,
      debug: options.debug ?? false,
      renderOptions: options,
      arcColor: fillColor,
    });
  } else {
    stopArcAnimation(managed);
    applyPathData(element, pathData);
    updateArcLabel(managed, arc, { cx, cy, allowLogging: options.debug ?? false, renderOptions: options, arcColor: fillColor });
  }

  // Apply border color and width
  // Priority: layer config > global options > default
  const layer = options.config.layers.find(l => l.id === arc.layerId);
  const borderColor = layer?.borderColor ?? options.borderColor;
  const borderWidth = layer?.borderWidth ?? options.borderWidth;

  if (borderColor) {
    element.setAttribute('stroke', borderColor);
  }
  if (borderWidth !== undefined) {
    element.setAttribute('stroke-width', String(borderWidth));
  }

  element.setAttribute('data-layer', arc.layerId);
  element.setAttribute('data-name', arc.data.name);
  element.setAttribute('data-depth', String(arc.depth));

  const isCollapsed = Boolean(arc.data.collapsed);
  if (isCollapsed) {
    element.setAttribute('data-collapsed', 'true');
  } else {
    element.removeAttribute('data-collapsed');
  }

  if (arc.key) {
    element.setAttribute('data-key', arc.key);
  } else {
    element.removeAttribute('data-key');
  }

  if (typeof arc.data.tooltip === 'string') {
    element.setAttribute('data-tooltip', arc.data.tooltip);
  } else {
    element.removeAttribute('data-tooltip');
  }

  const classTokens: string[] = [];
  const seen = new Set<string>();
  const addClass = (candidate: string | null | undefined) => {
    if (!candidate) {
      return;
    }
    const pieces = candidate.split(/\s+/);
    for (const piece of pieces) {
      const trimmed = piece.trim();
      if (!trimmed || seen.has(trimmed)) {
        continue;
      }
      seen.add(trimmed);
      classTokens.push(trimmed);
    }
  };

  addClass('sand-arc');
  if (arc.depth === 0) {
    addClass('is-root');
  }
  if (isCollapsed) {
    addClass('is-collapsed');
  }

  const dynamicClass = options.classForArc?.(arc);
  if (typeof dynamicClass === 'string') {
    addClass(dynamicClass);
  } else if (Array.isArray(dynamicClass)) {
    for (const candidate of dynamicClass) {
      addClass(candidate);
    }
  }

  element.setAttribute('class', classTokens.join(' '));

  options.decoratePath?.(element, arc);
  runtime.highlight?.register(arc, element);

  element.style.pointerEvents = '';

  if (animateArc) {
    // When animating, updates will be driven by the animation callbacks.
    // Ensure pending log reasons are cleared so zoom recomputations can log once animation settles.
    managed.labelPendingLogReason = null;
  }

  if (!previousArc) {
    if (transition) {
      if (navigationMorph) {
        element.style.opacity = '';
      } else {
        element.style.opacity = '0';
        managed.fade = startFade({
          managed,
          from: 0,
          to: 1,
          transition,
          drivers,
          resetStyleOnComplete: true,
          onComplete: () => {
            managed.fade = null;
          },
          onCancel: () => {
            managed.fade = null;
          },
        });
      }
    } else {
      element.style.opacity = '';
    }
  } else {
    element.style.opacity = '';
  }
}

function hasArcGeometryChanged(a: LayoutArc, b: LayoutArc): boolean {
  return a.x0 !== b.x0 || a.x1 !== b.x1 || a.y0 !== b.y0 || a.y1 !== b.y1;
}

function applyPathData(element: SVGPathElement, pathData: string | null | undefined): void {
  if (pathData && pathData.length > 0) {
    element.setAttribute('d', pathData);
  } else {
    element.removeAttribute('d');
  }
}

type UpdateArcLabelOptions = {
  cx: number;
  cy: number;
  allowLogging: boolean;
  renderOptions: RenderSvgOptions;
  arcColor: string;
};

type LabelEvaluation = {
  visible: boolean;
  reason?: string;
  x?: number;
  y?: number;
  fontSize?: number;
  pathData?: string;
  inverted?: boolean;
};

function updateArcLabel(managed: ManagedPath, arc: LayoutArc, options: UpdateArcLabelOptions): void {
  const { cx, cy, allowLogging, renderOptions, arcColor } = options;

  if (managed.pendingRemoval) {
    hideLabel(managed, 'pending-removal');
    return;
  }

  // Check if labels should be shown (global, layer, or default to true)
  const labelOptions = renderOptions.labels;
  const globalShowLabels = typeof labelOptions === 'boolean' ? labelOptions : labelOptions?.showLabels ?? true;
  const layer = renderOptions.config.layers.find(l => l.id === arc.layerId);
  const layerShowLabels = layer?.showLabels ?? globalShowLabels;

  if (!layerShowLabels) {
    hideLabel(managed, 'labels-disabled');
    return;
  }

  const text = typeof arc.data.name === 'string' ? arc.data.name.trim() : '';
  if (!text) {
    hideLabel(managed, 'empty-label');
    return;
  }

  const evaluation = evaluateLabelVisibility(arc, text, cx, cy);
  if (!evaluation.visible || evaluation.x === undefined || evaluation.y === undefined || !evaluation.fontSize) {
    const reason = evaluation.reason ?? 'insufficient-geometry';
    const loggable = shouldLogLabelReason(reason);
    if (!allowLogging && loggable) {
      managed.labelPendingLogReason = reason;
    }

    const hasPendingMatch = managed.labelPendingLogReason === reason;
    const reasonChanged = managed.labelHiddenReason !== reason;
    const shouldLogNow = allowLogging && loggable && (reasonChanged || hasPendingMatch);
    const payload = shouldLogNow ? createLabelLogPayload(arc, text, reason) : null;
    hideLabel(managed, reason, payload, shouldLogNow);

    if (allowLogging) {
      managed.labelPendingLogReason = null;
    }
    return;
  }

  // Determine label color with priority: node > layer > global > auto-contrast > default
  const autoLabelColor = typeof labelOptions === 'object' ? labelOptions?.autoLabelColor ?? false : false;
  const globalLabelColor = typeof labelOptions === 'object' ? labelOptions?.labelColor : undefined;

  let labelColor: string;
  if (arc.data.labelColor) {
    labelColor = arc.data.labelColor;
  } else if (layer?.labelColor) {
    labelColor = layer.labelColor;
  } else if (globalLabelColor) {
    labelColor = globalLabelColor;
  } else if (autoLabelColor) {
    labelColor = getContrastTextColor(arcColor);
  } else {
    labelColor = '#000000'; // Default black
  }

  showLabel(managed, text, evaluation, arc, labelColor);
}

function evaluateLabelVisibility(arc: LayoutArc, text: string, cx: number, cy: number): LabelEvaluation {
  const span = arc.x1 - arc.x0;
  if (!(span > 0)) {
    return { visible: false, reason: 'no-span' };
  }

  const radialThickness = Math.max(0, arc.y1 - arc.y0);
  if (radialThickness < LABEL_MIN_RADIAL_THICKNESS) {
    return { visible: false, reason: 'thin-radius' };
  }

  const midRadius = arc.y0 + radialThickness * 0.5;
  const fontSize = Math.min(Math.max(radialThickness * 0.5, LABEL_MIN_FONT_SIZE), LABEL_MAX_FONT_SIZE);
  const estimatedWidth = text.length * fontSize * LABEL_CHAR_WIDTH_FACTOR + LABEL_PADDING;
  const arcLength = span * midRadius;

  // Apply safety margin for centered text to prevent cut-off at boundaries
  const requiredLength = estimatedWidth * LABEL_SAFETY_MARGIN;
  if (arcLength < requiredLength) {
    return { visible: false, reason: 'narrow-arc' };
  }

  const angle = (arc.x0 + arc.x1) * 0.5;
  const point = polarToCartesian(cx, cy, midRadius, angle);

  // Compute a small delta angle for local sampling (keeps delta proportional to arc span)
  const smallDelta = Math.min(Math.max(span * 0.01, 1e-4), 0.1);

  // Sample points just before and after midpoint
  const aBefore = angle - smallDelta;
  const aAfter = angle + smallDelta;
  const pBefore = polarToCartesian(cx, cy, midRadius, aBefore);
  const pAfter = polarToCartesian(cx, cy, midRadius, aAfter);

  // Tangent vector in screen coordinates
  const tx = pAfter.x - pBefore.x;
  const ty = pAfter.y - pBefore.y;

  // Tangent angle in [-π, π]
  const tangentAngle = Math.atan2(ty, tx);
  // Normalize to [0, TAU)
  const normalizedTangent = ((tangentAngle % TAU) + TAU) % TAU;

  // Invert when tangent points leftwards (between 90° and 270°)
  const inverted = normalizedTangent >= Math.PI / 2 && normalizedTangent < (3 * Math.PI) / 2;
  const pathData = createLabelArcPath({
    arc,
    radius: midRadius,
    inverted,
    cx,
    cy,
  });

  if (!pathData) {
    return { visible: false, reason: 'path-error' };
  }

  return {
    visible: true,
    x: point.x,
    y: point.y,
    fontSize,
    pathData,
    inverted,
  };
}

function createLabelArcPath(params: {
  arc: LayoutArc;
  radius: number;
  inverted: boolean;
  cx: number;
  cy: number;
}): string | null {
  const { arc, radius, inverted, cx, cy } = params;
  if (!(radius > ZERO_TOLERANCE)) {
    return null;
  }

  const span = Math.max(arc.x1 - arc.x0, 0);
  if (!(span > ZERO_TOLERANCE)) {
    return null;
  }

  const sweepFlag = inverted ? 0 : 1;
  const normalizedSpan = Math.min(span, TAU);

  if (normalizedSpan >= TAU - ZERO_TOLERANCE) {
    const startAnchor = inverted ? arc.x1 : arc.x0;
    const firstHalf = startAnchor + Math.PI * (inverted ? -1 : 1);
    const start = polarToCartesian(cx, cy, radius, startAnchor);
    const mid = polarToCartesian(cx, cy, radius, firstHalf);

    return [
      `M ${start.x} ${start.y}`,
      `A ${radius} ${radius} 0 1 ${sweepFlag} ${mid.x} ${mid.y}`,
      `A ${radius} ${radius} 0 1 ${sweepFlag} ${start.x} ${start.y}`,
    ].join(' ');
  }

  const startAngle = inverted ? arc.x1 : arc.x0;
  const endAngle = inverted ? arc.x0 : arc.x1;
  const largeArcFlag = normalizedSpan > Math.PI ? 1 : 0;

  const start = polarToCartesian(cx, cy, radius, startAngle);
  const end = polarToCartesian(cx, cy, radius, endAngle);

  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} ${sweepFlag} ${end.x} ${end.y}`;
}

function showLabel(managed: ManagedPath, text: string, evaluation: LabelEvaluation, arc: LayoutArc, labelColor: string): void {
  const { labelElement, textPathElement, labelPathElement } = managed;
  if (!evaluation.x || !evaluation.y || !evaluation.fontSize || !evaluation.pathData) {
    return;
  }

  if (textPathElement.textContent !== text) {
    textPathElement.textContent = text;
  }
  labelElement.style.display = '';
  labelElement.style.fontSize = `${evaluation.fontSize.toFixed(2)}px`;
  labelElement.style.opacity = managed.element.style.opacity;
  labelElement.setAttribute('fill', labelColor);
  labelElement.setAttribute('data-layer', arc.layerId);
  labelElement.setAttribute('data-depth', String(arc.depth));
  labelPathElement.setAttribute('d', evaluation.pathData);
  textPathElement.setAttribute('startOffset', '50%');
  textPathElement.setAttribute('spacing', 'auto');

  labelElement.removeAttribute('transform');
  if (evaluation.inverted) {
    labelElement.setAttribute('data-inverted', 'true');
  } else {
    labelElement.removeAttribute('data-inverted');
  }

  managed.labelVisible = true;
  managed.labelHiddenReason = null;
  managed.labelPendingLogReason = null;
}

function hideLabel(
  managed: ManagedPath,
  reason: string,
  logPayload?: LabelLogPayload | null,
  forceLog?: boolean,
): void {
  if (managed.labelVisible || managed.labelHiddenReason !== reason) {
    managed.labelElement.style.display = 'none';
    managed.labelElement.style.opacity = managed.element.style.opacity;
    managed.labelVisible = false;
    managed.textPathElement.textContent = '';
    managed.labelPathElement.removeAttribute('d');
    managed.labelElement.removeAttribute('transform');
    managed.labelElement.removeAttribute('data-inverted');
  } else {
    managed.labelElement.style.display = 'none';
  }

  if (logPayload && (forceLog || managed.labelHiddenReason !== reason)) {
    logHiddenLabel(logPayload);
  }

  managed.labelHiddenReason = reason;
}

type LabelLogPayload = {
  layerId: string;
  name: string;
  reason: string;
  arc: LayoutArc;
};

function createLabelLogPayload(arc: LayoutArc, text: string, reason: string): LabelLogPayload {
  return {
    layerId: arc.layerId,
    name: text,
    reason,
    arc,
  };
}

function shouldLogLabelReason(reason: string): boolean {
  return reason === 'thin-radius' || reason === 'narrow-arc' || reason === 'no-span' || reason === 'path-error';
}

function logHiddenLabel(payload: LabelLogPayload): void {
  if (typeof console === 'undefined' || typeof console.info !== 'function') {
    return;
  }

  let friendlyReason = 'node is too small to display a label safely';
  if (payload.reason === 'thin-radius') {
    friendlyReason = 'radial thickness is too small for a readable label';
  } else if (payload.reason === 'narrow-arc') {
    friendlyReason = 'arc span is too narrow for the label text';
  } else if (payload.reason === 'no-span') {
    friendlyReason = 'the arc span is effectively zero';
  } else if (payload.reason === 'path-error') {
    friendlyReason = 'the label path could not be established for this arc';
  }

  console.info(
    `[Sand.js] Hiding label "${payload.name}" on layer "${payload.layerId}" because ${friendlyReason}.`,
  );
}
function startArcAnimation(params: {
  managed: ManagedPath;
  from: LayoutArc;
  to: LayoutArc;
  finalPath: string;
  transition: ResolvedTransition;
  drivers: AnimationDrivers;
  cx: number;
  cy: number;
  debug: boolean;
  renderOptions: RenderSvgOptions;
  arcColor: string;
}): void {
  const { managed, from, to, finalPath, transition, drivers, cx, cy, debug, renderOptions, arcColor } = params;
  stopArcAnimation(managed);

  const element = managed.element;
  const handle = runAnimation({
    drivers,
    duration: transition.duration,
    delay: transition.delay,
    easing: transition.easing,
    onUpdate: (progress) => {
      const frameArc = interpolateArc(from, to, progress);
      const framePath = describeArcPath(frameArc, cx, cy) ?? finalPath;
      applyPathData(element, framePath);
      updateArcLabel(managed, frameArc, { cx, cy, allowLogging: false, renderOptions, arcColor });
    },
    onComplete: () => {
      applyPathData(element, finalPath);
      updateArcLabel(managed, to, { cx, cy, allowLogging: debug, renderOptions, arcColor });
      managed.animation = null;
    },
    onCancel: () => {
      applyPathData(element, finalPath);
      updateArcLabel(managed, to, { cx, cy, allowLogging: debug, renderOptions, arcColor });
      managed.animation = null;
    },
  });

  managed.animation = handle;
}

function stopArcAnimation(managed: ManagedPath): void {
  if (managed.animation) {
    managed.animation.cancel();
    managed.animation = null;
  }
}

function stopManagedAnimations(managed: ManagedPath): void {
  stopArcAnimation(managed);
  stopFade(managed);
}

function cancelPendingRemoval(managed: ManagedPath): void {
  if (!managed.pendingRemoval) {
    return;
  }
  managed.pendingRemoval = false;
  stopFade(managed);
  managed.element.style.opacity = '';
  managed.element.style.pointerEvents = '';
}

function scheduleManagedRemoval(params: {
  key: string;
  managed: ManagedPath;
  host: SVGElement;
  registry: Map<string, ManagedPath>;
  transition: ResolvedTransition | null;
  drivers: AnimationDrivers;
  cx: number;
  cy: number;
  navigationMorph: boolean;
  debug: boolean;
  renderOptions: RenderSvgOptions;
}): void {
  const { key, managed, host, registry, transition, drivers, cx, cy, navigationMorph, debug, renderOptions } = params;
  if (managed.pendingRemoval) {
    return;
  }

  managed.pendingRemoval = true;
  stopArcAnimation(managed);
  stopFade(managed);
  managed.element.style.pointerEvents = 'none';
  hideLabel(managed, 'pending-removal');

  const remove = () => {
    stopManagedAnimations(managed);
    if (managed.element.parentNode === host) {
      host.removeChild(managed.element);
    }
    if (managed.labelElement.parentNode === host) {
      host.removeChild(managed.labelElement);
    }
    if (managed.labelPathElement.parentNode) {
      managed.labelPathElement.parentNode.removeChild(managed.labelPathElement);
    }
    registry.delete(key);
    managed.dispose();
  };

  if (!transition) {
    remove();
    return;
  }

  if (navigationMorph) {
    const collapsedArc = createCollapsedArc(managed.arc);
    const collapsedPath = describeArcPath(collapsedArc, cx, cy) ?? '';
    const arcColor = managed.element.getAttribute('fill') || 'currentColor';
    startArcAnimation({
      managed,
      from: managed.arc,
      to: collapsedArc,
      finalPath: collapsedPath,
      transition,
      drivers,
      cx,
      cy,
      debug,
      renderOptions,
      arcColor,
    });
  }

  const startOpacity = getCurrentOpacity(managed.element);
  managed.fade = startFade({
    managed,
    from: startOpacity,
    to: 0,
    transition,
    drivers,
    resetStyleOnComplete: false,
    onComplete: () => {
      managed.fade = null;
      remove();
    },
    onCancel: () => {
      managed.fade = null;
      managed.pendingRemoval = false;
      managed.element.style.opacity = '';
      managed.element.style.pointerEvents = '';
    },
  });
}
