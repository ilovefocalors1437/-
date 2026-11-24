'use strict';
const L = require('./lib');
const { pn, cv, m, num, poly, lin, quad, F, fr, need, assert, spr, numCh, eqHolds, texEval, close, sameExpr, money, ptable, plane, chart, texInt, commas, valOf } = L;

const SK = {
  eq: 'Equivalent expressions',
  ne: 'Nonlinear equations in one variable and systems of equations in two variables',
  nf: 'Nonlinear functions',
};
const out = [];
function def(tpl, diff, type, n, skill, gen) { out.push({ tpl: 'adv-' + tpl, domain: 'advanced', diff, type, n, skill, gen }); }
const isInt = Number.isInteger;
const pt = (a, b) => m(`(${num(a)}, ${num(b)})`);
// expression choices: first must be equivalent to target, others must not
function exprCh(target, list, vars = ['x']) {
  need(L.distinct(list), 'expr dup');
  assert(sameExpr(target, list[0], vars), 'correct choice not equivalent: ' + target + ' vs ' + list[0]);
  need(list.slice(1).every((d) => !sameExpr(target, d, vars)), 'distractor equivalent');
  return { choices: list.map((s) => m(s)), verify: () => sameExpr(target, list[0], vars) && list.slice(1).every((d) => !sameExpr(target, d, vars)) };
}
function simpRad(n) { let o = 1, i = n; for (let k = 2; k * k <= i; k++) while (i % (k * k) === 0) { i /= k * k; o *= k; } return [o, i]; }
function radTex(n) { const [o, i] = simpRad(n); if (i === 1) return String(o); return (o === 1 ? '' : o) + `\\sqrt{${i}}`; }

/* ============================ EASY ============================ */
def('expand-binom', 1, 'mcq', 4, SK.eq, (r, v) => {
  if (v % 3 === 1) {
    const a = r.int(2, 5), b = r.nz(-7, 7), c = r.nz(-7, 7); need(a * c + b !== 0);
    const t = `(${lin(a, b)})(${lin(1, c)})`;
    return { stem: `<p>Which expression is equivalent to ${m(t)}?</p>`, ...exprCh(t, [quad(a, a * c + b, b * c), quad(a, b + c, b * c), quad(a, a * c, b * c), quad(a, a * c + b, b + c)]),
      explanation: `Use the distributive property: ${m(`${a}x(${lin(1, c)}) ${b > 0 ? '+' : '-'} ${Math.abs(b)}(${lin(1, c)}) = ${poly([[a, 'x^2'], [a * c, 'x'], [b, 'x'], [b * c, '']])}`)}, which combines to ${m(quad(a, a * c + b, b * c))}.` };
  }
  if (v % 3 === 2) {
    const a = r.nz(-6, 6), b = r.nz(-6, 6), k = r.nz(-5, 5); need(a + b - k !== 0 && a !== b);
    const t = `(${lin(1, a)})(${lin(1, b)}) ${k > 0 ? '-' : '+'} ${cv(Math.abs(k), 'x')}`;
    return { stem: `<p>Which of the following is equivalent to ${m(t)}?</p>`, ...exprCh(t, [quad(1, a + b - k, a * b), quad(1, a + b + k, a * b), quad(1, a + b - k, a + b), quad(1, -k, a * b)]),
      explanation: `${m(`(${lin(1, a)})(${lin(1, b)}) = ${quad(1, a + b, a * b)}`)}. Then ${k > 0 ? 'subtracting' : 'adding'} ${m(cv(Math.abs(k), 'x'))} gives ${m(quad(1, a + b - k, a * b))}.` };
  }
  const a = r.nz(-9, 9), b = r.nz(-9, 9); need(a + b !== 0 && a !== b && a * b !== a + b);
  const t = `(${lin(1, a)})(${lin(1, b)})`;
  return { stem: `<p>Which expression is equivalent to ${m(t)}?</p>`, ...exprCh(t, [quad(1, a + b, a * b), quad(1, 0, a * b), quad(1, a * b, a + b), quad(1, a + b, -a * b)]),
    explanation: `${m(`${t} = x^2 ${b > 0 ? '+' : '-'} ${cv(Math.abs(b), 'x')} ${a > 0 ? '+' : '-'} ${cv(Math.abs(a), 'x')} ${a * b > 0 ? '+' : '-'} ${Math.abs(a * b)} = ${quad(1, a + b, a * b)}`)}.` };
});

def('combine-poly', 1, 'mcq', 4, SK.eq, (r, v) => {
  if (v % 3 === 2) {
    const a = r.int(2, 6), b = r.nz(-9, 9), c = r.nz(-9, 9); need(a * b + c !== 0 && c !== 0);
    const t = `${a}x(${lin(2, b)}) ${c > 0 ? '+' : '-'} ${cv(Math.abs(c), 'x')}`;
    return { stem: `<p>Which expression is equivalent to ${m(t)}?</p>`, ...exprCh(t, [poly([[2 * a, 'x^2'], [a * b + c, 'x']]), poly([[2 * a, 'x^2'], [b + c, 'x']]), poly([[2 * a + c, 'x^2'], [a * b, 'x']]), poly([[2 * a, 'x'], [a * b + c, '']])]),
      explanation: `Distribute: ${m(`${a}x(${lin(2, b)}) = ${poly([[2 * a, 'x^2'], [a * b, 'x']])}`)}. Combining like terms gives ${m(poly([[2 * a, 'x^2'], [a * b + c, 'x']]))}.` };
  }
  const a = r.int(2, 9), b = r.nz(-9, 9), c = r.nz(-9, 9), d = r.int(1, 8), e = r.nz(-9, 9), f = r.nz(-9, 9);
  need(a !== d && b !== e && c !== f && e !== 0 && f !== 0);
  const vv = v % 3 === 1 ? 'y' : 'x';
  const P = quad(a, b, c, vv), Q2 = quad(d, e, f, vv);
  const t = `(${P}) - (${Q2})`;
  return { stem: `<p>Which expression is equivalent to ${m(t)}?</p>`, ...exprCh(t, [quad(a - d, b - e, c - f, vv), quad(a - d, b + e, c + f, vv), quad(a + d, b + e, c + f, vv), quad(a - d, b - e, c + f, vv)], [vv]),
    explanation: `Subtracting a polynomial means subtracting every term: ${m(`${quad(a, b, c, vv)} ${poly([[-d, vv + '^2'], [-e, vv], [-f, '']]).replace(/^-/, '- ').replace(/^(?!- )/, '+ ')}`)}. Combining like terms gives ${m(quad(a - d, b - e, c - f, vv))}.` };
});

def('eval-quad', 1, 'spr', 3, SK.nf, (r, v) => {
  if (v % 3 === 2) {
    const vv = r.pick([48, 56, 64, 80]), h0 = r.pick([0, 5, 6, 10]), t = r.int(1, 3);
    const h = -16 * t * t + vv * t + h0; need(h > 0);
    const f = poly([[-16, 't^2'], [vv, 't'], [h0, '']]);
    return { stem: `<p>A ball is thrown upward. Its height above the ground, in feet, ${m('t')} seconds after it is thrown is given by ${m(`h(t) = ${f}`)}. What is the height of the ball, in feet, ${t} second${t > 1 ? 's' : ''} after it is thrown?</p>`, answer: spr(h),
      explanation: `${m(`h(${t}) = -16(${t})^2 + ${vv}(${t})${h0 ? ' + ' + h0 : ''} = ${-16 * t * t} + ${vv * t}${h0 ? ' + ' + h0 : ''} = ${h}`)}.`, verify: () => close(texEval(f, { t }), h) };
  }
  const a = r.nz(-4, 5), b = r.nz(-9, 9), c = r.nz(-12, 12), k = r.nz(-5, 4); need(Math.abs(a) > 0);
  const f = quad(a, b, c);
  const val = a * k * k + b * k + c;
  const name = v % 3 === 0 ? 'f' : 'g';
  return { stem: `<p>The function ${m(name)} is defined by ${m(`${name}(x) = ${f}`)}. What is the value of ${m(`${name}(${k})`)}?</p>`, answer: spr(val),
    explanation: `${m(`${name}(${k}) = ${a === 1 ? '' : a === -1 ? '-' : a}(${k})^2 ${b > 0 ? '+' : '-'} ${Math.abs(b)}(${k}) ${c > 0 ? '+' : '-'} ${Math.abs(c)} = ${a * k * k} ${b * k >= 0 ? '+' : '-'} ${Math.abs(b * k)} ${c > 0 ? '+' : '-'} ${Math.abs(c)} = ${val}`)}. Note that ${m(`(${k})^2 = ${k * k}`)}.`, verify: () => close(texEval(f, { x: k }), val) };
});

def('exp-eval', 1, 'mcq', 4, SK.nf, (r, v) => {
  const a = r.int(2, 9), b = r.int(2, 4), k = r.int(2, 4); need(a !== b);
  const val = a * Math.pow(b, k);
  const ft = `${a}(${b})^{x}`;
  const vals = [val, Math.pow(a * b, k), a * b * k, a + Math.pow(b, k)]; need(new Set(vals).size === 4);
  const name = ['f', 'g', 'p'][v % 3];
  const stem = v % 3 === 2 ? `<p>The number of bacteria in a sample ${m('x')} hours after an experiment began is modeled by ${m(`p(x) = ${a * 100}(${b})^{x}`)}. According to the model, how many bacteria are in the sample ${k} hours after the experiment began?</p>`
    : `<p>The function ${m(name)} is defined by ${m(`${name}(x) = ${ft}`)}. What is the value of ${m(`${name}(${k})`)}?</p>`;
  const sc = v % 3 === 2 ? 100 : 1;
  return { stem, ...numCh(vals.map((z) => z * sc), (z) => m(texInt(z))),
    explanation: `Substitute ${m(k)} for ${m('x')}: ${m(`${a * sc}(${b})^{${k}} = ${a * sc}(${Math.pow(b, k)}) = ${texInt(val * sc)}`)}. Evaluate the power before multiplying.`, verify: () => close(texEval(`${a * sc}(${b})^{${k}}`), val * sc) };
});

def('sqrt-solve', 1, 'spr', 3, SK.ne, (r, v) => {
  let eq, x, ex;
  if (v % 3 === 0) { x = r.int(3, 15); const c = r.int(1, 30); eq = `x^2 - ${x * x - c} = ${c}`; ex = `Add ${x * x - c} to each side: ${m(`x^2 = ${x * x}`)}. The positive solution is ${m(`x = ${x}`)}.`; }
  else if (v % 3 === 1) { const a = r.int(2, 6); x = r.int(2, 9); eq = `${a}x^2 = ${a * x * x}`; ex = `Divide by ${a}: ${m(`x^2 = ${x * x}`)}, so ${m(`x = \\pm ${x}`)}. The positive solution is ${x}.`; }
  else { const h = r.nz(-6, 6), d = r.int(2, 9); x = h + d; need(h - d < 0 || true); eq = `(x ${h > 0 ? '-' : '+'} ${Math.abs(h)})^2 = ${d * d}`; ex = `Take square roots: ${m(`x ${h > 0 ? '-' : '+'} ${Math.abs(h)} = \\pm ${d}`)}, so ${m(`x = ${h + d}`)} or ${m(`x = ${h - d}`)}. The greater solution is ${h + d}.`; need(x > 0); }
  const q = v % 3 === 2 && x - 2 * (x - (x - 0)) > 0 ? '' : '';
  const ask = v % 3 === 2 ? 'What is the greatest solution to the given equation?' : `What is the positive solution to the given equation?`;
  return { stem: `<p>${m(eq)}</p><p>${ask}${q}</p>`, answer: spr(x), explanation: ex, verify: () => eqHolds(eq, { x }) };
});

def('factor-trinomial', 1, 'mcq', 4, SK.eq, (r, v) => {
  const a = r.nz(-9, 9), b = r.nz(-9, 9); need(a !== b && a !== -b && a + b !== 0);
  const vv = ['x', 'n', 'x'][v % 3];
  const t = quad(1, a + b, a * b, vv);
  const B = (k) => `(${lin(1, k, vv)})`;
  return { stem: `<p>Which expression is equivalent to ${m(t)}?</p>`, ...exprCh(t, [B(a) + B(b), B(-a) + B(-b), B(a) + B(-b), B(a + b) + B(a * b === 0 ? 1 : 1)].map((s, i) => (i === 3 ? `(${lin(1, a * b, vv)})(${lin(1, 1, vv)})` : s)), [vv]),
    explanation: `Find two numbers whose product is ${a * b} and whose sum is ${a + b}: ${m(a)} and ${m(b)}. So ${m(`${t} = ${B(a)}${B(b)}`)}.` };
});

