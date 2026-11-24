'use strict';
/* Validates www/data/questions.js. Exit code 1 on any failure.
   node check.js */
const path = require('path');
const katex = require('/home/user/-/sat-app/www/vendor/katex/katex.min.js');
const L = require('./lib');
const FILE = path.join(__dirname, '../../www/data/questions.js');
delete require.cache[require.resolve(FILE)];
const Q = require(FILE);

const errors = [], warns = [];
const err = (q, msg) => errors.push(`${q ? q.id : '-'}: ${msg}`);
const pct = (n, d) => (100 * n / d).toFixed(1) + '%';

/* ---------- schema ---------- */
const DOMAINS = ['algebra', 'advanced', 'psda', 'geometry'];
const SKILLS = {
  algebra: ['Linear equations in one variable', 'Linear functions', 'Linear equations in two variables', 'Systems of two linear equations in two variables', 'Linear inequalities in one or two variables'],
  advanced: ['Equivalent expressions', 'Nonlinear equations in one variable and systems of equations in two variables', 'Nonlinear functions'],
  psda: ['Ratios, rates, proportional relationships, and units', 'Percentages', 'One-variable data: Distributions and measures of center and spread', 'Two-variable data: Models and scatterplots', 'Probability and conditional probability', 'Inference from sample statistics and margin of error', 'Evaluating statistical claims: Observational studies and experiments'],
  geometry: ['Area and volume', 'Lines, angles, and triangles', 'Right triangles and trigonometry', 'Circles'],
};
const SPR_RE = /^-?(\d+|\d*\.\d+|\d+\/\d+)$/;
if (!Array.isArray(Q)) { console.error('not an array'); process.exit(1); }
const ids = new Set();
for (const q of Q) {
  for (const k of ['id', 'tpl', 'domain', 'skill', 'difficulty', 'type', 'stem', 'answer', 'explanation']) if (q[k] === undefined) err(q, 'missing ' + k);
  if (ids.has(q.id)) err(q, 'duplicate id'); ids.add(q.id);
  if (!DOMAINS.includes(q.domain)) err(q, 'bad domain');
  else if (!SKILLS[q.domain].includes(q.skill)) err(q, 'bad skill ' + q.skill);
  if (![1, 2, 3].includes(q.difficulty)) err(q, 'bad difficulty');
  if (q.type === 'mcq') {
    if (!Array.isArray(q.choices) || q.choices.length !== 4) err(q, 'need 4 choices');
    else {
      if (new Set(q.choices).size !== 4) err(q, 'choices not distinct');
      const norm = q.choices.map((c) => c.replace(/\s+/g, '').replace(/\\left|\\right/g, ''));
      if (new Set(norm).size !== 4) err(q, 'choices not distinct after normalising');
      q.choices.forEach((c) => { if (/^\s*[A-D]\)/.test(c)) err(q, 'choice has letter prefix'); });
    }
    if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer > 3) err(q, 'bad mcq answer');
  } else if (q.type === 'spr') {
    if (!Array.isArray(q.answer) || !q.answer.length) err(q, 'spr answer must be array');
    else for (const a of q.answer) {
      if (typeof a !== 'string' || !SPR_RE.test(a)) err(q, 'bad spr answer ' + a);
      else if (a.startsWith('-') ? a.length > 6 : a.length > 5) err(q, 'spr answer too long ' + a);
    }
    if (Array.isArray(q.answer) && q.answer.length > 1) {
      // all forms must be numerically consistent with the canonical one (within SAT truncation) unless multi-solution
      const v0 = sprVal(q.answer[0]);
      const multi = /one possible|possible value/i.test(q.stem);
      if (!multi) for (const a of q.answer) if (Math.abs(sprVal(a) - v0) > 0.0011 * Math.max(1, Math.abs(v0))) err(q, 'inconsistent spr forms ' + q.answer.join(','));
    }
    if (q.choices) err(q, 'spr has choices');
  } else err(q, 'bad type');
  if (typeof q.explanation !== 'string' || q.explanation.length < 30) err(q, 'explanation too short');
}
function sprVal(s) { if (s.includes('/')) { const [a, b] = s.split('/'); return +a / +b; } return +s; }

