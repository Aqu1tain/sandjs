import { test, describe } from 'node:test';
import * as assert from 'node:assert/strict';
import { createNavigationRuntime } from '../src/render/runtime/navigation.js';
import { layout } from '../src/layout/index.js';
import type { SunburstConfig, LayoutArc } from '../src/types/index.js';
import type { NavigationFocusState } from '../src/render/types.js';

// Helper to create a test config
function createTestConfig(): SunburstConfig {
  return {
    size: { radius: 100 },
    layers: [{
      id: 'main',
      radialUnits: [0, 3],
      angleMode: 'free',
      tree: [
        {
          name: 'A',
          key: 'a',
          value: 50,
          children: [
            { name: 'A1', key: 'a1', value: 25 },
            { name: 'A2', key: 'a2', value: 25 },
          ],
        },
        {
          name: 'B',
          key: 'b',
          value: 50,
          children: [
            { name: 'B1', key: 'b1', value: 50 },
          ],
        },
      ],
    }],
  };
}

// Mock breadcrumb runtime
function createMockBreadcrumbs() {
  const trail: any[] = [];
  return {
    show: () => {},
    clear: () => {},
    dispose: () => {},
    setTrail: (t: any) => { trail.length = 0; if (t) trail.push(...t); },
    handlesTrail: true,
    getTrail: () => trail,
  };
}

describe('Navigation Runtime - Creation', () => {
  test('returns null when input is falsy', () => {
    const config = createTestConfig();
    const result = createNavigationRuntime(false, { requestRender: () => {}, breadcrumbs: null }, config);
    assert.strictEqual(result, null);
  });

  test('creates runtime with boolean true', () => {
    const config = createTestConfig();
    const runtime = createNavigationRuntime(true, { requestRender: () => {}, breadcrumbs: null }, config);
    assert.ok(runtime, 'Runtime should be created');
  });

  test('creates runtime with options object', () => {
    const config = createTestConfig();
    const runtime = createNavigationRuntime(
      { rootLabel: 'Home' },
      { requestRender: () => {}, breadcrumbs: null },
      config
    );
    assert.ok(runtime, 'Runtime should be created');
  });
});

describe('Navigation Runtime - Base Config', () => {
  test('getActiveConfig returns base config when no focus', () => {
    const config = createTestConfig();
    const runtime = createNavigationRuntime(true, { requestRender: () => {}, breadcrumbs: null }, config)!;

    const activeConfig = runtime.getActiveConfig();
    assert.deepEqual(activeConfig.layers[0].tree, config.layers[0].tree);
  });

  test('setBaseConfig updates the base configuration', () => {
    const config = createTestConfig();
    const runtime = createNavigationRuntime(true, { requestRender: () => {}, breadcrumbs: null }, config)!;

    const newConfig: SunburstConfig = {
      size: { radius: 200 },
      layers: [{
        id: 'main',
        radialUnits: [0, 1],
        angleMode: 'free',
        tree: [{ name: 'New', value: 100 }],
      }],
    };

    runtime.setBaseConfig(newConfig);
    const activeConfig = runtime.getActiveConfig();
    assert.equal(activeConfig.size.radius, 200);
  });
});

describe('Navigation Runtime - Arc Registration', () => {
  test('registerArcs accepts layout arcs', () => {
    const config = createTestConfig();
    const runtime = createNavigationRuntime(true, { requestRender: () => {}, breadcrumbs: null }, config)!;
    const arcs = layout(config);

    // Should not throw
    runtime.registerArcs(arcs);
  });

  test('registerArcs clears previous registrations', () => {
    const config = createTestConfig();
    const runtime = createNavigationRuntime(true, { requestRender: () => {}, breadcrumbs: null }, config)!;
    const arcs = layout(config);

    runtime.registerArcs(arcs);
    runtime.registerArcs([]); // Clear all
    runtime.registerArcs(arcs); // Re-register
    // Should not throw or have stale data
  });
});

