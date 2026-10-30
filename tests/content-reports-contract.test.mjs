import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function loadContract() {
  const sandbox = { module: { exports: {} } };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(await readFile(path.join(root, "apps/social-mobile/src/live/contract.js"), "utf8"), sandbox);
  return sandbox.AliaSpacesLiveContract.CONTRACT;
}

function tableAfter(markdown, heading) {
  const start = markdown.indexOf(heading);
  assert.ok(start >= 0, `${heading} present`);
  const rows = markdown.slice(start).split("\n").slice(1);
  const values = [];
  let inTable = false;
  for (const row of rows) {
    if (row.startsWith("|")) {
      inTable = true;
      const match = row.match(/^\| `([a-z_]+)` \|$/);
      if (match) values.push(match[1]);
    } else if (inTable) {
      break;
    }
  }
  return values;
}

test("client contract matches the versioned content-reports interface", async () => {
  const [contract, doc] = await Promise.all([
    loadContract(),
    readFile(path.join(root, "contracts/content-reports.md"), "utf8"),
  ]);
  assert.deepEqual([...contract.reportReasons], tableAfter(doc, "Reasons:"));
  assert.deepEqual([...contract.reportTargetKinds], tableAfter(doc, "Target kinds:"));
  assert.match(doc, new RegExp(`≤ ${contract.reportDetailsMax} chars`));
  for (const name of ["report_content", "my_content_reports"]) {
    assert.match(doc, new RegExp(`\\| \`${name}\` \\|`));
    assert.ok(contract.allowedRpcs[name], `${name} allowed in the client`);
  }
  for (const name of contract.staffOnlyRpcs) {
    assert.match(doc, new RegExp(`\`${name}\``), `${name} documented as staff-only`);
    assert.equal(contract.allowedRpcs[name], undefined);
  }
  assert.match(doc, /PROJECT-BOUNDARY\.md/);
});
