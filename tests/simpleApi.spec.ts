import { test, describe } from 'node:test';
import * as assert from 'node:assert/strict';
import { resolveConfig, isSunburstConfig } from '../src/render/svg/utils.js';
import type { RenderSvgOptions } from '../src/render/types.js';
import type { SunburstConfig, TreeNodeInput } from '../src/types/index.js';

function normalizeExpandLevels(value: number | undefined): number {
  return (typeof value === 'number' && value > 0) ? value : 1;
}

function testComputeMaxRadialUnits(nodes: TreeNodeInput[], currentUnits = 0): number {
  let max = currentUnits;
  for (const node of nodes) {
    const nodeUnits = currentUnits + normalizeExpandLevels(node.expandLevels);
    max = Math.max(max, nodeUnits);
    if (node.children?.length) {
      max = Math.max(max, testComputeMaxRadialUnits(node.children, nodeUnits));
    }
  }
  return max;
}

describe('Simple API - resolveConfig', () => {
  test('returns config when config is provided', () => {
    const config: SunburstConfig = {
      size: { radius: 100 },
      layers: [{ id: 'test', radialUnits: [0, 1], angleMode: 'free', tree: [{ name: 'A' }] }],
    };
    const options = { el: '#chart', config } as RenderSvgOptions;
    const result = resolveConfig(options);
    assert.strictEqual(result, config);
  });

  test('creates config from data and radius', () => {
    const options = {
      el: '#chart',
      radius: 200,
      data: [{ name: 'A', value: 10 }],
    } as RenderSvgOptions;
    const result = resolveConfig(options);

    assert.equal(result.size.radius, 200);
    assert.equal(result.layers.length, 1);
    assert.equal(result.layers[0].id, 'default');
    assert.equal(result.layers[0].angleMode, 'free');
  });

  test('throws when neither config nor data is provided', () => {
    const options = { el: '#chart' } as RenderSvgOptions;
    assert.throws(() => resolveConfig(options), /requires either `config` or `data`/);
  });

  test('throws when data is provided without radius', () => {
    const options = {
      el: '#chart',
      data: [{ name: 'A' }],
    } as RenderSvgOptions;
    assert.throws(() => resolveConfig(options), /requires `radius` when using `data`/);
  });

  test('handles single node data (not array)', () => {
    const options = {
      el: '#chart',
      radius: 100,
      data: { name: 'Single', value: 5 },
    } as RenderSvgOptions;
    const result = resolveConfig(options);

    assert.ok(Array.isArray(result.layers[0].tree));
    const tree = result.layers[0].tree as any[];
    assert.equal(tree.length, 1);
    assert.equal(tree[0].name, 'Single');
  });

  test('computes correct radialUnits from tree depth', () => {
    const options = {
      el: '#chart',
      radius: 100,
      data: [
        {
          name: 'Root',
          children: [
            {
              name: 'Child',
              children: [
                { name: 'Grandchild' }
              ]
            }
          ]
        }
      ],
    } as RenderSvgOptions;
    const result = resolveConfig(options);
    assert.deepEqual(result.layers[0].radialUnits, [0, 3]);
  });

  test('preserves angle option', () => {
    const options = {
      el: '#chart',
      radius: 100,
      angle: Math.PI,
      data: [{ name: 'A' }],
    } as RenderSvgOptions;
    const result = resolveConfig(options);

    assert.equal(result.size.angle, Math.PI);
  });

  test('handles deeply nested tree', () => {
    const options = {
      el: '#chart',
      radius: 100,
      data: [{
        name: 'L1',
        children: [{
          name: 'L2',
          children: [{
            name: 'L3',
            children: [{
              name: 'L4',
              children: [{ name: 'L5' }]
            }]
          }]
        }]
      }],
    } as RenderSvgOptions;
    const result = resolveConfig(options);

    assert.deepEqual(result.layers[0].radialUnits, [0, 5]);
  });

  test('handles multiple root nodes', () => {
    const options = {
      el: '#chart',
      radius: 100,
      data: [
        { name: 'A', children: [{ name: 'A1' }] },
        { name: 'B' },
        { name: 'C', children: [{ name: 'C1' }, { name: 'C2' }] },
      ],
    } as RenderSvgOptions;
    const result = resolveConfig(options);

    const tree = result.layers[0].tree as any[];
    assert.equal(tree.length, 3);
    assert.deepEqual(result.layers[0].radialUnits, [0, 2]);
  });

  test('accounts for expandLevels in radialUnits', () => {
    const options = {
      el: '#chart',
      radius: 100,
      data: [
        { name: 'A', expandLevels: 2, children: [
          { name: 'A1', expandLevels: 3 }
        ]},
      ],
    } as RenderSvgOptions;
    const result = resolveConfig(options);
    assert.deepEqual(result.layers[0].radialUnits, [0, 5]);
  });

  test('normalizes invalid expandLevels to 1', () => {
    const options = {
      el: '#chart',
      radius: 100,
      data: [
        { name: 'A', expandLevels: 0 },
        { name: 'B', expandLevels: -1 },
      ],
    } as RenderSvgOptions;
    const result = resolveConfig(options);
    assert.deepEqual(result.layers[0].radialUnits, [0, 1]);
  });
});

