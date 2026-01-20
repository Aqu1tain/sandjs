import { test, describe } from 'node:test';
import * as assert from 'node:assert/strict';
import { layout } from '../src/layout/index.js';
import { resolveConfig } from '../src/render/svg/utils.js';
import type { SunburstConfig } from '../src/types/index.js';
import type { RenderSvgOptions } from '../src/render/types.js';

describe('Error Handling - Layout', () => {
  test('throws for aligned layer without alignWith', () => {
    const config: SunburstConfig = {
      size: { radius: 100 },
      layers: [
        { id: 'base', radialUnits: [0, 1], angleMode: 'free', tree: [{ name: 'A', value: 1 }] },
        { id: 'aligned', radialUnits: [1, 2], angleMode: 'align', tree: [{ name: 'B', value: 1 }] },
      ],
    };
    assert.throws(() => layout(config), /alignWith/);
  });

  test('throws for aligned layer referencing non-existent layer', () => {
    const config: SunburstConfig = {
      size: { radius: 100 },
      layers: [
        { id: 'base', radialUnits: [0, 1], angleMode: 'free', tree: [{ name: 'A', value: 1 }] },
        { id: 'aligned', radialUnits: [1, 2], angleMode: 'align', alignWith: 'nonexistent', tree: [{ name: 'B', value: 1 }] },
      ],
    };
    assert.throws(() => layout(config), /nonexistent/);
  });

  test('handles empty tree gracefully', () => {
    const config: SunburstConfig = {
      size: { radius: 100 },
      layers: [
        { id: 'empty', radialUnits: [0, 1], angleMode: 'free', tree: [] },
      ],
    };
    const result = layout(config);
    assert.equal(result.length, 0);
  });

  test('throws for zero radius', () => {
    const config: SunburstConfig = {
      size: { radius: 0 },
      layers: [
        { id: 'test', radialUnits: [0, 1], angleMode: 'free', tree: [{ name: 'A', value: 1 }] },
      ],
    };
    assert.throws(() => layout(config), /radius must be a positive number/);
  });

  test('throws for negative radius', () => {
    const config: SunburstConfig = {
      size: { radius: -100 },
      layers: [
        { id: 'test', radialUnits: [0, 1], angleMode: 'free', tree: [{ name: 'A', value: 1 }] },
      ],
    };
    assert.throws(() => layout(config), /radius must be a positive number/);
  });

  test('handles all zero values', () => {
    const config: SunburstConfig = {
      size: { radius: 100 },
      layers: [
        { id: 'test', radialUnits: [0, 1], angleMode: 'free', tree: [
          { name: 'A', value: 0 },
          { name: 'B', value: 0 },
        ]},
      ],
    };
    const result = layout(config);
    assert.equal(result.length, 2);
  });

  test('handles nodes without values (auto-computed from children)', () => {
    const config: SunburstConfig = {
      size: { radius: 100 },
      layers: [
        { id: 'test', radialUnits: [0, 2], angleMode: 'free', tree: [
          {
            name: 'Parent',
            children: [
              { name: 'Child1', value: 30 },
              { name: 'Child2', value: 70 },
            ]
          },
        ]},
      ],
    };
    const result = layout(config);
    const parent = result.find(a => a.data.name === 'Parent');
    assert.ok(parent);
    assert.equal(parent!.value, 100);
  });

  test('handles hidden nodes', () => {
    const config: SunburstConfig = {
      size: { radius: 100 },
      layers: [
        { id: 'test', radialUnits: [0, 1], angleMode: 'free', tree: [
          { name: 'Visible', value: 50 },
          { name: 'Hidden', value: 50, hidden: true },
        ]},
      ],
    };
    const result = layout(config);
    assert.equal(result.length, 1);
    assert.equal(result[0].data.name, 'Visible');
  });
});

describe('Error Handling - Simple API', () => {
  test('throws meaningful error for missing config and data', () => {
    const options = { el: '#chart' } as RenderSvgOptions;
    assert.throws(
      () => resolveConfig(options),
      { message: /requires either `config` or `data`/ }
    );
  });

  test('throws meaningful error for missing radius', () => {
    const options = { el: '#chart', data: [{ name: 'A' }] } as RenderSvgOptions;
    assert.throws(
      () => resolveConfig(options),
      { message: /requires `radius` when using `data`/ }
    );
  });
});

describe('Error Handling - Edge Cases', () => {
  test('layout handles very small angle', () => {
    const config: SunburstConfig = {
      size: { radius: 100, angle: 0.001 },
      layers: [
        { id: 'test', radialUnits: [0, 1], angleMode: 'free', tree: [
          { name: 'A', value: 50 },
          { name: 'B', value: 50 },
        ]},
      ],
    };
    const result = layout(config);
    assert.equal(result.length, 2);
    // Both arcs should fit in the tiny angle
    for (const arc of result) {
      assert.ok(arc.x1 - arc.x0 >= 0, 'Arc span should be non-negative');
    }
  });

  test('layout handles very large tree', () => {
    const nodes = Array.from({ length: 100 }, (_, i) => ({ name: `Node${i}`, value: 1 }));
    const config: SunburstConfig = {
      size: { radius: 100 },
      layers: [
        { id: 'test', radialUnits: [0, 1], angleMode: 'free', tree: nodes },
      ],
    };
    const result = layout(config);
    assert.equal(result.length, 100);
  });

  test('layout handles deeply nested tree without stack overflow', () => {
    let tree: any = { name: 'Leaf', value: 1 };
    for (let i = 0; i < 50; i++) {
      tree = { name: `Level${i}`, children: [tree] };
    }
    const config: SunburstConfig = {
      size: { radius: 100 },
      layers: [
        { id: 'test', radialUnits: [0, 51], angleMode: 'free', tree: [tree] },
      ],
    };
    const result = layout(config);
    assert.ok(result.length > 0);
  });

  test('layout handles special characters in names', () => {
    const config: SunburstConfig = {
      size: { radius: 100 },
      layers: [
        { id: 'test', radialUnits: [0, 1], angleMode: 'free', tree: [
          { name: '<script>alert("xss")</script>', value: 1 },
          { name: '日本語', value: 1 },
          { name: '🎉 emoji', value: 1 },
          { name: '', value: 1 },
        ]},
      ],
    };
    const result = layout(config);
    assert.equal(result.length, 4);
  });

  test('layout preserves data reference', () => {
    const originalNode = { name: 'Test', value: 42, customProp: 'preserved' };
    const config: SunburstConfig = {
      size: { radius: 100 },
      layers: [
        { id: 'test', radialUnits: [0, 1], angleMode: 'free', tree: [originalNode] },
      ],
    };
    const result = layout(config);
    assert.strictEqual(result[0].data, originalNode);
    assert.equal((result[0].data as any).customProp, 'preserved');
  });
});
