import { layout } from '../layout/index.js';
import { LayoutArc, SunburstConfig } from '../types/index.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const ZERO_TOLERANCE = 1e-6;
const TAU = Math.PI * 2;

/**
 * Configures tooltip behaviour for `renderSVG`.
 *
 * @public
 */
export interface TooltipOptions {
  formatter?: (arc: LayoutArc) => string;
  container?: HTMLElement | string;
}

/**
 * Configures breadcrumb behaviour for `renderSVG`.
 *
 * @public
 */
export interface BreadcrumbOptions {
  container?: HTMLElement | string;
  formatter?: (arc: LayoutArc) => string;
  separator?: string;
  emptyLabel?: string;
}

/**
 * Enables automatic highlighting for arcs that share the same key.
 *
 * @public
 */
export interface HighlightByKeyOptions {
  className?: string;
  includeSource?: boolean;
  deriveKey?: (arc: LayoutArc) => string | null;
  pinOnClick?: boolean;
  pinClassName?: string;
  onPinChange?: (payload: { arc: LayoutArc; path: SVGPathElement; pinned: boolean; event: MouseEvent }) => void;
}

/**
 * Pointer event payload emitted from arc interaction callbacks.
 *
 * @public
 */
export interface ArcPointerEventPayload {
  arc: LayoutArc;
  path: SVGPathElement;
  event: PointerEvent;
}

/**
 * Click event payload emitted from arc interaction callbacks.
 *
 * @public
 */
export interface ArcClickEventPayload {
  arc: LayoutArc;
  path: SVGPathElement;
  event: MouseEvent;
}

/**
 * Options accepted by the `renderSVG` entry point.
 *
 * @public
 */
export interface RenderSvgOptions {
  el: SVGElement | string;
  config: SunburstConfig;
  document?: Document;
  classForArc?: (arc: LayoutArc) => string | string[] | undefined;
  decoratePath?: (path: SVGPathElement, arc: LayoutArc) => void;
  tooltip?: boolean | TooltipOptions;
  highlightByKey?: boolean | HighlightByKeyOptions;
  breadcrumbs?: boolean | BreadcrumbOptions;
  onArcEnter?: (payload: ArcPointerEventPayload) => void;
  onArcMove?: (payload: ArcPointerEventPayload) => void;
  onArcLeave?: (payload: ArcPointerEventPayload) => void;
  onArcClick?: (payload: ArcClickEventPayload) => void;
}

/**
 * Result of calling {@link renderSVG}. Acts like an array of arcs with helper methods.
 *
 * @public
 */
export interface RenderHandle extends Array<LayoutArc> {
  update(input: RenderSvgUpdateInput): RenderHandle;
  destroy(): void;
  getOptions(): RenderSvgOptions;
}

/**
 * Accepted input when updating an existing SVG render.
 *
 * @public
 */
export type RenderSvgUpdateInput = SunburstConfig | RenderSvgUpdateOptions;

/**
 * Partial options accepted when updating an existing render.
 *
 * @public
 */
export interface RenderSvgUpdateOptions extends Partial<Omit<RenderSvgOptions, 'el'>> {
  config?: SunburstConfig;
}

/**
 * Renders the supplied `SunburstConfig` into the target SVG element.
 *
 * @public
 */