describe('Simple API - isSunburstConfig', () => {
  test('returns true for valid SunburstConfig', () => {
    const config = {
      size: { radius: 100 },
      layers: [],
    };
    assert.ok(isSunburstConfig(config));
  });

  test('returns false for null', () => {
    assert.ok(!isSunburstConfig(null));
  });

  test('returns false for undefined', () => {
    assert.ok(!isSunburstConfig(undefined));
  });

  test('returns false for primitive values', () => {
    assert.ok(!isSunburstConfig(42));
    assert.ok(!isSunburstConfig('string'));
    assert.ok(!isSunburstConfig(true));
  });

  test('returns false for object missing size', () => {
    assert.ok(!isSunburstConfig({ layers: [] }));
  });

  test('returns false for object missing layers', () => {
    assert.ok(!isSunburstConfig({ size: { radius: 100 } }));
  });

  test('returns false for array', () => {
    assert.ok(!isSunburstConfig([{ size: {}, layers: [] }]));
  });
});

describe('Simple API - computeMaxRadialUnits', () => {
  test('returns 1 for flat array', () => {
    const result = testComputeMaxRadialUnits([{ name: 'A' }, { name: 'B' }]);
    assert.equal(result, 1);
  });

  test('returns 2 for one level of children', () => {
    const result = testComputeMaxRadialUnits([
      { name: 'A', children: [{ name: 'A1' }] }
    ]);
    assert.equal(result, 2);
  });

  test('returns correct depth for unbalanced tree', () => {
    const result = testComputeMaxRadialUnits([
      { name: 'A' },
      { name: 'B', children: [
        { name: 'B1', children: [{ name: 'B1a' }] }
      ]},
      { name: 'C', children: [{ name: 'C1' }] },
    ]);
    assert.equal(result, 3);
  });

  test('handles empty children array', () => {
    const result = testComputeMaxRadialUnits([
      { name: 'A', children: [] }
    ]);
    assert.equal(result, 1);
  });

  test('accounts for expandLevels on nodes', () => {
    const result = testComputeMaxRadialUnits([
      { name: 'A', expandLevels: 2 }
    ]);
    assert.equal(result, 2);
  });

  test('sums expandLevels along path', () => {
    const result = testComputeMaxRadialUnits([
      { name: 'A', expandLevels: 2, children: [
        { name: 'A1', expandLevels: 3 }
      ]}
    ]);
    assert.equal(result, 5);
  });

  test('finds max path with mixed expandLevels', () => {
    const result = testComputeMaxRadialUnits([
      { name: 'A', expandLevels: 1, children: [{ name: 'A1' }] },
      { name: 'B', expandLevels: 3 },
    ]);
    assert.equal(result, 3);
  });

  test('normalizes zero expandLevels to 1', () => {
    const result = testComputeMaxRadialUnits([
      { name: 'A', expandLevels: 0 }
    ]);
    assert.equal(result, 1);
  });

  test('normalizes negative expandLevels to 1', () => {
    const result = testComputeMaxRadialUnits([
      { name: 'A', expandLevels: -5 }
    ]);
    assert.equal(result, 1);
  });
});
