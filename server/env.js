/**
 * Minimal `.env` loader.
 *
 * Node's own `--env-file` flag would do this, but it is not available in every
 * host that runs this server, and pulling in `dotenv` for twenty lines of
 * parsing is not worth a dependency. Values already present in the environment
 * always win, which is what platform-provided variables expect.
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ENV_PATH = resolve(fileURLToPath(new URL('..', import.meta.url)), '.env');

function parse(contents) {
  const values = {};

  for (const rawLine of contents.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const separator = line.indexOf('=');
    if (separator === -1) continue;

    const key = line.slice(0, separator).trim();
    if (!key) continue;

    let value = line.slice(separator + 1).trim();
    // Strip matching surrounding quotes, keeping any inside the value.
    const quoted = value.length > 1 && (value[0] === '"' || value[0] === "'");
    if (quoted && value[value.length - 1] === value[0]) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }

  return values;
}

let loaded = false;

export function loadEnv(path = ENV_PATH) {
  if (loaded) return;
  loaded = true;
  if (!existsSync(path)) return;

  try {
    const values = parse(readFileSync(path, 'utf8'));
    for (const [key, value] of Object.entries(values)) {
      if (process.env[key] === undefined) process.env[key] = value;
    }
  } catch (error) {
    console.warn('[posterfy] could not read .env:', error.message);
  }
}

export { parse as parseEnv };
