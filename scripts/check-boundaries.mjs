import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const codeExtensions = new Set([".css", ".html", ".js", ".json", ".kt", ".mjs", ".xml"]);
const forbidden = [
  /agent[-_ ]board/i,
  /provider[-_ ]setup/i,
  /run[-_ ]tasks/i,
  /stripe[-_ ]webhook/i,
  /persona[-_ ]source[-_ ]library/i,
  /supabase_service_role_key/i,
  /service_role/i,
  /openai_api_key/i,
  /anthropic_api_key/i,
];

async function filesBelow(relative) {
  const start = path.join(root, relative);
  const output = [];
  async function walk(current) {
    let entries = [];
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch (error) {
      if (error && error.code === "ENOENT") return;
      throw error;
    }
    for (const entry of entries) {
      if (entry.name === "build" || entry.name === ".gradle" || entry.name === "www" || entry.name === "tests" || entry.name === "live") continue;
      const target = path.join(current, entry.name);
      if (entry.isDirectory()) await walk(target);
      else if (codeExtensions.has(path.extname(entry.name))) output.push(target);
    }
  }
  await walk(start);
  return output;
}

const sourceFiles = await filesBelow("apps/social-mobile");
const violations = [];
for (const file of sourceFiles) {
  const text = await readFile(file, "utf8");
  for (const pattern of forbidden) {
    if (pattern.test(text)) violations.push(`${path.relative(root, file)} matches ${pattern}`);
  }
}
assert.deepEqual(violations, [], `Control-plane code crossed the AliaSpaces mobile boundary:\n${violations.join("\n")}`);

const pages = await readFile(path.join(root, ".github/workflows/pages.yml"), "utf8");
assert.match(pages, /if: github\.ref == 'refs\/heads\/main'/);
for (const directory of ["apps", "contracts", "docs", "scripts"]) {
  assert.doesNotMatch(pages, new RegExp(`--include ['"]\\/${directory}`));
}

// aliaspaces.com serves the social site; the front door is only the rollback artifact.
const frontDoor = ["front-door/index.html", "front-door/404.html"];
for (const name of frontDoor) {
  const text = await readFile(path.join(root, name), "utf8");
  assert.match(text, /mypersonas\.online/);
}
assert.match(pages, /repository: Justice-Write\/MyPersonas/);
assert.match(pages, /merge-base --is-ancestor/);

console.log(`Boundary check passed for ${sourceFiles.length} mobile source files.`);
