#!/usr/bin/env node
/*
 * UI test for the Graphing Calculator (www/calc/demo.html) using Playwright.
 *   node tools/calc-tests/ui.js [outDir]
 * Opens the demo via file:// at a phone viewport (390x780, touch), a 360px phone and a
 * tablet/landscape viewport, enters expressions through the API and the on-screen keypad,
 * checks behaviour, and saves screenshots to outDir (default: ./calc-shots).
 * Exits non-zero on failed checks or console errors.
 */
'use strict';
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '../../www/calc/demo.html');
const URL = 'file://' + ROOT + '?fresh';
const OUT = path.resolve(process.argv[2] || path.join(process.cwd(), 'calc-shots'));
fs.mkdirSync(OUT, { recursive: true });

let failures = 0, passes = 0;
function check(cond, msg) {
  if (cond) { passes++; } else { failures++; console.log('FAIL: ' + msg); }
}

async function newPage(browser, vp, touch) {
  const ctx = await browser.newContext({ viewport: vp, hasTouch: !!touch, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page._errors = [];
  page.on('console', (m) => { if (m.type() === 'error') page._errors.push(m.text()); });
  page.on('pageerror', (e) => page._errors.push('pageerror: ' + e.message));
  await page.goto(URL);
  await page.waitForFunction(() => window.SatCalc && document.querySelector('.satcalc canvas'));
  return page;
}
const exprs = (list) => ({ items: list.map((t) => (typeof t === 'string' ? { type: 'expr', text: t } : t)) });
async function setState(page, st) {
  await page.evaluate((s) => SatCalc.setState(s), st);
  await page.waitForTimeout(250);
}
async function shot(page, name) { await page.screenshot({ path: path.join(OUT, name + '.png') }); }
async function results(page) {
  return page.evaluate(() => {
    const app = SatCalc._app();
    return app.state.items.filter((it) => it.type === 'table' || String(it.text).trim()).map((it) => {
      const r = app.results.get(it.id) || {};
      return { text: it.text, kind: r.kind, error: r.error || null, missing: r.missing || null, display: r.display || null, params: r.params || null, r2: r.r2 };
    });
  });
}
// screen position (page coords) of a world point on the graph
async function graphPoint(page, x, y) {
  return page.evaluate(([x, y]) => {
    const g = SatCalc._app().graph;
    const r = g.canvas.getBoundingClientRect();
    return { x: r.left + g.X(x), y: r.top + g.Y(y) };
  }, [x, y]);
}
async function tapGraph(page, x, y) {
  const p = await graphPoint(page, x, y);
  await page.touchscreen.tap(p.x, p.y);
  await page.waitForTimeout(250);
}
async function pois(page) {
  await page.waitForTimeout(200);
  return page.evaluate(() => SatCalc._app().graph.pois.map((p) => ({ x: +p.x.toFixed(4), y: +p.y.toFixed(4), type: p.type })));
}
const near = (a, b, tol) => Math.abs(a - b) <= (tol || 1e-3);
const hasPoi = (list, x, y, type) => list.some((p) => near(p.x, x, 2e-3) && near(p.y, y, 2e-3) && (!type || p.type === type));
async function pressKeys(page, labels) {
  for (const l of labels) {
    const loc = page.locator('.satcalc .sc-key[data-k="' + l + '"]');
    let box = null;
    const n = await loc.count();
    for (let i = 0; i < n && !box; i++) box = await loc.nth(i).boundingBox();
    if (!box) throw new Error('key not visible: ' + l);
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  }
  await page.waitForTimeout(120);
}
async function noHScroll(page) {
  return page.evaluate(() => {
    const se = document.scrollingElement;
    const root = document.querySelector('.satcalc');
    const over = [];
    root.querySelectorAll('*').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width && (r.right > window.innerWidth + 0.5 || r.left < -0.5)) {
        // ignore content inside horizontal scrollers (tables, long math)
        let p = el.parentElement, scrolled = false;
        while (p && p !== root) { const cs = getComputedStyle(p); if (cs.overflowX === 'auto' || cs.overflowX === 'scroll' || cs.overflowX === 'hidden') { scrolled = true; break; } p = p.parentElement; }
        if (!scrolled) over.push(el.className || el.tagName);
      }
    });
    return { sw: se.scrollWidth, w: window.innerWidth, over: over.slice(0, 5) };
  });
}
async function smallTargets(page) {
  return page.evaluate(() => {
    const bad = [];
    document.querySelectorAll('.satcalc button, .satcalc input[type=range]').forEach((b) => {
      const r = b.getBoundingClientRect();
      if (!r.width || !r.height) return;
      if (getComputedStyle(b).visibility === 'hidden') return;
      if (r.height < 36 || r.width < 36) bad.push((b.className || b.tagName) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height) + ' "' + (b.textContent || '').trim().slice(0, 10) + '"');
    });
    return bad;
  });
}

