import type { LayoutArc } from '../types/index.js';

export function formatArcBreadcrumb(arc: LayoutArc, separator = ' › '): string {
  if (!arc) {
    return '';
  }
  const segments = Array.isArray(arc.path) && arc.path.length > 0 ? arc.path : [arc.data];
  const names = segments
    .map((node) => node?.name)
    .filter((name): name is string => typeof name === 'string' && name.length > 0);
  if (names.length === 0) {
    return typeof arc.data?.name === 'string' ? arc.data.name : '';
  }
  return names.join(separator);
}

