import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyBackendReceipt } from '../scripts/verify-backend-receipt.mjs';
const pin = 'a'.repeat(40);
const valid = `sha=${pin}\nscope=image-caption-drafting\nfunctions=ai-proxy compose-post\n`;
test('backend receipt binds the exact deployment, scope and function set', () => {
  assert.equal(verifyBackendReceipt(valid, pin), true);
  assert.equal(verifyBackendReceipt(valid.replaceAll('\n', '\r\n'), pin), true);
  for (const invalid of [
    valid.replace(pin, 'b'.repeat(40)), valid.replace('image-caption-drafting', 'other'),
    valid.replace('ai-proxy compose-post', 'ai-proxy'), valid + 'canary=claimed\n',
    valid + `sha=${pin}\n`, valid.replace('scope=image-caption-drafting\n', ''), '',
  ]) assert.throws(() => verifyBackendReceipt(invalid, pin), /does not exactly match/);
  assert.throws(() => verifyBackendReceipt(valid, 'short'), /exact source pin/);
});
