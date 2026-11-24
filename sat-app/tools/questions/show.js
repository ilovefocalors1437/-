'use strict';
/* Print questions as plain text for proofreading.
   node show.js [regex-on-tpl] [--sample N] [--seed S] */
const Q = require('../../www/data/questions.js');
const L = require('./lib');
const args = process.argv.slice(2);
let filter = null, sample = 0, seed = 7;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--sample') sample = +args[++i];
  else if (args[i] === '--seed') seed = +args[++i];
  else filter = new RegExp(args[i]);
}
function plain(h) {
  return h.replace(/<svg[\s\S]*?<\/svg>/g, '[FIGURE]')
    .replace(/<tr>/g, '\n  | ').replace(/<\/t[dh]>/g, ' | ')
    .replace(/<br\s*\/?>/g, ' / ').replace(/<\/p>/g, '\n').replace(/<[^>]+>/g, '')
    .replace(/\\\(|\\\)/g, '').replace(/\\\[|\\\]/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
}
let list = Q.filter((q) => !filter || filter.test(q.tpl) || filter.test(q.domain + ':' + q.difficulty));
if (sample) { const r = L.makeRng(seed); list = r.shuffle(list).slice(0, sample); }
for (const q of list) {
  console.log(`=== ${q.id}  [${q.domain} d${q.difficulty} ${q.type}] ${q.skill}`);
  console.log(plain(q.stem));
  if (q.type === 'mcq') q.choices.forEach((c, i) => console.log(`  ${'ABCD'[i]}${i === q.answer ? '*' : ' '} ${plain(c)}`));
  else console.log('  ANSWER: ' + q.answer.join(' , '));
  console.log('  EXPL: ' + plain(q.explanation));
  console.log();
}
console.error(list.length + ' shown');
