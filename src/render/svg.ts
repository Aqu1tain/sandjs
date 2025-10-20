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
import { createTooltipRuntime, TooltipRuntime } from './runtime/tooltip.js';
import { createBreadcrumbRuntime, BreadcrumbRuntime } from './runtime/breadcrumbs.js';
import { createHighlightRuntime, HighlightRuntime } from './runtime/highlight.js';
import { resolveDocument, resolveHostElement } from './runtime/document.js';
import { createArcKey } from './keys.js';
import { createNavigationRuntime, NavigationRuntime } from './runtime/navigation.js';
import { cloneSunburstConfig } from './config.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const XLINK_NS = 'http://www.w3.org/1999/xlink';
let labelIdCounter = 0;
const LABEL_MIN_RADIAL_THICKNESS = 14;
const LABEL_MIN_FONT_SIZE = 12;
const LABEL_MAX_FONT_SIZE = 18;
const LABEL_CHAR_WIDTH_FACTOR = 0.6;
const LABEL_PADDING = 6;
const COLLAPSED_ARC_SPAN_SHRINK_FACTOR = 0.1;
const COLLAPSED_ARC_MIN_SPAN = 0.01;
const COLLAPSED_ARC_THICKNESS_SHRINK_FACTOR = 0.1;
const COLLAPSED_ARC_MIN_THICKNESS = 0.5;


/**
 * Renders the supplied `SunburstConfig` into the target SVG element.
 *
 * @public
 */
type RuntimeSet = {
  tooltip: TooltipRuntime | null;
  highlight: HighlightRuntime | null;
  breadcrumbs: BreadcrumbRuntime | null;
  navigation: NavigationRuntime | null;
};

type AnimationHandle = {
  cancel(): void;
};

type AnimationDrivers = {
  raf: (callback: FrameRequestCallback) => number;
  caf: (handle: number) => void;
  now: () => number;
};

type ManagedPath = {
  key: string;
  element: SVGPathElement;
  labelElement: SVGTextElement;
  labelPathElement: SVGPathElement;
  textPathElement: SVGTextPathElement;
  labelPathId: string;
  arc: LayoutArc;
  options: RenderSvgOptions;
  runtime: RuntimeSet;
  animation: AnimationHandle | null;
  fade: AnimationHandle | null;
  pendingRemoval: boolean;
  labelVisible: boolean;
  labelHiddenReason: string | null;
  labelPendingLogReason: string | null;
  listeners: {
    enter: (event: PointerEvent) => void;
    move: (event: PointerEvent) => void;
    leave: (event: PointerEvent) => void;
    click?: (event: MouseEvent) => void;
  };
  dispose: () => void;
};

