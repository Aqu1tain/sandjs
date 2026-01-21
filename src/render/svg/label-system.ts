import { polarToCartesian, TAU, ZERO_TOLERANCE } from '../geometry.js';
import { getContrastTextColor } from '../colorUtils.js';
import {
  LABEL_MIN_RADIAL_THICKNESS,
  LABEL_MIN_FONT_SIZE,
  LABEL_MAX_FONT_SIZE,
  LABEL_CHAR_WIDTH_FACTOR,
  LABEL_PADDING,
  LABEL_SAFETY_MARGIN,
  LABEL_TANGENT_SAMPLE_RATIO,
  LABEL_TANGENT_MIN_DELTA,
  LABEL_TANGENT_MAX_DELTA,
} from './constants.js';
import type { ManagedPath } from './types.js';
import type { LayoutArc } from '../../types';
import type { ResolvedRenderOptions } from '../types.js';

/**
 * Options for updating arc labels
 */
export type UpdateArcLabelOptions = {
  cx: number;
  cy: number;
  allowLogging: boolean;
  renderOptions: ResolvedRenderOptions;
  arcColor: string;
};

/**
 * Result of label visibility evaluation
 */
export type LabelEvaluation = {
  visible: boolean;
  reason?: string;
  x?: number;
  y?: number;
  fontSize?: number;
  pathData?: string;
  inverted?: boolean;
};

/**
 * Payload for label logging
 */
export type LabelLogPayload = {
  layerId: string;
  name: string;
  reason: string;
  arc: LayoutArc;
};

/**
 * Updates the label for a managed arc path
 */
export function updateArcLabel(managed: ManagedPath, arc: LayoutArc, options: UpdateArcLabelOptions): void {
  const { cx, cy, allowLogging, renderOptions, arcColor } = options;

  if (managed.pendingRemoval) {
    hideLabel(managed, 'pending-removal');
    return;
  }

  // Check if labels should be shown (global, layer, or default to true)
  const labelOptions = renderOptions.labels;
  const globalShowLabels = typeof labelOptions === 'boolean' ? labelOptions : labelOptions?.showLabels ?? true;
  const layer = renderOptions.config.layers.find(l => l.id === arc.layerId);
  const layerShowLabels = layer?.showLabels ?? globalShowLabels;

  if (!layerShowLabels) {
    hideLabel(managed, 'labels-disabled');
    return;
  }

  const text = arc.data.name.trim();
  if (!text) {
    hideLabel(managed, 'empty-label');
    return;
  }

  const evaluation = evaluateLabelVisibility(arc, text, cx, cy, renderOptions);
  if (!evaluation.visible || evaluation.x === undefined || evaluation.y === undefined || !evaluation.fontSize) {
    const reason = evaluation.reason ?? 'insufficient-geometry';
    const loggable = shouldLogLabelReason(reason);
    if (!allowLogging && loggable) {
      managed.labelPendingLogReason = reason;
    }

    const hasPendingMatch = managed.labelPendingLogReason === reason;
    const reasonChanged = managed.labelHiddenReason !== reason;
    const shouldLogNow = allowLogging && loggable && (reasonChanged || hasPendingMatch);
    const payload = shouldLogNow ? createLabelLogPayload(arc, text, reason) : null;
    hideLabel(managed, reason, payload, shouldLogNow);

    if (allowLogging) {
      managed.labelPendingLogReason = null;
    }
    return;
  }

  const labelColor = resolveLabelColor(arc, layer, renderOptions, arcColor);
  const useStraightStyle = shouldUseStraightLabel(arc, renderOptions);
  showLabel(managed, text, evaluation, arc, labelColor, { useStraightStyle, cx, cy });
}

function shouldUseStraightLabel(arc: LayoutArc, renderOptions: ResolvedRenderOptions): boolean {
  if (arc.depth !== 0) return false;

  const layer = renderOptions.config.layers.find(l => l.id === arc.layerId);
  if (layer?.rootLabelStyle) return layer.rootLabelStyle === 'straight';

  const labelOptions = renderOptions.labels;
  if (typeof labelOptions !== 'object') return false;
  return labelOptions?.rootLabelStyle === 'straight';
}

function resolveLabelColor(
  arc: LayoutArc,
  layer: { labelColor?: string } | undefined,
  renderOptions: ResolvedRenderOptions,
  arcColor: string,
): string {
  if (arc.data.labelColor) return arc.data.labelColor;
  if (layer?.labelColor) return layer.labelColor;

  const labelOptions = renderOptions.labels;
  if (typeof labelOptions === 'object') {
    if (labelOptions.labelColor) return labelOptions.labelColor;
    if (labelOptions.autoLabelColor) return getContrastTextColor(arcColor);
  }

  return '#000000';
}

type FontSizeConfig = { min: number; max: number };

