// Engine + question-bank self test.  Run: node tools/selftest.js
const assert = require('assert');
const E = require('../www/js/engine.js');
const BANK = require('../www/data/questions.js');
const byId = Object.fromEntries(BANK.map(q => [q.id, q]));
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };

// --- grid-in answer matching (SAT rules)
ok(E.sprMatches('3.5', '7/2')); ok(E.sprMatches('7/2', '7/2')); ok(E.sprMatches('14/4', '7/2'));
ok(E.sprMatches('.6666', '2/3')); ok(E.sprMatches('.6667', '2/3')); ok(E.sprMatches('0.666', '2/3')); ok(E.sprMatches('0.667', '2/3'));
ok(!E.sprMatches('.66', '2/3')); ok(!E.sprMatches('0.67', '2/3')); ok(!E.sprMatches('.667', '2/3'));
ok(E.sprMatches('-.3333', '-1/3')); ok(E.sprMatches('-0.333', '-1/3')); ok(!E.sprMatches('.3333', '-1/3')); ok(!E.sprMatches('-.33', '-1/3'));
ok(E.sprMatches('12', '12')); ok(E.sprMatches('12.0', '12')); ok(!E.sprMatches('13', '12')); ok(!E.sprMatches('', '12')); ok(!E.sprMatches('1/0', '12'));
ok(E.sprMatches('1.333', '4/3')); ok(!E.sprMatches('1.3', '4/3'));
ok(E.sanitizeSpr('12a.5.6') === '12.56'); ok(E.sanitizeSpr('-1234567') === '-12345'); ok(E.sanitizeSpr('3/4/5') === '3/45'); ok(E.sanitizeSpr('/5') === '5');

// --- bank sanity
ok(BANK.length >= 200, 'bank has at least 200 questions: ' + BANK.length);
ok(new Set(BANK.map(q => q.id)).size === BANK.length, 'unique ids');
for (const q of BANK) {
  ok(['algebra', 'advanced', 'psda', 'geometry'].includes(q.domain) && [1, 2, 3].includes(q.difficulty), 'domain/difficulty ' + q.id);
  if (q.type === 'mcq') ok(q.choices.length === 4 && q.answer >= 0 && q.answer < 4 && E.isCorrect(q, q.answer), 'mcq key ' + q.id);
  else { ok(q.type === 'spr' && Array.isArray(q.answer) && q.answer.length > 0, 'spr key ' + q.id);
         for (const a of q.answer) { ok(!isNaN(E.parseNum(a)), 'spr parse ' + q.id + ' ' + a); ok(E.isCorrect(q, a), 'spr self ' + q.id); } }
}

// --- assembly: 50 full tests on both paths
for (let seed = 1; seed <= 50; seed++) {
  for (const path of ['hard', 'easy']) {
    const m1 = E.buildModule(BANK, { kind: 'm1', seed });
    const usedIds = {}, usedTpls = {}; m1.forEach(id => { usedIds[id] = 1; usedTpls[byId[id].tpl || id] = 1; });
    const m2 = E.buildModule(BANK, { kind: path, usedIds, usedTpls, seed: seed + 17 });
    const all = m1.concat(m2);
    ok(m1.length === 22 && m2.length === 22, 'module sizes');
    ok(new Set(all).size === 44, 'no repeated question');
    ok(new Set(all.map(id => byId[id].tpl || id)).size === 44, 'no repeated template');
    const avg = ids => ids.reduce((s, id) => s + byId[id].difficulty, 0) / ids.length;
    if (path === 'hard') ok(avg(m2) > avg(m1) + 0.3, 'hard module is harder'); else ok(avg(m2) < avg(m1) - 0.3, 'easy module is easier');
    for (const m of [m1, m2]) {
      const c = {}; m.forEach(id => { c[byId[id].domain] = (c[byId[id].domain] || 0) + 1; });
      ok(c.algebra >= 6 && c.advanced >= 6 && c.psda >= 3 && c.geometry >= 3, 'domain mix ' + JSON.stringify(c));
      const spr = m.filter(id => byId[id].type === 'spr').length;
      ok(spr >= 3 && spr <= 9, 'spr count ' + spr);
    }
  }
}

// --- scoring
function run(seed, path, f) {
  const m1 = E.buildModule(BANK, { kind: 'm1', seed });
  const usedIds = {}, usedTpls = {}; m1.forEach(id => { usedIds[id] = 1; usedTpls[byId[id].tpl || id] = 1; });
  const m2 = E.buildModule(BANK, { kind: path, usedIds, usedTpls, seed: seed + 17 });
  const answers = {};
  m1.concat(m2).forEach((id, i) => { const q = byId[id]; if (f(i, q)) answers[id] = q.type === 'mcq' ? q.answer : q.answer[0]; });
  return E.score({ m1, m2, answers, path }, byId);
}
ok(run(3, 'hard', () => true).scaled === 800, 'perfect = 800');
ok(run(3, 'hard', () => false).scaled === 200, 'blank = 200');
const oneWrong = run(3, 'hard', i => i !== 5).scaled; ok(oneWrong >= 760 && oneWrong <= 790, 'one wrong ' + oneWrong);
const easyMax = run(3, 'easy', (i) => i >= 9).scaled; ok(easyMax >= 480 && easyMax <= 620, 'easy path ceiling ' + easyMax);
// same number correct in module 2: the harder module must be worth more
const hardHalf = run(4, 'hard', i => i < 22 ? i < 14 : i % 2 === 0).scaled, easyHalf = run(4, 'easy', i => i < 22 ? i < 13 : i % 2 === 0).scaled;
ok(hardHalf > easyHalf + 30, `hard path worth more: ${hardHalf} vs ${easyHalf}`);
let prev = 0; for (let k = 0; k <= 44; k += 4) { const s = run(5, k >= 28 ? 'hard' : 'easy', i => i < k).scaled; ok(s >= prev - 20, 'roughly monotonic'); prev = s; }
console.log('selftest ok –', n, 'assertions,', BANK.length, 'questions');