export function renderSVG(options: RenderSvgOptions): RenderHandle {
  const doc = resolveDocument(options.document);
  const host = resolveHostElement(options.el, doc);

  let currentOptions: RenderSvgOptions = {
    ...options,
    el: host,
    document: doc,
  };

  const execute = (opts: RenderSvgOptions): LayoutArc[] => {
    const arcs = layout(opts.config);
    const diameter = opts.config.size.radius * 2;
    const cx = opts.config.size.radius;
    const cy = opts.config.size.radius;

    host.setAttribute('viewBox', `0 0 ${diameter} ${diameter}`);
    host.setAttribute('width', `${diameter}`);
    host.setAttribute('height', `${diameter}`);

    while (host.firstChild) {
      host.removeChild(host.firstChild as ChildNode);
    }

    const tooltip = createTooltipRuntime(doc, opts.tooltip);
    tooltip?.hide();
    const highlight = createHighlightRuntime(opts.highlightByKey);
    const breadcrumbs = createBreadcrumbRuntime(doc, opts.breadcrumbs);
    breadcrumbs?.clear();

    for (const arc of arcs) {
      const d = describeArcPath(arc, cx, cy);
      if (!d) {
        continue;
      }

      const path = doc.createElementNS(SVG_NS, 'path');
      path.setAttribute('d', d);
      path.setAttribute('fill', arc.data.color ?? 'currentColor');
      path.setAttribute('data-layer', arc.layerId);
      path.setAttribute('data-name', arc.data.name);
      if (arc.key) {
        path.setAttribute('data-key', arc.key);
      }

      highlight?.register(arc, path);

      const classList = ['sand-arc'];
      const dynamicClass = opts.classForArc?.(arc);
      if (typeof dynamicClass === 'string' && dynamicClass.trim().length > 0) {
        classList.push(dynamicClass.trim());
      } else if (Array.isArray(dynamicClass)) {
        for (const candidate of dynamicClass) {
          if (candidate && candidate.trim().length > 0) {
            classList.push(candidate.trim());
          }
        }
      }
      path.setAttribute('class', classList.join(' '));

      if (typeof arc.data.tooltip === 'string') {
        path.setAttribute('data-tooltip', arc.data.tooltip);
      }

      const wantsPointerTracking = Boolean(
        tooltip || highlight || breadcrumbs || opts.onArcEnter || opts.onArcMove || opts.onArcLeave,
      );

      if (wantsPointerTracking) {
        const handleEnter = (event: PointerEvent) => {
          tooltip?.show(event, arc);
          highlight?.pointerEnter(arc, path);
          breadcrumbs?.show(arc);
          opts.onArcEnter?.({ arc, path, event });
        };
        const handleMove = (event: PointerEvent) => {
          tooltip?.move(event);
          highlight?.pointerMove(arc, path);
          opts.onArcMove?.({ arc, path, event });
        };
        const handleLeave = (event: PointerEvent) => {
          tooltip?.hide();
          highlight?.pointerLeave(arc, path);
          breadcrumbs?.clear();
          opts.onArcLeave?.({ arc, path, event });
        };
        path.addEventListener('pointerenter', handleEnter);
        path.addEventListener('pointermove', handleMove);
        path.addEventListener('pointerleave', handleLeave);
        path.addEventListener('pointercancel', handleLeave);
      }

      const wantsClick = Boolean(opts.onArcClick || highlight?.handlesClick);
      if (wantsClick) {
        const handleClick = (event: MouseEvent) => {
          highlight?.handleClick?.(arc, path, event);
          opts.onArcClick?.({ arc, path, event });
        };
        path.addEventListener('click', handleClick);
      }

      opts.decoratePath?.(path, arc);
      host.appendChild(path);
    }

    return arcs;
  };

  const initialArcs = execute(currentOptions);
  const handle = initialArcs as unknown as RenderHandle;

  Object.defineProperties(handle, {
    update: {
      enumerable: false,
      value(input: RenderSvgUpdateInput) {
        currentOptions = normalizeUpdateOptions(currentOptions, input, host, doc);
        const nextArcs = execute(currentOptions);
        handle.length = 0;
        handle.push(...nextArcs);
        return handle;
      },
    },
    destroy: {
      enumerable: false,
      value() {
        while (host.firstChild) {
          host.removeChild(host.firstChild as ChildNode);
        }
        handle.length = 0;
      },
    },
    getOptions: {
      enumerable: false,
      value() {
        return { ...currentOptions };
      },
    },
  });

  return handle;
}

function resolveDocument(explicit: Document | undefined): Document {
  if (explicit) {
    return explicit;
  }

  if (typeof window !== 'undefined' && window.document) {
    return window.document;
  }

  throw new Error('renderSVG requires a Document instance');
}

function resolveHostElement(target: SVGElement | string, doc: Document): SVGElement {
  if (typeof target === 'string') {
    const resolved = doc.querySelector(target);
    if (!resolved) {
      throw new Error(`renderSVG could not find SVG element for selector "${target}"`);
    }
    if (!(resolved instanceof SVGElement)) {
      throw new Error(`renderSVG selector "${target}" did not resolve to an SVG element`);
    }
    return resolved;
  }

  return target;
}

const BREADCRUMB_ATTRIBUTE = 'data-sandjs-breadcrumbs';

type BreadcrumbRuntime = {
  show: (arc: LayoutArc) => void;
  clear: () => void;
};

