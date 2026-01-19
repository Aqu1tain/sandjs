import type { RenderSvgOptions } from '../types.js';

export function resolveDocument(explicit: Document | undefined): Document {
  if (explicit) {
    return explicit;
  }

  if (globalThis.window !== undefined && globalThis.document) {
    return globalThis.document;
  }

  throw new Error('renderSVG requires a Document instance');
}

export function resolveHostElement(target: RenderSvgOptions['el'], doc: Document): SVGElement {
  if (typeof target === 'string') {
    const resolved = doc.querySelector(target);
    if (!resolved) {
      throw new Error(`renderSVG could not find SVG element for selector "${target}"`);
    }
    if (!(resolved instanceof SVGElement)) {
      throw new TypeError(`renderSVG selector "${target}" did not resolve to an SVG element`);
    }
    return resolved;
  }

  return target;
}
