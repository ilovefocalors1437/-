'use strict';
const L = require('./lib');
const { m, num, F, fr, need, assert, spr, sprDec, numCh, close, money, table, ptable, chart, barChart, dotPlot, texInt, commas, decStr, valOf, lin } = L;

const SK = {
  ratio: 'Ratios, rates, proportional relationships, and units',
  pct: 'Percentages',
  one: 'One-variable data: Distributions and measures of center and spread',
  two: 'Two-variable data: Models and scatterplots',
  prob: 'Probability and conditional probability',
  inf: 'Inference from sample statistics and margin of error',
  claims: 'Evaluating statistical claims: Observational studies and experiments',
};
const out = [];
function def(tpl, diff, type, n, skill, gen) { out.push({ tpl: 'psda-' + tpl, domain: 'psda', diff, type, n, skill, gen }); }
const isInt = Number.isInteger;
const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const median = (a) => { const b = a.slice().sort((x, y) => x - y); const n = b.length; return n % 2 ? b[(n - 1) / 2] : (b[n / 2 - 1] + b[n / 2]) / 2; };
const sd = (a) => { const mu = mean(a); return Math.sqrt(mean(a.map((x) => (x - mu) ** 2))); };
const frc = (n, d) => m(F(n, d).tex());
const pctS = (x) => decStr(x) + '%';
const ord = (n) => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th'));

/* ============================ EASY ============================ */
def('ratio-recipe', 1, 'mcq', 2, SK.ratio, (r, v) => {
  if (v === 0) { const a = r.int(2, 5), b = r.int(2, 5), k = r.int(3, 8); need(L.gcd(a, b) === 1 && a !== b);
    return { stem: `<p>A recipe for bread uses ${a} cups of flour for every ${b} cups of water. How many cups of flour are needed if ${b * k} cups of water are used?</p>`, ...numCh([a * k, a + b * k - b, F(b * b * k, a), a * b * k]),
      explanation: `The ratio of flour to water is ${m(`${a}:${b}`)}. Since ${b * k} cups of water is ${k} times ${b}, the flour needed is ${m(`${k} \\times ${a} = ${a * k}`)} cups.`, verify: () => a * k / (b * k) === a / b }; }
  const a = r.int(3, 7), b = r.int(2, 5), k = r.int(3, 9); need(L.gcd(a, b) === 1);
  return { stem: `<p>A shade of green paint is made by mixing blue paint and yellow paint in the ratio ${a} to ${b}. A painter uses ${b * k} quarts of yellow paint to make this shade. How many quarts of blue paint does the painter use?</p>`, ...numCh([a * k, a + b * k - b, F(b * b * k, a), a * b * k]),
    explanation: `Set up a proportion: ${m(`\\frac{${a}}{${b}} = \\frac{x}{${b * k}}`)}, so ${m(`x = \\frac{${a}(${b * k})}{${b}} = ${a * k}`)}.`, verify: () => a * b * k / b === a * k };
});

def('unit-rate', 1, 'mcq', 1, SK.ratio, (r, v) => {
  if (v === 0) { const rate = r.int(12, 22), t1 = r.int(2, 4), t2 = r.int(5, 8); const d1 = rate * t1;
    return { stem: `<p>A cyclist rides ${d1} miles in ${t1} hours. At this rate, how many miles will the cyclist ride in ${t2} hours?</p>`, ...numCh([rate * t2, rate, d1 + rate, d1 * t2]),
      explanation: `The cyclist's rate is ${m(`\\frac{${d1}}{${t1}} = ${rate}`)} miles per hour. In ${t2} hours the cyclist rides ${m(`${rate} \\times ${t2} = ${rate * t2}`)} miles.`, verify: () => d1 / t1 * t2 === rate * t2 }; }
  const n1 = r.pick([8, 12, 16]), per = r.pick([0.75, 1.25, 1.5]), n2 = r.pick([20, 24, 30, 36]); const c1 = n1 * per; need(n2 !== n1);
  return { stem: `<p>A store sells ${n1} bottles of water for ${money(c1)}. At the same price per bottle, what is the cost of ${n2} bottles of water?</p>`, ...numCh([per * n2, per, c1 * n2 / 4, c1 + n2 - n1], (z) => money(z)),
    explanation: `The price per bottle is ${m(`\\frac{${c1}}{${n1}} = ${per}`)} dollars. So ${n2} bottles cost ${m(`${n2} \\times ${per} = ${decStr(per * n2)}`)} dollars, or ${money(per * n2)}.`, verify: () => close(c1 / n1 * n2, per * n2) };
});

def('percent-of', 1, 'mcq', 2, SK.pct, (r, v) => {
  if (v === 0) { const p = r.pick([15, 35, 45, 65, 85]), N = r.int(4, 16) * 20; const a = p * N / 100; need(isInt(a));
    return { stem: `<p>What is ${p}% of ${N}?</p>`, ...numCh([a, N - a, a / 10, a * 10]), explanation: `${p}% of ${N} is ${m(`0.${p} \\times ${N} = ${a}`)}.`, verify: () => close(p / 100 * N, a) }; }
  const p = r.pick([42, 56, 64, 72, 38]), N = r.pick([250, 450, 650, 850]); const a = p * N / 100; need(isInt(a));
  return { stem: `<p>In a survey of ${N} students at a high school, ${p}% said they ride a bus to school. How many of the surveyed students said they ride a bus to school?</p>`, ...numCh([a, N - a, a / 10, p]),
    explanation: `${m(`${p / 100} \\times ${N} = ${a}`)} students.`, verify: () => close(p / 100 * N, a) };
});

def('percent-change-price', 1, 'mcq', 1, SK.pct, (r, v) => {
  const P = r.pick([40, 60, 80, 120, 160]), p = r.pick([15, 20, 25, 30, 35]); const d = P * p / 100; need(isInt(d * 2));
  if (v === 0) return { stem: `<p>The price of a jacket was ${money(P)}. The price was increased by ${p}%. What is the new price of the jacket?</p>`, ...numCh([P + d, P + p, P - d, d], money),
    explanation: `${p}% of ${money(P)} is ${m(`${p / 100} \\times ${P} = ${decStr(d)}`)} dollars. The new price is ${m(`${P} + ${decStr(d)} = ${decStr(P + d)}`)} dollars.`, verify: () => close(P * (1 + p / 100), P + d) };
  return { stem: `<p>A pair of shoes is on sale for ${p}% off the original price of ${money(P)}. What is the sale price of the shoes?</p>`, ...numCh([P - d, P - p, P + d, d], money),
    explanation: `The discount is ${m(`${p / 100} \\times ${P} = ${decStr(d)}`)} dollars, so the sale price is ${m(`${P} - ${decStr(d)} = ${decStr(P - d)}`)} dollars. Equivalently, ${m(`${(1 - p / 100).toFixed(2)} \\times ${P} = ${decStr(P - d)}`)}.`, verify: () => close(P * (1 - p / 100), P - d) };
});

def('mean-list', 1, 'spr', 1, SK.one, (r, v) => {
  if (v === 0) { const n = r.pick([5, 6, 7]); const xs = Array.from({ length: n }, () => r.int(4, 30)); const s = xs.reduce((a, b) => a + b, 0); need(s % n === 0);
    return { stem: `<p>The numbers of books read by ${n} students last summer were ${xs.join(', ')}. What is the mean number of books read by these students?</p>`, answer: spr(s / n),
      explanation: `The sum is ${s}, and ${m(`\\frac{${s}}{${n}} = ${s / n}`)}.`, verify: () => mean(xs) === s / n }; }
  const n = 5, mu = r.int(10, 30); const xs = Array.from({ length: 4 }, () => r.int(mu - 8, mu + 8)); const last = n * mu - xs.reduce((a, b) => a + b, 0); need(last > 0 && !xs.includes(last));
  return { stem: `<p>The mean of five numbers is ${mu}. Four of the numbers are ${xs.join(', ')}. What is the fifth number?</p>`, answer: spr(last),
    explanation: `The five numbers must add to ${m(`5 \\times ${mu} = ${5 * mu}`)}. The four given numbers add to ${xs.reduce((a, b) => a + b, 0)}, so the fifth is ${m(`${5 * mu} - ${xs.reduce((a, b) => a + b, 0)} = ${last}`)}.`, verify: () => mean([...xs, last]) === mu };
});

