// End-to-end UI test in Chromium (Playwright).  node tools/e2e.js [outDir] [--stub]
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const out = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : path.join(__dirname, '..', 'e2e-out');
const stub = process.argv.includes('--stub');
fs.mkdirSync(out, { recursive: true });
const url = 'file://' + path.join(__dirname, '..', 'www', 'index.html');
function stubBank() {
  const D = ['algebra', 'advanced', 'psda', 'geometry'], qs = [];
  for (let i = 0; i < 320; i++) {
    const spr = i % 4 === 3, a = 2 + (i % 9), b = 3 + (i % 7);
    qs.push({ id: 'q' + i, tpl: 't' + i, domain: D[i % 4], skill: 'Stub', difficulty: 1 + (Math.floor(i / 4) % 3), type: spr ? 'spr' : 'mcq',
      stem: `<p>If \\(${a}x = ${a * b}\\), what is the value of \\(x\\)? (stub ${i})</p>`, choices: spr ? undefined : [String(b + 1), String(b), String(b - 1), String(b * 2)],
      answer: spr ? [String(b)] : 1, explanation: `Divide both sides by \\(${a}\\).` });
  }
  return 'window.SAT_QUESTIONS=' + JSON.stringify(qs) + ';';
}
(async () => {
  const browser = await chromium.launch();
  const errors = [];
  async function ctx(vp) {
    const c = await browser.newContext({ viewport: vp, hasTouch: true, deviceScaleFactor: 1 });
    const p = await c.newPage();
    p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    p.on('pageerror', e => errors.push('pageerror: ' + e.message));
    if (stub) {
      await p.route('**/data/questions.js', r => r.fulfill({ contentType: 'text/javascript', body: stubBank() }));
      await p.route('**/calc/calc.*', r => r.fulfill({ contentType: r.request().url().endsWith('css') ? 'text/css' : 'text/javascript', body: '' }));
    }
    return p;
  }
  const assert = (c, m) => { if (!c) throw new Error('ASSERT: ' + m); };
  const shot = (p, n) => p.screenshot({ path: path.join(out, n + '.png') });
  const answerCurrent = async (p, right) => p.evaluate((right) => {
    const s = window.__sat.session, ids = s.module === 1 ? s.m1 : s.m2, q = window.SAT_QUESTIONS.find(x => x.id === ids[s.idx]);
    if (q.type === 'mcq') { document.querySelectorAll('.choice')[right ? q.answer : (q.answer + 1) % 4].click(); }
    else { const i = document.querySelector('.spr input'); i.value = right ? q.answer[0] : '9999'; i.dispatchEvent(new Event('input')); }
    return q.type;
  }, right);
  const next = p => p.click('.t-footer .btn.primary');

  // ---------- phone: full test on the hard path ----------
  let p = await ctx({ width: 390, height: 800 });
  await p.goto(url); await shot(p, '01-home');
  await p.click('text=Start a new test'); await p.waitForSelector('.q-num'); await shot(p, '02-question');
  // strike-through + flag + navigator
  await p.click('.q-flag');
  const hasAbc = await p.$('.q-abc');
  if (hasAbc) { await p.click('.q-abc'); await p.click('.strike >> nth=0'); await shot(p, '03-strike'); await p.click('.q-abc'); }
  await p.click('.nav-pill'); await p.waitForSelector('.sheet .grid'); await shot(p, '04-navigator');
  assert(await p.$('.cell.flag'), 'flag shown in navigator');
  await p.click('.sheet .x');
  await p.click('.tool >> text=Reference'); await shot(p, '05-reference'); await p.click('.sheet .x');
  // pause: black screen with only one button, the clock stops
  const t0 = await p.evaluate(() => window.__sat.session.timeLeft);
  await p.click('.tool >> text=Pause'); await p.waitForTimeout(1600); await shot(p, '06-paused');
  const t1 = await p.evaluate(() => window.__sat.session.timeLeft);
  assert(Math.abs(t0 - t1) < 0.6, 'clock stopped while paused ' + (t0 - t1));
  const vis = await p.evaluate(() => { const e = document.elementFromPoint(40, 300); return e.id; });
  assert(vis === 'pause-screen', 'pause screen covers everything: ' + vis);
  // autosave: reload while paused -> comes back paused on the same question with answers kept
  await p.click('#unpause-btn'); await answerCurrent(p, true);
  await p.reload(); await p.waitForSelector('.q-num');
  assert(await p.isVisible('#pause-screen'), 'restored session is paused');
  const restored = await p.evaluate(() => Object.keys(window.__sat.session.answers).length);
  assert(restored === 1, 'answer survived reload');
  await p.click('#unpause-btn');
  await p.waitForTimeout(1300);
  const t2 = await p.evaluate(() => window.__sat.session.timeLeft);
  assert(t2 < t1 && t1 - t2 < 6, 'clock runs again ' + (t1 - t2));
  // calculator panel
  await p.click('.tool >> text=Calculator'); await p.waitForTimeout(700); await shot(p, '07-calc-phone');
  await p.click('.calc-split-btn'); await p.waitForTimeout(400); await shot(p, '08-calc-split');
  await p.click('.calc-bar >> text=Close');
  // answer module 1: 18 right -> hard path
  for (let i = 0; i < 22; i++) { await answerCurrent(p, i < 18); if (i === 12) await shot(p, '09-answered'); await next(p); }
  await p.waitForSelector('.review-page'); await shot(p, '10-review');
  await next(p); await shot(p, '11-confirm'); await p.click('.sheet .btn.primary');
  await p.waitForSelector('.inter'); await shot(p, '12-inter');
  await p.click('text=Start Module 2 now'); await p.waitForSelector('.q-num');
  assert(await p.evaluate(() => window.__sat.session.path) === 'hard', 'routed to hard module');
  assert(await p.evaluate(() => Math.round(window.__sat.session.timeLeft)) >= 2098, 'module 2 gets a fresh 35:00');
  for (let i = 0; i < 22; i++) { await answerCurrent(p, i % 3 !== 0); await next(p); }
  await next(p); await p.click('.sheet .btn.primary');
  await p.waitForSelector('.score-big'); await shot(p, '13-results');
  const hard = +(await p.textContent('.score-big'));
  await p.click('.cell.bad >> nth=0'); await p.waitForSelector('.expl'); await shot(p, '14-detail');
  await p.click('text=Results'); await p.click('text=‹ Home'); await shot(p, '15-home-history');

  // ---------- easy path + time running out ----------
  await p.click('text=Start a new test'); await p.waitForSelector('.q-num');
  for (let i = 0; i < 8; i++) { await answerCurrent(p, true); await next(p); }
  await p.evaluate(() => { window.__sat.session.timeLeft = 301; }); await p.waitForTimeout(1500); await shot(p, '16-five-min');
  assert(await p.$('.t-clock.low'), 'clock turns red');
  await p.evaluate(() => { window.__sat.session.timeLeft = 0.4; });
  await p.waitForSelector('.inter', { timeout: 5000 });          // time up -> module ends by itself
  await p.click('text=Start Module 2 now'); await p.waitForSelector('.q-num');
  assert(await p.evaluate(() => window.__sat.session.path) === 'easy', 'routed to easy module');
  for (let i = 0; i < 22; i++) { await answerCurrent(p, i % 3 !== 0); await next(p); }
  await next(p); await p.click('.sheet .btn.primary'); await p.waitForSelector('.score-big');
  const easy = +(await p.textContent('.score-big'));
  assert(hard > easy, `hard path ${hard} > easy path ${easy}`);
  await shot(p, '17-results-easy');

  // ---------- tablet / landscape ----------
  p = await ctx({ width: 1180, height: 780 });
  await p.goto(url); await p.click('text=Start a new test'); await p.waitForSelector('.q-num');
  await p.click('.tool >> text=Calculator'); await p.waitForTimeout(700); await shot(p, '20-tablet-calc');
  p = await ctx({ width: 360, height: 640 });
  await p.goto(url); await p.click('text=Start a new test'); await p.waitForSelector('.q-num'); await shot(p, '21-small-phone');
  const overflow = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  assert(!overflow, 'no horizontal overflow at 360px');

  await browser.close();
  if (errors.length) { console.log('CONSOLE ERRORS:\n' + errors.join('\n')); process.exit(1); }
  console.log(`e2e ok – hard-path score ${hard}, easy-path score ${easy}; screenshots in ${out}`);
})().catch(e => { console.error(e); process.exit(1); });