export function renderSVG(options: RenderSvgOptions): RenderHandle {
  const doc = resolveDocument(options.document);
  const host = resolveHostElement(options.el, doc);
  const labelDefs = ensureLabelDefs(host, doc);

  let currentOptions: RenderSvgOptions = {
    ...options,
    el: host,
    document: doc,
  };

  let baseConfig = cloneSunburstConfig(currentOptions.config);
  currentOptions = {
    ...currentOptions,
    config: baseConfig,
  };

  const pathRegistry = new Map<string, ManagedPath>();
  const drivers = createAnimationDrivers(doc);
  const handleArray: LayoutArc[] = [];
  const handle = handleArray as unknown as RenderHandle;

  let runtimes: RuntimeSet;
  let isRendering = false;
  let pendingRender = false;

  const execute = (): LayoutArc[] => {
    const runtime = runtimes;
    const navigation = runtime.navigation;
    const activeConfig = navigation ? navigation.getActiveConfig() : currentOptions.config;
    currentOptions = {
      ...currentOptions,
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
    const transitionSource = navigationTransition ? navigationTransition.transition : currentOptions.transition;
    const navigationMorph = Boolean(navigationTransition?.morph);
    const transition = resolveTransition(transitionSource);
    const usedKeys = new Set<string>();

    for (let index = 0; index < arcs.length; index += 1) {
      const arc = arcs[index];
      const d = describeArcPath(arc, cx, cy);
      if (!d) {
        continue;
      }

      const key = createArcKey(arc);
      usedKeys.add(key);

      let managed = pathRegistry.get(key);
      let previousArc: LayoutArc | null = null;
      if (managed) {
        previousArc = { ...managed.arc };
        cancelPendingRemoval(managed);
      } else {
        managed = createManagedPath({
          key,
          arc,
          options: currentOptions,
          runtime,
          doc,
          labelDefs,
        });
        pathRegistry.set(key, managed);
      }

      updateManagedPath(managed, {
        arc,
        options: currentOptions,
        runtime,
        pathData: d,
        previousArc,
        transition,
        drivers,
        cx,
        cy,
        navigationMorph,
      });

      host.appendChild(managed.element);
      host.appendChild(managed.labelElement);
    }

    for (const [key, managed] of pathRegistry) {
      if (!usedKeys.has(key)) {
        scheduleManagedRemoval({
          key,
          managed,
          host,
          registry: pathRegistry,
          transition,
          drivers,
          cx,
          cy,
          navigationMorph,
        });
      }
    }

    return arcs;
  };

  const renderLoop = () => {
    if (isRendering) {
      pendingRender = true;
      return;
    }
    isRendering = true;
    do {
      pendingRender = false;
      const arcs = execute();
      handle.length = 0;
      handle.push(...arcs);
    } while (pendingRender);
    isRendering = false;
  };

  const requestRender = () => {
    pendingRender = true;
    if (!isRendering) {
      renderLoop();
    }
  };

  runtimes = createRuntimeSet(doc, currentOptions, {
    baseConfig,
    requestRender,
  });

  requestRender();

  Object.defineProperties(handle, {
    update: {
      enumerable: false,
      value(input: RenderSvgUpdateInput) {
        const nextOptions = normalizeUpdateOptions(currentOptions, input, host, doc);
        const nextConfigInput = extractConfigFromUpdate(input, baseConfig);
        baseConfig = cloneSunburstConfig(nextConfigInput);
        currentOptions = {
          ...nextOptions,
          config: baseConfig,
        };
        disposeRuntimeSet(runtimes);
        runtimes = createRuntimeSet(doc, currentOptions, {
          baseConfig,
          requestRender,
        });
        requestRender();
        return handle;
      },
    },
    destroy: {
      enumerable: false,
      value() {
        disposeRuntimeSet(runtimes);
        for (const managed of pathRegistry.values()) {
          managed.dispose();
          if (managed.element.parentNode === host) {
            host.removeChild(managed.element);
          }
        }
        pathRegistry.clear();
        handle.length = 0;
      },
    },
    getOptions: {
      enumerable: false,
      value() {
        return { ...currentOptions };
      },
    },
    resetNavigation: {
      enumerable: false,
      value() {
        runtimes.navigation?.reset();
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

function extractConfigFromUpdate(
  input: RenderSvgUpdateInput,
  fallback: SunburstConfig,
): SunburstConfig {
  if (isSunburstConfig(input)) {
    return input;
  }
  if (input && typeof input === 'object') {
    const candidate = (input as RenderSvgUpdateOptions).config;
    if (candidate) {
      return candidate;
    }
  }
  return fallback;
}

function isSunburstConfig(value: unknown): value is SunburstConfig {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const record = value as Record<string, unknown>;
  return 'size' in record && 'layers' in record;
}

function ensureLabelDefs(host: SVGElement, doc: Document): SVGDefsElement {
  const children = Array.from(host.childNodes);
  for (const child of children) {
    if (child instanceof SVGDefsElement && child.getAttribute('data-sand-labels') === 'true') {
      return child;
    }
  }

  const defs = doc.createElementNS(SVG_NS, 'defs');
  defs.setAttribute('data-sand-labels', 'true');
  if (host.firstChild) {
    host.insertBefore(defs, host.firstChild);
  } else {
    host.appendChild(defs);
  }
  return defs;
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
  labelElement.setAttribute('fill', '#000');
  labelElement.setAttribute('text-anchor', 'middle');
  labelElement.setAttribute('dominant-baseline', 'middle');
  labelElement.setAttribute('aria-hidden', 'true');
  labelElement.style.pointerEvents = 'none';
  labelElement.style.userSelect = 'none';
  labelElement.style.display = 'none';

  textPathElement.setAttribute('startOffset', '50%');
  textPathElement.setAttribute('method', 'align');
  textPathElement.setAttribute('class', 'sand-arc-label-textpath');
  textPathElement.textContent = '';
  textPathElement.style.pointerEvents = 'none';
  textPathElement.setAttributeNS(XLINK_NS, 'xlink:href', `#${labelPathId}`);
  textPathElement.setAttribute('href', `#${labelPathId}`);

  labelElement.appendChild(textPathElement);

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
    listeners: {} as ManagedPath['listeners'],
    dispose: () => {
      stopManagedAnimations(managed);
      managed.pendingRemoval = false;
      element.removeEventListener('pointerenter', managed.listeners.enter);
      element.removeEventListener('pointermove', managed.listeners.move);
      element.removeEventListener('pointerleave', managed.listeners.leave);
      element.removeEventListener('pointercancel', managed.listeners.leave);
      if (managed.listeners.click) {
        element.removeEventListener('click', managed.listeners.click);
      }
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

  element.addEventListener('pointerenter', handleEnter);
  element.addEventListener('pointermove', handleMove);
  element.addEventListener('pointerleave', handleLeave);
  element.addEventListener('pointercancel', handleLeave);
  element.addEventListener('click', handleClick);

  managed.listeners = {
    enter: handleEnter,
    move: handleMove,
    leave: handleLeave,
    click: handleClick,
  };

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
  },
): void {
  const { arc, options, runtime, pathData, previousArc, transition, drivers, cx, cy, navigationMorph } = params;

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
    });
  } else {
    stopArcAnimation(managed);
    applyPathData(element, pathData);
    updateArcLabel(managed, arc, { cx, cy, allowLogging: true });
  }

  element.setAttribute('fill', arc.data.color ?? 'currentColor');
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
  const { cx, cy, allowLogging } = options;

  if (managed.pendingRemoval) {
    hideLabel(managed, 'pending-removal');
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

  showLabel(managed, text, evaluation, arc);
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

  if (arcLength < estimatedWidth) {
    return { visible: false, reason: 'narrow-arc' };
  }

  const angle = (arc.x0 + arc.x1) * 0.5;
  const point = polarToCartesian(cx, cy, midRadius, angle);
  const inverted = angle > Math.PI * 0.5 && angle < Math.PI * 1.5;
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

function showLabel(managed: ManagedPath, text: string, evaluation: LabelEvaluation, arc: LayoutArc): void {
  const { labelElement, textPathElement, labelPathElement } = managed;
  if (!evaluation.x || !evaluation.y || !evaluation.fontSize || !evaluation.pathData) {
    return;
  }

  const xValue = evaluation.x.toFixed(2);
  const yValue = evaluation.y.toFixed(2);

  if (textPathElement.textContent !== text) {
    textPathElement.textContent = text;
  }
  labelElement.style.display = '';
  labelElement.setAttribute('x', xValue);
  labelElement.setAttribute('y', yValue);
  labelElement.style.fontSize = `${evaluation.fontSize.toFixed(2)}px`;
  labelElement.style.opacity = managed.element.style.opacity;
  labelElement.setAttribute('data-layer', arc.layerId);
  labelElement.setAttribute('data-depth', String(arc.depth));
  labelPathElement.setAttribute('d', evaluation.pathData);
  textPathElement.setAttribute('startOffset', '50%');

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
}): void {
  const { managed, from, to, finalPath, transition, drivers, cx, cy } = params;
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
      updateArcLabel(managed, frameArc, { cx, cy, allowLogging: false });
    },
    onComplete: () => {
      applyPathData(element, finalPath);
      updateArcLabel(managed, to, { cx, cy, allowLogging: true });
      managed.animation = null;
    },
    onCancel: () => {
      applyPathData(element, finalPath);
      updateArcLabel(managed, to, { cx, cy, allowLogging: true });
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

type FadeParams = {
  managed: ManagedPath;
  from: number;
  to: number;
  transition: ResolvedTransition;
  drivers: AnimationDrivers;
  resetStyleOnComplete?: boolean;
  onComplete?: () => void;
  onCancel?: () => void;
};

function startFade(params: FadeParams): AnimationHandle {
  const { managed, from, to, transition, drivers, resetStyleOnComplete, onComplete, onCancel } = params;
  const element = managed.element;
  const label = managed.labelElement;
  const start = clamp01(from);
  const end = clamp01(to);

  const startString = start.toString();
  element.style.opacity = startString;
  label.style.opacity = startString;

  return runAnimation({
    drivers,
    duration: transition.duration,
    delay: transition.delay,
    easing: transition.easing,
    onUpdate: (progress) => {
      const value = start + (end - start) * progress;
      const valueString = value.toString();
      element.style.opacity = valueString;
      label.style.opacity = valueString;
    },
    onComplete: () => {
      finalizeOpacity(element, end, resetStyleOnComplete);
      finalizeOpacity(label, end, resetStyleOnComplete);
      onComplete?.();
    },
    onCancel: () => {
      finalizeOpacity(element, end, resetStyleOnComplete);
      finalizeOpacity(label, end, resetStyleOnComplete);
      onCancel?.();
    },
  });
}

function stopFade(managed: ManagedPath): void {
  if (managed.fade) {
    managed.fade.cancel();
    managed.fade = null;
  }
}

function stopManagedAnimations(managed: ManagedPath): void {
  stopArcAnimation(managed);
  stopFade(managed);
}

type RunAnimationParams = {
  drivers: AnimationDrivers;
  duration: number;
  delay: number;
  easing: (t: number) => number;
  onUpdate: (progress: number) => void;
  onComplete?: () => void;
  onCancel?: () => void;
};

function runAnimation(params: RunAnimationParams): AnimationHandle {
  const { drivers, duration, delay, easing, onUpdate, onComplete, onCancel } = params;

  if (duration <= 0 && delay <= 0) {
    onUpdate(1);
    onComplete?.();
    return {
      cancel() {
        onCancel?.();
      },
    };
  }

  let cancelled = false;
  let rafId = 0;
  const delayEnd = drivers.now() + delay;

  const tick: FrameRequestCallback = (timestamp) => {
    if (cancelled) {
      return;
    }
    if (timestamp < delayEnd) {
      rafId = drivers.raf(tick);
      return;
    }

    const elapsed = timestamp - delayEnd;
    const progress = duration > 0 ? Math.min(elapsed / duration, 1) : 1;
    const eased = easing(progress);
    onUpdate(eased);

    if (progress < 1) {
      rafId = drivers.raf(tick);
    } else {
      onComplete?.();
    }
  };

  rafId = drivers.raf(tick);

  return {
    cancel() {
      if (cancelled) {
        return;
      }
      cancelled = true;
      drivers.caf(rafId);
      onCancel?.();
    },
  };
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
}): void {
  const { key, managed, host, registry, transition, drivers, cx, cy, navigationMorph } = params;
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
    startArcAnimation({
      managed,
      from: managed.arc,
      to: collapsedArc,
      finalPath: collapsedPath,
      transition,
      drivers,
      cx,
      cy,
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

function getCurrentOpacity(element: SVGElement): number {
  const value = element.style.opacity;
  if (!value) {
    return 1;
  }
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) {
    return 1;
  }
  return clamp01(parsed);
}

function finalizeOpacity(element: SVGElement, opacity: number, resetStyle?: boolean): void {
  if (resetStyle && opacity === 1) {
    element.style.opacity = '';
  } else {
    element.style.opacity = opacity.toString();
  }
}

function createAnimationDrivers(doc: Document): AnimationDrivers {
  const view = doc.defaultView ?? (typeof window !== 'undefined' ? window : undefined);

  const raf =
    view && typeof view.requestAnimationFrame === 'function'
      ? view.requestAnimationFrame.bind(view)
      : (callback: FrameRequestCallback): number => {
          const handle = setTimeout(() => callback(Date.now()), 16);
          return Number(handle);
        };

  const caf =
    view && typeof view.cancelAnimationFrame === 'function'
      ? view.cancelAnimationFrame.bind(view)
      : (handle: number) => {
          clearTimeout(handle);
        };

  const now =
    view && view.performance && typeof view.performance.now === 'function'
      ? () => view.performance.now()
      : () => Date.now();

  return { raf, caf, now };
}

function createRuntimeSet(
  doc: Document,
  options: RenderSvgOptions,
  params: { baseConfig: SunburstConfig; requestRender: () => void },
): RuntimeSet {
  const tooltip = createTooltipRuntime(doc, options.tooltip);
  const highlight = createHighlightRuntime(options.highlightByKey);
  const breadcrumbs = createBreadcrumbRuntime(doc, options.breadcrumbs);
  const navigation = createNavigationRuntime(options.navigation, {
    breadcrumbs,
    requestRender: params.requestRender,
  }, params.baseConfig);
  tooltip?.hide();
  if (!navigation?.handlesBreadcrumbs()) {
    breadcrumbs?.clear();
  }
  return { tooltip, highlight, breadcrumbs, navigation };
}

function disposeRuntimeSet(runtime: RuntimeSet): void {
  runtime.tooltip?.dispose();
  runtime.highlight?.dispose();
  runtime.breadcrumbs?.dispose();
  runtime.navigation?.dispose();
}

function createCollapsedArc(source: LayoutArc): LayoutArc {
  const span = Math.max(source.x1 - source.x0, 0);
  const thickness = Math.max(source.y1 - source.y0, 0);
  const shrinkSpan = Math.max(span * COLLAPSED_ARC_SPAN_SHRINK_FACTOR, COLLAPSED_ARC_MIN_SPAN);
  const shrinkThickness = Math.max(
    thickness * COLLAPSED_ARC_THICKNESS_SHRINK_FACTOR,
    COLLAPSED_ARC_MIN_THICKNESS,
  );
  const midAngle = source.x0 + span * 0.5;
  const collapsedX0 = midAngle - shrinkSpan * 0.5;
  const collapsedX1 = midAngle + shrinkSpan * 0.5;
  const collapsedY0 = source.y0;
  const collapsedY1 = Math.min(source.y0 + shrinkThickness, source.y1);

  return {
    ...source,
    x0: collapsedX0,
    x1: collapsedX1,
    y0: collapsedY0,
    y1: collapsedY1,
    percentage: 0,
    value: 0,
  };
}
