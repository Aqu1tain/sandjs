/**
 * Controls how angles are distributed across a layer.
 *
 * @public
 */
export type AngleMode = 'free' | 'align';

/**
 * Radial sizing information for the entire sunburst.
 *
 * @public
 */
export interface SunburstSize {
  radius: number;
  angle?: number;
}

/**
 * Immutable tree node definition accepted by the layout.
 *
 * @public
 */
export interface TreeNodeInput {
  name: string;
  value?: number;
  key?: string;
  expandLevels?: number;
  offset?: number;
  color?: string;
  padAngle?: number;
  children?: TreeNodeInput[];
  tooltip?: string;
  hidden?: boolean;
  collapsed?: boolean;
}

/**
 * Configuration for a radial layer in the sunburst.
 *
 * @public
 */
export interface LayerConfig {
  id: string;
  radialUnits: [number, number];
  angleMode: AngleMode;
  alignWith?: string;
  padAngle?: number;
  baseOffset?: number;
  arcOffsetMode?: 'relative' | 'absolute';
  defaultArcOffset?: number;
  tree: TreeNodeInput | TreeNodeInput[];
  borderColor?: string;
  borderWidth?: number;
}

/**
 * Top-level configuration accepted by the `layout` and `renderSVG` APIs.
 *
 * @public
 */
export interface SunburstConfig {
  size: SunburstSize;
  layers: LayerConfig[];
}

/**
 * Fully resolved arc emitted by the layout processor.
 *
 * @public
 */
export interface LayoutArc {
  layerId: string;
  data: TreeNodeInput;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  depth: number;
  key?: string;
  value: number;
  path: TreeNodeInput[];
  pathIndices: number[];
  percentage: number;
}
