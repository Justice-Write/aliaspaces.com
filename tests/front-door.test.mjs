import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("both transition pages preserve the complete route without collecting data", async () => {
  for (const filename of ["index.html", "404.html"]) {
    const source = await readFile(path.join(repoRoot, filename), "utf8");
    assert.match(source, /<meta name="robots" content="noindex,follow">/);
    assert.match(source, /default-src 'none'/);
    assert.match(source, /form-action 'none'/);
    assert.match(
      source,
      /new URL\(location\.pathname \+ location\.search \+ location\.hash, "https:\/\/mypersonas\.online"\)/,
    );
    assert.doesNotMatch(source, /<form\b/i);
    assert.doesNotMatch(source, /\b(?:analytics|gtag|pixel|telemetry)\b/i);
  }
});

test("the Pages workflow is main-only, pinned, and allowlists only the front door", async () => {
  const source = await readFile(path.join(repoRoot, ".github", "workflows", "pages.yml"), "utf8");
  assert.match(source, /if: github\.ref == 'refs\/heads\/main'/);

  const actionLines = source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- uses:") || line.startsWith("uses:"));
  for (const line of actionLines) {
    assert.match(
      line,
      /^(?:- )?uses: [A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+@[0-9a-f]{40}(?:\s+#\s+.+)?$/,
      `mutable or malformed action reference: ${line}`,
    );
  }

  const includedFiles = [...source.matchAll(/--include '\/([^']+)'/g)].map((match) => match[1]);
  assert.deepEqual(includedFiles, ["index.html", "404.html", "favicon.svg", "CNAME", ".nojekyll"]);
  assert.match(source, /--exclude '\*'/);
  assert.doesNotMatch(source, /--include '\/(?:apps|docs|supabase|tests|scripts)\//);
});
