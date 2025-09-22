import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { renderSVG } from '../src/index.js';
import type { SunburstConfig } from '../src/index.js';

class StubElement {
  public attributes = new Map<string, string>();
  public children: StubElement[] = [];
  public parentNode: StubElement | null = null;
  public textContent = '';
  public firstChild: StubElement | null = null;
  public classList = {
    add: () => {},
    remove: () => {},
    toggle: () => {},
  };
  public dataset: Record<string, string> = {};

  constructor(public tagName: string) {}

  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
    if (name.startsWith('data-')) {
      this.dataset[name.slice(5)] = value;
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

  addEventListener(): void {
    /* no-op for tests */
  }
}

class StubSVGElement extends StubElement {}

class StubDocument {
  public body = new StubElement('body');

  createElementNS(_ns: string, tag: string) {
    return new StubSVGElement(tag);
  }

  createElement(tag: string) {
    return new StubElement(tag);
  }

  querySelector(): null {
    return null;
  }
}

// Ensure global SVGElement exists for instanceof checks.
(globalThis as any).SVGElement = StubSVGElement;

test('renderSVG exposes update handle that patches the existing host', () => {
  const document = new StubDocument();
  const hostStub = new StubSVGElement('svg');

  const initialConfig: SunburstConfig = {
    size: { radius: 100 },
    layers: [
      {
        id: 'values',
        radialUnits: [0, 1],
        angleMode: 'free',
        tree: [
          { name: 'A', value: 2 },
          { name: 'B', value: 1 },
        ],
      },
    ],
  };

  const chart = renderSVG({
    el: hostStub as unknown as SVGElement,
    config: initialConfig,
    document: document as unknown as Document,
    tooltip: false,
    highlightByKey: false,
    breadcrumbs: false,
  });

  assert.equal(typeof chart.update, 'function');
  assert.equal(typeof chart.destroy, 'function');
  assert.equal(chart.length, 2);
  assert.equal(hostStub.children.length, 2);

  const nextConfig: SunburstConfig = {
    size: { radius: 100 },
    layers: [
      {
        id: 'values',
        radialUnits: [0, 1],
        angleMode: 'free',
        tree: [
          { name: 'C', value: 1 },
        ],
      },
    ],
  };

  chart.update(nextConfig);

  assert.equal(chart.length, 1, 'handle should reflect updated arc count');
  assert.equal(hostStub.children.length, 1, 'host children should be replaced');
  assert.equal(chart[0].data.name, 'C');

  chart.destroy();
  assert.equal(chart.length, 0, 'destroy should clear handle array');
  assert.equal(hostStub.children.length, 0, 'destroy should empty host');
});
