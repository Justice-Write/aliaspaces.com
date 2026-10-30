import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('OS backup and transfer exclude personal records, cookies and sessions; explicit JSON exports remain separate', async () => {
  const manifest = await readFile(new URL('../android/app/src/main/AndroidManifest.xml', import.meta.url), 'utf8');
  assert.match(manifest, /android:allowBackup="false"/);
  assert.match(manifest, /android:fullBackupContent="false"/);
  assert.match(manifest, /android:dataExtractionRules="@xml\/data_extraction_rules"/);
  const rules = await readFile(new URL('../android/app/src/main/res/xml/data_extraction_rules.xml', import.meta.url), 'utf8');
  assert.doesNotMatch(rules, /<include\b/);
  for (const channel of ['cloud-backup', 'device-transfer']) {
    const body = rules.match(new RegExp(`<${channel}>([\\s\\S]*?)</${channel}>`))?.[1];
    assert.ok(body, channel);
    for (const domain of ['root', 'file', 'database', 'sharedpref', 'external', 'device_root', 'device_file', 'device_database', 'device_sharedpref']) {
      assert.ok(body.includes(`<exclude domain="${domain}" path="." />`), `${channel}: ${domain}`);
    }
  }
});
