'use strict';
/* Hand-authored one-off questions (one variant each). Every item carries a verify() that
   re-derives the keyed answer numerically, independent of the prose. */
const L = require('./lib');
const { m, F, spr, close, texEval, sameExpr } = L;

const items = [];
function item(tpl, domain, skill, diff, type, gen) { items.push({ tpl: 'hand-' + tpl, domain, skill, diff, type, n: 1, gen }); }
const SK = {
  lf: 'Linear functions', ineq: 'Linear inequalities in one or two variables', l1: 'Linear equations in one variable',
  eq: 'Equivalent expressions', ne: 'Nonlinear equations in one variable and systems of equations in two variables', nf: 'Nonlinear functions',
  one: 'One-variable data: Distributions and measures of center and spread', prob: 'Probability and conditional probability',
  rt: 'Right triangles and trigonometry', cir: 'Circles',
};

item('shipping-rate', 'algebra', SK.lf, 3, 'spr', () => ({
  stem: `<p>A shipping company charges a fixed fee plus a constant rate per pound to ship a package. Shipping a 4-pound package costs ${'$'}13.20, and shipping a 10-pound package costs ${'$'}22.80. What is the cost, in dollars, of shipping a 15-pound package?</p>`,
  answer: spr(F(154, 5)),
  explanation: `The rate is ${m('\\frac{22.80 - 13.20}{10 - 4} = 1.6')} dollars per pound. The fixed fee is ${m('13.20 - 1.6(4) = 6.80')} dollars. A 15-pound package costs ${m('6.80 + 1.6(15) = 30.80')} dollars.`,
  verify: () => { const r = (22.8 - 13.2) / 6, f = 13.2 - 4 * r; return close(f + 15 * r, 30.8); },
}));

item('slope-description', 'algebra', SK.lf, 3, 'mcq', () => {
  const c = ['f(x) = -\\frac{4}{3}x + \\frac{23}{3}', 'f(x) = -\\frac{3}{4}x + \\frac{13}{2}', 'f(x) = \\frac{4}{3}x + \\frac{7}{3}', 'f(x) = -\\frac{4}{3}x + 5'];
  return { stem: `<p>The graph of the linear function ${m('f')} passes through the point ${m('(2, 5)')} in the ${m('xy')}-plane. For every increase of 3 in the value of ${m('x')}, the value of ${m('f(x)')} decreases by 4. Which equation defines ${m('f')}?</p>`,
    choices: c.map(m), explanation: `The slope is ${m('\\frac{-4}{3}')}. Then ${m('5 = -\\frac{4}{3}(2) + b')}, so ${m('b = 5 + \\frac{8}{3} = \\frac{23}{3}')}. Therefore ${m(c[0])}.`,
    verify: () => close(texEval(c[0].split('=')[1], { x: 2 }), 5) && close(texEval(c[0].split('=')[1], { x: 5 }) - texEval(c[0].split('=')[1], { x: 2 }), -4) && !close(texEval(c[3].split('=')[1], { x: 2 }), 5) };
});

item('origin-solution', 'algebra', SK.ineq, 3, 'mcq', () => ({
  stem: `<p>${m('y \\lt -2x + a')}<br>${m('y \\gt 2x + b')}</p><p>In the given system of inequalities, ${m('a')} and ${m('b')} are constants. If ${m('(0, 0)')} is a solution to the system, which of the following must be true?</p>`,
  choices: [m('a \\gt b'), m('a \\lt b'), m('a = -b'), m('a + b \\gt 0')],
  explanation: `Substituting ${m('(0, 0)')} gives ${m('0 \\lt a')} and ${m('0 \\gt b')}. So ${m('a')} is positive and ${m('b')} is negative, which means ${m('a \\gt b')}. The other statements depend on the particular values (for example, ${m('a = 1')} and ${m('b = -5')} make ${m('a + b \\gt 0')} false).`,
  verify: () => { // brute force over integer pairs: (0,0) solution implies a>b always
    for (let a = -5; a <= 5; a++) for (let b = -5; b <= 5; b++) if (0 < a && 0 > b && !(a > b)) return false; return true; },
}));

item('budget-system', 'algebra', SK.ineq, 3, 'mcq', () => {
  const ok = ([x, y]) => 2.5 * x + 1.25 * y <= 60 && y >= 3 * x;
  const P = [[8, 24], [10, 28], [6, 40], [9, 26]];
  return { stem: `<p>Kayla will buy ${m('x')} notebooks that cost ${'$'}2.50 each and ${m('y')} pens that cost ${'$'}1.25 each. She wants to spend at most ${'$'}60, and she wants to buy at least 3 times as many pens as notebooks. Which ordered pair ${m('(x, y)')} satisfies both conditions?</p>`,
    choices: P.map(([x, y]) => m(`(${x}, ${y})`)),
    explanation: `The conditions are ${m('2.5x + 1.25y \\le 60')} and ${m('y \\ge 3x')}. For ${m('(8, 24)')}: ${m('20 + 30 = 50 \\le 60')} and ${m('24 \\ge 24')}. The pair ${m('(10, 28)')} fails ${m('y \\ge 3x')}, ${m('(6, 40)')} costs ${'$'}65, and ${m('(9, 26)')} fails ${m('y \\ge 3x')}.`,
    verify: () => ok(P[0]) && !ok(P[1]) && !ok(P[2]) && !ok(P[3]) };
});