def('median-dotplot', 1, 'mcq', 2, SK.one, (r, v) => {
  const lo = r.int(0, 3), hi = lo + r.int(5, 7); const counts = {}; let data = [];
  for (let x = lo; x <= hi; x++) { const c = r.int(0, 4); if (c) counts[x] = c; for (let k = 0; k < c; k++) data.push(x); }
  need(data.length >= 9 && data.length <= 16 && data.length % 2 === 1);
  const med = median(data), mu = mean(data), mode = +Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]; const range = Math.max(...data) - Math.min(...data);
  need(Object.values(counts).filter((c) => c === counts[mode]).length === 1);
  const thing = v === 0 ? ['Number of pets', 'pets owned by each of'] : ['Goals scored', 'goals scored by a soccer team in each of'];
  const svg = dotPlot({ min: lo, max: hi, counts, label: thing[0] });
  const cand = [med, mode, range, Math.round(mu) === med ? med + 1 : Math.round(mu)].filter((x, i, A) => A.indexOf(x) === i);
  need(cand.length === 4);
  return { stem: `<p>The dot plot shows the number of ${thing[1]} ${data.length} ${v === 0 ? 'families' : 'games'}. What is the median of the data?</p>` + svg, ...numCh(cand),
    explanation: `There are ${data.length} values, so the median is the ${ord((data.length + 1) / 2)} value when the data are in order. Counting dots from the left, the ${ord((data.length + 1) / 2)} value is ${med}.`, verify: () => median(data) === med };
});

const TWO_WAY = [
  { rows: ['Grade 10', 'Grade 11'], cols: ['Basketball', 'Soccer', 'Tennis'], ctx: 'students who chose their favorite sport to watch', who: 'student' },
  { rows: ['Morning', 'Evening'], cols: ['Yoga', 'Spin', 'Pilates'], ctx: 'members of a gym, classified by the class they attended and the time of the class', who: 'member' },
  { rows: ['Adults', 'Children'], cols: ['Comedy', 'Drama', 'Animated'], ctx: 'people at a movie theater, classified by age group and the type of movie they watched', who: 'person' },
  { rows: ['Plant A', 'Plant B'], cols: ['No defect', 'Minor defect', 'Major defect'], ctx: 'parts inspected at two factories', who: 'part' },
];
function makeTable(r, k, lo = 5, hi = 40) {
  const T0 = TWO_WAY[k % TWO_WAY.length];
  const cells = T0.rows.map(() => T0.cols.map(() => r.int(lo, hi)));
  const rowT = cells.map((rw) => rw.reduce((a, b) => a + b, 0)); const colT = T0.cols.map((_, j) => cells.reduce((s, rw) => s + rw[j], 0)); const tot = rowT.reduce((a, b) => a + b, 0);
  const html = table(['', ...T0.cols, 'Total'], [...T0.rows.map((rn, i) => [rn, ...cells[i], rowT[i]]), ['Total', ...colT, tot]]);
  return { T0, cells, rowT, colT, tot, html };
}
def('prob-table-simple', 1, 'mcq', 2, SK.prob, (r, v) => {
  const t = makeTable(r, v);
  const j = r.int(0, 2);
  const correct = F(t.colT[j], t.tot);
  const vals = [correct, F(t.cells[0][j], t.tot), F(t.colT[j], t.rowT[0]), F(t.cells[0][j], t.colT[j])];
  need(new Set(vals.map((x) => x.str())).size === 4);
  return { stem: `<p>The table summarizes ${t.T0.ctx}.</p>` + t.html + `<p>If one of these ${t.T0.who === 'person' ? 'people' : t.T0.who + 's'} is selected at random, what is the probability that the ${t.T0.who} is in the "${t.T0.cols[j]}" category?</p>`,
    choices: vals.map((x) => frc(x.n, x.d)), explanation: `There are ${t.colT[j]} in the "${t.T0.cols[j]}" category out of ${t.tot} in total, so the probability is ${m(`\\frac{${t.colT[j]}}{${t.tot}}${correct.d !== t.tot ? ' = ' + correct.tex() : ''}`)}.`,
    verify: () => close(correct.val(), t.colT[j] / t.tot) };
});

def('scatter-predict', 1, 'mcq', 2, SK.two, (r, v) => {
  const mm = v === 0 ? r.pick([2, 3, 4]) : -r.pick([1.5, 2, 2.5]); const b = v === 0 ? r.int(5, 15) : r.int(40, 50);
  const xs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const pts = xs.map((x) => [x, +(mm * x + b + (r.f() - 0.5) * 5).toFixed(1)]);
  const ymax = Math.ceil(Math.max(...pts.map((p) => p[1]), b + mm * 10, b) / 10) * 10 + 5;
  const svg = chart({ x: [0, 11], y: [0, ymax], xt: 1, yt: ymax > 60 ? 10 : 5, xlabel: v === 0 ? 'Hours of practice' : 'Age of tire (years)', ylabel: v === 0 ? 'Score' : 'Tread depth (mm)', pts, fn: (x) => mm * x + b, fnFrom: 0, fnTo: 11 });
  void svg;
  const k = r.int(3, 8) + 0.5 * (v === 1 ? 0 : 0); const pred = mm * k + b;
  const fmt = (z) => m(decStr(z));
  const vals = [pred, pred + 2 * Math.abs(mm), b, mm * k];
  const ctx = v === 0 ? `The scatterplot shows the number of hours ${m('x')} that each of 10 students practiced for a typing test and the student's score ${m('y')} on the test. A line of best fit is also shown, and its equation is ${m(`y = ${decStr(mm)}x + ${b}`)}.`
    : `The scatterplot shows the tread depth, in millimeters, of 10 tires of different ages. A line of best fit, ${m(`y = ${decStr(mm)}x + ${b}`)}, is also shown.`;
  // re-draw with tidy y-scale for second context
  const svg2 = chart({ x: [0, 11], y: [0, ymax], xt: 1, yt: ymax > 60 ? 10 : 5, xlabel: v === 0 ? 'Hours of practice' : 'Age (years)', ylabel: v === 0 ? 'Score' : 'Tread depth (mm)', pts, fn: (x) => mm * x + b, fnFrom: 0, fnTo: 11 });
  return { stem: `<p>${ctx}</p>` + svg2 + `<p>Based on the line of best fit, what is the predicted value of ${m('y')} when ${m(`x = ${k}`)}?</p>`, ...numCh(vals, fmt),
    explanation: `Substitute ${m(`x = ${k}`)} into the equation of the line: ${m(`y = ${decStr(mm)}(${k}) + ${b} = ${decStr(pred)}`)}.`, verify: () => close(mm * k + b, pred) };
});

