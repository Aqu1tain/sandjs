import { test, describe, mock } from 'node:test';
import * as assert from 'node:assert/strict';
import { layout, renderSVG } from '../src/index.js';
import type { SunburstConfig, TreeNodeInput } from '../src/index.js';
import { normalizeTree } from '../src/layout/normalization.js';

const TOLERANCE = 1e-6;

function roughlyEqual(a: number, b: number, tolerance = TOLERANCE) {
  assert.ok(Math.abs(a - b) <= tolerance, `Expected ${a} to be within ${tolerance} of ${b}`);
}

// Stub elements for renderSVG tests
class StubElement {
  public attributes = new Map<string, string>();
  public children: StubElement[] = [];
  public parentNode: StubElement | null = null;
  public textContent = '';
  public firstChild: StubElement | null = null;
  public style: Record<string, string> = {};
  public classList = {
    add: () => {},
    remove: () => {},
    toggle: () => {},
  };
  public dataset: Record<string, string>;
  public listeners: Record<string, Array<(event: any) => void>> = {};
  private _innerHTML = '';

  constructor(public tagName: string) {
    const self = this;
    this.dataset = new Proxy({} as Record<string, string>, {
      set(target, prop: string, value: string) {
        target[prop] = value;
        self.attributes.set(`data-${prop}`, value);
        return true;
      },
      deleteProperty(target, prop: string) {
        delete target[prop];
        self.attributes.delete(`data-${prop}`);
        return true;
      },
    });
  }

  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
    if (name.startsWith('data-')) {
      this.dataset[name.slice(5)] = value;
    }
  }

  setAttributeNS(_namespace: string | null, name: string, value: string) {
    this.setAttribute(name, value);
  }

  set innerHTML(value: string) {
    this._innerHTML = value;
    this.children = [];
    this.firstChild = null;
    this.textContent = value;
  }

  get innerHTML(): string {
    return this._innerHTML;
  }

  removeAttribute(name: string) {
    this.attributes.delete(name);
    if (name.startsWith('data-')) {
      delete this.dataset[name.slice(5)];
    }
  }

  appendChild<T extends StubElement>(child: T): T {
    child.parentNode = this;
    this.children.push(child);
    this.firstChild = this.children[0] ?? null;
    return child;
  }

  removeChild(child: StubElement): StubElement {
    const index = this.children.indexOf(child);
    if (index !== -1) {
      this.children.splice(index, 1);
      child.parentNode = null;
    }
    this.firstChild = this.children[0] ?? null;
    return child;
  }

  remove(): void {
    if (!this.parentNode) return;
    this.parentNode.removeChild(this);
  }

  addEventListener(type: string, handler: (event: any) => void): void {
    if (!this.listeners[type]) {
      this.listeners[type] = [];
    }
    this.listeners[type].push(handler);
  }

  removeEventListener(type: string, handler: (event: any) => void): void {
    const list = this.listeners[type];
    if (!list) return;
    const index = list.indexOf(handler);
    if (index !== -1) {
      list.splice(index, 1);
    }
  }

  querySelector(selector: string): StubElement | null {
    const matchAttr = selector.startsWith('[') && selector.endsWith(']')
      ? selector.slice(1, -1)
      : null;
    if (!matchAttr) return null;
    const [attr] = matchAttr.split('=');
    return (
      this.children.find((child) => child.attributes.has(attr)) ??
      this.children.reduce<StubElement | null>((found, child) => found ?? child.querySelector(selector), null)
    );
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  get childNodes(): StubElement[] {
    return this.children;
  }

  insertBefore<T extends StubElement>(newChild: T, refChild: StubElement | null): T {
    if (!refChild || !this.children.includes(refChild)) {
      return this.appendChild(newChild);
    }
    const index = this.children.indexOf(refChild);
    this.children.splice(index, 0, newChild);
    newChild.parentNode = this;
    this.firstChild = this.children[0] ?? null;
    return newChild;
  }
}

class StubSVGElement extends StubElement {}

class StubSVGDefsElement extends StubSVGElement {
  constructor() {
    super('defs');
  }
}

class StubDocument {
  public body = new StubElement('body');

