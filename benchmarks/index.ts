import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const benchmarks = ['layout.bench.js', 'render.bench.js', 'navigation.bench.js'];

async function runBenchmark(file: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn('node', [join(__dirname, file)], { stdio: 'inherit' });
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Benchmark ${file} exited with code ${code}`));
    });
    proc.on('error', reject);
  });
}

async function main() {
  console.log('='.repeat(70));
  console.log('                    SAND.JS PERFORMANCE BENCHMARKS');
  console.log('='.repeat(70));
  console.log('');

  for (const bench of benchmarks) {
    await runBenchmark(bench);
    console.log('\n');
  }

  console.log('='.repeat(70));
  console.log('                         ALL BENCHMARKS COMPLETE');
  console.log('='.repeat(70));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