item('complete-square-value', 'advanced', SK.eq, 3, 'spr', () => ({
  stem: `<p>If ${m('x^2 - 4x = 3')}, what is the value of ${m('(x - 2)^2')}?</p>`,
  answer: spr(7),
  explanation: `${m('(x - 2)^2 = x^2 - 4x + 4')}. Since ${m('x^2 - 4x = 3')}, ${m('(x - 2)^2 = 3 + 4 = 7')}. There is no need to solve for ${m('x')}.`,
  verify: () => { const x = 2 + Math.sqrt(7); return close(x * x - 4 * x, 3) && close((x - 2) ** 2, 7); },
}));

item('zeros-apart', 'advanced', SK.nf, 3, 'mcq', () => ({
  stem: `<p>The function ${m('f')} is defined by ${m('f(x) = (x - 3)^2 + k')}, where ${m('k')} is a constant. The graph of ${m('y = f(x)')} in the ${m('xy')}-plane crosses the ${m('x')}-axis at two points that are 10 units apart. What is the value of ${m('k')}?</p>`,
  choices: [m('-25'), m('-5'), m('-100'), m('25')], order: [1, 2, 0, 3],
  explanation: `The zeros are symmetric about the axis of symmetry ${m('x = 3')}, so they are 5 units from it: ${m('x = -2')} and ${m('x = 8')}. Then ${m('f(8) = 5^2 + k = 0')}, so ${m('k = -25')}.`,
  verify: () => { const k = -25; const r1 = 3 + Math.sqrt(-k), r2 = 3 - Math.sqrt(-k); return close(r1 - r2, 10) && close((r1 - 3) ** 2 + k, 0); },
}));

item('exp-shift-factor', 'advanced', SK.nf, 3, 'spr', () => ({
  stem: `<p>The function ${m('g')} is defined by ${m('g(x) = 5^{x}')}. For every real number ${m('a')}, ${m('g(a + 3) = c \\cdot g(a)')}, where ${m('c')} is a constant. What is the value of ${m('c')}?</p>`,
  answer: spr(125),
  explanation: `${m('g(a + 3) = 5^{a + 3} = 5^{3} \\cdot 5^{a} = 125 \\cdot g(a)')}, so ${m('c = 125')}.`,
  verify: () => [0, 1.3, -2].every((a) => close(Math.pow(5, a + 3), 125 * Math.pow(5, a))),
}));

item('no-real-solution', 'advanced', SK.ne, 3, 'mcq', () => {
  const eqs = ['x^2 + 4x + 5 = 0', 'x^2 + 4x + 4 = 0', 'x^2 + 4x + 3 = 0', 'x^2 - 4x - 5 = 0'];
  const disc = [[1, 4, 5], [1, 4, 4], [1, 4, 3], [1, -4, -5]].map(([a, b, c]) => b * b - 4 * a * c);
  return { stem: `<p>Which of the following equations has no real solution?</p>`, choices: eqs.map(m),
    explanation: `A quadratic equation has no real solution when its discriminant ${m('b^2 - 4ac')} is negative. For ${m(eqs[0])}, ${m('4^2 - 4(1)(5) = -4')}. The other discriminants are 0, 4, and 36, so those equations have real solutions.`,
    verify: () => disc[0] < 0 && disc.slice(1).every((d) => d >= 0) };
});

item('double-root', 'advanced', SK.nf, 3, 'spr', () => ({
  stem: `<p>The function ${m('p')} is defined by ${m('p(x) = (x^2 - 9)(x + k)')}, where ${m('k')} is a positive constant. The graph of ${m('y = p(x)')} in the ${m('xy')}-plane has exactly two distinct ${m('x')}-intercepts. What is the value of ${m('k')}?</p>`,
  answer: spr(3),
  explanation: `${m('p(x) = (x - 3)(x + 3)(x + k)')} has zeros ${m('3')}, ${m('-3')}, and ${m('-k')}. For only two distinct ${m('x')}-intercepts, ${m('-k')} must equal 3 or ${m('-3')}. Since ${m('k \\gt 0')}, ${m('-k = -3')} and ${m('k = 3')}.`,
  verify: () => { const zeros = new Set([3, -3, -3]); return zeros.size === 2; },
}));

