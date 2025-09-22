import type { LayoutArc } from '../../types/index.js';
import type { HighlightByKeyOptions, RenderSvgOptions } from '../types.js';

export type HighlightRuntime = {
  register: (arc: LayoutArc, path: SVGPathElement) => void;
  pointerEnter: (arc: LayoutArc, path: SVGPathElement) => void;
  pointerMove: (arc: LayoutArc, path: SVGPathElement) => void;
  pointerLeave: (arc: LayoutArc, path: SVGPathElement) => void;
  handleClick?: (arc: LayoutArc, path: SVGPathElement, event: MouseEvent) => void;
  handlesClick: boolean;
  dispose: () => void;
};

export function createHighlightRuntime(input: RenderSvgOptions['highlightByKey']): HighlightRuntime | null {
  if (!input) {
    return null;
  }

  const options: HighlightByKeyOptions =
    typeof input === 'object' && input !== null ? (input as HighlightByKeyOptions) : {};
  const className = options.className?.trim() ?? 'is-related';
  const includeSource = options.includeSource ?? false;
  const deriveKey =
    typeof options.deriveKey === 'function' ? options.deriveKey : defaultHighlightKey;
  const pinOnClick = options.pinOnClick ?? false;
  const pinClassName = options.pinClassName?.trim() ?? 'is-pinned';

  const groups = new Map<string, Set<SVGPathElement>>();
  let hoverKey: string | null = null;
  let pinnedKey: string | null = null;
  let pinnedPath: SVGPathElement | null = null;

  const removeGroup = (key: string) => {
    const group = groups.get(key);
    if (!group) {
      return;
    }
    for (const candidate of group) {
      candidate.classList.remove(className);
    }
  };

  const applyGroup = (key: string, exclude?: SVGPathElement | null) => {
    const group = groups.get(key);
    if (!group) {
      return;
    }
    for (const candidate of group) {
      if (!includeSource && exclude && candidate === exclude) {
        candidate.classList.remove(className);
        continue;
      }
      candidate.classList.add(className);
    }
  };

  const clearPinned = () => {
    if (pinnedKey) {
      removeGroup(pinnedKey);
    }
    if (pinnedPath) {
      pinnedPath.classList.remove(pinClassName);
    }
    pinnedKey = null;
    pinnedPath = null;
  };

  const runtime: HighlightRuntime = {
    register(arc, path) {
      const key = deriveKey(arc);
      if (!key) {
        return;
      }
      if (!groups.has(key)) {
        groups.set(key, new Set());
      }
      groups.get(key)!.add(path);
      if (!path.hasAttribute('data-key')) {
        path.setAttribute('data-key', key);
      }
    },
    pointerEnter(arc, path) {
      const key = deriveKey(arc);
      if (!key) {
        return;
      }
      hoverKey = key;
      if (pinnedKey && pinnedKey === key) {
        if (!includeSource && path === pinnedPath) {
          applyGroup(key, path);
        }
        return;
      }
      applyGroup(key, includeSource ? null : path);
    },
    pointerMove(arc, path) {
      runtime.pointerEnter(arc, path);
    },
    pointerLeave(arc, path) {
      const key = deriveKey(arc);
      if (!key) {
        return;
      }
      if (pinnedKey && pinnedKey === key) {
        return;
      }
      if (hoverKey === key) {
        removeGroup(key);
        hoverKey = null;
      }
    },
    handleClick: pinOnClick
      ? (arc, path, event) => {
          const key = deriveKey(arc);
          if (!key) {
            return;
          }

          const isPinned = pinnedKey === key && pinnedPath === path;
          if (isPinned) {
            clearPinned();
            if (hoverKey === key) {
              applyGroup(key, includeSource ? null : path);
            }
            options.onPinChange?.({ arc, path, pinned: false, event });
            return;
          }

          clearPinned();
          pinnedKey = key;
          pinnedPath = path;
          if (pinClassName) {
            path.classList.add(pinClassName);
          }
          applyGroup(key, includeSource ? null : path);
          options.onPinChange?.({ arc, path, pinned: true, event });
        }
      : undefined,
    handlesClick: pinOnClick,
    dispose() {
      for (const key of groups.keys()) {
        removeGroup(key);
      }
      if (pinnedPath && pinClassName) {
        pinnedPath.classList.remove(pinClassName);
      }
      groups.clear();
      pinnedKey = null;
      pinnedPath = null;
      hoverKey = null;
    },
  };

  return runtime;
}

function defaultHighlightKey(arc: LayoutArc): string | null {
  if (typeof arc.key === 'string' && arc.key.length > 0) {
    return arc.key;
  }
  const dataKey = arc.data?.key;
  if (typeof dataKey === 'string' && dataKey.length > 0) {
    return dataKey;
  }
  return null;
}
