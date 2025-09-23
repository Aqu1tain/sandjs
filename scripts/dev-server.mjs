import { createServer } from 'node:http';
import { promises as fs } from 'node:fs';
import { spawn } from 'node:child_process';
import { extname, join, resolve, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Define project paths using a secure method
const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');
const demoRoot = join(projectRoot, 'demo');
const publicRoot = projectRoot;
const distRoot = join(projectRoot, 'dist');
const port = Number.parseInt(process.env.PORT ?? '4173', 10);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
};

// A more robust and secure path resolver
const resolveStaticPath = async (urlPathRaw) => {
  if (!urlPathRaw) return null;

  const decoded = decodeURIComponent(urlPathRaw);
  let sanitized = decoded.replace(/\\/g, '/').replace(/^\/+/, '');

  // Default to index.html if the request is for the root or a directory
  if (sanitized === '' || sanitized.endsWith('/')) {
    sanitized = join(sanitized, 'index.html');
  }

  // Paths to check for the file, in order of priority
  const candidates = [join(demoRoot, sanitized), join(publicRoot, sanitized), join(distRoot, sanitized)];

  for (const candidate of candidates) {
    try {
      // Use normalize and resolve to handle path segments securely
      const resolvedPath = resolve(candidate);

      // Check if the resolved path is within the designated public, demo, or dist root
      if (
          !resolvedPath.startsWith(normalize(demoRoot) + normalize('/')) &&
          !resolvedPath.startsWith(normalize(publicRoot) + normalize('/')) &&
          !resolvedPath.startsWith(normalize(distRoot) + normalize('/'))
      ) {
        continue;
      }

      const stat = await fs.stat(resolvedPath);
      if (stat.isFile()) {
        return resolvedPath;
      }
    } catch (err) {
      if (err.code !== 'ENOENT') {
        throw err;
      }
    }
  }

  return null;
};

const printBanner = () => {
  const url = `http://localhost:${port}/demo/`;
  console.log('');
  console.log('Sand.js dev server ready');
  console.log(`  ➜ Local:   ${url}`);
  console.log('  ➜ Root:    ./demo/index.html');
  console.log('  ➜ Bundle:  dist/sandjs.mjs');
  console.log('');
};

const serve = () =>
    createServer(async (req, res) => {
      if (!req.url) {
        res.writeHead(400).end('Bad Request');
        return;
      }

      const { pathname } = new URL(req.url, `http://localhost:${port}`);

      try {
        const resolvedPath = await resolveStaticPath(pathname);

        if (!resolvedPath) {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not Found');
          return;
        }

        const data = await fs.readFile(resolvedPath);
        const mime = MIME_TYPES[extname(resolvedPath).toLowerCase()] ?? 'application/octet-stream';

        res.writeHead(200, {
          'Content-Type': mime,
          'Cache-Control': 'no-cache',
        });
        res.end(data);
      } catch (err) {
        console.error('[dev-server] error serving', req.url, err);
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Internal Server Error');
      }
    }).listen(port, () => {
      printBanner();
    });

const ensureDistArtifacts = async () => {
  await fs.mkdir(distRoot, { recursive: true });

  const seeds = [
    { src: 'README.md', dest: join(distRoot, 'README.md') },
    { src: 'LICENSE', dest: join(distRoot, 'LICENSE') },
  ];

  await Promise.all(
      seeds.map(async ({ src, dest }) => {
        try {
          await fs.access(dest);
        } catch {
          await fs.copyFile(join(projectRoot, src), dest);
        }
      }),
  );
};

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
await ensureDistArtifacts();

const rollup = spawn(npmCommand, ['exec', '--', 'rollup', '-c', '--watch'], {
  cwd: projectRoot,
  stdio: ['inherit', 'pipe', 'inherit'],
  env: {
    ...process.env,
    SKIP_COPY: '1',
  },
});

const server = serve();

rollup.on('exit', (code, signal) => {
  if (signal === 'SIGINT' || signal === 'SIGTERM') return;
  if (code !== 0) {
    console.error(`[dev-server] rollup exited with code ${code}`);
    process.exitCode = code ?? 1;
  }
});

const shutdown = () => {
  try { server.close(); } catch (e) { console.error('Error closing server:', e); }
  if (!rollup.killed) {
    console.log('Shutting down Rollup...');
    rollup.kill('SIGINT');
  }
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  shutdown();
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  shutdown();
});