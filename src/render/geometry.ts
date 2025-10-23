import type { LayoutArc } from '../types/index.js';

export const ZERO_TOLERANCE = 1e-6;
export const TAU = Math.PI * 2;

export function describeArcPath(arc: LayoutArc, cx: number, cy: number): string | null {
  const span = arc.x1 - arc.x0;
  if (span <= ZERO_TOLERANCE) {
    return null;
  }

  const fullCircle = span >= TAU - ZERO_TOLERANCE;

  const outerStart = polarToCartesian(cx, cy, arc.y1, arc.x0);
  const outerEnd = polarToCartesian(cx, cy, arc.y1, arc.x1);
  // SVG arc large-arc flag: 1 if arc spans more than half a circle (π radians), 0 otherwise
  const largeArc = span > Math.PI ? 1 : 0;

  if (fullCircle && arc.y0 <= ZERO_TOLERANCE) {
    const outerRadius = arc.y1;
    const start = { x: cx + outerRadius, y: cy };
    const mid = { x: cx - outerRadius, y: cy };
    return [
      `M ${start.x} ${start.y}`,
      `A ${outerRadius} ${outerRadius} 0 1 1 ${mid.x} ${mid.y}`,
      `A ${outerRadius} ${outerRadius} 0 1 1 ${start.x} ${start.y}`,
      'Z',
    ].join(' ');
  }

  if (fullCircle) {
    const outerRadius = arc.y1;
    const innerRadius = arc.y0;
    const outerStartPoint = { x: cx + outerRadius, y: cy };
    const outerMidPoint = { x: cx - outerRadius, y: cy };
    const parts = [
      `M ${outerStartPoint.x} ${outerStartPoint.y}`,
      `A ${outerRadius} ${outerRadius} 0 1 1 ${outerMidPoint.x} ${outerMidPoint.y}`,
      `A ${outerRadius} ${outerRadius} 0 1 1 ${outerStartPoint.x} ${outerStartPoint.y}`,
    ];
    if (innerRadius > ZERO_TOLERANCE) {
      const innerStartPoint = { x: cx + innerRadius, y: cy };
      const innerMidPoint = { x: cx - innerRadius, y: cy };
      parts.push(
        `M ${innerStartPoint.x} ${innerStartPoint.y}`,
        `A ${innerRadius} ${innerRadius} 0 1 0 ${innerMidPoint.x} ${innerMidPoint.y}`,
        `A ${innerRadius} ${innerRadius} 0 1 0 ${innerStartPoint.x} ${innerStartPoint.y}`,
      );
    }
    parts.push('Z');
    return parts.join(' ');
  }

  if (arc.y0 <= ZERO_TOLERANCE) {
    return [
      `M ${cx} ${cy}`,
      `L ${outerStart.x} ${outerStart.y}`,
      `A ${arc.y1} ${arc.y1} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
      'Z',
    ].join(' ');
  }

  const innerStart = polarToCartesian(cx, cy, arc.y0, arc.x1);
  const innerEnd = polarToCartesian(cx, cy, arc.y0, arc.x0);

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${arc.y1} ${arc.y1} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerStart.x} ${innerStart.y}`,
    `A ${arc.y0} ${arc.y0} 0 ${largeArc} 0 ${innerEnd.x} ${innerEnd.y}`,
    'Z',
  ].join(' ');
}

export function polarToCartesian(
  cx: number,
  cy: number,
  radius: number,
  angle: number,
): { x: number; y: number } {
  return {
    x: cx + radius * Math.cos(angle),
    y: cy + radius * Math.sin(angle),
  };
}
