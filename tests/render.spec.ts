import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { renderSVG } from '../src/index.js';
import type { NavigationFocusState, SunburstConfig } from '../src/index.js';

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
  public dataset: Record<string, string> = {};
  public listeners: Record<string, Array<(event: any) => void>> = {};
  private _innerHTML = '';

  constructor(public tagName: string) {}

  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
    if (name.startsWith('data-')) {
      this.dataset[name.slice(5)] = value;
    }
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

  addEventListener(type: string, handler: (event: any) => void): void {
    if (!this.listeners[type]) {
      this.listeners[type] = [];
    }
    this.listeners[type].push(handler);
  }

  removeEventListener(type: string, handler: (event: any) => void): void {
    const list = this.listeners[type];
    if (!list) {
      return;
    }
    const index = list.indexOf(handler);
    if (index !== -1) {
      list.splice(index, 1);
    }
  }

  querySelector(selector: string): StubElement | null {
    const matchAttr = selector.startsWith('[') && selector.endsWith(']')
      ? selector.slice(1, -1)
      : null;
    if (!matchAttr) {
      return null;
    }
    const [attr] = matchAttr.split('=');
    return (
      this.children.find((child) => child.attributes.has(attr)) ??
      this.children.reduce<StubElement | null>((found, child) => found ?? child.querySelector(selector), null)
    );
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
    tooltip: true,
    highlightByKey: true,
    breadcrumbs: true,
  });

  assert.equal(typeof chart.update, 'function');
  assert.equal(typeof chart.destroy, 'function');
  assert.equal(chart.length, 2);
  assert.equal(hostStub.children.length, 2);

  for (const path of hostStub.children) {
    assert.equal(path.attributes.get('data-depth'), '0');
    assert.equal(path.attributes.get('data-collapsed'), undefined);
    assert.equal(path.attributes.get('class'), 'sand-arc is-root');
  }

  const nextConfig: SunburstConfig = {
    size: { radius: 100 },
    layers: [
      {
        id: 'values',
        radialUnits: [0, 1],
        angleMode: 'free',
        tree: [
          {
            name: 'C',
            value: 1,
            collapsed: true,
            children: [
              { name: 'C-child', value: 1 },
            ],
          },
        ],
      },
    ],
  };

  const countByAttr = (attr: string) =>
    document.body.children.filter((child) => child.attributes.has(attr)).length;

  assert.equal(countByAttr('data-sandjs-tooltip'), 1, 'tooltip element should exist once');
  assert.equal(countByAttr('data-sandjs-breadcrumbs'), 1, 'breadcrumb element should exist once');

  const firstUpdate = chart.update(nextConfig);
  assert.strictEqual(firstUpdate, chart, 'update should return original handle');
  assert.equal(chart.length, 1, 'handle should reflect updated arc count');
  assert.equal(hostStub.children.length, 1, 'host should contain new arc count');
  assert.equal(hostStub.children[0].attributes.get('data-collapsed'), 'true');
  assert.equal(hostStub.children[0].attributes.get('class'), 'sand-arc is-root is-collapsed');

  chart.update({ config: initialConfig });

  assert.equal(chart.length, 2, 'handle should reflect second update');
  assert.equal(hostStub.children.length, 2, 'host should contain second update arcs');
  for (const path of hostStub.children) {
    assert.equal(path.attributes.get('data-collapsed'), undefined);
    assert.equal(path.attributes.get('class'), 'sand-arc is-root');
  }
  assert.equal(countByAttr('data-sandjs-tooltip'), 1, 'tooltip element should stay singleton after updates');
  assert.equal(countByAttr('data-sandjs-breadcrumbs'), 1, 'breadcrumb element should stay singleton after updates');
  assert.deepEqual(chart.map((arc) => arc.data.name), ['A', 'B']);

  chart.destroy();
  assert.equal(countByAttr('data-sandjs-tooltip'), 1, 'tooltip element persists for reuse');
  assert.equal(countByAttr('data-sandjs-breadcrumbs'), 1, 'breadcrumb element persists for reuse');
  assert.equal(chart.length, 0, 'destroy should clear handle array');
  assert.equal(hostStub.children.length, 0, 'destroy should empty host');
});

test('navigation runtime drills down into arcs and breadcrumbs remain interactive', () => {
  const document = new StubDocument();
  const hostStub = new StubSVGElement('svg');

  const config: SunburstConfig = {
    size: { radius: 96 },
    layers: [
      {
        id: 'root',
        radialUnits: [0, 2],
        angleMode: 'free',
        tree: [
          {
            name: 'Alpha',
            value: 3,
            key: 'alpha',
            children: [
              { name: 'Alpha-1', value: 1 },
              { name: 'Alpha-2', value: 2 },
            ],
          },
          { name: 'Beta', value: 2, key: 'beta' },
        ],
      },
    ],
  };

  const focusEvents: Array<NavigationFocusState | null> = [];

  const chart = renderSVG({
    el: hostStub as unknown as SVGElement,
    config,
    document: document as unknown as Document,
    navigation: {
      onFocusChange: (focus) => {
        focusEvents.push(focus ?? null);
      },
    },
    breadcrumbs: {
      interactive: true,
    },
  });

  assert.deepEqual(
    chart.map((arc) => arc.data.name),
    ['Alpha', 'Alpha-1', 'Alpha-2', 'Beta'],
    'expected full chart before navigation',
  );

  const firstPath = hostStub.children[0];
  assert.ok(firstPath.listeners.click && firstPath.listeners.click.length > 0, 'expected click listener');
  firstPath.listeners.click![0]({ preventDefault() {} } as unknown as MouseEvent);

  assert.deepEqual(
    chart.map((arc) => arc.data.name),
    ['Alpha', 'Alpha-1', 'Alpha-2'],
    'drill-down should focus selected branch',
  );

  const crumbContainer = document.body.querySelector('[data-sandjs-breadcrumbs]');
  assert.ok(crumbContainer, 'expected breadcrumb container');
  const crumbLabels = crumbContainer!.children
    .filter((child) => child.attributes.has('data-breadcrumb'))
    .map((child) => child.textContent);
  assert.deepEqual(crumbLabels, ['All', 'Alpha']);

  const rootCrumb = crumbContainer!.children.find(
    (child) => child.attributes.get('data-breadcrumb') === 'root',
  );
  assert.ok(rootCrumb && rootCrumb.listeners.click && rootCrumb.listeners.click.length > 0);
  rootCrumb!.listeners.click![0]({ preventDefault() {} } as unknown as MouseEvent);

  assert.deepEqual(
    chart.map((arc) => arc.data.name),
    ['Alpha', 'Alpha-1', 'Alpha-2', 'Beta'],
    'reset should restore full chart',
  );

  assert.ok(focusEvents.length >= 2, 'expected focus change callbacks');
  const firstFocus = focusEvents[0];
  const secondFocus = focusEvents[focusEvents.length - 1];
  assert.ok(firstFocus && firstFocus.pathIndices.join('.') === '0', 'first focus should target alpha');
  assert.equal(secondFocus, null, 'last focus should reset to null');
});
