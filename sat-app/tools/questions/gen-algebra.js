'use strict';
const L = require('./lib');
const { decStr, pn, cv, T, m, num, poly, lin, F, fr, need, assert, spr, numCh, eqHolds, texEval, close, money, table, ptable, plane, chart, valOf, texInt, commas } = L;

const SK = {
  l1: 'Linear equations in one variable',
  lf: 'Linear functions',
  l2: 'Linear equations in two variables',
  sys: 'Systems of two linear equations in two variables',
  ineq: 'Linear inequalities in one or two variables',
};
const out = [];
function def(tpl, diff, type, n, skill, gen) { out.push({ tpl: 'alg-' + tpl, domain: 'algebra', diff, type, n, skill, gen }); }
const moveC = (b) => (b > 0 ? `Subtract ${b} from` : `Add ${-b} to`);
const pt = (a, b) => m(`(${num(a)}, ${num(b)})`);
const isInt = (x) => Number.isInteger(x);
const fq = (n, d) => { const f = F(n, d); const raw = `\\frac{${n}}{${d}}`; return (f.d === d && f.n === n) ? raw : raw + ' = ' + f.tex(); };
const lc1 = (s) => s.charAt(0).toLowerCase() + s.slice(1);
const fails = (eq, x, ds) => ds.every((d) => !eqHolds(eq, { x: valOf(d) })) && eqHolds(eq, { x: valOf(x) });

/* ============================ EASY ============================ */
def('lin1-solve', 1, 'mcq', 4, SK.l1, (r, v) => {
  const f = v % 4; let eq, x, ds, ex;
  if (f === 0) {
    const a = r.int(2, 9), b = r.nz(-15, 15); x = r.nz(-8, 12); const c = a * x + b;
    eq = `${lin(a, b)} = ${c}`; ds = [F(c + b, a), F(c - b), F(c, a).sub(b)];
    ex = `${moveC(b)} each side of the equation to get ${m(`${a}x = ${c - b}`)}. Dividing each side by ${m(a)} gives ${m(`x = ${x}`)}.`;
  } else if (f === 1) {
    const a = r.int(2, 8), b = r.int(3, 30); x = r.nz(-7, 9); const c = b - a * x;
    eq = `${c} = ${poly([[b, ''], [-a, 'x']])}`; ds = [F(c - b, a), F(b + c, a), F(b - c)];
    ex = `Subtract ${b} from each side: ${m(`${c - b} = ${-a}x`)}. Dividing each side by ${m(-a)} gives ${m(`x = ${x}`)}.`;
  } else if (f === 2) {
    const a = r.int(2, 7), b = r.nz(-9, 9), t = r.nz(-6, 8); x = a * t; const c = t + b;
    eq = `\\frac{x}{${a}} ${b > 0 ? '+' : '-'} ${Math.abs(b)} = ${c}`; ds = [F(c - b, a), F(a * (c + b)), F(c * a - b)];
    ex = `${moveC(b)} each side to get ${m(`\\frac{x}{${a}} = ${t}`)}. Multiplying each side by ${m(a)} gives ${m(`x = ${x}`)}.`;
  } else {
    const c = r.int(2, 6), a = c + r.int(2, 5), b = r.nz(-12, 12); x = r.nz(-6, 9); const d = (a - c) * x + b;
    eq = `${lin(a, b)} = ${lin(c, d)}`; ds = [F(d - b, a + c), F(d + b, a - c), F(b - d, a - c)];
    ex = `Subtract ${m(`${c}x`)} from each side: ${m(`${lin(a - c, b)} = ${d}`)}. Then ${moveC(b).toLowerCase()} each side: ${m(`${a - c}x = ${d - b}`)}, so ${m(`x = ${x}`)}.`;
  }
  const vals = [F(x), ...ds];
  return { stem: `<p>${m(eq)}</p><p>What value of ${m('x')} is the solution to the given equation?</p>`, ...numCh(vals), explanation: ex, verify: () => fails(eq, F(x), ds) };
});

def('lin1-distrib', 1, 'spr', 3, SK.l1, (r, v) => {
  let stem, eq, x, ex;
  if (v % 3 === 0) {
    const a = r.int(2, 9), b = r.nz(-9, 9); x = r.nz(-8, 14); const c = a * (x - b);
    eq = `${a}${L.binom('x', -b)} = ${c}`;
    stem = `<p>${m(eq)}</p><p>What is the solution to the given equation?</p>`;
    ex = `Divide each side by ${m(a)}: ${m(`${lin(1, -b)} = ${c / a}`)}. So ${m(`x = ${x}`)}.`;
  } else if (v % 3 === 1) {
    const a = r.int(2, 6), b = r.nz(-7, 7), c = r.int(1, 5); x = r.nz(-6, 10); const d = a * (x + b) + c * x;
    eq = `${a}${L.binom('x', b)} + ${c === 1 ? '' : c}x = ${d}`;
    stem = `<p>${m(eq)}</p><p>What value of ${m('x')} satisfies the equation above?</p>`;
    ex = `Distribute: ${m(`${lin(a, a * b)} + ${c === 1 ? '' : c}x = ${d}`)}, so ${m(`${lin(a + c, a * b)} = ${d}`)}. Then ${m(`${a + c}x = ${d - a * b}`)} and ${m(`x = ${x}`)}.`;
  } else {
    const k = r.pick([3, 4, 5, 6]), b = r.int(2, 11); x = r.int(b + 1, b + 15); const c = k * (x - b);
    const words = { 3: 'Three', 4: 'Four', 5: 'Five', 6: 'Six' }[k];
    eq = `${k}(x - ${b}) = ${c}`;
    stem = `<p>${words} times the difference of a number ${m('x')} and ${b} is equal to ${c}. What is the value of ${m('x')}?</p>`;
    ex = `The statement is ${m(eq)}. Dividing by ${m(k)} gives ${m(`x - ${b} = ${c / k}`)}, so ${m(`x = ${x}`)}.`;
  }
  return { stem, answer: spr(x), explanation: ex, verify: () => eqHolds(eq, { x }) };
});

def('lin1-word-fee', 1, 'mcq', 4, SK.l1, (r, v) => {
  const R = r.pick([15, 20, 25, 30, 35, 40, 45, 60]), k = r.int(1, 3), h = r.int(3, 9), Fe = k * R, Tt = Fe + R * h;
  need(k !== h && 2 * k !== h && h + k !== k);
  const C = [
    [`A plumber charges a flat fee of ${money(Fe)} for each service call plus ${money(R)} per hour of work. A customer was charged ${money(Tt)} for one service call. For how many hours did the plumber work?`, 'hours'],
    [`A car rental company charges a one-time fee of ${money(Fe)} plus ${money(R)} per day to rent a car. Jamal paid a total of ${money(Tt)} to rent a car. For how many days did he rent the car?`, 'days'],
    [`A print shop charges a setup fee of ${money(Fe)} for an order of posters plus ${money(R)} for each poster printed. An order cost a total of ${money(Tt)}. How many posters were printed?`, 'posters'],
    [`A climbing gym charges a membership fee of ${money(Fe)} plus ${money(R)} per visit. Last year, Dana paid the gym a total of ${money(Tt)}. How many times did Dana visit the gym last year?`, 'visits'],
  ][v % 4];
  const eq = `${Fe} + ${R}x = ${Tt}`;
  return {
    stem: `<p>${C[0]}</p>`, ...numCh([h, h + k, h + 2 * k, k]),
    explanation: `If ${m('x')} is the number of ${C[1]}, then ${m(eq)}. Subtracting ${Fe} from each side gives ${m(`${R}x = ${Tt - Fe}`)}, so ${m(`x = ${h}`)}.`,
    verify: () => eqHolds(eq, { x: h }) && !eqHolds(eq, { x: h + k }),
  };
});

def('linfunc-eval', 1, 'mcq', 4, SK.lf, (r, v) => {
  const a = r.nz(-6, 7), b = r.nz(-12, 12);
  need(Math.abs(a) > 1);
  const ftex = lin(a, b);
  if (v % 3 === 1) {
    const x = r.nz(-6, 8), t = a * x + b;
    const vals = [F(x), F(a * t + b), F(t + b, a), F(t - b)];
    return { stem: `<p>${m(`f(x) = ${ftex}`)}</p><p>For the function ${m('f')} defined above, what is the value of ${m('x')} for which ${m(`f(x) = ${t}`)}?</p>`, ...numCh(vals),
      explanation: `Set ${m(`${ftex} = ${t}`)}. Then ${m(`${a}x = ${t - b}`)}, so ${m(`x = ${x}`)}.`, verify: () => close(texEval(ftex, { x }), t) };
  }
  const k = v % 3 === 0 ? r.int(-6, -1) : r.int(2, 9);
  const val = a * k + b;
  const vals = [F(val), F(-a * k + b), F(a * k - b), F(k - b, a)];
  return { stem: `<p>The function ${m('f')} is defined by ${m(`f(x) = ${ftex}`)}. What is the value of ${m(`f(${k})`)}?</p>`, ...numCh(vals),
    explanation: `Substitute ${m(k)} for ${m('x')}: ${m(`f(${k}) = ${a}(${k}) ${b > 0 ? '+' : '-'} ${Math.abs(b)} = ${val}`)}.`, verify: () => close(texEval(ftex, { x: k }), val) };
});

def('linfunc-table', 1, 'mcq', 4, SK.lf, (r, v) => {
  const mm = r.nz(-5, 6), b = r.nz(-9, 9);
  need(mm !== 1 && mm !== b && b !== 2 * mm && mm !== -1);
  const xs = [[0, 1, 2, 3], [1, 2, 3, 4], [-1, 0, 2, 5]][v % 3];
  const rows = xs.map((x) => [m(num(x)), m(num(mm * x + b))]);
  const c = [lin(mm, b), lin(b, mm), lin(mm, b + mm), lin(-mm, b)];
  need(L.distinct(c));
  return {
    stem: `<p>The table shows four values of ${m('x')} and their corresponding values of ${m('f(x)')}, where ${m('f')} is a linear function.</p>` + ptable([m('x'), m('f(x)')], rows) + `<p>Which equation defines ${m('f')}?</p>`,
    choices: c.map((s) => m(`f(x) = ${s}`)),
    explanation: `When ${m('x')} increases by 1, ${m('f(x)')} changes by ${m(mm)}, so the slope is ${m(mm)}. Since ${m(`f(${xs[1]}) = ${mm * xs[1] + b}`)}, the ${m('y')}-intercept is ${m(`${mm * xs[1] + b} - ${mm < 0 ? `(${mm})` : mm}(${xs[1]}) = ${b}`)}. So ${m(`f(x) = ${c[0]}`)}.`,
    verify: () => xs.every((x) => close(texEval(c[0], { x }), mm * x + b)) && c.slice(1).every((d) => xs.some((x) => !close(texEval(d, { x }), mm * x + b))),
  };
});

def('linfunc-interpret', 1, 'mcq', 4, SK.lf, (r, v) => {
  const askSlope = v % 2 === 0;
  const C = [
    () => { const a = r.pick([12, 14, 15, 18, 22]), b = r.pick([25, 30, 35, 40]); return { eq: `C = ${a}h + ${b}`, intro: `The equation ${m(`C = ${a}h + ${b}`)} gives the total cost ${m('C')}, in dollars, to rent a kayak for ${m('h')} hours.`, a, b,
      s: 'The cost, in dollars, per hour to rent the kayak', i: 'A fixed fee, in dollars, charged in addition to the hourly cost', w: ['The total cost, in dollars, to rent the kayak for 1 hour', 'The maximum number of hours the kayak can be rented'] }; },
    () => { const a = r.pick([0.6, 0.8, 1.2, 1.5]), b = r.pick([9, 12, 15, 20]); return { eq: '', intro: `A botanist models the height of a plant with ${m(`H = ${a}w + ${b}`)}, where ${m('H')} is the height of the plant, in centimeters, ${m('w')} weeks after the botanist began measuring it.`, a, b,
      s: 'The increase in the height of the plant, in centimeters, each week', i: 'The height of the plant, in centimeters, when the botanist began measuring it', w: [`The number of weeks it takes the plant to grow ${b} centimeters`, 'The height of the plant, in centimeters, after 1 week'] }; },
    () => { const a = r.pick([5, 6, 8, 9]), b = r.pick([88, 92, 95, 97]); return { eq: '', intro: `The equation ${m(`B = ${b} - ${a}t`)} estimates the percent of battery charge ${m('B')} remaining on a phone ${m('t')} hours after it was unplugged.`, a, b,
      s: 'The decrease in the percent of battery charge each hour', i: 'The percent of battery charge when the phone was unplugged', w: ['The number of hours until the battery is completely drained', `The percent of battery charge remaining after ${a} hours`] }; },
    () => { const a = r.pick([20, 25, 30, 40]), b = r.pick([150, 210, 310, 480]); return { eq: '', intro: `The equation ${m(`S = ${a}w + ${b}`)} gives the amount ${m('S')}, in dollars, in Leah's savings account ${m('w')} weeks after she began making equal weekly deposits.`, a, b,
      s: 'The amount, in dollars, Leah deposits each week', i: 'The amount, in dollars, in the account when Leah began making weekly deposits', w: ['The number of weeks Leah will make deposits', `The total amount, in dollars, Leah will have after ${a} weeks`] }; },
  ][v % 4]();
  const target = askSlope ? C.a : C.b;
  return {
    stem: `<p>${C.intro} What is the best interpretation of ${m(num(target))} in this context?</p>`,
    choices: askSlope ? [C.s, C.i, ...C.w] : [C.i, C.s, ...C.w],
    explanation: askSlope ? `In a linear model, the coefficient of the input variable is the rate of change: the amount the output changes for each increase of 1 in the input. Here that is ${m(num(C.a))}, so it represents ${lc1(C.s)}.`
      : `The constant term is the value of the output when the input variable is 0, that is, at the start. So ${m(num(C.b))} represents ${lc1(C.i)}.`,
  };
});

def('lin2-point', 1, 'mcq', 3, SK.l2, (r, v) => {
  if (v % 3 === 0) {
    const p = r.nz(-6, 6), q = r.nz(-5, 6), a = r.nz(-6, 8), k = r.nz(-9, 9); const rr = p * a + q * k;
    const eq = `${poly([[p, 'x'], [q, 'y']])} = ${rr}`;
    return { stem: `<p>The point ${m(`(${a}, k)`)} lies on the graph of the equation ${m(eq)} in the ${m('xy')}-plane. What is the value of ${m('k')}?</p>`, ...numCh([k, F(rr + p * a, q), F(-k), F(rr - p * a)]),
      explanation: `Substitute ${m(`x = ${a}`)}: ${m(`${p}(${a}) ${q > 0 ? '+' : '-'} ${Math.abs(q) === 1 ? '' : Math.abs(q)}k = ${rr}`)}, so ${m(`${q}k = ${rr - p * a}`)} and ${m(`k = ${k}`)}.`, verify: () => eqHolds(eq, { x: a, y: k }) };
  }
  if (v % 3 === 1) {
    const k = r.nz(-9, 12), p = r.nz(-7, 7), q = r.int(2, 9); const rr = p * k;
    const eq = `${poly([[p, 'x'], [-q, 'y']])} = ${rr}`;
    return { stem: `<p>The graph of ${m(eq)} in the ${m('xy')}-plane has an ${m('x')}-intercept at ${m('(k, 0)')}. What is the value of ${m('k')}?</p>`, ...numCh([k, F(rr, -q), F(-k), F(rr + p)]),
      explanation: `At the ${m('x')}-intercept, ${m('y = 0')}. So ${m(`${p === 1 ? '' : p === -1 ? '-' : p}k = ${rr}`)} and ${m(`k = ${k}`)}.`, verify: () => eqHolds(eq, { x: k, y: 0 }) };
  }
  const a = r.pick([3, 4, 5, 6]), b = r.pick([2, 3, 4, 5, 8]); need(a !== b);
  const x = r.int(2, 9), y = r.int(2, 9), Tt = a * x + b * y;
  const eq = `${a}x + ${b}y = ${Tt}`;
  return { stem: `<p>At a farmers market, apples cost ${money(a)} per pound and pears cost ${money(b)} per pound. The equation ${m(eq)} represents buying ${m('x')} pounds of apples and ${m('y')} pounds of pears for a total of ${money(Tt)}. If a customer buys ${x} pounds of apples, how many pounds of pears does the customer buy?</p>`, ...numCh([y, F(b * y), F(Tt - b * x, a), F(Tt, b)]),
    explanation: `Substitute ${m(`x = ${x}`)}: ${m(`${a * x} + ${b}y = ${Tt}`)}, so ${m(`${b}y = ${Tt - a * x}`)} and ${m(`y = ${y}`)}.`, verify: () => eqHolds(eq, { x, y }) };
});

