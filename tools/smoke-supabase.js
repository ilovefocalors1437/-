import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

const modulePath = process.env.PLAYWRIGHT_MODULE;
const { chromium } = await import(modulePath ? pathToFileURL(modulePath).href : "playwright");
const root = resolve("dist");
const mime = { ".html":"text/html", ".js":"text/javascript", ".css":"text/css", ".svg":"image/svg+xml", ".png":"image/png", ".md":"text/plain" };
const server = createServer(async (req,res) => {
  const pathname = new URL(req.url,"http://localhost").pathname;
  const path = resolve(root,"."+(pathname==="/"?"/index.html":decodeURIComponent(pathname)));
  if(!path.startsWith(root+sep)) return res.writeHead(403).end();
  try{const data=await readFile(path);res.writeHead(200,{"Content-Type":mime[extname(path)]||"application/octet-stream"}).end(data);}catch{res.writeHead(404).end();}
});
await new Promise((done)=>server.listen(0,"127.0.0.1",done));
let browser;
try {
  browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
  const base=`http://127.0.0.1:${server.address().port}`;
  const page=await browser.newPage({viewport:{width:1440,height:1000}}); const errors=[]; page.on("pageerror",(error)=>errors.push(error.message));
  await page.goto(base);
  assert.equal(await page.locator("[data-page]").count(),3);
  await page.locator("#mainMessageOutput").fill("คนทั่วไปพิมพ์ข้อความได้");
  assert.equal(await page.locator("#characterCount").textContent(),"23 ตัวอักษร");
  await page.locator('[data-route="guide"]').first().click();
  assert.equal(await page.locator("#page-guide").isVisible(),true);
  await page.locator('[data-route="chat"]').first().click();
  await page.locator("#setupNotice").waitFor({state:"visible"});
  assert.equal(await page.locator("#googleLogin").isDisabled(),true);
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.deepEqual(errors,[]);

  const context=await browser.newContext({viewport:{width:1440,height:1000}}); const app=await context.newPage(); const appErrors=[]; app.on("pageerror",(error)=>appErrors.push(error.message));
  await app.route("**/src/supabase-config.js",(route)=>route.fulfill({contentType:"text/javascript",body:'export const SUPABASE_URL="https://test.supabase.co"; export const SUPABASE_PUBLISHABLE_KEY="sb_publishable_test";'}));
  const fakeModule=await readFile(resolve("tools/fake-supabase-browser.js"),"utf8");
  await app.route("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm",(route)=>route.fulfill({contentType:"text/javascript",body:fakeModule}));
  await app.goto(`${base}/#chat`);
  await app.locator("#googleLogin").click();
  await app.locator("#chatSignedIn").waitFor({state:"visible"});
  assert.equal(await app.locator("#publicUid").textContent(),"ES-123456ABCDEF");
  await app.locator("#contactRequests").getByRole("button",{name:"แชต",exact:true}).click();
  await app.locator("#conversationTitle").filter({hasText:"เพื่อนทดสอบ"}).waitFor();
  await app.locator("#chatMessageOutput").fill("น้ำ");
  await app.locator('[data-bank-id="send"]').click();
  assert.equal(await app.locator("#currentChoice").textContent(),"ยืนยันส่ง?");
  await app.getByRole("button",{name:"เลือก ส่งข้อความ",exact:true}).click();
  await app.waitForFunction(()=>document.getElementById("chatFeedback").textContent.includes("ส่งข้อความแล้ว"));
  assert.equal(await app.locator("#chatMessageOutput").inputValue(),"");
  assert.equal(await app.evaluate(()=>globalThis.__fakeSent.length),1);
  await app.locator("#openGroupDialog").click();
  assert.equal(await app.locator("#groupDialog").evaluate((dialog)=>dialog.open),true);
  await app.locator("#closeGroupDialog").click();
  assert.deepEqual(appErrors,[]);
  if(process.env.SCREENSHOT_PATH) await app.screenshot({path:process.env.SCREENSHOT_PATH,fullPage:true});
  await context.close();
  console.log("PASS browser: three pages + Google auth mock + UID/DM/send/group UI + mobile layout.");
} finally { await browser?.close(); await new Promise((done)=>server.close(done)); }
