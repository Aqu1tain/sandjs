import type { LayoutArc } from '../../types/index.js';
import type { RenderSvgOptions, TooltipOptions } from '../types.js';

const TOOLTIP_ATTRIBUTE = 'data-sandjs-tooltip';

export type TooltipRuntime = {
  show: (event: PointerEvent, arc: LayoutArc) => void;
  move: (event: PointerEvent) => void;
  hide: () => void;
};

export function createTooltipRuntime(
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

export function resolveTooltipContainer(doc: Document, container?: HTMLElement | string): HTMLElement {
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