def('bar-chart-diff', 1, 'spr', 1, SK.one, (r, v) => {
  const cats = v === 0 ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] : ['Apple', 'Banana', 'Cherry', 'Grape'];
  const step = v === 0 ? 5 : 10;
  const vals = cats.map(() => r.int(2, 9) * step);
  need(new Set(vals).size === vals.length);
  const i = r.int(0, cats.length - 1); let j = r.int(0, cats.length - 1); need(i !== j && vals[i] > vals[j]);
  const svg = barChart({ cats, vals, y: [0, 10 * step], yt: step, xlabel: v === 0 ? 'Day' : 'Flavor', ylabel: v === 0 ? 'Number of visitors' : 'Number of votes' });
  const names = v === 0 ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((d) => ({ Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday' }[d])) : cats;
  return { stem: `<p>The bar graph shows ${v === 0 ? 'the number of visitors to a museum exhibit on each of five days' : 'the results of a survey in which students voted for their favorite flavor of fruit juice'}. How many more ${v === 0 ? 'visitors were there on ' + names[i] + ' than on ' + names[j] : 'votes did ' + names[i] + ' receive than ' + names[j]}?</p>` + svg,
    answer: spr(vals[i] - vals[j]), explanation: `From the graph, ${names[i]} has ${vals[i]} and ${names[j]} has ${vals[j]}. The difference is ${m(`${vals[i]} - ${vals[j]} = ${vals[i] - vals[j]}`)}.`, verify: () => vals[i] - vals[j] > 0 };
});

def('unit-convert', 1, 'mcq', 2, SK.ratio, (r, v) => {
  if (v === 0) { const f = r.pick([2.5, 3.5, 4.5, 5.5, 6.25]); const ans = f * 12;
    return { stem: `<p>A board is ${f} feet long. What is the length of the board in inches? (1 foot = 12 inches)</p>`, ...numCh([ans, f * 3, f + 12, f * 36], (z) => m(decStr(+z.toFixed(4)))),
      explanation: `Multiply by 12 inches per foot: ${m(`${f} \\times 12 = ${decStr(ans)}`)} inches.`, verify: () => close(f * 12, ans) }; }
  const cm = r.pick([350, 425, 680, 1250]); const ans = cm / 100;
  return { stem: `<p>A rope is ${commas(cm)} centimeters long. What is the length of the rope in meters? (1 meter = 100 centimeters)</p>`, ...numCh([ans, cm / 10, cm / 1000, cm * 100], (z) => m(texInt(z) === String(z) ? decStr(z) : texInt(z))),
    explanation: `Divide by 100 centimeters per meter: ${m(`\\frac{${texInt(cm)}}{100} = ${decStr(ans)}`)} meters.`, verify: () => close(cm / 100, ans) };
});

def('sample-random', 1, 'mcq', 2, SK.claims, (r, v) => {
  const C = [
    { s: 'A school principal wants to estimate the average number of hours of sleep students at the school get on school nights. Which of the following methods of choosing students to survey is most likely to produce an unbiased estimate?',
      c: ['Selecting 100 students at random from a list of all students at the school', 'Surveying the first 100 students who arrive at school in the morning', 'Surveying all the students on the school\'s track team', 'Posting a survey online and using the responses of students who choose to answer'],
      e: 'A random sample from the entire student body gives every student the same chance of being selected, so it is most likely to be representative. The other methods select groups whose sleep habits may differ systematically from those of the whole school.' },
    { s: 'A city council wants to know what percent of city residents support building a new public library. Which of the following sampling methods is most appropriate for estimating this percent?',
      c: ['Randomly selecting 500 residents from a complete list of city residents and asking each one', 'Asking 500 people who visit the current library during one week', 'Asking the first 500 people who call a phone line advertised in a library newsletter', 'Asking 500 residents who live on the same street as the proposed library'],
      e: 'Only a random selection from all residents avoids a systematic bias. People who already use the library or who respond to library advertising are likely to support a new library more than residents in general.' },
  ];
  const c = C[v];
  return { stem: `<p>${c.s}</p>`, choices: c.c, explanation: c.e };
});

def('prob-marbles', 1, 'mcq', 2, SK.prob, (r, v) => {
  const a = r.int(3, 12), b = r.int(3, 12), c = r.int(2, 10); const N = a + b + c; need(a !== b && b !== c && a !== c);
  const items = v === 0 ? ['red', 'blue', 'green', 'marbles', 'A bag contains'] : ['oatmeal', 'peanut butter', 'sugar', 'cookies', 'A jar contains'];
  const correct = F(a + c, N);
  const vals = [correct, F(b, N), F(a + c, b), F(a, N)]; need(!vals[2].isInt());
  need(new Set(vals.map((x) => x.str())).size === 4);
  return { stem: `<p>${items[4]} only ${a} ${items[0]} ${items[3]}, ${b} ${items[1]} ${items[3]}, and ${c} ${items[2]} ${items[3]}. If one of the ${items[3]} is chosen at random, what is the probability that it is <em>not</em> ${items[1] === 'blue' ? 'blue' : 'a ' + items[1] + ' cookie'}?</p>`,
    choices: vals.map((x) => frc(x.n, x.d)), explanation: `There are ${N} ${items[3]} in total, and ${a + c} of them are not ${items[1]}. The probability is ${m(`\\frac{${a + c}}{${N}}${correct.d !== N ? ' = ' + correct.tex() : ''}`)}.`, verify: () => close(correct.val(), 1 - b / N) };
});

def('percent-what', 1, 'spr', 1, SK.pct, (r, v) => {
  const p = r.pick([5, 15, 20, 25, 30, 40, 60, 75, 80]), b = r.int(4, 30) * 4; const a = p * b / 100; need(isInt(a));
  if (v === 0) return { stem: `<p>${a} is what percent of ${b}?</p>`, answer: spr(p), explanation: `${m(`\\frac{${a}}{${b}} = ${p / 100}`)}, which is ${p}%.`, verify: () => close(a / b * 100, p) };
  return { stem: `<p>A basketball player made ${a} of her ${b} free-throw attempts this season. What percent of her free-throw attempts did she make?</p>`, answer: spr(p),
    explanation: `${m(`\\frac{${a}}{${b}} = ${p / 100} = ${p}\\%`)}.`, verify: () => close(a / b * 100, p) };
});

def('range-mode', 1, 'mcq', 1, SK.one, (r) => {
  const xs = Array.from({ length: 8 }, () => r.int(10, 40)); const mx = Math.max(...xs), mn = Math.min(...xs);
  const vals = [mx - mn, mx, (mx + mn) / 2, median(xs)]; need(new Set(vals).size === 4 && isInt(vals[2]));
  return { stem: `<p>The daily high temperatures, in degrees Fahrenheit, in a mountain town for 8 days were ${xs.join(', ')}. What is the range of these temperatures?</p>`, ...numCh(vals, (z) => m(decStr(z))),
    explanation: `The range is the greatest value minus the least value: ${m(`${mx} - ${mn} = ${mx - mn}`)}.`, verify: () => mx - mn === vals[0] };
});

/* ============================ MEDIUM ============================ */
def('cond-prob-table', 2, 'mcq', 2, SK.prob, (r, v) => {
  const t = makeTable(r, v + 2);
  const i = r.int(0, 1), j = r.int(0, 2);
  const correct = F(t.cells[i][j], t.rowT[i]);
  const vals = [correct, F(t.cells[i][j], t.tot), F(t.cells[i][j], t.colT[j]), F(t.rowT[i], t.tot)];
  need(new Set(vals.map((x) => x.str())).size === 4);
  const plural = t.T0.who === 'person' ? 'people' : t.T0.who + 's';
  return { stem: `<p>The table summarizes ${t.T0.ctx}.</p>` + t.html + `<p>If one of the ${plural} in the "${t.T0.rows[i]}" row is selected at random, what is the probability that the ${t.T0.who} is in the "${t.T0.cols[j]}" column?</p>`,
    choices: vals.map((x) => frc(x.n, x.d)),
    explanation: `The selection is only from the "${t.T0.rows[i]}" row, which has ${t.rowT[i]} ${plural}. Of these, ${t.cells[i][j]} are in the "${t.T0.cols[j]}" column, so the probability is ${m(`\\frac{${t.cells[i][j]}}{${t.rowT[i]}}${correct.d !== t.rowT[i] ? ' = ' + correct.tex() : ''}`)}.`,
    verify: () => close(correct.val(), t.cells[i][j] / t.rowT[i]) };
});

def('percent-two-step', 2, 'mcq', 2, SK.pct, (r, v) => {
  if (v === 0) { const p = r.pick([10, 20, 25, 30]);
    const f = (1 + p / 100) * (1 - p / 100) * 100;
    return { stem: `<p>The price of a television was increased by ${p}%. Later, the new price was decreased by ${p}%. The final price is what percent of the original price?</p>`, ...numCh([f, 100, 200 - f, 100 - p], pctS),
      explanation: `The final price is ${m(`(1 + ${p / 100})(1 - ${p / 100}) = ${(1 + p / 100).toFixed(2)} \\times ${(1 - p / 100).toFixed(2)} = ${+(f / 100).toFixed(4)}`)} times the original, or ${decStr(f)}% of it. The decrease is taken on a larger amount than the increase.`, verify: () => close((1 + p / 100) * (1 - p / 100), f / 100) }; }
  const P = r.pick([40, 50, 60, 80]), up = r.pick([20, 40, 50]), off = r.pick([10, 20, 25]); const fin = P * (1 + up / 100) * (1 - off / 100); need(Math.abs(fin * 100 - Math.round(fin * 100)) < 1e-6);
  return { stem: `<p>A store buys a lamp for ${money(P)} and marks the price up by ${up}%. During a sale, the store sells the lamp at ${off}% off the marked-up price. What is the sale price of the lamp?</p>`,
    ...numCh([fin, P * (1 + (up - off) / 100), P * (1 + up / 100) - off, P * (1 - off / 100)], money),
    explanation: `The marked-up price is ${m(`${P}(1 + ${up / 100}) = ${decStr(P * (1 + up / 100))}`)} dollars. ${off}% off leaves ${m(`${decStr(P * (1 + up / 100))}(1 - ${off / 100}) = ${decStr(fin)}`)} dollars.`, verify: () => close(P * (1 + up / 100) * (1 - off / 100), fin) };
});

def('mean-change', 2, 'spr', 2, SK.one, (r, v) => {
  if (v === 0) { const n = r.int(5, 9), mu = r.int(75, 88), d = r.int(1, 3); const x = (n + 1) * (mu + d) - n * mu;
    return { stem: `<p>The mean score of ${n} quizzes that Jordan took is ${mu}. After Jordan takes one more quiz, the mean score of all ${n + 1} quizzes is ${mu + d}. What was Jordan's score on the last quiz?</p>`, answer: spr(x),
      explanation: `The first ${n} scores total ${m(`${n} \\times ${mu} = ${n * mu}`)}. All ${n + 1} scores total ${m(`${n + 1} \\times ${mu + d} = ${(n + 1) * (mu + d)}`)}. The last score is ${m(`${(n + 1) * (mu + d)} - ${n * mu} = ${x}`)}.`, verify: () => close((n * mu + x) / (n + 1), mu + d) }; }
  const n = r.int(8, 12), mu = r.int(15, 30), d = r.int(1, 3); const x = n * mu - (n - 1) * (mu - d);
  return { stem: `<p>The mean of a list of ${n} numbers is ${mu}. When one number is removed from the list, the mean of the remaining ${n - 1} numbers is ${mu - d}. What number was removed?</p>`, answer: spr(x),
    explanation: `The original sum is ${m(`${n}(${mu}) = ${n * mu}`)} and the new sum is ${m(`${n - 1}(${mu - d}) = ${(n - 1) * (mu - d)}`)}. The removed number is ${m(`${n * mu} - ${(n - 1) * (mu - d)} = ${x}`)}.`, verify: () => close((n * mu - x) / (n - 1), mu - d) };
});

def('outlier-effect', 2, 'mcq', 1, SK.one, (r, v) => {
  const n = v === 0 ? 7 : 8; const base = Array.from({ length: n - 1 }, () => r.int(20, 40)); const out = r.int(85, 120);
  const data = [...base, out]; const red = base;
  const dm = mean(red) - mean(data), dmed = median(red) - median(data);
  const lab = (x) => (Math.abs(x) < 1e-9 ? 'stays the same' : x < 0 ? 'decreases' : 'increases');
  const correct = `The mean ${lab(dm)}, and the median ${lab(dmed)}.`;
  const all = ['The mean decreases, and the median decreases.', 'The mean decreases, and the median stays the same.', 'The mean stays the same, and the median decreases.', 'The mean stays the same, and the median stays the same.'];
  need(all.includes(correct));
  const sorted = data.slice().sort((a, b) => a - b);
  return { stem: `<p>The ${v === 0 ? 'ages, in years, of the 7 members of a book club' : 'numbers of minutes 8 commuters spent traveling to work on one day'} are ${sorted.join(', ')}. If the value ${out} is removed from the data, which of the following best describes how the mean and the median change?</p>`,
    choices: [correct, ...all.filter((s) => s !== correct)],
    explanation: `Removing a value much larger than the others lowers the mean (it drops from about ${mean(data).toFixed(1)} to about ${mean(red).toFixed(1)}). The median goes from ${decStr(median(data))} to ${decStr(median(red))}, so it ${lab(dmed)}.`, verify: () => dm < 0 };
});

def('scatter-slope', 2, 'mcq', 2, SK.two, (r, v) => {
  const C = [
    { xl: 'Hours studied', yl: 'Test score', mm: r.pick([3.5, 4, 4.5]), b: r.int(48, 58), xs: [1, 10], intro: 'The scatterplot shows the number of hours that each of 12 students studied for a test and the student\'s score on the test. The line of best fit is also shown.',
      c: (mm) => [`For each additional hour studied, the predicted test score increases by about ${mm} points.`, `A student who studies 0 hours is predicted to score ${mm} points.`, `For each additional point scored, the predicted number of hours studied increases by about ${mm}.`, `Each student studied about ${mm} hours more than the previous student.`] },
    { xl: 'Age of car (years)', yl: 'Value (thousands of $)', mm: -r.pick([1.5, 2, 2.5]), b: r.int(24, 30), xs: [1, 10], intro: 'The scatterplot shows the age, in years, and the value, in thousands of dollars, of 12 used cars of the same model. The line of best fit is also shown.',
      c: (mm) => [`For each additional year of age, the predicted value of the car decreases by about ${-mm} thousand dollars.`, `For each additional year of age, the predicted value of the car increases by about ${-mm} thousand dollars.`, `The predicted value of a new car is about ${-mm} thousand dollars.`, `For each decrease of ${-mm} thousand dollars in value, the car is predicted to be 1 year newer.`] },
  ];
  const c = C[v]; const pts = []; for (let k = 0; k < 12; k++) { const x = +(c.xs[0] + r.f() * (c.xs[1] - c.xs[0])).toFixed(1); pts.push([x, +(c.mm * x + c.b + (r.f() - 0.5) * 6).toFixed(1)]); }
  const ymax = Math.ceil((Math.max(...pts.map((p) => p[1]), c.b) + 4) / 10) * 10;
  const svg = chart({ x: [0, 11], y: [0, ymax], xt: 1, yt: ymax > 50 ? 10 : 5, xlabel: c.xl, ylabel: c.yl, pts, fn: (x) => c.mm * x + c.b });
  return { stem: `<p>${c.intro} The equation of the line is ${m(`y = ${decStr(c.mm)}x + ${c.b}`)}.</p>` + svg + `<p>Which of the following is the best interpretation of the slope of the line of best fit in this context?</p>`,
    choices: c.c(c.mm), explanation: `The slope, ${m(decStr(c.mm))}, is the predicted change in ${m('y')} (${c.yl.toLowerCase()}) for each increase of 1 in ${m('x')} (${c.xl.toLowerCase()}). So: ${c.c(c.mm)[0].charAt(0).toLowerCase() + c.c(c.mm)[0].slice(1)}` };
});

def('margin-of-error', 2, 'mcq', 2, SK.inf, (r, v) => {
  const p = r.int(48, 72), e = r.pick([3, 4, 5]), n = r.pick([400, 600, 800, 1000]);
  const C = v === 0 ? { pop: 'registered voters in the county', act: 'support a proposal to build a new bridge', smp: `${commas(n)} registered voters in a county` }
    : { pop: 'customers of the online store', act: 'are satisfied with the store\'s delivery times', smp: `${commas(n)} customers of an online store` };
  return { stem: `<p>A survey of a random sample of ${C.smp} found that ${p}% of those surveyed ${C.act}. The margin of error for this estimate is ${e}%. Which of the following is the most appropriate conclusion?</p>`,
    choices: [`It is plausible that between ${p - e}% and ${p + e}% of all ${C.pop} ${C.act}.`, `Exactly ${p}% of all ${C.pop} ${C.act}.`, `Between ${p - e}% and ${p + e}% of the people in the sample ${C.act}.`, `It is plausible that between ${p - e}% and ${p + e}% of all adults in the country ${C.act}.`],
    explanation: `The margin of error gives a range of plausible values for the percent in the population that was sampled (all ${C.pop}): ${p}% ± ${e}%, or ${p - e}% to ${p + e}%. The sample percent is exactly ${p}%, and the result cannot be generalized beyond the population sampled.` };
});

def('sample-estimate', 2, 'mcq', 2, SK.inf, (r, v) => {
  const n = r.pick([50, 80, 120, 200]), k = r.int(4, 30), N = r.pick([2000, 3000, 4000, 5000, 6000]); const est = k * N / n; need(isInt(est) && k < n / 2);
  const C = v === 0 ? [`A random sample of ${n} cars in a large parking garage found that ${k} of them were electric vehicles. The garage contains ${commas(N)} cars.`, 'electric vehicles in the garage']
    : [`A quality inspector randomly selected ${n} light bulbs from a shipment of ${commas(N)} bulbs and found that ${k} of the selected bulbs were defective.`, 'defective bulbs in the shipment'];
  return { stem: `<p>${C[0]} Based on the sample, what is the best estimate of the number of ${C[1]}?</p>`, ...numCh([est, N - est, est / 10, est * 10], (z) => m(texInt(valOf(z)))),
    explanation: `The sample proportion is ${m(`\\frac{${k}}{${n}}`)}. Applying it to the whole group: ${m(`\\frac{${k}}{${n}} \\times ${texInt(N)} = ${texInt(est)}`)}.`, verify: () => close(k / n * N, est) };
});

def('rate-units', 2, 'spr', 1, SK.ratio, (r, v) => {
  if (v === 0) { const kmh = r.pick([36, 54, 72, 90, 108]); const ms = kmh * 1000 / 3600;
    return { stem: `<p>A train travels at a constant speed of ${kmh} kilometers per hour. What is the train's speed in meters per second? (1 kilometer = 1,000 meters)</p>`, answer: spr(F(kmh * 1000, 3600)),
      explanation: `${m(`${kmh}\\ \\frac{\\text{km}}{\\text{h}} \\times \\frac{1{,}000\\ \\text{m}}{1\\ \\text{km}} \\times \\frac{1\\ \\text{h}}{3{,}600\\ \\text{s}} = ${decStr(ms)}`)} meters per second.`, verify: () => close(kmh / 3.6, ms) }; }
  const ml = r.pick([2, 3, 4, 5]); const L7 = ml * 60 * 24 * 7 / 1000;
  return { stem: `<p>A faucet leaks water at a constant rate of ${ml} milliliters per minute. How many liters of water does the faucet leak in one week? (1 liter = 1,000 milliliters)</p>`, answer: sprDec(L7),
    explanation: `One week has ${m(`7 \\times 24 \\times 60 = 10{,}080`)} minutes. The faucet leaks ${m(`${ml} \\times 10{,}080 = ${texInt(ml * 10080)}`)} milliliters, which is ${m(decStr(L7))} liters.`, verify: () => close(ml * 10080 / 1000, L7) };
});

def('map-scale', 2, 'mcq', 2, SK.ratio, (r, v) => {
  if (v === 0) { const inch = r.pick([1.5, 2, 2.5]), mi = r.pick([10, 15, 20, 25]), d = r.pick([4.5, 6, 7.5, 9, 10.5]); const ans = d / inch * mi; need(isInt(ans));
    return { stem: `<p>On a map, ${inch} inches represents ${mi} miles. Two towns are ${d} inches apart on the map. What is the actual distance, in miles, between the two towns?</p>`, ...numCh([ans, d * mi, F(mi * 10, Math.round(inch * 10)), mi + d], (z) => m(L.nice(z))),
      explanation: `${m(`\\frac{${mi}}{${inch}} = \\frac{x}{${d}}`)}, so ${m(`x = \\frac{${mi}(${d})}{${inch}} = ${ans}`)} miles.`, verify: () => close(mi / inch * d, ans) }; }
  const k = r.pick([12, 18, 24, 48]), ft = r.pick([12, 14, 16, 18]); const ans = F(ft * 12, k);
  return { stem: `<p>A model of a car is built using a scale of 1 to ${k}, meaning 1 inch on the model represents ${k} inches on the actual car. The actual car is ${ft} feet long. How long, in inches, is the model? (1 foot = 12 inches)</p>`, ...numCh([ans, F(ft, k), F(ft * k, 12), ft * 12 * k], (z) => m(L.nice(z))),
    explanation: `The actual car is ${m(`${ft} \\times 12 = ${ft * 12}`)} inches long. The model length is ${m(`\\frac{${ft * 12}}{${k}} = ${ans.tex()}`)} inches.`, verify: () => close(ft * 12 / k, ans.val()) };
});

def('freq-table-mean', 2, 'spr', 2, SK.one, (r, v) => {
  const vals = v === 0 ? [0, 1, 2, 3, 4] : [5, 6, 7, 8, 9, 10];
  const fr0 = vals.map(() => r.int(1, 9)); const n = fr0.reduce((a, b) => a + b, 0); const s = vals.reduce((a, x, i) => a + x * fr0[i], 0);
  const mu = F(s, n); need(L.sprFits(mu.str()) || (mu.d <= 25 && [2, 4, 5, 8, 10, 20, 25].includes(mu.d)));
  try { spr(mu); } catch (e) { need(false); }
  const lab = v === 0 ? ['Number of siblings', 'Number of students'] : ['Rating', 'Number of reviewers'];
  return { stem: `<p>The frequency table summarizes ${v === 0 ? 'the number of siblings reported by each student in a class' : 'the ratings, on a scale from 5 to 10, that reviewers gave a new restaurant'}.</p>` + ptable(lab, vals.map((x, i) => [x, fr0[i]])) + `<p>What is the mean of the data?</p>`,
    answer: spr(mu), explanation: `Multiply each value by its frequency and add: the total is ${s}. There are ${n} data values, so the mean is ${m(`\\frac{${s}}{${n}}${mu.d !== n ? ' = ' + mu.tex() : ''}`)}${mu.d !== 1 ? `, or about ${mu.val().toFixed(2)}` : ''}.`, verify: () => close(vals.reduce((a, x, i) => a + x * fr0[i], 0) / n, mu.val()) };
});

def('sd-compare', 2, 'mcq', 2, SK.one, (r, v) => {
  const ctr = 5;
  const A = {}, B = {};
  if (v === 0) { [[4, 2], [5, 6], [6, 2]].forEach(([x, c]) => (A[x] = c)); [[1, 2], [3, 2], [5, 2], [7, 2], [9, 2]].forEach(([x, c]) => (B[x] = c)); }
  else { [[2, 3], [5, 1], [8, 3]].forEach(([x, c]) => (A[x] = c)); [[3, 1], [4, 2], [5, 1], [6, 2], [7, 1]].forEach(([x, c]) => (B[x] = c)); }
  const expand = (o) => Object.entries(o).flatMap(([x, c]) => Array(c).fill(+x));
  const a = expand(A), b = expand(B);
  const bigger = sd(a) > sd(b) ? 'A' : 'B';
  void ctr;
  const svgA = dotPlot({ min: 0, max: 10, counts: A, label: 'Data set A' }), svgB = dotPlot({ min: 0, max: 10, counts: B, label: 'Data set B' });
  const choices = [`The standard deviation of data set ${bigger} is greater.`, `The standard deviation of data set ${bigger === 'A' ? 'B' : 'A'} is greater.`, 'The standard deviations of the two data sets are equal.', 'There is not enough information to compare the standard deviations.'];
  return { stem: `<p>The dot plots show the distributions of two data sets, A and B. Both data sets have a mean of ${decStr(mean(a))}.</p>` + svgA + svgB + `<p>Which statement about the standard deviations of the two data sets is true?</p>`, choices, order: [bigger === 'A' ? 0 : 1, bigger === 'A' ? 1 : 0, 2, 3],
    explanation: `Standard deviation measures how spread out the values are from the mean. The values in data set ${bigger} are, overall, farther from the mean of ${decStr(mean(a))} than those in the other set, so data set ${bigger} has the greater standard deviation.`, verify: () => close(mean(a), mean(b)) && Math.abs(sd(a) - sd(b)) > 0.3 };
});

def('percent-of-percent', 2, 'spr', 1, SK.pct, (r, v) => {
  if (v === 0) { const p = r.pick([20, 30, 40, 60]), x = r.int(3, 20) * 10, q = r.pick([15, 45, 70, 90]); const a = p * x / 100, b = q * x / 100; need(isInt(b) && isInt(a) && p !== q);
    return { stem: `<p>If ${p}% of a number is ${a}, what is ${q}% of the number?</p>`, answer: spr(b),
      explanation: `${m(`${p / 100}n = ${a}`)}, so ${m(`n = ${x}`)}. Then ${q}% of ${x} is ${m(`${q / 100} \\times ${x} = ${b}`)}.`, verify: () => close(q / 100 * (a / (p / 100)), b) }; }
  const a = r.pick([60, 80, 120, 150]), q = r.pick([20, 30, 40]), b = r.pick([40, 60, 75, 90]); const p = F(q * b, a); need(p.isInt());
  return { stem: `<p>${m('p')}% of ${a} is equal to ${q}% of ${b}. What is the value of ${m('p')}?</p>`, answer: spr(p),
    explanation: `${m(`\\frac{p}{100}(${a}) = ${q / 100}(${b}) = ${decStr(q * b / 100)}`)}, so ${m(`p = \\frac{${decStr(q * b / 100)}(100)}{${a}} = ${p.n}`)}.`, verify: () => close(p.val() / 100 * a, q / 100 * b) };
});

def('experiment-design', 2, 'mcq', 2, SK.claims, (r, v) => {
  const C = [
    { s: 'A researcher recruited 300 adult volunteers and randomly assigned half of them to drink a cup of green tea each day and the other half to drink a cup of water each day. After 8 weeks, the green tea group had a significantly lower average blood pressure than the water group. Which of the following conclusions is best supported by the study?',
      c: ['Drinking green tea daily causes lower blood pressure for adults similar to the volunteers in the study.', 'Drinking green tea daily causes lower blood pressure for all adults.', 'There is an association between drinking green tea and blood pressure, but no conclusion about cause and effect can be made.', 'No conclusion can be made, because the participants were volunteers.'],
      e: 'Because the treatments were randomly assigned, the study supports a cause-and-effect conclusion. Because the participants were volunteers rather than a random sample of all adults, the conclusion applies only to adults similar to those in the study.' },
    { s: 'In a survey of a random sample of 1,200 adults in a state, those who reported exercising at least three times per week also reported sleeping more hours per night, on average, than those who exercised less. Which of the following is an appropriate conclusion?',
      c: ['Among adults in the state, exercising at least three times per week is associated with sleeping more hours per night.', 'Exercising at least three times per week causes adults in the state to sleep more hours per night.', 'Sleeping more hours per night causes adults in the state to exercise more often.', 'The results cannot be applied to any adults other than the 1,200 who were surveyed.'],
      e: 'This is an observational study, so it can show an association but not cause and effect. Because the sample was randomly selected from adults in the state, the association can be generalized to adults in that state.' },
  ];
  const c = C[v];
  return { stem: `<p>${c.s}</p>`, choices: c.c, explanation: c.e };
});

def('model-type', 2, 'mcq', 2, SK.two, (r, v) => {
  const opts = ['Increasing linear', 'Decreasing linear', 'Increasing exponential', 'Decreasing exponential'];
  if (v === 0) { const a = r.pick([800, 1200, 1600]), f = r.pick([0.5, 0.75]); const xs = [0, 1, 2, 3, 4]; const ys = xs.map((x) => a * f ** x); need(ys.every(isInt));
    return { stem: `<p>The table shows the number of grams ${m('y')} of a substance remaining ${m('x')} days after an experiment began.</p>` + ptable([m('x'), m('y')], xs.map((x, i) => [x, commas(ys[i])])) + `<p>Which of the following best describes the relationship between ${m('x')} and ${m('y')}?</p>`,
      choices: [opts[3], opts[1], opts[2], opts[0]], order: [3, 1, 2, 0], explanation: `Each day, ${m('y')} is multiplied by the same factor, ${f}. A constant multiplicative decrease is a decreasing exponential relationship (a linear relationship would decrease by the same amount each day).`, verify: () => close(ys[2] / ys[1], ys[1] / ys[0]) }; }
  const g = r.pick([150, 200, 250]);
  return { stem: `<p>A town's population increased by ${g} people each year from 2010 to 2020. Which of the following best describes the relationship between the population and the number of years since 2010 during this period?</p>`,
    choices: [opts[0], opts[2], opts[1], opts[3]], order: [0, 2, 1, 3], explanation: `The population changed by the same amount, ${g} people, each year. A constant additive change describes an increasing linear relationship.` };
});

/* ============================ HARD ============================ */
def('cond-prob-hard', 3, 'spr', 2, SK.prob, (r, v) => {
  const t = makeTable(r, v === 0 ? 1 : 3, 8, 60);
  const i = r.int(0, 1), j = r.int(0, 2);
  // probability of row i given NOT column j
  const notj = t.rowT[i] - t.cells[i][j], notjT = t.tot - t.colT[j];
  const p = F(notj, notjT); need(L.sprFits(p.str()));
  const plural = t.T0.who === 'person' ? 'people' : t.T0.who + 's';
  return { stem: `<p>The table summarizes ${t.T0.ctx}.</p>` + t.html + `<p>One of the ${plural} ${t.T0.who === 'part' ? 'that' : 'who'} ${t.T0.who === 'part' ? 'are' : 'are'} <em>not</em> in the "${t.T0.cols[j]}" column will be selected at random. What is the probability that the ${t.T0.who} selected is in the "${t.T0.rows[i]}" row? (Express your answer as a fraction or decimal.)</p>`,
    answer: spr(p), explanation: `There are ${m(`${t.tot} - ${t.colT[j]} = ${notjT}`)} ${plural} not in the "${t.T0.cols[j]}" column. Of those, ${m(`${t.rowT[i]} - ${t.cells[i][j]} = ${notj}`)} are in the "${t.T0.rows[i]}" row. The probability is ${m(`\\frac{${notj}}{${notjT}}${p.d !== notjT ? ' = ' + p.tex() : ''}`)}.`,
    verify: () => { let num0 = 0, den = 0; for (let a = 0; a < 2; a++) for (let b = 0; b < 3; b++) if (b !== j) { den += t.cells[a][b]; if (a === i) num0 += t.cells[a][b]; } return close(num0 / den, p.val()); } };
});

def('multi-unit', 3, 'spr', 1, SK.ratio, (r, v) => {
  if (v === 0) { const cf = r.pick([1800, 2400, 2700, 3600]), gpm = r.pick([4.5, 5, 6, 7.5]); const h = cf * 7.5 / gpm / 60; need(isInt(h * 4));
    return { stem: `<p>A swimming pool holds ${commas(cf)} cubic feet of water. A hose fills the pool at a constant rate of ${gpm} gallons per minute. If 1 cubic foot is approximately 7.5 gallons, approximately how many hours will it take to fill the empty pool with the hose?</p>`, answer: spr(F(Math.round(h * 4), 4)),
      explanation: `The pool holds ${m(`${texInt(cf)} \\times 7.5 = ${texInt(cf * 7.5)}`)} gallons. At ${gpm} gallons per minute this takes ${m(`\\frac{${texInt(cf * 7.5)}}{${gpm}} = ${texInt(cf * 7.5 / gpm)}`)} minutes, which is ${m(`\\frac{${texInt(cf * 7.5 / gpm)}}{60} = ${decStr(h)}`)} hours.`, verify: () => close(cf * 7.5 / gpm / 60, h) }; }
  const m0 = r.pick([200, 400, 800]), s = r.pick([25, 40, 50, 64, 80, 100, 125]); const kmh = m0 / s * 3.6; need(Math.abs(kmh * 100 - Math.round(kmh * 100)) < 1e-6);
  return { stem: `<p>A runner completes ${m0} meters in ${s} seconds. What is the runner's average speed, in kilometers per hour? (1 kilometer = 1,000 meters)</p>`, answer: sprDec(+kmh.toFixed(2)),
    explanation: `The speed is ${m(`\\frac{${m0}}{${s}} = ${decStr(m0 / s)}`)} meters per second. In one hour (3,600 seconds) the runner would cover ${m(`${decStr(m0 / s)} \\times 3{,}600 = ${texInt(m0 / s * 3600)}`)} meters, or ${m(decStr(kmh))} kilometers. So the speed is ${decStr(kmh)} kilometers per hour.`, verify: () => close(m0 / 1000 / (s / 3600), kmh) };
});

def('reverse-percent', 3, 'spr', 2, SK.pct, (r, v) => {
  if (v === 0) { const P = r.pick([40, 60, 75, 80, 120, 150]), d = r.pick([10, 20, 25]), tx = r.pick([5, 6, 8]); const paid = P * (1 - d / 100) * (1 + tx / 100); need(Math.abs(paid * 100 - Math.round(paid * 100)) < 1e-6);
    return { stem: `<p>A customer bought a coat that was on sale for ${d}% off its original price. A sales tax of ${tx}% was then added to the sale price, and the customer paid a total of ${money(+paid.toFixed(2))}. What was the original price, in dollars, of the coat?</p>`, answer: spr(P),
      explanation: `If ${m('p')} is the original price, then ${m(`p(${(1 - d / 100).toFixed(2)})(${(1 + tx / 100).toFixed(2)}) = ${paid.toFixed(2)}`)}, so ${m(`${+((1 - d / 100) * (1 + tx / 100)).toFixed(4)}p = ${paid.toFixed(2)}`)} and ${m(`p = ${P}`)}.`, verify: () => close(paid / ((1 - d / 100) * (1 + tx / 100)), P) }; }
  const P0 = r.pick([4000, 6000, 8000, 12000]), g = r.pick([15, 25, 35]); const P1 = P0 * (1 + g / 100);
  return { stem: `<p>The population of a town increased by ${g}% from 2015 to 2020. The population in 2020 was ${commas(P1)}. What was the population of the town in 2015?</p>`, answer: spr(P0),
    explanation: `If ${m('x')} was the 2015 population, then ${m(`${1 + g / 100}x = ${texInt(P1)}`)}, so ${m(`x = \\frac{${texInt(P1)}}{${1 + g / 100}} = ${texInt(P0)}`)}. (Taking ${g}% of ${commas(P1)} and subtracting would be incorrect, because the percent is of the 2015 population.)`, verify: () => close(P1 / (1 + g / 100), P0) };
});

def('weighted-mean', 3, 'mcq', 2, SK.one, (r, v) => {
  if (v === 0) { const n1 = r.pick([12, 15, 18, 20]), n2 = r.pick([24, 25, 30]), m1 = r.int(70, 80), m2 = r.int(82, 92); const mu = F(n1 * m1 + n2 * m2, n1 + n2); need(mu.isInt() || mu.d <= 5);
    return { stem: `<p>In one class of ${n1} students, the mean score on a test was ${m1}. In another class of ${n2} students, the mean score on the same test was ${m2}. What was the mean score on the test for all ${n1 + n2} students?</p>`, ...numCh([mu, F(m1 + m2, 2), F(n1 * m2 + n2 * m1, n1 + n2), m2], (z) => m(L.nice(z))),
      explanation: `The total of all scores is ${m(`${n1}(${m1}) + ${n2}(${m2}) = ${n1 * m1 + n2 * m2}`)}. Dividing by ${n1 + n2} students gives ${m(mu.tex())}${mu.isInt() ? '' : ` (${mu.val()})`}. (The mean is not simply the average of ${m1} and ${m2}, because the classes are different sizes.)`, verify: () => close((n1 * m1 + n2 * m2) / (n1 + n2), mu.val()) }; }
  const na = r.int(10, 20), ma = r.int(70, 78), mb = r.int(84, 92), c = r.int(ma + 2, mb - 2); const nb = na * (c - ma) / (mb - c); need(isInt(nb));
  return { stem: `<p>A teacher combined the scores of two groups of students. Group A had ${na} students with a mean score of ${ma}. Group B had a mean score of ${mb}. The mean score of all the students in both groups was ${c}. How many students were in group B?</p>`, ...numCh([nb, na, F(na * (mb - c), c - ma), nb + na], (z) => m(L.nice(z))),
    explanation: `If group B has ${m('n')} students, then ${m(`\\frac{${na}(${ma}) + ${mb}n}{${na} + n} = ${c}`)}. So ${m(`${na * ma} + ${mb}n = ${na * c} + ${c}n`)}, giving ${m(`${mb - c}n = ${na * (c - ma)}`)} and ${m(`n = ${nb}`)}.`, verify: () => close((na * ma + nb * mb) / (na + nb), c) };
});

def('median-freq', 3, 'spr', 2, SK.one, (r, v) => {
  const vals = v === 0 ? [1, 2, 3, 4, 5, 6] : [10, 20, 30, 40, 50];
  const fq = vals.map(() => r.int(3, 25)); const n = fq.reduce((a, b) => a + b, 0); need(n % 2 === 1);
  const data = vals.flatMap((x, i) => Array(fq[i]).fill(x)); const med = median(data); const mu = mean(data);
  need(Math.abs(mu - med) > 0.3);
  const lab = v === 0 ? ['Number of people in household', 'Frequency'] : ['Minutes of exercise', 'Number of people'];
  return { stem: `<p>The table summarizes ${v === 0 ? 'the number of people living in each of the households on a street' : 'the number of minutes of exercise that people in a survey reported on a given day'}.</p>` + ptable(lab, vals.map((x, i) => [x, fq[i]])) + `<p>What is the median of the data?</p>`,
    answer: spr(med), explanation: `There are ${n} values, so the median is the ${ord((n + 1) / 2)} value in order. Adding frequencies from the smallest value: ${fq.map((f, i) => fq.slice(0, i + 1).reduce((a, b) => a + b, 0)).join(', ')}. The ${ord((n + 1) / 2)} value falls in the group with value ${med}.`, verify: () => median(data) === med };
});

def('moe-hard', 3, 'mcq', 2, SK.inf, (r, v) => {
  if (v === 0) { const p = r.int(30, 45), e = r.pick([2, 3]), q = p + e + r.int(2, 6);
    return { stem: `<p>A polling organization surveyed a random sample of adults in a state and estimated that ${p}% of adults in the state commute to work by public transit, with an associated margin of error of ${e}%. A city official claims that more than ${q}% of adults in the state commute by public transit. Based on the survey, which of the following statements is true?</p>`,
      choices: [`The claim is not supported, because ${q}% is above the range of plausible values, ${p - e}% to ${p + e}%.`, `The claim is supported, because ${q}% is within ${q - p} percentage points of ${p}%.`, `The claim is supported, because the margin of error shows the true percent could be any value.`, `The claim cannot be evaluated, because the survey did not include every adult in the state.`],
      explanation: `The plausible values for the population percent are ${p}% ± ${e}%, that is, ${p - e}% to ${p + e}%. A value above ${q}% lies outside this interval, so the survey does not support the claim.` }; }
  return { stem: `<p>Two researchers each surveyed a different random sample of students at the same university about the number of hours per week they work at a job. Researcher A surveyed 150 students and researcher B surveyed 600 students. Both researchers used the same method to compute a margin of error for the mean number of hours. Which of the following is most likely true?</p>`,
    choices: ['The margin of error for researcher B is smaller than the margin of error for researcher A.', 'The margin of error for researcher B is larger than the margin of error for researcher A.', 'The two margins of error are equal, because the samples come from the same university.', 'The margin of error for researcher B is exactly one-fourth of the margin of error for researcher A.'],
    explanation: 'Larger random samples produce less variability in sample statistics, so the larger sample (researcher B) is likely to have a smaller margin of error. (The margin of error shrinks roughly in proportion to the square root of the sample size, so it would be about half as large, not exactly one-fourth.)' };
});

def('transform-stats', 3, 'mcq', 1, SK.one, (r, v) => {
  const k = r.int(3, 9);
  if (v === 0) return { stem: `<p>Each value in a data set is increased by ${k}. Which of the following statements about the new data set is true?</p>`,
    choices: [`The mean increases by ${k}, and the standard deviation does not change.`, `The mean and the standard deviation both increase by ${k}.`, `The mean does not change, and the standard deviation increases by ${k}.`, `The mean increases by ${k}, and the standard deviation decreases.`],
    explanation: `Adding ${k} to every value shifts the whole distribution by ${k}, so the mean (and median) increase by ${k}. The distances between values and the mean do not change, so the standard deviation (and range) stay the same.`, verify: () => { const a = [1, 4, 6, 9], b = a.map((x) => x + k); return close(mean(b), mean(a) + k) && close(sd(b), sd(a)); } };
  return { stem: `<p>Each value in a data set is multiplied by ${k}. Which of the following statements about the new data set is true?</p>`,
    choices: [`The mean and the standard deviation are both multiplied by ${k}.`, `The mean is multiplied by ${k}, and the standard deviation does not change.`, `The mean is multiplied by ${k}, and the standard deviation is multiplied by ${k * k}.`, `The mean increases by ${k}, and the standard deviation is multiplied by ${k}.`],
    explanation: `Multiplying every value by ${k} multiplies every distance from the mean by ${k} too. So both the mean and the standard deviation are multiplied by ${k}.`, verify: () => { const a = [1, 4, 6, 9], b = a.map((x) => x * k); return close(mean(b), mean(a) * k) && close(sd(b), sd(a) * k); } };
});

def('residual', 3, 'mcq', 2, SK.two, (r, v) => {
  const mm = v === 0 ? r.pick([1.5, 2, 2.5]) : r.pick([3, 4]); const b = r.int(4, 10);
  const xs = [1, 2, 3, 4, 5, 6, 7, 8];
  const pts = xs.map((x) => [x, Math.round(mm * x + b + (r.f() - 0.5) * 6)]);
  const k = r.int(2, 7); const actual = pts[k - 1][1]; const pred = mm * k + b; const res = +(actual - pred).toFixed(2); need(Math.abs(res) >= 1);
  const ymax = Math.ceil((Math.max(...pts.map((p) => p[1])) + 3) / 5) * 5;
  const svg = chart({ x: [0, 9], y: [0, ymax], xt: 1, yt: ymax > 30 ? 5 : 2, xlabel: v === 0 ? 'Weeks' : 'Days', ylabel: v === 0 ? 'Height (in)' : 'Sales', pts, fn: (x) => mm * x + b });
  const vals = [res, -res, pred, actual];
  need(new Set(vals).size === 4);
  return { stem: `<p>The scatterplot shows ${v === 0 ? `the height, in inches, of a plant measured at the end of each of 8 weeks` : `the number of sales a new store made on each of its first 8 days`}, along with the line of best fit ${m(`y = ${decStr(mm)}x + ${b}`)}. For the data point with ${m(`x = ${k}`)}, what is the difference between the actual ${m('y')}-value and the ${m('y')}-value predicted by the line of best fit (actual minus predicted)?</p>` + svg,
    ...numCh(vals, (z) => m(decStr(z))), explanation: `From the graph, the actual value at ${m(`x = ${k}`)} is ${actual}. The predicted value is ${m(`${decStr(mm)}(${k}) + ${b} = ${decStr(pred)}`)}. Actual minus predicted is ${m(`${actual} - ${decStr(pred)} = ${decStr(res)}`)}.`, verify: () => close(actual - (mm * k + b), res) };
});

def('ratio-chain', 3, 'mcq', 2, SK.ratio, (r, v) => {
  if (v === 0) { const a = r.int(2, 5), b = r.int(3, 7), c = r.int(3, 7), d = r.int(2, 6); need(L.gcd(a, b) === 1 && L.gcd(c, d) === 1);
    // x:y = a:b, y:z = c:d -> x:z = ac : bd
    const k = r.int(2, 6); const zz = b * d * k; const xx = F(a * c * zz, b * d); need(xx.isInt());
    return { stem: `<p>The ratio of ${m('x')} to ${m('y')} is ${a} to ${b}, and the ratio of ${m('y')} to ${m('z')} is ${c} to ${d}. If ${m(`z = ${zz}`)}, what is the value of ${m('x')}?</p>`, ...numCh([xx, F(a * d * zz, b * c), F(a * zz, b), F(c * zz, d)], (z) => m(L.nice(z))),
      explanation: `From ${m(`\\frac{y}{z} = \\frac{${c}}{${d}}`)}, ${m(`y = \\frac{${c}}{${d}}(${zz}) = ${F(c * zz, d).tex()}`)}. Then ${m(`x = \\frac{${a}}{${b}}y = ${xx.tex()}`)}.`, verify: () => close(xx.val() / (c * zz / d), a / b) }; }
  const V = r.pick([5, 6, 8, 10]), cpart = r.int(1, 3), wpart = r.int(cpart + 1, 5); need(L.gcd(cpart, wpart) === 1); const conc = V * cpart / (cpart + wpart), water = V - conc; need(isInt(conc * 2));
  const add = water - conc; // to make 1:1 add concentrate
  return { stem: `<p>A ${V}-liter mixture of juice concentrate and water contains concentrate and water in the ratio ${cpart} to ${wpart}. How many liters of concentrate must be added to the mixture so that the ratio of concentrate to water is 1 to 1?</p>`, ...numCh([F(Math.round(add * 2), 2), conc, water, F(V, 2)], (z) => m(L.nice(z))),
    explanation: `The mixture contains ${m(`${V} \\times \\frac{${cpart}}{${cpart + wpart}} = ${decStr(conc)}`)} liters of concentrate and ${decStr(water)} liters of water. Adding concentrate does not change the amount of water, so the concentrate must increase to ${decStr(water)} liters: add ${m(`${decStr(water)} - ${decStr(conc)} = ${decStr(add)}`)} liters.`, verify: () => close(conc + add, water) };
});

def('density', 3, 'spr', 1, SK.ratio, (r, v) => {
  if (v === 0) { const e = r.pick([2, 3, 4, 5]), d = r.pick([2.7, 7.8, 8.9, 1.2, 0.8]); const mass = +(d * e ** 3).toFixed(2);
    return { stem: `<p>A solid cube of metal has an edge length of ${e} centimeters and a mass of ${mass} grams. What is the density of the metal, in grams per cubic centimeter? (Density is mass divided by volume.)</p>`, answer: sprDec(d),
      explanation: `The volume of the cube is ${m(`${e}^3 = ${e ** 3}`)} cubic centimeters. The density is ${m(`\\frac{${mass}}{${e ** 3}} = ${d}`)} grams per cubic centimeter.`, verify: () => close(mass / e ** 3, d) }; }
  const d = r.pick([0.6, 0.5, 0.75]), l = r.pick([10, 20, 25]), w = r.pick([8, 10, 12]), h = r.pick([4, 5, 6]); const kg = d * l * w * h / 1000; need(Math.abs(kg * 1000 - Math.round(kg * 1000)) < 1e-6);
  return { stem: `<p>A rectangular block of wood measures ${l} centimeters by ${w} centimeters by ${h} centimeters. The density of the wood is ${d} gram per cubic centimeter. What is the mass of the block, in kilograms? (1 kilogram = 1,000 grams)</p>`, answer: sprDec(kg),
    explanation: `The volume is ${m(`${l} \\times ${w} \\times ${h} = ${texInt(l * w * h)}`)} cubic centimeters, so the mass is ${m(`${d} \\times ${texInt(l * w * h)} = ${texInt(d * l * w * h)}`)} grams, which is ${m(decStr(kg))} kilograms.`, verify: () => close(d * l * w * h / 1000, kg) };
});

def('successive-percent', 3, 'mcq', 1, SK.pct, (r, v) => {
  if (v === 0) { const a = r.pick([10, 20, 25]), b = r.pick([10, 20, 30, 40]); const tot = +(((1 + a / 100) * (1 + b / 100) - 1) * 100).toFixed(2);
    return { stem: `<p>The number of members of a club increased by ${a}% from 2021 to 2022 and then increased by ${b}% from 2022 to 2023. By what percent did the number of members increase from 2021 to 2023?</p>`, ...numCh([tot, a + b, a * b / 10 === tot ? a * b : a * b / 10, 100 + a + b], pctS),
      explanation: `The number of members was multiplied by ${m(`(1 + ${a / 100})(1 + ${b / 100}) = ${+((1 + a / 100) * (1 + b / 100)).toFixed(4)}`)}, which is an increase of ${tot}%. Simply adding the percents ignores that the second increase applies to a larger number.`, verify: () => close((1 + a / 100) * (1 + b / 100), 1 + tot / 100) }; }
  const a = r.pick([20, 40, 50, 60]), b = r.pick([20, 25, 30]); const res = +((1 + a / 100) * (1 - b / 100) * 100).toFixed(2);
  return { stem: `<p>The number ${m('p')} is ${a}% greater than the number ${m('q')}, and ${m('q')} is ${b}% less than the positive number ${m('s')}. The value of ${m('p')} is what percent of the value of ${m('s')}?</p>`, ...numCh([res, 100 + a - b, 100 - a + b, a - b + 0 === res ? 1 : a + b], pctS),
    explanation: `${m(`p = ${1 + a / 100}q`)} and ${m(`q = ${(1 - b / 100).toFixed(2)}s`)}, so ${m(`p = ${1 + a / 100}(${(1 - b / 100).toFixed(2)})s = ${decStr(res / 100)}s`)}. So ${m('p')} is ${res}% of ${m('s')}.`, verify: () => close((1 + a / 100) * (1 - b / 100) * 100, res) };
});

def('claims-hard', 3, 'mcq', 2, SK.claims, (r, v) => {
  const C = [
    { s: 'A website asked its visitors to take an online poll about whether they favor a four-day school week. Of the 2,400 visitors who chose to respond, 71% said they favor a four-day school week. Which of the following is the most appropriate conclusion?',
      c: ['The results cannot be generalized to a larger population, because the respondents chose whether to participate.', 'About 71% of all people in the country favor a four-day school week.', 'About 71% of all visitors to the website favor a four-day school week.', 'Because the sample is large, the results are representative of all parents of school-age children.'],
      e: 'The respondents were self-selected rather than randomly selected, so the sample may be biased. A large sample does not fix this bias, and the results cannot be reliably generalized even to all visitors of the website.' },
    { s: 'A researcher selected a random sample of 50 orange trees from a large orchard. Half of the selected trees were randomly assigned to receive a new fertilizer, and the other half received the current fertilizer. The trees that received the new fertilizer produced significantly more oranges. Which of the following statements is best supported by this study?',
      c: ['The new fertilizer causes an increase in orange production for trees in this orchard.', 'The new fertilizer causes an increase in orange production for all orange trees.', 'The new fertilizer is associated with greater orange production, but it does not cause the increase.', 'The new fertilizer causes an increase in production for any type of fruit tree in the orchard.'],
      e: 'Random assignment of the fertilizers supports a cause-and-effect conclusion, and random selection from this orchard allows the conclusion to be generalized to trees in this orchard only, not to all orange trees or to other kinds of trees.' },
  ];
  const c = C[v];
  return { stem: `<p>${c.s}</p>`, choices: c.c, explanation: c.e };
});

def('must-be-true', 3, 'mcq', 1, SK.one, (r) => {
  const n = r.int(8, 12), mu = r.int(15, 40);
  return { stem: `<p>A data set consists of ${n} numbers with a mean of ${mu}. A new data set is formed by adding the number ${mu} to the original data set. Which of the following must be true about the new data set, compared with the original data set?</p>`,
    choices: ['The mean is the same.', 'The median is the same.', 'The range is greater.', 'The standard deviation is greater.'],
    explanation: `The new sum is ${m(`${n}(${mu}) + ${mu} = ${n + 1}(${mu})`)}, so the new mean is ${mu}, unchanged. The median may change (it depends on the other values), the range cannot increase because ${mu} lies between the minimum and maximum, and adding a value at the mean cannot increase the standard deviation.`,
    verify: () => close((n * mu + mu) / (n + 1), mu) };
});

def('work-rate', 3, 'spr', 2, SK.ratio, (r, v) => {
  const a = r.int(3, 10), b = r.int(2, 9); need(a !== b);
  const t = F(a * b, a + b); need(L.sprFits(t.str()) || terminatesOk(t));
  const C = v === 0 ? [`Pump A can fill a tank in ${a} hours, and pump B can fill the same tank in ${b} hours.`, 'pumps', 'fill the tank'] : [`Working alone, Maria can paint a fence in ${a} hours, and working alone, Theo can paint the same fence in ${b} hours.`, 'two of them', 'paint the fence'];
  return { stem: `<p>${C[0]} Working together at these rates, how many hours will it take the ${C[1]} to ${C[2]}?</p>`, answer: spr(t),
    explanation: `Together they complete ${m(`\\frac{1}{${a}} + \\frac{1}{${b}} = \\frac{${a + b}}{${a * b}}`)} of the job per hour, so the time is ${m(`\\frac{${a * b}}{${a + b}}${t.d !== a + b ? ' = ' + t.tex() : ''}`)} hours.`, verify: () => close(t.val() * (1 / a + 1 / b), 1) };
});
function terminatesOk(y) { try { spr(y); return true; } catch (e) { return false; } }

module.exports = out;
