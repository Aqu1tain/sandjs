import { layout } from '../layout/index.js';
import { LayoutArc, SunburstConfig } from '../types/index.js';
import { RenderSvgOptions, RenderHandle, RenderSvgUpdateInput, RenderSvgUpdateOptions } from './types.js';
import { createTooltipRuntime } from './runtime/tooltip.js';
import { createBreadcrumbRuntime } from './runtime/breadcrumbs.js';
import { createHighlightRuntime } from './runtime/highlight.js';
import { resolveDocument, resolveHostElement } from './runtime/document.js';
import { formatArcBreadcrumb } from './format.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const ZERO_TOLERANCE = 1e-6;
const TAU = Math.PI * 2;

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
  const record = value as Record<string, unknown>;
  return 'size' in record && 'layers' in record;
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