(async () => {
  const browser = await chromium.launch();
  const allErrors = [];

  // ---------------------------------------------------------------- phone 390x780
  let page = await newPage(browser, { width: 390, height: 780 }, true);

  // 1. line, parabola, circle + POIs
  await setState(page, exprs(['y=2x+1', 'y=x^2-4', 'x^2+y^2=25']));
  let res = await results(page);
  check(res[0].kind === 'explicit' && res[1].kind === 'explicit' && res[2].kind === 'implicit', 'basic kinds ' + JSON.stringify(res.map((r) => r.kind)));
  await tapGraph(page, 2, 0);  // on the parabola (x=2,y=0)
  let sel = await page.evaluate(() => SatCalc._app().graph.selId);
  check(sel != null, 'tapping the parabola selects it');
  let P = await pois(page);
  check(hasPoi(P, 2, 0, 'zero') && hasPoi(P, -2, 0, 'zero'), 'parabola x-intercepts ±2 ' + JSON.stringify(P));
  check(hasPoi(P, 0, -4), 'parabola vertex/y-int (0,-4)');
  check(hasPoi(P, 1 + Math.sqrt(6), 2 * (1 + Math.sqrt(6)) + 1, 'int') && hasPoi(P, 1 - Math.sqrt(6), 2 * (1 - Math.sqrt(6)) + 1, 'int'), 'line/parabola intersections');
  // circle ∩ parabola: x^2 + (x^2-4)^2 = 25 -> x^4 -7x^2 -9 = 0 -> x^2 = (7+sqrt(85))/2
  const xc = Math.sqrt((7 + Math.sqrt(85)) / 2);
  check(hasPoi(P, xc, xc * xc - 4, 'int'), 'circle/parabola intersection');
  // tap a POI to show its label
  await tapGraph(page, 0, -4);
  const openCount = await page.evaluate(() => SatCalc._app().graph.poiOpen.size);
  check(openCount === 1, 'tapping a POI opens its label');
  await shot(page, 'phone-1-line-parabola-circle');

  // trace along the line by dragging
  await page.evaluate(() => SatCalc._app().graph.select(null));
  const a = await graphPoint(page, -3, -5), bpt = await graphPoint(page, -1, -1);
  await page.mouse.move(a.x, a.y); await page.mouse.down();
  await page.mouse.move(bpt.x, bpt.y, { steps: 6 }); await page.mouse.up();
  const tr = await page.evaluate(() => SatCalc._app().graph.trace);
  check(tr && near(tr.y, 2 * tr.x + 1, 1e-6), 'trace stays on y=2x+1 ' + JSON.stringify(tr));
  await shot(page, 'phone-2-trace');

  // zoom buttons, pinch (CDP multi-touch) and drag-pan
  const v0 = await page.evaluate(() => SatCalc._app().graph.getView());
  await page.locator('.sc-zbtn[aria-label="Zoom in"]').tap();
  await page.waitForTimeout(100);
  const v1 = await page.evaluate(() => SatCalc._app().graph.getView());
  check(v1.ppu > v0.ppu * 1.5, 'zoom-in button');
  await page.locator('.sc-zbtn[aria-label="Default view"]').tap();
  const cdp = await page.context().newCDPSession(page);
  const c0 = await graphPoint(page, 0, 0);
  const tp = (pts) => pts.map((p, i) => ({ x: p[0], y: p[1], id: i }));
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: tp([[c0.x - 40, c0.y], [c0.x + 40, c0.y]]) });
  for (let k = 1; k <= 5; k++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: tp([[c0.x - 40 - 16 * k, c0.y], [c0.x + 40 + 16 * k, c0.y]]) });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(200);
  const v2 = await page.evaluate(() => SatCalc._app().graph.getView());
  check(v2.ppu > v0.ppu * 1.8 && Math.abs(v2.cx) < 0.05 && Math.abs(v2.cy) < 0.05, 'pinch zoom about fingers ' + JSON.stringify(v2));
  const e0 = await graphPoint(page, 1.5, 1.5);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: tp([[e0.x, e0.y]]) });
  for (let k = 1; k <= 5; k++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: tp([[e0.x - 12 * k, e0.y + 8 * k]]) });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(200);
  const v3 = await page.evaluate(() => SatCalc._app().graph.getView());
  check(v3.cx > v2.cx + 0.3 && v3.cy > v2.cy + 0.2, 'one-finger pan ' + JSON.stringify(v3));
  await page.locator('.sc-zbtn[aria-label="Default view"]').tap();
  await page.waitForTimeout(150);

  // 2. inequality system
  await setState(page, exprs(['y>2x+1', 'y<=-x+4', 'x^2+y^2<16']));
  res = await results(page);
  check(res.every((r) => r.kind === 'ineq'), 'inequalities ' + JSON.stringify(res.map((r) => r.kind)));
  await shot(page, 'phone-3-inequalities');

  // 3. table + regression
  await setState(page, { items: [
    { type: 'table', columns: [{ header: 'x_1', values: ['1', '2', '3', '4', '5'] }, { header: 'y_1', values: ['2.1', '3.9', '6.2', '7.8', '10.1'] }] },
    { type: 'expr', text: 'y_1 ~ m x_1 + b' },
    { type: 'table', columns: [{ header: 'x_2', values: ['0', '1', '2', '3'] }, { header: 'y_2', values: ['3', '6', '12', '24'] }] },
    { type: 'expr', text: 'y_2 ~ c d^{x_2}' }
  ] });
  res = await results(page);
  check(res[1].kind === 'regression' && near(res[1].params.m, 1.99, 1e-9) && near(res[1].params.b, 0.05, 1e-9), 'linear regression m=1.99 b=0.05 ' + JSON.stringify(res[1]));
  check(res[3].kind === 'regression' && near(res[3].params.c, 3, 1e-6) && near(res[3].params.d, 2, 1e-6) && near(res[3].r2, 1, 1e-9), 'exponential regression a=3 b=2 ' + JSON.stringify(res[3]));
  await page.evaluate(() => { const g = SatCalc._app().graph; g.setView({ cx: 3, cy: 8, ppu: 22 }); });
  await page.waitForTimeout(250);
  await shot(page, 'phone-4-table-regression');

  // 4. slider via "add slider", tan(x), piecewise
  await setState(page, exprs(['y=a x^2', 'y=tan(x)', 'y={x<0: -x, x>=0: x^2/2}']));
  res = await results(page);
  check(res[0].kind === 'error' && res[0].missing && res[0].missing[0] === 'a', 'undefined a suggests slider');
  await page.locator('.sc-chip', { hasText: 'a' }).first().tap();
  await page.waitForTimeout(250);
  res = await results(page);
  check(res.some((r) => r.text === 'a=1' && r.kind === 'slider') && res[0].kind === 'explicit', 'slider a created ' + JSON.stringify(res.map((r) => r.text + ':' + r.kind)));
  // drag the slider
  const rng = page.locator('.sc-range').first();
  const rb = await rng.boundingBox();
  await page.mouse.click(rb.x + rb.width * 0.62, rb.y + rb.height / 2);
  await page.waitForTimeout(200);
  res = await results(page);
  const aLine = res.find((r) => /^a=/.test(r.text));
  check(aLine && aLine.text !== 'a=1', 'slider drag changes a: ' + (aLine && aLine.text));
  // tan should have no vertical asymptote lines: check chains never cross a pole with a long vertical segment
  const tanOK = await page.evaluate(() => {
    const g = SatCalc._app().graph;
    const c = g.curves.filter((c) => c.type === 'fx')[1];
    if (!c) return false;
    for (const ch of c.chains) for (let i = 2; i < ch.length; i += 2) if (Math.abs(ch[i + 1] - ch[i - 1]) > g.H * 0.9 && Math.abs(ch[i] - ch[i - 2]) < 1) return false;
    return c.chains.length >= 3;
  });
  check(tanOK, 'tan(x) drawn without asymptote connectors');
  await shot(page, 'phone-5-slider-tan-piecewise');

  // 5. parametric + polar + points
  await setState(page, Object.assign(exprs(['(cos(t), sin(t))', { type: 'expr', text: '(3cos(t), 2sin(t))', domain: { min: '0', max: '2π' } }, 'r=1+cos(θ)', '(1,2),(3,4),(-2,-3)', 'y=[1,2,3]x']), {}));
  res = await results(page);
  check(res[0].kind === 'parametric' && res[1].kind === 'parametric' && res[2].kind === 'polar' && res[3].kind === 'points' && res[4].kind === 'explicit', 'param/polar/points kinds ' + JSON.stringify(res.map((r) => r.kind)));
  const nbranch = await page.evaluate(() => SatCalc._app().graph.curves.filter((c) => c.type === 'fx').length);
  check(nbranch === 3, 'y=[1,2,3]x draws 3 lines (' + nbranch + ')');
  await page.evaluate(() => SatCalc._app().graph.setView({ cx: 0, cy: 0, ppu: 40 }));
  await page.waitForTimeout(250);
  await shot(page, 'phone-6-parametric-polar-points');

  // 6. keypad typing
  await setState(page, exprs([]));
  await page.locator('.sc-row .sc-math').first().tap();
  await page.waitForTimeout(150);
  const kpOpen = await page.evaluate(() => document.querySelector('.satcalc').classList.contains('sc-kp'));
  check(kpOpen, 'keypad opens on touch focus');
  await pressKeys(page, ['y', '=', '2', 'x', '+', '1', '↵']);
  await pressKeys(page, ['y', '=', 'x', 'a²', '−', '4']);
  await pressKeys(page, ['f(x)']);
  await pressKeys(page, ['sin']);
  await pressKeys(page, ['ABC']);
  await pressKeys(page, ['x']);
  await pressKeys(page, ['123']);
  await pressKeys(page, ['→', '↵', '√', '2', '→', '×', '3']);
  res = await results(page);
  check(res[0] && res[0].text === 'y=2x+1', 'keypad typed line 1: ' + (res[0] && res[0].text));
  check(res[1] && res[1].text === 'y=x^2-4sin(x)', 'keypad typed line 2: ' + (res[1] && res[1].text));
  check(res[2] && res[2].text === '√(2)*3' && res[2].display === '4.242640687', 'keypad typed constant: ' + JSON.stringify(res[2]));
  // backspace removes the "√(" pair etc.
  await pressKeys(page, ['⌫', '⌫']);
  res = await results(page);
  check(res[2].text === '√(2)', 'backspace: ' + res[2].text);
  await shot(page, 'phone-7-keypad');
  // physical keyboard still works
  await page.keyboard.type('+1');
  res = await results(page);
  check(res[2].text === '√(2)+1', 'physical keyboard typing: ' + res[2].text);

  // 7. scientific mode
  await page.locator('.sc-segbtn', { hasText: 'Scientific' }).tap();
  await pressKeys(page, ['3', '÷', '4', '=']);
  await pressKeys(page, ['sin', 'π', '÷', '6', ')', '=']);
  await pressKeys(page, ['nCr', '5', ',', '2', ')', '=']);
  await pressKeys(page, ['2', 'xʸ', '1', '0', '=']);
  await pressKeys(page, ['+', '1', '=']);
  const hist = await page.evaluate(() => SatCalc._app().state.sci.history.map((h) => h.display));
  check(JSON.stringify(hist) === JSON.stringify(['0.75', '0.5', '10', '1024', '1025']), 'scientific results ' + JSON.stringify(hist));
  // fraction toggle on first entry
  await page.locator('.sc-fbtn').first().tap();
  await page.waitForTimeout(100);
  const fracShown = await page.evaluate(() => !!document.querySelector('.sc-hval .katex .mfrac'));
  check(fracShown, 'fraction toggle shows 3/4');
  await pressKeys(page, ['√', '2']);
  await shot(page, 'phone-8-scientific');
  await pressKeys(page, ['DEG']);
  await pressKeys(page, ['AC', 'sin', '3', '0', ')', '=']);
  const last = await page.evaluate(() => { const h = SatCalc._app().state.sci.history; return h[h.length - 1].display; });
  check(last === '0.5', 'degree mode sin(30)=0.5: ' + last);

  // state round trip
  const st = await page.evaluate(() => JSON.stringify(SatCalc.getState()));
  await page.evaluate(() => SatCalc.setState({ garbage: true, items: 5, viewport: 'x' }));
  await page.evaluate(() => SatCalc.setState(null));
  await page.evaluate(() => SatCalc.setState([1, 2, { items: [null, 7, { type: 'expr', text: 42 }] }]));
  await page.evaluate((s) => SatCalc.setState(JSON.parse(s)), st);
  const st2 = await page.evaluate(() => JSON.stringify(SatCalc.getState()));
  check(st === st2, 'getState/setState round trip');
  const changed = await page.evaluate(() => new Promise((res) => { SatCalc.onChange = (s) => res(!!s && s.version === 1); SatCalc._app().addItem('expr', null, 'y=5'); setTimeout(() => res(false), 2000); }));
  check(changed, 'onChange fires with state');
  allErrors.push(...page._errors);
  await page.context().close();

  // ---------------------------------------------------------------- 360px phone: overflow + targets
  page = await newPage(browser, { width: 360, height: 740 }, true);
  await setState(page, Object.assign(exprs(['y=x^2-2x-3', 'a=2', 'y=ax+1 {x>-2}', 'y_1 ~ m x_1 + b', 'mean([1,2,3,4,100])']), {}));
  await page.evaluate(() => { const app = SatCalc._app(); app.addItem('table'); });
  await page.locator('.sc-row .sc-math').first().tap();
  await page.waitForTimeout(200);
  let ov = await noHScroll(page);
  check(ov.sw <= ov.w && !ov.over.length, 'no horizontal overflow at 360px ' + JSON.stringify(ov));
  let small = await smallTargets(page);
  check(!small.length, 'touch targets >= 36px at 360px: ' + small.join('; '));
  await shot(page, 'phone360-1-list-keypad');
  await pressKeys(page, ['f(x)']);
  await shot(page, 'phone360-2-fn-panel');
  await page.locator('.sc-segbtn', { hasText: 'Scientific' }).tap();
  await page.waitForTimeout(150);
  ov = await noHScroll(page);
  check(ov.sw <= ov.w && !ov.over.length, 'no overflow in scientific at 360px ' + JSON.stringify(ov));
  small = await smallTargets(page);
  check(!small.length, 'sci touch targets: ' + small.join('; '));
  await shot(page, 'phone360-3-scientific');
  allErrors.push(...page._errors);
  await page.context().close();

  // ---------------------------------------------------------------- tablet landscape
  page = await newPage(browser, { width: 1180, height: 820 }, true);
  await setState(page, { items: [
    { type: 'expr', text: 'f(x)=x^3-3x' }, { type: 'expr', text: 'y=f(x-1)+2' }, { type: 'expr', text: "y=f'(x)" },
    { type: 'expr', text: 'x^2/9-y^2/4=1' }, { type: 'expr', text: 'sin(x)=cos(y)' }, { type: 'expr', text: 'y<=-x^2+6 {-2<=x<=3}' },
    { type: 'expr', text: 'x=2sin(y)' }, { type: 'expr', text: 'y=floor(x)/2-6' }, { type: 'expr', text: 'y=1/(x-4)' },
    { type: 'table', columns: [{ header: 'x_1', values: ['-6', '-5', '-4', '-3'] }, { header: 'y_1', values: ['5', '6', '6.5', '6.2'] }, { header: '2x_1+15', values: [] }] },
    { type: 'expr', text: 'y_1 ~ a x_1^2 + b x_1 + c' }
  ] });
  res = await results(page);
  check(res.every((r) => r.kind && r.kind !== 'error'), 'tablet set has no errors ' + JSON.stringify(res.filter((r) => r.kind === 'error')));
  await page.evaluate(() => SatCalc._app().graph.select(SatCalc._app().state.items[0].id));
  P = await pois(page);
  check(hasPoi(P, -1, 2, 'max') && hasPoi(P, 1, -2, 'min') && hasPoi(P, 0, 0), 'cubic extrema ' + JSON.stringify(P));
  await page.evaluate(() => SatCalc._app().graph.poiOpen.add(0));
  await page.evaluate(() => SatCalc._app().graph.request());
  await page.waitForTimeout(200);
  await shot(page, 'tablet-1-landscape');
  const perf = await page.evaluate(() => {
    const g = SatCalc._app().graph;
    const t = [];
    for (let i = 0; i < 6; i++) { g.interacting = true; g.cx += 0.3; const t0 = performance.now(); g.renderNow(); t.push(performance.now() - t0); }
    g.interacting = false;
    t.sort((a, b) => a - b);
    return t[3];
  });
  console.log('tablet pan render (interacting, median ms): ' + perf.toFixed(1));
  await page.evaluate(() => SatCalc._app().toggleKeypad(true));
  await page.locator('.sc-row .sc-math').nth(1).click();
  await page.waitForTimeout(200);
  await shot(page, 'tablet-2-keypad');
  await page.locator('.sc-segbtn', { hasText: 'Scientific' }).click();
  await page.evaluate(() => { const a = SatCalc._app(); ['1/3+1/4', '2^10', 'sqrt(50)', '5!', 'log_2(64)'].forEach((e) => { a.sciIn.value = e; a.sciEval(); }); });
  await page.waitForTimeout(100);
  await shot(page, 'tablet-3-scientific');
  allErrors.push(...page._errors);
  await page.context().close();

  // ---------------------------------------------------------------- desktop (mouse + physical keyboard)
  page = await newPage(browser, { width: 1280, height: 800 }, false);
  await page.locator('.sc-row .sc-math').first().click();
  await page.keyboard.type('y=x^2-2x');
  await page.keyboard.press('Enter');
  await page.keyboard.type('y=x');
  await page.keyboard.press('Enter');
  await page.keyboard.type('zz');
  await page.keyboard.press('Backspace'); await page.keyboard.press('Backspace'); await page.keyboard.press('Backspace');
  res = await results(page);
  check(res.length === 2 && res[0].text === 'y=x^2-2x' && res[1].text === 'y=x', 'desktop typing/enter/backspace-delete ' + JSON.stringify(res.map((r) => r.text)));
  const kpClosed = await page.evaluate(() => !document.querySelector('.satcalc').classList.contains('sc-kp'));
  check(kpClosed, 'keypad stays closed on desktop focus');
  const w0 = await page.evaluate(() => SatCalc._app().graph.getView().ppu);
  const gc = await graphPoint(page, 0, 0);
  await page.mouse.move(gc.x + 50, gc.y + 50);
  await page.mouse.wheel(0, -300);
  await page.waitForTimeout(200);
  const w1 = await page.evaluate(() => SatCalc._app().graph.getView().ppu);
  check(w1 > w0 * 1.3, 'wheel zoom in');
  // table typing via keyboard grows rows
  await page.locator('.sc-lbtn', { hasText: 'Table' }).click();
  await page.keyboard.type('1'); await page.keyboard.press('Enter'); await page.keyboard.type('2'); await page.keyboard.press('Enter');
  await page.keyboard.type('3'); await page.keyboard.press('Enter'); await page.keyboard.type('4');
  const tcells = await page.evaluate(() => { const t = SatCalc._app().state.items.find((i) => i.type === 'table'); return t.columns[0].values.slice(0, 4).join(','); });
  check(tcells === '1,2,3,4', 'table keyboard entry: ' + tcells);
  await shot(page, 'desktop-1');
  allErrors.push(...page._errors);
  await page.context().close();

  // ---------------------------------------------------------------- phone landscape
  page = await newPage(browser, { width: 780, height: 360 }, true);
  await setState(page, exprs(['y=x^2-4', 'y=2x+1', 'a=1']));
  await page.locator('.sc-row .sc-math').first().tap();
  await page.waitForTimeout(200);
  ov = await noHScroll(page);
  check(ov.sw <= ov.w && !ov.over.length, 'no overflow phone landscape ' + JSON.stringify(ov));
  await shot(page, 'landscape-phone');
  allErrors.push(...page._errors);
  await page.context().close();

  await browser.close();
  check(allErrors.length === 0, 'console errors: ' + allErrors.join(' | '));
  console.log(`UI checks: ${passes} passed, ${failures} failed. Screenshots in ${OUT}`);
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
