import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { zipFixture } from '../tests/fixtures/history-zip.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const root = fileURLToPath(new URL('../', import.meta.url));
const server = createServer(async (req, res) => {
  try {
    const file = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
    if (!file.startsWith(root)) return res.writeHead(403).end();
    const body = await readFile(file); res.writeHead(200, { 'content-type': ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' })[path.extname(file)] || 'text/plain' }).end(body);
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const network = []; page.on('request', request => { if (!request.url().startsWith('http://127.0.0.1:')) network.push(request.url()); });
  await page.goto(`http://127.0.0.1:${server.address().port}/akasha.html`);
  assert.match(await page.locator('#account-history-automatic').innerText(), /Not connected/);
  await page.locator('#content').fill('Existing manually saved note');
  await page.getByRole('button', { name: 'Add every item to inbox' }).click();
  await page.getByRole('button', { name: 'Save to Akashic records' }).click();
  await page.locator('#account-history-label').fill('personal');
  const yt = [{ title: 'Watched <script>literal</script>', titleUrl: 'https://youtube.com/watch?v=synthetic', time: '2026-10-01T00:00:00Z' }, { title: 'Unavailable content' }];
  const zip = zipFixture([['Takeout/YouTube/history/watch-history.json', JSON.stringify(yt)], ['messages/private.json', '{not parsed}']], true);
  const upload = { name: 'youtube-account.zip', mimeType: 'application/zip', buffer: zip };
  await page.locator('#account-history-file').setInputFiles(upload);
  await page.getByText('2 source rows', { exact: false }).waitFor();
  assert.equal(await page.locator('article').count(), 1); // Preview never writes.
  await page.getByRole('button', { name: 'Import account history to review' }).click();
  assert.equal(await page.locator('article').count(), 3);
  assert.match(await page.locator('article').nth(2).innerText(), /Viewing time unknown/);
  assert.match(await page.locator('article').first().innerText(), /approved/);
  await page.locator('#account-history-file').setInputFiles(upload);
  await page.getByText('2 source rows', { exact: false }).waitFor();
  await page.getByRole('button', { name: 'Import account history to review' }).click();
  assert.equal(await page.locator('article').count(), 3);
  await page.locator('#account-history-provider').selectOption('tiktok');
  await page.locator('#account-history-file').setInputFiles({ name: 'user_data_tiktok.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ 'Your Activity': { 'Watch History': { VideoList: [{ Date: '2026-10-01 10:00:00', Link: 'https://www.tiktok.com/@synthetic/video/123' }] } } })) });
  await page.getByText('1 source rows', { exact: false }).waitFor();
  await page.getByRole('button', { name: 'Import account history to review' }).click();
  assert.equal(await page.locator('article').count(), 4);
  const key = 'aliaspaces.pantry.local.v1'; const before = await page.evaluate(key => localStorage.getItem(key), key);
  await page.locator('#account-history-file').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{bad') });
  await page.getByText('Nothing imported:', { exact: false }).waitFor();
  assert.equal(await page.evaluate(key => localStorage.getItem(key), key), before);
  // An unreadable or unrelated Meta file must never be reported as an empty successful sync.
  await page.locator('#account-history-provider').selectOption('instagram');
  await page.locator('#account-history-file').setInputFiles({ name: 'likes.json', mimeType: 'application/json', buffer: Buffer.from('{"likes_media_likes":[]}') });
  await page.getByText('no recognized viewing-history', { exact: false }).waitFor();
  assert.equal(await page.evaluate(key => localStorage.getItem(key), key), before);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export Akashic records JSON' }).click();
  const download = await downloadPromise; const backup = await readFile(await download.path());
  await page.locator('#import').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: backup });
  await page.getByText('Backup merged.', { exact: false }).waitFor();
  assert.equal(await page.locator('article').count(), 4);
  await page.reload(); await page.locator('#filter-day').fill('');
  assert.equal(await page.locator('article').count(), 4);
  await page.locator('#collection').selectOption('pending'); assert.equal(await page.locator('article').count(), 3);
  await page.locator('#search').fill('literal'); assert.equal(await page.locator('article').count(), 1);
  await page.getByRole('button', { name: 'Reject', exact: true }).click();
  await page.locator('#collection').selectOption('rejected');
  await page.getByRole('button', { name: 'Return to inbox' }).click();
  await page.locator('#collection').selectOption(''); await page.locator('#search').fill('');
  assert.deepEqual(errors, []); assert.deepEqual(network, []);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await mkdir('evidence', { recursive: true }); await page.screenshot({ path: 'evidence/akasha-account-history.png', fullPage: true });
  console.log('Account-history browser smoke PASS: native-shaped YouTube ZIP + TikTok JSON, explicit preview/import, unknown times, no external requests, raw-text safety, repeat dedupe, malformed/unrelated files preserve storage, original approval preserved, backup roundtrip, reload, search, reject/undo, mobile layout. Fixtures are synthetic; no real account connected.');
} finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