function createBreadcrumbRuntime(
  doc: Document,
  input: RenderSvgOptions['breadcrumbs'],
): BreadcrumbRuntime | null {
  if (!input) {
    return null;
  }

  const options: BreadcrumbOptions =
    typeof input === 'object' && input !== null ? (input as BreadcrumbOptions) : {};
  const container = resolveTooltipContainer(doc, options.container);
  const element = ensureBreadcrumbElement(doc, container);
  applyDefaultBreadcrumbStyles(element);

  const separator = options.separator ?? ' › ';
  const formatter =
    typeof options.formatter === 'function'
      ? options.formatter
      : (arc: LayoutArc) => formatArcBreadcrumb(arc, separator);
  const emptyLabel = options.emptyLabel ?? '';
  element.textContent = emptyLabel;

  return {
    show(arc) {
      element.textContent = formatter(arc);
    },
    clear() {
      element.textContent = emptyLabel;
    },
  };
}

function ensureBreadcrumbElement(doc: Document, container: HTMLElement): HTMLElement {
  const existing = container.querySelector<HTMLElement>(`[${BREADCRUMB_ATTRIBUTE}]`);
  if (existing) {
    return existing;
  }
  const element = doc.createElement('div');
  element.setAttribute(BREADCRUMB_ATTRIBUTE, '');
  element.setAttribute('role', 'status');
  container.appendChild(element);
  return element;
}