def('lin2-slope', 1, 'spr', 3, SK.l2, (r, v) => {
  if (v % 3 === 2) {
    const a = r.nz(-7, 7), b = r.nz(-7, 7), c = r.nz(-20, 20); need(Math.abs(a) !== Math.abs(b) && Math.abs(b) > 1);
    const s = F(-a, b);
    return { stem: `<p>What is the slope of the graph of ${m(`${poly([[a, 'x'], [b, 'y']])} = ${c}`)} in the ${m('xy')}-plane?</p>`, answer: spr(s),
      explanation: `Solve for ${m('y')}: ${m(`y = ${poly([[s, 'x'], [F(c, b), '']])}`)}. The slope is the coefficient of ${m('x')}, which is ${m(s.tex())}.`,
      verify: () => { const y = (x) => (c - a * x) / b; return close(y(1) - y(0), s.val()); } };
  }
  const x1 = r.int(-6, 6), y1 = r.int(-8, 8), x2 = r.int(-6, 8), y2 = r.int(-8, 9); need(x1 !== x2 && y1 !== y2);
  const s = F(y2 - y1, x2 - x1); need(Math.abs(s.n) <= 9 && s.d <= 6);
  if (v % 3 === 0) {
    return { stem: `<p>A line in the ${m('xy')}-plane passes through the points ${pt(x1, y1)} and ${pt(x2, y2)}. What is the slope of the line?</p>`, answer: spr(s),
      explanation: `Slope ${m(`= \\frac{${y2} - ${y1 < 0 ? `(${y1})` : y1}}{${x2} - ${x1 < 0 ? `(${x1})` : x1}} = ${fq(y2 - y1, x2 - x1)}`)}.`, verify: () => close((y2 - y1) / (x2 - x1), s.val()) };
  }
  // from a graph
  need(Math.abs(x1) <= 5 && Math.abs(x2) <= 5 && Math.abs(y1) <= 5 && Math.abs(y2) <= 5 && Math.abs(x2 - x1) >= 2);
  const fn = (x) => y1 + s.val() * (x - x1);
  const svg = plane({ x: [-6, 6], y: [-6, 6], tick: 2, items: [{ fn }, { pts: [[x1, y1], [x2, y2]] }] });
  return { stem: `<p>The graph of the linear function ${m('f')} is shown, and the two marked points have integer coordinates. What is the slope of the graph of ${m('y = f(x)')}?</p>` + svg, answer: spr(s),
    explanation: `The marked points are ${pt(x1, y1)} and ${pt(x2, y2)}. The slope is ${m(fq(y2 - y1, x2 - x1))}.`, verify: () => close(fn(x2), y2) };
});

def('sys-subst', 1, 'mcq', 4, SK.sys, (r, v) => {
  if (v % 3 === 2) {
    const k = r.int(2, 5), t = r.int(8, 30), S = (k + 1) * t;
    const names = r.pick([['Ben', 'Tyler'], ['Ana', 'Rosa'], ['Kai', 'Omar']]);
    const thing = r.pick(['baseball cards', 'stamps', 'books', 'stickers']);
    return { stem: `<p>${names[0]} has ${k === 2 ? 'twice' : ['', '', '', 'three times', 'four times', 'five times'][k]} as many ${thing} as ${names[1]}. Together they have ${S} ${thing}. How many ${thing} does ${names[1]} have?</p>`,
      ...numCh([t, k * t, F(S, k), S - k]), explanation: `Let ${m('x')} be the number ${names[1]} has. Then ${m(`${k}x + x = ${S}`)}, so ${m(`${k + 1}x = ${S}`)} and ${m(`x = ${t}`)}.`, verify: () => (k + 1) * t === S };
  }
  if (v % 3 === 0) {
    const k = r.int(2, 6), x = r.nz(-8, 12), S = (k + 1) * x;
    return { stem: `<p>${m(`y = ${k}x`)}<br>${m(`x + y = ${S}`)}</p><p>The solution to the given system of equations is ${m('(x, y)')}. What is the value of ${m('x')}?</p>`,
      ...numCh([F(x), F(k * x), F(S, k), F(S - k)]), explanation: `Substitute ${m(`${k}x`)} for ${m('y')}: ${m(`x + ${k}x = ${S}`)}, so ${m(`${k + 1}x = ${S}`)} and ${m(`x = ${x}`)}.`, verify: () => eqHolds(`x + ${k}x = ${S}`, { x }) };
  }
  const d = r.nz(-6, 6), y = r.nz(-7, 9), S = 2 * (y + d) + y;
  const vals = [F(y), F(y + d), F(S - 2 * d, 2), F(S + 2 * d, 3)];
  return { stem: `<p>${m(`x = ${lin(1, d, 'y')}`)}<br>${m(`2x + y = ${S}`)}</p><p>If ${m('(x, y)')} is the solution to the system of equations above, what is the value of ${m('y')}?</p>`,
    ...numCh(vals), explanation: `Substitute: ${m(`2(${lin(1, d, 'y')}) + y = ${S}`)}, so ${m(`${lin(3, 2 * d, 'y')} = ${S}`)}, ${m(`3y = ${S - 2 * d}`)}, and ${m(`y = ${y}`)}.`, verify: () => 2 * (y + d) + y === S };
});

def('sys-elim', 1, 'mcq', 3, SK.sys, (r, v) => {
  if (v % 3 === 2) {
    const x = r.nz(-6, 9), y = r.nz(-9, 9), a = 2 * x + y, b = 3 * x - y;
    return { stem: `<p>${m(`2x + y = ${a}`)}<br>${m(`3x - y = ${b}`)}</p><p>If ${m('(x, y)')} is the solution to the system of equations, what is the value of ${m('x')}?</p>`, ...numCh([x, F(y), F(a - b, 5), F(a + b)]),
      explanation: `Adding the equations eliminates ${m('y')}: ${m(`5x = ${a + b}`)}, so ${m(`x = ${x}`)}.`, verify: () => eqHolds(`2x + y = ${a}`, { x, y }) && eqHolds(`3x - y = ${b}`, { x, y }) };
  }
  const x = r.int(-5, 20), y = r.int(-9, 15); need(x !== y && x + y !== 0 && x - y !== 0);
  const ask = v % 3 === 0 ? 'x' : 'y', ans = ask === 'x' ? x : y;
  return { stem: `<p>${m(`x + y = ${x + y}`)}<br>${m(`x - y = ${x - y}`)}</p><p>What is the value of ${m(ask)} in the solution to the system of equations above?</p>`, ...numCh([ans, F(ask === 'x' ? y : x), F(x + y), F(x - y)]),
    explanation: ask === 'x' ? `Adding the equations gives ${m(`2x = ${2 * x}`)}, so ${m(`x = ${x}`)}.` : `Subtracting the second equation from the first gives ${m(`2y = ${2 * y}`)}, so ${m(`y = ${y}`)}.`, verify: () => true };
});

def('ineq-solution', 2, 'mcq', 4, SK.ineq, (r, v) => {
  const a = r.int(2, 7), t = r.int(-4, 9), b = r.nz(-12, 12);
  if (v % 3 === 0) {
    const c = a * t + b; const corr = t + r.int(1, 4);
    const ineq = (x) => a * x + b > c;
    const vals = [corr, t, t - 2, t - 5]; assert(ineq(corr) && !ineq(t) && !ineq(t - 2) && !ineq(t - 5));
    return { stem: `<p>Which of the following values of ${m('x')} is a solution to the inequality ${m(`${lin(a, b)} > ${c}`)}?</p>`, ...numCh(vals),
      explanation: `${moveC(b)} each side: ${m(`${a}x > ${c - b}`)}, so ${m(`x > ${t}`)}. Of the choices, only ${m(corr)} is greater than ${m(t)}.`, verify: () => ineq(corr) };
  }
  if (v % 3 === 1) {
    const c = a * t + b; const ineq = (x) => a * x + b <= c;
    const vals = [t, t + 1, t + 3, t + 6]; assert(ineq(t) && !ineq(t + 1));
    return { stem: `<p>Which of the following values of ${m('x')} satisfies ${m(`${lin(a, b)} \\le ${c}`)}?</p>`, ...numCh(vals),
      explanation: `${moveC(b)} each side: ${m(`${a}x \\le ${c - b}`)}, so ${m(`x \\le ${t}`)}. The only choice less than or equal to ${m(t)} is ${m(t)}.`, verify: () => ineq(t) };
  }
  const c = -a * t + b; const ineq = (x) => -a * x + b < c; // x > t
  const vals = [t + 1, t, t - 1, t - 4]; assert(ineq(t + 1) && !ineq(t) && !ineq(t - 1));
  return { stem: `<p>Which of the following is a solution to ${m(`${lin(-a, b)} < ${c}`)}?</p>`, ...numCh(vals),
    explanation: `${moveC(b)} each side: ${m(`${-a}x < ${c - b}`)}. Dividing by ${m(-a)} reverses the inequality: ${m(`x > ${t}`)}. Only ${m(t + 1)} is greater than ${m(t)}.`, verify: () => ineq(t + 1) };
});

def('ineq-budget', 1, 'spr', 4, SK.ineq, (r, v) => {
  let stem, Bud, fixed, per, unit;
  if (v % 4 === 0) { Bud = r.pick([40, 50, 60, 75]); fixed = r.pick([8, 10, 12, 15]); per = r.pick([3, 4, 6, 7]); stem = `<p>Maya has ${money(Bud)} to spend at a county fair. Admission to the fair costs ${money(fixed)}, and each ride ticket costs ${money(per)}. What is the maximum number of ride tickets Maya can buy?</p>`; unit = 'ride tickets'; }
  else if (v % 4 === 1) { Bud = r.pick([1500, 2000, 2500]); fixed = r.int(160, 230); per = r.pick([45, 55, 60, 65, 70]); stem = `<p>An elevator has a maximum weight capacity of ${commas(Bud)} pounds. A worker who weighs ${fixed} pounds is using the elevator to move boxes that each weigh ${per} pounds. What is the maximum number of boxes the worker can take on one trip with him in the elevator?</p>`; unit = 'boxes'; }
  else if (v % 4 === 2) { Bud = r.pick([60, 70, 80]); fixed = r.pick([25, 30, 35]); per = r.pick([4, 6, 7, 8]); stem = `<p>A cell phone plan costs ${money(fixed)} per month plus ${money(per)} for each gigabyte of data used. Carla wants her monthly bill to be no more than ${money(Bud)}. What is the greatest number of whole gigabytes of data she can use in a month?</p>`; unit = 'gigabytes'; }
  else { Bud = r.pick([1200, 1500, 1800]); fixed = r.int(250, 420); per = r.pick([35, 40, 45, 55]); stem = `<p>A delivery van can carry at most ${commas(Bud)} pounds of cargo. The van is already carrying ${fixed} pounds of equipment. If each box of floor tiles weighs ${per} pounds, what is the greatest number of boxes of floor tiles the van can carry in addition to the equipment?</p>`; unit = 'boxes'; }
  need((Bud - fixed) % per !== 0);
  const n = Math.floor((Bud - fixed) / per);
  return { stem, answer: spr(n), explanation: `If ${m('n')} is the number of ${unit}, then ${m(`${fixed} + ${per}n \\le ${commas(Bud).replace(/,/g, '{,}')}`)}, so ${m(`${per}n \\le ${Bud - fixed}`)} and ${m(`n \\le ${(Bud - fixed) / per % 1 === 0 ? (Bud - fixed) / per : ((Bud - fixed) / per).toFixed(2) + '\\ldots'}`)}. The greatest whole number satisfying this is ${m(n)}.`,
    verify: () => fixed + per * n <= Bud && fixed + per * (n + 1) > Bud };
});

def('linfunc-graph', 1, 'mcq', 4, SK.lf, (r, v) => {
  const mm = r.pick([-3, -2, 2, 3, F(1, 2), F(-1, 2)]); const M0 = fr(mm);
  const x0 = r.nz(-4, 4); const b = M0.mul(-x0); need(b.isInt() && Math.abs(b.n) <= 5 && b.n !== 0 && Math.abs(b.n) !== Math.abs(x0));
  const fn = (x) => M0.val() * x + b.val();
  const svg = plane({ x: [-6, 6], y: [-6, 6], tick: 1, items: [{ fn }] });
  if (v % 3 === 0) {
    return { stem: `<p>The graph of the linear function ${m('f')} is shown in the ${m('xy')}-plane. What is the ${m('y')}-intercept of the graph of ${m('y = f(x)')}?</p>` + svg,
      choices: [pt(0, b.n), pt(b.n, 0), pt(x0, 0), pt(0, -b.n)], explanation: `The graph crosses the ${m('y')}-axis at ${pt(0, b.n)}, so that is the ${m('y')}-intercept. (The graph crosses the ${m('x')}-axis at ${pt(x0, 0)}.)`, verify: () => close(fn(0), b.n) };
  }
  if (v % 3 === 1) {
    need(!(M0.abs().eq(1)));
    const vals = [M0, M0.neg(), F(1).div(M0), F(-1).div(M0)];
    return { stem: `<p>The graph of the linear function ${m('f')} is shown. What is the slope of the graph?</p>` + svg, ...numCh(vals),
      explanation: `The line passes through ${pt(0, b.n)} and ${pt(x0, 0)}. Its slope is ${m(`\\frac{0 - ${b.n < 0 ? `(${b.n})` : b.n}}{${x0} - 0} = ${M0.tex()}`)}.`, verify: () => close((fn(3) - fn(1)) / 2, M0.val()) };
  }
  const c = [poly([[M0, 'x'], [b, '']]), poly([[b, 'x'], [M0, '']]), poly([[M0.neg(), 'x'], [b, '']]), poly([[M0, 'x'], [b.neg(), '']])];
  need(L.distinct(c));
  return { stem: `<p>The graph of ${m('y = f(x)')} is shown. Which equation defines ${m('f')}?</p>` + svg, choices: c.map((s) => m(`f(x) = ${s}`)),
    explanation: `The ${m('y')}-intercept is ${pt(0, b.n)} and the line also passes through ${pt(x0, 0)}, so its slope is ${m(M0.tex())}. Therefore ${m(`f(x) = ${c[0]}`)}.`, verify: () => close(texEval(c[0], { x: 2 }), fn(2)) };
});

