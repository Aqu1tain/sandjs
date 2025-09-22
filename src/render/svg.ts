import { layout } from '../layout/index.js';
import { LayoutArc, SunburstConfig } from '../types/index.js';
import {
  RenderSvgOptions,
  RenderHandle,
  RenderSvgUpdateInput,
  RenderSvgUpdateOptions,
} from './types.js';
import { createTooltipRuntime, TooltipRuntime } from './runtime/tooltip.js';
import { createBreadcrumbRuntime, BreadcrumbRuntime } from './runtime/breadcrumbs.js';
import { createHighlightRuntime, HighlightRuntime } from './runtime/highlight.js';
import { resolveDocument, resolveHostElement } from './runtime/document.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const ZERO_TOLERANCE = 1e-6;
const TAU = Math.PI * 2;

/**
 * Renders the supplied `SunburstConfig` into the target SVG element.
 *
 * @public
 */
type RuntimeSet = {
  tooltip: TooltipRuntime | null;
  highlight: HighlightRuntime | null;
  breadcrumbs: BreadcrumbRuntime | null;
};

type ManagedPath = {
  key: string;
  element: SVGPathElement;
  arc: LayoutArc;
  options: RenderSvgOptions;
  runtime: RuntimeSet;
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

  let runtimes = createRuntimeSet(doc, currentOptions);
  const pathRegistry = new Map<string, ManagedPath>();

  const execute = (opts: RenderSvgOptions, runtime: RuntimeSet): LayoutArc[] => {
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

    runtime.tooltip?.hide();
    runtime.breadcrumbs?.clear();

    const usedKeys = new Set<string>();

    for (let index = 0; index < arcs.length; index += 1) {
      const arc = arcs[index];
      const d = describeArcPath(arc, cx, cy);
      if (!d) {
        continue;
      }

      const key = createArcKey(arc, index);
      usedKeys.add(key);

      let managed = pathRegistry.get(key);
      if (!managed) {
        managed = createManagedPath({
          key,
          arc,
          options: opts,
          runtime,
          doc,
        });
        pathRegistry.set(key, managed);
      }

      updateManagedPath(managed, {
        arc,
        options: opts,
        runtime,
        pathData: d,
      });

      host.appendChild(managed.element);
    }

    for (const [key, managed] of pathRegistry) {
      if (!usedKeys.has(key)) {
        managed.dispose();
        if (managed.element.parentNode === host) {
          host.removeChild(managed.element);
        }
        pathRegistry.delete(key);
      }
    }

    return arcs;
  };

  const initialArcs = execute(currentOptions, runtimes);
  const handle = initialArcs as unknown as RenderHandle;

  Object.defineProperties(handle, {
    update: {
      enumerable: false,
      value(input: RenderSvgUpdateInput) {
        currentOptions = normalizeUpdateOptions(currentOptions, input, host, doc);
        disposeRuntimeSet(runtimes);
        runtimes = createRuntimeSet(doc, currentOptions);
        const nextArcs = execute(currentOptions, runtimes);
        handle.length = 0;
        handle.push(...nextArcs);
        return handle;
      },
    },
    destroy: {
      enumerable: false,
      value() {
        disposeRuntimeSet(runtimes);
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
    listeners: {} as ManagedPath['listeners'],
    dispose: () => {
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
    managed.runtime.breadcrumbs?.show(currentArc);
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
    managed.runtime.breadcrumbs?.clear();
    managed.options.onArcLeave?.({ arc: currentArc, path: element, event });
  };

  const handleClick = (event: MouseEvent) => {
    const currentArc = managed.arc;
    managed.runtime.highlight?.handleClick?.(currentArc, element, event);
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
  params: { arc: LayoutArc; options: RenderSvgOptions; runtime: RuntimeSet; pathData: string },
): void {
  const { arc, options, runtime, pathData } = params;
  managed.arc = arc;
  managed.options = options;
  managed.runtime = runtime;

  const element = managed.element;
  element.setAttribute('d', pathData);
  element.setAttribute('fill', arc.data.color ?? 'currentColor');
  element.setAttribute('data-layer', arc.layerId);
  element.setAttribute('data-name', arc.data.name);
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
  element.setAttribute('class', classList.join(' '));

  options.decoratePath?.(element, arc);
  runtime.highlight?.register(arc, element);
}

function createArcKey(arc: LayoutArc, index: number): string {
  if (typeof arc.key === 'string' && arc.key.length > 0) {
    return `${arc.layerId}#key:${arc.key}`;
  }
  const dataKey = arc.data?.key;
  if (typeof dataKey === 'string' && dataKey.length > 0) {
    return `${arc.layerId}#data:${dataKey}:${arc.depth}`;
  }
  const breadcrumb = arc.path.map((node) => node?.name ?? '').join('/');
  return `${arc.layerId}:${arc.depth}:${breadcrumb}:${index}`;
}

function createRuntimeSet(doc: Document, options: RenderSvgOptions): RuntimeSet {
  const tooltip = createTooltipRuntime(doc, options.tooltip);
  const highlight = createHighlightRuntime(options.highlightByKey);
  const breadcrumbs = createBreadcrumbRuntime(doc, options.breadcrumbs);
  tooltip?.hide();
  breadcrumbs?.clear();
  return { tooltip, highlight, breadcrumbs };
}

function disposeRuntimeSet(runtime: RuntimeSet): void {
  runtime.tooltip?.dispose();
  runtime.highlight?.dispose();
  runtime.breadcrumbs?.dispose();
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
