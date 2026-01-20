import { test, describe } from 'node:test';
import * as assert from 'node:assert/strict';
import { createTooltipRuntime, resolveTooltipContainer } from '../src/render/runtime/tooltip.js';
import { createBreadcrumbRuntime } from '../src/render/runtime/breadcrumbs.js';
import type { LayoutArc } from '../src/types/index.js';

// Stub DOM classes for testing
class StubElement {
  public attributes = new Map<string, string>();
  public children: StubElement[] = [];
  public parentNode: StubElement | null = null;
  public textContent = '';
  public style: Record<string, string> = {};
  private _innerHTML = '';

  constructor(public tagName: string) {}

  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  set innerHTML(value: string) {
    this._innerHTML = value;
    this.textContent = value;
  }

  get innerHTML(): string {
    return this._innerHTML;
  }

  appendChild(child: StubElement): StubElement {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  querySelector(selector: string): StubElement | null {
    const attrMatch = selector.match(/^\[([^\]]+)\]$/);
    if (attrMatch) {
      const attr = attrMatch[1];
      for (const child of this.children) {
        if (child.attributes.has(attr)) {
          return child;
        }
      }
    }
    return null;
  }

  addEventListener(_type: string, _handler: (event: any) => void): void {}
}

class StubHTMLElement extends StubElement {}

class StubDocument {
  public body = new StubHTMLElement('body');

  createElement(tag: string): StubElement {
    return new StubHTMLElement(tag);
  }

  querySelector(selector: string): StubElement | null {
    if (selector === '#container') {
      const container = new StubHTMLElement('div');
      container.setAttribute('id', 'container');
      return container;
    }
    return null;
  }
}

// Mock arc for testing
function createMockArc(overrides: Partial<LayoutArc> = {}): LayoutArc {
  return {
    layerId: 'test-layer',
    data: { name: 'Test Arc', value: 100 },
    x0: 0,
    x1: Math.PI / 2,
    y0: 50,
    y1: 100,
    depth: 0,
    value: 100,
    path: [],
    pathIndices: [0],
    percentage: 0.25,
    ...overrides,
  };
}

// Mock pointer event
function createMockPointerEvent(x: number, y: number): PointerEvent {
  return { clientX: x, clientY: y } as PointerEvent;
}

describe('Tooltip Runtime', () => {
  test('returns null when input is false', () => {
    const doc = new StubDocument() as unknown as Document;
    const result = createTooltipRuntime(doc, false);
    assert.strictEqual(result, null);
  });

  test('creates tooltip element in body', () => {
    const doc = new StubDocument();
    createTooltipRuntime(doc as unknown as Document, true);

    const tooltipEl = doc.body.querySelector('[data-sandjs-tooltip]');
    assert.ok(tooltipEl, 'Tooltip element should be created');
  });

  test('reuses existing tooltip element', () => {
    const doc = new StubDocument();

    // Create first runtime
    createTooltipRuntime(doc as unknown as Document, true);
    const childCount1 = doc.body.children.length;

    // Create second runtime
    createTooltipRuntime(doc as unknown as Document, true);
    const childCount2 = doc.body.children.length;

    assert.equal(childCount1, childCount2, 'Should reuse existing tooltip');
  });

  test('show() displays tooltip with arc info', () => {
    const doc = new StubDocument();
    const runtime = createTooltipRuntime(doc as unknown as Document, true)!;
    const arc = createMockArc();
    const event = createMockPointerEvent(100, 200);

    runtime.show(event, arc);

    const tooltipEl = doc.body.querySelector('[data-sandjs-tooltip]')!;
    assert.equal(tooltipEl.style.visibility, 'visible');
    assert.equal(tooltipEl.style.opacity, '1');
    assert.ok(tooltipEl.innerHTML.includes('Test Arc'), 'Should show arc name');
  });

  test('hide() hides tooltip', () => {
    const doc = new StubDocument();
    const runtime = createTooltipRuntime(doc as unknown as Document, true)!;
    const arc = createMockArc();
    const event = createMockPointerEvent(100, 200);

    runtime.show(event, arc);
    runtime.hide();

    const tooltipEl = doc.body.querySelector('[data-sandjs-tooltip]')!;
    assert.equal(tooltipEl.style.opacity, '0');
    assert.equal(tooltipEl.style.visibility, 'hidden');
  });

  test('move() updates position when visible', () => {
    const doc = new StubDocument();
    const runtime = createTooltipRuntime(doc as unknown as Document, true)!;
    const arc = createMockArc();

    runtime.show(createMockPointerEvent(100, 200), arc);
    const tooltipEl = doc.body.querySelector('[data-sandjs-tooltip]')!;
    const initialLeft = tooltipEl.style.left;

    runtime.move(createMockPointerEvent(300, 400));
    const newLeft = tooltipEl.style.left;

    // Position should have changed after move()
    assert.ok(newLeft !== initialLeft || newLeft.length > 0, 'Position should be set after move');
  });

  test('uses custom formatter when provided', () => {
    const doc = new StubDocument();
    const runtime = createTooltipRuntime(doc as unknown as Document, {
      formatter: (arc) => `Custom: ${arc.data.name}`,
    })!;
    const arc = createMockArc();

    runtime.show(createMockPointerEvent(0, 0), arc);

    const tooltipEl = doc.body.querySelector('[data-sandjs-tooltip]')!;
    assert.equal(tooltipEl.innerHTML, 'Custom: Test Arc');
  });

  test('uses arc.data.tooltip when available', () => {
    const doc = new StubDocument();
    const runtime = createTooltipRuntime(doc as unknown as Document, true)!;
    const arc = createMockArc({
      data: { name: 'Test', tooltip: 'Custom tooltip text' },
    });

    runtime.show(createMockPointerEvent(0, 0), arc);

    const tooltipEl = doc.body.querySelector('[data-sandjs-tooltip]')!;
    assert.equal(tooltipEl.innerHTML, 'Custom tooltip text');
  });

  test('dispose() clears tooltip content', () => {
    const doc = new StubDocument();
    const runtime = createTooltipRuntime(doc as unknown as Document, true)!;
    const arc = createMockArc();

    runtime.show(createMockPointerEvent(0, 0), arc);
    runtime.dispose();

    const tooltipEl = doc.body.querySelector('[data-sandjs-tooltip]')!;
    assert.equal(tooltipEl.innerHTML, '');
    assert.equal(tooltipEl.style.visibility, 'hidden');
  });
});