def('lin1-expr', 1, 'mcq', 4, SK.l1, (r, v) => {
  if (v % 3 === 0) {
    const a = r.int(2, 5), b = r.nz(-9, 9), x = r.int(1, 8), c = a * x + b, k = r.int(2, 4);
    return { stem: `<p>If ${m(`${lin(a, b)} = ${c}`)}, what is the value of ${m(lin(k * a, k * b))}?</p>`, ...numCh([k * c, x, c, k * x]),
      explanation: `${m(lin(k * a, k * b))} is ${m(k)} times ${m(lin(a, b))}. So its value is ${m(`${k}(${c}) = ${k * c}`)}.`, verify: () => close(texEval(lin(k * a, k * b), { x }), k * c) };
  }
  if (v % 3 === 1) {
    const a = r.int(2, 6), b = r.int(2, 9), t = r.nz(-5, 8), c = a * (t + 0), s = r.int(2, 9); need(t !== b);
    // a(x + b) = c  ->  x + b = t ; ask 2(x + b) + s ... keep simple: ask x + b
    return { stem: `<p>If ${m(`${a}x + ${a * b} = ${a * t}`)}, what is the value of ${m(`x + ${b}`)}?</p>`, ...numCh([t, t - b, a * t, t + b]),
      explanation: `Factor the left side: ${m(`${a}(x + ${b}) = ${a * t}`)}. Dividing by ${m(a)} gives ${m(`x + ${b} = ${t}`)}.`, verify: () => close(texEval(`x + ${b}`, { x: t - b }), t) && c === a * t && s > 0 };
  }
  const w = r.int(3, 12), d = r.int(2, 9);
  return { stem: `<p>If ${m(`\\frac{n}{${d}} = ${w}`)}, what is the value of ${m(`\\frac{n}{${d}} + ${2 * d}`)}?</p>`, ...numCh([w + 2 * d, w * d + 2 * d, w * d, w + d]),
    explanation: `Since ${m(`\\frac{n}{${d}} = ${w}`)}, the expression equals ${m(`${w} + ${2 * d} = ${w + 2 * d}`)}.`, verify: () => close(texEval(`\\frac{n}{${d}} + ${2 * d}`, { n: w * d }), w + 2 * d) };
});

def('lin2-model', 1, 'mcq', 4, SK.l2, (r, v) => {
  let stem, a, b, Tt, vx, vy;
  if (v % 3 === 0) { a = r.pick([12, 14, 15, 18]); b = r.pick([6, 7, 8, 9]); Tt = r.int(80, 160) * 10; vx = 'adult tickets'; vy = 'student tickets';
    stem = `A school play charges ${money(a)} for each adult ticket and ${money(b)} for each student ticket. On opening night, ticket sales totaled ${money(Tt)}.`; }
  else if (v % 3 === 1) { a = 4; b = 2; Tt = r.int(40, 90) * 2; vx = 'cows'; vy = 'chickens';
    stem = `A farm has only cows and chickens. Each cow has 4 legs and each chicken has 2 legs. The animals on the farm have a total of ${Tt} legs.`; }
  else { a = r.pick([12, 15]); b = r.pick([4, 5]); Tt = r.int(9, 20) * 12; vx = 'vans'; vy = 'cars';
    stem = `A total of ${Tt} people will travel to a conference in vans that each carry ${a} people and cars that each carry ${b} people. Every vehicle will be full.`; }
  const c = [`${a}x + ${b}y = ${Tt}`, `${b}x + ${a}y = ${Tt}`, `x + y = ${Tt}`, `${a + b}(x + y) = ${Tt}`];
  return { stem: `<p>${stem} Which equation represents this situation, where ${m('x')} is the number of ${vx} and ${m('y')} is the number of ${vy}?</p>`, choices: c.map((s) => m(s.replace(/(\d)(\d{3})\b/g, '$1{,}$2'))),
    explanation: `Each of the ${m('x')} ${vx} contributes ${a}, for a total of ${m(`${a}x`)}, and each of the ${m('y')} ${vy} contributes ${b}, for ${m(`${b}y`)}. Their sum is ${commas(Tt)}, so ${m(c[0].replace(/(\d)(\d{3})\b/g, '$1{,}$2'))}.` };
});

/* ============================ MEDIUM ============================ */
def('lin1-fractions', 2, 'spr', 3, SK.l1, (r, v) => {
  let eq, x, ex;
  if (v % 3 === 0) {
    const p = r.int(2, 6), q = r.int(2, 6), a = r.int(1, 5), c = r.int(1, 5), b = r.nz(-9, 9), d = r.nz(-9, 9);
    need(p !== q && q * a - p * c !== 0);
    x = F(p * d - q * b, q * a - p * c); need(x.d <= 9 && Math.abs(x.n) < 100);
    eq = `\\frac{${lin(a, b)}}{${p}} = \\frac{${lin(c, d)}}{${q}}`;
    ex = `Multiply both sides by ${m(p * q)}: ${m(`${q}(${lin(a, b)}) = ${p}(${lin(c, d)})`)}, so ${m(`${lin(q * a, q * b)} = ${lin(p * c, p * d)}`)}. Then ${m(`${q * a - p * c}x = ${p * d - q * b}`)}, so ${m(`x = ${x.tex()}`)}.`;
  } else if (v % 3 === 1) {
    const p = r.int(2, 5), q = p + r.int(1, 4), k = r.nz(-6, 8);
    x = F(k * p * q, q - p);
    eq = `\\frac{x}{${p}} - \\frac{x}{${q}} = ${k}`;
    ex = `Multiply both sides by ${m(p * q)}: ${m(`${q}x - ${p}x = ${k * p * q}`)}, so ${m(`${q - p}x = ${k * p * q}`)} and ${m(`x = ${x.tex()}`)}.`;
  } else {
    const a = r.pick([0.2, 0.4, 0.5, 0.6, 0.8]), c = r.pick([0.25, 0.3, 0.75, 0.15]), xs = r.int(2, 30), b = r.int(1, 9);
    need(a !== c);
    const d = +(a * (xs + b) - c * xs).toFixed(4); need(d > 0 && Math.abs(d * 100 - Math.round(d * 100)) < 1e-9);
    x = F(xs);
    eq = `${a}(x + ${b}) = ${c}x + ${d}`;
    ex = `Distribute: ${m(`${a}x + ${+(a * b).toFixed(4)} = ${c}x + ${d}`)}. Then ${m(`${+(a - c).toFixed(4)}x = ${+(d - a * b).toFixed(4)}`)}, so ${m(`x = ${xs}`)}.`;
  }
  return { stem: `<p>${m(eq)}</p><p>What value of ${m('x')} is the solution to the given equation?</p>`, answer: spr(x), explanation: ex, verify: () => eqHolds(eq, { x: x.val() }) };
});

def('lin1-bothsides', 2, 'mcq', 4, SK.l1, (r, v) => {
  const a = r.int(2, 7), b = r.nz(-6, 6), c = r.int(1, 9), d = r.int(2, 7), e = r.nz(-6, 6), f0 = r.nz(-9, 9);
  need(a !== d);
  // a(x + b) - c = d(x - e) + f0
  const eq = `${a}${L.binom('x', b)} - ${c} = ${d}${L.binom('x', -e)} ${f0 > 0 ? '+' : '-'} ${Math.abs(f0)}`;
  const x = F(-d * e + f0 - a * b + c, a - d);
  need(x.d <= 4 && Math.abs(x.n) <= 40);
  const d1 = F(-e + f0 - b + c, a - d); // didn't distribute
  const d2 = F(d * e + f0 - a * b + c, a - d); // sign error on -d*e
  const d3 = x.neg();
  const vals = [x, d1, d2, d3];
  const q = v % 3 === 2 ? 'What is the solution to the given equation?' : `What value of ${m('x')} satisfies the equation above?`;
  return { stem: `<p>${m(eq)}</p><p>${q}</p>`, ...numCh(vals),
    explanation: `Distribute on both sides: ${m(`${lin(a, a * b - c)} = ${lin(d, -d * e + f0)}`)}. Collecting the ${m('x')}-terms on the left and the constants on the right gives ${m(`${poly([[a - d, 'x']])} = ${-d * e + f0 - a * b + c}`)}, so ${m(`x = ${x.tex()}`)}.`,
    verify: () => eqHolds(eq, { x: x.val() }) && [d1, d2, d3].every((z) => !eqHolds(eq, { x: z.val() })) };
});

def('linfunc-2pts-context', 2, 'mcq', 4, SK.lf, (r, v) => {
  const C = v % 4; let x1, x2, y1, y2, mm, stem, unit, unit2;
  const mk = (rate, inc) => { x1 = r.int(2, 4); x2 = x1 + r.int(2, 5); mm = inc ? rate : -rate; return mm; };
  if (C === 0) { mk(r.pick([15, 20, 25, 30, 35]), false); const b = r.int(10, 25) * 20; y1 = b + mm * x1; y2 = b + mm * x2;
    unit2 = 'minute'; stem = `Water is drained from a tank at a constant rate. Exactly ${x1} minutes after draining began, the tank contained ${y1} gallons of water. Exactly ${x2} minutes after draining began, it contained ${y2} gallons. How many gallons of water were in the tank when draining began?`; unit = 'gallons'; }
  else if (C === 1) { mk(r.pick([2, 3, 4]), false); const b = r.int(30, 45); y1 = b + mm * x1; y2 = b + mm * x2; need(y2 > 0);
    unit2 = 'hour'; stem = `A candle burns at a constant rate. Its height was ${y1} centimeters ${x1} hours after it was lit and ${y2} centimeters ${x2} hours after it was lit. What was the height, in centimeters, of the candle when it was lit?`; unit = 'centimeters'; }
  else if (C === 2) { mk(r.pick([40, 50, 60, 75]), true); const b = r.int(5, 30) * 10; y1 = b + mm * x1; y2 = b + mm * x2;
    unit2 = 'month'; stem = `Paolo deposits the same amount into a savings account at the end of each month and makes no withdrawals. After ${x1} months, the account contained ${money(y1)}. After ${x2} months, it contained ${money(y2)}. How much money, in dollars, was in the account before Paolo made his first deposit?`; unit = 'dollars'; }
  else { mk(r.pick([60, 80, 90, 120]), false); const b = r.int(15, 30) * 100; y1 = b + mm * x1; y2 = b + mm * x2;
    unit2 = 'minute'; stem = `A hot-air balloon descends at a constant rate. Its altitude was ${commas(y1)} feet ${x1} minutes after it began descending and ${commas(y2)} feet ${x2} minutes after it began descending. What was the balloon's altitude, in feet, when it began descending?`; unit = 'feet'; }
  const b = y1 - mm * x1;
  const vals = [b, y1 + mm * x1, Math.abs(mm), y1 - mm * (x2 - x1)];
  return { stem: `<p>${stem}</p>`, ...numCh(vals, (z) => m(texInt(z))),
    explanation: `The rate of change is ${m(`\\frac{${y2} - ${y1}}{${x2} - ${x1}} = ${mm}`)} ${unit} per ${unit2}. The value at time 0 is ${x1} ${unit2}s before the first measurement: ${m(`${y1} - (${mm})(${x1}) = ${b}`)}.`,
    verify: () => b + mm * x2 === y2 };
});

def('linfunc-solve-ab', 2, 'spr', 3, SK.lf, (r, v) => {
  const a = r.nz(-6, 6), b = r.nz(-15, 15), p = r.int(-4, 3), q = p + r.int(1, 5);
  const f = (x) => a * x + b;
  const fp = f(p), fq = f(q);
  if (v % 3 === 0) { const k = r.int(5, 10);
    return { stem: `<p>For the linear function ${m('f')}, ${m(`f(${p}) = ${fp}`)} and ${m(`f(${q}) = ${fq}`)}. What is the value of ${m(`f(${k})`)}?</p>`, answer: spr(f(k)),
      explanation: `The slope is ${m(`\\frac{${fq} - ${fp < 0 ? `(${fp})` : fp}}{${q} - ${p < 0 ? `(${p})` : p}} = ${a}`)}, and ${m(`f(x) = ${lin(a, b)}`)}. So ${m(`f(${k}) = ${a}(${k}) ${b < 0 ? '-' : '+'} ${Math.abs(b)} = ${f(k)}`)}.`, verify: () => f(p) === fp };
  }
  if (v % 3 === 1) {
    return { stem: `<p>The function ${m('f')} is defined by ${m('f(x) = ax + b')}, where ${m('a')} and ${m('b')} are constants. If ${m(`f(${p}) = ${fp}`)} and ${m(`f(${q}) = ${fq}`)}, what is the value of ${m('a + b')}?</p>`, answer: spr(a + b),
      explanation: `${m(`a = \\frac{${fq - fp}}{${q - p}} = ${a}`)}. Then ${m(`b = ${fp} - ${a}(${p}) = ${b}`)}, so ${m(`a + b = ${a + b}`)}. (Equivalently, ${m(`a + b = f(1)`)}.)`, verify: () => f(1) === a + b };
  }
  const t = r.nz(-6, 9), y = f(t);
  return { stem: `<p>For the linear function ${m('g')}, ${m(`g(${p}) = ${fp}`)} and ${m(`g(${q}) = ${fq}`)}. For what value of ${m('x')} does ${m(`g(x) = ${y}`)}?</p>`, answer: spr(t),
    explanation: `The slope is ${m(a)}, so ${m(`g(x) = ${lin(a, b)}`)}. Solving ${m(`${lin(a, b)} = ${y}`)} gives ${m(`x = ${t}`)}.`, verify: () => f(t) === y };
});

def('lin2-perp', 2, 'mcq', 4, SK.l2, (r, v) => {
  if (v % 3 === 0) {
    const a = r.nz(-8, 8), b = r.nz(-8, 8), c = r.nz(-20, 20); need(Math.abs(a) !== Math.abs(b) && Math.abs(a) > 1);
    const s = F(b, a);
    return { stem: `<p>Line ${m('\\ell')} is perpendicular to the graph of ${m(`${poly([[a, 'x'], [b, 'y']])} = ${c}`)} in the ${m('xy')}-plane. What is the slope of line ${m('\\ell')}?</p>`, ...numCh([s, F(-a, b), F(a, b), F(-b, a)]),
      explanation: `The given line has slope ${m(F(-a, b).tex())}. A perpendicular line has slope equal to the negative reciprocal, ${m(s.tex())}.`, verify: () => close(s.val() * (-a / b), -1) };
  }
  if (v % 3 === 1) {
    const x1 = r.int(-6, 3), x2 = x1 + r.int(1, 6), y1 = r.int(-6, 6), y2 = r.nz(-8, 8); need(y2 !== y1);
    const s0 = F(y2 - y1, x2 - x1), s = F(-1).div(s0); need(s.d <= 9 && Math.abs(s.n) <= 9);
    return { stem: `<p>Line ${m('k')} passes through the points ${pt(x1, y1)} and ${pt(x2, y2)}. Line ${m('j')} is perpendicular to line ${m('k')}. What is the slope of line ${m('j')}?</p>`, ...numCh([s, s0, s0.neg(), s.neg()]),
      explanation: `The slope of line ${m('k')} is ${m(fq(y2 - y1, x2 - x1))}. Perpendicular slopes multiply to ${m('-1')}, so the slope of ${m('j')} is ${m(s.tex())}.`, verify: () => close(s.val() * s0.val(), -1) };
  }
  const a = r.nz(-9, 9), b = r.nz(-9, 9), c = r.nz(-15, 15); need(Math.abs(b) > 1 && Math.abs(a) !== Math.abs(b));
  const s = F(-a, b);
  return { stem: `<p>In the ${m('xy')}-plane, line ${m('p')} is parallel to the graph of ${m(`${poly([[a, 'x'], [b, 'y']])} = ${c}`)}. What is the slope of line ${m('p')}?</p>`, ...numCh([s, F(b, a), F(a, b), F(-b, a)]),
    explanation: `Solving for ${m('y')} gives ${m(`y = ${poly([[s, 'x'], [F(c, b), '']])}`)}. Parallel lines have equal slopes, so the slope is ${m(s.tex())}.`, verify: () => close((c - a) / b - c / b, s.val()) };
});

