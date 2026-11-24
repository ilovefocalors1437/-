// Simulates answer patterns to sanity-check the scoring scale.  node tools/sim-score.js [slope shift]
const E = require('../www/js/engine.js');
if (process.argv[2]) E._setScale(+process.argv[2], +process.argv[3] || 0);
function mod(kind) { const o = []; for (const k of [1,2,3]) for (let i = 0; i < E.DIFF_MIX[kind][k]; i++) o.push({ difficulty: k, type: i % 4 === 3 ? 'spr' : 'mcq' }); return o; }
// answers "best-first": a student who gets n right gets the n easiest right
function pat(kind, n, hardestFirst) { const m = mod(kind); if (hardestFirst) m.reverse(); return m.map((it, i) => ({ ...it, correct: i < n })); }
function sc(m1, kind, m2) { return E.scaleScore(E.theta(pat('m1', m1).concat(pat(kind, m2)))); }
console.log('hard path: M1/M2 correct -> score');
for (const [a, b] of [[22,22],[22,21],[21,21],[21,20],[20,20],[20,18],[19,17],[18,15],[17,13],[16,11],[15,8],[14,5],[14,0]]) console.log(`  ${a}/${b}`, sc(a,'hard',b));
console.log('easy path:');
for (const [a, b] of [[13,22],[13,20],[12,18],[11,16],[10,14],[9,12],[8,10],[6,8],[4,6],[3,3],[1,1],[0,0]]) console.log(`  ${a}/${b}`, sc(a,'easy',b));
