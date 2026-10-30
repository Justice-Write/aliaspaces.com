// Fixture-only browser smoke for the report and local-demo import flows.
// No production reads or writes: the page runs on the fixture transport.
//   node apps/social-mobile/scripts/report-import-smoke.mjs
//   SMOKE_OUT=/some/dir node apps/social-mobile/scripts/report-import-smoke.mjs
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = process.env.SMOKE_OUT || path.join(os.tmpdir(), "aliaspaces-smoke");
await mkdir(outDir, { recursive: true });
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
};

const server = createServer(async (request, response) => {
  const url = new URL(request.url || "/", "http://127.0.0.1");
  const relative = url.pathname === "/" ? "live.html" : url.pathname.slice(1);
  const file = path.normalize(path.join(appRoot, relative));
  if (!file.startsWith(appRoot)) {
    response.writeHead(403).end();
    return;
  }
  try {
    const body = await readFile(file);
    response.writeHead(200, { "content-type": types[path.extname(file)] || "application/octet-stream" });
    response.end(body);
  } catch {
    response.writeHead(404).end("not found");
  }
});

const exportFile = path.join(outDir, "local-demo-export.json");
await writeFile(exportFile, JSON.stringify({
  format: "aliaspaces.social.local",
  formatVersion: 1,
  mode: "local-demo",
  network: "offline-local",
  exportedAt: "2026-10-16T00:00:00.000Z",
  warning: "Local demo export.",
  state: {
    version: 1,
    mode: "local-demo",
    network: "offline-local",
    activeProfileId: "prf_me",
    profiles: [
      { id: "prf_me", handle: "me_local", displayName: "Me", source: "user" },
      { id: "prf_fx", handle: "fixture_local", displayName: "Fixture", source: "fixture" },
    ],
    posts: [
      { id: "pst_1", authorProfileId: "prf_me", body: "Local post one", source: "user", createdAt: "2026-09-01T00:00:00.000Z" },
      { id: "pst_2", authorProfileId: "prf_me", body: "Local post two", source: "user", createdAt: "2026-09-02T00:00:00.000Z" },
      { id: "pst_fx", authorProfileId: "prf_fx", body: "Fixture post", source: "fixture", createdAt: "2026-09-03T00:00:00.000Z" },
    ],
    reactions: [],
    reports: [],
    blocks: [],
  },
}));

async function signIn(page) {
  await page.getByRole("button", { name: "You" }).click();
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.locator("#toast").getByText("Verified session").waitFor();
}

async function openSouthAndReport(page) {
  await page.getByRole("button", { name: "Discover" }).click();
  await page.locator("#panel-discover article", { hasText: "@fixture_south" }).getByRole("button", { name: "Open" }).click();
  await page.getByText("Fixture post from South").waitFor();
  const card = page.locator("article", { hasText: "Fixture post from South" });
  await card.locator("summary", { hasText: "Report" }).click();
  await card.locator("select[name='reason']").selectOption("harassment");
  await card.locator("textarea[name='details']").fill("Smoke test report");
  return card;
}

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const { port } = server.address();
const browser = await chromium.launch({ headless: true });
const results = {};

try {
  // Report flow, with "also block".
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(`http://127.0.0.1:${port}/live.html?demo=1`, { waitUntil: "networkidle" });
  await signIn(page);
  const card = await openSouthAndReport(page);
  await page.screenshot({ path: path.join(outDir, "report-form.png"), fullPage: true });
  await card.locator("input[name='alsoBlock']").check();
  await card.getByRole("button", { name: "Send report" }).click();
  await page.locator("#toast").getByText(/Report sent to the staff review queue/).waitFor();
  assert.match(await page.locator("#toast").innerText(), /Persona blocked/);
  await page.getByRole("button", { name: "Safety" }).click();
  await page.locator("#panel-safety").getByText("Harassment or bullying").waitFor();
  assert.match(await page.locator("#panel-safety").innerText(), /open/);
  await page.screenshot({ path: path.join(outDir, "report-sent.png"), fullPage: true });
  results.reportSent = true;
  results.alsoBlocked = true;

  // Import flow.
  await page.getByRole("button", { name: "You" }).click();
  await page.locator("#importFile").setInputFiles(exportFile);
  await page.locator("#importForm").waitFor();
  assert.equal(await page.locator("#importForm select").count(), 1, "fixture profile is not offered");
  await page.locator("select[name='map:prf_me']").selectOption({ label: "@fixture_north" });
  await page.screenshot({ path: path.join(outDir, "import-mapping.png"), fullPage: true });
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Import as review drafts" }).click();
  await page.locator("#toast").getByText(/2 of 2 local posts saved as review-gated drafts\. Nothing was published\./).waitFor();
  await page.screenshot({ path: path.join(outDir, "import-done.png"), fullPage: true });
  results.importedDrafts = 2;
  await page.close();

  // Server not migrated yet: the app must say nothing was sent.
  const pending = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await pending.addInitScript(() => {
    Object.defineProperty(window, "AliaSpacesLiveTransport", {
      configurable: true,
      get() {
        return window.AliaSpacesLiveClient.createMemoryTransport({
          serverPending: ["report_content", "my_content_reports"],
        });
      },
    });
  });
  await pending.goto(`http://127.0.0.1:${port}/live.html?demo=1`, { waitUntil: "networkidle" });
  await signIn(pending);
  const pendingCard = await openSouthAndReport(pending);
  await pendingCard.locator("input[name='alsoBlock']").check();
  await pendingCard.getByRole("button", { name: "Send report" }).click();
  await pending.locator("#toast").getByText(/Reporting is not enabled on the server yet\. No report was sent\./).waitFor();
  assert.match(await pending.locator("#toast").innerText(), /Persona blocked/, "the block still applies");
  await pending.getByRole("button", { name: "Safety" }).click();
  await pending.locator("#panel-safety").getByText(/not enabled on the server yet/).waitFor();
  assert.doesNotMatch(await pending.locator("#panel-safety").innerText(), /Harassment or bullying/);
  await pending.screenshot({ path: path.join(outDir, "report-not-enabled.png"), fullPage: true });
  results.reportsNotEnabledHonest = true;
  await pending.close();

  console.log(JSON.stringify({ ok: true, outDir, ...results }, null, 2));
} finally {
  await browser.close();
  server.close();
}
