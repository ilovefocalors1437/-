#!/usr/bin/env node
/*
 * Node tests for the Graphing Calculator math engine (www/calc/parser.js).
 *   node tools/calc-tests/run.js
 */
'use strict';
const path = require('path');
require(path.resolve(__dirname, '../../www/calc/parser.js'));
const C = globalThis.SatCalcCore;

let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) pass++; else { fail++; console.log('FAIL: ' + msg); } }
function close(a, b, tol, msg) {
  const good = typeof a === 'number' && typeof b === 'number' && (Math.abs(a - b) <= (tol == null ? 1e-9 : tol) * Math.max(1, Math.abs(b)) || (isNaN(a) && isNaN(b)));
  ok(good, (msg || '') + ' expected ' + b + ' got ' + a);
}
function ev(text, opts) { return C.evaluate(text, opts).value; }
function evc(text, expected, opts, tol) {
  let v;
  try { v = ev(text, opts); } catch (e) { ok(false, text + ' threw ' + e.message); return; }
  if (Array.isArray(expected)) {
    ok(Array.isArray(v) && v.length === expected.length && v.every((x, i) => Math.abs(x - expected[i]) < 1e-9), text + ' expected [' + expected + '] got ' + JSON.stringify(v));
  } else if (typeof expected === 'boolean') ok(v === expected, text + ' expected ' + expected + ' got ' + v);
  else close(v, expected, tol, text);
}
function throwsErr(text, re, opts) {
  try { C.evaluate(text, opts); ok(false, text + ' should throw'); } catch (e) { ok(e.calc === true && (!re || re.test(e.message)), text + ' error message: ' + e.message); }
}
function analyze(lines, opts) {
  const items = lines.map((t, i) => (typeof t === 'string' ? { id: i, type: 'expr', text: t } : Object.assign({ id: i }, t)));
  return C.analyze(items, opts);
}
function kinds(lines, opts) { const A = analyze(lines, opts); return lines.map((_, i) => A.results.get(i).kind); }
function res(lines, i, opts) { return analyze(lines, opts).results.get(i); }

// ------------------------------------------------------------------ arithmetic & precedence
evc('1+2*3', 7);
evc('(1+2)*3', 9);
evc('-2^2', -4);
evc('(-2)^2', 4);
evc('2^3^2', 512);
evc('2^-1', 0.5);
evc('-3--2', -1);
evc('2*-3', -6);
evc('10/4/5', 0.5);
evc('1/2*4', 2);
evc('2^2*3', 12);
evc('-x^2', -9, { vars: { x: 3 } });
evc('3!', 6);
evc('0!', 1);
evc('5!/3!', 20);
evc('(2+3)!', 120);
evc('2^3!', 64);
evc('50%', 0.5);
evc('2E3', 2000);
evc('1.5E-2', 0.015);
evc('.5+.25', 0.75);
evc('2x^2', 18, { vars: { x: 3 } });
evc('x²', 9, { vars: { x: 3 } });
evc('6÷3×2', 4);
evc('5−2', 3);

// ------------------------------------------------------------------ implicit multiplication
const V = { vars: { x: 2, y: 5, a: 3 } };
evc('2x', 4, V);
evc('3(x+1)', 9, V);
evc('x(x-1)', 2, V);
evc('2sin(0)+1', 1, V);
evc('xy', 10, V);
evc('2xy', 20, V);
evc('(x+1)(x-1)', 3, V);
evc('2pi', 2 * Math.PI);
evc('πx', 2 * Math.PI, V);
evc('ax^2', 12, V);
evc('2|x-5|', 6, V);
evc('|x|y', 10, V);
evc('3sqrt(4)', 6);
evc('sin x', Math.sin(2), V);
evc('sin 2x', Math.sin(4), V);
evc('sin^2(x)+cos^2(x)', 1, V);
evc('2(3)(4)', 24);
evc('x/2y', 5, V); // left-to-right: (x/2)*y
evc('e^2', Math.exp(2));
evc('ex', Math.E * 2, V);
evc('√16', 4);
evc('√(9)x', 6, V);

