import { renderSVG } from '../src/index.js';
import { generateTree, createConfig, countNodes, type TreeShape } from './generators.js';
import { benchmark, formatResult, formatTable, type BenchmarkResult } from './runner.js';

class StubElement {
  public attributes = new Map<string, string>();
  public children: StubElement[] = [];
  public parentNode: StubElement | null = null;
  public textContent = '';
  public firstChild: StubElement | null = null;
  public style: Record<string, string> = {};
  public classList = { add: () => {}, remove: () => {}, toggle: () => {} };
  public dataset: Record<string, string>;
  public listeners: Record<string, Array<(event: unknown) => void>> = {};
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
    if (name.startsWith('data-')) this.dataset[name.slice(5)] = value;
  }

  setAttributeNS(_ns: string | null, name: string, value: string) {
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
    if (name.startsWith('data-')) delete this.dataset[name.slice(5)];
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
    if (this.parentNode) this.parentNode.removeChild(this);
  }

  addEventListener(type: string, handler: (event: unknown) => void): void {
    if (!this.listeners[type]) this.listeners[type] = [];
    this.listeners[type].push(handler);
  }

  removeEventListener(type: string, handler: (event: unknown) => void): void {
    const list = this.listeners[type];
    if (!list) return;
    const index = list.indexOf(handler);
    if (index !== -1) list.splice(index, 1);
  }

  querySelector(selector: string): StubElement | null {
    const matchAttr = selector.startsWith('[') && selector.endsWith(']') ? selector.slice(1, -1) : null;
    if (!matchAttr) return null;
    const [attr] = matchAttr.split('=');
    return this.children.find((c) => c.attributes.has(attr)) ?? null;
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  getBoundingClientRect() {
    return { top: 0, left: 0, right: 100, bottom: 100, width: 100, height: 100, x: 0, y: 0 };
  }

  get childNodes(): StubElement[] {
    return this.children;
  }

  insertBefore<T extends StubElement>(newChild: T, refChild: StubElement | null): T {
    if (!refChild || !this.children.includes(refChild)) return this.appendChild(newChild);
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
    if (tag === 'defs') return new StubSVGDefsElement();
    return new StubSVGElement(tag);
  }

  createElement(tag: string) {
    return new StubElement(tag);
  }

  querySelector(): null {
    return null;
  }
}

(globalThis as unknown as Record<string, unknown>).SVGElement = StubSVGElement;
(globalThis as unknown as Record<string, unknown>).SVGDefsElement = StubSVGDefsElement;

const NODE_COUNTS = [100, 500, 1000, 5000, 10000];

function runInitialRenderBenchmarks(): BenchmarkResult[] {
  const results: BenchmarkResult[] = [];

  console.log('Running initial render benchmarks...\n');

  for (const targetCount of NODE_COUNTS) {
    const tree = generateTree({ nodeCount: targetCount, shape: 'realistic' });
    const actualCount = countNodes(tree);
    const config = createConfig(tree);

    const result = benchmark(
      'Initial render',
      actualCount,
      () => {
        const doc = new StubDocument();
        const host = new StubSVGElement('svg');
        const chart = renderSVG({
          el: host as unknown as SVGElement,
          config,
          document: doc as unknown as Document,
        });
        chart.destroy();
      },
      { warmupRuns: 2, measureRuns: 5 }
    );

    results.push(result);
    console.log(formatResult(result));
    console.log('');
  }

  return results;
}

function runUpdateBenchmarks(): BenchmarkResult[] {
  const results: BenchmarkResult[] = [];

  console.log('\nRunning update benchmarks...\n');

  for (const targetCount of NODE_COUNTS) {
    const tree1 = generateTree({ nodeCount: targetCount, shape: 'realistic' });
    const tree2 = generateTree({ nodeCount: targetCount, shape: 'realistic' });
    const actualCount = countNodes(tree1);
    const config1 = createConfig(tree1);
    const config2 = createConfig(tree2);

    const doc = new StubDocument();
    const host = new StubSVGElement('svg');
    const chart = renderSVG({
      el: host as unknown as SVGElement,
      config: config1,
      document: doc as unknown as Document,
    });

    const result = benchmark(
      'Update render',
      actualCount,
      () => {
        chart.update(config2);
        chart.update(config1);
      },
      { warmupRuns: 2, measureRuns: 5 }
    );

    chart.destroy();
    results.push(result);
    console.log(formatResult(result));
    console.log('');
  }

  return results;
}

function runWithFeaturesBenchmarks(): BenchmarkResult[] {
  const results: BenchmarkResult[] = [];

  console.log('\nRunning render with features benchmarks...\n');

  const featureSets = [
    { name: 'Bare', options: {} },
    { name: 'Tooltip', options: { tooltip: true } },
    { name: 'Navigation', options: { navigation: true } },
    { name: 'Highlight', options: { highlightByKey: true } },
    { name: 'All features', options: { tooltip: true, navigation: true, highlightByKey: true, breadcrumbs: true } },
  ];

  const targetCount = 1000;
  const tree = generateTree({ nodeCount: targetCount, shape: 'realistic' });
  const actualCount = countNodes(tree);
  const config = createConfig(tree);

  for (const { name, options } of featureSets) {
    const result = benchmark(
      name,
      actualCount,
      () => {
        const doc = new StubDocument();
        const host = new StubSVGElement('svg');
        const chart = renderSVG({
          el: host as unknown as SVGElement,
          config,
          document: doc as unknown as Document,
          ...options,
        } as Parameters<typeof renderSVG>[0]);
        chart.destroy();
      },
      { warmupRuns: 2, measureRuns: 5 }
    );

    results.push(result);
    console.log(formatResult(result));
    console.log('');
  }

  return results;
}

function main() {
  console.log('='.repeat(60));
  console.log('Sand.js Render Performance Benchmarks');
  console.log('='.repeat(60));
  console.log('');

  const initialResults = runInitialRenderBenchmarks();
  const updateResults = runUpdateBenchmarks();
  const featureResults = runWithFeaturesBenchmarks();

  console.log('\n' + '='.repeat(60));
  console.log('Initial Render Results');
  console.log('='.repeat(60));
  console.log('');
  console.log(formatTable(initialResults));

  console.log('\n' + '='.repeat(60));
  console.log('Update Render Results');
  console.log('='.repeat(60));
  console.log('');
  console.log(formatTable(updateResults));

  console.log('\n' + '='.repeat(60));
  console.log('Feature Overhead (1000 nodes)');
  console.log('='.repeat(60));
  console.log('');
  console.log(formatTable(featureResults));

  console.log('\n' + '='.repeat(60));
  console.log('Performance Recommendations');
  console.log('='.repeat(60));
  console.log('');

  const targetFps60 = 16.67;
  const safeForInitial = initialResults.find(r => r.mean > targetFps60 * 2)?.nodeCount ?? 10000;
  const safeForUpdate = updateResults.find(r => r.mean > targetFps60)?.nodeCount ?? 10000;

  console.log(`For smooth initial render: <${safeForInitial.toLocaleString()} nodes`);
  console.log(`For 60fps updates: <${safeForUpdate.toLocaleString()} nodes`);

  const baseTime = featureResults[0].mean;
  const allFeaturesTime = featureResults[featureResults.length - 1].mean;
  const overhead = ((allFeaturesTime - baseTime) / baseTime * 100).toFixed(1);
  console.log(`Feature overhead (all enabled): +${overhead}%`);
}

main();