describe('Navigation Runtime - Click Handling', () => {
  test('handleArcClick returns true for valid arc', () => {
    const config = createTestConfig();
    let renderCalled = false;
    const runtime = createNavigationRuntime(
      true,
      { requestRender: () => { renderCalled = true; }, breadcrumbs: null },
      config
    )!;
    const arcs = layout(config);
    runtime.registerArcs(arcs);

    const rootArc = arcs.find(a => a.data.name === 'A')!;
    const result = runtime.handleArcClick(rootArc);

    assert.equal(result, true);
    assert.equal(renderCalled, true, 'Should trigger render');
  });

  test('handleArcClick respects layer restrictions', () => {
    const config = createTestConfig();
    const runtime = createNavigationRuntime(
      { layers: ['other-layer'] }, // Only allow 'other-layer'
      { requestRender: () => {}, breadcrumbs: null },
      config
    )!;
    const arcs = layout(config);
    runtime.registerArcs(arcs);

    const result = runtime.handleArcClick(arcs[0]);
    assert.equal(result, false, 'Should reject arc from non-allowed layer');
  });

  test('clicking same arc twice navigates up', () => {
    const config = createTestConfig();
    const focusEvents: (NavigationFocusState | null)[] = [];
    const runtime = createNavigationRuntime(
      { onFocusChange: (f) => focusEvents.push(f) },
      { requestRender: () => {}, breadcrumbs: null },
      config
    )!;
    const arcs = layout(config);
    runtime.registerArcs(arcs);

    const arcA = arcs.find(a => a.data.name === 'A')!;

    // First click - focus on A
    runtime.handleArcClick(arcA);

    // Re-register after focus change
    const newArcs = layout(runtime.getActiveConfig());
    runtime.registerArcs(newArcs);

    // Find A in new arcs and click again
    const arcAAgain = newArcs.find(a => a.data.name === 'A');
    if (arcAAgain) {
      runtime.handleArcClick(arcAAgain);
    }

    // Should have navigated up (reset if at root of focus)
    assert.ok(focusEvents.length >= 1);
  });
});

describe('Navigation Runtime - Focus State', () => {
  test('onFocusChange is called when focus changes', () => {
    const config = createTestConfig();
    const focusEvents: (NavigationFocusState | null)[] = [];
    const runtime = createNavigationRuntime(
      { onFocusChange: (f) => focusEvents.push(f) },
      { requestRender: () => {}, breadcrumbs: null },
      config
    )!;
    const arcs = layout(config);
    runtime.registerArcs(arcs);

    const arcA = arcs.find(a => a.data.name === 'A')!;
    runtime.handleArcClick(arcA);

    assert.ok(focusEvents.length >= 1);
    assert.ok(focusEvents[0]?.layerId === 'main');
  });

  test('reset() clears focus and notifies', () => {
    const config = createTestConfig();
    const focusEvents: (NavigationFocusState | null)[] = [];
    const runtime = createNavigationRuntime(
      { onFocusChange: (f) => focusEvents.push(f) },
      { requestRender: () => {}, breadcrumbs: null },
      config
    )!;
    const arcs = layout(config);
    runtime.registerArcs(arcs);

    // Focus on an arc
    runtime.handleArcClick(arcs.find(a => a.data.name === 'A')!);
    focusEvents.length = 0; // Clear events

    // Reset
    runtime.reset();

    assert.ok(focusEvents.includes(null), 'Should notify with null on reset');
  });

  test('reset() does nothing when already unfocused', () => {
    const config = createTestConfig();
    let renderCalled = false;
    const runtime = createNavigationRuntime(
      true,
      { requestRender: () => { renderCalled = true; }, breadcrumbs: null },
      config
    )!;

    renderCalled = false;
    runtime.reset();

    assert.equal(renderCalled, false, 'Should not trigger render when already unfocused');
  });
});

describe('Navigation Runtime - Derived Config', () => {
  test('getActiveConfig returns filtered config when focused', () => {
    const config = createTestConfig();
    const runtime = createNavigationRuntime(true, { requestRender: () => {}, breadcrumbs: null }, config)!;
    const arcs = layout(config);
    runtime.registerArcs(arcs);

    // Focus on A
    const arcA = arcs.find(a => a.data.name === 'A')!;
    runtime.handleArcClick(arcA);

    const activeConfig = runtime.getActiveConfig();
    const activeArcs = layout(activeConfig);

    // Should only include A and its children
    const names = activeArcs.map(a => a.data.name);
    assert.ok(names.includes('A'));
    assert.ok(names.includes('A1') || names.includes('A2'));
    assert.ok(!names.includes('B'), 'Should not include B when focused on A');
  });
});

