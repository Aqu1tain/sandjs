import type { LayoutArc } from '../../types/index.js';
import type { BreadcrumbOptions, RenderSvgOptions } from '../types.js';
import { resolveTooltipContainer } from './tooltip.js';
import { formatArcBreadcrumb } from '../format.js';

const BREADCRUMB_ATTRIBUTE = 'data-sandjs-breadcrumbs';

export type BreadcrumbRuntime = {
  show: (arc: LayoutArc) => void;
  clear: () => void;
};

export function createBreadcrumbRuntime(
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
