import type { LayoutArc, TreeNodeInput } from '../types/index.js';

export function createArcKey(arc: LayoutArc): string {
  const segments: string[] = [arc.layerId];
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

/**
 * Resolves a key from one or more potential sources.
 * Returns the first non-empty string found, or null if none exist.
 */
function resolveKeyFromSource(...keys: (string | undefined)[]): string | null {
  for (const key of keys) {
    if (typeof key === 'string' && key.length > 0) {
      return key;
    }
  }
  return null;
}

export function resolveArcKey(arc: LayoutArc): string | null {
  return resolveKeyFromSource(arc.key, arc.data?.key);
}

export function resolveNodeKey(node: TreeNodeInput): string | null {
  return resolveKeyFromSource(node.key);
}