def('exponent-rules', 1, 'mcq', 4, SK.eq, (r, v) => {
  if (v % 3 === 0) { const a = r.int(2, 6), b = r.int(2, 6), p = r.int(2, 6), q = r.int(2, 6); need(a !== b && p !== q && a * b !== a + b);
    const t = `(${a}x^{${p}})(${b}x^{${q}})`;
    return { stem: `<p>Which expression is equivalent to ${m(t)}?</p>`, ...exprCh(t, [`${a * b}x^{${p + q}}`, `${a * b}x^{${p * q}}`, `${a + b}x^{${p + q}}`, `${a + b}x^{${p * q}}`]),
      explanation: `Multiply the coefficients and add the exponents: ${m(`${a}\\cdot${b} = ${a * b}`)} and ${m(`x^{${p}}\\cdot x^{${q}} = x^{${p + q}}`)}.` }; }
  if (v % 3 === 1) { const a = r.int(2, 4), p = r.int(2, 5), q = r.int(2, 4);
    const t = `(${a}x^{${p}})^{${q}}`;
    return { stem: `<p>Which expression is equivalent to ${m(t)}?</p>`, ...exprCh(t, [`${Math.pow(a, q)}x^{${p * q}}`, `${a * q}x^{${p * q}}`, `${a}x^{${p * q}}`, `${Math.pow(a, q)}x^{${p + q}}`].filter((s, i, A) => true)),
      explanation: `Raise each factor to the power ${q}: ${m(`${a}^{${q}} = ${Math.pow(a, q)}`)} and ${m(`(x^{${p}})^{${q}} = x^{${p * q}}`)}.` }; }
  const a = r.int(2, 5) * r.int(2, 4), d = r.pick([2, 3, 4]), p = r.int(6, 10), q = r.int(2, 4); need(a % d === 0 && a / d !== 1 && p - q !== p / q);
  const t = `\\frac{${a}x^{${p}}}{${d}x^{${q}}}`;
  return { stem: `<p>For ${m('x \\ne 0')}, which expression is equivalent to ${m(t)}?</p>`, ...exprCh(t, [`${a / d}x^{${p - q}}`, `${a / d}x^{${isInt(p / q) ? p / q : p + q}}`, `${a - d}x^{${p - q}}`, `${a / d}x^{${p + q}}`]),
    explanation: `Divide the coefficients and subtract the exponents: ${m(`\\frac{${a}}{${d}} = ${a / d}`)} and ${m(`\\frac{x^{${p}}}{x^{${q}}} = x^{${p - q}}`)}.` };
});

def('exp-interpret', 1, 'mcq', 4, SK.nf, (r, v) => {
  const C = [
    () => { const P = r.pick([500, 800, 1200]), g = r.pick([3, 4, 5, 6]); return { intro: `The function ${m(`P(t) = ${texInt(P)}(1.0${g})^{t}`)} models the population of a town, in people, ${m('t')} years after 2010.`, ask: texInt(P),
      c: ['The population of the town in 2010', `The increase in the population each year`, `The population of the town ${g} years after 2010`, 'The maximum population of the town'], e: `When ${m('t = 0')} (the year 2010), ${m(`P(0) = ${texInt(P)}(1.0${g})^{0} = ${texInt(P)}`)}. So ${texInt(P)} is the population in 2010.` }; },
    () => { const P = r.pick([18000, 24000, 30000]), d = r.pick([12, 15, 20]); return { intro: `The value of a car, in dollars, ${m('t')} years after it was purchased is modeled by ${m(`V(t) = ${texInt(P)}(${(1 - d / 100).toFixed(2)})^{t}`)}.`, ask: (1 - d / 100).toFixed(2),
      c: [`Each year, the value of the car is ${100 - d}% of its value the previous year.`, `Each year, the value of the car decreases by ${100 - d}%.`, `Each year, the value of the car decreases by $${commas(Math.round(P * (1 - d / 100)))}.`, `The value of the car when it was purchased`], e: `In an exponential model ${m('a(b)^{t}')}, the base ${m('b')} is the factor by which the value is multiplied each year. Multiplying by ${(1 - d / 100).toFixed(2)} means each year's value is ${100 - d}% of the previous year's (a decrease of ${d}%).` }; },
    () => { const a = r.pick([40, 60, 75]), k = r.pick([3, 4, 5]); return { intro: `A biologist models the number of cells in a culture ${m('h')} hours after observation began with ${m(`C(h) = ${a}(2)^{h/${k}}`)}.`, ask: String(k),
      c: [`The number of hours it takes for the number of cells to double`, `The number of cells when observation began`, `The number of times the cells double each hour`, `The number of cells after 1 hour`], e: `The exponent ${m(`\\frac{h}{${k}}`)} increases by 1 each time ${m('h')} increases by ${k}, so the number of cells doubles every ${k} hours.` }; },
    () => { const a = r.pick([200, 320, 450]), g = r.pick([8, 12, 15]); return { intro: `The number of subscribers to a newsletter ${m('m')} months after it launched is modeled by ${m(`S(m) = ${a}(${(1 + g / 100).toFixed(2)})^{m}`)}.`, ask: (1 + g / 100).toFixed(2),
      c: [`The number of subscribers increases by ${g}% each month.`, `The number of subscribers increases by ${g} each month.`, `The number of subscribers increases by ${100 + g}% each month.`, `The number of subscribers when the newsletter launched`], e: `Multiplying by ${m(`${(1 + g / 100).toFixed(2)} = 1 + ${(g / 100).toFixed(2)}`)} each month means the number of subscribers grows by ${g}% per month.` }; },
  ];
  const c = C[v % 4]();
  return { stem: `<p>${c.intro} What is the best interpretation of ${m(c.ask)} in this context?</p>`, choices: c.c, explanation: c.e };
});

def('parabola-read', 1, 'mcq', 4, SK.nf, (r, v) => {
  const r1 = r.int(-5, 1), r2 = r1 + r.int(2, 6), a = r.pick([1, -1]); need(r2 <= 5);
  const h = (r1 + r2) / 2; const k = a * (h - r1) * (h - r2); const c = a * r1 * r2;
  need(Math.abs(k) <= 8 && Math.abs(c) <= 8 && isInt(h));
  const f = (x) => a * (x - r1) * (x - r2);
  const svg = plane({ x: [-7, 7], y: [-9, 9], tick: 1, tickY: 2, items: [{ fn: f }] });
  if (v % 3 === 0) {
    return { stem: `<p>The graph of the quadratic function ${m('f')} is shown. What is the ${m('y')}-intercept of the graph of ${m('y = f(x)')}?</p>` + svg,
      choices: [pt(0, c), pt(c, 0), pt(0, k), pt(h, k)].map((s) => s), explanation: `The graph crosses the ${m('y')}-axis at ${pt(0, c)}.`,
      verify: () => close(f(0), c) && L.distinct([`${c}`, `${k}`]) && !(h === 0) };
  }
  if (v % 3 === 1) {
    need(r1 !== 0 && r2 !== 0 && -r1 !== r2);
    return { stem: `<p>The graph of ${m('y = f(x)')} is shown in the ${m('xy')}-plane. Which of the following are the ${m('x')}-intercepts of the graph?</p>` + svg,
      choices: [`${pt(r1, 0)} and ${pt(r2, 0)}`, `${pt(-r1, 0)} and ${pt(-r2, 0)}`, `${pt(0, r1)} and ${pt(0, r2)}`, `${pt(h, 0)} and ${pt(0, c)}`], explanation: `The graph crosses the ${m('x')}-axis at ${m(`x = ${r1}`)} and ${m(`x = ${r2}`)}, so the ${m('x')}-intercepts are ${pt(r1, 0)} and ${pt(r2, 0)}.`, verify: () => close(f(r1), 0) && close(f(r2), 0) };
  }
  need(h !== k && h !== 0);
  return { stem: `<p>The graph of the quadratic function ${m('f')} is shown. What is the ${a > 0 ? 'minimum' : 'maximum'} value of ${m('f(x)')}?</p>` + svg, ...numCh([k, h, c, -k]),
    explanation: `The vertex of the parabola is ${pt(h, k)}. Since the parabola opens ${a > 0 ? 'upward' : 'downward'}, the ${a > 0 ? 'minimum' : 'maximum'} value of ${m('f(x)')} is the ${m('y')}-coordinate of the vertex, ${m(k)}.`, verify: () => close(f(h), k) };
});

def('radical-eq', 1, 'mcq', 4, SK.ne, (r, v) => {
  let eq, x, ex, ds;
  if (v % 3 === 0) { const a = r.int(1, 9), s = r.int(2, 9); x = s * s; const b = s + a; ds = [s, (b + a) * (b + a), b * b - a]; eq = `\\sqrt{x} + ${a} = ${b}`; ex = `Subtract ${a}: ${m(`\\sqrt{x} = ${s}`)}. Squaring gives ${m(`x = ${x}`)}.`; }
  else if (v % 3 === 1) { const c = r.nz(-9, 9), d = r.int(2, 8); x = d * d - c; need(x > 0); ds = [d * d + c, d - c, d]; eq = `\\sqrt{x ${c > 0 ? '+' : '-'} ${Math.abs(c)}} = ${d}`; ex = `Square both sides: ${m(`x ${c > 0 ? '+' : '-'} ${Math.abs(c)} = ${d * d}`)}, so ${m(`x = ${x}`)}.`; }
  else { const k = r.int(2, 5), s = r.int(2, 7); x = s * s; ds = [s, k * k * s * s, k * s * s]; eq = `${k}\\sqrt{x} = ${k * s}`; ex = `Divide by ${k}: ${m(`\\sqrt{x} = ${s}`)}, so ${m(`x = ${x}`)}.`; }
  return { stem: `<p>${m(eq)}</p><p>What value of ${m('x')} satisfies the equation above?</p>`, ...numCh([x, ...ds]), explanation: ex, verify: () => eqHolds(eq, { x }) };
});

def('func-table', 1, 'mcq', 4, SK.nf, (r, v) => {
  const c = r.nz(-6, 6), a = r.pick([1, 2, 3]);
  const xs = [0, 1, 2, 3];
  let f, opts, ex;
  if (v % 3 === 0) { f = (x) => a * x * x + c; opts = [poly([[a, 'x^2'], [c, '']]), poly([[a, 'x'], [c, '']]), poly([[a + 1, 'x'], [c, '']]), poly([[a, 'x^2'], [-c, '']])]; ex = `Check each row: ${m(`f(2) = ${a === 1 ? '' : a}(2)^2 ${c > 0 ? '+' : '-'} ${Math.abs(c)} = ${f(2)}`)} and ${m(`f(3) = ${f(3)}`)}. Only ${m(`f(x) = ${opts[0]}`)} matches every row.`; }
  else if (v % 3 === 1) { const b = r.pick([2, 3]); f = (x) => a * Math.pow(b, x); opts = [`${a === 1 ? '' : a}(${b})^{x}`, poly([[a * (b - 1), 'x'], [a, '']]), `${a === 1 ? '' : a}x^{${b}}`, `${a * b}^{x}`]; ex = `Each time ${m('x')} increases by 1, ${m('f(x)')} is multiplied by ${b}, and ${m(`f(0) = ${a}`)}. So ${m(`f(x) = ${opts[0]}`)}.`; }
  else { f = (x) => (x - a) * (x - a) + c; opts = [`(x - ${a})^2 ${c > 0 ? '+' : '-'} ${Math.abs(c)}`, `(x + ${a})^2 ${c > 0 ? '+' : '-'} ${Math.abs(c)}`, `(x - ${a})^2 ${c > 0 ? '-' : '+'} ${Math.abs(c)}`, poly([[1, 'x^2'], [c, '']])]; ex = `Substituting ${m('x = 0')} into ${m(opts[0])} gives ${f(0)}, and the other rows also match. The table is symmetric about ${m(`x = ${a}`)}, where the minimum ${c} occurs.`; }
  const rows = xs.map((x) => [m(x), m(f(x))]);
  return { stem: `<p>The table shows several values of ${m('x')} and the corresponding values of ${m('f(x)')}.</p>` + ptable([m('x'), m('f(x)')], rows) + `<p>Which equation could define ${m('f')}?</p>`,
    choices: opts.map((o) => m(`f(x) = ${o}`)), explanation: ex,
    verify: () => L.distinct(opts) && xs.every((x) => close(texEval(opts[0], { x }), f(x))) && opts.slice(1).every((o) => xs.some((x) => !close(texEval(o, { x }), f(x)))) };
});

def('gcf', 1, 'mcq', 4, SK.eq, (r, v) => {
  const g = r.int(2, 6), p = r.int(1, 5), q = r.nz(-7, 7); need(L.gcd(p, Math.abs(q)) === 1 && p !== Math.abs(q));
  const vv = ['x', 'x', 'a'][v % 3];
  if (v % 3 === 1) {
    const t = poly([[g * p, 'x^3'], [g * q, 'x^2']]);
    return { stem: `<p>Which expression is equivalent to ${m(t)}?</p>`, ...exprCh(t, [`${g}x^2(${lin(p, q)})`, `${g}x(${poly([[p, 'x^2'], [q, '']])})`, `${g}x^2(${lin(p, g * q)})`, `${g}x^3(${lin(p, q)})`]),
      explanation: `The greatest common factor of the terms is ${m(`${g}x^2`)}. Factoring it out gives ${m(`${g}x^2(${lin(p, q)})`)}.` };
  }
  const t = poly([[g * p, vv + '^2'], [g * q, vv]]);
  return { stem: `<p>Which of the following is equivalent to ${m(t)}?</p>`, ...exprCh(t, [`${g}${vv}(${lin(p, q, vv)})`, `${g}${vv}(${lin(p, g * q, vv)})`, `${g}(${poly([[p, vv + '^2'], [q, '']])})`, `${vv}(${lin(p, q, vv)})`], [vv]),
    explanation: `Each term has a factor of ${m(`${g}${vv}`)}: ${m(`${t} = ${g}${vv}(${lin(p, q, vv)})`)}.` };
});

