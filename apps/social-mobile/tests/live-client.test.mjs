import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function loadClient() {
  const sandbox = { module: { exports: {} }, URL };
  sandbox.globalThis = sandbox;
  for (const name of ["contract.js", "social-client.js"]) {
    const source = await readFile(path.join(appRoot, "src/live", name), "utf8");
    sandbox.module = { exports: {} };
    vm.createContext(sandbox);
    vm.runInContext(source, sandbox, { filename: name });
  }
  return {
    contract: sandbox.AliaSpacesLiveContract.CONTRACT,
    factory: sandbox.AliaSpacesLiveClient,
  };
}

test("unsigned writes fail closed and signed-in is only claimed after a session", async () => {
  const { factory } = await loadClient();
  const client = factory.createClient({ mode: "fixture" });
  assert.equal(client.status().signedIn, false);
  assert.equal(client.status().sessionState, "signed-out");
  const denied = await client.savePost({ personaId: "persona_north", body: "should not write" });
  assert.equal(denied.ok, false);
  assert.equal(denied.error.code, "unsigned");
  assert.equal(client.status().signedIn, false);

  const failed = await client.signInWithPassword({
    email: "fixture.north@example.invalid",
    password: "wrong",
  });
  assert.equal(failed.ok, false);
  assert.equal(client.status().signedIn, false);

  const signed = await client.signInWithPassword({
    email: "fixture.north@example.invalid",
    password: "fixture-only-not-production",
  });
  assert.equal(signed.ok, true);
  assert.equal(client.status().signedIn, true);
  assert.equal(client.status().sessionState, "signed-in");
});

test("identity projection maps account and persona without inventing users", async () => {
  const { factory, contract } = await loadClient();
  const client = factory.createClient({ mode: "fixture" });
  await client.signInWithPassword({
    email: "fixture.north@example.invalid",
    password: "fixture-only-not-production",
  });
  const mine = await client.myPersonas();
  assert.equal(mine.ok, true);
  assert.equal(mine.projections.length, 1);
  const row = mine.projections[0];
  for (const field of contract.identityProjection) {
    assert.ok(row[field], `missing ${field}`);
  }
  assert.equal(row.handle, "fixture_north");
  assert.equal(row.account_id, "acct_fixture_north");
});

test("block hides the other persona's posts in the client filter", async () => {
  const { factory } = await loadClient();
  const client = factory.createClient({ mode: "fixture" });
  await client.signInWithPassword({
    email: "fixture.north@example.invalid",
    password: "fixture-only-not-production",
  });
  const before = await client.myProfilePosts({
    actorPersonaId: "persona_north",
    targetPersonaId: "persona_south",
  });
  assert.equal(before.ok, true);
  assert.equal(before.data.some((post) => post.id === "post_south"), true);

  const blocked = await client.setVisibilityRule({
    otherPersonaId: "persona_south",
    kind: "block",
    enabled: true,
  });
  assert.equal(blocked.ok, true);

  const after = await client.myProfilePosts({
    actorPersonaId: "persona_north",
    targetPersonaId: "persona_south",
  });
  assert.equal(after.data.some((post) => post.id === "post_south"), false);

  const visible = client.visiblePosts(before.data, [
    { kind: "block", other_persona_id: "persona_south" },
  ], "persona_north");
  assert.equal(visible.some((post) => post.id === "post_south"), false);
});

test("savePost stays review-gated and never claims a public publish", async () => {
  const { factory } = await loadClient();
  const client = factory.createClient({ mode: "fixture" });
  await client.signInWithPassword({
    email: "fixture.north@example.invalid",
    password: "fixture-only-not-production",
  });
  const saved = await client.savePost({
    personaId: "persona_north",
    body: "Fixture review draft",
  });
  assert.equal(saved.ok, true);
  assert.equal(saved.published, false);
  assert.equal(saved.reviewRequired, true);
  assert.match(saved.message, /not auto-published/i);
});

test("automation RPCs and unknown tables are rejected", async () => {
  const { factory } = await loadClient();
  const client = factory.createClient({ mode: "fixture" });
  await client.signInWithPassword({
    email: "fixture.north@example.invalid",
    password: "fixture-only-not-production",
  });
  const forbidden = await client.callRpc("save_ai_task_definition", {});
  assert.equal(forbidden.ok, false);
  assert.equal(forbidden.error.code, "forbidden-rpc");
  const unknown = await client.callRpc("not_a_social_rpc", {});
  assert.equal(unknown.ok, false);
  assert.equal(unknown.error.code, "unknown-rpc");
  const table = await client.readTable("agent_actions");
  assert.equal(table.ok, false);
  assert.match(table.error.message, /not a social table/);
});

