import { describeArcPath } from '../geometry.js';
import { interpolateArc } from '../transition.js';
import { SVG_NS, XLINK_NS } from './constants.js';
import type { RuntimeSet, ManagedPath, AnimationDrivers } from './types.js';
import type { LayoutArc } from '../../types/index.js';
import type { ResolvedRenderOptions } from '../types.js';
import type { ResolvedTransition } from '../transition.js';
import {
  startFade,
  stopFade,
  createCollapsedArc,
  runAnimation,
} from './animation.js';
import { updateArcLabel } from './label-system.js';

/**
 * Counter for generating unique label path IDs
 */
let labelIdCounter = 0;

/**
 * Creates a new managed path with all associated label elements
 */
export function createManagedPath(params: {
  key: string;
  arc: LayoutArc;
  options: ResolvedRenderOptions;
  runtime: RuntimeSet;
  doc: Document;
  labelDefs: SVGDefsElement;
}): ManagedPath {
  const { key, arc, options, runtime, doc, labelDefs } = params;
  const element = doc.createElementNS(SVG_NS, 'path');
  element.style.outline = 'none';

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
        labelElement.remove();
      }
      if (labelPathElement.parentNode) {
        labelPathElement.remove();
      }
    },
  };

  attachEventHandlers(managed, abortController.signal);

  return managed;
}

function attachEventHandlers(managed: ManagedPath, signal: AbortSignal): void {
  const { element } = managed;

  const handleEnter = (event: PointerEvent) => {
    const { arc, runtime, options } = managed;
    runtime.tooltip?.show(event, arc);
    runtime.highlight?.pointerEnter(arc, element);
    if (!runtime.navigation?.handlesBreadcrumbs()) {
      runtime.breadcrumbs?.show(arc);
    }
    options.onArcEnter?.({ arc, path: element, event });
  };

  const handleMove = (event: PointerEvent) => {
    const { arc, runtime, options } = managed;
    runtime.tooltip?.move(event);
    runtime.highlight?.pointerMove(arc, element);
    options.onArcMove?.({ arc, path: element, event });
  };

  const handleLeave = (event: PointerEvent) => {
    const { arc, runtime, options } = managed;
    runtime.tooltip?.hide();
    runtime.highlight?.pointerLeave(arc, element);
    if (!runtime.navigation?.handlesBreadcrumbs()) {
      runtime.breadcrumbs?.clear();
    }
    options.onArcLeave?.({ arc, path: element, event });
  };

  const handleClick = (event: MouseEvent) => {
    const { arc, runtime, options } = managed;
    runtime.highlight?.handleClick?.(arc, element, event);
    runtime.navigation?.handleArcClick(arc);
    options.onArcClick?.({ arc, path: element, event });
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    const { arc, runtime, options } = managed;
    runtime.navigation?.handleArcClick(arc);
    options.onArcClick?.({ arc, path: element, event: event as unknown as MouseEvent });
  };

  let savedStroke: string | null = null;
  let savedStrokeWidth: string | null = null;

  const handleFocus = () => {
    const { arc, runtime } = managed;
    element.classList.add('is-focused');
    savedStroke = element.getAttribute('stroke');
    savedStrokeWidth = element.getAttribute('stroke-width');
    element.parentNode?.appendChild(element);
    element.setAttribute('stroke', '#005fcc');
    element.setAttribute('stroke-width', '2');
    runtime.tooltip?.showAt(element.getBoundingClientRect(), arc);
    if (!runtime.navigation?.handlesBreadcrumbs()) {
      runtime.breadcrumbs?.show(arc);
    }
  };

  const handleBlur = () => {
    const { runtime } = managed;
    element.classList.remove('is-focused');
    if (savedStroke) {
      element.setAttribute('stroke', savedStroke);
    } else {
      element.removeAttribute('stroke');
    }
    if (savedStrokeWidth) {
      element.setAttribute('stroke-width', savedStrokeWidth);
    } else {
      element.removeAttribute('stroke-width');
    }
    savedStroke = null;
    savedStrokeWidth = null;
    runtime.tooltip?.hide();
    if (!runtime.navigation?.handlesBreadcrumbs()) {
      runtime.breadcrumbs?.clear();
    }
  };

  element.addEventListener('pointerenter', handleEnter, { signal });
  element.addEventListener('pointermove', handleMove, { signal });
  element.addEventListener('pointerleave', handleLeave, { signal });
  element.addEventListener('pointercancel', handleLeave, { signal });
  element.addEventListener('click', handleClick, { signal });
  element.addEventListener('keydown', handleKeyDown, { signal });
  element.addEventListener('focus', handleFocus, { signal });
  element.addEventListener('blur', handleBlur, { signal });
}

