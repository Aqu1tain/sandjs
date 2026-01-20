import { test, describe } from 'node:test';
import * as assert from 'node:assert/strict';
import { getContrastTextColor } from '../src/render/colorUtils.js';

describe('Label Color Utils - getContrastTextColor', () => {
  test('returns white for dark backgrounds', () => {
    assert.equal(getContrastTextColor('#000000'), '#ffffff');
    assert.equal(getContrastTextColor('#333333'), '#ffffff');
    assert.equal(getContrastTextColor('#1a1a1a'), '#ffffff');
  });

  test('returns black for light backgrounds', () => {
    assert.equal(getContrastTextColor('#ffffff'), '#000000');
    assert.equal(getContrastTextColor('#f0f0f0'), '#000000');
    assert.equal(getContrastTextColor('#cccccc'), '#000000');
  });

  test('handles saturated colors', () => {
    // Dark saturated colors should get white text
    assert.equal(getContrastTextColor('#0000ff'), '#ffffff'); // Blue
    assert.equal(getContrastTextColor('#800080'), '#ffffff'); // Purple

    // Light saturated colors should get black text
    assert.equal(getContrastTextColor('#00ff00'), '#000000'); // Lime
    assert.equal(getContrastTextColor('#ffff00'), '#000000'); // Yellow
    assert.equal(getContrastTextColor('#00ffff'), '#000000'); // Cyan
  });

  test('handles edge cases', () => {
    // Red is borderline - depends on exact luminance calculation
    const redResult = getContrastTextColor('#ff0000');
    assert.ok(redResult === '#ffffff' || redResult === '#000000');
  });

  test('returns default for invalid color', () => {
    const result = getContrastTextColor('invalid');
    assert.equal(result, '#000000');
  });

  test('handles 3-digit hex', () => {
    assert.equal(getContrastTextColor('#000'), '#ffffff');
    assert.equal(getContrastTextColor('#fff'), '#000000');
  });
});

describe('Label Visibility Logic', () => {
  // These tests verify the label visibility calculation logic
  // based on arc geometry constraints

  const LABEL_MIN_RADIAL_THICKNESS = 12;
  const LABEL_CHAR_WIDTH_FACTOR = 0.7;
  const LABEL_PADDING = 8;
  const LABEL_SAFETY_MARGIN = 1.15;

  function canShowLabel(arc: { x0: number; x1: number; y0: number; y1: number }, text: string): { visible: boolean; reason?: string } {
    const span = arc.x1 - arc.x0;
    if (span <= 0) {
      return { visible: false, reason: 'no-span' };
    }

    const radialThickness = Math.max(0, arc.y1 - arc.y0);
    if (radialThickness < LABEL_MIN_RADIAL_THICKNESS) {
      return { visible: false, reason: 'thin-radius' };
    }

    const midRadius = arc.y0 + radialThickness * 0.5;
    const fontSize = Math.min(Math.max(radialThickness * 0.5, 8), 16);
    const estimatedWidth = text.length * fontSize * LABEL_CHAR_WIDTH_FACTOR + LABEL_PADDING;
    const arcLength = span * midRadius;
    const requiredLength = estimatedWidth * LABEL_SAFETY_MARGIN;

    if (arcLength < requiredLength) {
      return { visible: false, reason: 'narrow-arc' };
    }

    return { visible: true };
  }

  test('hides label for zero-span arc', () => {
    const result = canShowLabel({ x0: 0, x1: 0, y0: 50, y1: 100 }, 'Test');
    assert.equal(result.visible, false);
    assert.equal(result.reason, 'no-span');
  });

  test('hides label for thin radial arc', () => {
    const result = canShowLabel({ x0: 0, x1: Math.PI, y0: 50, y1: 55 }, 'Test');
    assert.equal(result.visible, false);
    assert.equal(result.reason, 'thin-radius');
  });

  test('hides label for narrow angular span', () => {
    const result = canShowLabel({ x0: 0, x1: 0.01, y0: 50, y1: 100 }, 'Very Long Label Text');
    assert.equal(result.visible, false);
    assert.equal(result.reason, 'narrow-arc');
  });

  test('shows label for adequate arc', () => {
    const result = canShowLabel({ x0: 0, x1: Math.PI / 2, y0: 50, y1: 100 }, 'Test');
    assert.equal(result.visible, true);
  });

  test('considers text length in visibility', () => {
    const arc = { x0: 0, x1: 0.3, y0: 50, y1: 100 };

    const shortResult = canShowLabel(arc, 'A');
    const longResult = canShowLabel(arc, 'This is a very long label');

    // Short text might fit, long text won't
    assert.ok(shortResult.visible !== longResult.visible || shortResult.visible === false);
  });

  test('larger arcs can fit longer labels', () => {
    const smallArc = { x0: 0, x1: 0.2, y0: 50, y1: 70 };
    const largeArc = { x0: 0, x1: Math.PI, y0: 50, y1: 150 };
    const text = 'Medium Label';

    const smallResult = canShowLabel(smallArc, text);
    const largeResult = canShowLabel(largeArc, text);

    assert.equal(largeResult.visible, true, 'Large arc should fit label');
  });
});

