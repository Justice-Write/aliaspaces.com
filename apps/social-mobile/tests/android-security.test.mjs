import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (name) => readFile(new URL(name, root), 'utf8');

test('native file bridge is origin and main-frame restricted, with no legacy global bridge', async () => {
  const source = await read('android/app/src/main/java/com/aliaspaces/social/local/MainActivity.kt');
  assert.doesNotMatch(source, /addJavascriptInterface|@JavascriptInterface/);
  assert.match(source, /WebViewCompat.addWebMessageListener\(webView, "AliaSpacesAndroid", setOf\("https:\/\/\$ASSET_HOST"\)\)/);
  assert.match(source, /!isMainFrame.*!isLocalExportDocument\(\)/);
  assert.match(source, /if \(appMode == MODE_LOCAL\) installLocalBridge\(\)/);
  assert.match(source, /removeWebMessageListener/);
  assert.match(source, /pendingDocumentEpoch != documentEpoch \|\| pendingFileUrl != webView.url \|\| !isLocalExportDocument\(\)/);
  assert.match(source, /pendingFileUrl == webView.url/);
  assert.doesNotMatch(source, /params\?\.createIntent/);
  assert.match(source, /val validMime = mime != null && allowed.any/);
  assert.match(source, /REQUEST_IMPORT && isLocalDocument\(\)/);
  assert.match(source, /bytes.size > MAX_JSON_BYTES/);
});

test('local pages cannot embed remote frames and live API trust is exact', async () => {
  for (const name of ['index.html', 'live.html']) {
    const html = await read(name);
    assert.match(html, /frame-src 'none'/);
    assert.doesNotMatch(html, /https:\/\/\*\.supabase\.co/);
  }
  const app = await read('src/ui/app.js');
  assert.match(app, /postMessage\(JSON.stringify\(\{ action: "export", payload: api.serialize\(state\)/);
  assert.match(app, /postMessage\(JSON.stringify\(\{ action: "import"/);
});