  createElementNS(_ns: string, tag: string) {
    if (tag === 'defs') {
      return new StubSVGDefsElement();
    }
    return new StubSVGElement(tag);
  }

  createElement(tag: string) {
    return new StubElement(tag);
  }

  querySelector(): null {
    return null;
  }
}

// Ensure global SVG classes exist for instanceof checks.
(globalThis as any).SVGElement = StubSVGElement;
(globalThis as any).SVGDefsElement = StubSVGDefsElement;

// =============================================================================
// Detection Tests
// =============================================================================

describe('Multi-parent detection', () => {
  test('isMultiParentNode identifies nodes with 2+ parents', () => {
    const tree: TreeNodeInput[] = [
      { name: 'Parent A', key: 'a', value: 30 },
      { name: 'Parent B', key: 'b', value: 30 },
      { name: 'Multi-parent child', value: 20, parents: ['a', 'b'] },
    ];

    const result = normalizeTree(tree);
    assert.equal(result.nodes.length, 2, 'Regular nodes should be in nodes array');
    assert.equal(result.multiParentGroups.length, 1, 'Multi-parent nodes should be extracted');
    assert.deepEqual(result.multiParentGroups[0].parentKeys, ['a', 'b']);
  });

  test('returns false for nodes without parents property', () => {
    const tree: TreeNodeInput[] = [
      { name: 'Normal node A', value: 50 },
      { name: 'Normal node B', value: 50 },
    ];

    const result = normalizeTree(tree);
    assert.equal(result.nodes.length, 2);
    assert.equal(result.multiParentGroups.length, 0);
  });

  test('returns false for nodes with single parent or empty array', () => {
    const tree: TreeNodeInput[] = [
      { name: 'Single parent', value: 30, parents: ['a'] },
      { name: 'Empty parents', value: 30, parents: [] },
      { name: 'Normal', value: 40 },
    ];

    const result = normalizeTree(tree);
    // Single parent and empty parents are NOT multi-parent nodes
    // They should be treated as normal nodes
    assert.equal(result.nodes.length, 3, 'All nodes should be in nodes array');
    assert.equal(result.multiParentGroups.length, 0, 'No multi-parent groups');
  });
});

// =============================================================================
// Normalization Tests
// =============================================================================

describe('Multi-parent normalization', () => {
  test('multi-parent nodes are extracted into separate groups', () => {
    const tree: TreeNodeInput[] = [
      { name: 'Eng', key: 'eng', value: 40 },
      { name: 'Design', key: 'design', value: 30 },
      { name: 'Product', key: 'product', value: 30 },
      { name: 'Frontend Team', value: 25, parents: ['eng', 'design'] },
    ];

    const result = normalizeTree(tree);
    assert.equal(result.nodes.length, 3, 'Regular nodes extracted');
    assert.equal(result.multiParentGroups.length, 1, 'Multi-parent group created');
    assert.equal(result.multiParentGroups[0].children.length, 1);
    assert.equal(result.multiParentGroups[0].children[0].input.name, 'Frontend Team');
  });

  test('nodes with same parent keys are grouped together', () => {
    const tree: TreeNodeInput[] = [
      { name: 'Eng', key: 'eng', value: 40 },
      { name: 'Design', key: 'design', value: 30 },
      { name: 'Frontend Team', value: 25, parents: ['eng', 'design'] },
      { name: 'Shared Tools', value: 20, parents: ['eng', 'design'] },
    ];

    const result = normalizeTree(tree);
    assert.equal(result.multiParentGroups.length, 1, 'Same parents = same group');
    assert.equal(result.multiParentGroups[0].children.length, 2);
  });

  test('nodes with different parent combinations are in separate groups', () => {
    const tree: TreeNodeInput[] = [
      { name: 'Eng', key: 'eng', value: 30 },
      { name: 'Design', key: 'design', value: 30 },
      { name: 'Product', key: 'product', value: 30 },
      { name: 'Frontend', value: 15, parents: ['eng', 'design'] },
      { name: 'Growth', value: 15, parents: ['product', 'design'] },
    ];

    const result = normalizeTree(tree);
    assert.equal(result.multiParentGroups.length, 2, 'Different parents = different groups');
  });

  test('non-multi-parent siblings remain in normal tree', () => {
    const tree: TreeNodeInput[] = [
      { name: 'Eng', key: 'eng', value: 40, children: [{ name: 'Eng-child', value: 10 }] },
      { name: 'Design', key: 'design', value: 30 },
      { name: 'Multi', value: 20, parents: ['eng', 'design'] },
    ];

    const result = normalizeTree(tree);
    const engNode = result.nodes.find(n => n.input.name === 'Eng');
    assert.ok(engNode, 'Eng should be in normal tree');
    assert.equal(engNode!.children.length, 1, 'Eng children preserved');
    assert.equal(engNode!.children[0].input.name, 'Eng-child');
  });

  test('nested multi-parent nodes work within subtrees', () => {
    const tree: TreeNodeInput = {
      name: 'Root',
      children: [
        { name: 'Team1', key: 'team1', value: 30 },
        { name: 'Team2', key: 'team2', value: 20 },
        { name: 'Shared', value: 15, parents: ['team1', 'team2'] },
      ],
    };

    const result = normalizeTree(tree);
    // Root should be processed, and nested multi-parent should be extracted
    assert.equal(result.nodes.length, 1, 'Root is in nodes');
    assert.equal(result.multiParentGroups.length, 1, 'Nested multi-parent group extracted');
  });
});

