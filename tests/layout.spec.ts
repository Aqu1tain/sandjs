import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { layout } from '../src/index.js';
import type { SunburstConfig } from '../src/index.js';

const TOLERANCE = 1e-6;

function roughlyEqual(a: number, b: number, tolerance = TOLERANCE) {
  assert.ok(Math.abs(a - b) <= tolerance, `Expected ${a} to be within ${tolerance} of ${b}`);
}

test('layout computes arcs for free layers using value weights', () => {
  const config: SunburstConfig = {
    size: { radius: 90 },
    layers: [
      {
        id: 'root',
        radialUnits: [0, 3],
        angleMode: 'free',
        tree: [
          { name: 'A', value: 2 },
          { name: 'B', value: 1 },
        ],
      },
    ],
  };

  const arcs = layout(config);
  assert.equal(arcs.length, 2);

  const [first, second] = arcs;
  assert.equal(first.layerId, 'root');
  assert.equal(first.depth, 0);
  roughlyEqual(first.y0, 0);
  roughlyEqual(first.y1, 30); // 90 radius / 3 units * 1 level
  roughlyEqual(first.percentage, 2 / 3);

  assert.equal(second.layerId, 'root');
  assert.equal(second.depth, 0);
  roughlyEqual(second.y0, 0);
  roughlyEqual(second.y1, 30);
  roughlyEqual(second.percentage, 1 / 3);

  roughlyEqual(first.x1 - first.x0, (2 / 3) * Math.PI * 2);
  roughlyEqual(second.x1 - second.x0, (1 / 3) * Math.PI * 2);
});

test('aligned layers inherit start and end angles from the source layer', () => {
  const config: SunburstConfig = {
    size: { radius: 120 },
    layers: [
      {
        id: 'base',
        radialUnits: [0, 2],
        angleMode: 'free',
        tree: [
          { name: 'Red', value: 1, key: 'red' },
          { name: 'Blue', value: 1, key: 'blue' },
        ],
      },
      {
        id: 'detail',
        radialUnits: [2, 5],
        angleMode: 'align',
        alignWith: 'base',
        tree: [
          {
            name: 'Red detail',
            key: 'red',
            value: 3,
            expandLevels: 2,
            children: [
              { name: 'Red/A', value: 2 },
              { name: 'Red/B', value: 1 },
            ],
          },
        ],
      },
    ],
  };

  const arcs = layout(config);
  const baseArcs = arcs.filter((arc) => arc.layerId === 'base');
  const detailArcs = arcs.filter((arc) => arc.layerId === 'detail');

  assert.equal(baseArcs.length, 2);
  assert.equal(detailArcs.length, 3); // root + two children

  const redBase = baseArcs[0];
  const redDetailRoot = detailArcs.find((arc) => arc.depth === 0);
  assert.ok(redDetailRoot, 'expected detail layer to include a root arc');
  roughlyEqual(redDetailRoot!.x0, redBase.x0);
  roughlyEqual(redDetailRoot!.x1, redBase.x1);

  const [firstChild, secondChild] = detailArcs.filter((arc) => arc.depth === 1);
  assert.ok(firstChild && secondChild, 'expected aligned children to be emitted');
  assert.ok(firstChild.x0 >= redBase.x0 && firstChild.x1 <= redBase.x1);
  assert.ok(secondChild.x0 >= redBase.x0 && secondChild.x1 <= redBase.x1);
});

test('aligned layers throw when references are misconfigured', () => {
  const config: SunburstConfig = {
    size: { radius: 80 },
    layers: [
      {
        id: 'base',
        radialUnits: [0, 1],
        angleMode: 'free',
        tree: [{ name: 'Solo', value: 1 }],
      },
      {
        id: 'broken',
        radialUnits: [1, 2],
        angleMode: 'align',
        alignWith: 'base',
        tree: [{ name: 'Missing key', value: 1 }],
      },
    ],
  };

  assert.throws(() => layout(config), /does not expose keyed root arcs/);
});

test('relative offsets shift arc start angles using defaults and overrides', () => {
  const config: SunburstConfig = {
    size: { radius: 50 },
    layers: [
      {
        id: 'offsets',
        radialUnits: [0, 1],
        angleMode: 'free',
        padAngle: 0.4,
        defaultArcOffset: 0.2,
        arcOffsetMode: 'relative',
        tree: [
          { name: 'A', value: 1 },
          { name: 'B', value: 1, offset: -0.1 },
        ],
      },
    ],
  };

  const arcs = layout(config);
  assert.equal(arcs.length, 2);
  roughlyEqual(arcs[0].x0, 0.4);
  roughlyEqual(arcs[1].x0, Math.PI - 0.13415926535897926);
});

test('absolute offsets ignore the allocated slot', () => {
  const config: SunburstConfig = {
    size: { radius: 40 },
    layers: [
      {
        id: 'absolute',
        radialUnits: [0, 1],
        angleMode: 'free',
        padAngle: 0.4,
        arcOffsetMode: 'absolute',
        defaultArcOffset: 1,
        tree: [
          { name: 'First', value: 1 },
          { name: 'Second', value: 1, offset: 2 },
        ],
      },
    ],
  };

  const arcs = layout(config);
  assert.equal(arcs.length, 2);
  roughlyEqual(arcs[0].x0, 0.4);
  roughlyEqual(arcs[1].x0, Math.PI + 0.2);
});

test('aligned roots occupy the full aligned interval', () => {
  const config: SunburstConfig = {
    size: { radius: 100 },
    layers: [
      {
        id: 'base',
        radialUnits: [0, 1],
        angleMode: 'free',
        tree: [
          { name: 'Left', value: 1, key: 'left' },
          { name: 'Right', value: 1, key: 'right' },
        ],
      },
      {
        id: 'aligned',
        radialUnits: [1, 2],
        angleMode: 'align',
        alignWith: 'base',
        tree: [{ name: 'Left detail', key: 'left', value: 1 }],
      },
    ],
  };

  const arcs = layout(config).filter((arc) => arc.layerId === 'aligned');
  assert.equal(arcs.length, 1);
  roughlyEqual(arcs[0].percentage, 1);
  roughlyEqual(arcs[0].x0, 0);
  roughlyEqual(arcs[0].x1, Math.PI);
});

test('align fallback normalizes base offset for free layout', () => {
  const config: SunburstConfig = {
    size: { radius: 80 },
    layers: [
      {
        id: 'base',
        radialUnits: [0, 1],
        angleMode: 'free',
        tree: [{ name: 'Solo', value: 1, key: 'solo' }],
      },
      {
        id: 'aligned-free',
        radialUnits: [1, 2],
        angleMode: 'align',
        alignWith: 'base',
        padAngle: Math.PI * 4,
        baseOffset: Math.PI * 3 + 0.5,
        tree: [{ name: 'Solo detail', value: 2, key: 'solo' }],
      },
    ],
  };

  const arcs = layout(config).filter((arc) => arc.layerId === 'aligned-free');
  assert.equal(arcs.length, 1);
  roughlyEqual(arcs[0].x0, Math.PI + 0.5);
});
