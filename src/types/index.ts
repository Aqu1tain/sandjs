export type AngleMode = 'free' | 'align';

export interface SunburstSize {
  radius: number;
  angle?: number;
}

export interface TreeNodeInput {
  name: string;
  value?: number;
  key?: string;
  expandLevels?: number;
  offset?: number;
  color?: string;
  children?: TreeNodeInput[];
  tooltip?: string;
  hidden?: boolean;
}

export interface LayerConfig {
  id: string;
  radialUnits: [number, number];
  angleMode: AngleMode;
  alignWith?: string;
  padAngle?: number;
  baseOffset?: number;
  arcOffsetMode?: 'relative' | 'absolute';
  tree: TreeNodeInput | TreeNodeInput[];
}

export interface SunburstConfig {
  size: SunburstSize;
  layers: LayerConfig[];
}

export interface LayoutArc {
  layerId: string;
  data: TreeNodeInput;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  depth: number;
  key?: string;
  percentage: number;
}
