import { layout } from '../src/index.js';
import { generateTree, createConfig, countNodes, type TreeShape } from './generators.js';
import { benchmark, formatResult, formatTable, type BenchmarkResult } from './runner.js';

const NODE_COUNTS = [100, 500, 1000, 5000, 10000];
const SHAPES: TreeShape[] = ['balanced', 'deep', 'wide', 'realistic'];

function runLayoutBenchmarks(): BenchmarkResult[] {
  const results: BenchmarkResult[] = [];

  console.log('Running layout benchmarks...\n');

  for (const targetCount of NODE_COUNTS) {
    for (const shape of SHAPES) {
      const tree = generateTree({ nodeCount: targetCount, shape });
      const actualCount = countNodes(tree);
      const config = createConfig(tree);

      const result = benchmark(
        `Layout ${shape}`,
        actualCount,
        () => layout(config),
        { warmupRuns: 3, measureRuns: 10 }
      );

      results.push(result);
      console.log(formatResult(result));
      console.log('');
    }
  }

  return results;
}

function runScalingTest(): BenchmarkResult[] {
  const results: BenchmarkResult[] = [];
  const counts = [100, 250, 500, 1000, 2500, 5000, 7500, 10000];

  console.log('\nRunning scaling test...\n');

  for (const targetCount of counts) {
    const tree = generateTree({ nodeCount: targetCount, shape: 'wide' });
    const actualCount = countNodes(tree);
    const config = createConfig(tree);

    const result = benchmark(
      'Layout scaling',
      actualCount,
      () => layout(config),
      { warmupRuns: 2, measureRuns: 5 }
    );

    results.push(result);
    const nodesPerMs = actualCount / result.mean;
    console.log(`${actualCount.toLocaleString().padStart(6)} nodes: ${result.mean.toFixed(2).padStart(8)}ms (${nodesPerMs.toFixed(0)} nodes/ms)`);
  }

  return results;
}

function main() {
  console.log('='.repeat(60));
  console.log('Sand.js Layout Performance Benchmarks');
  console.log('='.repeat(60));
  console.log('');

  const shapeResults = runLayoutBenchmarks();

  console.log('\n' + '='.repeat(60));
  console.log('Shape Comparison Table');
  console.log('='.repeat(60));
  console.log('');
  console.log(formatTable(shapeResults));

  const scalingResults = runScalingTest();

  console.log('\n' + '='.repeat(60));
  console.log('Scaling Analysis');
  console.log('='.repeat(60));
  console.log('');

  const first = scalingResults[0];
  const last = scalingResults[scalingResults.length - 1];
  const scaleRatio = last.nodeCount / first.nodeCount;
  const timeRatio = last.mean / first.mean;

  console.log(`Node increase: ${scaleRatio.toFixed(0)}x`);
  console.log(`Time increase: ${timeRatio.toFixed(1)}x`);
  console.log(`Complexity: ~O(n^${(Math.log(timeRatio) / Math.log(scaleRatio)).toFixed(2)})`);

  console.log('\n' + '='.repeat(60));
  console.log('Recommendations');
  console.log('='.repeat(60));

  const targetFps60 = 16.67;
  const safeCount = scalingResults.find(r => r.mean > targetFps60)?.nodeCount ?? 20000;

  console.log('');
  console.log(`For 60fps interactions: <${safeCount.toLocaleString()} nodes recommended`);
  console.log(`Layout is efficient for typical use cases (100-5000 nodes)`);
}

main();