// =============================================================================
// Validation Tests
// =============================================================================

describe('Multi-parent validation', () => {
  test('warns when parent key does not exist', () => {
    const originalWarn = console.warn;
    const warnings: string[] = [];
    console.warn = (...args: any[]) => warnings.push(args.join(' '));

    try {
      const config: SunburstConfig = {
        size: { radius: 100 },
        layers: [
          {
            id: 'main',
            radialUnits: [0, 2],
            angleMode: 'free',
            tree: [
              { name: 'Existing', key: 'existing', value: 50 },
              { name: 'Multi', value: 30, parents: ['existing', 'nonexistent'] },
            ],
          },
        ],
      };

      layout(config);

      const relevantWarning = warnings.find(w => w.includes('missing parent arcs'));
      assert.ok(relevantWarning, 'Should warn about missing parent keys');
      assert.ok(relevantWarning!.includes('nonexistent'), 'Warning should mention missing key');
    } finally {
      console.warn = originalWarn;
    }
  });

  test('warns when all parent keys are missing', () => {
    const originalWarn = console.warn;
    const warnings: string[] = [];
    console.warn = (...args: any[]) => warnings.push(args.join(' '));

    try {
      const config: SunburstConfig = {
        size: { radius: 100 },
        layers: [
          {
            id: 'main',
            radialUnits: [0, 2],
            angleMode: 'free',
            tree: [
              { name: 'Node', value: 50 },
              { name: 'Multi', value: 30, parents: ['a', 'b'] },
            ],
          },
        ],
      };

      layout(config);

      const relevantWarning = warnings.find(w => w.includes('non-existent parent keys'));
      assert.ok(relevantWarning, 'Should warn about non-existent parent keys');
    } finally {
      console.warn = originalWarn;
    }
  });

  test('skips group when parent node has children (critical constraint)', () => {
    const originalError = console.error;
    const originalWarn = console.warn;
    const errors: string[] = [];
    console.error = (...args: any[]) => errors.push(args.join(' '));
    console.warn = () => {}; // Suppress other warnings

    try {
      const config: SunburstConfig = {
        size: { radius: 100 },
        layers: [
          {
            id: 'main',
            radialUnits: [0, 3],
            angleMode: 'free',
            tree: [
              {
                name: 'Parent With Children',
                key: 'parent-a',
                children: [{ name: 'Child', value: 20 }],
              },
              { name: 'Parent B', key: 'parent-b', value: 30 },
              { name: 'Multi', value: 25, parents: ['parent-a', 'parent-b'] },
            ],
          },
        ],
      };

      const arcs = layout(config);

      // Should have an error logged
      const validationError = errors.find(e => e.includes('Multi-parent validation failed'));
      assert.ok(validationError, 'Should log validation error');
      assert.ok(validationError!.includes('parent-a'), 'Error should mention the offending key');

      // Multi-parent child should NOT be rendered
      const multiArc = arcs.find(arc => arc.data.name === 'Multi');
      assert.equal(multiArc, undefined, 'Multi-parent child should be skipped');

      // Normal arcs should still render
      const parentArc = arcs.find(arc => arc.data.name === 'Parent With Children');
      assert.ok(parentArc, 'Normal parent should render');
    } finally {
      console.error = originalError;
      console.warn = originalWarn;
    }
  });
});

