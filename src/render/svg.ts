import { layout } from '../layout/index.js';
import { LayoutArc, SunburstConfig } from '../types/index.js';
import {
  RenderSvgOptions,
  RenderHandle,
  RenderSvgUpdateInput,
  RenderSvgUpdateOptions,
} from './types.js';
import { describeArcPath } from './geometry.js';
import { resolveTransition, interpolateArc, ResolvedTransition } from './transition.js';
import { createTooltipRuntime, TooltipRuntime } from './runtime/tooltip.js';
import { createBreadcrumbRuntime, BreadcrumbRuntime } from './runtime/breadcrumbs.js';
import { createHighlightRuntime, HighlightRuntime } from './runtime/highlight.js';
import { resolveDocument, resolveHostElement } from './runtime/document.js';
import { createArcKey } from './keys.js';
import { createNavigationRuntime, NavigationRuntime } from './runtime/navigation.js';
import { cloneSunburstConfig } from './config.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

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
  arc: LayoutArc;
  options: RenderSvgOptions;
  runtime: RuntimeSet;
  animation: AnimationHandle | null;
  fade: AnimationHandle | null;
  pendingRemoval: boolean;
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

    const navigationTransition = navigation?.consumeTransitionOverride?.();
    const transitionSource = navigationTransition !== undefined ? navigationTransition : currentOptions.transition;
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
      });

      host.appendChild(managed.element);
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

function createManagedPath(params: {
  key: string;
  arc: LayoutArc;
  options: RenderSvgOptions;
  runtime: RuntimeSet;
  doc: Document;
}): ManagedPath {
  const { key, arc, options, runtime, doc } = params;
  const element = doc.createElementNS(SVG_NS, 'path');

  const managed: ManagedPath = {
    key,
    element,
    arc,
    options,
    runtime,
    animation: null,
    fade: null,
    pendingRemoval: false,
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
  },
): void {
  const { arc, options, runtime, pathData, previousArc, transition, drivers, cx, cy } = params;

  managed.arc = arc;
  managed.options = options;
  managed.runtime = runtime;
  managed.pendingRemoval = false;

  stopFade(managed);

  const element = managed.element;
  const animateArc = Boolean(transition && previousArc && hasArcGeometryChanged(previousArc, arc));
  if (animateArc) {
    startArcAnimation({
      managed,
      from: previousArc!,
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

  if (!previousArc) {
    if (transition) {
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
    },
    onComplete: () => {
      applyPathData(element, finalPath);
      managed.animation = null;
    },
    onCancel: () => {
      applyPathData(element, finalPath);
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
  const start = clamp01Local(from);
  const end = clamp01Local(to);

  element.style.opacity = start.toString();

  return runAnimation({
    drivers,
    duration: transition.duration,
    delay: transition.delay,
    easing: transition.easing,
    onUpdate: (progress) => {
      const value = start + (end - start) * progress;
      element.style.opacity = value.toString();
    },
    onComplete: () => {
      finalizeOpacity(element, end, resetStyleOnComplete);
      onComplete?.();
    },
    onCancel: () => {
      finalizeOpacity(element, end, resetStyleOnComplete);
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
}): void {
  const { key, managed, host, registry, transition, drivers } = params;
  if (managed.pendingRemoval) {
    return;
  }

  managed.pendingRemoval = true;
  stopArcAnimation(managed);
  stopFade(managed);
  managed.element.style.pointerEvents = 'none';

  const remove = () => {
    stopManagedAnimations(managed);
    if (managed.element.parentNode === host) {
      host.removeChild(managed.element);
    }
    registry.delete(key);
    managed.dispose();
  };

  if (!transition) {
    remove();
    return;
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

function getCurrentOpacity(element: SVGPathElement): number {
  const value = element.style.opacity;
  if (!value) {
    return 1;
  }
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) {
    return 1;
  }
  return clamp01Local(parsed);
}

function finalizeOpacity(element: SVGPathElement, opacity: number, resetStyle?: boolean): void {
  if (resetStyle && opacity === 1) {
    element.style.opacity = '';
  } else {
    element.style.opacity = opacity.toString();
  }
}

function clamp01Local(value: number): number {
  if (value <= 0) {
    return 0;
  }
  if (value >= 1) {
    return 1;
  }
  return value;
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