def('abs-eq', 1, 'mcq', 4, SK.ne, (r, v) => {
  const a = r.nz(-8, 8), b = r.int(2, 9);
  const s1 = a + b, s2 = a - b; need(s1 !== 0 && s2 !== 0 && -s1 !== s2);
  const eq = `|x ${a > 0 ? '-' : '+'} ${Math.abs(a)}| = ${b}`;
  if (v % 3 === 2) {
    const vals = [2 * a, 2 * b, 0, s1]; need(new Set(vals).size === 4);
    return { stem: `<p>${m(eq)}</p><p>What is the sum of the solutions to the given equation?</p>`, ...numCh(vals),
      explanation: `${m(`x ${a > 0 ? '-' : '+'} ${Math.abs(a)} = ${b}`)} or ${m(`x ${a > 0 ? '-' : '+'} ${Math.abs(a)} = -${b}`)}, so ${m(`x = ${s1}`)} or ${m(`x = ${s2}`)}. Their sum is ${m(2 * a)}.`, verify: () => close(Math.abs(s1 - a), b) && close(Math.abs(s2 - a), b) };
  }
  const c = [`${m(s1)} and ${m(s2)}`, `${m(-s1)} and ${m(-s2)}`, `${m(s1)} only`, `${m(b)} and ${m(-b)}`];
  need(L.distinct(c) && !(new Set([s1, s2, b, -b]).size === 2));
  return { stem: `<p>${m(eq)}</p><p>What are all the solutions to the given equation?</p>`, choices: c,
    explanation: `The expression inside the absolute value must equal ${b} or ${m(-b)}. So ${m(`x = ${a} + ${b} = ${s1}`)} or ${m(`x = ${a} - ${b} = ${s2}`)}.`, verify: () => close(Math.abs(s1 - a), b) && close(Math.abs(s2 - a), b) };
});

def('exp-solve', 1, 'spr', 3, SK.ne, (r, v) => {
  let eq, x, ex;
  if (v % 3 === 0) { const b = r.pick([2, 3, 5]); x = r.int(2, b === 2 ? 7 : 4); eq = `${b}^{x} = ${Math.pow(b, x)}`; ex = `Write ${Math.pow(b, x)} as a power of ${b}: ${m(`${Math.pow(b, x)} = ${b}^{${x}}`)}. Since the bases are equal, the exponents are equal, so ${m(`x = ${x}`)}.`; }
  else if (v % 3 === 1) { const b = r.pick([2, 3]), n = r.int(3, b === 2 ? 6 : 5), c = r.int(1, 2); x = n - c; eq = `${b}^{x + ${c}} = ${Math.pow(b, n)}`; ex = `${m(`${Math.pow(b, n)} = ${b}^{${n}}`)}, so ${m(`x + ${c} = ${n}`)} and ${m(`x = ${x}`)}.`; }
  else { const b = r.pick([2, 3]); const n = r.pick([2, 3]); const B = Math.pow(b, n); x = r.int(2, 3); eq = `${B}^{x} = ${b}^{${n * x + 0}}`; ex = `Write ${B} as ${m(`${b}^{${n}}`)}: ${m(`${b}^{${n}x} = ${b}^{${n * x}}`)}, so ${m(`${n}x = ${n * x}`)} and ${m(`x = ${x}`)}.`; }
  return { stem: `<p>${m(eq)}</p><p>What value of ${m('x')} satisfies the given equation?</p>`, answer: spr(x), explanation: ex, verify: () => eqHolds(eq, { x }) };
});

/* ============================ MEDIUM ============================ */
def('square-binom', 2, 'mcq', 4, SK.eq, (r, v) => {
  const a = r.int(2, 7), b = r.nz(-9, 9);
  const vv = v % 3 === 2 ? 'y' : 'x';
  if (v % 3 === 1) {
    const t = `(${lin(a, b, vv)})^2 - ${a * a}x^2`;
    return { stem: `<p>Which expression is equivalent to ${m(t)}?</p>`, ...exprCh(t, [lin(2 * a * b, b * b), poly([[b * b, '']]), lin(a * b, b * b), lin(2 * a * b, -b * b)]),
      explanation: `${m(`(${lin(a, b)})^2 = ${quad(a * a, 2 * a * b, b * b)}`)}. Subtracting ${m(`${a * a}x^2`)} leaves ${m(lin(2 * a * b, b * b))}.` };
  }
  const t = `(${lin(a, b, vv)})^2`;
  return { stem: `<p>Which expression is equivalent to ${m(t)}?</p>`, ...exprCh(t, [quad(a * a, 2 * a * b, b * b, vv), quad(a * a, 0, b * b, vv), quad(a * a, a * b, b * b, vv), quad(a, 2 * a * b, b * b, vv)], [vv]),
    explanation: `${m(`(p + q)^2 = p^2 + 2pq + q^2`)}. With ${m(`p = ${a}${vv}`)} and ${m(`q = ${b}`)}: ${m(`${a * a}${vv}^2 ${2 * a * b > 0 ? '+' : '-'} ${Math.abs(2 * a * b)}${vv} + ${b * b}`)}.` };
});

def('quad-factor-solve', 2, 'mcq', 4, SK.ne, (r, v) => {
  let eq, ans, ex, sols, ds;
  if (v % 3 === 0) { const p = r.int(2, 12), q = r.nz(-9, 9); need(p !== q && p !== -q && p > q);
    ds = [q, -p, -q]; eq = `${quad(1, -(p + q), p * q)} = 0`; ans = p; sols = [p, q]; ex = `Factor: ${m(`(x - ${p})(${lin(1, -q)}) = 0`)}, so ${m(`x = ${p}`)} or ${m(`x = ${q}`)}. The greater solution is ${p}.`; }
  else if (v % 3 === 1) { const a = r.pick([2, 3, 5]), p = r.nz(-6, 6), q = r.int(1, 7); need(L.gcd(q, a) === 1 && q !== a);
    // (a x - q)(x - p) = 0 -> roots q/a and p
    eq = `${quad(a, -(a * p + q), p * q)} = 0`; const s = F(q, a); need(s.val() > p); ans = s; ds = [p, F(-q, a), q]; sols = [s.val(), p];
    ex = `Factor: ${m(`(${lin(a, -q)})(${lin(1, -p)}) = 0`)}. The solutions are ${m(`x = ${s.tex()}`)} and ${m(`x = ${p}`)}; the greater is ${m(s.tex())}.`; }
  else { const p = r.int(4, 12), k = r.int(1, 5); const c = p * (p - k); eq = `x(x - ${k}) = ${c}`; ans = p; ds = [k - p, -p, p + k]; sols = [p, k - p];
    ex = `Expand and set equal to zero: ${m(`${quad(1, -k, -c)} = 0`)}, which factors as ${m(`(x - ${p})(x + ${p - k}) = 0`)}. The positive solution is ${p}.`; }
  const ask = v % 3 === 2 ? 'What is the positive solution to the given equation?' : 'What is the greater of the two solutions to the given equation?';
  return { stem: `<p>${m(eq)}</p><p>${ask}</p>`, ...numCh([ans, ...ds]), explanation: ex, verify: () => sols.every((s) => eqHolds(eq, { x: s })) };
});

def('quad-formula', 2, 'mcq', 4, SK.ne, (r, v) => {
  const p = r.nz(-6, 6), q = r.nz(-12, 12); const D = p * p - q; need(D > 1 && Math.sqrt(D) % 1 !== 0 && D < 80);
  const eq = `${quad(1, 2 * p, q)} = 0`;
  const R = radTex(D);
  const c = [`${-p} \\pm ${R}`, `${p} \\pm ${R}`, `${-p} \\pm ${radTex(p * p + q > 1 ? p * p + q : D + 4)}`, `${-2 * p} \\pm ${R}`];
  need(L.distinct(c) && p * p + q !== D);
  return { stem: `<p>${m(eq)}</p><p>What are the solutions to the given equation?</p>`, choices: c.map((s) => m('x = ' + s)),
    explanation: `By the quadratic formula, ${m(`x = \\frac{${-2 * p} \\pm \\sqrt{${4 * p * p} - 4(${q})}}{2} = \\frac{${-2 * p} \\pm \\sqrt{${4 * D}}}{2} = ${-p} \\pm ${R}`)}. (Completing the square, ${m(`(x ${p > 0 ? '+' : '-'} ${Math.abs(p)})^2 = ${D}`)}, gives the same result.)`,
    verify: () => { const x = -p + Math.sqrt(D); return eqHolds(eq, { x }) && eqHolds(eq, { x: -p - Math.sqrt(D) }) && !eqHolds(eq, { x: p + Math.sqrt(D) }); } };
});

def('vertex', 2, 'mcq', 4, SK.nf, (r, v) => {
  if (v % 3 === 0) { const a = r.int(2, 5), h = r.nz(-7, 7), k = r.nz(-9, 9); need(h !== k && h !== -k);
    const f = `${a}(x ${h > 0 ? '-' : '+'} ${Math.abs(h)})^2 ${k > 0 ? '+' : '-'} ${Math.abs(k)}`;
    return { stem: `<p>The function ${m('f')} is defined by ${m(`f(x) = ${f}`)}. What is the minimum value of ${m('f(x)')}?</p>`, ...numCh([k, h, -k, a]),
      explanation: `${m(`${a}(x ${h > 0 ? '-' : '+'} ${Math.abs(h)})^2 \\ge 0`)}, with equality at ${m(`x = ${h}`)}. So the minimum value of ${m('f(x)')} is ${m(k)}.`, verify: () => close(texEval(f, { x: h }), k) && texEval(f, { x: h + 1 }) > k }; }
  if (v % 3 === 1) { const h = r.nz(-6, 6), k = r.nz(-9, 9), a = r.pick([1, 2, -1]); const b = -2 * a * h, c = a * h * h + k;
    const f = quad(a, b, c);
    const choices = [pt(h, k), pt(-h, k), pt(h, c), pt(-h, a * h * h + 2 * a * h * h + k)];
    need(L.distinct(choices));
    return { stem: `<p>The graph of ${m(`y = ${f}`)} is a parabola in the ${m('xy')}-plane. What are the coordinates of the vertex of the parabola?</p>`, choices,
      explanation: `The ${m('x')}-coordinate of the vertex is ${m(`-\\frac{b}{2a} = -\\frac{${b}}{2(${a})} = ${h}`)}. Then ${m(`y = ${a === 1 ? '' : a === -1 ? '-' : a}(${h})^2 ${b >= 0 ? '+' : '-'} ${Math.abs(b)}(${h}) ${c >= 0 ? '+' : '-'} ${Math.abs(c)} = ${k}`)}.`, verify: () => close(texEval(f, { x: h }), k) && close(texEval(f, { x: h + 1 }), texEval(f, { x: h - 1 })) }; }
  const p = r.nz(-8, 8), q = r.nz(-8, 8); need((p + q) % 2 === 0 && p !== q);
  const h = (p + q) / 2, k = (h - p) * (h - q);
  const f = `(${lin(1, -p)})(${lin(1, -q)})`;
  return { stem: `<p>The function ${m('g')} is defined by ${m(`g(x) = ${f}`)}. What is the minimum value of ${m('g(x)')}?</p>`, ...numCh([k, h, p * q, -k]),
    explanation: `The zeros of ${m('g')} are ${p} and ${q}, so the vertex is halfway between them, at ${m(`x = ${h}`)}. The minimum value is ${m(`g(${h}) = (${h - p})(${h - q}) = ${k}`)}.`, verify: () => close(texEval(f, { x: h }), k) && texEval(f, { x: h + 0.5 }) > k };
});

