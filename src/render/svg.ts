import { layout } from '../layout';
import { LayoutArc, SunburstConfig } from '../types';

const SVG_NS = 'http://www.w3.org/2000/svg';
const ZERO_TOLERANCE = 1e-6;

export interface RenderSvgOptions {
  el: SVGElement | string;
  config: SunburstConfig;
  document?: Document;
  classForArc?: (arc: LayoutArc) => string | string[] | undefined;
  decoratePath?: (path: SVGPathElement, arc: LayoutArc) => void;
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
