import type { LayoutArc, SunburstConfig } from '../types/index.js';

/**
 * Configures tooltip behaviour for `renderSVG`.
 *
 * @public
 */
export interface TooltipOptions {
  formatter?: (arc: LayoutArc) => string;
  container?: HTMLElement | string;
}

/**
 * Configures breadcrumb behaviour for `renderSVG`.
 *
 * @public
 */
export interface BreadcrumbOptions {
  container?: HTMLElement | string;
  formatter?: (arc: LayoutArc) => string;
  separator?: string;
  emptyLabel?: string;
  interactive?: boolean;
}

export interface BreadcrumbTrailItem {
  id: string;
  label: string;
  active: boolean;
  arcIdentifier?: string;
  onSelect?: () => void;
}

export interface NavigationFocusState {
  layerId: string;
  path: LayoutArc['path'];
  pathIndices: number[];
  arc?: LayoutArc;
}

export interface NavigationOptions {
  layers?: string[];
  rootLabel?: string;
  onFocusChange?: (focus: NavigationFocusState | null) => void;
}

/**
 * Controls animated transitions when updating an existing render.
 *
 * @public
 */
export interface TransitionOptions {
  duration?: number;
  easing?: (progress: number) => number;
  delay?: number;
}

/**
 * Enables automatic highlighting for arcs that share the same key.
 *
 * @public
 */
export interface HighlightByKeyOptions {
  className?: string;
  includeSource?: boolean;
  deriveKey?: (arc: LayoutArc) => string | null;
  pinOnClick?: boolean;
  pinClassName?: string;
  onPinChange?: (payload: { arc: LayoutArc; path: SVGPathElement; pinned: boolean; event: MouseEvent }) => void;
}

/**
 * Pointer event payload emitted from arc interaction callbacks.
 *
 * @public
 */
export interface ArcPointerEventPayload {
  arc: LayoutArc;
  path: SVGPathElement;
  event: PointerEvent;
}

/**
 * Click event payload emitted from arc interaction callbacks.
 *
 * @public
 */
export interface ArcClickEventPayload {
  arc: LayoutArc;
  path: SVGPathElement;
  event: MouseEvent;
}

/**
 * Options accepted by the `renderSVG` entry point.
 *
 * @public
 */
export interface RenderSvgOptions {
  el: SVGElement | string;
  config: SunburstConfig;
  document?: Document;
  classForArc?: (arc: LayoutArc) => string | string[] | undefined;
  decoratePath?: (path: SVGPathElement, arc: LayoutArc) => void;
  tooltip?: boolean | TooltipOptions;
  highlightByKey?: boolean | HighlightByKeyOptions;
  breadcrumbs?: boolean | BreadcrumbOptions;
  transition?: boolean | TransitionOptions;
  navigation?: boolean | NavigationOptions;
  onArcEnter?: (payload: ArcPointerEventPayload) => void;
  onArcMove?: (payload: ArcPointerEventPayload) => void;
  onArcLeave?: (payload: ArcPointerEventPayload) => void;
  onArcClick?: (payload: ArcClickEventPayload) => void;
}

/**
 * Result of calling {@link renderSVG}. Acts like an array of arcs with helper methods.
 *
 * @public
 */
export interface RenderHandle extends Array<LayoutArc> {
  update(input: RenderSvgUpdateInput): RenderHandle;
  destroy(): void;
  getOptions(): RenderSvgOptions;
  resetNavigation?: () => void;
}

/**
 * Accepted input when updating an existing SVG render.
 *
 * @public
 */
export type RenderSvgUpdateInput = SunburstConfig | RenderSvgUpdateOptions;

/**
 * Partial options accepted when updating an existing render.
 *
 * @public
 */
export interface RenderSvgUpdateOptions extends Partial<Omit<RenderSvgOptions, 'el'>> {
  config?: SunburstConfig;
}