function applyBorderStyles(element: SVGPathElement, arc: LayoutArc, options: ResolvedRenderOptions): void {
  const layer = options.config.layers.find(l => l.id === arc.layerId);
  const borderColor = layer?.borderColor ?? options.borderColor;
  const borderWidth = layer?.borderWidth ?? options.borderWidth;

  if (borderColor) element.setAttribute('stroke', borderColor);
  if (borderWidth !== undefined) element.setAttribute('stroke-width', String(borderWidth));
}

function applyDataAttributes(element: SVGPathElement, arc: LayoutArc): void {
  element.dataset.layer = arc.layerId;
  element.dataset.name = arc.data.name;
  element.dataset.depth = String(arc.depth);

  setOrRemoveAttribute(element, 'data-collapsed', arc.data.collapsed ? 'true' : null);
  setOrRemoveAttribute(element, 'data-key', arc.key ?? null);
  setOrRemoveAttribute(element, 'data-tooltip', typeof arc.data.tooltip === 'string' ? arc.data.tooltip : null);

  element.setAttribute('tabindex', '0');
  element.setAttribute('role', 'button');
  const percentage = arc.percentage > 0 ? ` (${(arc.percentage * 100).toFixed(1)}%)` : '';
  element.setAttribute('aria-label', `${arc.data.name}${percentage}`);
}

function setOrRemoveAttribute(element: Element, name: string, value: string | null): void {
  if (value) {
    element.setAttribute(name, value);
  } else {
    element.removeAttribute(name);
  }
}

function buildClassList(arc: LayoutArc, options: ResolvedRenderOptions): string {
  const tokens: string[] = ['sand-arc'];
  const seen = new Set<string>(tokens);

  if (arc.depth === 0) tokens.push('is-root');
  if (arc.data.collapsed) tokens.push('is-collapsed');

  const dynamicClass = options.classForArc?.(arc);
  const candidates = Array.isArray(dynamicClass) ? dynamicClass : [dynamicClass];

  for (const candidate of candidates) {
    if (!candidate) continue;
    for (const piece of candidate.split(/\s+/)) {
      const trimmed = piece.trim();
      if (trimmed && !seen.has(trimmed)) {
        seen.add(trimmed);
        tokens.push(trimmed);
      }
    }
  }

  return tokens.join(' ');
}

/**
 * Updates an existing managed path with new arc data
 */
export function updateManagedPath(
  managed: ManagedPath,
  params: {
    arc: LayoutArc;
    options: ResolvedRenderOptions;
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

  applyBorderStyles(element, arc, options);
  applyDataAttributes(element, arc);
  element.setAttribute('class', buildClassList(arc, options));

  options.decoratePath?.(element, arc);
  runtime.highlight?.register(arc, element);

  element.style.pointerEvents = '';

  if (animateArc) {
    managed.labelPendingLogReason = null;
  }

  const needsFadeIn = !previousArc && transition && !navigationMorph;
  if (!needsFadeIn) {
    element.style.opacity = '';
    return;
  }

  element.style.opacity = '0';
  managed.fade = startFade({
    managed,
    from: 0,
    to: 1,
    transition,
    drivers,
    resetStyleOnComplete: true,
    onComplete: () => { managed.fade = null; },
    onCancel: () => { managed.fade = null; },
  });
}

/**
 * Checks if arc geometry has changed
 */
function hasArcGeometryChanged(a: LayoutArc, b: LayoutArc): boolean {
  return a.x0 !== b.x0 || a.x1 !== b.x1 || a.y0 !== b.y0 || a.y1 !== b.y1;
}

/**
 * Applies path data to an SVG path element
 */
function applyPathData(element: SVGPathElement, pathData: string | null | undefined): void {
  if (pathData && pathData.length > 0) {
    element.setAttribute('d', pathData);
  } else {
    element.removeAttribute('d');
  }
}

/**
 * Starts an arc morph animation from one layout to another
 */
export function startArcAnimation(params: {
  managed: ManagedPath;
  from: LayoutArc;
  to: LayoutArc;
  finalPath: string;
  transition: ResolvedTransition;
  drivers: AnimationDrivers;
  cx: number;
  cy: number;
  debug: boolean;
  renderOptions: ResolvedRenderOptions;
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

/**
 * Stops the active arc animation if any
 */
export function stopArcAnimation(managed: ManagedPath): void {
  if (managed.animation) {
    managed.animation.cancel();
    managed.animation = null;
  }
}

/**
 * Stops all animations (arc + fade) on a managed path
 */
export function stopManagedAnimations(managed: ManagedPath): void {
  stopArcAnimation(managed);
  stopFade(managed);
}