function resolveFontSizeConfig(labelOptions: ResolvedRenderOptions['labels']): FontSizeConfig {
  if (typeof labelOptions !== 'object' || !labelOptions?.fontSize) {
    return { min: LABEL_MIN_FONT_SIZE, max: LABEL_MAX_FONT_SIZE };
  }
  const fs = labelOptions.fontSize;
  if (typeof fs === 'number') return { min: fs, max: fs };
  return { min: fs.min, max: fs.max };
}

function resolveMinRadialThickness(labelOptions: ResolvedRenderOptions['labels']): number {
  if (typeof labelOptions !== 'object') return LABEL_MIN_RADIAL_THICKNESS;
  return labelOptions?.minRadialThickness ?? LABEL_MIN_RADIAL_THICKNESS;
}

/**
 * Evaluates whether a label can be shown for an arc
 */
function evaluateLabelVisibility(
  arc: LayoutArc,
  text: string,
  cx: number,
  cy: number,
  renderOptions: ResolvedRenderOptions,
): LabelEvaluation {
  const span = arc.x1 - arc.x0;
  if (span <= 0) {
    return { visible: false, reason: 'no-span' };
  }

  const minThickness = resolveMinRadialThickness(renderOptions.labels);
  const radialThickness = Math.max(0, arc.y1 - arc.y0);
  if (radialThickness < minThickness) {
    return { visible: false, reason: 'thin-radius' };
  }

  const fontConfig = resolveFontSizeConfig(renderOptions.labels);
  const midRadius = arc.y0 + radialThickness * 0.5;
  const fontSize = Math.min(Math.max(radialThickness * 0.5, fontConfig.min), fontConfig.max);
  const estimatedWidth = text.length * fontSize * LABEL_CHAR_WIDTH_FACTOR + LABEL_PADDING;
  const arcLength = span * midRadius;

  // Apply safety margin for centered text to prevent cut-off at boundaries
  const requiredLength = estimatedWidth * LABEL_SAFETY_MARGIN;
  if (arcLength < requiredLength) {
    return { visible: false, reason: 'narrow-arc' };
  }

  const angle = (arc.x0 + arc.x1) * 0.5;
  const point = polarToCartesian(cx, cy, midRadius, angle);

  const smallDelta = Math.min(Math.max(span * LABEL_TANGENT_SAMPLE_RATIO, LABEL_TANGENT_MIN_DELTA), LABEL_TANGENT_MAX_DELTA);

  // Sample points just before and after midpoint
  const aBefore = angle - smallDelta;
  const aAfter = angle + smallDelta;
  const pBefore = polarToCartesian(cx, cy, midRadius, aBefore);
  const pAfter = polarToCartesian(cx, cy, midRadius, aAfter);

  // Tangent vector in screen coordinates
  const tx = pAfter.x - pBefore.x;
  const ty = pAfter.y - pBefore.y;

  // Tangent angle in [-π, π]
  const tangentAngle = Math.atan2(ty, tx);
  // Normalize to [0, TAU)
  const normalizedTangent = ((tangentAngle % TAU) + TAU) % TAU;

  // Invert when tangent points leftwards (between 90° and 270°)
  const inverted = normalizedTangent >= Math.PI / 2 && normalizedTangent < (3 * Math.PI) / 2;
  const pathData = createLabelArcPath({
    arc,
    radius: midRadius,
    inverted,
    cx,
    cy,
  });

  if (!pathData) {
    return { visible: false, reason: 'path-error' };
  }

  return {
    visible: true,
    x: point.x,
    y: point.y,
    fontSize,
    pathData,
    inverted,
  };
}

/**
 * Creates an SVG arc path for label text to follow
 */
