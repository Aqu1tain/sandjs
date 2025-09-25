import type { LayoutArc } from '../../types/index.js';
import type { BreadcrumbOptions, BreadcrumbTrailItem, RenderSvgOptions } from '../types.js';
import { resolveTooltipContainer } from './tooltip.js';
import { formatArcBreadcrumb } from '../format.js';

const BREADCRUMB_ATTRIBUTE = 'data-sandjs-breadcrumbs';

export type BreadcrumbRuntime = {
  show: (arc: LayoutArc) => void;
  clear: () => void;
  dispose: () => void;
  setTrail?: (trail: BreadcrumbTrailItem[] | null) => void;
  handlesTrail?: boolean;
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
  const interactive = options.interactive ?? false;
  element.textContent = emptyLabel;

  let activeTrail: BreadcrumbTrailItem[] | null = null;

  return {
    show(arc) {
      if (interactive && activeTrail) {
        return;
      }
      element.textContent = formatter(arc);
    },
    clear() {
      if (interactive && activeTrail) {
        return;
      }
      element.textContent = emptyLabel;
    },
    dispose() {
      element.textContent = emptyLabel;
      activeTrail = null;
    },
    setTrail: interactive
      ? (trail) => {
          activeTrail = trail ?? null;
          element.innerHTML = '';
          if (!activeTrail || activeTrail.length === 0) {
            element.textContent = emptyLabel;
            return;
          }

          activeTrail.forEach((item, index) => {
            if (index > 0) {
              const separatorNode = doc.createElement('span');
              separatorNode.textContent = separator;
              separatorNode.setAttribute('data-separator', 'true');
              element.appendChild(separatorNode);
            }

            const hasHandler = typeof item.onSelect === 'function';
            const node = hasHandler ? doc.createElement('button') : doc.createElement('span');
            node.textContent = item.label;
            node.setAttribute('data-breadcrumb', item.id);
            if (hasHandler) {
              node.setAttribute('type', 'button');
              node.addEventListener('click', (event) => {
                event.preventDefault();
                item.onSelect?.();
              });
            }
            if (item.active) {
              node.setAttribute('data-active', 'true');
            } else {
              node.removeAttribute('data-active');
            }
            element.appendChild(node);
          });
        }
      : undefined,
    handlesTrail: interactive,
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