def('lin2-parallel-int', 2, 'mcq', 3, SK.l2, (r, v) => {
  const p = r.nz(-6, 6), q = r.nz(-9, 9);
  if (v % 3 === 0) { const mm = r.pick([F(2, 3), F(-3, 2), F(3), F(-2), F(1, 4), F(-5, 2)]), b = r.nz(-9, 9); const k = F(q).sub(mm.mul(p)); need(k.d <= 4 && L.sprFits(k.str()));
    return { stem: `<p>In the ${m('xy')}-plane, line ${m('k')} is parallel to the line with equation ${m(`y = ${poly([[mm, 'x'], [b, '']])}`)} and passes through the point ${pt(p, q)}. If line ${m('k')} has ${m('y')}-intercept ${m('(0, b)')}, what is the value of ${m('b')}?</p>`, ...numCh([k, F(q).add(mm.mul(p)), F(b), mm.mul(p).sub(F(q))]),
      explanation: `Line ${m('k')} has slope ${m(mm.tex())}, so ${m(`${q} = ${mm.tex()}(${p}) + b`)}. Therefore ${m(`b = ${k.tex()}`)}.`, verify: () => close(mm.val() * p + k.val(), q) }; }
  if (v % 3 === 1) { const a = r.nz(-6, 6), b = r.nz(-6, 6), c = r.nz(-12, 12); need(Math.abs(b) > 1); const s = F(-a, b); const k = F(q).sub(s.mul(p)); need(L.sprFits(k.str()) && k.d <= 6);
    return { stem: `<p>Line ${m('\\ell')} is parallel to the graph of ${m(`${poly([[a, 'x'], [b, 'y']])} = ${c}`)} and passes through ${pt(p, q)}. What is the ${m('y')}-coordinate of the ${m('y')}-intercept of line ${m('\\ell')}?</p>`, ...numCh([k, F(q).add(s.mul(p)), F(c, b), k.neg()]),
      explanation: `The given line has slope ${m(s.tex())}. A line with this slope through ${pt(p, q)} is ${m(`y - ${q < 0 ? `(${q})` : q} = ${s.tex()}(x - ${p < 0 ? `(${p})` : p})`)}. Setting ${m('x = 0')} gives ${m(`y = ${k.tex()}`)}.`, verify: () => close(s.val() * (0 - p) + q, k.val()) }; }
  const mm = r.pick([2, 3, -2, -4, F(1, 2), F(-1, 3)]); const M0 = fr(mm); const s = F(-1).div(M0); const k = F(q).sub(s.mul(p)); need(L.sprFits(k.str()) && k.d <= 4);
  return { stem: `<p>A line in the ${m('xy')}-plane is perpendicular to the graph of ${m(`y = ${poly([[M0, 'x'], [r.nz(-5, 5), '']])}`)} and passes through the point ${pt(p, q)}. What is the ${m('y')}-coordinate of the point where this line crosses the ${m('y')}-axis?</p>`, ...numCh([k, F(q).sub(M0.mul(p)), F(q).add(s.mul(p)), k.neg()]),
    explanation: `The perpendicular slope is ${m(s.tex())}. Then ${m(`${q} = ${s.tex()}(${p}) + b`)} gives ${m(`b = ${k.tex()}`)}.`, verify: () => close(s.val() * p + k.val(), q) };
});

def('sys-word-tickets', 2, 'mcq', 4, SK.sys, (r, v) => {
  let a, b, A, B, stem, ask;
  const C = v % 4;
  if (C === 0) { a = r.pick([12, 14, 15]); b = r.pick([6, 7, 8]); A = r.int(60, 150); B = r.int(40, 120);
    stem = `A theater sold ${A + B} tickets for a play. Adult tickets cost ${money(a)} each and student tickets cost ${money(b)} each. The total revenue from ticket sales was ${money(a * A + b * B)}. How many adult tickets were sold?`; ask = 'adult tickets'; }
  else if (C === 1) { a = 4; b = 2; A = r.int(8, 30); B = r.int(10, 40);
    stem = `A farm has only goats and chickens. The animals have a total of ${A + B} heads and ${4 * A + 2 * B} legs. Each goat has 4 legs and each chicken has 2 legs. How many goats are on the farm?`; ask = 'goats'; }
  else if (C === 2) { a = 5; b = 2; A = r.int(5, 14); B = r.int(10, 25);
    stem = `A test has ${A + B} questions. Each question is worth either 2 points or 5 points, and the test is worth a total of ${5 * A + 2 * B} points. How many 5-point questions are on the test?`; ask = '5-point questions'; }
  else { a = r.pick([3, 4]); b = r.pick([1, 2]); A = r.int(20, 60); B = r.int(30, 80); need(a !== b);
    stem = `A bakery sold ${A + B} items consisting of muffins, which cost ${money(a)} each, and bagels, which cost ${money(b)} each. The bakery made ${money(a * A + b * B)} from these sales. How many muffins did the bakery sell?`; ask = 'muffins'; }
  const N = A + B, V = a * A + b * B;
  const d2 = (V - b * N) / a; need(isInt(d2));
  const vals = [A, B, d2, Math.abs(A - B)];
  return { stem: `<p>${stem}</p>`, ...numCh(vals),
    explanation: `Let ${m('x')} be the number of ${ask} and ${m('y')} the number of the other kind. Then ${m(`x + y = ${N}`)} and ${m(`${a}x + ${b === 1 ? '' : b}y = ${V}`)}. Substituting ${m(`y = ${N} - x`)}: ${m(`${a}x + ${b}(${N} - x) = ${V}`)}, so ${m(`${a - b}x = ${V - b * N}`)} and ${m(`x = ${A}`)}.`,
    verify: () => a * A + b * (N - A) === V && (V - b * N) / (a - b) === A };
});

def('sys-value', 2, 'spr', 3, SK.sys, (r, v) => {
  const x = r.nz(-7, 9), y = r.nz(-7, 9);
  const a = r.nz(-6, 7), b = r.nz(-6, 7), d = r.nz(-6, 7), e = r.nz(-6, 7); need(a * e - b * d !== 0 && Math.abs(a * e - b * d) > 1);
  const c = a * x + b * y, f = d * x + e * y;
  const e1 = `${poly([[a, 'x'], [b, 'y']])} = ${c}`, e2 = `${poly([[d, 'x'], [e, 'y']])} = ${f}`;
  const ask = ['x + y', 'y', 'x - y'][v % 3]; const ans = [x + y, y, x - y][v % 3];
  // independent check by brute force over a grid
  return { stem: `<p>${m(e1)}<br>${m(e2)}</p><p>The solution to the given system of equations is ${m('(x, y)')}. What is the value of ${m(ask)}?</p>`, answer: spr(ans),
    explanation: `Solving the system (for example, by elimination) gives ${m(`x = ${x}`)} and ${m(`y = ${y}`)}. Therefore ${m(`${ask} = ${ans}`)}.`,
    verify: () => { let hits = 0; for (let X = -20; X <= 20; X++) for (let Y = -20; Y <= 20; Y++) if (eqHolds(e1, { x: X, y: Y }) && eqHolds(e2, { x: X, y: Y })) { hits++; if (X !== x || Y !== y) return false; } return hits === 1; } };
});

def('sys-graph', 2, 'mcq', 4, SK.sys, (r, v) => {
  const p = r.nz(-4, 4), q = r.nz(-4, 4); need(Math.abs(p) !== Math.abs(q));
  const m1 = r.pick([1, 2, -1, F(1, 2), -2, F(-1, 2), 3]), m2 = r.pick([1, -1, 2, -2, F(1, 3), F(-2, 3), -3]);
  const M1 = fr(m1), M2 = fr(m2); need(!M1.eq(M2));
  const b1 = F(q).sub(M1.mul(p)), b2 = F(q).sub(M2.mul(p)); need(b1.isInt() && b2.isInt() && Math.abs(b1.n) <= 6 && Math.abs(b2.n) <= 6 && b1.n !== q && b1.n !== -q);
  const f1 = (x) => M1.val() * x + b1.val(), f2 = (x) => M2.val() * x + b2.val();
  const svg = plane({ x: [-7, 7], y: [-7, 7], tick: 1, items: [{ fn: f1 }, { fn: f2 }] });
  const e1 = `y = ${poly([[M1, 'x'], [b1, '']])}`, e2 = `y = ${poly([[M2, 'x'], [b2, '']])}`;
  if (v % 3 === 2) {
    const vals = [p + q, p - q, q - p, p * q]; need(new Set(vals).size === 4);
    return { stem: `<p>${m(e1)}<br>${m(e2)}</p><p>The graphs of the equations in the given system are shown. If ${m('(x, y)')} is the solution to the system, what is the value of ${m('x + y')}?</p>` + svg, ...numCh(vals),
      explanation: `The lines intersect at ${pt(p, q)}, so ${m(`x + y = ${p} + ${q < 0 ? `(${q})` : q} = ${p + q}`)}.`, verify: () => close(f1(p), f2(p)) };
  }
  return { stem: `<p>The graphs of the two linear equations in a system are shown in the ${m('xy')}-plane. What is the solution ${m('(x, y)')} to the system?</p>` + svg,
    choices: [pt(p, q), pt(q, p), pt(-p, q), pt(0, b1.n)], explanation: `The solution to a system of two linear equations is the point where their graphs intersect. The lines intersect at ${pt(p, q)}.`, verify: () => close(f1(p), q) && close(f2(p), q) };
});

def('ineq-system-point', 2, 'mcq', 4, SK.ineq, (r, v) => {
  let tests, texs;
  if (v % 3 === 0) { const m1 = r.nz(-3, 3), b1 = r.nz(-5, 5), m2 = r.nz(-3, 3), b2 = r.nz(-4, 8); need(m1 !== m2);
    texs = [`y > ${lin(m1, b1)}`, `y \\le ${lin(m2, b2)}`]; tests = [(x, y) => y > m1 * x + b1, (x, y) => y <= m2 * x + b2]; }
  else if (v % 3 === 1) { const s = r.int(5, 14), a = r.int(2, 4), t = r.nz(-6, 6);
    texs = [`x + y \\le ${s}`, `${a}x - y > ${t}`]; tests = [(x, y) => x + y <= s, (x, y) => a * x - y > t]; }
  else { const m1 = r.nz(-3, 3), b1 = r.nz(-6, 8), k = r.int(-3, 4);
    texs = [`y < ${lin(m1, b1)}`, `x \\ge ${k}`]; tests = [(x, y) => y < m1 * x + b1, (x, y) => x >= k]; }
  const ok = (P) => tests.every((t) => t(P[0], P[1]));
  let good = null; const bad = [];
  for (let k = 0; k < 400 && (!good || bad.length < 3); k++) {
    const P = [r.int(-6, 8), r.int(-8, 10)];
    if (ok(P)) { if (!good) good = P; } else if (bad.length < 3 && !bad.some((B) => B[0] === P[0] && B[1] === P[1])) {
      const failsFirst = !tests[0](P[0], P[1]);
      if (bad.length === 0 && !failsFirst) continue; if (bad.length === 1 && failsFirst) continue;
      bad.push(P);
    }
  }
  need(good && bad.length === 3);
  return { stem: `<p>${m(texs[0])}<br>${m(texs[1])}</p><p>Which point ${m('(x, y)')} is a solution to the given system of inequalities in the ${m('xy')}-plane?</p>`,
    choices: [good, ...bad].map((P) => pt(P[0], P[1])),
    explanation: `Substitute each point into both inequalities. ${pt(good[0], good[1])} makes both true. Each other point makes at least one inequality false; for example, ${pt(bad[0][0], bad[0][1])} fails ${m(texs[0])}.`,
    verify: () => ok(good) && bad.every((B) => !ok(B)) };
});

def('ineq-model', 2, 'mcq', 4, SK.ineq, (r, v) => {
  let stem, c, ex;
  if (v % 4 === 0) { const p = r.pick([12, 15, 18]), q = r.pick([6, 8, 9]), G = r.int(20, 60) * 50;
    stem = `A school club is selling T-shirts for ${money(p)} each and hats for ${money(q)} each. The club wants to raise at least ${money(G)}. Which inequality represents this situation, where ${m('t')} is the number of T-shirts sold and ${m('h')} is the number of hats sold?`;
    c = [`${p}t + ${q}h \\ge ${texInt(G)}`, `${p}t + ${q}h \\le ${texInt(G)}`, `${q}t + ${p}h \\ge ${texInt(G)}`, `t + h \\ge ${texInt(G)}`]; ex = `Revenue is ${m(`${p}t + ${q}h`)} dollars, and "at least" means ${m('\\ge')}.`; }
  else if (v % 4 === 1) { const p = r.pick([35, 40, 45]), q = r.pick([60, 70, 75]), G = r.pick([2000, 2500, 3000]);
    stem = `A freight elevator can carry at most ${commas(G)} pounds. A worker is loading it with small crates that weigh ${p} pounds each and large crates that weigh ${q} pounds each. Which inequality represents the possible numbers of small crates, ${m('s')}, and large crates, ${m('c')}, the elevator can carry?`;
    c = [`${p}s + ${q}c \\le ${texInt(G)}`, `${p}s + ${q}c \\ge ${texInt(G)}`, `${q}s + ${p}c \\le ${texInt(G)}`, `${p + q}(s + c) \\le ${texInt(G)}`]; ex = `The total weight is ${m(`${p}s + ${q}c`)} pounds, and "at most" means ${m('\\le')}.`; }
  else if (v % 4 === 2) { const p = r.pick([6, 7]), q = r.pick([12, 15, 17]), G = r.pick([50, 60, 75]);
    stem = `Each egg contains about ${p} grams of protein, and each cup of Greek yogurt contains about ${q} grams of protein. Rita wants to eat at least ${G} grams of protein from eggs and yogurt each day. Which inequality represents this goal, where ${m('e')} is the number of eggs and ${m('y')} is the number of cups of yogurt?`;
    c = [`${p}e + ${q}y \\ge ${G}`, `${p}e + ${q}y \\le ${G}`, `${q}e + ${p}y \\ge ${G}`, `e + y \\ge ${G}`]; ex = `Protein from eggs is ${m(`${p}e`)} grams and from yogurt ${m(`${q}y`)} grams; the total must be at least ${G}.`; }
  else { const p = r.pick([12, 14]), q = r.pick([15, 16, 18]), H = r.pick([20, 24]), G = r.pick([250, 270, 300]);
    stem = `Raj earns ${money(p)} per hour tutoring and ${money(q)} per hour as a lifeguard. He can work at most ${H} hours per week and wants to earn at least ${money(G)} per week. Which system represents this situation, where ${m('x')} is the number of hours tutoring and ${m('y')} is the number of hours lifeguarding?`;
    c = [`x + y \\le ${H} \\text{ and } ${p}x + ${q}y \\ge ${G}`, `x + y \\ge ${H} \\text{ and } ${p}x + ${q}y \\le ${G}`, `x + y \\le ${H} \\text{ and } ${q}x + ${p}y \\ge ${G}`, `${p}x + ${q}y \\le ${H} \\text{ and } x + y \\ge ${G}`]; ex = `Total hours ${m('x + y')} can be at most ${H}, and total earnings ${m(`${p}x + ${q}y`)} must be at least ${G}.`; }
  return { stem: `<p>${stem}</p>`, choices: c.map((s) => m(s)), explanation: ex + ` So the answer is ${m(c[0])}.` };
});

