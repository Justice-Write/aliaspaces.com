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

const NORTH = { email: "fixture.north@example.invalid", password: "fixture-only-not-production" };

function seedWithComment(factory, extra = {}) {
  const catalog = factory.fixtureCatalog();
  return Object.assign({
    comments: [{
      id: "cmt_south_on_north",
      account_id: "acct_fixture_south",
      persona_id: "persona_south",
      post_id: "post_north",
      body: "South comment on North's post.",
    }],
    personas: catalog.personas.concat([{
      id: "persona_draft",
      owner: "acct_fixture_south",
      handle: "fixture_draft",
      name: "Unpublished",
      visibility: "public",
      publication_state: "draft",
    }]),
    posts: catalog.posts.concat([{
      id: "post_draft",
      persona_id: "persona_draft",
      kind: "update",
      body: "Not published.",
      created_at: "2026-09-20T00:02:00.000Z",
    }]),
  }, extra);
}

async function signedInClient(factory, seed) {
  const transport = factory.createMemoryTransport(seed || seedWithComment(factory));
  const client = factory.createClient({ transport });
  const signed = await client.signInWithPassword(NORTH);
  assert.equal(signed.ok, true);
  return { client, transport };
}

test("reports fail closed without a session and staff RPCs are refused by contract", async () => {
  const { factory, contract } = await loadClient();
  const client = factory.createClient({ mode: "fixture" });
  const denied = await client.reportContent({ targetKind: "post", targetId: "post_south", reason: "spam" });
  assert.equal(denied.ok, false);
  assert.equal(denied.error.code, "unsigned");
  const mine = await client.myReports();
  assert.equal(mine.ok, false);
  assert.equal(mine.error.code, "unsigned");

  await client.signInWithPassword(NORTH);
  for (const name of contract.staffOnlyRpcs) {
    assert.equal(name in contract.allowedRpcs, false, `${name} must not be a client RPC`);
    const staff = await client.callRpc(name, {});
    assert.equal(staff.ok, false);
    assert.equal(staff.error.code, "staff-surface");
  }
  assert.equal(contract.allowedRpcs.report_content.server, "080");
  assert.equal(contract.allowedRpcs.my_content_reports.writes, false);
});

test("client validates report kind, reason, and length before any call", async () => {
  const { factory, contract } = await loadClient();
  const { client, transport } = await signedInClient(factory);
  for (const input of [
    { targetKind: "album", targetId: "x", reason: "spam" },
    { targetKind: "post", targetId: "", reason: "spam" },
    { targetKind: "post", targetId: "post_south", reason: "rude" },
    { targetKind: "post", targetId: "post_south", reason: "spam", details: "x".repeat(contract.reportDetailsMax + 1) },
  ]) {
    const result = await client.reportContent(input);
    assert.equal(result.ok, false);
    assert.equal(result.error.code, "invalid-report");
  }
  assert.equal(transport._state.reports.length, 0);
});

test("report, duplicate, own content, and not-found paths match the server rules", async () => {
  const { factory } = await loadClient();
  const { client, transport } = await signedInClient(factory);

  const first = await client.reportContent({
    targetKind: "post",
    targetId: "post_south",
    reason: "harassment",
    details: "  repeated   insults ",
    reporterPersonaId: "persona_north",
  });
  assert.equal(first.ok, true);
  assert.equal(first.duplicate, false);
  assert.equal(first.data.queued, true);
  assert.equal("target_owner" in first.data, false);
  assert.match(first.message, /staff review queue/i);
  assert.equal(transport._state.reports[0].details, "repeated insults");

  const again = await client.reportContent({ targetKind: "post", targetId: "post_south", reason: "spam" });
  assert.equal(again.ok, true);
  assert.equal(again.duplicate, true);
  assert.equal(again.data.reportId, first.data.reportId);

  const comment = await client.reportContent({ targetKind: "comment", targetId: "cmt_south_on_north", reason: "hate" });
  assert.equal(comment.ok, true);
  const persona = await client.reportContent({ targetKind: "persona", targetId: "persona_south", reason: "impersonation" });
  assert.equal(persona.ok, true);

  const own = await client.reportContent({ targetKind: "post", targetId: "post_north", reason: "spam" });
  assert.equal(own.ok, false);
  assert.match(own.error.message, /cannot report your own/i);
  const draft = await client.reportContent({ targetKind: "post", targetId: "post_draft", reason: "spam" });
  assert.equal(draft.ok, false);
  assert.match(draft.error.message, /not found/i);
  const notMine = await client.reportContent({
    targetKind: "post", targetId: "post_south", reason: "spam", reporterPersonaId: "persona_south",
  });
  assert.equal(notMine.ok, false);
  assert.match(notMine.error.message, /must be yours/i);

  const mine = await client.myReports();
  assert.equal(mine.ok, true);
  assert.equal(mine.data.length, 3);
  for (const row of mine.data) {
    assert.equal("target_owner" in row, false);
    assert.equal("details" in row, false);
    assert.equal(row.state, "open");
  }
});