test("transport errors stay fail-closed and fixture catalog is not live", async () => {
  const { factory } = await loadClient();
  const transport = {
    kind: "offline-stub",
    async authPassword() {
      throw Object.assign(new Error("network down"), { name: "TypeError" });
    },
    async rpc() {
      throw new Error("network down");
    },
    async select() {
      throw new Error("network down");
    },
    async authUser() {
      throw new Error("network down");
    },
    async authLogout() {
      return { ok: true };
    },
    async authSignup() {
      throw new Error("network down");
    },
  };
  const client = factory.createClient({ transport, mode: "live" });
  const result = await client.signInWithPassword({
    email: "someone@example.com",
    password: "secret",
  });
  assert.equal(result.ok, false);
  assert.equal(client.status().signedIn, false);
  const catalog = client.fixtureCatalog();
  assert.match(catalog.note, /never written to production|never written/i);
  assert.match(catalog.note, /not online users/i);
});

test("live contract uses the public website project and never a service role", async () => {
  const { contract } = await loadClient();
  const source = await readFile(path.join(appRoot, "src/live/social-client.js"), "utf8");
  assert.equal(contract.supabaseUrl, "https://nwsqyuucwzihruszocge.supabase.co");
  assert.match(contract.publishableKey, /^sb_publishable_/);
  assert.equal(contract.audience, "aliaspaces-social-mobile");
  assert.ok(contract.allowedRpcs.save_persona_post.writes);
  assert.equal(contract.allowedRpcs.my_personas.writes, false);
  assert.ok(contract.forbiddenRpcs.includes("save_ai_task_definition"));
  assert.doesNotMatch(source, /service_role|SUPABASE_SERVICE_ROLE/);
});

test("read-only live personas query is empty-honest and unsigned my_personas is denied", async () => {
  const key = "sb_publishable_vN6BdSvBKf_yTJt0eeK20w_afKz1Df2";
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
  const publicRows = await fetch("https://nwsqyuucwzihruszocge.supabase.co/rest/v1/personas?select=id,handle&visibility=eq.public&publication_state=eq.published&limit=5", { headers });
  assert.equal(publicRows.ok, true);
  const personas = await publicRows.json();
  assert.ok(Array.isArray(personas));

  const mine = await fetch("https://nwsqyuucwzihruszocge.supabase.co/rest/v1/rpc/my_personas", {
    method: "POST",
    headers,
    body: "{}",
  });
  assert.equal(mine.status, 401);
});

async function signedInNorth() {
  const loaded = await loadClient();
  const client = loaded.factory.createClient({ mode: "fixture" });
  await client.signInWithPassword({
    email: "fixture.north@example.invalid",
    password: "fixture-only-not-production",
  });
  return { ...loaded, client };
}

test("reports reach the queue, dedupe, and never target your own content", async () => {
  const { client } = await signedInNorth();
  const first = await client.reportContent({ targetKind: "post", targetId: "post_south", reason: "spam", details: "  repeated  ads " });
  assert.equal(first.ok, true);
  assert.equal(first.data.queued, true);
  assert.match(first.message, /does not remove anything/);
  const again = await client.reportContent({ targetKind: "post", targetId: "post_south", reason: "harassment" });
  assert.equal(again.data.reportId, first.data.reportId);

  const own = await client.reportContent({ targetKind: "post", targetId: "post_north", reason: "spam" });
  assert.equal(own.ok, false);
  assert.match(own.error.message, /own content/);
});

test("a blocked target is indistinguishable from a missing one when reporting", async () => {
  const { client } = await signedInNorth();
  await client.setVisibilityRule({ otherPersonaId: "persona_south", kind: "block", enabled: true });
  const blocked = await client.reportContent({ targetKind: "persona", targetId: "persona_south", reason: "harassment" });
  const missing = await client.reportContent({ targetKind: "persona", targetId: "persona_nobody", reason: "harassment" });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.error.message, missing.error.message);
});