def('linfunc-graph-context', 2, 'mcq', 4, SK.lf, (r, v) => {
  let stem, svg, vals, ex;
  if (v % 3 === 0) { const g0 = r.pick([12, 14, 15, 16]), rate = r.pick([1.5, 2, 2.5, 3]); const T0 = g0 / rate; need(isInt(T0 * 2));
    svg = chart({ x: [0, Math.ceil(T0) + 1], y: [0, g0 + 2], xt: 1, yt: 2, xlabel: 'Time (hours)', ylabel: 'Gas (gallons)', fn: (x) => g0 - rate * x, fnTo: T0, pts: [[0, g0], [T0, 0]] });
    stem = `The graph shows the amount of gas, in gallons, in a car's tank as the car is driven at a constant speed. At what rate, in gallons per hour, does the car use gas?`; vals = [rate, 1 / rate, g0, T0]; need(rate !== 1); ex = `The line falls from ${m(`(0, ${g0})`)} to ${m(`(${T0}, 0)`)}, so the slope is ${m(`-\\frac{${g0}}{${T0}} = -${rate}`)}. The car uses ${rate} gallons per hour.`; }
  else if (v % 3 === 1) { const h0 = r.pick([2, 3, 4, 5]), rate = r.pick([1.5, 2, 3]), X = 6;
    svg = chart({ x: [0, 8], y: [0, h0 + rate * 8 + 2], xt: 1, yt: rate * 8 > 16 ? 4 : 2, xlabel: 'Time (weeks)', ylabel: 'Height (cm)', fn: (x) => h0 + rate * x, fnTo: 8, pts: [[0, h0], [4, h0 + rate * 4]] });
    const W = 12; stem = `The graph models the height, in centimeters, of a seedling ${m('t')} weeks after it was planted, for ${m('0 \\le t \\le 8')}. If the relationship continues, what will the height of the seedling be, in centimeters, ${W} weeks after it was planted?`;
    vals = [h0 + rate * W, rate * W, h0 + rate * X, h0 * W]; ex = `The graph starts at ${m(`(0, ${h0})`)} and passes through ${m(`(4, ${h0 + rate * 4})`)}, so the slope is ${m(rate)} centimeters per week. At ${m(`t = ${W}`)}: ${m(`${h0} + ${rate}(${W}) = ${h0 + rate * W}`)}.`; void X; }
  else { const s0 = r.pick([200, 300, 400]), rate = r.pick([150, 200, 250]);
    svg = chart({ x: [0, 10], y: [0, s0 + rate * 10], xt: 2, yt: (s0 + rate * 10) / 6 > 400 ? 500 : 400, xlabel: 'Time (minutes)', ylabel: 'Water (gallons)', fn: (x) => s0 + rate * x, pts: [[0, s0], [4, s0 + 4 * rate]] });
    const G = s0 + rate * r.int(5, 9);
    stem = `The graph shows the amount of water, in gallons, in a pool as it is being filled at a constant rate. How many minutes after filling began did the pool contain ${commas(G)} gallons?`;
    vals = [(G - s0) / rate, G / rate, (G + s0) / rate, (G - s0) / rate + 2]; ex = `The graph has ${m('y')}-intercept ${s0} and slope ${rate} gallons per minute, so ${m(`${s0} + ${rate}t = ${G}`)} and ${m(`t = ${(G - s0) / rate}`)}.`; }
  return { stem: `<p>${stem}</p>` + svg, ...numCh(vals, (z) => m(L.decStr(z))), explanation: ex };
});

def('lin1-numsolutions', 2, 'mcq', 4, SK.l1, (r, v) => {
  const kind = ['zero', 'inf', 'one'][v % 3];
  const a = r.int(2, 7), b = r.nz(-6, 6), c = r.int(1, 5);
  let lhs, rhs;
  if (kind === 'zero') { const k = r.nz(-9, 9); need(k !== a * b); lhs = `${a}${L.binom('x', b)} - ${c === 1 ? '' : c}x`; rhs = lin(a - c, k); }
  else if (kind === 'inf') { lhs = `${a}${L.binom('x', b)} + ${c === 1 ? '' : c}x`; rhs = lin(a + c, a * b); }
  else { const k = r.nz(-9, 9); lhs = `${a}${L.binom('x', b)} + ${c === 1 ? '' : c}x`; rhs = lin(a + c + r.pick([-1, 1, 2]), k); }
  const eq = `${lhs} = ${rhs}`;
  const opts = ['Zero', 'Exactly one', 'Exactly two', 'Infinitely many'];
  const idx = { zero: 0, one: 1, inf: 3 }[kind];
  const choices = [opts[idx], ...opts.filter((_, i) => i !== idx)];
  const order = choices.map((s) => opts.indexOf(s));
  // verify numerically: g(x) = lhs - rhs is linear; check slope/intercept
  const g = (x) => texEval(lhs, { x }) - texEval(rhs, { x });
  const slope = g(1) - g(0), icpt = g(0);
  return { stem: `<p>${m(eq)}</p><p>How many solutions does the given equation have?</p>`, choices, order,
    explanation: kind === 'inf' ? `Expanding the left side gives ${m(lin(a + c, a * b))}, which is identical to the right side. The equation is true for every value of ${m('x')}, so it has infinitely many solutions.`
      : kind === 'zero' ? `Expanding the left side gives ${m(lin(a - c, a * b))}. The ${m('x')}-terms on both sides are equal but the constants (${a * b} and ${rhs.replace(/^.*x\s*/, '').replace(/^[+] /, '').replace('- ', '-') || 0}) differ, so no value of ${m('x')} works: zero solutions.`
        : `The coefficients of ${m('x')} on the two sides are different, so the equation simplifies to the form ${m('ax = b')} with ${m('a \\ne 0')}, which has exactly one solution.`,
    verify: () => (kind === 'inf' ? close(slope, 0) && close(icpt, 0) : kind === 'zero' ? close(slope, 0) && !close(icpt, 0) : !close(slope, 0)) };
});

def('linfunc-change', 2, 'mcq', 4, SK.lf, (r, v) => {
  let stem, rate, D, I0, ex;
  if (v % 3 === 0) { rate = r.pick([45, 50, 55, 60]); const t = r.int(4, 7); I0 = rate * t; D = rate * r.int(2, 3);
    stem = `The equation ${m(`d = ${I0} - ${rate}t`)} models the distance ${m('d')}, in miles, a bus is from its destination ${m('t')} hours after leaving the station. According to the model, how many hours does it take for the distance to decrease by ${D} miles?`; }
  else if (v % 3 === 1) { rate = r.pick([1200, 1500, 1800]); const t = r.int(8, 12); I0 = rate * t; D = rate * r.int(2, 4);
    stem = `The value ${m('V')}, in dollars, of a car ${m('t')} years after it was purchased is modeled by ${m(`V = ${texInt(I0)} - ${texInt(rate)}t`)}. According to the model, how many years does it take for the car's value to decrease by ${money(D)}?`; }
  else { rate = r.pick([3, 4, 6]); I0 = r.pick([60, 66, 72]); need(I0 % rate === 0); D = rate * r.int(5, 9);
    stem = `The temperature ${m('T')}, in degrees Fahrenheit, of a pot of water ${m('m')} minutes after a burner is turned on is modeled by ${m(`T = ${I0} + ${rate}m`)}. According to the model, by how many minutes does the time increase when the temperature increases by ${D} degrees?`; }
  const vals = [D / rate, (I0 - D) / rate, I0 / rate, rate]; need(vals.every(isInt) && vals[1] > 0);
  ex = `In the model, the quantity changes by ${commas(rate)} for each increase of 1 in the time variable. So a change of ${commas(D)} takes ${m(`\\frac{${texInt(D)}}{${texInt(rate)}} = ${D / rate}`)} units of time.`;
  return { stem: `<p>${stem}</p>`, ...numCh(vals, (z) => m(texInt(z))), explanation: ex };
});

def('lin2-intercept', 2, 'spr', 3, SK.l2, (r, v) => {
  if (v % 3 === 0) { const a = r.nz(-9, 9), b = r.nz(-9, 9), c = r.nz(-30, 30); need(Math.abs(a) > 1); const k = F(c, a); need(!k.isInt());
    const eq = `${poly([[a, 'x'], [b, 'y']])} = ${c}`;
    return { stem: `<p>What is the ${m('x')}-coordinate of the ${m('x')}-intercept of the graph of ${m(eq)} in the ${m('xy')}-plane?</p>`, answer: spr(k),
      explanation: `At the ${m('x')}-intercept, ${m('y = 0')}, so ${m(`${a}x = ${c}`)} and ${m(`x = ${k.tex()}`)}.`, verify: () => eqHolds(eq, { x: k.val(), y: 0 }) }; }
  if (v % 3 === 1) { const x1 = r.int(1, 5), y1 = r.int(-8, 8), x2 = x1 + r.int(1, 4), y2 = r.int(-8, 10); need(y1 !== y2);
    const s = F(y2 - y1, x2 - x1), b = F(y1).sub(s.mul(x1)); need(L.sprFits(b.str()));
    return { stem: `<p>A line in the ${m('xy')}-plane passes through ${pt(x1, y1)} and ${pt(x2, y2)}. What is the ${m('y')}-coordinate of the ${m('y')}-intercept of the line?</p>`, answer: spr(b),
      explanation: `The slope is ${m(s.tex())}. Then ${m(`b = ${y1} - ${pn(s)}(${x1}) = ${b.tex()}`)}.`, verify: () => close(s.val() * x2 + b.val(), y2) }; }
  const mm = r.pick([2, 3, 4, -2, -3, 5]), p = r.nz(-5, 6), q = r.nz(-9, 9); const k = F(p).sub(F(q, mm)); need(!k.isInt() && L.sprFits(k.str()));
  const eq = `y = ${mm}(x ${p > 0 ? '-' : '+'} ${Math.abs(p)}) ${q > 0 ? '+' : '-'} ${Math.abs(q)}`;
  return { stem: `<p>The graph of ${m(eq)} crosses the ${m('x')}-axis at the point ${m('(k, 0)')}. What is the value of ${m('k')}?</p>`, answer: spr(k),
    explanation: `Set ${m('y = 0')}: ${m(`${mm}(k ${p > 0 ? '-' : '+'} ${Math.abs(p)}) = ${-q}`)}, so ${m(`k ${p > 0 ? '-' : '+'} ${Math.abs(p)} = ${F(-q, mm).tex()}`)} and ${m(`k = ${k.tex()}`)}.`, verify: () => eqHolds(eq, { x: k.val(), y: 0 }) };
});

/* ============================ HARD ============================ */
def('sys-nosol', 3, 'spr', 4, SK.sys, (r, v) => {
  let e1, e2, k, ex, test;
  if (v % 4 === 0) { const d = r.nz(-9, 9), b = r.nz(-8, 8), e = r.nz(-8, 8), c = r.nz(-15, 15), f = r.nz(-15, 15); need(Math.abs(e) > 1);
    k = F(d * b, e); need(!F(c * e).eq(F(f * b)) && L.sprFits(k.str()) && !k.eq(0));
    e1 = `kx ${b > 0 ? '+' : '-'} ${Math.abs(b) === 1 ? '' : Math.abs(b)}y = ${c}`; e2 = `${poly([[d, 'x'], [e, 'y']])} = ${f}`;
    ex = `A system of two linear equations has no solution when the lines are parallel and distinct, so the ratios of the coefficients of ${m('x')} and ${m('y')} must be equal: ${m(`\\frac{k}{${d}} = \\frac{${b}}{${e}}`)}. So ${m(`k = ${k.tex()}`)}; the constants are not in the same ratio, so the lines are distinct.`;
    test = (K) => close(K * e - b * d, 0) && !close(c * e - b * f, 0); }
  else if (v % 4 === 1) { const a = r.nz(-6, 6), d = r.nz(-9, 9), e = r.nz(-9, 9), c = r.nz(-12, 12), f = r.nz(-12, 12); need(Math.abs(d) > 1);
    k = F(-a * e, d); need(L.sprFits(k.str()) && !k.eq(0) && !close(a * f - c * d, 0));
    e1 = `${a === 1 ? '' : a === -1 ? '-' : a}x - ky = ${c}`; e2 = `${poly([[d, 'x'], [e, 'y']])} = ${f}`;
    ex = `For no solution the coefficients must be proportional (but not the constants): ${m(`\\frac{${a}}{${d}} = \\frac{-k}{${e}}`)}. Solving gives ${m(`k = ${k.tex()}`)}.`;
    test = (K) => close(a * e - (-K) * d, 0) && !close(a * f - c * d, 0); }
  else if (v % 4 === 2) { const s = r.int(2, 4), a0 = r.int(1, 5), b0 = r.nz(-6, 6); const c = r.nz(-9, 9), f = r.nz(-20, 20); need(f !== s * c);
    k = F(b0); e1 = `${cv(a0, 'x')} + ky = ${c}`; e2 = `${s * a0}x ${s * b0 > 0 ? '+' : '-'} ${Math.abs(s * b0)}y = ${f}`;
    ex = `The coefficient of ${m('x')} in the second equation is ${s} times the coefficient in the first. For parallel lines the ${m('y')}-coefficient must also be scaled by ${s}: ${m(`${s}k = ${s * b0}`)}, so ${m(`k = ${b0}`)}. Since ${m(`${s}(${c}) \\ne ${f}`)}, the lines are distinct.`;
    test = (K) => close(a0 * s * b0 - K * s * a0, 0) && f !== s * c; }
  else { const sl = r.nz(-4, 4), den = r.pick([2, 3, 4]); const p = r.nz(-6, 6), q = r.nz(-6, 6); need(Math.abs(q) > 1);
    const target = F(-p, q); k = target.mul(den); need(k.isInt() && !k.eq(0)); const b = r.nz(-9, 9), f = r.nz(-12, 12); need(!F(f, q).eq(b));
    e1 = `y = \\frac{k}{${den}}x ${b > 0 ? '+' : '-'} ${Math.abs(b)}`; e2 = `${poly([[p, 'x'], [q, 'y']])} = ${f}`; void sl;
    ex = `The second line has slope ${m(target.tex())}. For no solution the first line must be parallel, so ${m(`\\frac{k}{${den}} = ${target.tex()}`)} and ${m(`k = ${k.tex()}`)}. The ${m('y')}-intercepts (${b} and ${F(f, q).tex().replace(/\\frac\{(\d+)\}\{(\d+)\}/, '$1/$2')}) differ, so the lines never meet.`;
    test = (K) => close(K / den, -p / q) && !close(b, f / q); }
  return { stem: `<p>${m(e1)}<br>${m(e2)}</p><p>In the given system of equations, ${m('k')} is a constant. If the system has no solution, what is the value of ${m('k')}?</p>`, answer: spr(k), explanation: ex, verify: () => test(k.val()) };
});

