/**
 * Vercel serverless entry point.
 *
 * This is an optional catch-all route, so every `/api/*` path is handled by
 * this one function with the original URL intact. That matters: the shared
 * handler dispatches on `req.url`, and a `vercel.json` rewrite would collapse
 * `/api/spotify/search` down to `/api` before the function ever saw it.
 *
 * The result is that the same handler backs `npm run dev`, `npm start` and
 * production on Vercel, with no per-platform branching.
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