def('exp-percent', 2, 'mcq', 4, SK.nf, (r, v) => {
  if (v % 3 === 0) { const P = r.pick([1200, 2500, 4000]), d = r.pick([12, 15, 18, 25]); const b = (100 - d) / 100;
    return { stem: `<p>The function ${m(`f(t) = ${texInt(P)}(${b})^{t}`)} models the value, in dollars, of a laptop ${m('t')} years after it was purchased. According to the model, the value of the laptop decreases by what percent each year?</p>`,
      ...numCh([d, 100 - d, d / 10, b], (z) => z + '%'), explanation: `Each year the value is multiplied by ${b}, which is ${100 - d}% of the previous value. So it decreases by ${m(`100\\% - ${100 - d}\\% = ${d}\\%`)} each year.` }; }
  if (v % 3 === 1) { const P = r.pick([150, 300, 640]), g = r.pick([4, 6, 7, 9]);
    return { stem: `<p>The number of visitors to a website in week ${m('w')} is modeled by ${m(`V(w) = ${P}(1.0${g})^{w}`)}. According to the model, by what percent does the number of visitors increase each week?</p>`,
      ...numCh([g, 100 + g, g / 10, 10 + g], (z) => z + '%'), explanation: `Multiplying by ${m(`1.0${g} = 1 + 0.0${g}`)} each week is an increase of ${g}% per week.` }; }
  const P = r.pick([50, 80, 120]), g = r.pick([20, 30, 40, 50]);
  return { stem: `<p>A population of fish in a lake ${m('t')} years after a study began is modeled by ${m(`p(t) = ${P}(${(1 + g / 100).toFixed(1)})^{t}`)}. Which statement best describes how the population changes each year, according to the model?</p>`,
    choices: [`It increases by ${g}%.`, `It increases by ${(1 + g / 100).toFixed(1)}%.`, `It increases by ${P * g / 100} fish.`, `It increases by ${100 + g}%.`], explanation: `The base ${m((1 + g / 100).toFixed(1))} equals ${m(`1 + ${(g / 100).toFixed(1)}`)}, so the population is multiplied by ${(1 + g / 100).toFixed(1)} each year, an increase of ${g}%.` };
});

def('exp-model', 2, 'mcq', 4, SK.nf, (r, v) => {
  if (v % 3 === 0) { const a = r.pick([200, 400, 500]), k = r.pick([3, 4, 6]);
    const c = [`P(t) = ${a}(2)^{t/${k}}`, `P(t) = ${a}(2)^{${k}t}`, `P(t) = ${a}(${k})^{t/2}`, `P(t) = ${a} + 2^{t/${k}}`];
    return { stem: `<p>A colony of ${a} bacteria doubles in size every ${k} hours. Which function gives the number of bacteria, ${m('P(t)')}, in the colony ${m('t')} hours from now?</p>`, choices: c.map(m),
      explanation: `The number of doublings in ${m('t')} hours is ${m(`\\frac{t}{${k}}`)}, so ${m(`P(t) = ${a}(2)^{t/${k}}`)}. Check: ${m(`P(${k}) = ${2 * a}`)}.`, verify: () => close(texEval(c[0].split('=')[1], { t: k }), 2 * a) && !close(texEval(c[1].split('=')[1], { t: k }), 2 * a) }; }
  if (v % 3 === 1) { const a = r.pick([20000, 25000, 32000]), d = r.pick([10, 15, 20]);
    const b = ((100 - d) / 100).toFixed(2);
    const c = [`V(t) = ${texInt(a)}(${b})^{t}`, `V(t) = ${texInt(a)}(0.${d})^{t}`, `V(t) = ${texInt(a)}(${(1 + d / 100).toFixed(2)})^{t}`, `V(t) = ${texInt(a)}(1 - ${d}t)`];
    return { stem: `<p>A machine was purchased for ${money(a)}. Its value decreases by ${d}% each year. Which function gives the value, in dollars, of the machine ${m('t')} years after it was purchased?</p>`, choices: c.map(m),
      explanation: `Losing ${d}% each year leaves ${100 - d}% of the value, so the value is multiplied by ${b} each year: ${m(c[0])}.`, verify: () => close(texEval(c[0].split('=')[1], { t: 1 }), a * (100 - d) / 100) }; }
  const a = r.pick([80, 120, 200]), k = r.pick([5, 6, 8]);
  const c = [`A(t) = ${a}\\left(\\frac{1}{2}\\right)^{t/${k}}`, `A(t) = ${a}\\left(\\frac{1}{2}\\right)^{${k}t}`, `A(t) = \\frac{1}{2}(${a})^{t/${k}}`, `A(t) = ${a} - \\frac{1}{2}\\left(\\frac{t}{${k}}\\right)`];
  return { stem: `<p>A radioactive substance has a half-life of ${k} hours, which means that half of the substance decays every ${k} hours. A sample initially contains ${a} milligrams of the substance. Which function gives the amount, in milligrams, of the substance remaining after ${m('t')} hours?</p>`, choices: c.map(m),
    explanation: `Every ${k} hours the amount is multiplied by ${m('\\frac{1}{2}')}, and ${m(`\\frac{t}{${k}}`)} counts how many half-lives have passed. So ${m(c[0])}.`, verify: () => close(texEval(c[0].split('=')[1], { t: 2 * k }), a / 4) };
});

def('nonlin-system', 2, 'mcq', 4, SK.ne, (r, v) => {
  if (v % 3 === 0) { const x = r.int(2, 9), b = r.nz(-9, 15); const a = x * x - b;
    const e1 = `y = x^2 ${a > 0 ? '-' : '+'} ${Math.abs(a)}`, e2 = `y = ${b}`; need(a !== 0);
    return { stem: `<p>${m(e1)}<br>${m(e2)}</p><p>If ${m('(x, y)')} is a solution to the system of equations and ${m('x > 0')}, what is the value of ${m('x')}?</p>`, ...numCh([x, x * x, -x, b]),
      explanation: `Substitute ${b} for ${m('y')}: ${m(`${b} = x^2 ${a > 0 ? '-' : '+'} ${Math.abs(a)}`)}, so ${m(`x^2 = ${x * x}`)} and the positive value is ${m(`x = ${x}`)}.`, verify: () => eqHolds(e1, { x, y: b }) }; }
  if (v % 3 === 1) { const p = r.int(1, 6), q = r.int(-6, -1), mm = r.nz(-3, 4), k = r.nz(-5, 5);
    // x^2 + bx + c = mx + k with roots p, q => x^2 + (b - m)x + (c - k) = (x-p)(x-q)
    const b = mm - (p + q), c = k + p * q;
    const e1 = `y = ${quad(1, b, c)}`, e2 = `y = ${lin(mm, k)}`;
    return { stem: `<p>${m(e1)}<br>${m(e2)}</p><p>The graphs of the equations in the given system intersect at two points. What is the ${m('x')}-coordinate of the intersection point that has a positive ${m('x')}-coordinate?</p>`, ...numCh([p, q, -p, -q]),
      explanation: `Set the expressions equal: ${m(`${quad(1, b, c)} = ${lin(mm, k)}`)}, so ${m(`${quad(1, b - mm, c - k)} = 0`)}, which factors as ${m(`(x - ${p})(x + ${-q}) = 0`)}. The positive solution is ${m(`x = ${p}`)}.`, verify: () => eqHolds(`${quad(1, b, c)} = ${lin(mm, k)}`, { x: p }) && eqHolds(`${quad(1, b, c)} = ${lin(mm, k)}`, { x: q }) }; }
  const k = r.int(2, 5), x = r.int(2, 6); const y = k * x; const P = x * y;
  return { stem: `<p>${m(`y = ${k}x`)}<br>${m(`xy = ${P}`)}</p><p>If ${m('(x, y)')} is a solution to the given system and ${m('y > 0')}, what is the value of ${m('y')}?</p>`, ...numCh([y, x, x * x, 2 * y]),
    explanation: `Substitute: ${m(`x(${k}x) = ${P}`)}, so ${m(`x^2 = ${x * x}`)} and ${m(`x = \\pm ${x}`)}. Since ${m('y > 0')}, ${m(`x = ${x}`)} and ${m(`y = ${y}`)}.`, verify: () => x * y === P };
});

def('rational-simplify', 2, 'mcq', 4, SK.eq, (r, v) => {
  if (v % 3 === 0) { const a = r.int(2, 9); const t = `\\frac{x^2 - ${a * a}}{x + ${a}}`;
    return { stem: `<p>For ${m(`x \\ne -${a}`)}, which expression is equivalent to ${m(t)}?</p>`, ...exprCh(t, [`x - ${a}`, `x + ${a}`, `x - ${a * a}`, `x^2 - ${a}`]),
      explanation: `Factor the numerator as a difference of squares: ${m(`x^2 - ${a * a} = (x + ${a})(x - ${a})`)}. Canceling ${m(`x + ${a}`)} leaves ${m(`x - ${a}`)}.` }; }
  if (v % 3 === 1) { const p = r.nz(-6, 6), q = r.nz(-6, 6); need(p !== q);
    const t = `\\frac{${quad(1, p + q, p * q)}}{${lin(1, p)}}`;
    return { stem: `<p>Which expression is equivalent to ${m(t)} for ${m(`x \\ne ${-p}`)}?</p>`, ...exprCh(t, [lin(1, q), lin(1, -q), lin(1, p * q), lin(1, p + q)]),
      explanation: `${m(`${quad(1, p + q, p * q)} = (${lin(1, p)})(${lin(1, q)})`)}, so the expression simplifies to ${m(lin(1, q))}.` }; }
  const a = r.int(1, 5), b = r.int(1, 5), c = r.int(1, 4); need(a !== b);
  // a/(x+c) + b/(x-c) = ((a+b)x + (b-a)c)/(x^2 - c^2)
  const t = `\\frac{${a}}{x + ${c}} + \\frac{${b}}{x - ${c}}`;
  return { stem: `<p>Which expression is equivalent to ${m(t)}, where ${m(`x \\ne ${c}`)} and ${m(`x \\ne -${c}`)}?</p>`,
    ...exprCh(t, [`\\frac{${lin(a + b, (b - a) * c)}}{x^2 - ${c * c}}`, `\\frac{${a + b}}{2x}`, `\\frac{${a + b}}{x^2 - ${c * c}}`, `\\frac{${lin(a + b, (a - b) * c)}}{x^2 - ${c * c}}`]),
    explanation: `Use the common denominator ${m(`(x + ${c})(x - ${c}) = x^2 - ${c * c}`)}: ${m(`\\frac{${a === 1 ? '' : a}(x - ${c}) + ${b === 1 ? '' : b}(x + ${c})}{x^2 - ${c * c}} = \\frac{${lin(a + b, (b - a) * c)}}{x^2 - ${c * c}}`)}.` };
});

def('transform-table', 2, 'spr', 3, SK.nf, (r, v) => {
  const xs = [-2, -1, 0, 1, 2, 3, 4];
  const vals = xs.map(() => r.int(-6, 9));
  const f = (x) => vals[xs.indexOf(x)];
  let stem, ans, ex;
  if (v % 3 === 0) { const s = r.int(1, 3), u = r.nz(-5, 5), k = r.pick(xs.map((x) => x + s).filter((x) => xs.includes(x - s))); ans = f(k - s) + u;
    stem = `The function ${m('g')} is defined by ${m(`g(x) = f(x - ${s}) ${u > 0 ? '+' : '-'} ${Math.abs(u)}`)}. What is the value of ${m(`g(${k})`)}?`;
    ex = `${m(`g(${k}) = f(${k} - ${s}) ${u > 0 ? '+' : '-'} ${Math.abs(u)} = f(${k - s}) ${u > 0 ? '+' : '-'} ${Math.abs(u)} = ${f(k - s)} ${u > 0 ? '+' : '-'} ${Math.abs(u)} = ${ans}`)}.`; }
  else if (v % 3 === 1) { const c = r.int(2, 3), k = r.pick([-1, 1, 2]); need(xs.includes(c * k)); const u = r.nz(-4, 4); ans = c * f(k) + u;
    stem = `The function ${m('h')} is defined by ${m(`h(x) = ${c}f(x) ${u > 0 ? '+' : '-'} ${Math.abs(u)}`)}. What is the value of ${m(`h(${k})`)}?`;
    ex = `${m(`h(${k}) = ${c}f(${k}) ${u > 0 ? '+' : '-'} ${Math.abs(u)} = ${c}(${f(k)}) ${u > 0 ? '+' : '-'} ${Math.abs(u)} = ${ans}`)}.`; }
  else { const k = r.pick([-2, -1, 1, 2]); need(xs.includes(-k)); const s = r.int(1, 2); need(xs.includes(-k + s)); ans = f(-k + s);
    stem = `The function ${m('p')} is defined by ${m(`p(x) = f(-x + ${s})`)}. What is the value of ${m(`p(${k})`)}?`;
    ex = `${m(`p(${k}) = f(-(${k}) + ${s}) = f(${-k + s}) = ${ans}`)}, read from the table.`; }
  const rows = xs.map((x) => [m(x), m(f(x))]);
  return { stem: `<p>The table shows some values of ${m('x')} and ${m('f(x)')} for the function ${m('f')}.</p>` + ptable([m('x'), m('f(x)')], rows) + `<p>${stem}</p>`, answer: spr(ans), explanation: ex, verify: () => isInt(ans) };
});