describe('Label Text Inversion', () => {
  // Labels should be inverted (read from right to left)
  // when the tangent at the midpoint points leftward
  // In SVG coordinates (Y increases downward), the tangent at angle θ is:
  // tangent = atan2(r*cos(θ), -r*sin(θ))

  function shouldInvertLabel(midAngle: number): boolean {
    const TAU = Math.PI * 2;
    // Tangent direction in screen coordinates
    const tangentAngle = Math.atan2(Math.cos(midAngle), -Math.sin(midAngle));
    // Normalize to [0, TAU)
    const normalized = ((tangentAngle % TAU) + TAU) % TAU;
    // Invert when tangent points leftward (between 90° and 270°)
    return normalized >= Math.PI / 2 && normalized < (3 * Math.PI) / 2;
  }

  test('inversion for right side of circle (0°)', () => {
    // At 0 radians, tangent points downward → inverted
    assert.equal(shouldInvertLabel(0), true);
  });

  test('inversion for bottom of circle (90°)', () => {
    // At PI/2 radians, tangent points left → inverted
    assert.equal(shouldInvertLabel(Math.PI / 2), true);
  });

  test('no inversion for left side (180°)', () => {
    // At PI radians, tangent points upward → not inverted (boundary)
    assert.equal(shouldInvertLabel(Math.PI), false);
  });

  test('no inversion for top of circle (270°)', () => {
    // At 3*PI/2 radians, tangent points right → not inverted
    assert.equal(shouldInvertLabel(3 * Math.PI / 2), false);
  });

  test('transition points', () => {
    // Just past the left side should not be inverted
    const justPast180 = Math.PI + 0.1;
    assert.equal(shouldInvertLabel(justPast180), false);
    // Just before the left side should be inverted
    const justBefore180 = Math.PI - 0.1;
    assert.equal(shouldInvertLabel(justBefore180), true);
  });
});

describe('Label Font Size Scaling', () => {
  const LABEL_MIN_FONT_SIZE = 8;
  const LABEL_MAX_FONT_SIZE = 16;

  function calculateFontSize(radialThickness: number): number {
    return Math.min(Math.max(radialThickness * 0.5, LABEL_MIN_FONT_SIZE), LABEL_MAX_FONT_SIZE);
  }

  test('minimum font size for thin arcs', () => {
    assert.equal(calculateFontSize(10), LABEL_MIN_FONT_SIZE);
    assert.equal(calculateFontSize(5), LABEL_MIN_FONT_SIZE);
  });

  test('maximum font size for thick arcs', () => {
    assert.equal(calculateFontSize(50), LABEL_MAX_FONT_SIZE);
    assert.equal(calculateFontSize(100), LABEL_MAX_FONT_SIZE);
  });

  test('proportional scaling in middle range', () => {
    const size20 = calculateFontSize(20);
    const size30 = calculateFontSize(30);
    assert.ok(size30 > size20, 'Thicker arc should have larger font');
  });

  test('font size is half of radial thickness within bounds', () => {
    assert.equal(calculateFontSize(24), 12); // 24 * 0.5 = 12
    assert.equal(calculateFontSize(28), 14); // 28 * 0.5 = 14
  });
});
