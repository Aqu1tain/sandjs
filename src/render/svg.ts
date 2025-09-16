import { layout } from '../layout/index.js';
import { LayoutArc, SunburstConfig } from '../types/index.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const ZERO_TOLERANCE = 1e-6;

export interface TooltipOptions {
  formatter?: (arc: LayoutArc) => string;
  container?: HTMLElement | string;
}

export interface ArcPointerEventPayload {
  arc: LayoutArc;
  path: SVGPathElement;
  event: PointerEvent;
}

export interface ArcClickEventPayload {
  arc: LayoutArc;
  path: SVGPathElement;
  event: MouseEvent;
}

export interface RenderSvgOptions {
  el: SVGElement | string;
  config: SunburstConfig;
  document?: Document;
  classForArc?: (arc: LayoutArc) => string | string[] | undefined;
  decoratePath?: (path: SVGPathElement, arc: LayoutArc) => void;
  tooltip?: boolean | TooltipOptions;
  onArcEnter?: (payload: ArcPointerEventPayload) => void;
  onArcMove?: (payload: ArcPointerEventPayload) => void;
  onArcLeave?: (payload: ArcPointerEventPayload) => void;
  onArcClick?: (payload: ArcClickEventPayload) => void;
}

export function renderSVG(options: RenderSvgOptions): LayoutArc[] {
  const { el, config } = options;
  const doc = resolveDocument(options.document);
  const host = resolveHostElement(el, doc);

  const arcs = layout(config);
  const diameter = config.size.radius * 2;
  const cx = config.size.radius;
  const cy = config.size.radius;

  host.setAttribute('viewBox', `0 0 ${diameter} ${diameter}`);
  host.setAttribute('width', `${diameter}`);
  host.setAttribute('height', `${diameter}`);

  while (host.firstChild) {
    host.removeChild(host.firstChild);
  }

  const tooltip = createTooltipRuntime(doc, options.tooltip);
  tooltip?.hide();

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

    const classList = ['sand-arc'];
    const dynamicClass = options.classForArc?.(arc);
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
      tooltip || options.onArcEnter || options.onArcMove || options.onArcLeave,
    );

    if (wantsPointerTracking) {
      const handleEnter = (event: PointerEvent) => {
        tooltip?.show(event, arc);
        options.onArcEnter?.({ arc, path, event });
      };
      const handleMove = (event: PointerEvent) => {
        tooltip?.move(event);
        options.onArcMove?.({ arc, path, event });
      };
      const handleLeave = (event: PointerEvent) => {
        tooltip?.hide();
        options.onArcLeave?.({ arc, path, event });
      };
      path.addEventListener('pointerenter', handleEnter);
      path.addEventListener('pointermove', handleMove);
      path.addEventListener('pointerleave', handleLeave);
      path.addEventListener('pointercancel', handleLeave);
    }

    if (options.onArcClick) {
      const handleClick = (event: MouseEvent) => {
        options.onArcClick?.({ arc, path, event });
      };
      path.addEventListener('click', handleClick);
    }

    options.decoratePath?.(path, arc);
    host.appendChild(path);
  }

  return arcs;
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
      : (arc: LayoutArc) =>
          arc.data.tooltip ?? `${arc.data.name} · ${(arc.percentage * 100).toFixed(1)}%`;

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

function describeArcPath(arc: LayoutArc, cx: number, cy: number): string | null {
  const span = arc.x1 - arc.x0;
  if (span <= ZERO_TOLERANCE) {
    return null;
  }

  const outerStart = polarToCartesian(cx, cy, arc.y1, arc.x0);
  const outerEnd = polarToCartesian(cx, cy, arc.y1, arc.x1);
  const largeArc = span > Math.PI ? 1 : 0;

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