def('sys-infinite', 3, 'spr', 3, SK.sys, (r, v) => {
  if (v % 3 === 0) { const a = r.int(2, 5), b = r.nz(-6, 6), c = r.nz(-9, 9), s = r.int(2, 5);
    const e1 = `${a}x ${b > 0 ? '+' : '-'} ${Math.abs(b)}y = ${c}`, e2 = `px ${s * b > 0 ? '+' : '-'} ${Math.abs(s * b)}y = q`;
    const ans = s * a + s * c;
    return { stem: `<p>${m(e1)}<br>${m(e2)}</p><p>In the given system of equations, ${m('p')} and ${m('q')} are constants. If the system has infinitely many solutions, what is the value of ${m('p + q')}?</p>`, answer: spr(ans),
      explanation: `For infinitely many solutions the second equation must be a multiple of the first. Since ${m(`${s * b} = ${s}(${b})`)}, the multiplier is ${s}, so ${m(`p = ${s * a}`)} and ${m(`q = ${s * c}`)}. Thus ${m(`p + q = ${ans}`)}.`, verify: () => ans === s * (a + c) };
  }
  if (v % 3 === 1) { const a = r.int(2, 6), b = r.nz(-6, 6), c = r.nz(-12, 12), s = r.pick([F(3, 2), F(-3, 2), F(5, 2), F(-1, 2), F(2), F(-2)]);
    const A2 = s.mul(a), K = s.mul(b), C2 = s.mul(c); need(A2.isInt() && K.isInt() && C2.isInt());
    const e1 = `${a}x ${b > 0 ? '+' : '-'} ${Math.abs(b)}y = ${c}`, e2 = `ky ${A2.n > 0 ? '+' : '-'} ${Math.abs(A2.n)}x = ${C2.n}`;
    return { stem: `<p>${m(e1)}<br>${m(e2)}</p><p>In the given system of equations, ${m('k')} is a constant. If the system has infinitely many solutions, what is the value of ${m('k')}?</p>`, answer: spr(K),
      explanation: `Rewrite the second equation as ${m(`${A2.n}x + ky = ${C2.n}`)}. It must be ${m(s.tex())} times the first equation, since ${m(`\\frac{${A2.n}}{${a}} = \\frac{${C2.n}}{${c}} = ${s.tex()}`)}. Therefore ${m(`k = ${s.tex()}(${b}) = ${K.n}`)}.`, verify: () => close(A2.val() / a, C2.val() / c) && close(K.val() / b, A2.val() / a) };
  }
  const p = r.pick([2, 3, 4]), q = r.pick([3, 5]), a = r.int(1, 3), bb = r.int(1, 4), c = r.int(2, 9); need(p !== q && L.gcd(a, p) === 1 && L.gcd(bb, q) === 1);
  const L2 = p * q; // multiply (a/p)x + (bb/q)y = c by L2*s
  const s = r.int(1, 2) * L2; const A = F(a, p).mul(s), B = F(bb, q).mul(s), C = F(c).mul(s);
  const e1 = `\\frac{${a}}{${p}}x + \\frac{${bb}}{${q}}y = ${c}`, e2 = `${A.n}x + ${B.n}y = r`;
  return { stem: `<p>${m(e1)}<br>${m(e2)}</p><p>In the given system of equations, ${m('r')} is a constant. If the system has infinitely many solutions, what is the value of ${m('r')}?</p>`, answer: spr(C),
    explanation: `Comparing ${m('x')}-coefficients, the second equation is ${m(`${A.n} \\div \\frac{${a}}{${p}} = ${s}`)} times the first (and indeed ${m(`${s} \\cdot \\frac{${bb}}{${q}} = ${B.n}`)}). So ${m(`r = ${s}(${c}) = ${C.n}`)}.`, verify: () => close(A.val() / (a / p), B.val() / (bb / q)) };
});

def('lin1-infinite', 3, 'mcq', 3, SK.l1, (r, v) => {
  if (v % 3 === 0) { const a = r.int(2, 6), p = r.int(2, 5), q = r.int(1, 9), s = r.int(3, 20); const k = s - a * p; need(k !== 0);
    const eq = (K) => `${a}(${p}x - ${q}) + ${K}x = ${s}x - ${a * q}`;
    return { stem: `<p>${m(`${a}(${p}x - ${q}) + kx = ${s}x - ${a * q}`)}</p><p>In the given equation, ${m('k')} is a constant. The equation has infinitely many solutions. What is the value of ${m('k')}?</p>`, ...numCh([k, s - p, s + a * p, s]),
      explanation: `Expanding gives ${m(`${a * p}x - ${a * q} + kx = ${s}x - ${a * q}`)}. For every ${m('x')} to work, the ${m('x')}-coefficients must match: ${m(`${a * p} + k = ${s}`)}, so ${m(`k = ${k}`)}.`,
      verify: () => [0, 1, 2.5, -3].every((x) => eqHolds(eq(k < 0 ? `(${k})` : k), { x })) };
  }
  if (v % 3 === 1) { const a = r.int(1, 5), b = r.int(2, 6), c = r.int(2, 9), d = r.nz(-9, 9); need(gcd3(a, b) === 1);
    const e = F(a * c, b), k = F(a * d, b); need(!k.isInt() || true); need(L.sprFits(k.str()));
    const eqT = `\\frac{${a}}{${b}}(${lin(c, d)}) = ${poly([[e, 'x']])} + k`;
    return { stem: `<p>${m(eqT)}</p><p>In the given equation, ${m('k')} is a constant. If the equation has infinitely many solutions, what is the value of ${m('k')}?</p>`, ...numCh([k, F(d), F(a * d), F(-a * d, b)]),
      explanation: `Distribute on the left: ${m(`${poly([[e, 'x'], [k, '']])}`)}. The ${m('x')}-terms already match, so the constants must match too: ${m(`k = ${k.tex()}`)}.`,
      verify: () => [0, 1, 3].every((x) => close((a / b) * (c * x + d), e.val() * x + k.val())) };
  }
  const p = r.int(2, 9), h = r.nz(-8, 8), c = -h * p;
  return { stem: `<p>${m(`a(x ${h > 0 ? '-' : '+'} ${Math.abs(h)}) = ${p}x + c`)}</p><p>In the given equation, ${m('a')} and ${m('c')} are constants. If the equation has infinitely many solutions, what is the value of ${m('c')}?</p>`, ...numCh([c, h * p, -h, p]),
    explanation: `For infinitely many solutions both sides must be identical. Matching ${m('x')}-coefficients gives ${m(`a = ${p}`)}; then the left side is ${m(lin(p, -p * h))}, so ${m(`c = ${c}`)}.`,
    verify: () => [0, 2, -1].every((x) => close(p * (x - h), p * x + c)) };
});
function gcd3(a, b) { return L.gcd(a, b); }

def('lin1-nosol', 3, 'mcq', 4, SK.l1, (r, v) => {
  if (v % 3 === 0) { const a = r.int(2, 5), k0 = r.nz(-4, 6), b = r.nz(-6, 6), d = r.nz(-15, 15); need(a * b !== d && Math.abs(k0) > 1);
    const c = a * k0;
    const vals = [F(k0), F(c), F(a, c), F(c - a)];
    return { stem: `<p>${m(`${a}(kx ${b > 0 ? '+' : '-'} ${Math.abs(b)}) = ${lin(c, d)}`)}</p><p>In the given equation, ${m('k')} is a constant. If the equation has no solution, what is the value of ${m('k')}?</p>`, ...numCh(vals),
      explanation: `The left side is ${m(`${a}kx ${a * b > 0 ? '+' : '-'} ${Math.abs(a * b)}`)}. A linear equation has no solution when the ${m('x')}-coefficients are equal but the constants differ. So ${m(`${a}k = ${c}`)}, giving ${m(`k = ${k0}`)}; the constants ${a * b} and ${d} differ.`,
      verify: () => a * k0 === c && a * b !== d };
  }
  if (v % 3 === 1) { const p = r.int(2, 6), q = r.int(1, 9), s = r.int(2, 6), t = r.int(1, 9); const k = p + s; need(-q !== s * t);
    const vals = [k, s - p, p, s];
    return { stem: `<p>${m(`kx - (${p}x + ${q}) = ${s}(x + ${t})`)}</p><p>In the given equation, ${m('k')} is a constant. The equation has no solution. What is the value of ${m('k')}?</p>`, ...numCh(vals),
      explanation: `Simplify: ${m(`(k - ${p})x - ${q} = ${s}x + ${s * t}`)}. For no solution the ${m('x')}-coefficients must be equal while the constants differ: ${m(`k - ${p} = ${s}`)}, so ${m(`k = ${k}`)}.`, verify: () => k - p === s };
  }
  const c = r.int(2, 6), d = r.int(2, 11); // kx + d = c(x - k): no solution iff k = c and d != -c^2
  need(d !== -c * c);
  const vals = [F(c), F(-c), F(-d, c), F(d, c)];
  return { stem: `<p>${m(`kx + ${d} = ${c}(x - k)`)}</p><p>In the given equation, ${m('k')} is a constant. For what value of ${m('k')} does the equation have no solution?</p>`, ...numCh(vals),
    explanation: `Rewrite as ${m(`kx + ${d} = ${c}x - ${c}k`)}. For no solution the ${m('x')}-coefficients must be equal, so ${m(`k = ${c}`)}. Then the equation becomes ${m(`${c}x + ${d} = ${c}x - ${c * c}`)}, which is never true. (The value ${m(F(-d, c).tex())} would make the constants equal, not the coefficients.)`,
    verify: () => d !== -c * c };
});

def('linfunc-shift', 3, 'spr', 3, SK.lf, (r, v) => {
  if (v % 3 === 0) { const p = r.nz(-4, 5), a = r.nz(-5, 5), b = r.nz(-9, 9), t = r.int(-3, 12); const val = a * (t - p) + b; need(t - p !== 0 && Math.abs(a) > 1);
    return { stem: `<p>For the linear function ${m('f')}, ${m(`f(x ${p > 0 ? '+' : '-'} ${Math.abs(p)}) = ${lin(a, b)}`)} for all values of ${m('x')}. What is the value of ${m(`f(${t})`)}?</p>`, answer: spr(val),
      explanation: `To get ${m(`f(${t})`)}, choose ${m('x')} so that ${m(`x ${p > 0 ? '+' : '-'} ${Math.abs(p)} = ${t}`)}, that is, ${m(`x = ${t - p}`)}. Then ${m(`f(${t}) = ${a}(${t - p}) ${b > 0 ? '+' : '-'} ${Math.abs(b)} = ${val}`)}.`, verify: () => { const f = (u) => a * (u - p) + b; return f(0 + p) === b && f(t) === val; } };
  }
  if (v % 3 === 1) { const a = r.nz(-5, 5), b = r.nz(-9, 9), s = r.int(1, 4), u = r.nz(-6, 6), k = r.int(1, 9); const f = (x) => a * x + b;
    const x1 = r.int(-2, 1), x2 = x1 + 3; const val = f(k - s) + u;
    return { stem: `<p>The linear function ${m('f')} satisfies ${m(`f(${x1}) = ${f(x1)}`)} and ${m(`f(${x2}) = ${f(x2)}`)}. The function ${m('g')} is defined by ${m(`g(x) = f(x - ${s}) ${u > 0 ? '+' : '-'} ${Math.abs(u)}`)}. What is the value of ${m(`g(${k})`)}?</p>`, answer: spr(val),
      explanation: `The slope of ${m('f')} is ${m(`\\frac{${f(x2) - f(x1)}}{3} = ${a}`)}, so ${m(`f(x) = ${lin(a, b)}`)}. Then ${m(`g(${k}) = f(${k - s}) ${u > 0 ? '+' : '-'} ${Math.abs(u)} = ${f(k - s)} ${u > 0 ? '+' : '-'} ${Math.abs(u)} = ${val}`)}.`, verify: () => val === a * (k - s) + b + u };
  }
  const c = r.pick([2, 3, 4]), a = r.nz(-4, 5), b = r.nz(-9, 9), t = c * r.nz(-3, 4); need(Math.abs(a) > 1 || true);
  // f(cx) = c*a x + b  => f(u) = a u + b
  const val = a * t + b;
  return { stem: `<p>For the linear function ${m('h')}, ${m(`h(${c}x) = ${lin(c * a, b)}`)} for all values of ${m('x')}. What is the value of ${m(`h(${t})`)}?</p>`, answer: spr(val),
    explanation: `Let ${m(`u = ${c}x`)}. Then ${m(`${cv(c * a, 'x')} = ${cv(a, 'u')}`)}, so ${m(`h(u) = ${lin(a, b, 'u')}`)}. Therefore ${m(`h(${t}) = ${pn(a)}(${t}) ${b > 0 ? '+' : '-'} ${Math.abs(b)} = ${val}`)}.`, verify: () => close(c * a * (t / c) + b, val) };
});

def('sys-mixture', 3, 'mcq', 3, SK.sys, (r, v) => {
  if (v % 3 === 0) { const p1 = r.pick([10, 15, 20, 25]), p2 = r.pick([40, 50, 60]), V = r.pick([20, 30, 40, 50, 60]), p = r.int(p1 / 5 + 1, p2 / 5 - 1) * 5;
    const x = F(V * (p2 - p), p2 - p1); need(L.sprFits(x.str()) || L.sprFits(String(x.val())));
    return { stem: `<p>A chemist mixes a ${p1}% acid solution with a ${p2}% acid solution to make ${V} liters of a ${p}% acid solution. How many liters of the ${p1}% solution does the chemist use?</p>`, ...numCh([x, F(V).sub(x), F(V, 2), F(V * p, 100)], (z) => m(L.nice(z))),
      explanation: `Let ${m('x')} be liters of the ${p1}% solution and ${m('y')} liters of the ${p2}% solution. Then ${m(`x + y = ${V}`)} and ${m(`${p1 / 100}x + ${p2 / 100}y = ${p / 100}(${V})`)}. Substituting ${m(`y = ${V} - x`)}: ${m(`${p1}x + ${p2}(${V} - x) = ${p * V}`)}, so ${m(`${p2 - p1}x = ${V * (p2 - p)}`)} and ${m(`x = ${x.tex()}`)}.`,
      verify: () => close(p1 * x.val() + p2 * (V - x.val()), p * V) };
  }
  if (v % 3 === 1) { const c1 = r.pick([6, 7, 8]), c2 = r.pick([12, 13, 14, 15]), V = r.pick([40, 50, 60, 80]), avg = c1 + r.pick([1.5, 2.5, 3, 3.5, 4.5]);
    need(avg < c2); const y = F(Math.round(V * (avg - c1) * 2), Math.round((c2 - c1) * 2)); need(L.sprFits(y.str()) || terminatesOk(y));
    return { stem: `<p>A coffee shop blends coffee that costs ${money(c1)} per pound with coffee that costs ${money(c2)} per pound to make ${V} pounds of a blend that costs ${money(avg)} per pound. How many pounds of the ${money(c2)}-per-pound coffee are in the blend?</p>`, ...numCh([y, F(V).sub(y), F(V, 2), F(Math.round((avg - c1) * V * 2), 2)], (z) => m(L.nice(z))),
      explanation: `With ${m('x')} pounds of the cheaper coffee and ${m('y')} pounds of the more expensive one: ${m(`x + y = ${V}`)} and ${m(`${c1}x + ${c2}y = ${+(avg * V).toFixed(2)}`)}. Substituting ${m(`x = ${V} - y`)} gives ${m(`${c2 - c1}y = ${+(avg * V - c1 * V).toFixed(2)}`)}, so ${m(`y = ${y.tex()}`)}.`,
      verify: () => close(c1 * (V - y.val()) + c2 * y.val(), avg * V) };
  }
  const a = r.pick([0.4, 0.5]), s = r.pick([1.25, 1.5, 1.75]), bud = r.int(30, 60);
  const nm = r.int(10, 30); const ncost = bud - a * nm; need(ncost > 0);
  const nl = ncost / s; need(isInt(nl) && nl > 0);
  const N = nm + nl;
  return { stem: `<p>A store sells pencils for ${money(a)} each and notebooks for ${money(s)} each. A teacher bought ${N} items, consisting only of pencils and notebooks, for a total of ${money(bud)}. How many notebooks did the teacher buy?</p>`, ...numCh([nl, nm, +(bud - a * N).toFixed(2), Math.round(bud / s)], (z) => m(L.nice(z))),
    explanation: `If ${m('p')} pencils and ${m('n')} notebooks were bought, ${m(`p + n = ${N}`)} and ${m(`${a}p + ${s}n = ${bud}`)}. Substituting ${m(`p = ${N} - n`)}: ${m(`${a}(${N}) + ${cv(+(s - a).toFixed(2), 'n')} = ${bud}`)}, so ${m(`${cv(+(s - a).toFixed(2), 'n')} = ${+(bud - a * N).toFixed(2)}`)} and ${m(`n = ${nl}`)}.`,
    verify: () => close(a * (N - nl) + s * nl, bud) };
});
function terminatesOk(y) { try { spr(y); return true; } catch (e) { return false; } }

