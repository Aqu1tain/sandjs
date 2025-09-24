import type { LayoutArc } from '../types/index.js';
import type { RenderSvgOptions, TransitionOptions } from './types.js';

export type TransitionEasing = (t: number) => number;

export interface ResolvedTransition {
  duration: number;
  delay: number;
  easing: TransitionEasing;
}

const DEFAULT_DURATION = 320;
const DEFAULT_DELAY = 0;
const DEFAULT_EASING: TransitionEasing = (t) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

export function resolveTransition(input: RenderSvgOptions['transition']): ResolvedTransition | null {
  if (input === false || input == null) {
    return null;
  }

  const config: TransitionOptions | null =
    input === true ? {} : typeof input === 'object' ? (input as TransitionOptions) : null;

  const duration = normalizePositiveNumber(config?.duration, DEFAULT_DURATION);
  const delay = normalizePositiveNumber(config?.delay, DEFAULT_DELAY);
  const easing = typeof config?.easing === 'function' ? config.easing : DEFAULT_EASING;

  if (duration <= 0 && delay <= 0) {
    return null;
  }

  return { duration, delay, easing };
}

export function interpolateArc(fromArc: LayoutArc, toArc: LayoutArc, progress: number): LayoutArc {
  if (progress <= 0) {
    return cloneArc(fromArc);
  }
  if (progress >= 1) {
    return cloneArc(toArc);
  }
  const t = clamp01(progress);
  return {
    ...toArc,
    x0: lerp(fromArc.x0, toArc.x0, t),
    x1: lerp(fromArc.x1, toArc.x1, t),
    y0: lerp(fromArc.y0, toArc.y0, t),
    y1: lerp(fromArc.y1, toArc.y1, t),
  };
}

function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

function clamp01(value: number): number {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function normalizePositiveNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return value;
  }
  return fallback;
}

function cloneArc(source: LayoutArc): LayoutArc {
  return { ...source };
}
