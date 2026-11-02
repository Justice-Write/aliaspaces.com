// Builds the aliaspaces.com Pages artifact.
//
//   node scripts/build-social-site.mjs --source <MyPersonas checkout> --out <dir>
//   node scripts/build-social-site.mjs --front-door --out <dir>
//
// Social site (default): copies exactly the public MyPersonas site files that
// MyPersonas publishes to mypersonas.online, using MyPersonas's own packaging
// rule and audit from the pinned checkout. Then it applies the aliaspaces.com
// identity: CNAME, head metadata and a 404 page. Owner ruling 2026-10-31:
// aliaspaces.com is the social site, mypersonas.online the management site.
//
// Front door: the old transition page that forwards to mypersonas.online. It is
// kept only as the rollback artifact.
import { copyFile, lstat, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execFileSync } from 'node:child_process';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const SOCIAL_ORIGIN = "https://aliaspaces.com";
export const PINNED_REPOSITORY = "Justice-Write/MyPersonas";
export const FRONT_DOOR_FILES = Object.freeze([
  ["front-door/index.html", "index.html"],
  ["front-door/404.html", "404.html"],
  ["favicon.svg", "favicon.svg"],
  ["CNAME", "CNAME"],
  [".nojekyll", ".nojekyll"],
]);

const SOCIAL_TITLE = "AliaSpaces — every persona, one home";
const SOCIAL_DESCRIPTION = "Create persona pages with social feeds, albums, music, friends and links to the accounts you choose to share.";
const SOCIAL_SHORT = "Persona pages, social feeds and links you choose to share.";

// Each rule must match exactly once, so a changed MyPersonas head fails the
// build instead of shipping MyPersonas metadata on aliaspaces.com.
export const HEAD_REWRITES = Object.freeze([
  ["title", /<title>[^<]*<\/title>/, `<title>${SOCIAL_TITLE}</title>`],
  ["description", /<meta name="description" content="[^"]*">/, `<meta name="description" content="${SOCIAL_DESCRIPTION}">`],
  ["canonical", /<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${SOCIAL_ORIGIN}/">`],
  ["og:site_name", /<meta property="og:site_name" content="[^"]*">/, `<meta property="og:site_name" content="AliaSpaces">`],
  ["og:title", /<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${SOCIAL_TITLE}">`],
  ["og:description", /<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${SOCIAL_SHORT}">`],
  ["og:image", /<meta property="og:image" content="https:\/\/mypersonas\.online\/([^"]*)">/, `<meta property="og:image" content="${SOCIAL_ORIGIN}/$1">`],
  ["og:url", /<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${SOCIAL_ORIGIN}/">`],
  ["twitter:title", /<meta name="twitter:title" content="[^"]*">/, `<meta name="twitter:title" content="${SOCIAL_TITLE}">`],
  ["twitter:description", /<meta name="twitter:description" content="[^"]*">/, `<meta name="twitter:description" content="${SOCIAL_SHORT}">`],
  ["twitter:image", /<meta name="twitter:image" content="https:\/\/mypersonas\.online\/([^"]*)">/, `<meta name="twitter:image" content="${SOCIAL_ORIGIN}/$1">`],
  ["apple title", /<meta name="apple-mobile-web-app-title" content="[^"]*">/, '<meta name="apple-mobile-web-app-title" content="AliaSpaces">'],
  ["site identity", /(<h1 id="siteIdentity"[^>]*>)[^<]*(<\/h1>)/, "$1AliaSpaces$2"],
]);

export function rewriteHead(html) {
  let output = html;
  for (const [name, pattern, replacement] of HEAD_REWRITES) {
    const global = new RegExp(pattern.source, "g");
    const count = [...output.matchAll(global)].length;
    if (count !== 1) throw new Error(`index.html: expected exactly one ${name}, found ${count}. Update HEAD_REWRITES.`);
    output = output.replace(pattern, replacement);
  }
  let websites = 0;
  output = output.replace(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g, (tag, body) => {
    const value = JSON.parse(body);
    if (value['@type'] !== 'WebSite') return tag;
    websites++;
    return `<script type="application/ld+json">${JSON.stringify({ ...value, name: 'AliaSpaces', url: `${SOCIAL_ORIGIN}/`, description: SOCIAL_SHORT }).replaceAll('<', '\\u003c')}</script>`;
  });
  if (websites !== 1) throw new Error(`index.html: expected exactly one WebSite JSON-LD, found ${websites}`);
  if (/mypersonas\.online/.test(output.slice(0, output.indexOf("</head>")))) {
    throw new Error("index.html head still names mypersonas.online after the aliaspaces.com rewrite.");
  }
  return output;
}

export function rewriteManifest(raw) {
  const value = JSON.parse(raw);
  for (const key of ['id', 'scope', 'start_url']) {
    if (value[key] !== './') throw new Error(`Manifest ${key} must remain ./; installation identity changes need separate review`);
  }
  return `${JSON.stringify({ ...value, name: SOCIAL_TITLE, short_name: 'AliaSpaces',
    description: SOCIAL_SHORT, categories: ['social'], shortcuts: [
      { name: 'AliaSpaces social home', short_name: 'Home', description: 'Open your AliaSpaces social home.', url: './', icons: value.icons?.filter(x => x.sizes === '192x192') || [] },
      { name: 'Search AliaSpaces', short_name: 'Search', description: 'Search public persona pages on AliaSpaces.', url: './#/search', icons: value.icons?.filter(x => x.sizes === '192x192') || [] },
      { name: 'Sites and apps to check', short_name: 'Check', description: 'Open the public AliaSpaces availability checklist.', url: './sites.html' },
    ] }, null, 2)}\n`;
}

export function rewriteOffline(html) {
  if ((html.match(/<title>[^<]*<\/title>/g) || []).length !== 1 ||
      (html.match(/<p>[\s\S]*?<\/p>/g) || []).length !== 1) throw new Error('Unexpected offline page structure');
  return html.replace(/<title>[^<]*<\/title>/, '<title>Offline — AliaSpaces</title>')
    .replace(/<p>[\s\S]*?<\/p>/, '<p>Reconnect to load AliaSpaces social pages. AliaSpaces does not store authenticated API responses or private persona data in its offline cache.</p>');
}

export function rewriteWorker(source, pin) {
  const prefix = /const CACHE_PREFIX = "[^"]*";/;
  const version = /const CACHE_NAME = `\$\{CACHE_PREFIX\}[^`]*`;/;
  if (!prefix.test(source) || !version.test(source)) throw new Error('Unexpected public-shell cache version structure');
  // Only namespace/version changes. Network-only owner code/API rules stay exact.
  return source.replace(prefix, 'const CACHE_PREFIX = "aliaspaces-public-shell-";')
    .replace(version, `const CACHE_NAME = \`\${CACHE_PREFIX}${pin.slice(0, 12)}\`;`);
}

