import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { renderSVG } from '../src/index.js';
class StubElement {
    tagName;
    attributes = new Map();
    children = [];
    parentNode = null;
    textContent = '';
    firstChild = null;
    classList = {
        add: () => { },
        remove: () => { },
        toggle: () => { },
    };
    dataset = {};
    constructor(tagName) {
        this.tagName = tagName;
    }
    setAttribute(name, value) {
        this.attributes.set(name, value);
        if (name.startsWith('data-')) {
            this.dataset[name.slice(5)] = value;
        }
    }
    appendChild(child) {
        child.parentNode = this;
        this.children.push(child);
        this.firstChild = this.children[0] ?? null;
        return child;
    }
    removeChild(child) {
        const index = this.children.indexOf(child);
        if (index !== -1) {
            this.children.splice(index, 1);
            child.parentNode = null;
        }
        this.firstChild = this.children[0] ?? null;
        return child;
    }
    addEventListener() {
        /* no-op for tests */
    }
}
class StubSVGElement extends StubElement {
}
class StubDocument {
    body = new StubElement('body');
    createElementNS(_ns, tag) {
        return new StubSVGElement(tag);
    }
    createElement(tag) {
        return new StubElement(tag);
    }
    querySelector() {
        return null;
    }
}
// Ensure global SVGElement exists for instanceof checks.
globalThis.SVGElement = StubSVGElement;
test('renderSVG exposes update handle that patches the existing host', () => {
    const document = new StubDocument();
    const hostStub = new StubSVGElement('svg');
    const initialConfig = {
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
        el: hostStub,
        config: initialConfig,
        document: document,
        tooltip: false,
        highlightByKey: false,
        breadcrumbs: false,
    });
    assert.equal(typeof chart.update, 'function');
    assert.equal(typeof chart.destroy, 'function');
    assert.equal(chart.length, 2);
    assert.equal(hostStub.children.length, 2);
    const nextConfig = {
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
