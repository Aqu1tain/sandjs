import type { LayoutArc, SunburstConfig } from '../../types/index.js';
import type { RenderSvgOptions } from '../types.js';
import type { TooltipRuntime } from '../runtime/tooltip.js';
import type { BreadcrumbRuntime } from '../runtime/breadcrumbs.js';
import type { HighlightRuntime } from '../runtime/highlight.js';
import type { NavigationRuntime } from '../runtime/navigation.js';

/**
 * Collection of all runtime modules
 */
export type RuntimeSet = {
  tooltip: TooltipRuntime | null;
  highlight: HighlightRuntime | null;
  breadcrumbs: BreadcrumbRuntime | null;
  navigation: NavigationRuntime | null;
};

/**
 * Handle for cancelling animations
 */
export type AnimationHandle = {
  cancel(): void;
};

/**
 * Animation driver functions for requestAnimationFrame
 */
export type AnimationDrivers = {
  raf: (callback: FrameRequestCallback) => number;
  caf: (handle: number) => void;
  now: () => number;
};

/**
 * Managed SVG path with associated label and animation state
 */
export type ManagedPath = {
  key: string;
  element: SVGPathElement;
  labelElement: SVGTextElement;
  labelPathElement: SVGPathElement;
  textPathElement: SVGTextPathElement;
  labelPathId: string;
  arc: LayoutArc;
  options: RenderSvgOptions;
  runtime: RuntimeSet;
  animation: AnimationHandle | null;
  fade: AnimationHandle | null;
  pendingRemoval: boolean;
  labelVisible: boolean;
  labelHiddenReason: string | null;
  labelPendingLogReason: string | null;
  abortController: AbortController;
  dispose: () => void;
};

