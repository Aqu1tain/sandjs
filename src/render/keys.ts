import type { LayoutArc } from '../types/index.js';

export function createArcKey(arc: LayoutArc): string {
  const segments: string[] = [arc.layerId, String(arc.depth)];
  if (Array.isArray(arc.pathIndices)) {
    segments.push(`idx=${arc.pathIndices.join('.')}`);
  }
  if (typeof arc.key === 'string' && arc.key.length > 0) {
    segments.push(`key=${arc.key}`);
  } else if (typeof arc.data?.key === 'string' && arc.data.key.length > 0) {
    segments.push(`data=${arc.data.key}`);
  } else {
    const breadcrumb = arc.path.map((node) => node?.name ?? '').join('/');
    segments.push(`path=${breadcrumb}`);
  }
  return segments.join('|');
}

export function arcIdentifierFromPath(layerId: string, pathIndices: number[]): string {
  return `${layerId}|idx=${pathIndices.join('.')}`;
}

export function resolveArcKey(arc: LayoutArc): string | null {
  if (typeof arc.key === 'string' && arc.key.length > 0) {
    return arc.key;
  }
  const dataKey = arc.data?.key;
  if (typeof dataKey === 'string' && dataKey.length > 0) {
    return dataKey;
  }
  return null;
}