function createLabelArcPath(params: {
  arc: LayoutArc;
  radius: number;
  inverted: boolean;
  cx: number;
  cy: number;
}): string | null {
  const { arc, radius, inverted, cx, cy } = params;
  if (radius <= ZERO_TOLERANCE) {
    return null;
  }

  const span = Math.max(arc.x1 - arc.x0, 0);
  if (span <= ZERO_TOLERANCE) {
    return null;
  }

  const sweepFlag = inverted ? 0 : 1;
  const normalizedSpan = Math.min(span, TAU);

  if (normalizedSpan >= TAU - ZERO_TOLERANCE) {
    const startAnchor = inverted ? arc.x1 : arc.x0;
    const firstHalf = startAnchor + Math.PI * (inverted ? -1 : 1);
    const start = polarToCartesian(cx, cy, radius, startAnchor);
    const mid = polarToCartesian(cx, cy, radius, firstHalf);

    return [
      `M ${start.x} ${start.y}`,
      `A ${radius} ${radius} 0 1 ${sweepFlag} ${mid.x} ${mid.y}`,
      `A ${radius} ${radius} 0 1 ${sweepFlag} ${start.x} ${start.y}`,
    ].join(' ');
  }

  const startAngle = inverted ? arc.x1 : arc.x0;
  const endAngle = inverted ? arc.x0 : arc.x1;
  const largeArcFlag = normalizedSpan > Math.PI ? 1 : 0;

  const start = polarToCartesian(cx, cy, radius, startAngle);
  const end = polarToCartesian(cx, cy, radius, endAngle);

  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} ${sweepFlag} ${end.x} ${end.y}`;
}

type ShowLabelOptions = {
  useStraightStyle: boolean;
  cx: number;
  cy: number;
};

/**
 * Shows the label for a managed arc
 */
function showLabel(
  managed: ManagedPath,
  text: string,
  evaluation: LabelEvaluation,
  arc: LayoutArc,
  labelColor: string,
  options: ShowLabelOptions,
): void {
  if (!evaluation.x || !evaluation.y || !evaluation.fontSize) return;

  const { labelElement } = managed;
  labelElement.style.display = '';
  labelElement.style.fontSize = `${evaluation.fontSize.toFixed(2)}px`;
  labelElement.style.opacity = managed.element.style.opacity;
  labelElement.setAttribute('fill', labelColor);
  labelElement.dataset.layer = arc.layerId;
  labelElement.dataset.depth = String(arc.depth);

  if (options.useStraightStyle) {
    const isFullCircle = (arc.x1 - arc.x0) >= TAU - ZERO_TOLERANCE;
    const x = isFullCircle ? options.cx : evaluation.x;
    const y = isFullCircle ? options.cy : evaluation.y;
    showStraightLabel(managed, text, { ...evaluation, x, y });
  } else {
    showCurvedLabel(managed, text, evaluation);
  }

  managed.labelVisible = true;
  managed.labelHiddenReason = null;
  managed.labelPendingLogReason = null;
}

function showStraightLabel(managed: ManagedPath, text: string, evaluation: LabelEvaluation): void {
  const { labelElement, textPathElement, labelPathElement } = managed;

  textPathElement.textContent = '';
  labelPathElement.removeAttribute('d');

  labelElement.setAttribute('x', String(evaluation.x));
  labelElement.setAttribute('y', String(evaluation.y));
  labelElement.setAttribute('text-anchor', 'middle');
  labelElement.setAttribute('dominant-baseline', 'middle');
  labelElement.textContent = text;
  labelElement.removeAttribute('transform');
  delete labelElement.dataset.inverted;
}

function showCurvedLabel(managed: ManagedPath, text: string, evaluation: LabelEvaluation): void {
  const { labelElement, textPathElement, labelPathElement } = managed;

  if (!evaluation.pathData) return;

  labelElement.removeAttribute('x');
  labelElement.removeAttribute('y');
  labelElement.removeAttribute('text-anchor');
  labelElement.removeAttribute('dominant-baseline');

  if (!textPathElement.parentNode) {
    labelElement.textContent = '';
    labelElement.appendChild(textPathElement);
  }

  if (textPathElement.textContent !== text) {
    textPathElement.textContent = text;
  }
  labelPathElement.setAttribute('d', evaluation.pathData);
  textPathElement.setAttribute('startOffset', '50%');
  textPathElement.setAttribute('spacing', 'auto');

  labelElement.removeAttribute('transform');
  if (evaluation.inverted) {
    labelElement.dataset.inverted = 'true';
  } else {
    delete labelElement.dataset.inverted;
  }
}

/**
 * Hides the label for a managed arc
 */
export function hideLabel(
  managed: ManagedPath,
  reason: string,
  logPayload?: LabelLogPayload | null,
  forceLog?: boolean,
): void {
  if (managed.labelVisible || managed.labelHiddenReason !== reason) {
    managed.labelElement.style.display = 'none';
    managed.labelElement.style.opacity = managed.element.style.opacity;
    managed.labelVisible = false;
    managed.textPathElement.textContent = '';
    managed.labelPathElement.removeAttribute('d');
    managed.labelElement.removeAttribute('transform');
    delete managed.labelElement.dataset.inverted;
  } else {
    managed.labelElement.style.display = 'none';
  }

  if (logPayload && (forceLog || managed.labelHiddenReason !== reason)) {
    logHiddenLabel(logPayload);
  }

  managed.labelHiddenReason = reason;
}

/**
 * Creates a payload for label logging
 */
function createLabelLogPayload(arc: LayoutArc, text: string, reason: string): LabelLogPayload {
  return {
    layerId: arc.layerId,
    name: text,
    reason,
    arc,
  };
}

const LABEL_HIDDEN_REASONS: Record<string, string> = {
  'thin-radius': 'radial thickness is too small for a readable label',
  'narrow-arc': 'arc span is too narrow for the label text',
  'no-span': 'the arc span is effectively zero',
  'path-error': 'the label path could not be established for this arc',
};

function shouldLogLabelReason(reason: string): boolean {
  return reason in LABEL_HIDDEN_REASONS;
}

function logHiddenLabel(payload: LabelLogPayload): void {
  if (typeof console === 'undefined' || typeof console.info !== 'function') return;

  const friendlyReason = LABEL_HIDDEN_REASONS[payload.reason] ?? 'node is too small to display a label safely';
  console.info(`[Sand.js] Hiding label "${payload.name}" on layer "${payload.layerId}" because ${friendlyReason}.`);
}
