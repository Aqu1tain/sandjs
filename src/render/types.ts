import type { LayoutArc, SunburstConfig } from '../types/index.js';
import type {
  QualitativePaletteName,
  SequentialPaletteName,
  DivergingPaletteName,
  ColorPalette,
} from './colorThemes.js';

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
  focusTransition?: boolean | TransitionOptions;
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
 * Color theme configuration for automatic arc coloring.
 *
 * Supports three theme types:
 * - Qualitative: For categorical data (assigns colors by key/depth)
 * - Sequential: For ordered data (light to dark progression)
 * - Diverging: For data with a meaningful midpoint
 *
 * @public
 */
export interface ColorThemeOptions {
  /**
   * Theme type to use for color assignment
   */
  type: 'qualitative' | 'sequential' | 'diverging';

  /**
   * Palette name or custom color array.
   * If a string, must match a built-in palette name for the chosen type.
   * If an array, provides custom colors.
   */
  palette: QualitativePaletteName | SequentialPaletteName | DivergingPaletteName | ColorPalette;

  /**
   * How to assign colors from the palette.
   * - 'depth': Assign colors based on arc depth (default for sequential/diverging)
   * - 'key': Assign colors based on arc key (default for qualitative)
   * - 'index': Assign colors based on arc index in layer
   * - 'value': Assign colors based on arc value (normalized)
   */
  assignBy?: 'depth' | 'key' | 'index' | 'value';

  /**
   * Custom function to derive a color key from an arc.
   * Overrides assignBy when provided.
   */
  deriveKey?: (arc: LayoutArc) => string | number;
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
  colorTheme?: ColorThemeOptions;
  classForArc?: (arc: LayoutArc) => string | string[] | undefined;
  decoratePath?: (path: SVGPathElement, arc: LayoutArc) => void;
  tooltip?: boolean | TooltipOptions;
  highlightByKey?: boolean | HighlightByKeyOptions;
  breadcrumbs?: boolean | BreadcrumbOptions;
  transition?: boolean | TransitionOptions;
  navigation?: boolean | NavigationOptions;
  debug?: boolean;
  borderColor?: string;
  borderWidth?: number;
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
