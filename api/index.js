/**
 * Vercel serverless entry point. `vercel.json` rewrites `/api/*` here so the
 * exact same handler that powers `npm run dev` and `npm start` runs in
 * production too.
 */

import { handleApiRequest } from '../server/api.js';

export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  const handled = await handleApiRequest(req, res);
  if (!handled) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: 'not_found' }));
  }
}