// =============================================================================
// Layout Tests
// =============================================================================

describe('Multi-parent layout', () => {
  test('multi-parent child spans angular range of all parents (x0 to x1)', () => {
    const originalWarn = console.warn;
    console.warn = () => {}; // Suppress experimental warning

    try {
      const config: SunburstConfig = {
        size: { radius: 100 },
        layers: [
          {
            id: 'main',
            radialUnits: [0, 2],
            angleMode: 'free',
            tree: [
              { name: 'A', key: 'a', value: 50 },
              { name: 'B', key: 'b', value: 50 },
              { name: 'Multi', value: 30, parents: ['a', 'b'] },
            ],
          },
        ],
      };

      const arcs = layout(config);
      const arcA = arcs.find(arc => arc.data.name === 'A');
      const arcB = arcs.find(arc => arc.data.name === 'B');
      const multiArc = arcs.find(arc => arc.data.name === 'Multi');

      assert.ok(arcA && arcB && multiArc, 'All arcs should be present');

      // Multi-parent arc should span from min(parents.x0) to max(parents.x1)
      const expectedStart = Math.min(arcA!.x0, arcB!.x0);
      const expectedEnd = Math.max(arcA!.x1, arcB!.x1);

      roughlyEqual(multiArc!.x0, expectedStart);
      roughlyEqual(multiArc!.x1, expectedEnd);
    } finally {
      console.warn = originalWarn;
    }
  });

  test('child positioned at correct radial depth (y0, y1)', () => {
    const originalWarn = console.warn;
    console.warn = () => {};

    try {
      const config: SunburstConfig = {
        size: { radius: 100 },
        layers: [
          {
            id: 'main',
            radialUnits: [0, 2],
            angleMode: 'free',
            tree: [
              { name: 'A', key: 'a', value: 50 },
              { name: 'B', key: 'b', value: 50 },
              { name: 'Multi', value: 30, parents: ['a', 'b'] },
            ],
          },
        ],
      };

      const arcs = layout(config);
      const arcA = arcs.find(arc => arc.data.name === 'A');
      const multiArc = arcs.find(arc => arc.data.name === 'Multi');

      assert.ok(arcA && multiArc, 'Arcs should be present');

      // Multi-parent arc should start at parent's outer radius
      roughlyEqual(multiArc!.y0, arcA!.y1);
      // Multi-parent arc should have proper thickness
      assert.ok(multiArc!.y1 > multiArc!.y0, 'Multi-parent arc should have positive thickness');
    } finally {
      console.warn = originalWarn;
    }
  });

  test('multiple children sharing same parents divide the span', () => {
    const originalWarn = console.warn;
    console.warn = () => {};

    try {
      const config: SunburstConfig = {
        size: { radius: 100 },
        layers: [
          {
            id: 'main',
            radialUnits: [0, 2],
            angleMode: 'free',
            tree: [
              { name: 'A', key: 'a', value: 50 },
              { name: 'B', key: 'b', value: 50 },
              { name: 'Multi1', value: 30, parents: ['a', 'b'] },
              { name: 'Multi2', value: 30, parents: ['a', 'b'] },
            ],
          },
        ],
      };

      const arcs = layout(config);
      const multi1 = arcs.find(arc => arc.data.name === 'Multi1');
      const multi2 = arcs.find(arc => arc.data.name === 'Multi2');

      assert.ok(multi1 && multi2, 'Both multi-parent arcs should be present');

      // They should divide the parent span equally (same value = 50% each)
      roughlyEqual(multi1!.percentage, 0.5);
      roughlyEqual(multi2!.percentage, 0.5);

      // multi1 should end where multi2 starts
      roughlyEqual(multi1!.x1, multi2!.x0);
    } finally {
      console.warn = originalWarn;
    }
  });

  test('padAngle applied between multi-parent siblings', () => {
    const originalWarn = console.warn;
    console.warn = () => {};

    try {
      const padAngle = 0.1;
      const config: SunburstConfig = {
        size: { radius: 100 },
        layers: [
          {
            id: 'main',
            radialUnits: [0, 2],
            angleMode: 'free',
            padAngle,
            tree: [
              { name: 'A', key: 'a', value: 50 },
              { name: 'B', key: 'b', value: 50 },
              { name: 'Multi1', value: 30, parents: ['a', 'b'] },
              { name: 'Multi2', value: 30, parents: ['a', 'b'] },
            ],
          },
        ],
      };

      const arcs = layout(config);
      const multi1 = arcs.find(arc => arc.data.name === 'Multi1');
      const multi2 = arcs.find(arc => arc.data.name === 'Multi2');

      assert.ok(multi1 && multi2, 'Both arcs should be present');

      // There should be a gap between multi1's end and multi2's start
      const gap = multi2!.x0 - multi1!.x1;
      roughlyEqual(gap, padAngle);
    } finally {
      console.warn = originalWarn;
    }
  });

  test('multi-parent arc depth is one more than parent depth', () => {
    const originalWarn = console.warn;
    console.warn = () => {};

    try {
      const config: SunburstConfig = {
        size: { radius: 100 },
        layers: [
          {
            id: 'main',
            radialUnits: [0, 2],
            angleMode: 'free',
            tree: [
              { name: 'A', key: 'a', value: 50 },
              { name: 'B', key: 'b', value: 50 },
              { name: 'Multi', value: 30, parents: ['a', 'b'] },
            ],
          },
        ],
      };

      const arcs = layout(config);
      const arcA = arcs.find(arc => arc.data.name === 'A');
      const multiArc = arcs.find(arc => arc.data.name === 'Multi');

      assert.ok(arcA && multiArc, 'Arcs should be present');
      assert.equal(multiArc!.depth, arcA!.depth + 1, 'Multi-parent depth should be parent depth + 1');
    } finally {
      console.warn = originalWarn;
    }
  });
});

