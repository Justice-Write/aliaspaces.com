import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const shell=await readFile(new URL('../src/live/social-shell.js',import.meta.url),'utf8');
const fixture=await readFile(new URL('../tests/fixtures/owner-website.html',import.meta.url),'utf8');
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
try {
 const page=await browser.newPage({viewport:{width:390,height:844}});
 await page.route('https://mypersonas.online/**',r=>r.fulfill({contentType:'text/html',body:fixture}));
 await page.goto('https://mypersonas.online/#/owner');
 await page.addScriptTag({content:shell});
 await page.evaluate(()=>window.AliaSpacesLiveShell.watch());
 for(const label of ['Choose persona','Research briefs','Four-channel drafts','Approvals','Fan inbox','AI controls','Account portals','Persona companion'])assert.ok(await page.getByRole('button',{name:label,exact:true}).isVisible());
 await page.getByRole('button',{name:'Fan inbox',exact:true}).click();
 assert.match(page.url(),/#\/fan-inbox$/);
 await page.evaluate(()=>window.AliaSpacesLiveShell.watch());
 assert.match(page.url(),/#\/fan-inbox$/);
 assert.equal(await page.locator('#aliaspacesLiveBanner').count(),1);
 await page.locator('#aliaspacesLiveBanner summary').click();
 assert.match(await page.locator('#aliaspacesLiveBanner').innerText(),/owner command center/);
 console.log('Website foundation fixture PASS: owner controls retained, existing routes preserved, shared-account banner idempotent. This is not signed-in/MFA workflow acceptance.');
}finally{await browser.close();}