export async function readPin(file = path.join(repoRoot, "SOCIAL-SITE-SOURCE.json")) {
  const pin = JSON.parse(await readFile(file, "utf8"));
  if (pin.schema !== "aliaspaces-social-site-source-v1") throw new Error("Unknown pin schema");
  if (pin.repository !== PINNED_REPOSITORY) throw new Error(`Pin must name ${PINNED_REPOSITORY}`);
  if (!/^[0-9a-f]{40}$/.test(pin.commit || "")) throw new Error("Pin commit must be a full 40-character SHA");
  for (const key of ["siteDir", "workflow"]) {
    const value = String(pin[key] || "");
    if (!/^[A-Za-z0-9_.\/-]+$/.test(value) || value.split("/").includes("..") || value.startsWith("/")) {
      throw new Error(`Unsafe pin ${key}`);
    }
  }
  return pin;
}

async function publicFiles(root, keep) {
  const files = [];
  async function walk(dir, prefix) {
    for (const entry of (await readdir(dir, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      const full = path.join(dir, entry.name);
      const info = await lstat(full);
      if (info.isSymbolicLink()) {
        if (keep(relative)) throw new Error(`Refusing symlink in the public site: ${relative}`);
        continue;
      }
      if (info.isDirectory()) await walk(full, relative);
      else if (info.isFile() && keep(relative)) files.push(relative);
    }
  }
  await walk(root, "");
  return files;
}

async function put(out, relative, data) {
  const target = path.join(out, ...relative.split("/"));
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, data);
}

export async function buildSocialSite({ source, out, pinFile, siteFiles = path.join(repoRoot, "site") }) {
  const pin = await readPin(pinFile);
  const revision = execFileSync('git', ['-C', source, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  if (revision !== pin.commit) throw new Error(`Source revision ${revision} does not match pin ${pin.commit}`);
  const siteRoot = path.join(source, ...pin.siteDir.split("/"));
  const workflow = path.join(source, ...pin.workflow.split("/"));
  const auditModule = path.join(source, "scripts", "audit-public-package.mjs");
  // MyPersonas's own packaging rule and audit, from the pinned checkout.
  const { parseIncludes, selected, audit } = await import(pathToFileURL(auditModule).href);
  const rules = parseIncludes(await readFile(workflow, "utf8"));
  const files = await publicFiles(siteRoot, (relative) => selected(relative, rules));
  if (!files.includes("index.html")) throw new Error("Pinned site has no index.html");
  if (!files.includes("domain-split.js")) {
    throw new Error("Pinned MyPersonas build has no domain-split.js. aliaspaces.com would serve the owner workspace; pin a commit with the domain split.");
  }
  for (const required of ['manifest.webmanifest', 'offline.html', 'service-worker.js']) {
    if (!files.includes(required)) throw new Error(`Pinned public build missing ${required}`);
  }
  const sourceMembers = files.map(relative => `${pin.siteDir}/${relative}`);
  const tracked = new Set(execFileSync('git', ['-C', source, 'ls-files', '-z'], { encoding: 'utf8' }).split('\0'));
  for (const relative of sourceMembers) if (!tracked.has(relative)) throw new Error(`Public source member is not committed: ${relative}`);
  try {
    execFileSync('git', ['-C', source, 'diff', '--quiet', 'HEAD', '--', ...sourceMembers, pin.workflow, 'scripts/audit-public-package.mjs']);
  } catch { throw new Error('Pinned public source or packaging rules have uncommitted changes'); }
  await mkdir(out, { recursive: true });
  for (const relative of files) {
    const target = path.join(out, ...relative.split("/"));
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(path.join(siteRoot, ...relative.split("/")), target);
  }
  const report = await audit({ source: siteRoot, workflow, artifact: out });
  if (report.status !== "BYTE_PARITY_ONLY" || report.failures.length) {
    throw new Error(`MyPersonas package audit failed:\n${report.failures.join("\n")}`);
  }

  const html = await readFile(path.join(out, "index.html"), "utf8");
  if (!/<script src="\.\/domain-split\.js(?:\?v=[^"]*)?"><\/script>/.test(html)) {
    throw new Error("index.html does not load domain-split.js before the app");
  }
  await put(out, "index.html", rewriteHead(html));
  await put(out, 'manifest.webmanifest', rewriteManifest(await readFile(path.join(out, 'manifest.webmanifest'), 'utf8')));
  await put(out, 'offline.html', rewriteOffline(await readFile(path.join(out, 'offline.html'), 'utf8')));
  await put(out, 'service-worker.js', rewriteWorker(await readFile(path.join(out, 'service-worker.js'), 'utf8'), pin.commit));
  await put(out, "CNAME", "aliaspaces.com\n");
  await put(out, ".nojekyll", "");
  // aliaspaces.com's own pages: 404, and robots/sitemap that list only the social site.
  for (const name of ["404.html", "robots.txt", "sitemap.xml"]) await put(out, name, await readFile(path.join(siteFiles, name)));
  const provenance = {
    schema: "aliaspaces-social-site-artifact-v1",
    repository: pin.repository,
    commit: pin.commit,
    siteDir: pin.siteDir,
    workflowSha256: report.workflowSha256,
    copiedFiles: files.length,
    rewritten: ["index.html", "manifest.webmanifest", "offline.html", "service-worker.js", "CNAME", "robots.txt", "sitemap.xml"],
    added: ["404.html", ".nojekyll", "social-site-source.json"],
  };
  await put(out, "social-site-source.json", `${JSON.stringify(provenance, null, 2)}\n`);
  return provenance;
}

export async function buildFrontDoor({ out, root = repoRoot }) {
  await mkdir(out, { recursive: true });
  for (const [from, to] of FRONT_DOOR_FILES) await put(out, to, await readFile(path.join(root, from)));
  return { schema: "aliaspaces-front-door-artifact-v1", files: FRONT_DOOR_FILES.map(([, to]) => to) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const value = (flag) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : undefined; };
  const out = value("--out");
  try {
    if (!out) throw new Error("Usage: build-social-site.mjs (--source DIR | --front-door) --out DIR");
    const result = args.includes("--front-door")
      ? await buildFrontDoor({ out: path.resolve(out) })
      : await buildSocialSite({ source: path.resolve(value("--source") || ""), out: path.resolve(out), pinFile: value('--pin') });
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
