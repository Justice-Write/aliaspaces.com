import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const root = fileURLToPath(new URL('../', import.meta.url));
const server = createServer(async (req, res) => {
  const file = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
  if (path.relative(root, file).startsWith('..')) return res.writeHead(403).end();
  try { const body = await readFile(file); res.writeHead(200, { 'content-type': ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' })[path.extname(file)] || 'text/plain' }).end(body); }
  catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [], external = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('request', r => { if (!r.url().startsWith('http://127.0.0.1:')) external.push(r.url()); });
  const url = `http://127.0.0.1:${server.address().port}/akasha.html`, key = 'aliaspaces.pantry.local.v1';
  await page.goto(url);
  await page.locator('#content').fill('recipe skit\nAstronomy\nother');
  await page.getByRole('button', { name: 'Add every item to inbox', exact: true }).click();
  let first = page.locator('article').first();
  await first.locator('.reflection summary').click();
  await first.locator('[data-reflection-field=note]').fill('A private <script>literal</script> memory');
  await first.locator('[data-reflection-field=effect]').fill('Curious');
  await first.locator('[data-reflection-field=nextStep]').fill('Read later');
  // A view change must not discard an unsaved personal draft.
  await page.locator('#search').fill('no matching record');
  await page.locator('#search').fill('');
  first = page.locator('article').first();
  await first.locator('.reflection summary').click();
  assert.match(await first.locator('[data-reflection-field=note]').inputValue(), /private/);
  await first.getByRole('button', { name: 'Save my reflection', exact: true }).click();
  await page.reload();
  await page.locator('#search').fill('curious');
  assert.equal(await page.locator('article').count(), 1);
  await page.locator('#search').fill('');
  await page.getByText('Your library view rules', { exact: true }).click();
  await page.locator('#rules-enabled').check();
  await page.locator('#rules-tags').fill('Recipes');
  await page.getByRole('button', { name: 'Save view rules', exact: true }).click();
  assert.equal(await page.locator('article').count(), 2);
  assert.match(await page.locator('#view-rules-status').innerText(), /1 hidden/);
  await page.locator('#rules-bypass').click();
  assert.equal(await page.locator('article').count(), 3);
  await page.locator('#rules-bypass').click();
  assert.equal(await page.locator('article').count(), 2);
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#export').click();
  const backup = await readFile(await (await downloadPromise).path(), 'utf8');
  assert.equal(JSON.parse(backup).items.length, 3, 'Hidden records must remain in backups');
  assert.equal(JSON.parse(backup).items[0].reflection.effect, 'Curious');
  await page.locator('#import').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(backup) });
  await page.getByText('Backup merged.', { exact: false }).waitFor();
  assert.equal(await page.locator('article').count(), 2);
  // A later reflection wins over an older backup of the same record.
  await page.locator('#rules-bypass').click();
  await page.locator('article').first().locator('.reflection summary').click();
  await page.locator('article').first().locator('[data-reflection-field=effect]').fill('My later reflection');
  await page.locator('article').first().getByRole('button', { name: 'Save my reflection', exact: true }).click();
  await page.locator('#import').setInputFiles({ name: 'old.json', mimeType: 'application/json', buffer: Buffer.from(backup) });
  await page.getByText('Backup merged.', { exact: false }).waitFor();
  assert.equal(await page.evaluate(k => JSON.parse(localStorage.getItem(k)).items[0].reflection.effect, key), 'My later reflection');
  // Corrupt storage is preserved and exported verbatim inside a recovery envelope.
  const raw = '{broken\u0000\ud800';
  await page.evaluate(({ key, raw }) => localStorage.setItem(key, raw), { key, raw });
  await page.reload();
  assert.match(await page.locator('#count').innerText(), /unavailable/);
  const recoveryDownload = page.waitForEvent('download'); await page.locator('#export').click();
  const recovery = await recoveryDownload;
  assert.equal(recovery.suggestedFilename(), 'aliaspaces-akasha-recovery.json');
  assert.equal(JSON.parse(await readFile(await recovery.path(), 'utf8')).rawStorage, raw);
  assert.equal(await page.evaluate(k => localStorage.getItem(k), key), raw);
  await page.evaluate(() => { window.AliaSpacesAndroid = { postMessage(value) { window.recoveryRequest = JSON.parse(value); } }; });
  await page.locator('#export').click();
  const request = await page.evaluate(() => window.recoveryRequest);
  assert.equal(request.recovery, true); assert.equal(JSON.parse(request.payload).rawStorage, raw);
  assert.deepEqual(errors, []); assert.deepEqual(external, []);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  console.log('Akasha reflection/view/recovery smoke PASS: drafts, persistence/search, reversible view rules, complete backups, later-note merge preservation, exact corrupt-storage recovery, native recovery dispatch, no external requests.');
} finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