/* ---------- distributions ---------- */
const N = Q.length;
if (N < 420) err(null, `only ${N} questions (< 420)`);
const count = (f) => Q.filter(f).length;
const dom = Object.fromEntries(DOMAINS.map((d) => [d, count((q) => q.domain === d)]));
const want = { algebra: [0.31, 0.39], advanced: [0.31, 0.39], psda: [0.12, 0.18], geometry: [0.12, 0.18] };
for (const d of DOMAINS) if (dom[d] / N < want[d][0] || dom[d] / N > want[d][1]) err(null, `domain ${d} share ${pct(dom[d], N)} outside ${want[d]}`);
const dif = [1, 2, 3].map((k) => count((q) => q.difficulty === k));
const wantD = [[0.26, 0.34], [0.32, 0.40], [0.30, 0.38]];
dif.forEach((c, i) => { if (c / N < wantD[i][0] || c / N > wantD[i][1]) err(null, `difficulty ${i + 1} share ${pct(c, N)} outside ${wantD[i]}`); });
const nspr = count((q) => q.type === 'spr');
if (nspr / N < 0.21 || nspr / N > 0.29) err(null, `spr share ${pct(nspr, N)} outside 21-29%`);

const byTpl = {};
for (const q of Q) (byTpl[q.tpl] = byTpl[q.tpl] || []).push(q);
const tpls = Object.keys(byTpl);
if (tpls.length < 150) err(null, `only ${tpls.length} templates (< 150)`);
for (const [t, list] of Object.entries(byTpl)) {
  if (list.length > 4) err(list[0], `tpl ${t} has ${list.length} variants (> 4)`);
  if (new Set(list.map((q) => q.domain + q.difficulty + q.type)).size > 1) err(list[0], `tpl ${t} mixes domain/difficulty/type`);
  if (new Set(list.map((q) => q.stem)).size !== list.length) err(list[0], `tpl ${t} has identical stems`);
}
const cells = {};
for (const t of tpls) { const q = byTpl[t][0]; const k = q.domain + ':' + q.difficulty; cells[k] = (cells[k] || 0) + 1; }
for (const d of DOMAINS) for (const k of [1, 2, 3]) if ((cells[d + ':' + k] || 0) < 12) err(null, `cell ${d}:${k} has only ${cells[d + ':' + k] || 0} templates (< 12)`);

const mcq = Q.filter((q) => q.type === 'mcq');
const pos = [0, 1, 2, 3].map((i) => mcq.filter((q) => q.answer === i).length);
pos.forEach((c, i) => { if (c / mcq.length < 0.22 || c / mcq.length > 0.28) err(null, `answer position ${'ABCD'[i]} share ${pct(c, mcq.length)} not roughly uniform`); });

const figs = count((q) => /<svg|<table/.test(q.stem));
if (figs < 40) err(null, `only ${figs} questions with figures/tables (< 40)`);