def('poly-zeros', 2, 'mcq', 4, SK.nf, (r, v) => {
  const a = r.int(1, 7), b = r.int(1, 7), c = r.pick([1, 3, 5, 7]); need(a !== b && c / 2 !== a && c / 2 !== b && c !== a && c !== b);
  const ft = `(x - ${a})(x + ${b})(2x - ${c})`;
  const ask = v % 3;
  let choices, ex, good;
  if (ask === 0) { choices = [pt(a, 0), pt(-a, 0), pt(b, 0), pt(c, 0)]; good = a; ex = `The ${m('x')}-intercepts occur where a factor equals 0: ${m(`x = ${a}`)}, ${m(`x = -${b}`)}, and ${m(`x = \\frac{${c}}{2}`)}. Of the choices, only ${pt(a, 0)} is an ${m('x')}-intercept.`; }
  else if (ask === 1) { choices = [pt(-b, 0), pt(b, 0), pt(-a, 0), pt(-c, 0)]; good = -b; ex = `Setting ${m(`x + ${b} = 0`)} gives ${m(`x = -${b}`)}, so ${pt(-b, 0)} is an ${m('x')}-intercept. The others are not zeros of the polynomial.`; }
  else { choices = [pt(F(c, 2), 0), pt(c, 0), pt(-c, 0), pt(F(-c, 2), 0)]; good = c / 2; ex = `Setting ${m(`2x - ${c} = 0`)} gives ${m(`x = \\frac{${c}}{2}`)}. (A common error is to use ${m(`x = ${c}`)}.)`; }
  return { stem: `<p>The function ${m('p')} is defined by ${m(`p(x) = ${ft}`)}. Which of the following is an ${m('x')}-intercept of the graph of ${m('y = p(x)')} in the ${m('xy')}-plane?</p>`, choices, explanation: ex,
    verify: () => close(texEval(ft, { x: good }), 0) };
});

def('radical-extraneous', 2, 'mcq', 4, SK.ne, (r, v) => {
  // sqrt(x + a) = x - b ; roots of (x - b)^2 = x + a ; choose valid root s (s >= b) and extraneous t (t < b)
  const b = r.int(-3, 4), s = b + r.int(1, 5), t = b - r.int(1, 5);
  // (x-b)^2 - (x+a) = (x - s)(x - t) => x^2 - (2b+1)x + b^2 - a = x^2 - (s+t)x + st
  need(s + t === 2 * b + 1 && t !== 0 && s !== 0); const a = b * b - s * t; need(s + a >= 0 && t + a >= 0);
  const eq = `\\sqrt{${lin(1, a)}} = ${lin(1, -b)}`;
  return { stem: `<p>${m(eq)}</p><p>What is the solution to the given equation?</p>`, ...numCh([s, t, -s, a]),
    explanation: `Square both sides: ${m(`${lin(1, a)} = ${quad(1, -2 * b, b * b)}`)}, so ${m(`${quad(1, -(s + t), s * t)} = 0`)} and ${m(`(${lin(1, -s)})(${lin(1, -t)}) = 0`)}. Checking: ${m(`x = ${t}`)} makes the right side ${t - b}, which is negative, so it is extraneous. The only solution is ${m(`x = ${s}`)}.`,
    verify: () => eqHolds(eq, { x: s }) && !eqHolds(eq, { x: t }) };
});

def('rational-exponent', 2, 'mcq', 4, SK.eq, (r, v) => {
  if (v % 3 === 0) { const n = r.pick([3, 4, 5]), p = r.int(2, 7); need(L.gcd(n, p) === 1 && p - n !== 1 && p - n !== 0);
    const t = `\\sqrt[${n}]{x^{${p}}}`;
    return { stem: `<p>Which expression is equivalent to ${m(t)}, where ${m('x > 0')}?</p>`, ...exprCh(t, [`x^{\\frac{${p}}{${n}}}`, `x^{\\frac{${n}}{${p}}}`, `x^{${p * n}}`, `x^{${p - n}}`]),
      explanation: `The ${m('n')}th root of ${m('x^p')} is ${m('x^{p/n}')}, so ${m(`${t} = x^{\\frac{${p}}{${n}}}`)}.` }; }
  if (v % 3 === 1) { const p = r.int(1, 3), q = r.pick([2, 3, 4]), s = r.pick([3, 5]); need(q !== s && L.gcd(p, q) === 1);
    const t = `x^{\\frac{${p}}{${q}}} \\cdot x^{\\frac{1}{${s}}}`;
    const e = F(p, q).add(F(1, s)); need(e.d !== 1);
    return { stem: `<p>For ${m('x > 0')}, which expression is equivalent to ${m(t)}?</p>`, ...exprCh(t, [`x^{${e.tex()}}`, `x^{${F(p, q).mul(F(1, s)).tex()}}`, `x^{${F(p + 1, q + s).tex()}}`, `x^{${F(p + 1, q * s).tex()}}`]),
      explanation: `Add the exponents: ${m(`\\frac{${p}}{${q}} + \\frac{1}{${s}} = ${e.tex()}`)}.` }; }
  const k = r.pick([8, 27, 16]), n = k === 16 ? 4 : 3, base = Math.round(Math.pow(k, 1 / n));
  const t = `(${k}x^{${n * 2}})^{\\frac{1}{${n}}}`;
  return { stem: `<p>Which expression is equivalent to ${m(t)} for ${m('x > 0')}?</p>`, ...exprCh(t, [`${base}x^{2}`, `${base}x^{${n * 2 + n}}`, `${k / n}x^{2}`, `${base}x^{${2 * n - n + 3}}`]),
    explanation: `${m(`${k}^{\\frac{1}{${n}}} = ${base}`)} and ${m(`(x^{${2 * n}})^{\\frac{1}{${n}}} = x^{2}`)}, so the expression equals ${m(`${base}x^2`)}.` };
});

def('quad-word', 2, 'spr', 3, SK.ne, (r, v) => {
  if (v % 3 === 0) { const w = r.int(4, 15), k = r.int(2, 9); const A = w * (w + k);
    return { stem: `<p>The length of a rectangular patio is ${k} feet longer than its width. The area of the patio is ${A} square feet. What is the width, in feet, of the patio?</p>`, answer: spr(w),
      explanation: `If the width is ${m('w')}, then ${m(`w(w + ${k}) = ${A}`)}, so ${m(`${quad(1, k, -A, 'w')} = 0`)}, which factors as ${m(`(w - ${w})(w + ${w + k}) = 0`)}. Since width is positive, ${m(`w = ${w}`)}.`, verify: () => w * (w + k) === A }; }
  if (v % 3 === 1) { const n = r.int(5, 15) * 2; const P = n * (n + 2);
    return { stem: `<p>The product of two consecutive positive even integers is ${P}. What is the greater of the two integers?</p>`, answer: spr(n + 2),
      explanation: `Let the integers be ${m('n')} and ${m('n + 2')}: ${m(`n(n + 2) = ${P}`)}, so ${m(`n^2 + 2n - ${P} = 0`)} and ${m(`(n - ${n})(n + ${n + 2}) = 0`)}. So ${m(`n = ${n}`)}, and the greater integer is ${n + 2}.`, verify: () => n * (n + 2) === P && n % 2 === 0 }; }
  const vv = r.pick([48, 64, 80, 96, 112]); const T = vv / 16;
  return { stem: `<p>A ball is launched upward from ground level. Its height, in feet, ${m('t')} seconds after launch is given by ${m(`h(t) = -16t^2 + ${vv}t`)}. How many seconds after launch does the ball hit the ground?</p>`, answer: spr(T),
    explanation: `Set ${m('h(t) = 0')}: ${m(`-16t(t - ${T}) = 0`)}, so ${m('t = 0')} (launch) or ${m(`t = ${T}`)}. The ball hits the ground after ${T} seconds.`, verify: () => close(-16 * T * T + vv * T, 0) };
});

def('factor-theorem', 2, 'mcq', 4, SK.nf, (r, v) => {
  if (v % 3 === 0) { const a = r.nz(-7, 7), b = r.nz(-9, 9); need(a !== b && Math.abs(a) !== Math.abs(b));
    return { stem: `<p>For the polynomial function ${m('p')}, ${m(`p(${a}) = 0`)} and ${m(`p(0) = ${b}`)}. Which of the following must be a factor of ${m('p(x)')}?</p>`,
      choices: [lin(1, -a), lin(1, a), lin(1, -b), lin(1, b)].map(m), explanation: `If ${m(`p(${a}) = 0`)}, then by the factor theorem ${m(`x - (${a}) = ${lin(1, -a)}`)} is a factor of ${m('p(x)')}. The value ${m(`p(0) = ${b}`)} is not a zero, so it does not give a factor.` }; }
  if (v % 3 === 1) { const a = r.nz(-5, 5), c = r.nz(-6, 6), d = r.nz(-9, 9); const pv = a * a * a + c * a + d; need(pv !== 0);
    const p = poly([[1, 'x^3'], [c, 'x'], [d, '']]);
    return { stem: `<p>${m(`p(x) = ${p}`)}</p><p>What is the remainder when ${m('p(x)')} is divided by ${m(lin(1, -a))}?</p>`, ...numCh([pv, a * a * a - c * a + d === pv ? pv + 2 : -a * a * a - c * a + d, d, -pv]),
      explanation: `By the remainder theorem, the remainder is ${m(`p(${a}) = (${a})^3 ${c > 0 ? '+' : '-'} ${Math.abs(c)}(${a}) ${d > 0 ? '+' : '-'} ${Math.abs(d)} = ${pv}`)}.`, verify: () => close(texEval(p, { x: a }), pv) }; }
  const z = r.nz(-4, 4), xs = [-4, -2, 0, 2, 4]; need(xs.includes(z));
  const g = (x) => (x - z) * (x * x + x + 3);
  const rows = xs.map((x) => [m(x), m(g(x))]);
  return { stem: `<p>The table shows some values of ${m('x')} and ${m('p(x)')} for the polynomial function ${m('p')}.</p>` + ptable([m('x'), m('p(x)')], rows) + `<p>Which of the following must be a factor of ${m('p(x)')}?</p>`,
    choices: [lin(1, -z), lin(1, z), lin(1, -g(0)) , `x`].map(m).map((s, i) => (i === 3 && z === 0 ? m(lin(1, -1)) : s)),
    explanation: `The table shows ${m(`p(${z}) = 0`)}, so ${m(lin(1, -z))} is a factor of ${m('p(x)')} by the factor theorem.`, verify: () => g(z) === 0 && L.distinct([lin(1, -z), lin(1, z), lin(1, -g(0))]) && z !== 0 };
});

def('parabola-eq', 2, 'mcq', 4, SK.nf, (r, v) => {
  const r1 = r.int(-5, 0), r2 = r1 + r.int(2, 6), a = r.pick([1, -1]); need(r2 <= 5 && r2 !== 0 && r1 !== 0 && -r1 !== r2);
  const f = (x) => a * (x - r1) * (x - r2);
  const ext = f((r1 + r2) / 2); need(Math.abs(ext) <= 9);
  const svg = plane({ x: [-7, 7], y: [-10, 10], tick: 1, tickY: 2, items: [{ fn: f }] });
  const B = (k) => `(${lin(1, -k)})`;
  const c = [`y = ${a < 0 ? '-' : ''}${B(r1)}${B(r2)}`, `y = ${a < 0 ? '-' : ''}${B(-r1)}${B(-r2)}`, `y = ${a < 0 ? '' : '-'}${B(r1)}${B(r2)}`, `y = ${a < 0 ? '' : '-'}${B(-r1)}${B(-r2)}`];
  return { stem: `<p>The graph of a quadratic function is shown in the ${m('xy')}-plane. Which equation could define the graph?</p>` + svg, choices: c.map(m),
    explanation: `The graph crosses the ${m('x')}-axis at ${m(`x = ${r1}`)} and ${m(`x = ${r2}`)}, so the factors are ${m(B(r1))} and ${m(B(r2))}. The parabola opens ${a > 0 ? 'upward' : 'downward'}, so the leading coefficient is ${a > 0 ? 'positive' : 'negative'}: ${m(c[0])}.`,
    verify: () => [r1, r2, 1.5].every((x) => close(texEval(c[0].split('=')[1], { x }), f(x))) };
});

/* ============================ HARD ============================ */
def('discriminant-one', 3, 'spr', 3, SK.ne, (r, v) => {
  if (v % 3 === 0) { const a = r.int(1, 4), s = r.int(2, 6); const c = s * s * a; const k = 2 * a * s; // a x^2 - kx + c : k^2 = 4ac
    return { stem: `<p>${m(`${cv(a, 'x^2')} - kx + ${c} = 0`)}</p><p>In the given equation, ${m('k')} is a positive constant. The equation has exactly one real solution. What is the value of ${m('k')}?</p>`, answer: spr(k),
      explanation: `A quadratic has exactly one real solution when its discriminant is 0: ${m(`(-k)^2 - 4(${a})(${c}) = 0`)}, so ${m(`k^2 = ${4 * a * c}`)} and, since ${m('k > 0')}, ${m(`k = ${k}`)}.`, verify: () => k * k - 4 * a * c === 0 }; }
  if (v % 3 === 1) { const b = 2 * r.int(2, 9); const c = b * b / 4;
    return { stem: `<p>${m(`x^2 - ${b}x + c = 0`)}</p><p>In the given equation, ${m('c')} is a constant. If the equation has exactly one solution, what is the value of ${m('c')}?</p>`, answer: spr(c),
      explanation: `The discriminant must be 0: ${m(`(-${b})^2 - 4(1)c = 0`)}, so ${m(`${b * b} = 4c`)} and ${m(`c = ${c}`)}. (Indeed ${m(`x^2 - ${b}x + ${c} = (x - ${b / 2})^2`)}.)`, verify: () => b * b - 4 * c === 0 }; }
  const b = r.pick([6, 8, 10, 12, 14]), c = r.pick([2, 3, 4, 5]); const k = F(b * b, 4 * c); need(L.sprFits(k.str()) || true);
  return { stem: `<p>${m(`kx^2 + ${b}x + ${c} = 0`)}</p><p>In the given equation, ${m('k')} is a constant. If the equation has exactly one real solution, what is the value of ${m('k')}?</p>`, answer: spr(k),
    explanation: `Set the discriminant equal to 0: ${m(`${b}^2 - 4k(${c}) = 0`)}, so ${m(`${b * b} = ${4 * c}k`)} and ${m(`k = ${k.tex()}`)}.`, verify: () => close(b * b - 4 * k.val() * c, 0) };
});