function applyDefaultBreadcrumbStyles(element: HTMLElement): void {
  const style = element.style;
  if (!style.display) style.display = 'block';
  if (!style.fontSize) style.fontSize = '0.85rem';
  if (!style.color) style.color = 'inherit';
  if (!style.minHeight) style.minHeight = '1.2em';
  if (!style.letterSpacing) style.letterSpacing = '0.01em';
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

function isSunburstConfig(value: unknown): value is SunburstConfig {
  if (!value || typeof value !== 'object') {
    return false;
  }
  return 'size' in value && 'layers' in value;
}

type HighlightRuntime = {
  register: (arc: LayoutArc, path: SVGPathElement) => void;
  pointerEnter: (arc: LayoutArc, path: SVGPathElement) => void;
  pointerMove: (arc: LayoutArc, path: SVGPathElement) => void;
  pointerLeave: (arc: LayoutArc, path: SVGPathElement) => void;
  handleClick?: (arc: LayoutArc, path: SVGPathElement, event: MouseEvent) => void;
  handlesClick: boolean;
};

function createHighlightRuntime(input: RenderSvgOptions['highlightByKey']): HighlightRuntime | null {
  if (!input) {
    return null;
  }

  const options: HighlightByKeyOptions =
    typeof input === 'object' && input !== null ? (input as HighlightByKeyOptions) : {};
  const className = options.className?.trim() ?? 'is-related';
  const includeSource = options.includeSource ?? false;
  const deriveKey =
    typeof options.deriveKey === 'function' ? options.deriveKey : defaultHighlightKey;
  const pinOnClick = options.pinOnClick ?? false;
  const pinClassName = options.pinClassName?.trim() ?? 'is-pinned';

  const groups = new Map<string, Set<SVGPathElement>>();
  let hoverKey: string | null = null;
  let pinnedKey: string | null = null;
  let pinnedPath: SVGPathElement | null = null;

  const removeGroup = (key: string) => {
    const group = groups.get(key);
    if (!group) {
      return;
    }
    for (const candidate of group) {
      candidate.classList.remove(className);
    }
  };

  const applyGroup = (key: string, exclude?: SVGPathElement | null) => {
    const group = groups.get(key);
    if (!group) {
      return;
    }
    for (const candidate of group) {
      if (!includeSource && exclude && candidate === exclude) {
        candidate.classList.remove(className);
        continue;
      }
      candidate.classList.add(className);
    }
  };

  const clearPinned = () => {
    if (pinnedKey) {
      removeGroup(pinnedKey);
    }
    if (pinnedPath) {
      pinnedPath.classList.remove(pinClassName);
    }
    pinnedKey = null;
    pinnedPath = null;
  };

  const runtime: HighlightRuntime = {
    register(arc, path) {
      const key = deriveKey(arc);
      if (!key) {
        return;
      }
      if (!groups.has(key)) {
        groups.set(key, new Set());
      }
      groups.get(key)!.add(path);
      if (!path.hasAttribute('data-key')) {
        path.setAttribute('data-key', key);
      }
    },
    pointerEnter(arc, path) {
      const key = deriveKey(arc);
      if (!key) {
        return;
      }
      hoverKey = key;
      if (pinnedKey && pinnedKey === key) {
        if (!includeSource && path === pinnedPath) {
          // ensure related arcs remain highlighted, but skip the pinned path itself
          applyGroup(key, path);
        }
        return;
      }
      applyGroup(key, includeSource ? null : path);
    },
    pointerMove(arc, path) {
      runtime.pointerEnter(arc, path);
    },
    pointerLeave(arc, path) {
      const key = deriveKey(arc);
      if (!key) {
        return;
      }
      if (pinnedKey && pinnedKey === key) {
        return;
      }
      if (hoverKey === key) {
        removeGroup(key);
        hoverKey = null;
      }
    },
    handleClick: pinOnClick
      ? (arc, path, event) => {
          const key = deriveKey(arc);
          if (!key) {
            return;
          }

          const isPinned = pinnedKey === key && pinnedPath === path;
          if (isPinned) {
            clearPinned();
            if (hoverKey === key) {
              applyGroup(key, includeSource ? null : path);
            }
            options.onPinChange?.({ arc, path, pinned: false, event });
            return;
          }

          clearPinned();
          pinnedKey = key;
          pinnedPath = path;
          if (pinClassName) {
            path.classList.add(pinClassName);
          }
          applyGroup(key, includeSource ? null : path);
          options.onPinChange?.({ arc, path, pinned: true, event });
        }
      : undefined,
    handlesClick: pinOnClick,
  };

  return runtime;
}

function defaultHighlightKey(arc: LayoutArc): string | null {
  if (typeof arc.key === 'string' && arc.key.length > 0) {
    return arc.key;
  }
  const dataKey = arc.data?.key;
  if (typeof dataKey === 'string' && dataKey.length > 0) {
    return dataKey;
  }
  return null;
}

const TOOLTIP_ATTRIBUTE = 'data-sandjs-tooltip';

type TooltipRuntime = {
  show: (event: PointerEvent, arc: LayoutArc) => void;
  move: (event: PointerEvent) => void;
  hide: () => void;
};

function createTooltipRuntime(
  doc: Document,
  input: RenderSvgOptions['tooltip'],
): TooltipRuntime | null {
  if (input === false) {
    return null;
  }

  const options: TooltipOptions =
    typeof input === 'object' && input !== null ? (input as TooltipOptions) : {};
  const container = resolveTooltipContainer(doc, options.container);
  const element = ensureTooltipElement(doc, container);
  applyDefaultTooltipStyles(element);

  const formatter =
    typeof options.formatter === 'function'
      ? options.formatter
      : (arc: LayoutArc) => {
          if (typeof arc.data.tooltip === 'string' && arc.data.tooltip.length > 0) {
            return arc.data.tooltip;
          }
          const formattedValue = Number.isFinite(arc.value)
            ? arc.value.toLocaleString()
            : '—';
          const formattedPercentage = (arc.percentage * 100).toFixed(1);
          return `${arc.data.name} · ${formattedValue} · ${formattedPercentage}%`;
        };

  const position = (event: PointerEvent) => {
    const offsetY = 8;
    const offsetX = 8;
    const x = event.clientX + offsetX;
    const y = event.clientY - offsetY;
    element.style.left = `${x}px`;
    element.style.top = `${y}px`;
  };

  return {
    show(event, arc) {
      element.innerHTML = formatter(arc);
      position(event);
      element.style.visibility = 'visible';
      element.style.opacity = '1';
    },
    move(event) {
      if (element.style.visibility !== 'visible') {
        return;
      }
      position(event);
    },
    hide() {
      element.style.opacity = '0';
      element.style.visibility = 'hidden';
    },
  };
}

function resolveTooltipContainer(doc: Document, container?: HTMLElement | string): HTMLElement {
  if (!container) {
    if (!doc.body) {
      throw new Error('renderSVG tooltip requires document.body to be present');
    }
    return doc.body;
  }

  if (typeof container === 'string') {
    const resolved = doc.querySelector(container);
    if (!resolved) {
      throw new Error(`renderSVG tooltip container selector "${container}" did not match any element`);
    }
    if (!(resolved instanceof HTMLElement)) {
      throw new Error(`renderSVG tooltip container selector "${container}" did not resolve to an HTMLElement`);
    }
    return resolved;
  }

  return container;
}

function ensureTooltipElement(doc: Document, container: HTMLElement): HTMLElement {
  const existing = container.querySelector<HTMLElement>(`[${TOOLTIP_ATTRIBUTE}]`);
  if (existing) {
    return existing;
  }
  const element = doc.createElement('div');
  element.setAttribute(TOOLTIP_ATTRIBUTE, '');
  element.setAttribute('role', 'tooltip');
  container.appendChild(element);
  return element;
}

function applyDefaultTooltipStyles(element: HTMLElement): void {
  const style = element.style;
  if (!style.position) style.position = 'fixed';
  if (!style.pointerEvents) style.pointerEvents = 'none';
  if (!style.opacity) style.opacity = '0';
  if (!style.visibility) style.visibility = 'hidden';
  if (!style.background) style.background = 'rgba(15, 23, 42, 0.92)';
  if (!style.color) style.color = '#f8fafc';
  if (!style.padding) style.padding = '0.4rem 0.6rem';
  if (!style.borderRadius) style.borderRadius = '0.5rem';
  if (!style.fontSize) style.fontSize = '0.8rem';
  if (!style.boxShadow) style.boxShadow = '0 10px 30px rgba(15, 23, 42, 0.45)';
  if (!style.border) style.border = '1px solid rgba(148, 163, 184, 0.25)';
  if (!style.transition) style.transition = 'opacity 120ms ease';
  if (!style.transform) style.transform = 'translate(-50%, -120%)';
  if (!style.zIndex) style.zIndex = '9999';
}

export function formatArcBreadcrumb(arc: LayoutArc, separator = ' › '): string {
  if (!arc) {
    return '';
  }
  const segments = Array.isArray(arc.path) && arc.path.length > 0 ? arc.path : [arc.data];
  const names = segments
    .map((node) => node?.name)
    .filter((name): name is string => typeof name === 'string' && name.length > 0);
  if (names.length === 0) {
    return typeof arc.data?.name === 'string' ? arc.data.name : '';
  }
  return names.join(separator);
}

function describeArcPath(arc: LayoutArc, cx: number, cy: number): string | null {
  const span = arc.x1 - arc.x0;
  if (span <= ZERO_TOLERANCE) {
    return null;
  }

  const fullCircle = span >= TAU - ZERO_TOLERANCE;

  const outerStart = polarToCartesian(cx, cy, arc.y1, arc.x0);
  const outerEnd = polarToCartesian(cx, cy, arc.y1, arc.x1);
  const largeArc = span > Math.PI ? 1 : 0;

  if (fullCircle && arc.y0 <= ZERO_TOLERANCE) {
    const outerRadius = arc.y1;
    const start = { x: cx + outerRadius, y: cy };
    const mid = { x: cx - outerRadius, y: cy };
    return [
      `M ${start.x} ${start.y}`,
      `A ${outerRadius} ${outerRadius} 0 1 1 ${mid.x} ${mid.y}`,
      `A ${outerRadius} ${outerRadius} 0 1 1 ${start.x} ${start.y}`,
      'Z',
    ].join(' ');
  }

  if (fullCircle) {
    const outerRadius = arc.y1;
    const innerRadius = arc.y0;
    const outerStartPoint = { x: cx + outerRadius, y: cy };
    const outerMidPoint = { x: cx - outerRadius, y: cy };
    const parts = [
      `M ${outerStartPoint.x} ${outerStartPoint.y}`,
      `A ${outerRadius} ${outerRadius} 0 1 1 ${outerMidPoint.x} ${outerMidPoint.y}`,
      `A ${outerRadius} ${outerRadius} 0 1 1 ${outerStartPoint.x} ${outerStartPoint.y}`,
    ];
    if (innerRadius > ZERO_TOLERANCE) {
      const innerStartPoint = { x: cx + innerRadius, y: cy };
      const innerMidPoint = { x: cx - innerRadius, y: cy };
      parts.push(
        `M ${innerStartPoint.x} ${innerStartPoint.y}`,
        `A ${innerRadius} ${innerRadius} 0 1 0 ${innerMidPoint.x} ${innerMidPoint.y}`,
        `A ${innerRadius} ${innerRadius} 0 1 0 ${innerStartPoint.x} ${innerStartPoint.y}`,
      );
    }
    parts.push('Z');
    return parts.join(' ');
  }

  if (arc.y0 <= ZERO_TOLERANCE) {
    return [
      `M ${cx} ${cy}`,
      `L ${outerStart.x} ${outerStart.y}`,
      `A ${arc.y1} ${arc.y1} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
      'Z',
    ].join(' ');
  }

  const innerStart = polarToCartesian(cx, cy, arc.y0, arc.x1);
  const innerEnd = polarToCartesian(cx, cy, arc.y0, arc.x0);

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${arc.y1} ${arc.y1} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerStart.x} ${innerStart.y}`,
    `A ${arc.y0} ${arc.y0} 0 ${largeArc} 0 ${innerEnd.x} ${innerEnd.y}`,
    'Z',
  ].join(' ');
}

function polarToCartesian(cx: number, cy: number, radius: number, angle: number): { x: number; y: number } {
  return {
    x: cx + radius * Math.cos(angle),
    y: cy + radius * Math.sin(angle),
  };
}
