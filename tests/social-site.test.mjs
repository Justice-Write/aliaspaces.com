import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { execFileSync } from 'node:child_process';
import {
  buildFrontDoor, buildSocialSite, readPin, rewriteHead, rewriteManifest, rewriteOffline, rewriteWorker, FRONT_DOOR_FILES,
} from "../scripts/build-social-site.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const HEAD = `<!DOCTYPE html><html><head>
<title>MyPersonas — your private creative workspace</title>
<meta name="description" content="Organize your personas.">
<meta name="apple-mobile-web-app-title" content="MyPersonas">
<link rel="canonical" href="https://mypersonas.online/">
<meta property="og:site_name" content="MyPersonas">
<meta property="og:title" content="MyPersonas">
<meta property="og:description" content="Owner workspace.">
<meta property="og:image" content="https://mypersonas.online/assets/hero.png">
<meta property="og:url" content="https://mypersonas.online/">
<meta name="twitter:title" content="MyPersonas">
<meta name="twitter:description" content="Owner workspace.">
<meta name="twitter:image" content="https://mypersonas.online/assets/hero.png">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"WebSite","name":"AliaSpaces","url":"https://mypersonas.online/"}</script>
<script src="./domain-split.js?v=20261031-1"></script>
</head><body><header><h1 id="siteIdentity" onclick="go('')">MyPersonas</h1></header></body></html>`;

// Mirrors the MyPersonas rule shape; the real build imports MyPersonas's own audit.
const AUDIT = `import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
export function parseIncludes(text) {
  const block = text.match(/rsync -a --delete[\\s\\S]*?"\\$\\{SITE_DIR\\}\\/" \\.pages-artifact\\//)?.[0];
  if (!block || !block.includes("--exclude '*'")) throw new Error("Unrecognized Pages packaging rule");
  return [...block.matchAll(/--include '([^']+)'/g)].map((m) => m[1]);
}
export function selected(relative, rules) {
  return rules.some((rule) => rule.endsWith("/***") ? relative.startsWith(rule.slice(1, -3)) : !rule.endsWith("/") && relative === rule.slice(1));
}
async function list(root, keep, prefix = "") {
  const out = [];
  for (const e of await readdir(path.join(root, prefix), { withFileTypes: true })) {
    const rel = prefix ? prefix + "/" + e.name : e.name;
    if (e.isDirectory()) out.push(...await list(root, keep, rel)); else if (keep(rel)) out.push(rel);
  }
  return out.sort();
}
export async function audit({ source, workflow, artifact }) {
  const text = await readFile(workflow, "utf8");
  const rules = parseIncludes(text);
  const expected = await list(source, (r) => selected(r, rules));
  const actual = await list(artifact, () => true);
  const failures = [];
  for (const f of actual) if (!expected.includes(f)) failures.push("Unexpected artifact member: " + f);
  for (const f of expected) if (!actual.includes(f)) failures.push("Missing artifact member: " + f);
  return { status: failures.length ? "FAIL" : "BYTE_PARITY_ONLY", failures, workflowSha256: createHash("sha256").update(text).digest("hex") };
}
`;

async function fixture({ withSplit = true, head = HEAD } = {}) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "aliaspaces-social-"));
  const src = path.join(dir, "mypersonas");
  const site = path.join(src, "MyPersonas.Online_v0");
  await mkdir(path.join(site, "assets"), { recursive: true });
  await mkdir(path.join(site, "private"), { recursive: true });
  await mkdir(path.join(src, ".github", "workflows"), { recursive: true });
  await mkdir(path.join(src, "scripts"), { recursive: true });
  await writeFile(path.join(site, "index.html"), head);
  if (withSplit) await writeFile(path.join(site, "domain-split.js"), "// split");
  await writeFile(path.join(site, "CNAME"), "mypersonas.online\n");
  await writeFile(path.join(site, "robots.txt"), "Sitemap: https://mypersonas.online/sitemap.xml\n");
  await writeFile(path.join(site, "sitemap.xml"), "<urlset/>");
  await writeFile(path.join(site, 'manifest.webmanifest'), JSON.stringify({ id: './', scope: './', start_url: './', name: 'MyPersonas', short_name: 'MyPersonas', display: 'standalone', icons: [{ src: './icon-192.png', sizes: '192x192', type: 'image/png' }], shortcuts: [{ name: 'Studio', url: './#/studio' }] }));
  await writeFile(path.join(site, 'offline.html'), '<html><head><title>Offline — MyPersonas</title></head><body><h1>You’re offline</h1><p>MyPersonas management.</p><a href="./">Try again</a></body></html>');
  await writeFile(path.join(site, 'service-worker.js'), 'const CACHE_PREFIX = "mypersonas-public-shell-";\nconst CACHE_NAME = `${CACHE_PREFIX}old`;\n// network-only owner content\n');
  await writeFile(path.join(site, "assets", "hero.png"), "png");
  await writeFile(path.join(site, "private", "notes.json"), "{}");
  await writeFile(path.join(site, "status-handoff.md"), "local notes");
  const includes = ["/index.html", "/domain-split.js", "/manifest.webmanifest", "/offline.html", "/service-worker.js", "/CNAME", "/robots.txt", "/sitemap.xml", "/assets/", "/assets/***"]
    .map((rule) => `--include '${rule}'`).join(" ");
  await writeFile(path.join(src, ".github", "workflows", "pages.yml"),
    `rsync -a --delete ${includes} --exclude '*' "\${SITE_DIR}/" .pages-artifact/\n`);
  await writeFile(path.join(src, "scripts", "audit-public-package.mjs"), AUDIT);
  execFileSync('git', ['init', '-q', src]);
  execFileSync('git', ['-C', src, 'config', 'core.autocrlf', 'false']);
  execFileSync('git', ['-C', src, 'add', '.']);
  await mkdir(path.join(dir, 'empty-hooks'));
  execFileSync('git', ['-C', src, '-c', 'user.name=Synthetic fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgsign=false', '-c', `core.hooksPath=${path.join(dir, 'empty-hooks')}`, 'commit', '-qm', 'Synthetic public package fixture']);
  const commit = execFileSync('git', ['-C', src, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const pinFile = path.join(dir, 'pin.json');
  await writeFile(pinFile, JSON.stringify({ ...await readPin(), commit }));
  return { dir, src, site, pinFile, out: path.join(dir, "out") };
}

async function tree(root, prefix = "") {
  const out = [];
  for (const e of await readdir(path.join(root, prefix), { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...await tree(root, rel)); else out.push(rel);
  }
  return out.sort();
}

test("the pin names a full MyPersonas commit and the domain-split rule", async () => {
  const pin = await readPin();
  assert.equal(pin.repository, "Justice-Write/MyPersonas");
  assert.match(pin.commit, /^[0-9a-f]{40}$/);
  assert.equal(pin.siteDir, "MyPersonas.Online_v0");
  assert.equal(pin.workflow, ".github/workflows/pages.yml");
  assert.match(pin.rule, /MyPersonas main/);
});

test("unsafe or foreign pins are refused", async (t) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "aliaspaces-pin-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const base = JSON.parse(await readFile(path.join(repoRoot, "SOCIAL-SITE-SOURCE.json"), "utf8"));
  for (const [label, change] of [
    ["fork", { repository: "someone/MyPersonas" }],
    ["short sha", { commit: "98ca542" }],
    ["traversal", { siteDir: "../outside" }],
    ["absolute", { workflow: "/etc/passwd" }],
  ]) {
    const file = path.join(dir, `${label}.json`);
    await writeFile(file, JSON.stringify({ ...base, ...change }));
    await assert.rejects(readPin(file), undefined, label);
  }
});

test("social build copies exactly the MyPersonas public files and applies the aliaspaces.com identity", async (t) => {
  const f = await fixture();
  t.after(() => rm(f.dir, { recursive: true, force: true }));
  const result = await buildSocialSite({ source: f.src, out: f.out, pinFile: f.pinFile });
  assert.deepEqual(await tree(f.out), [
    ".nojekyll", "404.html", "CNAME", "assets/hero.png", "domain-split.js", "index.html",
    "manifest.webmanifest", "offline.html", "robots.txt", "service-worker.js", "sitemap.xml", "social-site-source.json",
  ]);
  assert.equal(await readFile(path.join(f.out, "CNAME"), "utf8"), "aliaspaces.com\n");
  const html = await readFile(path.join(f.out, "index.html"), "utf8");
  assert.match(html, /<title>AliaSpaces — every persona, one home<\/title>/);
  assert.match(html, /<link rel="canonical" href="https:\/\/aliaspaces\.com\/">/);
  assert.match(html, /<meta property="og:url" content="https:\/\/aliaspaces\.com\/">/);
  assert.match(html, /<meta property="og:image" content="https:\/\/aliaspaces\.com\/assets\/hero\.png">/);
  assert.match(html, /"url":"https:\/\/aliaspaces\.com\/"/);
  assert.match(html, /<h1 id="siteIdentity" onclick="go\(''\)">AliaSpaces<\/h1>/);
  assert.doesNotMatch(html, /mypersonas\.online/);
  assert.doesNotMatch(html, /anonymous|never linked|unlinkab/i, 'metadata must not claim unverified anonymity');
  assert.match(await readFile(path.join(f.out, "robots.txt"), "utf8"), /Sitemap: https:\/\/aliaspaces\.com\/sitemap\.xml/);
  assert.doesNotMatch(await readFile(path.join(f.out, "sitemap.xml"), "utf8"), /mypersonas\.online|provider-setup/);
  const provenance = JSON.parse(await readFile(path.join(f.out, "social-site-source.json"), "utf8"));
  assert.equal(provenance.commit, (await readPin(f.pinFile)).commit);
  assert.equal(provenance.copiedFiles, 9);
  const manifest = JSON.parse(await readFile(path.join(f.out, 'manifest.webmanifest'), 'utf8'));
  assert.equal(manifest.short_name, 'AliaSpaces');
  assert.deepEqual([manifest.id, manifest.scope, manifest.start_url], ['./', './', './']);
  assert.ok(manifest.shortcuts.every(x => !/studio|discovery|mypersonas/i.test(JSON.stringify(x))));
  assert.doesNotMatch(await readFile(path.join(f.out, 'offline.html'), 'utf8'), /MyPersonas/);
  assert.match(await readFile(path.join(f.out, 'service-worker.js'), 'utf8'), /aliaspaces-public-shell-/);
  assert.deepEqual(result, provenance);
});

test('social install identity is preserved and owner shortcuts cannot leak into the social manifest', () => {
  const original = { id: './', scope: './', start_url: './', display: 'standalone', icons: [{ src: './icon-192.png', sizes: '192x192', purpose: 'any' }], shortcuts: [{ name: 'Owner', url: './#/studio' }] };
  const social = JSON.parse(rewriteManifest(JSON.stringify(original)));
  assert.deepEqual(social.icons, original.icons);
  assert.equal(social.display, original.display);
  assert.deepEqual(social.categories, ['social']);
  assert.deepEqual(social.shortcuts.map(x => x.url), ['./', './#/search', './sites.html']);
  for (const key of ['id', 'scope', 'start_url']) assert.throws(() => rewriteManifest(JSON.stringify({ ...original, [key]: '/new-app/' })), /installation identity/);
  const source = 'const CACHE_PREFIX = "mypersonas-public-shell-";\nconst CACHE_NAME = `${CACHE_PREFIX}old`;\nfetch(request); // API policy unchanged';
  const worker = rewriteWorker(source, 'a'.repeat(40));
  assert.equal(worker.split('\n').slice(2).join('\n'), source.split('\n').slice(2).join('\n'));
  assert.match(worker, /\$\{CACHE_PREFIX\}aaaaaaaaaaaa/);
  assert.throws(() => rewriteWorker('unknown structure', 'a'.repeat(40)), /Unexpected/);
  assert.throws(() => rewriteOffline('<html>changed</html>'), /Unexpected/);
});

test("social build refuses a MyPersonas build without the domain split", async (t) => {
  const f = await fixture({ withSplit: false });
  t.after(() => rm(f.dir, { recursive: true, force: true }));
  await assert.rejects(buildSocialSite({ source: f.src, out: f.out, pinFile: f.pinFile }), /no domain-split\.js/);
});

test("social build refuses a changed head instead of shipping MyPersonas metadata", async (t) => {
  const f = await fixture({ head: HEAD.replace(/<link rel="canonical"[^>]*>\n/, "") });
  t.after(() => rm(f.dir, { recursive: true, force: true }));
  await assert.rejects(buildSocialSite({ source: f.src, out: f.out, pinFile: f.pinFile }), /expected exactly one canonical, found 0/);
  assert.throws(() => rewriteHead(HEAD.replace("</head>", '<link rel="preconnect" href="https://mypersonas.online"></head>')), /still names mypersonas\.online/);
});

test("social build refuses symlinks inside the public site", async (t) => {
  const f = await fixture();
  t.after(() => rm(f.dir, { recursive: true, force: true }));
  await symlink(path.join(f.site, "private", "notes.json"), path.join(f.site, "assets", "linked.json"));
  await assert.rejects(buildSocialSite({ source: f.src, out: f.out, pinFile: f.pinFile }), /Refusing symlink/);
});

test('pin provenance refuses wrong revisions, dirty public bytes and untracked public files', async t => {
  const f = await fixture();
  t.after(() => rm(f.dir, { recursive: true, force: true }));
  const pin = await readPin(f.pinFile);
  await writeFile(f.pinFile, JSON.stringify({ ...pin, commit: '0'.repeat(40) }));
  await assert.rejects(buildSocialSite({ source: f.src, out: f.out, pinFile: f.pinFile }), /does not match pin/);
  await writeFile(f.pinFile, JSON.stringify(pin));
  await writeFile(path.join(f.site, 'assets', 'unexpected.json'), '{}');
  await assert.rejects(buildSocialSite({ source: f.src, out: f.out, pinFile: f.pinFile }), /not committed/);
  await rm(path.join(f.site, 'assets', 'unexpected.json'));
  await writeFile(path.join(f.site, 'index.html'), HEAD + '<!-- uncommitted -->');
  await assert.rejects(buildSocialSite({ source: f.src, out: f.out, pinFile: f.pinFile }), /uncommitted changes/);
});

test("front-door rollback artifact is the old five-file redirect", async (t) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "aliaspaces-door-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await buildFrontDoor({ out: dir });
  assert.deepEqual(await tree(dir), [".nojekyll", "404.html", "CNAME", "favicon.svg", "index.html"]);
  assert.deepEqual(FRONT_DOOR_FILES.map(([, to]) => to).sort(), [".nojekyll", "404.html", "CNAME", "favicon.svg", "index.html"]);
  assert.match(await readFile(path.join(dir, "index.html"), "utf8"), /https:\/\/mypersonas\.online/);
});

test("aliaspaces 404 stays on aliaspaces.com and collects nothing", async () => {
  const html = await readFile(path.join(repoRoot, "site", "404.html"), "utf8");
  assert.match(html, /default-src 'none'/);
  assert.match(html, /form-action 'none'/);
  assert.doesNotMatch(html, /mypersonas\.online|<form\b|analytics|gtag/i);
  assert.match(html, /location\.replace\("\/" \+ location\.hash\)/);
});

test("the workflow publishes the pinned build by default and the front door only on request", async () => {
  const wf = await readFile(path.join(repoRoot, ".github", "workflows", "pages.yml"), "utf8");
  assert.match(wf, /ARTIFACT: \$\{\{ inputs\.artifact \|\| 'social-site' \}\}/);
  assert.match(wf, /options: \[social-site, front-door\]/);
  assert.match(wf, /repository: Justice-Write\/MyPersonas\n\s+ref: main\n\s+fetch-depth: 0/);
  assert.match(wf, /merge-base --is-ancestor "\$\{PIN\}" HEAD/);
  assert.match(wf, /node scripts\/build-social-site\.mjs --source \.social-src --out \.pages-artifact/);
  assert.match(wf, /node scripts\/build-social-site\.mjs --front-door --out \.pages-artifact/);
  assert.match(wf, /node --test tests\/\*\.test\.mjs\n\s+node scripts\/check-boundaries\.mjs/);
});

test('social deployment cannot bypass upstream backend receipt and owner canary gates', async () => {
  const wf = await readFile(path.join(repoRoot, '.github/workflows/pages.yml'), 'utf8');
  assert.doesNotMatch(wf, /^\s+push:/m);
  for (const value of ['MIGRATIONS-VERIFIED', 'PROVIDER-MIGRATIONS-VERIFIED', 'IMAGE-CAPTION-CANARY-VERIFIED']) assert.ok(wf.includes(value));
  assert.match(wf, /repository: Justice-Write\/MyPersonas\n\s+name: image-caption-backend-\$\{\{ steps.pin.outputs.commit \}\}/);
  assert.match(wf, /verify-backend-receipt\.mjs --pin "\$\{PIN\}" --receipt \.release-evidence\/image-caption-backend\.txt/);
  for (const field of ['head_sha', 'head_branch', 'event', 'status', 'conclusion', 'path']) assert.ok(wf.includes(`--jq .${field}`));
  assert.match(wf, /repos\/Justice-Write\/MyPersonas\/git\/ref\/heads\/main/);
  assert.match(wf, /repos\/\$\{GITHUB_REPOSITORY\}\/git\/ref\/heads\/main/);
  assert.ok(wf.indexOf('Recheck backend run') < wf.indexOf('uses: actions/deploy-pages'));
});