def('discriminant-system', 3, 'spr', 3, SK.ne, (r, v) => {
  if (v % 3 === 0) { const p = r.nz(-6, 6), mm = r.nz(-5, 5), k = r.nz(-9, 9); // y = x^2 + p x + c, y = m x + k ; x^2 + (p-m)x + (c - k) = 0, D = 0
    need((p - mm) % 2 === 0); const c = k + (p - mm) * (p - mm) / 4;
    const e1 = `y = ${poly([[1, 'x^2'], [p, 'x']])} + c`, e2 = `y = ${lin(mm, k)}`;
    return { stem: `<p>${m(e1)}<br>${m(e2)}</p><p>In the given system of equations, ${m('c')} is a constant. The system has exactly one distinct real solution. What is the value of ${m('c')}?</p>`, answer: spr(c),
      explanation: `Substitute: ${m(`${poly([[1, 'x^2'], [p, 'x']])} + c = ${lin(mm, k)}`)}, so ${m(`${poly([[1, 'x^2'], [p - mm, 'x']])} + (c ${k > 0 ? '-' : '+'} ${Math.abs(k)}) = 0`)}. One solution means the discriminant is 0: ${m(`(${p - mm})^2 - 4(c ${k > 0 ? '-' : '+'} ${Math.abs(k)}) = 0`)}, so ${m(`c = ${c}`)}.`,
      verify: () => close((p - mm) * (p - mm) - 4 * (c - k), 0) }; }
  if (v % 3 === 1) { const a = r.pick([1, 2, 3]), mm = r.nz(-8, 8); const kk = F(-mm * mm, 4 * a); need(L.sprFits(kk.str()));
    return { stem: `<p>In the ${m('xy')}-plane, the line ${m(`y = ${cv(mm, 'x')} + k`)}, where ${m('k')} is a constant, intersects the parabola ${m(`y = ${cv(a, 'x^2')}`)} at exactly one point. What is the value of ${m('k')}?</p>`, answer: spr(kk),
      explanation: `Set ${m(`${cv(a, 'x^2')} = ${cv(mm, 'x')} + k`)}, or ${m(`${poly([[a, 'x^2'], [-mm, 'x']])} - k = 0`)}. Exactly one intersection means the discriminant is 0: ${m(`(${-mm})^2 + 4(${a})k = 0`)}, so ${m(`k = ${kk.tex()}`)}.`, verify: () => close(mm * mm + 4 * a * kk.val(), 0) }; }
  const b = 2 * r.int(2, 5), d = r.int(1, 6); // y = x^2 - b x + k ; y = -d ; x^2 - bx + (k + d) = 0 no real: b^2 < 4(k + d) -> k > b^2/4 - d
  const bound = b * b / 4 - d; const ans = bound + 1;
  return { stem: `<p>${m(`y = x^2 - ${b}x + k`)}<br>${m(`y = -${d}`)}</p><p>In the given system, ${m('k')} is an integer constant. If the system has no real solutions, what is the least possible value of ${m('k')}?</p>`, answer: spr(ans),
    explanation: `Substitute: ${m(`x^2 - ${b}x + k + ${d} = 0`)}. No real solutions means the discriminant is negative: ${m(`${b * b} - 4(k + ${d}) \\lt 0`)}, so ${m(`k + ${d} \\gt ${b * b / 4}`)} and ${m(`k \\gt ${bound}`)}. The least integer value is ${ans}.`,
    verify: () => b * b - 4 * (ans + d) < 0 && b * b - 4 * (ans - 1 + d) >= 0 };
});

def('exp-equiv', 3, 'mcq', 4, SK.eq, (r, v) => {
  if (v % 3 === 0) { const P = r.pick([500, 800, 1500]), g = r.pick([10, 20, 30]); const b = 1 + g / 100; const B2 = +(b * b).toFixed(4);
    const c = [`${P}(${b.toFixed(1)})^{2t}`, `${P}(${B2})^{2t}`, `${P}(${(B2 / 2).toFixed(3).replace(/0+$/, '')})^{2t}`, `${P}(${b.toFixed(1)})^{\\frac{t}{2}}`];
    return { stem: `<p>The function ${m(`f(t) = ${P}(${B2})^{t}`)} models the number of members of an online forum ${m('t')} years after the forum was created. Which of the following equivalent forms of ${m('f(t)')} shows, as a constant or coefficient, the percent increase in the number of members every half year?</p>`, choices: c.map((s) => m(`f(t) = ${s}`)),
      explanation: `${m(`${B2} = (${b.toFixed(1)})^2`)}, so ${m(`f(t) = ${P}((${b.toFixed(1)})^2)^{t} = ${P}(${b.toFixed(1)})^{2t}`)}. Here ${m('2t')} counts half-years, and the base ${b.toFixed(1)} shows a ${g}% increase every half year.`, verify: () => sameExpr(`${P}(${B2})^{t}`, c[0], ['t']) && !sameExpr(`${P}(${B2})^{t}`, c[1], ['t']) && !sameExpr(`${P}(${B2})^{t}`, c[3], ['t']) }; }
  if (v % 3 === 1) { const b = r.pick([2, 3, 5]), c0 = r.int(1, 3);
    const t = `${b}^{2x + ${c0}}`;
    return { stem: `<p>Which expression is equivalent to ${m(t)}?</p>`, ...exprCh(t, [`${Math.pow(b, c0)}(${b * b})^{x}`, `(${b * b})^{x + ${c0}}`, `${Math.pow(b, c0)}(${2 * b})^{x}`, `(${Math.pow(b, c0 + 2)})^{x}`]),
      explanation: `${m(`${b}^{2x + ${c0}} = ${b}^{${c0}} \\cdot ${b}^{2x} = ${Math.pow(b, c0)}(${b}^2)^{x} = ${Math.pow(b, c0)}(${b * b})^{x}`)}.` }; }
  const P = r.pick([1000, 2000, 5000]), g = r.pick([2, 3, 4]);
  const q = 1 + g / 400;
  const t = `${texInt(P)}(1.0${g})^{t}`;
  const c = [`${texInt(P)}\\left(1.0${g}^{\\frac{1}{4}}\\right)^{4t}`, `${texInt(P)}(${q.toFixed(4).replace(/0+$/, '')})^{4t}`, `${texInt(P)}(1.0${g})^{\\frac{t}{4}}`, `${texInt(P)}(1.0${4 * g})^{\\frac{t}{4}}`];
  return { stem: `<p>The amount of money, in dollars, in an account ${m('t')} years after it was opened is given by ${m(`A(t) = ${t}`)}. Which of the following expressions is equivalent to ${m('A(t)')} and expresses the account balance in terms of quarter-years (${m('4t')} quarters in ${m('t')} years)?</p>`, choices: c.map(m),
    explanation: `Since ${m(`\\left(1.0${g}^{\\frac{1}{4}}\\right)^{4t} = 1.0${g}^{t}`)}, the first expression is equivalent. Dividing the annual rate by 4, as in ${m(`(${q.toFixed(4).replace(/0+$/, '')})^{4t}`)}, gives a slightly different (larger) value, so it is not equivalent.`,
    verify: () => sameExpr(t, c[0].replace(/1\.0(\d)\^\{\\frac\{1\}\{4\}\}/, `(1.0$1)^{\\frac{1}{4}}`), ['t']) && !sameExpr(t, c[1], ['t']) && !sameExpr(t, c[2], ['t']) };
});

def('vieta', 3, 'spr', 3, SK.ne, (r, v) => {
  if (v % 3 === 0) { const a = r.int(2, 6), b = r.nz(-30, 30), c = r.nz(-20, 20); need(b * b - 4 * a * c > 0 && Math.sqrt(b * b - 4 * a * c) % 1 !== 0); const S = F(-b, a); need(L.sprFits(S.str()));
    const eq = `${quad(a, b, c)} = 0`;
    return { stem: `<p>${m(eq)}</p><p>What is the sum of the solutions to the given equation?</p>`, answer: spr(S),
      explanation: `For ${m('ax^2 + bx + c = 0')}, the sum of the solutions is ${m('-\\frac{b}{a}')}. Here that is ${m(`-\\frac{${b}}{${a}} = ${S.tex()}`)}. (The discriminant is positive, so there are two real solutions.)`,
      verify: () => { const D = Math.sqrt(b * b - 4 * a * c); return close((-b + D) / (2 * a) + (-b - D) / (2 * a), S.val()); } }; }
  if (v % 3 === 1) { const a = r.int(2, 5), p = r.int(1, 9), q = r.nz(-9, 9); need(L.gcd(p, a) === 1);
    // a x^2 + bx + c with root 'p/a'? choose roots p and q/a: a(x - p)(x - q/a) = (x - p)(ax - q)
    const b = -(a * p + q), c = p * q; const other = F(q, a);
    return { stem: `<p>${m(`${quad(a, b, 'k' === 'k' ? 0 : 0)} + k = 0`.replace(' + 0', ''))}</p><p>In the given equation, ${m('k')} is a constant. If ${m(`x = ${p}`)} is one solution to the equation, what is the other solution?</p>`, answer: spr(other),
      explanation: `The sum of the solutions is ${m(`-\\frac{b}{a} = ${F(-b, a).tex()}`)}. So the other solution is ${m(`${F(-b, a).tex()} - ${p} = ${other.tex()}`)}. (Here ${m(`k = ${c}`)}.)`, verify: () => close(a * p * p + b * p + c, 0) && close(a * other.val() ** 2 + b * other.val() + c, 0) }; }
  const r1 = r.int(1, 9), r2 = r.nz(-9, 9); need(r1 !== r2 && r1 + r2 !== 0);
  const s = r1 + r2, P = r1 * r2;
  return { stem: `<p>${m(`${poly([[1, 'x^2'], [-s, 'x']])} + c = 0`)}</p><p>In the given equation, ${m('c')} is a constant. One solution to the equation is ${m(`x = ${r1}`)}. What is the value of ${m('c')}?</p>`, answer: spr(P),
    explanation: `The solutions add to ${s}, so the other solution is ${m(`${s} - ${r1} = ${r2}`)}. The constant ${m('c')} is the product of the solutions: ${m(`c = (${r1})(${r2}) = ${P}`)}.`, verify: () => close(r1 * r1 - s * r1 + P, 0) };
});

def('equiv-constants', 3, 'spr', 3, SK.eq, (r, v) => {
  const a = r.nz(-5, 6), p = r.nz(-7, 7), q = r.int(2, 5), b = r.nz(-8, 8); need(Math.abs(a) > 1 && a * b + p * q !== 0);
  const A = a * q, C = p * b, Bm = a * b + p * q;
  const lhs = `(ax ${p > 0 ? '+' : '-'} ${Math.abs(p)})(${q}x + b)`;
  const eqT = `${lhs} = ${poly([[A, 'x^2'], [1, 'cx'], [C, '']])}`;
  const askC = v % 3 !== 2;
  const val = askC ? Bm : a + b;
  return { stem: `<p>${m(eqT)}</p><p>In the given equation, ${m('a')}, ${m('b')}, and ${m('c')} are constants. If the equation is true for all values of ${m('x')}, what is the value of ${m(askC ? 'c' : 'a + b')}?</p>`, answer: spr(val),
    explanation: `Expanding the left side gives ${m(`${q}ax^2 + (ab ${p * q >= 0 ? '+' : '-'} ${Math.abs(p * q)})x ${p > 0 ? '+' : '-'} ${Math.abs(p)}b`)}. Matching coefficients: ${m(`${q}a = ${A}`)}, so ${m(`a = ${a}`)}; ${m(`${p}b = ${C}`)}, so ${m(`b = ${b}`)}. ${askC ? `Then ${m(`c = ab ${p * q >= 0 ? '+' : '-'} ${Math.abs(p * q)} = ${a * b} ${p * q >= 0 ? '+' : '-'} ${Math.abs(p * q)} = ${Bm}`)}.` : `So ${m(`a + b = ${a + b}`)}.`}`,
    verify: () => [0, 1, 2, -3].every((x) => close((a * x + p) * (q * x + b), A * x * x + Bm * x + C)) };
});

