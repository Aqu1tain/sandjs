import type { LayoutArc } from '../../types/index.js';
import type { RenderSvgOptions, TooltipOptions } from '../types.js';
import {
  TOOLTIP_OFFSET_X,
  TOOLTIP_OFFSET_Y,
  TOOLTIP_DEFAULT_BACKGROUND,
  TOOLTIP_DEFAULT_COLOR,
  TOOLTIP_DEFAULT_PADDING,
  TOOLTIP_DEFAULT_BORDER_RADIUS,
  TOOLTIP_DEFAULT_FONT_SIZE,
  TOOLTIP_DEFAULT_BOX_SHADOW,
  TOOLTIP_DEFAULT_BORDER,
  TOOLTIP_DEFAULT_TRANSITION,
  TOOLTIP_DEFAULT_TRANSFORM,
  TOOLTIP_DEFAULT_Z_INDEX,
} from './tooltipConstants.js';

const TOOLTIP_ATTRIBUTE = 'data-sandjs-tooltip';

export type TooltipRuntime = {
  show: (event: PointerEvent, arc: LayoutArc) => void;
  move: (event: PointerEvent) => void;
  hide: () => void;
  dispose: () => void;
};

export function createTooltipRuntime(
  doc: Document,
  input: RenderSvgOptions['tooltip'],
): TooltipRuntime | null {
  if (input === false) {
    return null;
  }

  const options: TooltipOptions =
    typeof input === 'object' && input !== null ? (input) : {};
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
    const x = event.clientX + TOOLTIP_OFFSET_X; // Offset to the right of cursor
    const y = event.clientY - TOOLTIP_OFFSET_Y; // Offset above cursor to avoid obscuring content
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
    dispose() {
      element.innerHTML = '';
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
      throw new TypeError(`renderSVG tooltip container selector "${container}" did not resolve to an HTMLElement`);
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
  if (!style.background) style.background = TOOLTIP_DEFAULT_BACKGROUND;
  if (!style.color) style.color = TOOLTIP_DEFAULT_COLOR;
  if (!style.padding) style.padding = TOOLTIP_DEFAULT_PADDING;
  if (!style.borderRadius) style.borderRadius = TOOLTIP_DEFAULT_BORDER_RADIUS;
  if (!style.fontSize) style.fontSize = TOOLTIP_DEFAULT_FONT_SIZE;
  if (!style.boxShadow) style.boxShadow = TOOLTIP_DEFAULT_BOX_SHADOW;
  if (!style.border) style.border = TOOLTIP_DEFAULT_BORDER;
  if (!style.transition) style.transition = TOOLTIP_DEFAULT_TRANSITION;
  if (!style.transform) style.transform = TOOLTIP_DEFAULT_TRANSFORM;
  if (!style.zIndex) style.zIndex = TOOLTIP_DEFAULT_Z_INDEX;
}