// =============================================================================
// Integration Test
// =============================================================================

describe('Multi-parent integration', () => {
  test('full render with renderSVG() produces correct DOM output', () => {
    const document = new StubDocument();
    const hostStub = new StubSVGElement('svg');
    const originalWarn = console.warn;
    console.warn = () => {}; // Suppress experimental warning

    try {
      const config: SunburstConfig = {
        size: { radius: 100 },
        layers: [
          {
            id: 'main',
            radialUnits: [0, 2],
            angleMode: 'free',
            tree: [
              { name: 'Engineering', key: 'eng', value: 40 },
              { name: 'Design', key: 'design', value: 30 },
              { name: 'Product', key: 'product', value: 30 },
              { name: 'Frontend Team', value: 25, parents: ['eng', 'design'] },
              { name: 'Shared Tools', value: 20, parents: ['eng', 'design'] },
            ],
          },
        ],
      };

      const chart = renderSVG({
        el: hostStub as unknown as SVGElement,
        config,
        document: document as unknown as Document,
      });

      // Should render 3 root nodes + 2 multi-parent children = 5 arcs
      assert.equal(chart.length, 5, 'Should render all arcs');

      const paths = hostStub.children.filter(c => c.tagName === 'path');
      assert.equal(paths.length, 5, 'Should create path elements for all arcs');

      // Verify arc names
      const arcNames = chart.map(arc => arc.data.name);
      assert.ok(arcNames.includes('Engineering'));
      assert.ok(arcNames.includes('Design'));
      assert.ok(arcNames.includes('Product'));
      assert.ok(arcNames.includes('Frontend Team'));
      assert.ok(arcNames.includes('Shared Tools'));

      // Multi-parent arcs should have depth 1
      const frontendArc = chart.find(arc => arc.data.name === 'Frontend Team');
      const sharedArc = chart.find(arc => arc.data.name === 'Shared Tools');
      assert.equal(frontendArc!.depth, 1);
      assert.equal(sharedArc!.depth, 1);

      chart.destroy();
    } finally {
      console.warn = originalWarn;
    }
  });

  test('multi-parent with nested structure renders correctly', () => {
    const document = new StubDocument();
    const hostStub = new StubSVGElement('svg');
    const originalWarn = console.warn;
    console.warn = () => {};

    try {
      const config: SunburstConfig = {
        size: { radius: 100 },
        layers: [
          {
            id: 'main',
            radialUnits: [0, 3],
            angleMode: 'free',
            tree: {
              name: 'Company',
              children: [
                { name: 'Team1', key: 'team1', value: 30 },
                { name: 'Team2', key: 'team2', value: 20 },
                { name: 'Shared Resource', value: 15, parents: ['team1', 'team2'] },
              ],
            },
          },
        ],
      };

      const chart = renderSVG({
        el: hostStub as unknown as SVGElement,
        config,
        document: document as unknown as Document,
      });

      // Should render: Company, Team1, Team2, Shared Resource = 4 arcs
      assert.equal(chart.length, 4, 'Should render nested structure with multi-parent');

      const sharedArc = chart.find(arc => arc.data.name === 'Shared Resource');
      assert.ok(sharedArc, 'Shared resource should be rendered');

      // Shared resource should be at depth 2 (Company -> Teams -> Shared)
      assert.equal(sharedArc!.depth, 2);

      chart.destroy();
    } finally {
      console.warn = originalWarn;
    }
  });

  test('update() works with multi-parent configurations', () => {
    const document = new StubDocument();
    const hostStub = new StubSVGElement('svg');
    const originalWarn = console.warn;
    console.warn = () => {};

    try {
      const initialConfig: SunburstConfig = {
        size: { radius: 100 },
        layers: [
          {
            id: 'main',
            radialUnits: [0, 2],
            angleMode: 'free',
            tree: [
              { name: 'A', key: 'a', value: 50 },
              { name: 'B', key: 'b', value: 50 },
            ],
          },
        ],
      };

      const chart = renderSVG({
        el: hostStub as unknown as SVGElement,
        config: initialConfig,
        document: document as unknown as Document,
      });

      assert.equal(chart.length, 2, 'Initial render should have 2 arcs');

      // Update to include multi-parent node
      const updatedConfig: SunburstConfig = {
        size: { radius: 100 },
        layers: [
          {
            id: 'main',
            radialUnits: [0, 2],
            angleMode: 'free',
            tree: [
              { name: 'A', key: 'a', value: 50 },
              { name: 'B', key: 'b', value: 50 },
              { name: 'Multi', value: 30, parents: ['a', 'b'] },
            ],
          },
        ],
      };

      chart.update(updatedConfig);
      assert.equal(chart.length, 3, 'After update should have 3 arcs including multi-parent');

      const multiArc = chart.find(arc => arc.data.name === 'Multi');
      assert.ok(multiArc, 'Multi-parent arc should be present after update');

      chart.destroy();
    } finally {
      console.warn = originalWarn;
    }
  });
});