def('rational-extraneous', 3, 'mcq', 4, SK.ne, (r, v) => {
  const s = r.nz(-8, 8), p = r.nz(-6, 6); need(s !== p && s !== -p);
  const S = s + p, P = s * p;
  const eq = `\\frac{x^2}{${lin(1, -p)}} = \\frac{${lin(S, -P)}}{${lin(1, -p)}}`;
  if (v % 3 === 2) {
    const opts = ['Zero', 'Exactly one', 'Exactly two', 'Infinitely many'];
    return { stem: `<p>${m(eq)}</p><p>How many distinct real solutions does the given equation have?</p>`, choices: [opts[1], opts[0], opts[2], opts[3]], order: [1, 0, 2, 3],
      explanation: `Multiplying both sides by ${m(lin(1, -p))} gives ${m(`${quad(1, -S, P)} = 0`)}, so ${m(`(${lin(1, -s)})(${lin(1, -p)}) = 0`)}. But ${m(`x = ${p}`)} makes the denominator 0, so it is extraneous. The only solution is ${m(`x = ${s}`)}: exactly one.`,
      verify: () => eqHolds(eq, { x: s }) };
  }
  const c = [`${m(s)} only`, `${m(p)} only`, `${m(s)} and ${m(p)}`, `${m(-s)} and ${m(-p)}`];
  return { stem: `<p>${m(eq)}</p><p>What are all values of ${m('x')} that satisfy the given equation?</p>`, choices: c,
    explanation: `Multiply both sides by ${m(lin(1, -p))}: ${m(`x^2 = ${lin(S, -P)}`)}, so ${m(`${quad(1, -S, P)} = 0`)} and ${m(`(${lin(1, -s)})(${lin(1, -p)}) = 0`)}. The value ${m(`x = ${p}`)} makes the original denominators zero, so it is not a solution. Only ${m(`x = ${s}`)} works.`,
    verify: () => eqHolds(eq, { x: s }) && !isFinite(texEval(`\\frac{1}{${lin(1, -p)}}`, { x: p })) };
});

def('vertex-param', 3, 'spr', 3, SK.nf, (r, v) => {
  if (v % 3 === 0) { const p = r.nz(-6, 6), h = r.nz(-5, 5); const k = p - 2 * h; need(k !== 0 && k !== p); // f(x) = (x - p)(x + k): zeros p, -k; vertex (p - k)/2 = h
    const ans = (h - p) * (h + k);
    return { stem: `<p>The function ${m('f')} is defined by ${m(`f(x) = (${lin(1, -p)})(x + k)`)}, where ${m('k')} is a constant. The graph of ${m('y = f(x)')} in the ${m('xy')}-plane has its vertex at ${m(`x = ${h}`)}. What is the minimum value of ${m('f(x)')}?</p>`, answer: spr(ans),
      explanation: `The zeros of ${m('f')} are ${m(p)} and ${m('-k')}, and the vertex lies midway between them: ${m(`\\frac{${p} + (-k)}{2} = ${h}`)}, so ${m(`k = ${k}`)}. The minimum value is ${m(`f(${h}) = (${h - p})(${h + k}) = ${ans}`)}.`, verify: () => close((h - p) * (h + k), ans) && close((p + -k) / 2, h) }; }
  if (v % 3 === 1) { const h = r.nz(-4, 4), k = r.nz(-9, 9), a = r.nz(-4, 4); const y0 = a * h * h + k; need(y0 !== k);
    return { stem: `<p>The graph of the quadratic function ${m('g')} in the ${m('xy')}-plane has a vertex at ${pt(h, k)} and passes through the point ${pt(0, y0)}. If ${m('g(x) = a(x - h)^2 + k')}, what is the value of ${m('a')}?</p>`, answer: spr(a),
      explanation: `With vertex ${pt(h, k)}: ${m(`g(x) = a(x ${h > 0 ? '-' : '+'} ${Math.abs(h)})^2 ${k > 0 ? '+' : '-'} ${Math.abs(k)}`)}. Substituting ${pt(0, y0)}: ${m(`${y0} = a(${h * h}) ${k > 0 ? '+' : '-'} ${Math.abs(k)}`)}, so ${m(`${h * h}a = ${y0 - k}`)} and ${m(`a = ${a}`)}.`, verify: () => a * h * h + k === y0 }; }
  const a = r.nz(-3, 3), h = r.nz(-3, 4), k = r.nz(-6, 6); const f = (x) => a * (x - h) ** 2 + k;
  const x1 = h - 2, x2 = h + 2; const c = f(0);
  return { stem: `<p>The graph of ${m('y = ax^2 + bx + c')}, where ${m('a')}, ${m('b')}, and ${m('c')} are constants, passes through the points ${pt(x1, f(x1))}, ${pt(x2, f(x2))}, and ${pt(h, k)}. What is the value of ${m('c')}?</p>`, answer: spr(c),
    explanation: `The points ${pt(x1, f(x1))} and ${pt(x2, f(x2))} have the same ${m('y')}-value, so the axis of symmetry is ${m(`x = ${h}`)} and ${pt(h, k)} is the vertex. Then ${m(`y = a(x ${h > 0 ? '-' : '+'} ${Math.abs(h)})^2 ${k > 0 ? '+' : '-'} ${Math.abs(k)}`)} and ${m(`${f(x2)} = a(4) ${k > 0 ? '+' : '-'} ${Math.abs(k)}`)} gives ${m(`a = ${a}`)}. So ${m(`c = y(0) = (${a})(${h * h}) ${k > 0 ? '+' : '-'} ${Math.abs(k)} = ${c}`)}.`, verify: () => c === a * h * h + k };
});

def('exp-twopoints', 3, 'mcq', 4, SK.nf, (r, v) => {
  const a = r.int(2, 9), b = r.pick([2, 3, 4, 5]), x1 = r.int(1, 2), x2 = x1 + 2; const y1 = a * b ** x1, y2 = a * b ** x2; need(y2 < 10000);
  const ask = v % 3; const ans = ask === 0 ? a : ask === 1 ? a * b ** (x2 + 1) : b;
  const q = ['the value of ' + m('a'), 'the value of ' + m(`f(${x2 + 1})`), 'the value of ' + m('b')][ask];
  return { stem: `<p>The function ${m('f')} is defined by ${m('f(x) = a(b)^{x}')}, where ${m('a')} and ${m('b')} are positive constants. The graph of ${m('y = f(x)')} passes through the points ${pt(x1, y1)} and ${m(`(${x2}, ${texInt(y2)})`)}. What is ${q}?</p>`, ...numCh([ans, ...(ask === 0 ? [b, y1, a * b] : ask === 1 ? [y2 + (y2 - y1) / 2, y2 * b * b, a * b * (x2 + 1)] : [b * b, a, y2 - y1])], (z) => m(texInt(valOf(z)))),
    explanation: `Dividing, ${m(`\\frac{f(${x2})}{f(${x1})} = b^{2} = \\frac{${texInt(y2)}}{${y1}} = ${b * b}`)}, so ${m(`b = ${b}`)}. Then ${m(`a(${b})${x1 > 1 ? `^{${x1}}` : ''} = ${y1}`)} gives ${m(`a = ${a}`)}.${ask === 1 ? ` So ${m(`f(${x2 + 1}) = ${a}(${b})^{${x2 + 1}} = ${texInt(ans)}`)}.` : ''}`, verify: () => a * b ** x1 === y1 && a * b ** x2 === y2 };
});

def('factor-k', 3, 'mcq', 4, SK.nf, (r, v) => {
  const z = r.nz(-3, 3), c1 = r.nz(-6, 6), c0 = r.nz(-12, 12);
  // p(x) = x^3 + kx^2 + c1 x + c0, p(z) = 0 -> k = -(z^3 + c1 z + c0)/z^2
  const k = F(-(z ** 3 + c1 * z + c0), z * z); need(L.sprFits(k.str()) && !k.eq(0));
  const p = `x^3 + kx^2 ${poly([[c1, 'x'], [c0, '']]).replace(/^(?!-)/, '+ ').replace(/^-/, '- ')}`;
  const phr = v % 3 === 0 ? `${m(lin(1, -z))} is a factor of ${m('p(x)')}` : v % 3 === 1 ? `the graph of ${m('y = p(x)')} has an ${m('x')}-intercept at ${pt(z, 0)}` : `${m(`p(x)`)} is divisible by ${m(lin(1, -z))} with remainder 0`;
  return { stem: `<p>${m(`p(x) = ${p}`)}</p><p>In the polynomial function ${m('p')}, ${m('k')} is a constant. If ${phr}, what is the value of ${m('k')}?</p>`, ...numCh([k, k.neg(), F(-((-z) ** 3 + c1 * -z + c0), z * z), F(-(z ** 3 + c1 * z), z * z)]),
    explanation: `By the factor theorem, ${m(`p(${z}) = 0`)}: ${m(`(${z})^3 + k(${z})^2 + (${c1})(${z}) + (${c0}) = 0`)}, so ${m(`${cv(z * z, 'k')} ${z ** 3 + c1 * z + c0 >= 0 ? '+' : '-'} ${Math.abs(z ** 3 + c1 * z + c0)} = 0`)} and ${m(`k = ${k.tex()}`)}.`,
    verify: () => close(texEval(p, { x: z, k: k.val() }), 0) };
});

def('transform-graph', 3, 'mcq', 4, SK.nf, (r, v) => {
  const xs = [-5, -3, -1, 1, 3, 5]; const ys = xs.map(() => r.int(-4, 4));
  need(new Set(ys).size >= 4);
  const f = (x) => { if (x < -5 || x > 5) return NaN; for (let i = 0; i < xs.length - 1; i++) if (x >= xs[i] && x <= xs[i + 1]) return ys[i] + (ys[i + 1] - ys[i]) * (x - xs[i]) / (xs[i + 1] - xs[i]); return NaN; };
  const svg = plane({ x: [-6, 6], y: [-6, 6], tick: 1, items: [{ fn: f, from: -5, to: 5 }, { pts: xs.map((x, i) => [x, ys[i]]) }] });
  if (v % 3 === 2) {
    const c = r.pick([-2, -1, 0, 1, 2]);
    let cnt = 0; for (let x = -5; x <= 5; x += 0.001) { const a = f(x) - c, b = f(x + 0.001) - c; if (a === 0 || a * b < 0) cnt++; }
    // dedupe exact hits counted twice
    const exact = []; for (let x = -5; x <= 5 + 1e-9; x += 0.0005) { if (Math.abs(f(x) - c) < 1e-9) exact.push(x); }
    need(exact.length === 0 || exact.every((x) => xs.every((X) => Math.abs(X - x) > 0.01))); // avoid touching at vertices
    need(cnt >= 1 && cnt <= 4);
    const vals = [cnt, ...[0, 1, 2, 3, 4, 5].filter((k) => k !== cnt).slice(0, 3)];
    return { stem: `<p>The graph of the function ${m('f')}, defined for ${m('-5 \\le x \\le 5')}, is shown. For how many values of ${m('x')} does ${m(`f(x) = ${c}`)}?</p>` + svg, ...numCh(vals),
      explanation: `The solutions of ${m(`f(x) = ${c}`)} are the ${m('x')}-coordinates of the points where the horizontal line ${m(`y = ${c}`)} meets the graph. That line crosses the graph ${cnt} time${cnt === 1 ? '' : 's'}.`, verify: () => cnt >= 1 };
  }
  const s = r.pick([1, 2, -2]), u = r.nz(-3, 3);
  const k = r.pick(xs.map((x) => x - s).filter((x) => xs.includes(x + s)));
  const ans = ys[xs.indexOf(k + s)] + u;
  const wrong1 = f(k - s) + u, wrong2 = ys[xs.indexOf(k + s)] - u, wrong3 = f(k) + u;
  const vals = [ans, wrong1, wrong2, wrong3].map((z) => +z.toFixed(4)); need(vals.every((z) => isFinite(z) && isInt(z)) && new Set(vals).size === 4);
  const gt = `g(x) = f(x ${s > 0 ? '+' : '-'} ${Math.abs(s)}) ${u > 0 ? '+' : '-'} ${Math.abs(u)}`;
  return { stem: `<p>The graph of the function ${m('f')} is shown. The function ${m('g')} is defined by ${m(gt)}. What is the value of ${m(`g(${k})`)}?</p>` + svg, ...numCh(vals),
    explanation: `${m(`g(${k}) = f(${k} ${s > 0 ? '+' : '-'} ${Math.abs(s)}) ${u > 0 ? '+' : '-'} ${Math.abs(u)} = f(${k + s}) ${u > 0 ? '+' : '-'} ${Math.abs(u)}`)}. From the graph, ${m(`f(${k + s}) = ${ys[xs.indexOf(k + s)]}`)}, so ${m(`g(${k}) = ${ans}`)}.`, verify: () => close(f(k + s) + u, ans) };
});