def('ineq-units', 3, 'spr', 3, SK.ineq, (r, v) => {
  if (v % 3 === 0) { const cap = r.pick([1.2, 1.5, 1.8]), op = r.int(70, 95), crate = r.int(45, 70); const n = Math.floor((cap * 1000 - op) / crate); need((cap * 1000 - op) % crate !== 0);
    return { stem: `<p>A freight elevator has a maximum capacity of ${cap} metric tons (1 metric ton = 1,000 kilograms). An operator who weighs ${op} kilograms rides in the elevator with crates that each weigh ${crate} kilograms. What is the maximum number of crates that can be in the elevator with the operator on one trip?</p>`, answer: spr(n),
      explanation: `The capacity is ${m(`${cap} \\times 1{,}000 = ${cap * 1000}`)} kilograms. So ${m(`${op} + ${crate}c \\le ${cap * 1000}`)}, which gives ${m(`c \\le ${((cap * 1000 - op) / crate).toFixed(2)}\\ldots`)}. The maximum whole number of crates is ${n}.`, verify: () => op + crate * n <= cap * 1000 && op + crate * (n + 1) > cap * 1000 };
  }
  if (v % 3 === 1) { const tons = r.pick([2, 3]), have = r.int(6, 15) * 100, kg = r.pick([20, 25, 40, 50]); const lb = kg * 2.2; const avail = tons * 2000 - have;
    const n = Math.floor(avail / lb + 1e-9); need(Math.abs(avail / lb - Math.round(avail / lb)) > 1e-6);
    return { stem: `<p>A truck can carry a maximum load of ${tons} tons (1 ton = 2,000 pounds). The truck is already carrying ${commas(have)} pounds of equipment. Each bag of gravel weighs ${kg} kilograms. If 1 kilogram is equivalent to 2.2 pounds, what is the greatest number of bags of gravel that can be added to the truck?</p>`, answer: spr(n),
      explanation: `The truck can hold ${m(`${tons}(2{,}000) - ${texInt(have)} = ${texInt(avail)}`)} more pounds. Each bag weighs ${m(`${kg}(2.2) = ${+lb.toFixed(2)}`)} pounds, so ${m(`${+lb.toFixed(2)}b \\le ${texInt(avail)}`)}, giving ${m(`b \\le ${(avail / lb).toFixed(2)}\\ldots`)}. The greatest whole number is ${n}.`, verify: () => n * lb <= avail && (n + 1) * lb > avail };
  }
  const goal = r.pick([30, 35, 40]), done = r.int(80, 180) * 100, each = r.pick([3.5, 4.5, 5, 6.5]); const rem = goal * 1000 - done; need(rem > 0);
  const n = Math.ceil(rem / (each * 1000) - 1e-9); need(Math.abs(rem / (each * 1000) - Math.round(rem / (each * 1000))) > 1e-6);
  return { stem: `<p>A runner wants to run at least ${goal} kilometers this week. So far this week she has run ${commas(done)} meters. If each of her remaining runs this week will be ${each} kilometers long, what is the minimum number of additional runs she must complete to reach her goal? (1 kilometer = 1,000 meters)</p>`, answer: spr(n),
    explanation: `She has run ${m(`${done / 1000}`)} kilometers, so she needs at least ${m(`${goal} - ${done / 1000} = ${+(rem / 1000).toFixed(3)}`)} more. Then ${m(`${each}n \\ge ${+(rem / 1000).toFixed(3)}`)} gives ${m(`n \\ge ${(rem / 1000 / each).toFixed(2)}\\ldots`)}, so the minimum number of runs is ${n}.`, verify: () => n * each * 1000 >= rem && (n - 1) * each * 1000 < rem };
});

def('lin2-perp-int', 3, 'mcq', 4, SK.l2, (r, v) => {
  if (v % 3 === 0) { const p = r.nz(-6, 6), q = r.nz(-6, 6), a = r.nz(-8, 8), b = r.nz(-8, 8), c = r.nz(-15, 15); need(Math.abs(a) !== Math.abs(b));
    const sl = F(b, a); // given slope -a/b ; perpendicular b/a
    const k = F(b).mul(0).add(F(q)).sub(sl.mul(p)); need(L.sprFits(k.str()) && !k.isInt());
    return { stem: `<p>In the ${m('xy')}-plane, line ${m('\\ell')} passes through the point ${pt(p, q)} and is perpendicular to the line with equation ${m(`${poly([[a, 'x'], [b, 'y']])} = ${c}`)}. If line ${m('\\ell')} has ${m('y')}-intercept ${m('(0, k)')}, what is the value of ${m('k')}?</p>`, ...numCh([k, F(q).add(sl.mul(p)), F(q).add(F(a, b).mul(p)), F(c, b)]),
      explanation: `The given line has slope ${m(F(-a, b).tex())}, so line ${m('\\ell')} has slope ${m(sl.tex())}. Then ${m(`k = ${q} - ${pn(sl)}(${pn(p)}) = ${k.tex()}`)}.`, verify: () => close(sl.val() * (-a / b), -1) && close(sl.val() * p + k.val(), q) };
  }
  if (v % 3 === 1) { const x1 = r.int(-6, 2), y1 = r.int(-6, 6), x2 = x1 + 2 * r.int(1, 4), y2 = y1 + 2 * r.nz(-4, 4);
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, s0 = F(y2 - y1, x2 - x1), sl = F(-1).div(s0); const k = F(my).sub(sl.mul(mx)); need(L.sprFits(k.str()));
    return { stem: `<p>Points ${m('A')} and ${m('B')} have coordinates ${pt(x1, y1)} and ${pt(x2, y2)}, respectively, in the ${m('xy')}-plane. Line ${m('m')} is the perpendicular bisector of segment ${m('AB')}. What is the ${m('y')}-coordinate of the ${m('y')}-intercept of line ${m('m')}?</p>`, ...numCh([k, F(my).sub(s0.mul(mx)), F(my).add(sl.mul(mx)), F(my)]),
      explanation: `The midpoint of ${m('AB')} is ${pt(mx, my)} and the slope of ${m('AB')} is ${m(s0.tex())}. Line ${m('m')} has slope ${m(sl.tex())} and passes through the midpoint, so its ${m('y')}-intercept is ${m(`${my} - ${pn(sl)}(${pn(mx)}) = ${k.tex()}`)}.`,
      verify: () => { const f = (x) => sl.val() * x + k.val(); const d1 = Math.hypot(0 - x1, f(0) - y1), d2 = Math.hypot(0 - x2, f(0) - y2); return close(d1, d2) && close(f(mx), my); } };
  }
  const p = r.nz(-4, 5), q = r.nz(-5, 8), x1 = r.int(-5, 0), x2 = x1 + r.int(2, 6), y1 = r.int(-5, 6), y2 = r.nz(-6, 6); need(y1 !== y2);
  const s0 = F(y2 - y1, x2 - x1), sl = F(-1).div(s0); const xi = F(p).sub(F(q).div(sl)); need(L.sprFits(xi.str()));
  return { stem: `<p>Line ${m('r')} passes through ${pt(p, q)} and is perpendicular to the line that passes through ${pt(x1, y1)} and ${pt(x2, y2)}. What is the ${m('x')}-coordinate of the ${m('x')}-intercept of line ${m('r')}?</p>`, ...numCh([xi, F(p).add(F(q).div(sl)), F(p).sub(F(q).div(s0)), F(q).sub(sl.mul(p))]),
    explanation: `The second line has slope ${m(s0.tex())}, so line ${m('r')} has slope ${m(sl.tex())}: ${m(`y - ${q < 0 ? `(${q})` : q} = ${sl.tex()}(x - ${p < 0 ? `(${p})` : p})`)}. Setting ${m('y = 0')} gives ${m(`x = ${xi.tex()}`)}.`, verify: () => close(sl.val() * (xi.val() - p) + q, 0) };
});

def('sys-sum-trick', 3, 'spr', 3, SK.sys, (r, v) => {
  if (v % 3 === 2) { const a = r.int(2, 5), b = r.int(2, 6), k = r.int(2, 4), c = r.int(3, 20); need(a !== b && L.gcd(a, b) === 1);
    const s = F(5, 2).mul(k) ; void s; const mult = r.pick([F(5, 2), F(3, 2), F(7, 2)]); const A = mult.mul(a * k), B = mult.mul(b * k), C = mult.mul(c * k); need(A.isInt() && B.isInt() && C.isInt());
    return { stem: `<p>If ${m(`${a * k}x + ${b * k}y = ${c * k}`)}, what is the value of ${m(`${A.n}x + ${B.n}y`)}?</p>`, answer: spr(C),
      explanation: `The expression ${m(`${A.n}x + ${B.n}y`)} is ${m(mult.tex())} times ${m(`${a * k}x + ${b * k}y`)}, because ${m(`${A.n} = ${mult.tex()}(${a * k})`)} and ${m(`${B.n} = ${mult.tex()}(${b * k})`)}. So its value is ${m(`${mult.tex()}(${c * k}) = ${C.n}`)}.`, verify: () => close(A.val() * 1 + B.val() * ((c * k - a * k) / (b * k)), C.val()) };
  }
  const a = r.int(2, 9), b = r.int(2, 9); need(a !== b);
  const X = F(r.int(-20, 30), r.pick([1, 2, 3, 7])), Y = F(r.int(-20, 30), r.pick([1, 2, 5, 3]));
  const c = X.mul(a).add(Y.mul(b)), d = X.mul(b).add(Y.mul(a)); need(c.isInt() && d.isInt());
  const want = v % 3 === 0 ? X.add(Y) : X.sub(Y); need(want.isInt() && !X.isInt());
  const ask = v % 3 === 0 ? 'x + y' : 'x - y';
  return { stem: `<p>${m(`${a}x + ${b}y = ${c.n}`)}<br>${m(`${b}x + ${a}y = ${d.n}`)}</p><p>If ${m('(x, y)')} is the solution to the system of equations above, what is the value of ${m(ask)}?</p>`, answer: spr(want),
    explanation: v % 3 === 0 ? `Add the equations: ${m(`${a + b}x + ${a + b}y = ${c.n + d.n}`)}. Dividing by ${a + b} gives ${m(`x + y = ${want.tex()}`)}.` : `Subtract the second equation from the first: ${m(`${a - b}x ${b - a > 0 ? '+' : '-'} ${Math.abs(b - a)}y = ${c.n - d.n}`)}. Dividing by ${a - b} gives ${m(`x - y = ${want.tex()}`)}.`,
    verify: () => eqHolds(`${a}x + ${b}y = ${c.n}`, { x: X.val(), y: Y.val() }) && eqHolds(`${b}x + ${a}y = ${d.n}`, { x: X.val(), y: Y.val() }) };
});

// half-plane clip (Sutherland-Hodgman) for shading
function clipPoly(poly, f) { // keep f(x,y) >= 0
  const outp = [];
  for (let i = 0; i < poly.length; i++) {
    const P = poly[i], Q = poly[(i + 1) % poly.length]; const fp = f(...P), fq = f(...Q);
    if (fp >= 0) outp.push(P);
    if ((fp >= 0) !== (fq >= 0)) { const t = fp / (fp - fq); outp.push([P[0] + t * (Q[0] - P[0]), P[1] + t * (Q[1] - P[1])]); }
  }
  return outp;
}
def('ineq-region', 3, 'mcq', 4, SK.ineq, (r, v) => {
  const m1 = r.pick([1, 2, -1, 3, F(1, 2)]), m2 = r.pick([-1, -2, F(-1, 2), -3, 1]); const M1 = fr(m1), M2 = fr(m2); need(!M1.eq(M2));
  const b1 = r.nz(-3, 3), b2 = r.nz(-2, 5); need(b1 !== b2);
  const up1 = r.chance(0.5), up2 = r.chance(0.5); // shading above line1? above line2?
  const solid1 = v % 2 === 0; // line 1 solid, line 2 dashed (or swapped)
  const f1 = (x) => M1.val() * x + b1, f2 = (x) => M2.val() * x + b2;
  let P = [[-7, -7], [7, -7], [7, 7], [-7, 7]];
  P = clipPoly(P, (x, y) => (up1 ? y - f1(x) : f1(x) - y)); P = clipPoly(P, (x, y) => (up2 ? y - f2(x) : f2(x) - y));
  need(P.length >= 3);
  const area = Math.abs(P.reduce((s, p, i) => s + p[0] * P[(i + 1) % P.length][1] - P[(i + 1) % P.length][0] * p[1], 0) / 2); need(area > 12);
  const svg = plane({ x: [-7, 7], y: [-7, 7], tick: 1, items: [{ poly: P, fill: '#bdbdbd' }, { fn: f1, dash: !solid1 }, { fn: f2, dash: solid1 }] });
  const sym = (up, solid) => (up ? (solid ? '\\ge' : '>') : (solid ? '\\le' : '<'));
  const sys = (u1, s1, u2, s2) => `${m(`y ${sym(u1, s1)} ${poly([[M1, 'x'], [b1, '']])}`)}<br>${m(`y ${sym(u2, s2)} ${poly([[M2, 'x'], [b2, '']])}`)}`;
  const choices = [sys(up1, solid1, up2, !solid1), sys(!up1, solid1, up2, !solid1), sys(up1, solid1, !up2, !solid1), sys(up1, !solid1, up2, solid1)];
  return { stem: `<p>The shaded region shown represents the solutions to which system of inequalities?</p>` + svg, choices,
    explanation: `The line ${m(`y = ${poly([[M1, 'x'], [b1, '']])}`)} is ${solid1 ? 'solid' : 'dashed'} and the region is ${up1 ? 'above' : 'below'} it, giving ${m(`y ${sym(up1, solid1)} ${poly([[M1, 'x'], [b1, '']])}`)}. The line ${m(`y = ${poly([[M2, 'x'], [b2, '']])}`)} is ${!solid1 ? 'solid' : 'dashed'} and the region is ${up2 ? 'above' : 'below'} it, giving ${m(`y ${sym(up2, !solid1)} ${poly([[M2, 'x'], [b2, '']])}`)}. A solid line means the boundary is included (${m('\\le')} or ${m('\\ge')}).`,
    verify: () => { const cx = P.reduce((s, p) => s + p[0], 0) / P.length, cy = P.reduce((s, p) => s + p[1], 0) / P.length; return (up1 ? cy > f1(cx) : cy < f1(cx)) && (up2 ? cy > f2(cx) : cy < f2(cx)); } };
});

