import type { LayoutArc, TreeNodeInput } from '../../../types/index.js';
import type { RenderSvgOptions } from '../../types.js';

/**
 * Context for navigation transitions
 */
export type NavigationTransitionContext = {
  transition: RenderSvgOptions['transition'];
  morph: boolean;
};

/**
 * Focus target representing a focused arc/node
 */
export type FocusTarget = {
  layerId: string;
  pathIndices: number[];
  node: TreeNodeInput;
  pathNodes: TreeNodeInput[];
  key: string | null;
  identifier: string;
  arc?: LayoutArc;
};