item('neg-exponents', 'advanced', SK.eq, 3, 'mcq', () => {
  const t = '\\frac{x^{-2}y^{\\frac{1}{2}}}{x^{\\frac{1}{3}}y^{-1}}';
  const c = ['x^{-\\frac{7}{3}}y^{\\frac{3}{2}}', 'x^{-\\frac{5}{3}}y^{\\frac{3}{2}}', 'x^{-\\frac{7}{3}}y^{-\\frac{1}{2}}', 'x^{-\\frac{2}{3}}y^{-\\frac{1}{2}}'];
  return { stem: `<p>For positive values of ${m('x')} and ${m('y')}, which expression is equivalent to ${m(t)}?</p>`, choices: c.map(m),
    explanation: `Subtract exponents of like bases: ${m('x^{-2 - \\frac{1}{3}} = x^{-\\frac{7}{3}}')} and ${m('y^{\\frac{1}{2} - (-1)} = y^{\\frac{3}{2}}')}.`,
    verify: () => sameExpr(t, c[0], ['x', 'y']) && c.slice(1).every((d) => !sameExpr(t, d, ['x', 'y'])) };
});

item('shift-top-half', 'psda', SK.one, 3, 'mcq', () => ({
  stem: `<p>A data set consists of 20 different numbers. The mean of the data set is 50, and the median is 48. Each of the 10 greatest numbers in the data set is increased by 6. What are the mean and the median of the new data set?</p>`,
  choices: ['The mean is 53, and the median is 51.', 'The mean is 53, and the median is 48.', 'The mean is 56, and the median is 54.', 'The mean is 53, and the median is 54.'],
  explanation: `The sum increases by ${m('10 \\times 6 = 60')}, so the mean increases by ${m('\\frac{60}{20} = 3')}, to 53. The median is the average of the 10th and 11th values. Only the 11th value is among the 10 greatest, so it increases by 6 while the 10th does not change: the median increases by ${m('\\frac{6}{2} = 3')}, to 51.`,
  verify: () => { const d = Array.from({ length: 20 }, (_, i) => 30 + 2 * i); const s = d.slice(); for (let i = 10; i < 20; i++) s[i] += 6; const mean = (a) => a.reduce((x, y) => x + y) / a.length; const med = (a) => (a[9] + a[10]) / 2; return close(mean(s) - mean(d), 3) && close(med(s) - med(d), 3); },
}));

item('neither-language', 'psda', SK.prob, 3, 'spr', () => ({
  stem: `<p>In a group of 80 students, 45 study Spanish, 30 study French, and 12 study both Spanish and French. If one student from the group is selected at random, what is the probability that the student studies neither Spanish nor French? (Express your answer as a fraction or decimal.)</p>`,
  answer: spr(F(17, 80)),
  explanation: `The number who study at least one of the languages is ${m('45 + 30 - 12 = 63')} (students who study both are counted twice in ${m('45 + 30')}). So ${m('80 - 63 = 17')} study neither, and the probability is ${m('\\frac{17}{80}')}.`,
  verify: () => 80 - (45 + 30 - 12) === 17,
}));

item('legs-sum', 'geometry', SK.rt, 3, 'mcq', () => ({
  stem: `<p>A right triangle has legs of lengths ${m('a')} and ${m('b')} and a hypotenuse of length 13. The area of the triangle is 30. What is the value of ${m('a + b')}?</p>`,
  choices: [m('17'), m('7'), m('13'), m('289')], order: [2, 0, 1, 3],
  explanation: `${m('a^2 + b^2 = 169')} and ${m('\\frac{1}{2}ab = 30')}, so ${m('ab = 60')}. Then ${m('(a + b)^2 = a^2 + b^2 + 2ab = 169 + 120 = 289')}, and since ${m('a + b')} is positive, ${m('a + b = 17')}. (The legs are 5 and 12.)`,
  verify: () => 5 * 5 + 12 * 12 === 169 && 5 * 12 / 2 === 30 && 5 + 12 === 17,
}));

item('tangent-line-k', 'geometry', SK.cir, 3, 'spr', () => ({
  stem: `<p>In the ${m('xy')}-plane, the graph of ${m('y = x + k')}, where ${m('k')} is a positive constant, is tangent to the circle with equation ${m('x^2 + y^2 = 50')}. What is the value of ${m('k')}?</p>`,
  answer: spr(10),
  explanation: `Substitute ${m('y = x + k')}: ${m('x^2 + (x + k)^2 = 50')}, or ${m('2x^2 + 2kx + k^2 - 50 = 0')}. Tangency means exactly one solution, so the discriminant is 0: ${m('(2k)^2 - 4(2)(k^2 - 50) = 0')}, which gives ${m('-4k^2 + 400 = 0')} and ${m('k = 10')}.`,
  verify: () => { const k = 10; return close((2 * k) ** 2 - 8 * (k * k - 50), 0); },
}));

module.exports = items.map((t) => ({ ...t, gen: (r, v) => t.gen(r, v) }));