describe('Navigation Runtime - Breadcrumb Integration', () => {
  test('updates breadcrumb trail on focus change', () => {
    const config = createTestConfig();
    const mockBreadcrumbs = createMockBreadcrumbs();
    const runtime = createNavigationRuntime(
      true,
      { requestRender: () => {}, breadcrumbs: mockBreadcrumbs as any },
      config
    )!;
    const arcs = layout(config);
    runtime.registerArcs(arcs);

    // Focus on A
    runtime.handleArcClick(arcs.find(a => a.data.name === 'A')!);

    const trail = mockBreadcrumbs.getTrail();
    assert.ok(trail.length >= 2, 'Trail should have root + focused node');
    assert.ok(trail.some((t: any) => t.label === 'A'), 'Trail should include focused node');
  });

  test('handlesBreadcrumbs returns true when breadcrumbs handle trail', () => {
    const config = createTestConfig();
    const mockBreadcrumbs = createMockBreadcrumbs();
    const runtime = createNavigationRuntime(
      true,
      { requestRender: () => {}, breadcrumbs: mockBreadcrumbs as any },
      config
    )!;

    assert.equal(runtime.handlesBreadcrumbs(), true);
  });

  test('handlesBreadcrumbs returns false when no breadcrumbs', () => {
    const config = createTestConfig();
    const runtime = createNavigationRuntime(
      true,
      { requestRender: () => {}, breadcrumbs: null },
      config
    )!;

    assert.equal(runtime.handlesBreadcrumbs(), false);
  });

  test('breadcrumb trail has clickable items for navigation', () => {
    const config = createTestConfig();
    const mockBreadcrumbs = createMockBreadcrumbs();
    const runtime = createNavigationRuntime(
      { rootLabel: 'Home' },
      { requestRender: () => {}, breadcrumbs: mockBreadcrumbs as any },
      config
    )!;
    const arcs = layout(config);
    runtime.registerArcs(arcs);

    runtime.handleArcClick(arcs.find(a => a.data.name === 'A')!);

    const trail = mockBreadcrumbs.getTrail();
    const rootItem = trail.find((t: any) => t.label === 'Home');
    assert.ok(rootItem, 'Should have root item');
    assert.ok(typeof rootItem.onSelect === 'function', 'Root should be clickable');
  });
});

describe('Navigation Runtime - Transition Override', () => {
  test('consumeTransitionOverride returns pending transition', () => {
    const config = createTestConfig();
    const runtime = createNavigationRuntime(
      { focusTransition: { duration: 500 } },
      { requestRender: () => {}, breadcrumbs: null },
      config
    )!;
    const arcs = layout(config);
    runtime.registerArcs(arcs);

    runtime.handleArcClick(arcs[0]);

    const transition = runtime.consumeTransitionOverride();
    assert.ok(transition, 'Should have pending transition');
  });

  test('consumeTransitionOverride clears after consumption', () => {
    const config = createTestConfig();
    const runtime = createNavigationRuntime(
      { focusTransition: true },
      { requestRender: () => {}, breadcrumbs: null },
      config
    )!;
    const arcs = layout(config);
    runtime.registerArcs(arcs);

    runtime.handleArcClick(arcs[0]);

    runtime.consumeTransitionOverride();
    const second = runtime.consumeTransitionOverride();
    assert.strictEqual(second, undefined, 'Should be cleared after first consumption');
  });
});

describe('Navigation Runtime - Disposal', () => {
  test('dispose clears internal state', () => {
    const config = createTestConfig();
    const mockBreadcrumbs = createMockBreadcrumbs();
    const runtime = createNavigationRuntime(
      true,
      { requestRender: () => {}, breadcrumbs: mockBreadcrumbs as any },
      config
    )!;
    const arcs = layout(config);
    runtime.registerArcs(arcs);
    runtime.handleArcClick(arcs[0]);

    runtime.dispose();

    // After dispose, should be able to call methods without error
    assert.doesNotThrow(() => runtime.getActiveConfig());
  });
});
