import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { describeArcPath, polarToCartesian, TAU, ZERO_TOLERANCE } from '../src/render/geometry.js';
import type { LayoutArc } from '../src/types/index.js';

describe('Geometry Calculations', () => {
  const createMockArc = (overrides: Partial<LayoutArc> = {}): LayoutArc => ({
    layerId: 'test',
    data: { name: 'Test', value: 100 },
    x0: 0,
    x1: Math.PI / 2,
    y0: 50,
    y1: 100,
    depth: 0,
    value: 100,
    percentage: 1,
    path: [],
    pathIndices: [0],
    ...overrides,
  });

  describe('describeArcPath', () => {
    const cx = 100;
    const cy = 100;

    it('should handle standard arcs (< 180 degrees)', () => {
      const arc = createMockArc({
        x0: 0,
        x1: Math.PI / 2, // 90 degrees
        y0: 50,
        y1: 100,
      });

      const path = describeArcPath(arc, cx, cy);

      assert.notStrictEqual(path, null, 'Should generate path for standard arc');
      assert.ok(path!.includes('M'), 'Path should include Move command');
      assert.ok(path!.includes('A'), 'Path should include Arc command');
      assert.ok(path!.includes('Z'), 'Path should be closed');
    });

    it('should handle arcs > 180 degrees', () => {
      const arc = createMockArc({
        x0: 0,
        x1: (3 * Math.PI) / 2, // 270 degrees
        y0: 50,
        y1: 100,
      });

      const path = describeArcPath(arc, cx, cy);

      assert.notStrictEqual(path, null, 'Should generate path for large arc');
      // Large arc flag should be set to 1
      assert.ok(path!.includes(' 1 '), 'Should contain large-arc flag');
    });

    it('should handle full circles', () => {
      const arc = createMockArc({
        x0: 0,
        x1: TAU - ZERO_TOLERANCE / 2, // Almost full circle
        y0: 50,
        y1: 100,
      });

      const path = describeArcPath(arc, cx, cy);

      assert.notStrictEqual(path, null, 'Should generate path for full circle');
      // Full circle requires two arc commands
      const arcCount = (path!.match(/A /g) || []).length;
      assert.ok(arcCount >= 2, 'Full circle should have at least 2 arc commands');
    });

    it('should handle full circles with zero inner radius (solid disc)', () => {
      const arc = createMockArc({
        x0: 0,
        x1: TAU - ZERO_TOLERANCE / 2,
        y0: 0, // No inner radius
        y1: 100,
      });

      const path = describeArcPath(arc, cx, cy);

      assert.notStrictEqual(path, null, 'Should generate path for solid disc');
    });

    it('should handle very thin arcs (small span)', () => {
      const arc = createMockArc({
        x0: 0,
        x1: 0.01, // Very small angle
        y0: 50,
        y1: 100,
      });

      const path = describeArcPath(arc, cx, cy);

      assert.notStrictEqual(path, null, 'Should generate path for thin arc');
    });

    it('should return null for zero-span arcs', () => {
      const arc = createMockArc({
        x0: 0,
        x1: ZERO_TOLERANCE / 2, // Below tolerance
        y0: 50,
        y1: 100,
      });

      const path = describeArcPath(arc, cx, cy);

      assert.strictEqual(path, null, 'Should return null for zero-span arc');
    });

    it('should handle arcs with zero inner radius (wedges)', () => {
      const arc = createMockArc({
        x0: 0,
        x1: Math.PI / 2,
        y0: 0, // Zero inner radius
        y1: 100,
      });

      const path = describeArcPath(arc, cx, cy);

      assert.notStrictEqual(path, null, 'Should generate path for wedge');
      // Wedge should start from center
      assert.ok(path!.startsWith(`M ${cx} ${cy}`), 'Wedge should start from center');
    });

    it('should handle arcs with very thin radial thickness', () => {
      const arc = createMockArc({
        x0: 0,
        x1: Math.PI / 2,
        y0: 99, // Very thin
        y1: 100,
      });

      const path = describeArcPath(arc, cx, cy);

      assert.notStrictEqual(path, null, 'Should generate path for thin radial band');
    });

    it('should handle arcs at different angular positions', () => {
      const arc = createMockArc({
        x0: Math.PI, // Start at 180 degrees
        x1: (3 * Math.PI) / 2, // End at 270 degrees
        y0: 50,
        y1: 100,
      });

      const path = describeArcPath(arc, cx, cy);

      assert.notStrictEqual(path, null, 'Should generate path for arc at any position');
    });
  });

  describe('polarToCartesian', () => {
    it('should convert polar coordinates to cartesian', () => {
      const cx = 0;
      const cy = 0;
      const radius = 100;

      // 0 degrees (right)
      const point0 = polarToCartesian(cx, cy, radius, 0);
      assert.ok(Math.abs(point0.x - 100) < 0.01, `Expected x ≈ 100, got ${point0.x}`);
      assert.ok(Math.abs(point0.y - 0) < 0.01, `Expected y ≈ 0, got ${point0.y}`);

      // 90 degrees (down, due to SVG coordinate system)
      const point90 = polarToCartesian(cx, cy, radius, Math.PI / 2);
      assert.ok(Math.abs(point90.x - 0) < 0.01, `Expected x ≈ 0, got ${point90.x}`);
      assert.ok(Math.abs(point90.y - 100) < 0.01, `Expected y ≈ 100, got ${point90.y}`);

      // 180 degrees (left)
      const point180 = polarToCartesian(cx, cy, radius, Math.PI);
      assert.ok(Math.abs(point180.x - (-100)) < 0.01, `Expected x ≈ -100, got ${point180.x}`);
      assert.ok(Math.abs(point180.y - 0) < 0.01, `Expected y ≈ 0, got ${point180.y}`);

      // 270 degrees (up)
      const point270 = polarToCartesian(cx, cy, radius, (3 * Math.PI) / 2);
      assert.ok(Math.abs(point270.x - 0) < 0.01, `Expected x ≈ 0, got ${point270.x}`);
      assert.ok(Math.abs(point270.y - (-100)) < 0.01, `Expected y ≈ -100, got ${point270.y}`);
    });

    it('should handle different radii', () => {
      const cx = 0;
      const cy = 0;
      const angle = 0;

      const point50 = polarToCartesian(cx, cy, 50, angle);
      const point100 = polarToCartesian(cx, cy, 100, angle);

      assert.strictEqual(Math.round(point50.x), 50);
      assert.strictEqual(Math.round(point100.x), 100);
    });

    it('should handle non-zero center coordinates', () => {
      const cx = 100;
      const cy = 100;
      const radius = 50;
      const angle = 0;

      const point = polarToCartesian(cx, cy, radius, angle);

      assert.strictEqual(Math.round(point.x), 150); // 100 + 50
      assert.strictEqual(Math.round(point.y), 100);
    });
  });

  describe('Constants', () => {
    it('TAU should be 2π', () => {
      assert.strictEqual(TAU, Math.PI * 2);
    });

    it('ZERO_TOLERANCE should be a small positive number', () => {
      assert.ok(ZERO_TOLERANCE > 0);
      assert.ok(ZERO_TOLERANCE < 0.001);
    });
  });
});
