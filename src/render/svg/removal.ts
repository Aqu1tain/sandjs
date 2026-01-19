import { describeArcPath } from '../geometry.js';
import type { ResolvedTransition } from '../transition.js';
import type { ManagedPath, AnimationDrivers } from './types.js';
import type { ResolvedRenderOptions } from '../types.js';
import {
  startFade,
  stopFade,
  createCollapsedArc,
  getCurrentOpacity,
} from './animation.js';
import {
  startArcAnimation,
  stopArcAnimation,
  stopManagedAnimations,
} from './path-management.js';

/**
 * Cancels a pending removal operation on a managed path
 */
export function cancelPendingRemoval(managed: ManagedPath): void {
  if (!managed.pendingRemoval) {
    return;
  }
  managed.pendingRemoval = false;
  stopFade(managed);
  managed.element.style.opacity = '';
  managed.element.style.pointerEvents = '';
}

/**
 * Parameters for scheduling element removal
 */
type ScheduleRemovalParams = {
  key: string;
  managed: ManagedPath;
  host: SVGElement;
  registry: Map<string, ManagedPath>;
  transition: ResolvedTransition | null;
  drivers: AnimationDrivers;
  cx: number;
  cy: number;
  navigationMorph: boolean;
  debug: boolean;
  renderOptions: ResolvedRenderOptions;
};

/**
 * Schedules a managed path for removal with optional animations
 */
export function scheduleManagedRemoval(params: ScheduleRemovalParams): void {
  const {
    key,
    managed,
    host,
    registry,
    transition,
    drivers,
    cx,
    cy,
    navigationMorph,
    debug,
    renderOptions,
  } = params;

  if (managed.pendingRemoval) {
    return;
  }

  managed.pendingRemoval = true;
  stopArcAnimation(managed);
  stopFade(managed);
  managed.element.style.pointerEvents = 'none';

  // Hide label directly (avoiding circular dependency with label-system.ts)
  managed.labelElement.style.display = 'none';
  managed.labelVisible = false;
  managed.labelHiddenReason = 'pending-removal';

  const remove = () => {
    stopManagedAnimations(managed);
    if (managed.element.parentNode === host) {
      managed.element.remove();
    }
    if (managed.labelElement.parentNode === host) {
      managed.labelElement.remove();
    }
    if (managed.labelPathElement.parentNode) {
      managed.labelPathElement.remove();
    }
    registry.delete(key);
    managed.dispose();
  };

  if (!transition) {
    remove();
    return;
  }

  if (navigationMorph) {
    const collapsedArc = createCollapsedArc(managed.arc);
    const collapsedPath = describeArcPath(collapsedArc, cx, cy) ?? '';
    const arcColor = managed.element.getAttribute('fill') || 'currentColor';
    startArcAnimation({
      managed,
      from: managed.arc,
      to: collapsedArc,
      finalPath: collapsedPath,
      transition,
      drivers,
      cx,
      cy,
      debug,
      renderOptions,
      arcColor,
    });
  }

  const startOpacity = getCurrentOpacity(managed.element);
  managed.fade = startFade({
    managed,
    from: startOpacity,
    to: 0,
    transition,
    drivers,
    resetStyleOnComplete: false,
    onComplete: () => {
      managed.fade = null;
      remove();
    },
    onCancel: () => {
      managed.fade = null;
      managed.pendingRemoval = false;
      managed.element.style.opacity = '';
      managed.element.style.pointerEvents = '';
    },
  });
}
