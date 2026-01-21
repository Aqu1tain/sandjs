export interface BenchmarkResult {
  name: string;
  nodeCount: number;
  runs: number;
  mean: number;
  median: number;
  min: number;
  max: number;
  stdDev: number;
  opsPerSecond: number;
}

export interface BenchmarkOptions {
  warmupRuns?: number;
  measureRuns?: number;
}

export function benchmark(
  name: string,
  nodeCount: number,
  fn: () => void,
  options: BenchmarkOptions = {}
): BenchmarkResult {
  const { warmupRuns = 3, measureRuns = 10 } = options;

  // Warmup
  for (let i = 0; i < warmupRuns; i++) {
    fn();
  }

  // Measure
  const times: number[] = [];
  for (let i = 0; i < measureRuns; i++) {
    const start = performance.now();
    fn();
    const end = performance.now();
    times.push(end - start);
  }

  const sorted = [...times].sort((a, b) => a - b);
  const mean = times.reduce((a, b) => a + b, 0) / times.length;
  const median = sorted[Math.floor(sorted.length / 2)];
  const min = sorted[0];
  const max = sorted[sorted.length - 1];

  const variance = times.reduce((sum, t) => sum + Math.pow(t - mean, 2), 0) / times.length;
  const stdDev = Math.sqrt(variance);

  return {
    name,
    nodeCount,
    runs: measureRuns,
    mean,
    median,
    min,
    max,
    stdDev,
    opsPerSecond: 1000 / mean,
  };
}

export function formatResult(result: BenchmarkResult): string {
  const lines = [
    `${result.name} (${result.nodeCount.toLocaleString()} nodes)`,
    `  Mean:   ${result.mean.toFixed(2)}ms`,
    `  Median: ${result.median.toFixed(2)}ms`,
    `  Min:    ${result.min.toFixed(2)}ms`,
    `  Max:    ${result.max.toFixed(2)}ms`,
    `  StdDev: ${result.stdDev.toFixed(2)}ms`,
    `  Ops/s:  ${result.opsPerSecond.toFixed(2)}`,
  ];
  return lines.join('\n');
}

export function formatTable(results: BenchmarkResult[]): string {
  const header = '| Benchmark | Nodes | Mean (ms) | Median (ms) | Min (ms) | Max (ms) | Ops/s |';
  const separator = '|-----------|-------|-----------|-------------|----------|----------|-------|';

  const rows = results.map(r =>
    `| ${r.name} | ${r.nodeCount.toLocaleString()} | ${r.mean.toFixed(2)} | ${r.median.toFixed(2)} | ${r.min.toFixed(2)} | ${r.max.toFixed(2)} | ${r.opsPerSecond.toFixed(1)} |`
  );

  return [header, separator, ...rows].join('\n');
}

export function formatSummary(results: BenchmarkResult[]): string {
  const lines: string[] = ['## Performance Summary\n'];

  const byName = new Map<string, BenchmarkResult[]>();
  for (const r of results) {
    const base = r.name.split(' ')[0];
    if (!byName.has(base)) byName.set(base, []);
    byName.get(base)!.push(r);
  }

  for (const [name, group] of byName) {
    lines.push(`### ${name}\n`);
    const sorted = group.sort((a, b) => a.nodeCount - b.nodeCount);

    for (const r of sorted) {
      const nodesPerMs = r.nodeCount / r.mean;
      lines.push(`- **${r.nodeCount.toLocaleString()} nodes**: ${r.mean.toFixed(2)}ms (${nodesPerMs.toFixed(0)} nodes/ms)`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