/* ---------- text artefacts, delimiters, KaTeX ---------- */
function fields(q) { return [['stem', q.stem], ['explanation', q.explanation], ...(q.choices || []).map((c, i) => ['choice' + i, c])]; }
let fragCount = 0;
for (const q of Q) {
  for (const [name, h] of fields(q)) {
    if (/undefined|NaN|Infinity|\[object/.test(h)) err(q, `${name}: undefined/NaN artefact`);
    if (/\$\$/.test(h)) err(q, `${name}: contains $$`);
    // raw '<' that does not start a tag
    const noSvg = h;
    if (/<(?![a-zA-Z\/!])/.test(noSvg)) err(q, `${name}: raw '<' in HTML`);
    // balanced delimiters
    const opens = (h.match(/\\\(/g) || []).length, closes = (h.match(/\\\)/g) || []).length;
    if (opens !== closes) err(q, `${name}: unbalanced \\( \\) (${opens}/${closes})`);
    const dO = (h.match(/\\\[/g) || []).length, dC = (h.match(/\\\]/g) || []).length;
    if (dO !== dC) err(q, `${name}: unbalanced \\[ \\]`);
    // nesting check: each \( must be closed before the next \(
    let depth = 0; for (const tok of h.match(/\\\(|\\\)/g) || []) { depth += tok === '\\(' ? 1 : -1; if (depth < 0 || depth > 1) { err(q, `${name}: nested/misordered \\( \\)`); break; } }
    const frags = [];
    h.replace(/\\\(([\s\S]*?)\\\)/g, (_, t) => { frags.push([t, false]); return ''; });
    h.replace(/\\\[([\s\S]*?)\\\]/g, (_, t) => { frags.push([t, true]); return ''; });
    const textOnly = h.replace(/<svg[\s\S]*?<\/svg>/g, ' ').replace(/\\\([\s\S]*?\\\)/g, ' MATH ').replace(/<[^>]+>/g, ' ');
    if (/\+\s*-|-\s*-|\+\s*\+/.test(textOnly.replace(/--/g, '')) ) { /* text dashes are rare; check below on math only */ }
    if (/--/.test(textOnly)) err(q, `${name}: '--' in text`);
    for (const [t, disp] of frags) {
      fragCount++;
      if (/\+\s*-(?!\s*\\infty)|-\s*-|\+\s*\+|=\s*\+|\(\s*\+/.test(t)) err(q, `${name}: sign artefact in "${t}"`);
      if (/(?<![\d.}])1\s*(?=[a-zA-Z(](?![a-z]{2}))/.test(t.replace(/\\[a-zA-Z]+/g, '#'))) err(q, `${name}: coefficient-1 artefact in "${t}"`);
      if (/(?<![\d.])0[a-zA-Z]/.test(t.replace(/\\[a-zA-Z]+/g, '#'))) err(q, `${name}: zero-coefficient artefact in "${t}"`);
      if (/\^\{?1\}?(?![\d.])/.test(t)) err(q, `${name}: exponent-1 artefact in "${t}"`);
      if (/\\frac\{-?[\d.]+\}\{1\}/.test(t)) err(q, `${name}: denominator-1 fraction in "${t}"`);
      if (/\\frac\{(\d+)\}\{(\d+)\}/.test(t)) { const [, a, b] = t.match(/\\frac\{(\d+)\}\{(\d+)\}/); if (L.gcd(+a, +b) !== 1 && !/=/.test(t) && name.startsWith('choice')) warns.push(`${q.id}: unreduced fraction in choice "${t}"`); }
      try { katex.renderToString(t, { throwOnError: true, displayMode: disp }); } catch (e) { err(q, `${name}: KaTeX error "${e.message}" in "${t}"`); }
    }
  }
  // svg sanity
  for (const s of q.stem.match(/<svg[\s\S]*?<\/svg>/g) || []) {
    if (!/viewBox=/.test(s)) err(q, 'svg without viewBox');
    if (/NaN|undefined/.test(s)) err(q, 'svg contains NaN');
    if ((s.match(/<text/g) || []).length !== (s.match(/<\/text>/g) || []).length) err(q, 'svg text tags unbalanced');
  }
}

/* ---------- independent re-solving of a sample by a different method ---------- */
// (a) single equation in x shown as the first paragraph, question asks for x / the solution.
function strip(h) { return h.replace(/\\lt\s?/g, '<').replace(/\\gt\s?/g, '>'); }
function keyedValue(q) {
  if (q.type === 'spr') return [sprVal(q.answer[0])];
  const c = q.choices[q.answer]; const mm = c.match(/^\\\(([\s\S]*)\\\)$/); if (!mm) return null;
  try { return [L.texEval(mm[1], {})]; } catch (e) { return null; }
}
function choiceValues(q) {
  if (q.type !== 'mcq') return null;
  const vals = [];
  for (const c of q.choices) { const mm = c.match(/^\\\(([\s\S]*)\\\)$/); if (!mm) return null; try { vals.push(L.texEval(mm[1], {})); } catch (e) { return null; } }
  return vals;
}
let resolved1 = 0, resolved2 = 0;
for (const q of Q) {
  const mm = q.stem.match(/^<p>\\\(([^<]*?)\\\)<\/p><p>(.*?)<\/p>$/);
  if (mm && /value of \\\(x\\\)|solution to the given equation|satisfies/.test(mm[2]) && !/\\\(k\\\)|constant|positive|negative|greatest|least|sum|product|\\\(2x|\\\(x\^2|solutions does/.test(mm[2])) {
    const eq = strip(mm[1]);
    if ((eq.match(/=/g) || []).length !== 1 || /[<>]|\\le|\\ge|y|[a-wz]/.test(eq.replace(/\\[a-zA-Z]+/g, ''))) continue;
    const [l, r] = eq.split('=');
    const f = (x) => L.texEval(l, { x }) - L.texEval(r, { x });
    const kv = keyedValue(q); if (!kv) continue;
    let ok = false;
    try { ok = Math.abs(f(kv[0])) < 1e-6 * Math.max(1, Math.abs(L.texEval(r, { x: kv[0] }))); } catch (e) { ok = false; }
    if (!ok) err(q, `re-solve: keyed answer ${kv[0]} does not satisfy ${eq}`);
    const cv = choiceValues(q);
    if (cv) cv.forEach((v, i) => { if (i !== q.answer) { let bad = false; try { bad = Math.abs(f(v)) < 1e-9; } catch (e) { /* undefined there */ } if (bad) err(q, `re-solve: distractor ${v} also satisfies ${eq}`); } });
    resolved1++;
  }
  // (b) 2x2 linear systems
  const sm = q.stem.match(/^<p>\\\(([^<]*?)\\\)<br>\\\(([^<]*?)\\\)<\/p><p>(.*?)<\/p>/);
  if (sm && /solution/.test(sm[3]) && !/constant/.test(sm[3])) {
    const e1 = strip(sm[1]), e2 = strip(sm[2]);
    if (/[<>]|\\le|\\ge/.test(e1 + e2)) continue;
    const ask = (sm[3].match(/value of \\\(([^\\]*?)\\\)\?/) || [])[1]; if (!ask) continue;
    const lin = (e) => { const [l, r] = e.split('='); const g = (x, y) => L.texEval(l, { x, y }) - L.texEval(r, { x, y }); const c0 = g(0, 0); return [g(1, 0) - c0, g(0, 1) - c0, -c0, g(2, 3) - (2 * (g(1, 0) - c0) + 3 * (g(0, 1) - c0) + c0)]; };
    let A, B; try { A = lin(e1); B = lin(e2); } catch (e) { continue; }
    if (Math.abs(A[3]) > 1e-9 || Math.abs(B[3]) > 1e-9) continue; // nonlinear
    const det = A[0] * B[1] - A[1] * B[0]; if (Math.abs(det) < 1e-12) continue;
    const x = (A[2] * B[1] - A[1] * B[2]) / det, y = (A[0] * B[2] - A[2] * B[0]) / det;
    let want; try { want = L.texEval(ask, { x, y }); } catch (e) { continue; }
    const kv = keyedValue(q); if (!kv) continue;
    if (Math.abs(kv[0] - want) > 1e-6) err(q, `re-solve system: expected ${ask} = ${want}, keyed ${kv[0]}`);
    resolved2++;
  }
}

/* ---------- report ---------- */
const table = {};
for (const q of Q) { const k = `${q.domain}`; table[k] = table[k] || { 1: { mcq: 0, spr: 0 }, 2: { mcq: 0, spr: 0 }, 3: { mcq: 0, spr: 0 } }; table[k][q.difficulty][q.type]++; }
console.log(`questions: ${N}, templates: ${tpls.length}, KaTeX fragments rendered: ${fragCount}`);
console.log('domain shares:', DOMAINS.map((d) => `${d} ${dom[d]} (${pct(dom[d], N)})`).join(', '));
console.log('difficulty shares:', dif.map((c, i) => `${i + 1}: ${c} (${pct(c, N)})`).join(', '), `| spr ${nspr} (${pct(nspr, N)})`);
console.log('answer positions:', pos.join(' / '), '| figures/tables:', figs);
console.log('templates per cell:', JSON.stringify(cells));
for (const d of DOMAINS) if (table[d]) console.log(`  ${d.padEnd(9)} ` + [1, 2, 3].map((k) => `d${k}: ${table[d][k].mcq} mcq + ${table[d][k].spr} spr`).join(' | '));
console.log(`independent re-solve: ${resolved1} single equations, ${resolved2} linear systems`);
if (warns.length) console.log(`warnings (${warns.length}):\n  ` + warns.slice(0, 20).join('\n  '));
if (errors.length) { console.log(`\nFAILED with ${errors.length} errors:\n  ` + errors.slice(0, 80).join('\n  ')); process.exit(1); }
console.log('\nALL CHECKS PASSED');
