/**
 * Generates the PWA icons and the Open Graph image by rendering HTML in
 * headless Chromium.
 *
 * The output is committed to `public/`, so this only needs re-running when the
 * brand changes:  `npm run assets`
 */

import { existsSync, readdirSync } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

/**
 * Finds a Chromium to drive: an explicit path, a system install, or a browser
 * already downloaded under PLAYWRIGHT_BROWSERS_PATH (whose build number will
 * not always match the playwright-core version, hence the search).
 */
function findChromium() {
  const explicit = process.env.CHROMIUM_PATH;
  if (explicit && existsSync(explicit)) return explicit;

  const roots = [process.env.PLAYWRIGHT_BROWSERS_PATH, '/opt/pw-browsers'].filter(Boolean);
  for (const root of roots) {
    if (!existsSync(root)) continue;
    for (const entry of readdirSync(root)) {
      if (!entry.startsWith('chromium-')) continue;
      const candidate = resolve(root, entry, 'chrome-linux/chrome');
      if (existsSync(candidate)) return candidate;
    }
  }

  for (const candidate of [
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
  ]) {
    if (existsSync(candidate)) return candidate;
  }
  return undefined;
}

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC_DIR = resolve(ROOT, 'public');

const BRAND = {
  bg: '#08080c',
  surface: '#0e0e15',
  purple: '#7c5cff',
  violet: '#9a80ff',
  cyan: '#4fd1c5',
  text: '#f4f3f7',
  muted: '#a5a3b5',
};

/** Inlines the self-hosted font so the render never waits on the network. */
async function fontFace() {
  try {
    const file = await readFile(resolve(PUBLIC_DIR, 'fonts/archivo-400800-latin.woff2'));
    return `@font-face{font-family:'Archivo';src:url(data:font/woff2;base64,${file.toString('base64')}) format('woff2');font-weight:400 800;font-display:block;}`;
  } catch {
    return '';
  }
}

function markSvg(size) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="g" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
      <stop stop-color="${BRAND.purple}"/><stop offset="0.55" stop-color="${BRAND.violet}"/><stop offset="1" stop-color="${BRAND.cyan}"/>
    </linearGradient></defs>
    <circle cx="21.5" cy="16" r="8" fill="url(#g)" opacity="0.45"/>
    <circle cx="21.5" cy="16" r="2.4" fill="${BRAND.bg}"/>
    <rect x="4.5" y="5.5" width="16" height="21" rx="2" fill="${BRAND.surface}" stroke="url(#g)" stroke-width="${1.8}"/>
    <rect x="7.5" y="8.5" width="10" height="10" rx="1" fill="url(#g)"/>
    <path d="M7.5 21.6h10M7.5 24h6" stroke="${BRAND.muted}" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`;
}

function iconHtml(size, { maskable = false } = {}) {
  // Maskable icons need their content inside the safe zone (80% of the canvas).
  const inset = maskable ? size * 0.14 : size * 0.08;
  const inner = size - inset * 2;
  return `<!doctype html><html><body style="margin:0">
    <div style="width:${size}px;height:${size}px;background:${BRAND.bg};display:grid;place-items:center;border-radius:${maskable ? 0 : size * 0.22}px;overflow:hidden">
      <div style="width:${inner}px;height:${inner}px">${markSvg(inner)}</div>
    </div>
  </body></html>`;
}

async function ogHtml() {
  const font = await fontFace();
  return `<!doctype html><html><head><style>
    ${font}
    *{margin:0;box-sizing:border-box}
    body{width:1200px;height:630px;background:${BRAND.bg};font-family:'Archivo',system-ui,sans-serif;color:${BRAND.text};overflow:hidden}
    .wrap{position:relative;width:100%;height:100%;padding:76px;display:flex;flex-direction:column;justify-content:space-between}
    .blob{position:absolute;border-radius:50%;filter:blur(90px)}
    .b1{width:620px;height:620px;top:-220px;left:-140px;background:${BRAND.purple};opacity:.5}
    .b2{width:520px;height:520px;bottom:-220px;right:-80px;background:${BRAND.cyan};opacity:.32}
    .row{display:flex;align-items:center;gap:16px;position:relative}
    .word{font-size:34px;font-weight:800;letter-spacing:-.03em}
    h1{position:relative;font-size:82px;line-height:1.02;font-weight:800;letter-spacing:-.04em;max-width:15ch}
    .accent{background:linear-gradient(100deg,${BRAND.violet},${BRAND.cyan});-webkit-background-clip:text;background-clip:text;color:transparent}
    p{position:relative;font-size:26px;color:${BRAND.muted};max-width:34ch}
    .foot{display:flex;gap:14px;position:relative}
    .chip{padding:10px 20px;border:1px solid rgba(255,255,255,.16);border-radius:999px;font-size:20px;color:${BRAND.muted};background:rgba(255,255,255,.05)}
  </style></head><body>
    <div class="wrap">
      <div class="blob b1"></div><div class="blob b2"></div>
      <div class="row"><div style="width:52px;height:52px">${markSvg(52)}</div><span class="word">Posterfy</span></div>
      <h1>Turn any album into a <span class="accent">poster worth framing</span></h1>
      <div class="foot">
        <span class="chip">6 templates</span>
        <span class="chip">300 DPI export</span>
        <span class="chip">Free, no account</span>
      </div>
    </div>
  </body></html>`;
}

async function shot(browser, html, { width, height, path }) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path, omitBackground: false });
  await page.close();
  console.log('wrote', path.replace(`${ROOT}/`, ''));
}

async function main() {
  await mkdir(PUBLIC_DIR, { recursive: true });

  let browser;
  try {
    const executablePath = findChromium();
    browser = await chromium.launch(executablePath ? { executablePath } : {});
  } catch (error) {
    console.error('Could not launch Chromium — icons were left unchanged.');
    console.error(error.message);
    process.exitCode = 1;
    return;
  }

  try {
    await shot(browser, iconHtml(192), {
      width: 192,
      height: 192,
      path: resolve(PUBLIC_DIR, 'icon-192.png'),
    });
    await shot(browser, iconHtml(512), {
      width: 512,
      height: 512,
      path: resolve(PUBLIC_DIR, 'icon-512.png'),
    });
    await shot(browser, iconHtml(512, { maskable: true }), {
      width: 512,
      height: 512,
      path: resolve(PUBLIC_DIR, 'icon-maskable-512.png'),
    });
    await shot(browser, iconHtml(180), {
      width: 180,
      height: 180,
      path: resolve(PUBLIC_DIR, 'apple-touch-icon.png'),
    });
    await shot(browser, await ogHtml(), {
      width: 1200,
      height: 630,
      path: resolve(PUBLIC_DIR, 'og-image.png'),
    });
  } finally {
    await browser.close();
  }
}

await main();
