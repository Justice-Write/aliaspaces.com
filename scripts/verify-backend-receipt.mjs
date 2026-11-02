import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function verifyBackendReceipt(receipt, pin) {
  if (!/^[0-9a-f]{40}$/.test(pin)) throw Error('Receipt requires an exact source pin');
  const lines = receipt.trim().split(/\r?\n/);
  const expected = [`sha=${pin}`, 'scope=image-caption-drafting', 'functions=ai-proxy compose-post'];
  if (lines.length !== expected.length || expected.some(line => lines.filter(x => x === line).length !== 1)) {
    throw Error('Backend receipt does not exactly match the pinned image-caption deployment');
  }
  return true;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const value = key => args[args.indexOf(key) + 1];
  if (!args.includes('--pin') || !args.includes('--receipt')) throw Error('Use --pin <SHA> --receipt <file>');
  verifyBackendReceipt(await readFile(value('--receipt'), 'utf8'), value('--pin'));
  console.log('Exact pinned backend receipt verified. This is not private-canary acceptance.');
}