// =============================================================================
// Edge Cases
// =============================================================================

describe('Multi-parent edge cases', () => {
  test('handles multiple separate multi-parent groups', () => {
    const originalWarn = console.warn;
    console.warn = () => {};

    try {
      const config: SunburstConfig = {
        size: { radius: 100 },
        layers: [
          {
            id: 'main',
            radialUnits: [0, 2],
            angleMode: 'free',
            tree: [
              { name: 'A', key: 'a', value: 25 },
              { name: 'B', key: 'b', value: 25 },
              { name: 'C', key: 'c', value: 25 },
              { name: 'D', key: 'd', value: 25 },
              { name: 'Multi-AB', value: 20, parents: ['a', 'b'] },
              { name: 'Multi-CD', value: 20, parents: ['c', 'd'] },
            ],
          },
        ],
      };

      const arcs = layout(config);

      // Should have 4 parents + 2 multi-parent = 6 arcs
      assert.equal(arcs.length, 6);

      const multiAB = arcs.find(arc => arc.data.name === 'Multi-AB');
      const multiCD = arcs.find(arc => arc.data.name === 'Multi-CD');

      assert.ok(multiAB && multiCD, 'Both multi-parent groups should render');

      // Multi-AB should span A and B
      const arcA = arcs.find(arc => arc.data.name === 'A');
      const arcB = arcs.find(arc => arc.data.name === 'B');
      roughlyEqual(multiAB!.x0, Math.min(arcA!.x0, arcB!.x0));
      roughlyEqual(multiAB!.x1, Math.max(arcA!.x1, arcB!.x1));

      // Multi-CD should span C and D
      const arcC = arcs.find(arc => arc.data.name === 'C');
      const arcD = arcs.find(arc => arc.data.name === 'D');
      roughlyEqual(multiCD!.x0, Math.min(arcC!.x0, arcD!.x0));
      roughlyEqual(multiCD!.x1, Math.max(arcC!.x1, arcD!.x1));
    } finally {
      console.warn = originalWarn;
    }
  });

  test('non-adjacent parents work correctly', () => {
    const originalWarn = console.warn;
    console.warn = () => {};

    try {
      const config: SunburstConfig = {
        size: { radius: 100 },
        layers: [
          {
            id: 'main',
            radialUnits: [0, 2],
            angleMode: 'free',
            tree: [
              { name: 'A', key: 'a', value: 33 },
              { name: 'B', key: 'b', value: 34 },
              { name: 'C', key: 'c', value: 33 },
              // Parents are A and C, which are NOT adjacent (B is in between)
              { name: 'Multi-AC', value: 20, parents: ['a', 'c'] },
            ],
          },
        ],
      };

      const arcs = layout(config);
      const multiArc = arcs.find(arc => arc.data.name === 'Multi-AC');
      const arcA = arcs.find(arc => arc.data.name === 'A');
      const arcC = arcs.find(arc => arc.data.name === 'C');

      assert.ok(multiArc && arcA && arcC, 'Arcs should be present');

      // Multi-parent should span from A's start to C's end (including B's span)
      roughlyEqual(multiArc!.x0, arcA!.x0);
      roughlyEqual(multiArc!.x1, arcC!.x1);
    } finally {
      console.warn = originalWarn;
    }
  });

  test('parent key order does not affect grouping', () => {
    const tree1: TreeNodeInput[] = [
      { name: 'A', key: 'a', value: 50 },
      { name: 'B', key: 'b', value: 50 },
      { name: 'Multi', value: 30, parents: ['a', 'b'] },
    ];

    const tree2: TreeNodeInput[] = [
      { name: 'A', key: 'a', value: 50 },
      { name: 'B', key: 'b', value: 50 },
      { name: 'Multi', value: 30, parents: ['b', 'a'] },  // Reversed order
    ];

    const result1 = normalizeTree(tree1);
    const result2 = normalizeTree(tree2);

    // Both should produce the same group (keys are sorted)
    assert.deepEqual(
      result1.multiParentGroups[0].parentKeys,
      result2.multiParentGroups[0].parentKeys,
      'Parent key order should not affect grouping'
    );
  });

  test('three or more parents work correctly', () => {
    const originalWarn = console.warn;
    console.warn = () => {};

    try {
      const config: SunburstConfig = {
        size: { radius: 100 },
        layers: [
          {
            id: 'main',
            radialUnits: [0, 2],
            angleMode: 'free',
            tree: [
              { name: 'A', key: 'a', value: 33 },
              { name: 'B', key: 'b', value: 34 },
              { name: 'C', key: 'c', value: 33 },
              { name: 'Multi', value: 30, parents: ['a', 'b', 'c'] },
            ],
          },
        ],
      };

      const arcs = layout(config);
      const multiArc = arcs.find(arc => arc.data.name === 'Multi');

      assert.ok(multiArc, 'Multi-parent arc should be present');
      // Should span the entire circle (all three parents)
      roughlyEqual(multiArc!.x0, 0);
      roughlyEqual(multiArc!.x1, Math.PI * 2);
    } finally {
      console.warn = originalWarn;
    }
  });
});
