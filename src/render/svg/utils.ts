import type { SunburstConfig, TreeNodeInput } from '../../types';
import type { RenderSvgOptions, RenderSvgUpdateInput } from '../types.js';
import { SVG_NS } from './constants.js';
import { normalizeExpandLevels } from '../../layout/normalization.js';

export function isSunburstConfig(value: unknown): value is SunburstConfig {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return 'size' in record && 'layers' in record;
}

export function ensureLabelDefs(host: SVGElement, doc: Document): SVGDefsElement {
  for (const child of Array.from(host.childNodes)) {
    if (child instanceof SVGDefsElement && child.dataset.sandLabels === 'true') {
      return child;
    }
  }
  const defs = doc.createElementNS(SVG_NS, 'defs');
  defs.dataset.sandLabels = 'true';
  host.firstChild ? host.insertBefore(defs, host.firstChild) : host.appendChild(defs);
  return defs;
}

export function extractConfigFromUpdate(
  input: RenderSvgUpdateInput,
  fallback: SunburstConfig,
  currentRadius?: number,
  currentAngle?: number,
): SunburstConfig {
  if (isSunburstConfig(input)) return input;

  if (!input || typeof input !== 'object') return fallback;

  const record = input as Record<string, unknown>;
  if (record.config) return record.config as SunburstConfig;
  if (!record.data) return fallback;

  const radius = (record.radius as number | undefined) ?? currentRadius;
  if (!radius) throw new Error('update() requires `radius` when using `data`');

  return resolveConfig({
    el: '',
    data: record.data as TreeNodeInput | TreeNodeInput[],
    radius,
    angle: (record.angle as number | undefined) ?? currentAngle,
  });
}

export function resolveConfig(options: RenderSvgOptions): SunburstConfig {
  if (options.config) return options.config;
  if (!options.data) throw new Error('renderSVG requires either `config` or `data`');
  if (!options.radius) throw new Error('renderSVG requires `radius` when using `data`');

  const tree = Array.isArray(options.data) ? options.data : [options.data];

  return {
    size: { radius: options.radius, angle: options.angle },
    layers: [{
      id: 'default',
      radialUnits: [0, computeMaxRadialUnits(tree)],
      angleMode: 'free',
      tree,
    }],
  };
}

function computeMaxRadialUnits(nodes: TreeNodeInput[], currentUnits = 0): number {
  let max = currentUnits;
  for (const node of nodes) {
    const nodeUnits = currentUnits + normalizeExpandLevels(node.expandLevels);
    max = Math.max(max, nodeUnits);
    if (node.children?.length) {
      max = Math.max(max, computeMaxRadialUnits(node.children, nodeUnits));
    }
  }
  return max;
}
