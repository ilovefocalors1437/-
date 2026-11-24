'use strict';
/* Render selected questions to PNG screenshots (390px wide) for visual QA.
   node render.js outDir [idRegex] [max] */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const Q = require('../../www/data/questions.js');
const outDir = process.argv[2] || '/tmp';
const re = new RegExp(process.argv[3] || '.');
const max = +(process.argv[4] || 12);
const V = path.resolve(__dirname, '../../www/vendor/katex');

const list = Q.filter((q) => re.test(q.id)).slice(0, max);
const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=390">
<link rel="stylesheet" href="file://${V}/katex.min.css">
<script src="file://${V}/katex.min.js"></script><script src="file://${V}/auto-render.min.js"></script>
<style>body{font-family:system-ui,sans-serif;margin:0;padding:16px;width:358px;font-size:16px;line-height:1.45;background:#fff}
.q{border-bottom:2px solid #333;padding:10px 0 14px}.id{font-size:11px;color:#777}.c{margin:4px 0;padding:6px 8px;border:1px solid #bbb;border-radius:6px}.c.ok{border-color:#080;background:#efe}
table.qtable{border-collapse:collapse;margin:8px auto;font-size:14px}table.qtable td,table.qtable th{border:1px solid #444;padding:3px 7px;text-align:center}.fignote{font-size:13px}</style></head><body>
${list.map((q) => `<div class="q"><div class="id">${q.id} · d${q.difficulty} · ${q.type}</div>${q.stem}${q.type === 'mcq' ? q.choices.map((c, i) => `<div class="c${i === q.answer ? ' ok' : ''}">${'ABCD'[i]}) ${c}</div>`).join('') : `<div class="c ok">Answer: ${q.answer.join(', ')}</div>`}</div>`).join('')}
<script>renderMathInElement(document.body,{delimiters:[{left:'\\\\(',right:'\\\\)',display:false},{left:'\\\\[',right:'\\\\]',display:true}],throwOnError:true});</script>
</body></html>`;
(async () => {
  const file = path.join(outDir, 'render.html');
  fs.writeFileSync(file, html);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 800 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto('file://' + file);
  await page.waitForTimeout(500);
  const qs = await page.$$('.q');
  let k = 0;
  for (const el of qs) { await el.screenshot({ path: path.join(outDir, `q${String(k++).padStart(2, '0')}.png`) }); }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth);
  console.log('rendered', qs.length, 'questions; page scrollWidth', overflow, errs.length ? 'ERRORS: ' + errs.join(' | ') : 'no errors');
  await browser.close();
})();
