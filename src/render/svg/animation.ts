import { clamp01 } from '../math.js';
import {
  COLLAPSED_ARC_SPAN_SHRINK_FACTOR,
  COLLAPSED_ARC_MIN_SPAN,
  COLLAPSED_ARC_THICKNESS_SHRINK_FACTOR,
  COLLAPSED_ARC_MIN_THICKNESS,
} from './constants.js';
import type { ManagedPath, AnimationHandle, AnimationDrivers } from './types.js';
import type { LayoutArc } from '../../types/index.js';
import type { ResolvedTransition } from '../transition.js';

/**
 * Parameters for fade animation
 */
export type FadeParams = {
  managed: ManagedPath;
  from: number;
  to: number;
  transition: ResolvedTransition;
  drivers: AnimationDrivers;
  resetStyleOnComplete?: boolean;
  onComplete?: () => void;
  onCancel?: () => void;
};

/**
 * Parameters for generic animation runner
 */
export type RunAnimationParams = {
  drivers: AnimationDrivers;
  duration: number;
  delay: number;
  easing: (t: number) => number;
  onUpdate: (progress: number) => void;
  onComplete?: () => void;
  onCancel?: () => void;
};

/**
 * Starts a fade animation (opacity transition)
 */
export function startFade(params: FadeParams): AnimationHandle {
  const { managed, from, to, transition, drivers, resetStyleOnComplete, onComplete, onCancel } = params;
  const element = managed.element;
  const label = managed.labelElement;
  const start = clamp01(from);
  const end = clamp01(to);

  const startString = start.toString();
  element.style.opacity = startString;
  label.style.opacity = startString;

  return runAnimation({
    drivers,
    duration: transition.duration,
    delay: transition.delay,
    easing: transition.easing,
    onUpdate: (progress) => {
      const value = start + (end - start) * progress;
      const valueString = value.toString();
      element.style.opacity = valueString;
      label.style.opacity = valueString;
    },
    onComplete: () => {
      finalizeOpacity(element, end, resetStyleOnComplete);
      finalizeOpacity(label, end, resetStyleOnComplete);
      onComplete?.();
    },
    onCancel: () => {
      finalizeOpacity(element, end, resetStyleOnComplete);
      finalizeOpacity(label, end, resetStyleOnComplete);
      onCancel?.();
    },
  });
}

/**
 * Stops the active fade animation if any
 */
export function stopFade(managed: ManagedPath): void {
  if (managed.fade) {
    managed.fade.cancel();
    managed.fade = null;
  }
}

/**
 * Generic animation runner using requestAnimationFrame
 */
export function runAnimation(params: RunAnimationParams): AnimationHandle {
  const { drivers, duration, delay, easing, onUpdate, onComplete, onCancel } = params;

  if (duration <= 0 && delay <= 0) {
    onUpdate(1);
    onComplete?.();
    return {
      cancel() {
        onCancel?.();
      },
    };
  }

  let cancelled = false;
  let rafId = 0;
  const delayEnd = drivers.now() + delay;

  const tick: FrameRequestCallback = (timestamp) => {
    if (cancelled) {
      return;
    }
    if (timestamp < delayEnd) {
      rafId = drivers.raf(tick);
      return;
    }

    const elapsed = timestamp - delayEnd;
    const progress = duration > 0 ? Math.min(elapsed / duration, 1) : 1;
    const eased = easing(progress);
    onUpdate(eased);

    if (progress < 1) {
      rafId = drivers.raf(tick);
    } else {
      onComplete?.();
    }
  };

  rafId = drivers.raf(tick);

  return {
    cancel() {
      if (cancelled) {
        return;
      }
      cancelled = true;
      drivers.caf(rafId);
      onCancel?.();
    },
  };
}

/**
 * Gets the current opacity value of an SVG element
 */
function getCurrentOpacity(element: SVGElement): number {
  const value = element.style.opacity;
  if (!value) {
    return 1;
  }
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) {
    return 1;
  }
  return clamp01(parsed);
}

/**
 * Sets the final opacity value, optionally resetting the style property
 */
function finalizeOpacity(element: SVGElement, opacity: number, resetStyle?: boolean): void {
  if (resetStyle && opacity === 1) {
    element.style.opacity = '';
  } else {
    element.style.opacity = opacity.toString();
  }
}

/**
 * Creates animation drivers (raf, caf, now) with fallbacks
 */
export function createAnimationDrivers(doc: Document): AnimationDrivers {
  const view = doc.defaultView ?? (typeof window !== 'undefined' ? window : undefined);

  const raf =
    view && typeof view.requestAnimationFrame === 'function'
      ? view.requestAnimationFrame.bind(view)
      : (callback: FrameRequestCallback): number => {
          const handle = setTimeout(() => callback(Date.now()), 16);
          return Number(handle);
        };

  const caf =
    view && typeof view.cancelAnimationFrame === 'function'
      ? view.cancelAnimationFrame.bind(view)
      : (handle: number) => {
          clearTimeout(handle);
        };

  const now =
    view && view.performance && typeof view.performance.now === 'function'
      ? () => view.performance.now()
      : () => Date.now();

  return { raf, caf, now };
}

/**
 * Creates a collapsed version of an arc for morphing animations
 */
export function createCollapsedArc(source: LayoutArc): LayoutArc {
  const span = Math.max(source.x1 - source.x0, 0);
  const thickness = Math.max(source.y1 - source.y0, 0);
  const shrinkSpan = Math.max(span * COLLAPSED_ARC_SPAN_SHRINK_FACTOR, COLLAPSED_ARC_MIN_SPAN);
  const shrinkThickness = Math.max(
    thickness * COLLAPSED_ARC_THICKNESS_SHRINK_FACTOR,
    COLLAPSED_ARC_MIN_THICKNESS,
  );
  const midAngle = source.x0 + span * 0.5;
  const collapsedX0 = midAngle - shrinkSpan * 0.5;
  const collapsedX1 = midAngle + shrinkSpan * 0.5;
  const collapsedY0 = source.y0;
  const collapsedY1 = Math.min(source.y0 + shrinkThickness, source.y1);

  return {
    ...source,
    x0: collapsedX0,
    x1: collapsedX1,
    y0: collapsedY0,
    y1: collapsedY1,
    percentage: 0,
    value: 0,
  };
}

/**
 * Exported for internal use by removal system
 */
export { getCurrentOpacity };