test("blocks: block-then-report works, being blocked reads as not found", async () => {
  const { factory } = await loadClient();
  const { client, transport } = await signedInClient(factory);

  const blocked = await client.setVisibilityRule({ otherPersonaId: "persona_south", kind: "block", enabled: true });
  assert.equal(blocked.ok, true);
  const afterOwnBlock = await client.reportContent({ targetKind: "post", targetId: "post_south", reason: "spam" });
  assert.equal(afterOwnBlock.ok, true, "own block still allows a report");

  await client.setVisibilityRule({ otherPersonaId: "persona_south", kind: "block", enabled: false });
  transport._state.visibilityRules.push({
    account_id: "acct_fixture_south",
    other_persona_id: "persona_north",
    kind: "block",
  });
  const blockedByThem = await client.reportContent({ targetKind: "persona", targetId: "persona_south", reason: "spam" });
  assert.equal(blockedByThem.ok, false);
  assert.match(blockedByThem.error.message, /not found/i);
  assert.doesNotMatch(blockedByThem.error.message, /block/i);
});

test("an undeployed report RPC is reported as not enabled, never as sent", async () => {
  const { factory } = await loadClient();
  const { client, transport } = await signedInClient(factory, seedWithComment(factory, {
    serverPending: ["report_content", "my_content_reports"],
  }));
  const report = await client.reportContent({ targetKind: "post", targetId: "post_south", reason: "spam" });
  assert.equal(report.ok, false);
  assert.equal(report.error.code, "reports-not-enabled");
  assert.match(report.error.message, /nothing was sent/i);
  assert.equal(transport._state.reports.length, 0);
  const mine = await client.myReports();
  assert.equal(mine.error.code, "reports-not-enabled");

  const calls = [];
  const http = factory.createClient({
    mode: "live",
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      if (url.includes("/rest/v1/rpc/report_content")) {
        return new Response(JSON.stringify({ code: "PGRST202", message: "Could not find the function" }), { status: 404 });
      }
      return new Response("{}", { status: 200 });
    },
    session: { access_token: "token", user: { id: "acct" } },
  });
  const live = await http.reportContent({ targetKind: "post", targetId: "p", reason: "spam" });
  assert.equal(live.ok, false);
  assert.equal(live.error.code, "reports-not-enabled");
  assert.equal(calls.length, 1);
  assert.match(calls[0].init.headers.Authorization, /^Bearer token$/);

  const other = factory.createClient({
    mode: "live",
    fetchImpl: async () => new Response(JSON.stringify({ code: "P0001", message: "Reported content was not found" }), { status: 400 }),
    session: { access_token: "token", user: { id: "acct" } },
  });
  const notFound = await other.reportContent({ targetKind: "post", targetId: "p", reason: "spam" });
  assert.equal(notFound.error.code, "http");
  assert.match(notFound.error.message, /not found/);
});

function localExport(state) {
  return {
    format: "aliaspaces.social.local",
    formatVersion: 1,
    mode: "local-demo",
    network: "offline-local",
    exportedAt: "2026-10-16T00:00:00.000Z",
    state: Object.assign({
      version: 1,
      mode: "local-demo",
      network: "offline-local",
      activeProfileId: null,
      profiles: [],
      posts: [],
      reactions: [],
      reports: [],
      blocks: [],
    }, state),
  };
}

const demoState = {
  profiles: [
    { id: "prf_me", handle: "me_local", displayName: "Me", source: "user" },
    { id: "prf_alt", handle: "alt_local", displayName: "Alt", source: "user" },
    { id: "prf_fixture", handle: "fixture_local", displayName: "Fixture", source: "fixture" },
  ],
  posts: [
    { id: "pst_2", authorProfileId: "prf_me", body: "second   post", source: "user", createdAt: "2026-09-02T00:00:00.000Z" },
    { id: "pst_1", authorProfileId: "prf_me", body: "first post", source: "user", createdAt: "2026-09-01T00:00:00.000Z" },
    { id: "pst_alt", authorProfileId: "prf_alt", body: "alt post", source: "user", createdAt: "2026-09-03T00:00:00.000Z" },
    { id: "pst_fx", authorProfileId: "prf_fixture", body: "fixture post", source: "fixture", createdAt: "2026-09-04T00:00:00.000Z" },
    { id: "pst_empty", authorProfileId: "prf_me", body: "   ", source: "user", createdAt: "2026-09-05T00:00:00.000Z" },
  ],
  reactions: [{ actorProfileId: "prf_alt", postId: "pst_1" }],
  reports: [{ id: "rpt_1" }],
  blocks: [{ blockerProfileId: "prf_me", blockedProfileId: "prf_alt" }],
};