def('poly-division', 3, 'spr', 3, SK.eq, (r, v) => {
  if (v % 3 === 2) { const a = r.int(2, 4), d = r.nz(-4, 4), b = r.nz(-9, 9), c = r.nz(-9, 9);
    // (a x^2 + b x + c)/(x - d) = a x + (b + a d) + R/(x - d), R = a d^2 + b d + c
    const R = a * d * d + b * d + c; need(R !== 0 && b + a * d !== 0);
    const t = `\\frac{${quad(a, b, c)}}{${lin(1, -d)}}`;
    return { stem: `<p>The expression ${m(t)} is equivalent to ${m(`${lin(a, b + a * d)} + \\frac{A}{${lin(1, -d)}}`)}, where ${m('A')} is a constant and ${m(`x \\ne ${d}`)}. What is the value of ${m('A')}?</p>`, answer: spr(R),
      explanation: `Multiply both sides by ${m(lin(1, -d))}: ${m(`${quad(a, b, c)} = (${lin(a, b + a * d)})(${lin(1, -d)}) + A`)}. Substituting ${m(`x = ${d}`)} gives ${m(`A = ${a}(${d})^2 ${b > 0 ? '+' : '-'} ${Math.abs(b)}(${d}) ${c > 0 ? '+' : '-'} ${Math.abs(c)} = ${R}`)}.`,
      verify: () => sameExpr(t, `${lin(a, b + a * d)} + \\frac{${R}}{${lin(1, -d)}}`) }; }
  const d = r.nz(-5, 5), b = r.nz(-9, 9), c = r.nz(-12, 12); const q0 = b - d; const R = d * d - b * d + c; need(R !== 0 && q0 !== 0);
  const t = `\\frac{${quad(1, b, c)}}{${lin(1, d)}}`;
  return { stem: `<p>${m(`${t} = ${lin(1, q0)} + \\frac{k}{${lin(1, d)}}`)}</p><p>The given equation is true for all ${m(`x \\ne ${-d}`)}, where ${m('k')} is a constant. What is the value of ${m('k')}?</p>`, answer: spr(R),
    explanation: `Multiply both sides by ${m(lin(1, d))}: ${m(`${quad(1, b, c)} = (${lin(1, q0)})(${lin(1, d)}) + k = ${quad(1, b, q0 * d)} + k`)}. Comparing constant terms, ${m(`k = ${c} - ${pn(q0 * d)} = ${R}`)}.`,
    verify: () => sameExpr(t, `${lin(1, q0)} + \\frac{${R}}{${lin(1, d)}}`) };
});

def('system-sym', 3, 'spr', 3, SK.ne, (r, v) => {
  if (v % 3 === 0) { const x = r.int(1, 9), y = r.nz(-6, 9); const s = x + y, P = x * y; need(s !== 0 && P !== 0);
    return { stem: `<p>${m(`x + y = ${s}`)}<br>${m(`xy = ${P}`)}</p><p>If ${m('(x, y)')} is a solution to the given system of equations, what is the value of ${m('x^2 + y^2')}?</p>`, answer: spr(x * x + y * y),
      explanation: `${m(`(x + y)^2 = x^2 + 2xy + y^2`)}, so ${m(`x^2 + y^2 = (x + y)^2 - 2xy = ${s * s} - 2(${P}) = ${x * x + y * y}`)}.`, verify: () => (x + y) ** 2 - 2 * x * y === x * x + y * y }; }
  if (v % 3 === 1) { const s = r.int(4, 12), d = r.int(1, s - 1); need((s + d) % 2 === 0); const x = (s + d) / 2, y = (s - d) / 2; const D2 = x * x - y * y;
    return { stem: `<p>${m(`x^2 - y^2 = ${D2}`)}<br>${m(`x + y = ${s}`)}</p><p>If ${m('(x, y)')} is the solution to the given system of equations, what is the value of ${m('x')}?</p>`, answer: spr(x),
      explanation: `Factor: ${m(`(x + y)(x - y) = ${D2}`)}, so ${m(`${s}(x - y) = ${D2}`)} and ${m(`x - y = ${d}`)}. Adding ${m(`x + y = ${s}`)} gives ${m(`2x = ${s + d}`)}, so ${m(`x = ${x}`)}.`, verify: () => x * x - y * y === D2 && x + y === s }; }
  const x = r.int(2, 9), y = r.int(1, x - 1); const d = x - y, P = x * y;
  return { stem: `<p>${m(`x - y = ${d}`)}<br>${m(`xy = ${P}`)}</p><p>If ${m('(x, y)')} is a solution to the given system, what is the value of ${m('x^2 + y^2')}?</p>`, answer: spr(x * x + y * y),
    explanation: `${m(`(x - y)^2 = x^2 - 2xy + y^2`)}, so ${m(`x^2 + y^2 = (x - y)^2 + 2xy = ${d * d} + ${2 * P} = ${x * x + y * y}`)}.`, verify: () => d * d + 2 * P === x * x + y * y };
});

def('projectile', 3, 'spr', 3, SK.nf, (r, v) => {
  if (v % 3 === 0) { const t1 = r.int(3, 6), t2 = -r.int(1, 2); // -16(t - t1)(t - t2) = -16t^2 + 16(t1+t2) t - 16 t1 t2
    const b = 16 * (t1 + t2), c = -16 * t1 * t2; need(b > 0);
    const h = poly([[-16, 't^2'], [b, 't'], [c, '']]);
    return { stem: `<p>A ball is thrown upward from the top of a building. The height ${m('h')}, in feet, of the ball above the ground ${m('t')} seconds after it is thrown is given by ${m(`h(t) = ${h}`)}. How many seconds after it is thrown does the ball hit the ground?</p>`, answer: spr(t1),
      explanation: `Set ${m('h(t) = 0')}: ${m(`-16(${quad(1, -(t1 + t2), t1 * t2, 't')}) = 0`)}, so ${m(`-16(t - ${t1})(t + ${-t2}) = 0`)}. The positive solution is ${m(`t = ${t1}`)}.`, verify: () => eqHolds(`${h} = 0`, { t: t1 }) }; }
  if (v % 3 === 1) { const T = r.int(2, 5), h0 = r.pick([0, 6, 10, 20]); const b = 32 * T; const H = 16 * T * T + h0;
    return { stem: `<p>The height ${m('h')}, in feet, of a projectile ${m('t')} seconds after it is launched is modeled by ${m(`h(t) = ${poly([[-16, 't^2'], [b, 't'], [h0, '']])}`)}. What is the maximum height, in feet, of the projectile?</p>`, answer: spr(H),
      explanation: `The maximum occurs at the vertex, ${m(`t = -\\frac{${b}}{2(-16)} = ${T}`)}. Then ${m(`h(${T}) = -16(${T * T}) + ${b}(${T})${h0 ? ' + ' + h0 : ''} = ${H}`)}.`, verify: () => -16 * T * T + b * T + h0 === H }; }
  const t1 = r.int(1, 3), t2 = t1 + r.int(1, 4); const b = 16 * (t1 + t2); const Hh = 16 * t1 * t2;
  return { stem: `<p>The height, in feet, of a rocket ${m('t')} seconds after launch is modeled by ${m(`h(t) = -16t^2 + ${b}t`)}. The rocket is at a height of ${Hh} feet twice: once on the way up and once on the way down. How many seconds after launch is the rocket at this height on the way down?</p>`, answer: spr(t2),
    explanation: `Solve ${m(`-16t^2 + ${b}t = ${Hh}`)}: ${m(`16t^2 - ${b}t + ${Hh} = 0`)}, so ${m(`t^2 - ${t1 + t2}t + ${t1 * t2} = 0`)} and ${m(`(t - ${t1})(t - ${t2}) = 0`)}. On the way down is the later time, ${m(`t = ${t2}`)}.`, verify: () => -16 * t2 * t2 + b * t2 === Hh && -16 * t1 * t1 + b * t1 === Hh };
});

def('exp-equation', 3, 'mcq', 4, SK.ne, (r, v) => {
  if (v % 3 === 0) { const B = r.pick([[4, 8, 2, 3], [9, 27, 2, 3], [8, 16, 3, 4], [25, 125, 2, 3]]); const [p, q, e1, e2] = B; // p^a = q^b -> e1 a = e2 b -> a/b = e2/e1
    const ratio = F(e2, e1);
    return { stem: `<p>If ${m(`${p}^{a} = ${q}^{b}`)} and ${m('b \\ne 0')}, what is the value of ${m('\\frac{a}{b}')}?</p>`, ...numCh([ratio, F(e1, e2), F(q, p), F(e1 * e2)]),
      explanation: `Write both sides with the same base: ${m(`${p} = ${Math.round(Math.pow(p, 1 / e1))}^{${e1}}`)} and ${m(`${q} = ${Math.round(Math.pow(q, 1 / e2))}^{${e2}}`)}, so ${m(`${e1}a = ${e2}b`)} and ${m(`\\frac{a}{b} = ${ratio.tex()}`)}.`, verify: () => close(Math.log(p) * ratio.val(), Math.log(q)) }; }
  if (v % 3 === 1) { const s = r.int(10, 30); const c = r.pick([[2, 4, 3, 2], [3, 9, 3, 2]]); const [b, b2, cx, cy] = c;
    return { stem: `<p>If ${m(`${b}^{${cx}x} \\cdot ${b2}^{y} = ${b}^{${s}}`)}, what is the value of ${m(`${cx}x + ${cy}y`)}?</p>`, ...numCh([s, s / 2, s * 2, s - 2]),
      explanation: `${m(`${b2}^{y} = (${b}^2)^{y} = ${b}^{2y}`)}, so ${m(`${b}^{${cx}x + 2y} = ${b}^{${s}}`)} and ${m(`${cx}x + 2y = ${s}`)}.`, verify: () => cy === 2 }; }
  const n = r.pick([2, 3]), d = r.pick([2, 3]), base = r.int(2, 4); need(n !== d); const x = Math.pow(base, d); const rhs = Math.pow(base, n);
  const eT = `x^{\\frac{${n}}{${d}}} = ${rhs}`;
  return { stem: `<p>${m(eT)}</p><p>What is the positive solution to the given equation?</p>`, ...numCh([x, rhs, Math.pow(rhs, n / d) % 1 === 0 ? Math.pow(rhs, n / d) : rhs * d, Math.abs(Math.pow(rhs, 1 / d) % 1) < 1e-9 ? Math.round(Math.pow(rhs, 1 / d)) : rhs * n]),
    explanation: `Raise both sides to the power ${m(`\\frac{${d}}{${n}}`)}: ${m(`x = ${rhs}^{\\frac{${d}}{${n}}} = (${base}^{${n}})^{\\frac{${d}}{${n}}} = ${base}^{${d}} = ${x}`)}.`, verify: () => close(Math.pow(x, n / d), rhs) };
});

def('percent-exp-time', 3, 'mcq', 4, SK.nf, (r, v) => {
  if (v % 3 === 0) { const g = r.pick([2, 3, 4, 5]), P = r.pick([2000, 4000, 6000]); const b = 1 + g / 100; const yr = +(100 * (b * b - 1)).toFixed(2);
    return { stem: `<p>The value of an investment, in dollars, ${m('m')} months after it was made is modeled by ${m(`V(m) = ${texInt(P)}(1.0${g})^{\\frac{m}{6}}`)}. According to the model, by approximately what percent does the value of the investment increase every 12 months?</p>`,
      ...numCh([yr, 2 * g, g, 12 * g], (z) => z + '%'), explanation: `12 months is two 6-month periods, so the value is multiplied by ${m(`(1.0${g})^{2} = ${+(b * b).toFixed(4)}`)} every 12 months. That is an increase of about ${yr}%.`, verify: () => close(Math.pow(b, 12 / 6), 1 + yr / 100) }; }
  if (v % 3 === 1) { const k = r.pick([6, 8, 10, 12]), A = r.pick([80, 160, 240]), n = r.pick([2, 3]);
    return { stem: `<p>The amount, in milligrams, of a medication remaining in a patient's bloodstream ${m('t')} hours after an injection is modeled by ${m(`M(t) = ${A}(0.5)^{\\frac{t}{${k}}}`)}. According to the model, what percent of the initial amount remains ${n * k} hours after the injection?</p>`,
      ...numCh([100 / 2 ** n, 100 - 100 / 2 ** n, 100 / 2 ** (n + 1), 50], (z) => z + '%'), explanation: `${n * k} hours is ${n} half-lives, so the remaining fraction is ${m(`(0.5)^{${n}} = ${1 / 2 ** n}`)}, or ${100 / 2 ** n}% of the initial amount.`, verify: () => close(Math.pow(0.5, n * k / k), 1 / 2 ** n) }; }
  const d = r.pick([10, 20, 30]); const b = 1 - d / 100; const B2 = +(b * b).toFixed(2); const P = r.pick([500, 900, 1200]);
  return { stem: `<p>The number of insects in a population ${m('y')} years after a study began is modeled by ${m(`N(y) = ${texInt(P)}(${B2})^{y}`)}. Which of the following describes how the population changes every half year, according to the model?</p>`,
    choices: [`It decreases by ${d}%.`, `It decreases by ${Math.round(100 - B2 * 100)}%.`, `It decreases by ${Math.round((100 - B2 * 100) / 2 * 10) / 10}%.`, `It decreases by ${100 - d}%.`],
    explanation: `${m(`${B2} = (${b})^2`)}, so ${m(`N(y) = ${texInt(P)}(${b})^{2y}`)}, and ${m('2y')} counts half-years. Each half year the population is multiplied by ${b}, a decrease of ${d}%.`, verify: () => close(b * b, B2) };
});

module.exports = out;
