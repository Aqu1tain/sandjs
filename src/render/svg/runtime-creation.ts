import type { SunburstConfig } from '../../types/index.js';
import type { RenderSvgOptions } from '../types.js';
import type { RuntimeSet } from './types.js';
import { createTooltipRuntime } from '../runtime/tooltip.js';
import { createHighlightRuntime } from '../runtime/highlight.js';
import { createBreadcrumbRuntime } from '../runtime/breadcrumbs.js';
import { createNavigationRuntime } from '../runtime/navigation.js';

/**
 * Creates the runtime set with all runtime modules
 */
export function createRuntimeSet(
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

/**
 * Disposes all runtimes in the set
 */
export function disposeRuntimeSet(runtime: RuntimeSet): void {
  runtime.tooltip?.dispose();
  runtime.highlight?.dispose();
  runtime.breadcrumbs?.dispose();
  runtime.navigation?.dispose();
}
