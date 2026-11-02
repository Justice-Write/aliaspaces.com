// Headless/static artifact checks. No accounts, provider requests or deployment.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const args = process.argv.slice(2);
const option = key => args[args.indexOf(key) + 1];
if (!args.includes('--social') || !args.includes('--control')) throw Error('Use --social <built Alia artifact> --control <MyPersonas public site directory>');
const roots = { 'aliaspaces.com': path.resolve(option('--social')), 'mypersonas.online': path.resolve(option('--control')) };
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
const context = await browser.newContext({ serviceWorkers: 'block' });
const writes = [];
try {
  await context.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() !== 'GET') { writes.push(request.method()); return route.abort(); }
    const root = roots[url.hostname];
    if (!root) return route.abort(); // No real backend, provider or CDN traffic.
    const target = path.resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
    if (!target.startsWith(root + path.sep)) return route.abort();
    const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png' };
    try { await route.fulfill({ status: 200, contentType: types[path.extname(target)] || 'application/octet-stream', body: await readFile(target) }); }
    catch { await route.fulfill({ status: 404, body: 'Not part of this artifact' }); }
  });
  let page;
  async function visit(url) {
    if (page) await page.close();
    page = await context.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded' });
  }
  await visit('https://aliaspaces.com/');
  assert.equal(new URL(page.url()).hostname, 'aliaspaces.com');
  assert.match(await page.title(), /AliaSpaces/);
  assert.equal(await page.locator('link[rel=canonical]').getAttribute('href'), 'https://aliaspaces.com/');
  assert.equal(await page.locator('meta[name="apple-mobile-web-app-title"]').getAttribute('content'), 'AliaSpaces');
  for (const method of ['route', 'renderDiscover']) {
    // Exercise the real router's metadata writes. Data loading may fail because
    // this isolated test deliberately has no backend/CDN/account session.
    await page.evaluate(async method => {
      if (typeof window[method] !== 'function') throw Error(`Missing runtime ${method}`);
      try { await window[method](); } catch { /* Offline data loads are not acceptance. */ }
    }, method);
    assert.doesNotMatch(await page.locator('meta[name="description"]').getAttribute('content'), /anonymous|never linked|unlinkab/i, `${method} must not replace factual metadata with an unverified privacy guarantee`);
    assert.match(await page.title(), /AliaSpaces/);
  }
  await visit('https://aliaspaces.com/#/studio');
  await page.waitForURL(url => url.hostname === 'mypersonas.online');
  assert.match(page.url(), /#\/studio$/);
  assert.match(await page.title(), /MyPersonas/);
  await visit('https://mypersonas.online/#/p/synthetic-persona');
  await page.waitForURL(url => url.hostname === 'aliaspaces.com');
  assert.match(page.url(), /#\/p\/synthetic-persona$/);
  await visit('https://aliaspaces.com/?code=synthetic-callback#/studio');
  assert.equal(new URL(page.url()).hostname, 'aliaspaces.com', 'auth callback must finish on its original host');
  await visit('https://aliaspaces.com/offline.html');
  assert.match(await page.title(), /AliaSpaces/);
  assert.doesNotMatch(await page.locator('body').innerText(), /MyPersonas|current approvals/);
  const manifest = JSON.parse(await readFile(path.join(roots['aliaspaces.com'], 'manifest.webmanifest'), 'utf8'));
  assert.equal(manifest.short_name, 'AliaSpaces');
  assert.deepEqual([manifest.id, manifest.scope, manifest.start_url], ['./', './', './']);
  assert.ok(manifest.shortcuts.every(x => !/studio|discovery|mypersonas/.test(x.url)));
  assert.deepEqual(writes, []);
  console.log('Domain artifact smoke PASS: social/control identity, management/public route hops, callback host retention, social offline/manifest identity. Network isolated; no signed-in or provider acceptance claimed.');
} finally { await context.close(); await browser.close(); }