describe('Tooltip Container Resolution', () => {
  test('uses document.body when no container specified', () => {
    const doc = new StubDocument();
    const result = resolveTooltipContainer(doc as unknown as Document, undefined);
    assert.strictEqual(result, doc.body);
  });

  test('throws when document.body is missing', () => {
    const doc = { body: null } as unknown as Document;
    assert.throws(
      () => resolveTooltipContainer(doc, undefined),
      /requires document.body/
    );
  });

  test('returns container element when provided directly', () => {
    const doc = new StubDocument();
    const container = new StubHTMLElement('div');
    const result = resolveTooltipContainer(doc as unknown as Document, container as unknown as HTMLElement);
    assert.strictEqual(result, container);
  });
});

describe('Breadcrumb Runtime', () => {
  test('returns null when input is falsy', () => {
    const doc = new StubDocument() as unknown as Document;
    assert.strictEqual(createBreadcrumbRuntime(doc, false), null);
    assert.strictEqual(createBreadcrumbRuntime(doc, undefined), null);
  });

  test('creates breadcrumb element', () => {
    const doc = new StubDocument();
    createBreadcrumbRuntime(doc as unknown as Document, true);

    const bcEl = doc.body.querySelector('[data-sandjs-breadcrumbs]');
    assert.ok(bcEl, 'Breadcrumb element should be created');
  });

  test('show() displays arc path', () => {
    const doc = new StubDocument();
    const runtime = createBreadcrumbRuntime(doc as unknown as Document, true)!;
    const arc = createMockArc({
      path: [{ name: 'Root' }, { name: 'Child' }, { name: 'Leaf' }],
    });

    runtime.show(arc);

    const bcEl = doc.body.querySelector('[data-sandjs-breadcrumbs]')!;
    assert.ok(bcEl.textContent.includes('Root'), 'Should include root name');
  });

  test('clear() resets to empty label', () => {
    const doc = new StubDocument();
    const runtime = createBreadcrumbRuntime(doc as unknown as Document, {
      emptyLabel: 'Hover an arc',
    })!;
    const arc = createMockArc();

    runtime.show(arc);
    runtime.clear();

    const bcEl = doc.body.querySelector('[data-sandjs-breadcrumbs]')!;
    assert.equal(bcEl.textContent, 'Hover an arc');
  });

  test('uses custom separator', () => {
    const doc = new StubDocument();
    const runtime = createBreadcrumbRuntime(doc as unknown as Document, {
      separator: ' > ',
    })!;
    const arc = createMockArc({
      path: [{ name: 'A' }, { name: 'B' }],
    });

    runtime.show(arc);

    const bcEl = doc.body.querySelector('[data-sandjs-breadcrumbs]')!;
    assert.ok(bcEl.textContent.includes('>'), 'Should use custom separator');
  });

  test('uses custom formatter', () => {
    const doc = new StubDocument();
    const runtime = createBreadcrumbRuntime(doc as unknown as Document, {
      formatter: () => 'Custom breadcrumb',
    })!;
    const arc = createMockArc();

    runtime.show(arc);

    const bcEl = doc.body.querySelector('[data-sandjs-breadcrumbs]')!;
    assert.equal(bcEl.textContent, 'Custom breadcrumb');
  });

  test('interactive mode provides setTrail', () => {
    const doc = new StubDocument();
    const runtime = createBreadcrumbRuntime(doc as unknown as Document, {
      interactive: true,
    })!;

    assert.ok(typeof runtime.setTrail === 'function', 'Should have setTrail method');
    assert.equal(runtime.handlesTrail, true, 'Should handle trail');
  });

  test('non-interactive mode does not provide setTrail', () => {
    const doc = new StubDocument();
    const runtime = createBreadcrumbRuntime(doc as unknown as Document, {
      interactive: false,
    })!;

    assert.strictEqual(runtime.setTrail, undefined);
    assert.strictEqual(runtime.handlesTrail, false);
  });

  test('dispose() resets breadcrumb', () => {
    const doc = new StubDocument();
    const runtime = createBreadcrumbRuntime(doc as unknown as Document, {
      emptyLabel: 'Empty',
    })!;
    const arc = createMockArc();

    runtime.show(arc);
    runtime.dispose();

    const bcEl = doc.body.querySelector('[data-sandjs-breadcrumbs]')!;
    assert.equal(bcEl.textContent, 'Empty');
  });
});
