import type { ResolvedTransition } from '../transition.js';
import type { ManagedPath, AnimationDrivers } from './types.js';
import type { ResolvedRenderOptions } from '../types.js';
import { stopFade } from './animation.js';
import { stopArcAnimation, stopManagedAnimations } from './path-management.js';

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
 * Schedules a managed path for removal (always instant, no animation)
 */
export function scheduleManagedRemoval(params: ScheduleRemovalParams): void {
  const { key, managed, host, registry } = params;

  if (managed.pendingRemoval) return;

  managed.pendingRemoval = true;
  stopArcAnimation(managed);
  stopFade(managed);
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
}
