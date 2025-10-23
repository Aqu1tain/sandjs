import type { SunburstConfig } from '../../types/index.js';
import type { RenderSvgUpdateInput, RenderSvgUpdateOptions } from '../types.js';
import { SVG_NS } from './constants.js';

/**
 * Checks if a value is a SunburstConfig
 */
export function isSunburstConfig(value: unknown): value is SunburstConfig {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const record = value as Record<string, unknown>;
  return 'size' in record && 'layers' in record;
}

/**
 * Ensures the label defs element exists in the host
 */
export function ensureLabelDefs(host: SVGElement, doc: Document): SVGDefsElement {
  const children = Array.from(host.childNodes);
  for (const child of children) {
    if (child instanceof SVGDefsElement && child.getAttribute('data-sand-labels') === 'true') {
      return child;
    }
  }

  const defs = doc.createElementNS(SVG_NS, 'defs');
  defs.setAttribute('data-sand-labels', 'true');
  if (host.firstChild) {
    host.insertBefore(defs, host.firstChild);
  } else {
    host.appendChild(defs);
  }
  return defs;
}

/**
 * Extracts the config from an update input
 */
export function extractConfigFromUpdate(
  input: RenderSvgUpdateInput,
  fallback: SunburstConfig,
): SunburstConfig {
  if (isSunburstConfig(input)) {
    return input;
  }
  if (input && typeof input === 'object') {
    const candidate = (input as RenderSvgUpdateOptions).config;
    if (candidate) {
      return candidate;
    }
  }
  return fallback;
}