def('linfunc-units', 3, 'mcq', 4, SK.lf, (r, v) => {
  if (v % 3 === 0) { const G = r.pick([12, 14, 15, 16]), mpg = r.pick([25, 28, 30, 32, 36]);
    const c = [`g(m) = ${G} - \\frac{m}{${mpg}}`, `g(m) = ${G} - ${mpg}m`, `g(m) = \\frac{${G} - m}{${mpg}}`, `g(m) = ${mpg}(${G} - m)`];
    return { stem: `<p>A car's gas tank holds ${G} gallons when full. The car uses 1 gallon of gas for every ${mpg} miles it is driven. Which function gives the number of gallons of gas, ${m('g(m)')}, remaining in the tank after the car is driven ${m('m')} miles, starting with a full tank?</p>`,
      choices: c.map(m), explanation: `Driving ${m('m')} miles uses ${m(`\\frac{m}{${mpg}}`)} gallons, so the amount left is ${m(`${G} - \\frac{m}{${mpg}}`)}.`, verify: () => close(texEval(c[0].split('=')[1], { m: mpg * 2 }), G - 2) };
  }
  if (v % 3 === 1) { const V = r.pick([9600, 12000, 14400]), gpm = r.pick([8, 10, 12, 15]);
    const c = [`P(h) = ${texInt(V)} - ${60 * gpm}h`, `P(h) = ${texInt(V)} - ${gpm}h`, `P(h) = ${texInt(V)} - \\frac{${gpm}}{60}h`, `P(h) = ${texInt(V)} - ${gpm + 60}h`];
    return { stem: `<p>A swimming pool contains ${commas(V)} gallons of water. Water is drained from the pool at a constant rate of ${gpm} gallons per minute. Which function gives the number of gallons of water, ${m('P(h)')}, in the pool ${m('h')} hours after draining begins?</p>`,
      choices: c.map(m), explanation: `In one hour (60 minutes), ${m(`${gpm} \\times 60 = ${60 * gpm}`)} gallons are drained. After ${m('h')} hours, ${m(`${60 * gpm}h`)} gallons have been removed, so ${m(c[0])}.`, verify: () => close(texEval(c[0].split('=')[1], { h: 2 }), V - 2 * 60 * gpm) };
  }
  const ppm = r.pick([18, 24, 30, 36, 42]), stock = r.pick([500, 600, 800]);
  const rate = F(ppm, 60);
  const c = [`p(s) = ${stock} - ${rate.tex()}s`, `p(s) = ${stock} - ${ppm}s`, `p(s) = ${stock} - ${60 * ppm}s`, `p(s) = ${stock} - \\frac{60}{${ppm}}s`];
  return { stem: `<p>A printer is loaded with ${stock} sheets of paper and prints at a constant rate of ${ppm} pages per minute, using one sheet per page. Which function gives the number of sheets, ${m('p(s)')}, remaining in the printer ${m('s')} seconds after it begins printing?</p>`,
    choices: c.map(m), explanation: `${ppm} pages per minute is ${m(`\\frac{${ppm}}{60} = ${rate.tex()}`)} page per second. After ${m('s')} seconds, ${m(`${rate.tex()}s`)} sheets have been used, so ${m(c[0])}.`, verify: () => close(texEval(c[0].split('=')[1], { s: 60 }), stock - ppm) };
});

def('lin-breakeven', 3, 'mcq', 3, SK.l1, (r, v) => {
  if (v % 3 === 0) { const a = r.pick([20, 25, 30, 35]), p = r.pick([8, 10, 12]), c = a + r.pick([15, 20, 24, 30]), q = p - r.pick([3, 4, 5, 6]); need(q > 0);
    const x = F(c - a, p - q); need(L.sprFits(x.str()) || terminatesOk(x));
    return { stem: `<p>Phone plan A costs ${money(a)} per month plus ${money(p)} per gigabyte of data used. Phone plan B costs ${money(c)} per month plus ${money(q)} per gigabyte of data used. For how many gigabytes of data used in a month will the two plans cost the same amount?</p>`, ...numCh([x, F(c - a, p + q), F(c + a, p - q), F(c - a, p)], (z) => m(L.nice(z))),
      explanation: `Set the costs equal: ${m(`${a} + ${p}g = ${c} + ${q}g`)}. Then ${m(`${p - q}g = ${c - a}`)}, so ${m(`g = ${x.tex()}`)}.`, verify: () => close(a + p * x.val(), c + q * x.val()) };
  }
  if (v % 3 === 1) { const h1 = r.int(24, 36), r1 = r.pick([2, 2.5, 3]), h2 = h1 - r.int(4, 10), r2 = r.pick([0.5, 1, 1.25, 1.5]); need(r1 > r2);
    const t = (h1 - h2) / (r1 - r2); need(Math.abs(t * 4 - Math.round(t * 4)) < 1e-9 && h1 - r1 * t > 0);
    return { stem: `<p>Two candles are lit at the same time. The first candle is ${h1} centimeters tall and burns at a rate of ${r1} centimeters per hour. The second candle is ${h2} centimeters tall and burns at a rate of ${r2} centimeters per hour. How many hours after they are lit will the two candles be the same height?</p>`, ...numCh([F(Math.round(t * 4), 4), (h1 - h2) / (r1 + r2), (h1 - h2) / r1, h1 - h2], (z) => m(L.nice(z))),
      explanation: `Set the heights equal: ${m(`${h1} - ${r1}t = ${h2} - ${r2}t`)}. Then ${m(`${+(r1 - r2).toFixed(2)}t = ${h1 - h2}`)}, so ${m(`t = ${+t.toFixed(4)}`)}.`, verify: () => close(h1 - r1 * t, h2 - r2 * t) };
  }
  const s1 = r.pick([50, 55, 60]), s2 = s1 + r.pick([10, 15, 20]), d = r.pick([30, 45, 60]);
  const head = s1 * d / 60; const t = head / (s2 - s1); need(Math.abs(t * 4 - Math.round(t * 4)) < 1e-9);
  return { stem: `<p>Car A leaves a city traveling at a constant speed of ${s1} miles per hour. Car B leaves the same city ${d} minutes later, traveling the same route at a constant speed of ${s2} miles per hour. How many hours after Car B leaves will it catch up to Car A?</p>`, ...numCh([F(Math.round(t * 4), 4), t + d / 60, d / 60, head], (z) => m(L.nice(z))),
    explanation: `In ${d} minutes (${m(`${d / 60}`)} hours), Car A travels ${m(`${s1}(${d / 60}) = ${head}`)} miles. Car B gains ${m(`${s2} - ${s1} = ${s2 - s1}`)} miles per hour, so it catches up in ${m(`\\frac{${head}}{${s2 - s1}} = ${+t.toFixed(4)}`)} hours.`, verify: () => close(s1 * (t + d / 60), s2 * t) };
});
function sprOrFrac(t) { const k = Math.round(t * 4); return spr(F(k, 4)); }

def('lin2-k-points', 3, 'spr', 3, SK.l2, (r, v) => {
  // points (x1(k), y1(k)), (x2(k), y2(k)) linear in k; slope s: (y2-y1) = s (x2-x1)
  let P, s, stem, desc;
  if (v % 3 === 0) { const a = r.nz(-5, 5), b = r.int(2, 9), c = r.nz(-3, 3); s = F(r.nz(-4, 4));
    P = { x1: [0, 1], y1: [a, 0], x2: [b, 0], y2: [c, 1] }; // (k, a) and (b, k + c)
    desc = `the points ${m(`(k, ${a})`)} and ${m(`(${b}, k ${c > 0 ? '+' : '-'} ${Math.abs(c)})`)}`; stem = `has a slope of ${m(s.tex())}`; }
  else if (v % 3 === 1) { const a = r.nz(-5, 5), b = r.nz(-9, 9), mm = r.pick([2, 3, -2, -3, 4]); s = F(mm);
    P = { x1: [a, 0], y1: [0, 1], x2: [0, 1], y2: [b, 0] }; // (a, k) and (k, b)
    desc = `the points ${m(`(${a}, k)`)} and ${m(`(k, ${b})`)}`; stem = `is parallel to the graph of ${m(`y = ${lin(mm, r.nz(-6, 6))}`)}`; }
  else { const a = r.nz(-5, 5), b = r.nz(-9, 9), mm = r.pick([2, 3, -2, F(1, 2), F(-1, 3)]); const M0 = fr(mm); s = F(-1).div(M0);
    P = { x1: [a, 0], y1: [0, 2], x2: [0, 1], y2: [b, 0] }; // (a, 2k) and (k, b)
    desc = `the points ${m(`(${a}, 2k)`)} and ${m(`(k, ${b})`)}`; stem = `is perpendicular to the graph of ${m(`y = ${poly([[M0, 'x'], [r.nz(-6, 6), '']])}`)}`; }
  // (y2c + y2k k) - (y1c + y1k k) = s((x2c + x2k k) - (x1c + x1k k))
  const A = F(P.y2[1] - P.y1[1]).sub(s.mul(P.x2[1] - P.x1[1])), B = s.mul(P.x2[0] - P.x1[0]).sub(F(P.y2[0] - P.y1[0]));
  need(!A.eq(0)); const k = B.div(A); need(L.sprFits(k.str()) && !k.eq(0));
  const xs = [P.x1[0] + P.x1[1] * k.val(), P.x2[0] + P.x2[1] * k.val()], ys = [P.y1[0] + P.y1[1] * k.val(), P.y2[0] + P.y2[1] * k.val()]; need(!close(xs[0], xs[1]));
  return { stem: `<p>In the ${m('xy')}-plane, the line that passes through ${desc} ${stem}. What is the value of ${m('k')}?</p>`, answer: spr(k),
    explanation: `The slope must be ${m(s.tex())}. Setting the slope formula equal to ${m(s.tex())} and cross-multiplying gives a linear equation in ${m('k')}: ${m(`${poly([[A, 'k']])} = ${B.tex()}`)}, so ${m(`k = ${k.tex()}`)}.`,
    verify: () => close((ys[1] - ys[0]) / (xs[1] - xs[0]), s.val()) };
});

def('sys-current', 3, 'mcq', 4, SK.sys, (r, v) => {
  const b = r.int(8, 25), c = r.int(2, 6); need(b > 2 * c);
  const t1 = r.int(2, 6); const D = (b - c) * t1; const t2 = D / (b + c); need(isInt(t2 * 4));
  const ctx = [[`A boat travels ${D} miles upstream in ${t1} hours. The return trip downstream along the same route takes ${+t2.toFixed(2)} hours. Assuming the boat's speed in still water and the speed of the current are constant, what is the speed of the current, in miles per hour?`, 'current'],
    [`Flying against a constant wind, a small plane travels ${D * 10} miles in ${t1} hours. Flying with the same wind, the plane travels the same distance in ${+t2.toFixed(2)} hours. What is the speed of the wind, in miles per hour?`, 'wind'],
    [`A kayaker paddles ${D / 4} kilometers upstream in ${t1} hours and then paddles back downstream the same distance in ${+t2.toFixed(2)} hours. If the kayaker's paddling speed in still water and the speed of the current are constant, what is the speed of the current, in kilometers per hour?`, 'current']][v % 3];
  const sc = [1, 10, 0.25][v % 3];
  const vals = [c * sc, b * sc, 2 * c * sc, (b - c) * sc];
  return { stem: `<p>${ctx[0]}</p>`, ...numCh(vals, (z) => m(L.decStr(z))),
    explanation: `Let ${m('s')} be the speed in still ${v % 3 === 1 ? 'air' : 'water'} and ${m('c')} the speed of the ${ctx[1]}. Then ${m(`(s - c)(${t1}) = ${L.decStr(D * sc)}`)} and ${m(`(s + c)(${+t2.toFixed(2)}) = ${L.decStr(D * sc)}`)}, so ${m(`s - c = ${L.decStr((b - c) * sc)}`)} and ${m(`s + c = ${L.decStr((b + c) * sc)}`)}. Subtracting and dividing by 2 gives ${m(`c = ${L.decStr(c * sc)}`)}.`,
    verify: () => close((b - c) * sc * t1, D * sc) && close((b + c) * sc * t2, D * sc) };
});

def('linfunc-piecewise-rate', 3, 'mcq', 4, SK.lf, (r, v) => {
  const a = r.pick([8, 10, 12, 15]), b = r.pick([2, 3, 4, 5]);
  let stem, c, ex, chk;
  if (v % 3 === 0) { stem = `A parking garage charges ${money(a)} for the first hour and ${money(b)} for each additional half hour. Which equation gives the total charge ${m('C')}, in dollars, for parking ${m('h')} hours, where ${m('h')} is a whole number greater than or equal to 1?`;
    c = [`C = ${a} + ${2 * b}(h - 1)`, `C = ${a} + ${b}(h - 1)`, `C = ${a} + ${2 * b}h`, `C = ${a}h + ${2 * b}(h - 1)`]; ex = `After the first hour there are ${m('h - 1')} additional hours, each containing two half hours at ${money(b)}, or ${money(2 * b)} per hour. So ${m(c[0])}.`; chk = (h) => a + 2 * b * (h - 1); }
  else if (v % 3 === 1) { stem = `An electrician charges ${money(a * 6)} for the first hour of a job and ${money(b * 5)} for each additional 15 minutes. Which expression gives the total charge, in dollars, for a job that lasts ${m('h')} hours, where ${m('h')} is a whole number greater than 1?`;
    c = [`${a * 6} + ${b * 20}(h - 1)`, `${a * 6} + ${b * 5}(h - 1)`, `${a * 6} + ${b * 20}h`, `${a * 6 + b * 20}h`]; ex = `There are 4 fifteen-minute periods in each additional hour, so each additional hour costs ${m(`4(${b * 5}) = ${b * 20}`)} dollars. For ${m('h - 1')} additional hours the total is ${m(c[0])}.`; chk = (h) => a * 6 + b * 20 * (h - 1); }
  else { const w = r.pick([3, 4, 5]); stem = `A moving company charges ${money(a * 10)} for the first ${w} miles of a move and ${money(b)} for each additional mile. Which expression gives the total charge, in dollars, for a move of ${m('d')} miles, where ${m('d')} is a whole number greater than ${w}?`;
    c = [`${a * 10} + ${b}(d - ${w})`, `${a * 10} + ${b}d`, `${a * 10}d + ${b}(d - ${w})`, `${a * 10} + ${b * w}(d - 1)`]; ex = `The first ${w} miles cost ${money(a * 10)} in total, and each of the remaining ${m(`d - ${w}`)} miles costs ${money(b)}, so the charge is ${m(c[0])}.`; chk = (d) => a * 10 + b * (d - w); }
  const rhs = (s) => s.includes('=') ? s.split('=')[1] : s;
  return { stem: `<p>${stem}</p>`, choices: c.map(m), explanation: ex,
    verify: () => [2, 3, 7].every((h) => close(texEval(rhs(c[0]), { h, d: h + 5 }), chk(v % 3 === 2 ? h + 5 : h))) && !close(texEval(rhs(c[1]), { h: 3, d: 8 }), chk(v % 3 === 2 ? 8 : 3)) };
});

module.exports = out;