test("local-demo import plan maps only chosen profiles onto owned personas", async () => {
  const { factory, contract } = await loadClient();
  assert.throws(() => factory.planLocalDemoImport({ format: "something-else" }), /not an AliaSpaces local-demo export/);
  const claimsNetwork = localExport(demoState);
  claimsNetwork.network = "online";
  assert.throws(() => factory.planLocalDemoImport(claimsNetwork), /claims a network/);
  assert.throws(() => factory.planLocalDemoImport(localExport(demoState), {
    ownedPersonaIds: ["persona_north"],
    mapping: { prf_me: "persona_south" },
  }), /personas you own/);

  const plan = factory.planLocalDemoImport(localExport(demoState), {
    ownedPersonaIds: ["persona_north"],
    mapping: { prf_me: "persona_north" },
  });
  assert.deepEqual([...plan.items.map((item) => item.localPostId)], ["pst_1", "pst_2"]);
  assert.equal(plan.items[1].body, "second post");
  assert.ok(plan.items.every((item) => item.personaId === "persona_north" && item.tags === contract.localImportTag));
  const reasons = Object.fromEntries(plan.skipped.map((item) => [item.localPostId, item.reason]));
  assert.deepEqual(reasons, { pst_alt: "unmapped-profile", pst_fx: "fixture", pst_empty: "empty" });
  assert.deepEqual({ ...plan.notImported }, { reactions: 1, reports: 1, blocks: 1 });
  assert.deepEqual([...plan.profiles.map((item) => item.id)], ["prf_me", "prf_alt"]);
  assert.match(plan.warning, /review-gated draft/);
});

test("local-demo import writes review-gated drafts only, and only for owned personas", async () => {
  const { factory } = await loadClient();
  const unsigned = factory.createClient({ mode: "fixture" });
  const refused = await unsigned.importLocalDemoDrafts({ items: [] });
  assert.equal(refused.error.code, "unsigned");

  const { client, transport } = await signedInClient(factory);
  const before = transport._state.posts.length;
  const forged = {
    items: [{ localPostId: "pst_1", personaId: "persona_south", body: "forged", tags: "aliaspaces-local-import" }],
  };
  const blocked = await client.importLocalDemoDrafts(forged);
  assert.equal(blocked.ok, false);
  assert.equal(blocked.error.code, "not-your-persona");
  assert.equal(transport._state.posts.length, before, "nothing written for a forged plan");

  const plan = client.planLocalDemoImport(localExport(demoState), {
    ownedPersonaIds: ["persona_north"],
    mapping: { prf_me: "persona_north" },
  });
  const result = await client.importLocalDemoDrafts(plan);
  assert.equal(result.ok, true);
  assert.equal(result.imported, 2);
  assert.equal(result.published, false);
  assert.equal(result.reviewRequired, true);
  assert.match(result.message, /Nothing was published/);
  const created = transport._state.posts.slice(0, 2);
  assert.ok(created.every((post) => post.persona_id === "persona_north" && post.publication_state === "draft"));
  assert.ok(created.every((post) => post.tags === "aliaspaces-local-import"));
  assert.equal(transport._state.reactions.length, 0);
  assert.equal(transport._state.visibilityRules.length, 0);
});

test("savePost sends tags as text, matching save_persona_post(p_tags text)", async () => {
  const { factory } = await loadClient();
  const { client, transport } = await signedInClient(factory);
  await client.savePost({ personaId: "persona_north", body: "tagged", tags: ["one", " two "] });
  await client.savePost({ personaId: "persona_north", body: "untagged" });
  assert.equal(transport._state.posts[1].tags, "one, two");
  assert.equal(transport._state.posts[0].tags, "");
});

test("live app wires report, my reports, and import without claiming success", async () => {
  const app = await readFile(path.join(appRoot, "src/live/live-app.js"), "utf8");
  assert.match(app, /reportForm\("persona", openPersona\.id, openPersona\.id\)/);
  assert.match(app, /name="alsoBlock"/);
  assert.match(app, /client\.reportContent\(/);
  assert.match(app, /client\.myReports\(/);
  assert.match(app, /client\.importLocalDemoDrafts\(/);
  assert.match(app, /reports-not-enabled/);
  assert.match(app, /No report was sent/);
  assert.doesNotMatch(app, /Content reports are not a first-party RPC yet/);
  assert.doesNotMatch(app, /Server-side block projections remain an owner-gated migration/);
  assert.doesNotMatch(app, /Hidden-by-block is applied here as a client filter/);
});
