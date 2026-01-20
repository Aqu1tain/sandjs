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
 * Extracts the config from an update input.
 * Supports both full config and simple data API.
 */
export function extractConfigFromUpdate(
  input: RenderSvgUpdateInput,
  fallback: SunburstConfig,
  currentRadius?: number,
  currentAngle?: number,
): SunburstConfig {
  if (isSunburstConfig(input)) {
    return input;
  }
  if (input && typeof input === 'object') {
    const record = input as Record<string, unknown>;
    if (record.config) {
      return record.config as SunburstConfig;
    }
    if (record.data) {
      const radius = (record.radius as number | undefined) ?? currentRadius;
      if (!radius) {
        throw new Error('update() requires `radius` when using `data`');
      }
      return resolveConfig({
        el: '',
        data: record.data as TreeNodeInput | TreeNodeInput[],
        radius,
        angle: (record.angle as number | undefined) ?? currentAngle,
      });
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
  const maxUnits = computeMaxRadialUnits(tree);

  return {
    size: {
      radius: options.radius,
      angle: options.angle,
    },
    layers: [{
      id: 'default',
      radialUnits: [0, maxUnits],
      angleMode: 'free',
      tree,
    }],
  };
}

function normalizeTreeInput(data: TreeNodeInput | TreeNodeInput[]): TreeNodeInput[] {
  return Array.isArray(data) ? data : [data];
}

function computeMaxRadialUnits(nodes: TreeNodeInput[], currentUnits = 0): number {
  let max = currentUnits;
  for (const node of nodes) {
    const nodeUnits = currentUnits + (node.expandLevels ?? 1);
    max = Math.max(max, nodeUnits);
    if (node.children && node.children.length > 0) {
      max = Math.max(max, computeMaxRadialUnits(node.children, nodeUnits));
    }
  }
  return max;
}
