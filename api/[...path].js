/**
 * Vercel serverless entry point.
 *
 * Single-bracket splat (`[...path]`) is the convention Vercel's `api/`
 * directory uses for catch-all routes, so every `/api/*` path — nested ones
 * included — reaches this one function. The double-bracket Next.js form only
 * matched a single segment here, which 404'd `/api/spotify/search`.
 *
 * The shared handler dispatches on `req.url`, so the same code backs
 * `npm run dev`, `npm start` and production with no per-platform branching.
 */

import { handleApiRequest } from '../server/api.js';

export default async function handler(req, res) {
  const handled = await handleApiRequest(req, res);
  if (!handled) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: 'not_found' }));
  }
}
