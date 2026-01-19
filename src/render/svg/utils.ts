import type { SunburstConfig, TreeNodeInput } from '../../types';
import type { RenderSvgOptions, RenderSvgUpdateInput} from '../types.js';
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
    if (child instanceof SVGDefsElement && child.dataset.sandLabels === 'true') {
      return child;
    }
  }

  const defs = doc.createElementNS(SVG_NS, 'defs');
  defs.dataset.sandLabels = 'true';
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
    const candidate = (input).config;
    if (candidate) {
      return candidate;
    }
  }
  return fallback;
}

/**
 * Resolves RenderSvgOptions into a SunburstConfig.
 * Supports both simple `data` API and full `config` API.
 */
export function resolveConfig(options: RenderSvgOptions): SunburstConfig {
  if (options.config) {
    return options.config;
  }

  if (!options.data) {
    throw new Error('renderSVG requires either `config` or `data`');
  }

  if (!options.radius) {
    throw new Error('renderSVG requires `radius` when using `data`');
  }

  const tree = normalizeTreeInput(options.data);
  const maxDepth = computeMaxDepth(tree);

  return {
    size: {
      radius: options.radius,
      angle: options.angle,
    },
    layers: [{
      id: 'default',
      radialUnits: [0, maxDepth],
      angleMode: 'free',
      tree,
    }],
  };
}

function normalizeTreeInput(data: TreeNodeInput | TreeNodeInput[]): TreeNodeInput[] {
  return Array.isArray(data) ? data : [data];
}

function computeMaxDepth(nodes: TreeNodeInput[], current = 1): number {
  let max = current;
  for (const node of nodes) {
    if (node.children && node.children.length > 0) {
      max = Math.max(max, computeMaxDepth(node.children, current + 1));
    }
  }
  return max;
}
