import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function load(name) {
  const source = await readFile(path.join(appRoot, "src/live", name), "utf8");
  const sandbox = { module: { exports: {} }, URL };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: name });
  return sandbox;
}

test("live hosts allow the website and auth, not arbitrary origins", async () => {
  const { AliaSpacesLiveHosts: hosts } = await load("hosts.js");
  assert.equal(hosts.isLiveProductHost("https://mypersonas.online/#/owner"), true);
  assert.equal(hosts.isAllowedHost("https://nwsqyuucwzihruszocge.supabase.co/auth/v1/token"), true);
  assert.equal(hosts.isAllowedHost("https://accounts.google.com/o/oauth2/v2/auth"), true);
  assert.equal(hosts.isAllowedHost("https://evil.example/steal"), false);
});

test("Website preserves the owner command center and existing routes", async () => {
  const { AliaSpacesLiveShell: shell } = await load("social-shell.js");
  assert.equal(shell.ownerLanding(), "https://mypersonas.online/#/owner");
  const elements = new Map();
  const tools = [{ hidden: false, style: { display: "block" } }];
  const body = { firstChild: tools[0], insertBefore(node) { elements.set(node.id, node); } };
  const doc = { body, getElementById: id => elements.get(id), querySelectorAll: () => { throw Error('Website controls must not be hidden'); }, createElement: () => ({ style: {}, append() {} }) };
  const location = { hash: "#/fan-inbox", pathname: "/provider-setup.html" };
  assert.equal(shell.watch(doc, location).redirected, false);
  shell.watch(doc, location);
  assert.equal(elements.size, 1);
  assert.equal(location.hash, "#/fan-inbox");
  assert.equal(location.pathname, "/provider-setup.html");
  assert.equal(tools[0].hidden, false);
});

test("Website boundary contains no privileged implementation or hiding logic", async () => {
  const source = await readFile(path.join(appRoot, "src/live/social-shell.js"), "utf8");
  assert.doesNotMatch(source, /MutationObserver|setAttribute\("hidden"|loc\.hash\s*=/);
  assert.match(source, /mypersonas\.online/);
  assert.doesNotMatch(source, /service_role|SUPABASE_SERVICE_ROLE/);
  assert.doesNotMatch(source, /fetch\s*\(|XMLHttpRequest/);
});

test("host trust rejects suffix confusion, non-HTTPS, credentials and alternate ports", async () => {
  const { AliaSpacesLiveHosts: hosts } = await load("hosts.js");
  for (const value of ['http://mypersonas.online/', 'https://mypersonas.online.evil.test/', 'https://evil.supabase.co/', 'https://evil.googleusercontent.com/', 'https://mypersonas.online:444/', 'https://evil@mypersonas.online/', 'https://mypersonas.online@evil.test/', 'javascript://mypersonas.online/', 'https://mypersonas.online\\@evil.test/', 'mypersonas.online', ' https://mypersonas.online/']) assert.equal(hosts.isAllowedHost(value), false, value);
});

test("live website still presents AliaSpaces sign-in and persona discovery", async () => {
  const html = await (await fetch("https://mypersonas.online/")).text();
  assert.match(html, /AliaSpaces/);
  assert.match(html, /go\('signin'\)|authAction\(\)/);
  assert.match(html, /go\(''\)|Entangle/);
  assert.match(html, /nwsqyuucwzihruszocge\.supabase\.co/);
  assert.match(html, /sb_publishable_/);
});