test("report input is validated before any network call", async () => {
  const { client } = await signedInNorth();
  for (const bad of [
    { targetKind: "album", targetId: "x", reason: "spam" },
    { targetKind: "post", targetId: "", reason: "spam" },
    { targetKind: "post", targetId: "post_south", reason: "rude" },
    { targetKind: "post", targetId: "post_south", reason: "spam", details: "x".repeat(401) },
  ]) {
    const result = await client.reportContent(bad);
    assert.equal(result.ok, false);
    assert.equal(result.error.code, "invalid-report");
  }
});

test("reports require a session and say plainly when the server has not enabled them", async () => {
  const { factory, contract } = await loadClient();
  const unsigned = factory.createClient({ mode: "fixture" });
  const denied = await unsigned.reportContent({ targetKind: "post", targetId: "post_south", reason: "spam" });
  assert.equal(denied.ok, false);
  assert.equal(denied.error.code, "unsigned");

  const notDeployed = factory.createClient({
    mode: "fixture",
    transport: Object.assign(factory.createMemoryTransport(), {
      async rpc() {
        const error = new factory.LiveError("http", "Could not find the function public.report_content");
        error.status = 404;
        return { error };
      },
    }),
  });
  await notDeployed.signInWithPassword({ email: "fixture.north@example.invalid", password: "fixture-only-not-production" });
  const off = await notDeployed.reportContent({ targetKind: "post", targetId: "post_south", reason: "spam" });
  assert.equal(off.ok, false);
  assert.equal(off.error.code, "reports-not-enabled");

  assert.equal(contract.allowedRpcs.report_content.writes, true);
  assert.ok(contract.forbiddenRpcs.includes("staff_list_content_reports"));
  assert.ok(contract.forbiddenRpcs.includes("staff_resolve_content_report"));
  assert.equal(contract.allowedRpcs.staff_list_content_reports, undefined);
});

test("live UI offers report on others' posts only and routes it through reportContent", async () => {
  const source = await readFile(path.join(appRoot, "src/live/live-app.js"), "utf8");
  assert.match(source, /\$\{own \? "" : reportForm\("post", post\.id\)\}/);
  assert.match(source, /client\.reportContent\(/);
  assert.doesNotMatch(source, /Content reports are not a first-party RPC yet/);
  assert.doesNotMatch(source, /staff_(list|resolve)_content_report/);
});

function testStorage() {
  const entries = new Map();
  return {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, value),
    removeItem: (key) => entries.delete(key),
  };
}

test("restored credentials cannot claim identity or write until Auth verifies them", async () => {
  const { factory } = await loadClient();
  const storage = testStorage();
  const transport = factory.createMemoryTransport();
  const first = factory.createClient({ mode: "fixture", storage, transport });
  await first.signInWithPassword({ email: "fixture.north@example.invalid", password: "fixture-only-not-production" });
  const restored = factory.createClient({ mode: "fixture", storage, transport });
  assert.equal(restored.status().signedIn, false);
  assert.equal(restored.status().sessionState, "unverified");
  assert.equal(restored.status().accountId, null);
  const denied = await restored.savePost({ personaId: "persona_north", body: "Not yet verified" });
  assert.equal(denied.error.code, "unsigned");
  assert.equal((await restored.verifySession()).ok, true);
  assert.equal(restored.status().signedIn, true);
  assert.equal(restored.status().accountId, "acct_fixture_north");
});

test("forged saved identity is cleared when Auth rejects the token", async () => {
  const { factory, contract } = await loadClient();
  const storage = testStorage();
  storage.setItem(contract.sessionStorageKey, JSON.stringify({ access_token: "forged", user: { id: "pretend-admin" } }));
  const transport = factory.createMemoryTransport();
  transport.authUser = async () => ({ error: new factory.LiveError("unsigned", "Token rejected by Auth") });
  const client = factory.createClient({ mode: "fixture", storage, transport });
  assert.equal(client.status().signedIn, false);
  assert.equal((await client.verifySession()).ok, false);
  assert.equal(client.status().sessionState, "signed-out");
  assert.equal(storage.getItem(contract.sessionStorageKey), null);
});

test("late session verification cannot undo sign-out", async () => {
  const { factory } = await loadClient();
  let finishVerification;
  const transport = factory.createMemoryTransport();
  transport.authUser = () => new Promise((resolve) => { finishVerification = resolve; });
  const client = factory.createClient({ mode: "fixture", transport, session: { access_token: "candidate", user: { id: "old-account" } } });
  const checking = client.verifySession();
  await client.signOut();
  finishVerification({ data: { id: "old-account" } });
  assert.equal((await checking).ok, false);
  assert.equal(client.status().signedIn, false);
});
