import { createServer } from 'node:http';
import { promises as fs } from 'node:fs';
import { extname, join, normalize, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const projectRoot = resolve(__dirname, '..');
const demoRoot = resolve(projectRoot, 'demo');
const distRoot = resolve(projectRoot, 'dist');
const publicRoot = resolve(projectRoot, 'public');
const searchableRoots = [demoRoot, publicRoot, distRoot];

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

const ensureLeadingSlashTrimmed = (value) => value.replace(/^\/+/, '');

const isWithinRoot = (candidate, root) => {
  const diff = relative(root, candidate);
  return diff === '' || (!diff.startsWith('..') && !diff.includes('..')); // prevents directory traversal
};

const sanitizePathname = (pathname) => {
  if (!pathname) {
    return 'index.html';
  }

  if (pathname.includes('\0')) {
    throw new Error('Invalid path');
  }

  const decoded = decodeURIComponent(pathname);
  const trimmed = ensureLeadingSlashTrimmed(decoded);
  const normalized = normalize(trimmed || '.');

  if (normalized === '.' || normalized === '') {
    return 'index.html';
  }

  if (normalized.startsWith('..') || normalized.includes('../')) {
    throw new Error('Path traversal attempt detected');
  }

  return normalized;
};

const resolveStaticPath = async (pathname) => {
  let safePath;
  try {
    safePath = sanitizePathname(pathname);
  } catch {
    return null;
  }

  for (const root of searchableRoots) {
    const candidate = resolve(root, safePath);
    if (!isWithinRoot(candidate, root)) {
      continue;
    }

    try {
      const stats = await fs.stat(candidate);
      if (stats.isDirectory()) {
        const indexCandidate = join(candidate, 'index.html');
        await fs.access(indexCandidate);
        return indexCandidate;
      }
      return candidate;
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  return null;
};

const server = createServer(async (req, res) => {
  if (!req.url) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Bad Request');
    return;
  }

  const { pathname } = new URL(req.url, `http://localhost:${port}`);

  try {
    const filePath = await resolveStaticPath(pathname);
    if (!filePath) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not Found');
      return;
    }

    const buffer = await fs.readFile(filePath);
    const mime = MIME_TYPES[extname(filePath).toLowerCase()] ?? 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': mime,
      'Cache-Control': 'no-cache',
    });
    res.end(buffer);
  } catch (error) {
    console.error('[dev-server] failed to serve', pathname, error);
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Internal Server Error');
  }
});

server.listen(port, () => {
  console.log(`Sand.js dev server running at http://localhost:${port}`);
});
