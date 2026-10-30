import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("Android shell has website, first-party social, and local demo modes", async () => {
  const activity = await readFile(path.join(appRoot, "android/app/src/main/java/com/aliaspaces/social/local/MainActivity.kt"), "utf8");
  const manifest = await readFile(path.join(appRoot, "android/app/src/main/AndroidManifest.xml"), "utf8");
  const gradle = await readFile(path.join(appRoot, "android/app/build.gradle"), "utf8");
  assert.match(manifest, /android.permission.INTERNET/);
  assert.match(manifest, /android.permission.ACCESS_NETWORK_STATE/);
  assert.match(manifest, /android.intent.action.VIEW/);
  assert.match(manifest, /mypersonas\.online/);
  assert.match(manifest, /aliaspaces/);
  assert.match(activity, /https:\/\/mypersonas\.online\//);
  assert.match(activity, /appassets\.androidplatform\.net\/assets\/www\/index.html/);
  assert.match(activity, /appassets\.androidplatform\.net\/assets\/www\/live.html/);
  assert.match(activity, /appassets\.androidplatform\.net\/assets\/www\/error.html/);
  assert.match(activity, /AliaSpacesLiveShell\.watch/);
  assert.match(activity, /CustomTabsIntent/);
  assert.match(activity, /lastMode/);
  assert.match(activity, /MODE_SOCIAL/);
  assert.match(gradle, /versionName "0\.4\.0-akasha"/);
  assert.match(gradle, /versionCode \d+/);
  assert.match(gradle, /live\.html/);
  assert.doesNotMatch(activity, /service_role|SUPABASE_SERVICE_ROLE/);
});
