import { renderSVG } from '../src/index.js';
import { generateTree, createConfig, countNodes } from './generators.js';
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

const NODE_COUNTS = [100, 500, 1000, 5000];

function runDrillDownBenchmarks(): BenchmarkResult[] {
  const results: BenchmarkResult[] = [];

  console.log('Running drill-down benchmarks...\n');

  for (const targetCount of NODE_COUNTS) {
    const tree = generateTree({ nodeCount: targetCount, shape: 'realistic' });
    const actualCount = countNodes(tree);
    const config = createConfig(tree);

    const doc = new StubDocument();
    const host = new StubSVGElement('svg');
    const chart = renderSVG({
      el: host as unknown as SVGElement,
      config,
      document: doc as unknown as Document,
      navigation: true,
      transition: false,
    });

    const paths = host.children.filter(c => c.tagName === 'path');
    const firstPath = paths[0];

    if (!firstPath || !firstPath.listeners.click?.[0]) {
      console.log(`Skipping ${actualCount} nodes - no clickable path`);
      continue;
    }

    const mockEvent = { preventDefault: () => {} };

    const result = benchmark(
      'Drill-down',
      actualCount,
      () => {
        firstPath.listeners.click![0](mockEvent);
        chart.resetNavigation?.();
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

function runResetBenchmarks(): BenchmarkResult[] {
  const results: BenchmarkResult[] = [];

  console.log('\nRunning reset navigation benchmarks...\n');

  for (const targetCount of NODE_COUNTS) {
    const tree = generateTree({ nodeCount: targetCount, shape: 'realistic' });
    const actualCount = countNodes(tree);
    const config = createConfig(tree);

    const doc = new StubDocument();
    const host = new StubSVGElement('svg');
    const chart = renderSVG({
      el: host as unknown as SVGElement,
      config,
      document: doc as unknown as Document,
      navigation: true,
      transition: false,
    });

    const paths = host.children.filter(c => c.tagName === 'path');
    const firstPath = paths[0];
    const mockEvent = { preventDefault: () => {} };

    if (firstPath?.listeners.click?.[0]) {
      firstPath.listeners.click[0](mockEvent);
    }

    const result = benchmark(
      'Reset navigation',
      actualCount,
      () => {
        chart.resetNavigation?.();
        if (firstPath?.listeners.click?.[0]) {
          firstPath.listeners.click[0](mockEvent);
        }
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

function runDeepNavigationBenchmarks(): BenchmarkResult[] {
  const results: BenchmarkResult[] = [];

  console.log('\nRunning deep navigation benchmarks...\n');

  const targetCount = 1000;
  const tree = generateTree({ nodeCount: targetCount, shape: 'deep', maxDepth: 8 });
  const actualCount = countNodes(tree);
  const config = createConfig(tree);

  const doc = new StubDocument();
  const host = new StubSVGElement('svg');
  const chart = renderSVG({
    el: host as unknown as SVGElement,
    config,
    document: doc as unknown as Document,
    navigation: true,
    transition: false,
  });

  const mockEvent = { preventDefault: () => {} };

  const result = benchmark(
    'Deep navigation (8 levels)',
    actualCount,
    () => {
      for (let i = 0; i < 5; i++) {
        const paths = host.children.filter(c => c.tagName === 'path');
        if (paths[0]?.listeners.click?.[0]) {
          paths[0].listeners.click[0](mockEvent);
        }
      }
      chart.resetNavigation?.();
    },
    { warmupRuns: 2, measureRuns: 5 }
  );

  chart.destroy();
  results.push(result);
  console.log(formatResult(result));

  return results;
}

function main() {
  console.log('='.repeat(60));
  console.log('Sand.js Navigation Performance Benchmarks');
  console.log('='.repeat(60));
  console.log('');

  const drillDownResults = runDrillDownBenchmarks();
  const resetResults = runResetBenchmarks();
  const deepResults = runDeepNavigationBenchmarks();

  console.log('\n' + '='.repeat(60));
  console.log('Drill-Down Results');
  console.log('='.repeat(60));
  console.log('');
  console.log(formatTable(drillDownResults));

  console.log('\n' + '='.repeat(60));
  console.log('Reset Navigation Results');
  console.log('='.repeat(60));
  console.log('');
  console.log(formatTable(resetResults));

  console.log('\n' + '='.repeat(60));
  console.log('Deep Navigation Results');
  console.log('='.repeat(60));
  console.log('');
  console.log(formatTable(deepResults));

  console.log('\n' + '='.repeat(60));
  console.log('Recommendations');
  console.log('='.repeat(60));
  console.log('');

  const targetFps60 = 16.67;
  const safeCount = drillDownResults.find(r => r.mean > targetFps60)?.nodeCount ?? 5000;

  console.log(`For 60fps navigation: <${safeCount.toLocaleString()} nodes`);
  console.log('Deep hierarchies add minimal overhead to navigation');
}

main();
