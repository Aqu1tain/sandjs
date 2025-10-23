import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { createColorAssigner } from '../src/render/colorAssignment.js';
import type { LayoutArc } from '../src/types/index.js';
import type { ColorThemeOptions } from '../src/render/types.js';

describe('Color Assignment', () => {
  const createMockArc = (overrides: Partial<LayoutArc> = {}): LayoutArc => ({
    layerId: 'test',
    data: { name: 'Test', value: 100 },
    x0: 0,
    x1: Math.PI / 2,
    y0: 0,
    y1: 100,
    depth: 0,
    value: 100,
    percentage: 1,
    path: [],
    pathIndices: [0],
    ...overrides,
  });

  describe('createColorAssigner - key-based assignment', () => {
    it('should assign consistent colors by key', () => {
      const arc1 = createMockArc({ key: 'alpha', data: { name: 'A', value: 10 } });
      const arc2 = createMockArc({ key: 'beta', data: { name: 'B', value: 20 } });
      const arc3 = createMockArc({ key: 'alpha', data: { name: 'A2', value: 15 } });

      const theme: ColorThemeOptions = {
        type: 'qualitative',
        palette: 'default',
        assignBy: 'key',
      };

      const assigner = createColorAssigner(theme, [arc1, arc2, arc3]);

      const color1 = assigner(arc1, 0);
      const color2 = assigner(arc2, 1);
      const color3 = assigner(arc3, 2);

      // Same key should get same color
      assert.strictEqual(color1, color3, 'Arcs with same key should have same color');
      // Different keys should get different colors
      assert.notStrictEqual(color1, color2, 'Arcs with different keys should have different colors');
    });

    it('should respect node color overrides', () => {
      const arc1 = createMockArc({ data: { name: 'A', value: 10, color: '#ff0000' } });
      const arc2 = createMockArc({ data: { name: 'B', value: 20 } });

      const theme: ColorThemeOptions = {
        type: 'qualitative',
        palette: 'default',
        assignBy: 'key',
      };

      const assigner = createColorAssigner(theme, [arc1, arc2]);

      const color1 = assigner(arc1, 0);
      const color2 = assigner(arc2, 1);

      // Node with explicit color should return null (renderer will use arc.data.color)
      assert.strictEqual(color1, null, 'Arc with explicit color should return null');
      assert.notStrictEqual(color2, null, 'Arc without explicit color should get theme color');
    });

    it('should handle arcs without keys', () => {
      const arc1 = createMockArc({ data: { name: 'A', value: 10 } });
      const arc2 = createMockArc({ data: { name: 'B', value: 20 } });

      const theme: ColorThemeOptions = {
        type: 'qualitative',
        palette: 'default',
        assignBy: 'key',
      };

      const assigner = createColorAssigner(theme, [arc1, arc2]);

      const color1 = assigner(arc1, 0);
      const color2 = assigner(arc2, 1);

      // Should still assign colors even without explicit keys
      assert.notStrictEqual(color1, null);
      assert.notStrictEqual(color2, null);
    });
  });

  describe('createColorAssigner - value-based assignment', () => {
    it('should handle value-based assignment efficiently', () => {
      const arc1 = createMockArc({ value: 10 });
      const arc2 = createMockArc({ value: 50 });
      const arc3 = createMockArc({ value: 100 });

      const theme: ColorThemeOptions = {
        type: 'sequential',
        palette: 'blues',
        assignBy: 'value',
      };

      const assigner = createColorAssigner(theme, [arc1, arc2, arc3]);

      const color1 = assigner(arc1, 0);
      const color2 = assigner(arc2, 1);
      const color3 = assigner(arc3, 2);

      // All should get colors
      assert.notStrictEqual(color1, null);
      assert.notStrictEqual(color2, null);
      assert.notStrictEqual(color3, null);

      // Colors should be different based on value
      assert.notStrictEqual(color1, color3, 'Min and max values should get different colors');
    });

    it('should handle equal values gracefully', () => {
      const arc1 = createMockArc({ value: 50 });
      const arc2 = createMockArc({ value: 50 });
      const arc3 = createMockArc({ value: 50 });

      const theme: ColorThemeOptions = {
        type: 'sequential',
        palette: 'blues',
        assignBy: 'value',
      };

      const assigner = createColorAssigner(theme, [arc1, arc2, arc3]);

      const color1 = assigner(arc1, 0);
      const color2 = assigner(arc2, 1);
      const color3 = assigner(arc3, 2);

      // Should not throw and should assign colors
      assert.notStrictEqual(color1, null);
      assert.notStrictEqual(color2, null);
      assert.notStrictEqual(color3, null);
    });
  });

  describe('createColorAssigner - depth-based assignment', () => {
    it('should assign colors by depth', () => {
      const arc1 = createMockArc({ depth: 0 });
      const arc2 = createMockArc({ depth: 1 });
      const arc3 = createMockArc({ depth: 2 });

      const theme: ColorThemeOptions = {
        type: 'sequential',
        palette: 'greens',
        assignBy: 'depth',
      };

      const assigner = createColorAssigner(theme, [arc1, arc2, arc3]);

      const color1 = assigner(arc1, 0);
      const color2 = assigner(arc2, 1);
      const color3 = assigner(arc3, 2);

      // All should get colors
      assert.notStrictEqual(color1, null);
      assert.notStrictEqual(color2, null);
      assert.notStrictEqual(color3, null);
    });
  });

  describe('createColorAssigner - index-based assignment', () => {
    it('should assign colors by index', () => {
      const arc1 = createMockArc();
      const arc2 = createMockArc();
      const arc3 = createMockArc();

      const theme: ColorThemeOptions = {
        type: 'qualitative',
        palette: 'vibrant',
        assignBy: 'index',
      };

      const assigner = createColorAssigner(theme, [arc1, arc2, arc3]);

      const color1 = assigner(arc1, 0);
      const color2 = assigner(arc2, 1);
      const color3 = assigner(arc3, 2);

      // All should get colors
      assert.notStrictEqual(color1, null);
      assert.notStrictEqual(color2, null);
      assert.notStrictEqual(color3, null);

      // Different indices should get different colors (modulo palette length)
      assert.notStrictEqual(color1, color2);
    });
  });

  describe('createColorAssigner - custom palette', () => {
    it('should handle custom color arrays', () => {
      const customColors = ['#ff0000', '#00ff00', '#0000ff'];
      const arc1 = createMockArc({ key: 'a' });
      const arc2 = createMockArc({ key: 'b' });

      const theme: ColorThemeOptions = {
        type: 'qualitative',
        palette: customColors,
        assignBy: 'key',
      };

      const assigner = createColorAssigner(theme, [arc1, arc2]);

      const color1 = assigner(arc1, 0);
      const color2 = assigner(arc2, 1);

      // Should use custom colors
      assert.notStrictEqual(color1, null);
      assert.notStrictEqual(color2, null);
      assert.ok(customColors.includes(color1!));
      assert.ok(customColors.includes(color2!));
    });
  });

  describe('createColorAssigner - no theme', () => {
    it('should return null assigner when no theme provided', () => {
      const arc1 = createMockArc();

      const assigner = createColorAssigner(undefined, [arc1]);

      const color1 = assigner(arc1, 0);

      // Should return null when no theme
      assert.strictEqual(color1, null);
    });
  });
});
