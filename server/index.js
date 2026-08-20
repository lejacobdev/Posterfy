/**
 * Production server: serves the built SPA from `dist` and mounts the API.
 * Zero dependencies so the container image stays tiny.
 *
 *   npm run build && npm start
 */

import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleApiRequest, hasSpotifyCredentials } from './api.js';

const ROOT = resolve(fileURLToPath(new URL('../dist', import.meta.url)));
const PORT = Number(process.env.PORT ?? 8080);
const HOST = process.env.HOST ?? '0.0.0.0';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

/** Content-addressed build assets can be cached forever; HTML must not be. */
function cacheControlFor(pathname) {
  if (pathname === '/index.html' || pathname.endsWith('.html')) {
    return 'no-cache, must-revalidate';
  }
  if (pathname.startsWith('/assets/') || pathname.startsWith('/fonts/')) {
    return 'public, max-age=31536000, immutable';
  }
  if (pathname === '/sw.js') return 'no-cache';
  return 'public, max-age=3600';
}

function securityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), payment=()');
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://musicbrainz.org https://coverartarchive.org",
      "frame-ancestors 'self'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  );
}

function sendFile(req, res, filePath, pathname) {
  const stats = statSync(filePath);
  const etag = `W/"${stats.size}-${Number(stats.mtimeMs).toString(36)}"`;

  if (req.headers['if-none-match'] === etag) {
    res.statusCode = 304;
    res.end();
    return;
  }

  res.statusCode = 200;
  res.setHeader(
    'Content-Type',
    MIME_TYPES[extname(filePath).toLowerCase()] ?? 'application/octet-stream',
  );
  res.setHeader('Content-Length', String(stats.size));
  res.setHeader('Cache-Control', cacheControlFor(pathname));
  res.setHeader('ETag', etag);

  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  createReadStream(filePath).pipe(res);
}

const server = createServer(async (req, res) => {
  securityHeaders(res);

  try {
    if (await handleApiRequest(req, res)) return;

    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    // `normalize` collapses `..` segments, and the prefix check blocks escapes.
    const safePath = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
    const candidate = join(ROOT, safePath);

    if (!candidate.startsWith(ROOT)) {
      res.statusCode = 403;
      res.end('Forbidden');
      return;
    }

    if (existsSync(candidate) && statSync(candidate).isFile()) {
      sendFile(req, res, candidate, url.pathname);
      return;
    }

    // Client-side routing: every unknown path renders the SPA shell.
    const indexPath = join(ROOT, 'index.html');
    if (!existsSync(indexPath)) {
      res.statusCode = 500;
      res.end('Build output missing — run `npm run build` first.');
      return;
    }
    res.statusCode = safePath === '/' || !extname(safePath) ? 200 : 404;
    sendFile(req, res, indexPath, '/index.html');
  } catch (error) {
    console.error('[posterfy:server]', error);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.end('Internal server error');
    }
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Posterfy listening on http://${HOST}:${PORT}`);
  console.log(
    hasSpotifyCredentials()
      ? 'Spotify search: enabled'
      : 'Spotify search: disabled (set SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET) — MusicBrainz fallback active',
  );
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
    // Don't let a hung connection block the shutdown.
    setTimeout(() => process.exit(0), 5000).unref();
  });
}