// ------------------------------------------------------------------ functions
evc('sin(pi/2)', 1);
evc('cos(0)', 1);
evc('tan(pi/4)', 1);
evc('csc(pi/2)', 1);
evc('sec(0)', 1);
evc('cot(pi/4)', 1);
evc('arcsin(1)', Math.PI / 2);
evc('asin(1)', Math.PI / 2);
evc('arccos(0)', Math.PI / 2);
evc('arctan(1)', Math.PI / 4);
evc('sin^-1(1)', Math.PI / 2);
evc('arctan(1,1)', Math.PI / 4);
evc('sinh(0)', 0);
evc('cosh(0)', 1);
evc('tanh(0)', 0);
evc('ln(e)', 1);
evc('ln(e^3)', 3);
evc('log(1000)', 3);
evc('log_2(8)', 3);
evc('log_{10}(0.01)', -2);
evc('log_3 81', 4);
evc('exp(1)', Math.E);
evc('sqrt(2)^2', 2);
evc('cbrt(-27)', -3);
evc('nthroot(16,4)', 2);
evc('nthroot(-32,5)', -2);
evc('abs(-3.5)', 3.5);
evc('floor(-2.5)', -3);
evc('ceil(2.1)', 3);
evc('round(2.5)', 3);
evc('round(-2.5)', -3);
evc('round(3.14159,2)', 3.14);
evc('sign(-4)', -1);
evc('mod(7,3)', 1);
evc('mod(-7,3)', 2);
evc('gcd(12,18)', 6);
evc('lcm(4,6)', 12);
evc('nCr(5,2)', 10);
evc('nPr(5,2)', 20);
evc('nCr(52,5)', 2598960);
evc('factorial(4)', 24);
evc('min(3,1,2)', 1);
evc('max(3,1,2)', 3);
evc('(-8)^(1/3)', -2);
evc('(-8)^(2/3)', 4);
ok(isNaN(ev('(-8)^(1/2)')), '(-8)^(1/2) is undefined');
ok(isNaN(ev('sqrt(-1)')), 'sqrt(-1) is undefined');
close(ev('0.5!'), Math.sqrt(Math.PI) / 2, 1e-9, 'gamma(1.5)');

// degree mode
const D = { deg: true };
evc('sin(30)', 0.5, D);
evc('cos(60)', 0.5, D);
evc('tan(45)', 1, D);
evc('sin(180)', 0, D);
evc('arcsin(0.5)', 30, D, 1e-9);
evc('arctan(1)', 45, D, 1e-9);
evc('sin(30°)', 0.5);
evc('sin(90°)', 1, D);
ok(isNaN(ev('tan(90)', D)), 'tan(90°) undefined');

// ------------------------------------------------------------------ lists & stats
evc('[1,2,3]', [1, 2, 3]);
evc('[1...5]', [1, 2, 3, 4, 5]);
evc('[1,3,...,9]', [1, 3, 5, 7, 9]);
evc('[5...1]', [5, 4, 3, 2, 1]);
evc('total([1...100])', 5050);
evc('[1,2,3]*2', [2, 4, 6]);
evc('[1,2,3]+[10,20,30]', [11, 22, 33]);
evc('[1,2,3]^2', [1, 4, 9]);
evc('sqrt([4,9])', [2, 3]);
evc('mean([1,2,3,4])', 2.5);
evc('mean(1,2,3)', 2);
evc('median([5,1,3])', 3);
evc('median([4,1,3,2])', 2.5);
evc('min([4,1,3])', 1);
evc('max([4,1,3])', 4);
evc('stdev([2,4,4,4,5,5,7,9])', 2.138089935299395);
evc('stdevp([2,4,4,4,5,5,7,9])', 2);
evc('var([1,2,3,4])', 5 / 3);
evc('length([1,2,3,7])', 4);
evc('sort([3,1,2])', [1, 2, 3]);
evc('quartile([1,2,3,4,5,6,7,8],1)', 2.5);
evc('quartile([1,2,3,4,5,6,7,8],3)', 6.5);
evc('quartile([1,2,3,4,5,6,7],1)', 2);
evc('[10,20,30][2]', 20);
evc('L[3]', 7, { vars: { L: [5, 6, 7] } });
evc('mean(L)+1', 7, { vars: { L: [5, 6, 7] } });

