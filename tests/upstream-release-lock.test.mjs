import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('social deployment requires two upstream receipts and checks live holding lock immediately before publish', async () => {
  const workflow = await readFile(new URL('../.github/workflows/pages.yml', import.meta.url), 'utf8');
  assert.match(workflow, /run-name: AliaSpaces social release lease \$\{\{ inputs.upstream_release_run_id \}\}/);
  assert.match(workflow, /timeout-minutes: 20/);
  assert.match(workflow, /social-release-lease-\$\{\{ inputs.upstream_release_run_id \}\}/);
  assert.match(workflow, /social-release-consumer-\$\{\{ inputs.upstream_release_run_id \}\}/);
  assert.equal((workflow.match(/social-release-lease.mjs verify-consumer/g) || []).length, 2);
  assert.ok(workflow.indexOf('social-release-lease.mjs wait-claim') < workflow.indexOf('name: Require an active exact-release upstream backend lock'));
  const before = workflow.indexOf('name: Recheck the upstream lock immediately before Pages publication');
  assert.ok(before > workflow.indexOf('name: Recheck backend run and both main revisions'));
  assert.ok(before < workflow.indexOf('uses: actions/deploy-pages@'));
  assert.doesNotMatch(workflow, /secrets\.(PAT|GH_TOKEN|SUPABASE_ACCESS_TOKEN)/);
});
