import { createServer } from 'node:http';
import { promises as fs } from 'node:fs';
import { spawn } from 'node:child_process';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const projectRoot = resolve(__dirname, '..');
const demoRoot = join(projectRoot, 'demo');
const distRoot = join(projectRoot, 'dist');
const port = Number.parseInt(process.env.PORT ?? '4173', 10);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
};

const resolveStaticPath = async (urlPath) => {
  const sanitized = urlPath.replace(/\\+/g, '/').replace(/^\/+/, '');
  const target = sanitized.length === 0 ? 'index.html' : sanitized;
  const candidates = [join(demoRoot, target), join(distRoot, target)];

  for (const candidate of candidates) {
    try {
      const stat = await fs.stat(candidate);
      if (stat.isDirectory()) {
        const indexFile = join(candidate, 'index.html');
        await fs.access(indexFile);
        return indexFile;
      }
      return candidate;
    } catch (err) {
      if (err.code !== 'ENOENT') {
        throw err;
      }
    }
  }

  return null;
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
        res.writeHead(404).end('Not Found');
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
      console.error('[dev-server] error serving', pathname, err);
      res.writeHead(500).end('Internal Server Error');
    }
  }).listen(port, () => {
    console.log(`👉  Dev server running at http://localhost:${port}`);
  });

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const rollup = spawn(npmCommand, ['exec', '--', 'rollup', '-c', '--watch'], {
  cwd: projectRoot,
  stdio: 'inherit',
});

const server = serve();

const shutdown = () => {
  server.close();
  if (!rollup.killed) {
    rollup.kill('SIGINT');
  }
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

rollup.on('exit', (code, signal) => {
  if (signal === 'SIGINT' || signal === 'SIGTERM') {
    return;
  }
  if (code !== 0) {
    console.error(`[dev-server] rollup exited with code ${code}`);
    process.exitCode = code ?? 1;
  }
  shutdown();
});