// ------------------------------------------------------------------ piecewise & comparisons
evc('{1<2: 5, 7}', 5);
evc('{1>2: 5, 7}', 7);
ok(isNaN(ev('{1>2: 5}')), 'piecewise without else is undefined');
evc('{x<0: -x, x>=0: x^2}', 9, { vars: { x: 3 } });
evc('{x<0: -x, x>=0: x^2}', 3, { vars: { x: -3 } });
evc('x^2 {x>0}', 4, { vars: { x: 2 } });
ok(isNaN(ev('x^2 {x>0}', { vars: { x: -2 } })), 'restriction false -> undefined');
evc('{-2<=x<=3: 1, 0}', 1, { vars: { x: 3 } });
evc('{-2<=x<=3: 1, 0}', 0, { vars: { x: 3.5 } });
evc('{x>0, x<5}', 1, { vars: { x: 1 } });
ok(isNaN(ev('{x>0, x<5}', { vars: { x: 6 } })), 'restriction with two conditions');
ok(ev('1<2<3') === true && ev('1<3<2') === false, 'chained comparison values');
ok(ev('0.1+0.2=0.3') === true, 'equality with tolerance');

// ------------------------------------------------------------------ points
const pt = ev('(1,2)+(3,4)');
ok(pt instanceof C.Pt && pt.x === 4 && pt.y === 6, 'point addition');
const pt2 = ev('2(1,3)');
ok(pt2 && pt2.x === 2 && pt2.y === 6, 'scalar * point');
evc('(3,4).x', 3);
const lp = ev('([1,2,3],[4,5,6])');
ok(Array.isArray(lp) && lp.length === 3 && lp[2].x === 3 && lp[2].y === 6, 'list of points via broadcasting');

// ------------------------------------------------------------------ errors
throwsErr('2+', /Incomplete/);
throwsErr('(1+2', /Missing '\)'/);
throwsErr('1+2)', /Unmatched/);
throwsErr('sin()', /takes 1 argument/);
throwsErr('nCr(5)', /takes 2/);
throwsErr('2 $ 3', /Unexpected character/);
throwsErr('foo(2)+q', /Undefined/);
throwsErr('[1,2]<3', /lists/);
throwsErr('{x}', /comparison|Undefined/);
throwsErr('(1,2,3)', /2D/);
throwsErr('[1...]', /Range|Incomplete|Unexpected/);
throwsErr('log_(8)', /log base|Unexpected|argument/);
let e1 = null;
try { C.evaluate('a+b'); } catch (e) { e1 = e; }
ok(e1 && e1.missing && e1.missing.join(',') === 'a,b', 'missing names reported for sliders');

// ------------------------------------------------------------------ LaTeX
const tex = (s) => C.toLatex(C.parse(s));
ok(tex('(x+1)/(x-2)') === '\\frac{x+1}{x-2}', 'latex fraction: ' + tex('(x+1)/(x-2)'));
ok(tex('sqrt(x)') === '\\sqrt{x}', 'latex sqrt');
ok(tex('x^2') === '{x}^{2}', 'latex power');
ok(tex('y<=2x') === 'y\\le 2x', 'latex le: ' + tex('y<=2x'));
ok(tex('x_1') === 'x_{1}', 'latex subscript');
ok(/\\theta/.test(tex('r=1+cos(θ)')), 'latex theta');
ok(/\\left\|/.test(tex('|x|')), 'latex abs');
ok(/\\log_\{2\}/.test(tex('log_2(8)')), 'latex log base');
ok(/\\left\\\{/.test(tex('{x<0:-x, x}')), 'latex piecewise');

// ------------------------------------------------------------------ formatting / fractions
ok(C.formatNumber(0.1 + 0.2) === '0.3', 'format 0.1+0.2');
ok(C.formatNumber(1 / 3) === '0.3333333333', 'format 1/3: ' + C.formatNumber(1 / 3));
ok(C.formatNumber(Math.sin(Math.PI)) === '0', 'format sin(pi) as 0');
ok(C.formatNumber(1.5e15) === '1.5×10¹⁵', 'format large: ' + C.formatNumber(1.5e15));
ok(C.formatNumber(2.5e-8) === '2.5×10⁻⁸', 'format small: ' + C.formatNumber(2.5e-8));
ok(C.formatCoord(1.4999999999) === '1.5' && C.formatCoord(-0.25) === '-0.25' && C.formatCoord(Math.sqrt(2)) === '1.414', 'format coords');
let fr = C.toFraction(0.75);
ok(fr && fr.n === 3 && fr.d === 4, '0.75 -> 3/4');
fr = C.toFraction(1 / 3 + 1 / 4);
ok(fr && fr.n === 7 && fr.d === 12, '1/3+1/4 -> 7/12');
ok(C.toFraction(Math.PI) === null, 'pi is not a simple fraction');
fr = C.toFraction(-2.5);
ok(fr && fr.n === -5 && fr.d === 2, '-2.5 -> -5/2');

// ------------------------------------------------------------------ line classification
ok(JSON.stringify(kinds(['y=2x^2-3x+1', 'x^2-4', 'x=y^2', 'sqrt(2)*3', 'x^2+y^2=25', 'y>2x+1', '(2,3)', '(1,2),(3,4)'])) ===
  JSON.stringify(['explicit', 'explicit', 'explicitx', 'value', 'implicit', 'ineq', 'points', 'points']), 'basic classification');
ok(JSON.stringify(kinds(['(cos(t),sin(t))', 'r=1+cos(θ)', 'r=1+cos(theta)', 'x^2/9-y^2/4=1', 'sin(x)=cos(y)', '2x+3y=12', 'y<=x^2', 'x^2+y^2<16', 'x=3', 'y=5'])) ===
  JSON.stringify(['parametric', 'polar', 'polar', 'implicit', 'implicit', 'implicit', 'ineq', 'ineq', 'explicitx', 'explicit']), 'more classification');
ok(JSON.stringify(kinds(['f(x)=x^2-1', 'g(x)=f(x-2)+3', 'g(2)', 'a=3', 'y=ax', 'L=[1,2,3]', 'h(x,y)=x+y', 'h(1,2)'])) ===
  JSON.stringify(['explicit', 'explicit', 'value', 'slider', 'explicit', 'var', 'fn', 'value']), 'definitions classification');
close(res(['f(x)=x^2-1', 'g(x)=f(x-2)+3', 'g(2)'], 2).value, 2, 0, 'g(2) via f');
close(res(['f(x)=x^2-1', 'g(x)=f(x-2)+3'], 1).fns[0](5), 11, 0, 'g(5) plot function');
close(res(['f(x)=x^3', "f'(2)"], 1).value, 12, 1e-6, "f'(2) numeric derivative");
close(res(['f(x)=x^3', "f''(2)"], 1).value, 12, 1e-4, "f''(2)");
close(res(['f(x)=sin(x)', "y=f'(x)"], 1).fns[0](0), 1, 1e-8, "y=f'(x) plots cos");
let r = res(['y=ax+b'], 0);
ok(r.kind === 'error' && r.missing.join(',') === 'a,b', 'undefined params -> slider suggestions');
r = res(['y=t x'], 0);
ok(r.kind === 'error' && r.missing[0] === 't', 't outside parametric suggests slider');
r = res(['a=b', 'b=a'], 0);
ok(r.kind === 'error' && /itself/.test(r.error), 'cyclic definitions error: ' + r.error);
r = res(['a=1', 'a=2'], 0);
ok(r.kind === 'error' && /more than once/.test(r.error), 'duplicate definitions error');
r = analyze(['y=2x+', 'y=x^2', 'sin(']);
ok(r.results.get(0).kind === 'error' && r.results.get(1).kind === 'explicit' && r.results.get(2).kind === 'error', 'one bad line does not break others');
r = res(['y=[1,2,3]x'], 0);
ok(r.kind === 'explicit' && r.fns.length === 3 && r.fns[2](2) === 6, 'list broadcasting draws 3 lines');
r = res(['a=2', '(a,a^2)'], 1);
ok(r.kind === 'points' && r.pts[0][0] === 2 && r.pts[0][1] === 4, 'point using a variable');
r = res(['2+2=4'], 0);
ok(r.kind === 'value' && r.value === true, 'constant equation is checked');
r = res(['x^2+y^2'], 0);
ok(r.kind === 'error' && /=/.test(r.error), 'bare x,y expression asks for =');
r = res(['y=x^2 {x>0}'], 0);
ok(isNaN(r.fns[0](-1)) && r.fns[0](2) === 4, 'domain restriction on explicit');
r = res(['y={x<0: -x, x>=0: x^2}'], 0);
ok(r.fns[0](-3) === 3 && r.fns[0](3) === 9, 'piecewise explicit');
r = res(['x^2+y^2=25 {y>0}'], 0);
ok(r.kind === 'implicit' && isNaN(r.Fs[0](0, -5)) && r.Fs[0](0, 5) === 0, 'restricted implicit');
r = res(['y>2x+1'], 0);
ok(r.Fs[0](0, 2) > 0 && r.Fs[0](0, 0) < 0 && r.strict === true, 'inequality margin sign');
r = res(['1<x^2+y^2<=4'], 0);
ok(r.Fs[0](1.5, 0) > 0 && r.Fs[0](0.5, 0) < 0 && r.Fs[0](3, 0) < 0 && r.strict === false, 'two-sided inequality');
r = res(['y=sin(x)'], 0, { deg: true });
close(r.fns[0](90), 1, 1e-12, 'degree mode applies to graphs');

// codegen fast path must agree with closure evaluation
const cgExprs = ['y=2x^2-3x+1', 'y=sin(x)/x', 'y=x^(1/3)', 'y={x<0: -x, x>=0: x^2}', 'y=floor(x)+abs(x-1)', 'y=log_2(x)+ln(x)', 'y=nCr(5,2)x+mod(x,3)', 'y=(x+1)/(x-2)', 'y=x^2 {-1<x<2}', 'y=round(x,1)+sign(x)'];
cgExprs.forEach((t) => {
  const fast = res([t], 0).fns[0];
  const slow = res([t], 0, { codegen: false }).fns[0];
  let same = true;
  for (let x = -5; x <= 5; x += 0.37) { const a = fast(x), b = slow(x); if (!(a === b || (isNaN(a) && isNaN(b)) || Math.abs(a - b) < 1e-12)) same = false; }
  ok(same, 'codegen agrees with closures for ' + t);
});
const cgImp = ['x^2/9-y^2/4=1', 'sin(x)=cos(y)'];
cgImp.forEach((t) => {
  const fast = res([t], 0).Fs[0], slow = res([t], 0, { codegen: false }).Fs[0];
  ok(fast(1.3, -0.7) === slow(1.3, -0.7), 'codegen implicit agrees ' + t);
});

// ------------------------------------------------------------------ tables & regression
const T1 = { type: 'table', columns: [{ header: 'x_1', values: ['1', '2', '3', '4', '5'] }, { header: 'y_1', values: ['3', '5', '7', '9', '11'] }, { header: '2x_1+1', values: [] }] };
r = analyze([T1, 'mean(y_1)', 'y_1 ~ m x_1 + b']);
let tr = r.results.get(0);
ok(tr.kind === 'table' && tr.series.length === 2 && tr.series[0].pts.length === 5, 'table points');
ok(tr.cols[2].computed && tr.cols[2].values.join(',') === '3,5,7,9,11', 'computed column 2x_1+1');
close(r.results.get(1).value, 7, 0, 'mean of table column');
let reg = r.results.get(2);
ok(reg.kind === 'regression', 'regression kind');
close(reg.params.m, 2, 1e-12, 'linear fit m');
close(reg.params.b, 1, 1e-12, 'linear fit b');
close(reg.r2, 1, 1e-12, 'linear fit r2');
close(reg.fns[0](10), 21, 1e-9, 'regression curve evaluates at x');
ok(reg.order.join(',') === 'm,b', 'params in order of appearance');
// noisy linear data (closed form check)
r = analyze([{ type: 'table', columns: [{ header: 'x_1', values: ['1', '2', '3', '4', '5'] }, { header: 'y_1', values: ['2.1', '3.9', '6.2', '7.8', '10.1'] }] }, 'y_1 ~ m x_1 + b']);
reg = r.results.get(1);
close(reg.params.m, 1.99, 1e-12, 'noisy linear m');
close(reg.params.b, 0.05, 1e-10, 'noisy linear b');
close(reg.r2, 1 - 0.107 / 39.708, 1e-9, 'noisy linear r2');
// quadratic
r = analyze([{ type: 'table', columns: [{ header: 'x_1', values: ['-2', '-1', '0', '1', '2', '3'] }, { header: 'y_1', values: ['9', '2', '-1', '0', '5', '14'] }] }, 'y_1 ~ a x_1^2 + b x_1 + c']);
reg = r.results.get(1);
close(reg.params.a, 2, 1e-9, 'quadratic a');
close(reg.params.b, -1, 1e-9, 'quadratic b');
close(reg.params.c, -1, 1e-9, 'quadratic c');
// exponential (non-linear, LM)
r = analyze([{ type: 'table', columns: [{ header: 'x_1', values: ['0', '1', '2', '3', '4'] }, { header: 'y_1', values: ['3', '6', '12', '24', '48'] }] }, 'y_1 ~ a b^{x_1}']);
reg = r.results.get(1);
ok(reg.kind === 'regression' && reg.linear === false, 'exponential is nonlinear');
close(reg.params.a, 3, 1e-6, 'exponential a');
close(reg.params.b, 2, 1e-6, 'exponential b');
close(reg.r2, 1, 1e-9, 'exponential r2');
// exponential with noise vs known least squares optimum (verified by gradient = 0)
r = analyze([{ type: 'table', columns: [{ header: 'x_1', values: ['0', '1', '2', '3', '4', '5'] }, { header: 'y_1', values: ['2.0', '2.9', '4.6', '6.7', '10.3', '15.1'] }] }, 'y_1 ~ a b^{x_1}']);
reg = r.results.get(1);
(function () {
  const xs = [0, 1, 2, 3, 4, 5], ys = [2.0, 2.9, 4.6, 6.7, 10.3, 15.1];
  const a = reg.params.a, b = reg.params.b;
  let ga = 0, gb = 0;
  xs.forEach((x, i) => { const rr = a * Math.pow(b, x) - ys[i]; ga += rr * Math.pow(b, x); gb += rr * a * x * Math.pow(b, x - 1); });
  ok(Math.abs(ga) < 1e-6 && Math.abs(gb) < 1e-6 && reg.r2 > 0.99, 'noisy exponential fit is a least-squares optimum (grad ' + ga + ',' + gb + ')');
})();
// fitted params usable elsewhere
r = analyze([T1, 'y_1 ~ m x_1 + b', 'm+b']);
close(r.results.get(2).value, 3, 1e-9, 'regression params available to other lines');
// regression with x instead of lists -> error
r = analyze(['y ~ m x + b']);
ok(r.results.get(0).kind === 'error', 'regression without lists is an error');
// table with variable header x and formula
r = analyze([{ type: 'table', columns: [{ header: 'x', values: ['1', '2', '3'] }, { header: 'x^2', values: [] }] }]);
ok(r.results.get(0).cols[1].values.join(',') === '1,4,9', 'table column formula in x');

// ------------------------------------------------------------------ points of interest
const view = { xmin: -10, xmax: 10, ymin: -10, ymax: 10, n: 800 };
const has = (list, x, y, type) => list.some((p) => Math.abs(p.x - x) < 1e-6 && Math.abs(p.y - y) < 1e-6 && (!type || p.type === type));
let f = res(['y=x^2-4'], 0).fns[0];
let P = C.findPOIs({ type: 'fx', f: f }, [], view);
ok(has(P, 2, 0, 'zero') && has(P, -2, 0, 'zero'), 'zeros of x^2-4');
ok(has(P, 0, -4), 'vertex/y-intercept of x^2-4');
f = res(['y=2x^2-3x+1'], 0).fns[0];
P = C.findPOIs({ type: 'fx', f: f }, [], view);
ok(has(P, 0.5, 0, 'zero') && has(P, 1, 0, 'zero') && has(P, 0.75, -0.125, 'min') && has(P, 0, 1, 'yint'), 'POIs of 2x^2-3x+1');
f = res(['y=(x-1)^2'], 0).fns[0];
P = C.findPOIs({ type: 'fx', f: f }, [], view);
ok(has(P, 1, 0), 'tangential zero (x-1)^2');
const g = res(['y=2x+1'], 0).fns[0];
f = res(['y=x^2-4'], 0).fns[0];
P = C.findPOIs({ type: 'fx', f: f }, [{ type: 'fx', f: g }], view);
ok(has(P, 1 + Math.sqrt(6), 3 + 2 * Math.sqrt(6), 'int') && has(P, 1 - Math.sqrt(6), 3 - 2 * Math.sqrt(6), 'int'), 'line/parabola intersections');
const circ = res(['x^2+y^2=25'], 0).Fs[0];
P = C.findPOIs({ type: 'fx', f: res(['y=x+1'], 0).fns[0] }, [{ type: 'F', F: circ }], view);
ok(has(P, 3, 4, 'int') && has(P, -4, -3, 'int'), 'line/circle intersections (3,4) and (-4,-3)');
P = C.findPOIs({ type: 'F', F: circ }, [], view);
ok(has(P, 5, 0, 'zero') && has(P, -5, 0, 'zero') && has(P, 0, 5, 'yint') && has(P, 0, -5, 'yint'), 'circle intercepts');
P = C.findPOIs({ type: 'fx', f: res(['y=tan(x)'], 0).fns[0] }, [], view);
ok(P.every((p) => Math.abs(p.y) < 10) && has(P, 0, 0) && has(P, Math.PI, 0) && !P.some((p) => p.type === 'zero' && Math.abs(Math.cos(p.x)) < 1e-3), 'tan: zeros only at kπ, none at asymptotes');
P = C.findPOIs({ type: 'fx', f: res(['y=1/x'], 0).fns[0] }, [], view);
ok(!P.some((p) => p.type === 'zero'), '1/x has no zeros');
P = C.findPOIs({ type: 'fx', f: res(['y=x^3-3x'], 0).fns[0] }, [], view);
ok(has(P, -1, 2, 'max') && has(P, 1, -2, 'min'), 'cubic extrema');
P = C.findPOIs({ type: 'fy', f: res(['x=y^2-4'], 0).fns[0] }, [], view);
ok(has(P, 0, 2) && has(P, 0, -2) && has(P, -4, 0), 'x=f(y) intercepts');
P = C.findPOIs({ type: 'fx', f: res(['y=x^2'], 0).fns[0] }, [{ type: 'fy', f: res(['x=2'], 0).fns[0] }], view);
ok(has(P, 2, 4, 'int'), 'intersection with vertical line x=2');

// ------------------------------------------------------------------ misc robustness
ok(C.analyze(null).results.size === 0, 'analyze(null)');
ok(C.analyze([null, 5, { type: 'expr' }]).results.size === 1, 'analyze garbage items');
ok(C.evaluate('').empty === true, 'empty evaluate');
let assignOk = C.evaluate('a=5');
ok(assignOk.assign === 'a' && assignOk.value === 5, 'scientific assignment');
evc('ans*2', 10, { ans: 5 });
const big = 'x+'.repeat(300) + '1';
ok(res(['y=' + big], 0).kind === 'explicit', 'long expression');

console.log(`calc core tests: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
