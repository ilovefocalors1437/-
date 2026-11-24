'use strict';
const L = require('./lib');
const { valOf, m, num, F, fr, need, assert, spr, sprDec, numCh, close, figure, plane, NOTE, it, txt, line, dot, texInt, commas, decStr, pn, poly, lin } = L;

const SK = {
  av: 'Area and volume',
  lat: 'Lines, angles, and triangles',
  rt: 'Right triangles and trigonometry',
  cir: 'Circles',
};
const out = [];
function def(tpl, diff, type, n, skill, gen) { out.push({ tpl: 'geo-' + tpl, domain: 'geometry', diff, type, n, skill, gen }); }
const isInt = Number.isInteger;
const DEG = '^\\circ';
const D = (x) => `${x}°`; // svg degree label
const rad = (d) => d * Math.PI / 180;
const TRIPLES = [[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25], [6, 8, 10], [9, 12, 15], [20, 21, 29], [9, 40, 41]];
// pi-multiple formatting: k*pi with k a Fr
function piTex(k) { k = fr(k); if (k.eq(0)) return '0'; if (k.d === 1) return (k.n === 1 ? '' : k.n === -1 ? '-' : texInt(k.n)) + '\\pi'; return (k.n < 0 ? '-' : '') + `\\frac{${Math.abs(k.n) === 1 ? '' : Math.abs(k.n)}\\pi}{${k.d}}`; }
function radTex(n) { let o = 1, i = n; for (let k = 2; k * k <= i; k++) while (i % (k * k) === 0) { i /= k * k; o *= k; } return i === 1 ? String(o) : (o === 1 ? '' : o) + `\\sqrt{${i}}`; }

/* right triangle figure: right angle at C, legs along axes */
function rightTri(a, b, labs, opts = {}) { // a = BC (vertical), b = AC (horizontal)
  const P = { C: [0, 0], A: [b, 0], B: [0, a] };
  return figure({ pts: P, segs: [['A', 'B'], ['B', 'C'], ['C', 'A']], right: [['A', 'C', 'B']], labels: { A: 'A', B: 'B', C: 'C', ...(opts.names || {}) },
    sideLabels: labs, angleLabels: opts.angles || [], W: 260, H: opts.H || 190, arcs: opts.arcs });
}
/* triangle from two base angles (degrees) */
function triAngles(A, B) { const C = 180 - A - B; const c = 1; const b = Math.sin(rad(B)) / Math.sin(rad(C)) * c; return { A: [0, 0], B: [c, 0], C: [b * Math.cos(rad(A)), b * Math.sin(rad(A))] }; }
/* circle with center O and named points at given angles (degrees) */
function circleFig(R, pts, opts = {}) {
  const P = { O: [0, 0] };
  for (const [k, ang] of Object.entries(pts)) P[k] = [R * Math.cos(rad(ang)), R * Math.sin(rad(ang))];
  Object.assign(P, opts.extraPts || {});
  return figure({ pts: P, bounds: [[-R, R], [-R, R]], center: [0, 0], segs: opts.segs || [], labels: opts.labels || Object.fromEntries(Object.keys(pts).map((k) => [k, k])), dots: ['O', ...Object.keys(pts)],
    angleLabels: opts.angles || [], sideLabels: opts.sides || [], right: opts.right || [], W: 240, H: 240, pad: 26, labelCenter: opts.labelCenter,
    under: (X, Y, s) => `<circle cx='${L.dot ? Math.round(X(0) * 10) / 10 : 0}' cy='${Math.round(Y(0) * 10) / 10}' r='${Math.round(R * s * 10) / 10}' fill='none' stroke='#000' stroke-width='1.6'/>` + (opts.under ? opts.under(X, Y, s) : ''),
    extra: (X, Y) => { // put the O label opposite the average direction of the segments drawn from O
      let dx = 0, dy = 0; for (const sg of opts.segs || []) { const o = sg[0] === 'O' ? sg[1] : sg[1] === 'O' ? sg[0] : null; if (!o) continue; const L0 = Math.hypot(P[o][0], P[o][1]); dx += P[o][0] / L0; dy += P[o][1] / L0; }
      let L1 = Math.hypot(dx, dy); if (L1 < 0.3) { dx = 1; dy = -1; L1 = Math.SQRT2; }
      return txt(X(0) - dx / L1 * 13, Y(0) + dy / L1 * 13, 'O', { size: 13, halo: true }) + (opts.extra ? opts.extra(X, Y) : ''); } });
}

/* ============================ EASY ============================ */
def('area-basic', 1, 'mcq', 2, SK.av, (r, v) => {
  if (v === 0) { const b = r.int(4, 20), h = r.int(3, 15); need((b * h) % 2 === 0);
    const P = { A: [0, 0], B: [b, 0], C: [b * 0.35, h], H: [b * 0.35, 0] };
    const svg = figure({ pts: P, segs: [['A', 'B'], ['B', 'C'], ['C', 'A'], ['C', 'H', 'dash']], right: [['B', 'H', 'C']], sideLabels: [['A', 'B', String(b)], ['C', 'H', String(h), 'in']], W: 260, H: 170 });
    return { stem: `<p>In the triangle shown, the base has length ${b} and the height (dashed) has length ${h}. What is the area of the triangle?</p>` + svg, ...numCh([b * h / 2, b * h, b + h, 2 * (b + h)]),
      explanation: `The area of a triangle is ${m('\\frac{1}{2}bh')}: ${m(`\\frac{1}{2}(${b})(${h}) = ${b * h / 2}`)}.`, verify: () => b * h / 2 > 0 }; }
  const w = r.int(3, 12), l = w + r.int(2, 10); const P = 2 * (l + w);
  return { stem: `<p>A rectangular garden has a perimeter of ${P} feet. The length of the garden is ${l} feet. What is the area, in square feet, of the garden?</p>`, ...numCh([l * w, l * (P - 2 * l), P, l * (P / 2)]),
    explanation: `${m(`2(${l}) + 2w = ${P}`)}, so ${m(`2w = ${P - 2 * l}`)} and ${m(`w = ${w}`)}. The area is ${m(`${l} \\times ${w} = ${l * w}`)} square feet.`, verify: () => 2 * (l + w) === P };
});

def('prism-volume', 1, 'mcq', 1, SK.av, (r, v) => {
  if (v === 0) { const a = r.int(2, 9), b = r.int(2, 9), c = r.int(2, 12); need(a !== b && b !== c);
    return { stem: `<p>A rectangular box has a length of ${a} inches, a width of ${b} inches, and a height of ${c} inches. What is the volume, in cubic inches, of the box?</p>`, ...numCh([a * b * c, a + b + c, 2 * (a * b + b * c + a * c), a * b + c]),
      explanation: `The volume of a rectangular prism is ${m('\\ell wh')}: ${m(`${a} \\times ${b} \\times ${c} = ${a * b * c}`)} cubic inches.`, verify: () => true }; }
  const e = r.int(3, 9);
  return { stem: `<p>A cube has an edge length of ${e} centimeters. What is the volume, in cubic centimeters, of the cube?</p>`, ...numCh([e ** 3, 3 * e, e * e, 6 * e * e]),
    explanation: `The volume of a cube with edge length ${m('s')} is ${m('s^3')}: ${m(`${e}^3 = ${e ** 3}`)} cubic centimeters.`, verify: () => true };
});

def('vertical-angles', 1, 'spr', 2, SK.lat, (r, v) => {
  const th = r.int(35, 145); need(Math.abs(th - 90) > 8);
  const a0 = r.int(10, 30);
  const P = { O: [0, 0], A: [Math.cos(rad(a0)), Math.sin(rad(a0))], B: [-Math.cos(rad(a0)), -Math.sin(rad(a0))], C: [Math.cos(rad(a0 + th)), Math.sin(rad(a0 + th))], Dd: [-Math.cos(rad(a0 + th)), -Math.sin(rad(a0 + th))] };
  const vertical = v === 1;
  const ans = vertical ? th : 180 - th;
  const labs = [['A', 'O', 'C', D(th), 30], vertical ? ['B', 'O', 'Dd', `${it('x')}°`, 30] : ['C', 'O', 'B', `${it('x')}°`, 30]];
  const svg = figure({ pts: P, segs: [['A', 'B'], ['C', 'Dd']], angleLabels: labs, W: 240, H: 180, center: [0, 0] });
  return { stem: `<p>In the figure, two lines intersect at a point. What is the value of ${m('x')}?</p>` + svg, answer: spr(ans),
    explanation: vertical ? `The angles marked ${th}° and ${m('x^\\circ')} are vertical angles, so they are congruent: ${m(`x = ${th}`)}.` : `The angles marked ${th}° and ${m('x^\\circ')} form a linear pair, so they are supplementary: ${m(`x = 180 - ${th} = ${ans}`)}.`, verify: () => ans > 0 && ans < 180 };
});

def('triangle-sum', 1, 'mcq', 2, SK.lat, (r, v) => {
  const A = r.int(30, 80), B = r.int(30, 80); const C = 180 - A - B; need(C >= 25 && A !== B && C !== A && C !== B);
  const P = triAngles(A, B);
  const svg = figure({ pts: P, segs: [['A', 'B'], ['B', 'C'], ['C', 'A']], angleLabels: [['B', 'A', 'C', D(A), 26], ['A', 'B', 'C', D(B), 26], ['A', 'C', 'B', `${it('x')}°`, 24]], labels: v === 1 ? { A: 'P', B: 'Q', C: 'R' } : {}, W: 270, H: 190 });
  return { stem: `<p>In the triangle shown, what is the value of ${m('x')}?</p>` + svg, ...numCh([C, 180 - A, 360 - A - B, A + B]),
    explanation: `The angle measures of a triangle add to ${m(`180${DEG}`)}: ${m(`x = 180 - ${A} - ${B} = ${C}`)}.`, verify: () => A + B + C === 180 };
});

def('pythag', 1, 'spr', 2, SK.rt, (r, v) => {
  const T0 = r.pick(TRIPLES.slice(0, 5)); const k = r.pick([1, 2]); const [a, b, c] = T0.map((x) => x * (T0[2] > 13 ? 1 : k));
  if (v === 0) {
    const svg = rightTri(a, b, [['B', 'C', String(a)], ['C', 'A', String(b)], ['A', 'B', it('x')]]);
    return { stem: `<p>In right triangle ${m('ABC')} shown, what is the value of ${m('x')}?</p>` + svg, answer: spr(c),
      explanation: `By the Pythagorean theorem, ${m(`x^2 = ${a}^2 + ${b}^2 = ${a * a} + ${b * b} = ${c * c}`)}, so ${m(`x = ${c}`)}.`, verify: () => a * a + b * b === c * c };
  }
  return { stem: `<p>A ladder ${c} feet long leans against a vertical wall. The bottom of the ladder is ${b} feet from the base of the wall on level ground. How high up the wall, in feet, does the top of the ladder reach?</p>`, answer: spr(a),
    explanation: `The ladder is the hypotenuse of a right triangle: ${m(`h^2 + ${b}^2 = ${c}^2`)}, so ${m(`h^2 = ${c * c - b * b}`)} and ${m(`h = ${a}`)}.`, verify: () => a * a + b * b === c * c };
});

def('circle-area', 1, 'mcq', 1, SK.cir, (r, v) => {
  const rr = r.int(3, 12);
  if (v === 0) return { stem: `<p>A circle has a radius of ${rr} centimeters. What is the area, in square centimeters, of the circle?</p>`, ...numCh([F(rr * rr), F(2 * rr), F(4 * rr * rr), F(rr)], (k) => m(piTex(k))),
    explanation: `The area of a circle is ${m('\\pi r^2')}: ${m(`\\pi(${rr})^2 = ${rr * rr}\\pi`)} square centimeters.`, verify: () => true };
  const d = 2 * rr;
  return { stem: `<p>A circular rug has a diameter of ${d} feet. What is the area, in square feet, of the rug?</p>`, ...numCh([F(rr * rr), F(d * d), F(d), F(2 * d)], (k) => m(piTex(k))),
    explanation: `The radius is half the diameter, ${rr} feet. The area is ${m(`\\pi(${rr})^2 = ${rr * rr}\\pi`)} square feet. (Using the diameter in place of the radius gives ${m(`${d * d}\\pi`)}, which is too large.)`, verify: () => true };
});

def('sin-ratio', 1, 'mcq', 2, SK.rt, (r, v) => {
  const T0 = r.pick(TRIPLES.slice(0, 4)); const [a, b, c] = T0;
  const svg = rightTri(a, b, [['B', 'C', String(a)], ['C', 'A', String(b)], ['A', 'B', String(c)]]);
  const fx = (n, d) => m(`\\frac{${n}}{${d}}`);
  if (v === 0) return { stem: `<p>In right triangle ${m('ABC')} shown, what is the value of ${m('\\sin A')}?</p>` + svg, choices: [fx(a, c), fx(b, c), fx(a, b), fx(c, a)],
    explanation: `${m('\\sin A')} is the length of the side opposite angle ${m('A')} divided by the length of the hypotenuse: ${m(`\\frac{BC}{AB} = \\frac{${a}}{${c}}`)}.`, verify: () => close(Math.sin(Math.atan2(a, b)), a / c) };
  return { stem: `<p>In right triangle ${m('ABC')} shown, what is the value of ${m('\\cos B')}?</p>` + svg, choices: [fx(a, c), fx(b, c), fx(b, a), fx(c, b)],
    explanation: `${m('\\cos B')} is the length of the side adjacent to angle ${m('B')} divided by the hypotenuse: ${m(`\\frac{BC}{AB} = \\frac{${a}}{${c}}`)}.`, verify: () => close(Math.cos(Math.atan2(b, a)), a / c) };
});

/* parallel lines cut by a transversal; regions: ur, ul, ll, lr at top (P) or bottom (Q) */
function parallelFig(phi, labP, labQ) {
  const dir = [Math.cos(rad(phi)), Math.sin(rad(phi))];
  const sep = 3.2; const P = [0, sep], Q = [-sep / Math.tan(rad(phi)), 0];
  const pts = { P, Q };
  const add = (name, base, d, k) => { pts[name] = [base[0] + d[0] * k, base[1] + d[1] * k]; };
  for (const [nm, B] of [['P', P], ['Q', Q]]) { add(nm + 'r', B, [1, 0], 2); add(nm + 'l', B, [-1, 0], 2); add(nm + 'u', B, dir, 1.4); add(nm + 'd', B, dir, -1.4); }
  const ray = { ur: ['r', 'u'], ul: ['u', 'l'], ll: ['l', 'd'], lr: ['d', 'r'] };
  const al = [];
  if (labP) al.push([`P${ray[labP[0]][0]}`, 'P', `P${ray[labP[0]][1]}`, labP[1], 24]);
  if (labQ) al.push([`Q${ray[labQ[0]][0]}`, 'Q', `Q${ray[labQ[0]][1]}`, labQ[1], 24]);
  const left = Math.min(pts.Pl[0], pts.Ql[0]) - 0.2, right = Math.max(pts.Pr[0], pts.Qr[0]) + 0.2;
  pts.A1 = [left, sep]; pts.A2 = [right, sep]; pts.B1 = [left, 0]; pts.B2 = [right, 0];
  return figure({ pts, segs: [['A1', 'A2'], ['B1', 'B2'], ['Pu', 'Qd']], angleLabels: al, W: 290, H: 250, arcs: true,
    extra: (X, Y) => txt(X(right) + 10, Y(sep), it('ℓ'), { size: 14 }) + txt(X(right) + 10, Y(0), it('m'), { size: 14 }) });
}
const facing = (rp, rq) => (rp === 'll' && rq === 'ul') || (rp === 'lr' && rq === 'ur');
const regionMeasure = (reg, phi) => ({ ur: phi, ll: phi, ul: 180 - phi, lr: 180 - phi }[reg]);

def('parallel-transversal', 1, 'spr', 2, SK.lat, (r, v) => {
  const phi = r.int(50, 75); const regs = ['ur', 'ul', 'll', 'lr'];
  const rp = r.pick(regs), rq = r.pick(regs); need(!facing(rp, rq));
  const given = regionMeasure(rp, phi), ans = regionMeasure(rq, phi);
  need(v === 0 ? given === ans : given !== ans);
  const svg = parallelFig(phi, [rp, D(given)], [rq, `${it('x')}°`]);
  return { stem: `<p>In the figure, line ${m('\\ell')} is parallel to line ${m('m')}. What is the value of ${m('x')}?</p>` + svg, answer: spr(ans),
    explanation: given === ans ? `When parallel lines are cut by a transversal, the angles in the matching (corresponding) or alternate positions are congruent, and these two angles are both ${given === phi ? 'acute' : 'obtuse'}. So ${m(`x = ${ans}`)}.`
      : `When parallel lines are cut by a transversal, every acute angle formed is supplementary to every obtuse angle formed. One of the marked angles is acute and the other obtuse, so ${m(`x = 180 - ${given} = ${ans}`)}.`, verify: () => given + ans === 180 || given === ans };
});

def('cylinder-volume', 1, 'mcq', 1, SK.av, (r, v) => {
  const rr = r.int(2, 8), h = r.int(3, 12); need(rr !== h);
  const vals = [F(rr * rr * h), F(2 * rr * h), F(4 * rr * rr * h), F(rr * h)];
  const stem = v === 0 ? `<p>A right circular cylinder has a radius of ${rr} inches and a height of ${h} inches. What is the volume, in cubic inches, of the cylinder?</p>`
    : `<p>A cylindrical water tank has a diameter of ${2 * rr} meters and a height of ${h} meters. What is the volume, in cubic meters, of the tank?</p>`;
  return { stem, ...numCh(vals, (k) => m(piTex(k))), explanation: `The volume of a cylinder is ${m('\\pi r^2 h')}. With ${m(`r = ${rr}`)}: ${m(`\\pi(${rr})^2(${h}) = ${rr * rr * h}\\pi`)}.`, verify: () => true };
});

def('isosceles', 1, 'mcq', 2, SK.lat, (r, v) => {
  if (v === 0) { const top = 2 * r.int(10, 60); const base = (180 - top) / 2;
    return { stem: `<p>In isosceles triangle ${m('PQR')}, ${m('PQ = PR')} and the measure of angle ${m('P')} is ${m(`${top}${DEG}`)}. What is the measure, in degrees, of angle ${m('Q')}?</p>`, ...numCh([base, top, 180 - top, base / 2], (z) => m(L.nice(z))),
      explanation: `Base angles ${m('Q')} and ${m('R')} are congruent, so ${m(`2Q + ${top} = 180`)} and ${m(`Q = ${base}`)}.`, verify: () => 2 * base + top === 180 }; }
  const base = r.int(35, 80); const top = 180 - 2 * base;
  return { stem: `<p>In triangle ${m('ABC')}, ${m('AB = BC')}. The measure of angle ${m('A')} is ${m(`${base}${DEG}`)}. What is the measure, in degrees, of angle ${m('B')}?</p>`, ...numCh([top, base, 180 - base, 90 - base], (z) => m(L.nice(z))),
    explanation: `Since ${m('AB = BC')}, the angles opposite these sides, ${m('C')} and ${m('A')}, are congruent: each is ${m(`${base}${DEG}`)}. So ${m(`B = 180 - 2(${base}) = ${top}`)}.`, verify: () => top > 0 };
});

def('square-perimeter', 1, 'spr', 1, SK.av, (r) => {
  const s = r.int(4, 15);
  return { stem: `<p>A square has an area of ${s * s} square meters. What is the perimeter, in meters, of the square?</p>`, answer: spr(4 * s),
    explanation: `The side length is ${m(`\\sqrt{${s * s}} = ${s}`)} meters, so the perimeter is ${m(`4(${s}) = ${4 * s}`)} meters.`, verify: () => true };
});

def('circle-eq-read', 1, 'mcq', 2, SK.cir, (r, v) => {
  const h = r.nz(-8, 8), k = r.nz(-8, 8), rr = r.int(2, 9); need(h !== k && Math.abs(h) !== Math.abs(k));
  const eq = `(x ${h > 0 ? '-' : '+'} ${Math.abs(h)})^2 + (y ${k > 0 ? '-' : '+'} ${Math.abs(k)})^2 = ${rr * rr}`;
  if (v === 0) return { stem: `<p>The equation of a circle in the ${m('xy')}-plane is ${m(eq)}. What are the coordinates of the center of the circle?</p>`,
    choices: [m(`(${h}, ${k})`), m(`(${-h}, ${-k})`), m(`(${k}, ${h})`), m(`(${-h}, ${k})`)], explanation: `A circle with equation ${m('(x - h)^2 + (y - k)^2 = r^2')} has center ${m('(h, k)')}. Here the center is ${m(`(${h}, ${k})`)}.` };
  return { stem: `<p>A circle in the ${m('xy')}-plane has equation ${m(eq)}. What is the radius of the circle?</p>`, ...numCh([rr, rr * rr, 2 * rr, rr * rr / 2]),
    explanation: `In ${m('(x - h)^2 + (y - k)^2 = r^2')}, ${m(`r^2 = ${rr * rr}`)}, so ${m(`r = ${rr}`)}.`, verify: () => true };
});

def('similar-scale', 1, 'mcq', 2, SK.lat, (r, v) => {
  const a = r.int(3, 9), b = r.int(4, 12), k = r.pick([F(2), F(3), F(3, 2), F(5, 2)]); need(a !== b);
  const d = k.mul(a), e = k.mul(b); need(d.isInt() && e.isInt());
  if (v === 0) return { stem: `<p>Triangle ${m('ABC')} is similar to triangle ${m('DEF')}, where ${m('A')}, ${m('B')}, and ${m('C')} correspond to ${m('D')}, ${m('E')}, and ${m('F')}, respectively. If ${m(`AB = ${a}`)}, ${m(`BC = ${b}`)}, and ${m(`DE = ${d.n}`)}, what is the length of ${m('EF')}?</p>`, ...numCh([e, F(b + d.n - a), F(b * a, d.n), d]),
    explanation: `The scale factor from ${m('ABC')} to ${m('DEF')} is ${m(`\\frac{DE}{AB} = \\frac{${d.n}}{${a}} = ${k.tex()}`)}. So ${m(`EF = ${k.tex()}(${b}) = ${e.n}`)}.`, verify: () => close(e.val() / b, d.val() / a) };
  return { stem: `<p>A tree casts a shadow ${e.n} feet long. At the same time, a ${a}-foot pole nearby casts a shadow ${b} feet long. The triangles formed by the objects and their shadows are similar. How tall, in feet, is the tree?</p>`, ...numCh([e.mul(a).div(b), e.mul(b).div(a), e.add(a - b), F(a * b).div(e)]),
    explanation: `${m(`\\frac{h}{${e.n}} = \\frac{${a}}{${b}}`)}, so ${m(`h = \\frac{${a}(${e.n})}{${b}} = ${e.mul(a).div(b).tex()}`)} feet.`, verify: () => close(e.mul(a).div(b).val() / e.val(), a / b) };
});

/* ============================ MEDIUM ============================ */
def('similar-parallel', 2, 'spr', 2, SK.lat, (r, v) => {
  const ad = r.int(3, 9), db = r.int(2, 8), de = r.int(4, 12); const bc = F(de * (ad + db), ad); need((L.sprFits(bc.str()) || bc.isInt()) && (v === 0 || bc.isInt()));
  const P = { A: [1.6, 3.2], B: [0, 0], C: [4.2, 0] };
  const t = ad / (ad + db);
  P.D = [P.A[0] + (P.B[0] - P.A[0]) * t, P.A[1] + (P.B[1] - P.A[1]) * t]; P.E = [P.A[0] + (P.C[0] - P.A[0]) * t, P.A[1] + (P.C[1] - P.A[1]) * t];
  const ask = v === 0 ? 'BC' : 'AB';
  const svg = figure({ pts: P, segs: [['A', 'B'], ['B', 'C'], ['C', 'A'], ['D', 'E']], labels: { A: 'A', B: 'B', C: 'C', D: 'D', E: 'E' }, sideLabels: v === 0 ? [['A', 'D', String(ad)], ['D', 'B', String(db)], ['D', 'E', String(de), 'in']] : [['A', 'D', String(ad)], ['D', 'E', String(de), 'in'], ['B', 'C', bc.isInt() ? String(bc.n) : bc.str()]], W: 260, H: 200 });
  if (v === 0) return { stem: `<p>In the figure, ${m('\\overline{DE}')} is parallel to ${m('\\overline{BC}')}, with ${m('D')} on ${m('\\overline{AB}')} and ${m('E')} on ${m('\\overline{AC}')}. What is the length of ${m('\\overline{BC}')}?</p>` + svg, answer: spr(bc),
    explanation: `Because ${m('DE \\parallel BC')}, triangle ${m('ADE')} is similar to triangle ${m('ABC')}. So ${m(`\\frac{BC}{DE} = \\frac{AB}{AD} = \\frac{${ad + db}}{${ad}}`)}, and ${m(`BC = ${de}\\cdot\\frac{${ad + db}}{${ad}} = ${bc.tex()}`)}.`, verify: () => close(bc.val() / de, (ad + db) / ad) };
  void ask;
  return { stem: `<p>In the figure, ${m('\\overline{DE}')} is parallel to ${m('\\overline{BC}')}. What is the length of ${m('\\overline{AB}')}?</p>` + svg, answer: spr(ad + db),
    explanation: `Triangles ${m('ADE')} and ${m('ABC')} are similar, so ${m(`\\frac{AB}{AD} = \\frac{BC}{DE}`)}: ${m(`AB = ${ad}\\cdot\\frac{${bc.tex()}}{${de}} = ${ad + db}`)}.`, verify: () => close(ad * bc.val() / de, ad + db) };
});

def('special-30-60', 2, 'mcq', 2, SK.rt, (r, v) => {
  const s = 2 * r.int(2, 9); const half = s / 2;
  const P = { C: [0, 0], A: [Math.sqrt(3), 0], B: [0, 1] };
  const svg = figure({ pts: P, segs: [['A', 'B'], ['B', 'C'], ['C', 'A']], right: [['A', 'C', 'B']], labels: { A: 'A', B: 'B', C: 'C' }, angleLabels: [['B', 'A', 'C', D(30), 34]], sideLabels: [['A', 'B', String(s)]], W: 260, H: 170 });
  if (v === 0) return { stem: `<p>In right triangle ${m('ABC')} shown, what is the length of ${m('\\overline{AC}')}?</p>` + svg, choices: [`${half}\\sqrt{3}`, `${half}`, `${s}\\sqrt{3}`, `${half}\\sqrt{2}`].map(m),
    explanation: `In a 30-60-90 triangle, the side opposite the ${m(`30${DEG}`)} angle is half the hypotenuse (${half}), and the side opposite the ${m(`60${DEG}`)} angle is ${m('\\sqrt{3}')} times that: ${m(`AC = ${half}\\sqrt{3}`)}.`, verify: () => close(s * Math.cos(rad(30)), half * Math.sqrt(3)) };
  return { stem: `<p>In right triangle ${m('ABC')} shown, what is the length of ${m('\\overline{BC}')}?</p>` + svg, choices: [`${half}`, `${half}\\sqrt{3}`, `${s}\\sqrt{2}`, `${2 * s}`].map(m),
    explanation: `${m('\\overline{BC}')} is opposite the ${m(`30${DEG}`)} angle, so it is half the hypotenuse: ${m(`\\frac{${s}}{2} = ${half}`)}.`, verify: () => close(s * Math.sin(rad(30)), half) };
});

def('special-45', 2, 'mcq', 1, SK.rt, (r, v) => {
  const s = r.int(3, 12);
  if (v === 0) return { stem: `<p>A square has a side length of ${s} centimeters. What is the length, in centimeters, of a diagonal of the square?</p>`, choices: [`${s}\\sqrt{2}`, `${2 * s}`, `${s}\\sqrt{3}`, `${s * s}`].map(m),
    explanation: `A diagonal divides the square into two 45-45-90 triangles, whose hypotenuse is ${m('\\sqrt{2}')} times a leg: ${m(`${s}\\sqrt{2}`)}.`, verify: () => close(Math.hypot(s, s), s * Math.SQRT2) };
  const h = 2 * s;
  return { stem: `<p>The hypotenuse of an isosceles right triangle has length ${h}. What is the length of one of the legs of the triangle?</p>`, choices: [`${s}\\sqrt{2}`, `${s}`, `${h}\\sqrt{2}`, `${s}\\sqrt{3}`].map(m),
    explanation: `Each leg is ${m('\\frac{1}{\\sqrt{2}}')} times the hypotenuse: ${m(`\\frac{${h}}{\\sqrt{2}} = \\frac{${h}\\sqrt{2}}{2} = ${s}\\sqrt{2}`)}.`, verify: () => close(2 * (s * Math.SQRT2) ** 2, h * h) };
});

def('arc-length', 2, 'mcq', 2, SK.cir, (r, v) => {
  const rr = r.int(3, 12), th = r.pick([30, 40, 45, 60, 72, 80, 90, 120, 135, 150]);
  const arc = F(2 * rr * th, 360); need(arc.d <= 4);
  const sector = F(rr * rr * th, 360);
  const vals = [arc, F(rr * th, 360), sector, F(4 * rr * th, 360)]; need(new Set(vals.map((x) => x.str())).size === 4);
  const svg = circleFig(rr, { A: 0, B: th }, { segs: [['O', 'A'], ['O', 'B']], angles: [['A', 'O', 'B', D(th), 22]], sides: [['O', 'A', String(rr), 'in']] });
  return { stem: `<p>In the circle shown, ${m('O')} is the center and the radius is ${rr}. The central angle ${m('AOB')} measures ${m(`${th}${DEG}`)}. What is the length of minor arc ${m('AB')}?</p>` + svg, ...numCh(vals, (k) => m(piTex(k))),
    explanation: `The arc is ${m(`\\frac{${th}}{360}`)} of the circumference ${m(`2\\pi(${rr}) = ${2 * rr}\\pi`)}: ${m(`\\frac{${th}}{360}(${2 * rr}\\pi) = ${piTex(arc)}`)}.`, verify: () => close(arc.val() * Math.PI, 2 * Math.PI * rr * th / 360) };
});

def('sector-area', 2, 'mcq', 2, SK.cir, (r, v) => {
  const rr = r.int(3, 12), th = r.pick([30, 40, 45, 60, 72, 90, 120, 135, 150, 240]); const a = F(rr * rr * th, 360); need(L.sprFits(a.str()) && a.d <= 4);
  if (v === 0) return { stem: `<p>A circle has a radius of ${rr} inches. A sector of the circle has a central angle of ${m(`${th}${DEG}`)}. The area of the sector is ${m('a\\pi')} square inches. What is the value of ${m('a')}?</p>`, ...numCh([a, F(2 * rr * th, 360), F(rr * rr), F(rr * th, 360)]),
    explanation: `The sector is ${m(`\\frac{${th}}{360}`)} of the circle's area, ${m(`${rr * rr}\\pi`)}: ${m(`\\frac{${th}}{360}(${rr * rr}\\pi) = ${piTex(a)}`)}. So ${m(`a = ${a.tex()}`)}.`, verify: () => close(a.val(), rr * rr * th / 360) };
  return { stem: `<p>A pizza with a diameter of ${2 * rr} inches is cut into slices. One slice is a sector with a central angle of ${m(`${th}${DEG}`)}. The area of this slice is ${m('a\\pi')} square inches. What is the value of ${m('a')}?</p>`, ...numCh([a, F(2 * rr * th, 360), F(4 * rr * rr * th, 360), F(rr * rr)]),
    explanation: `The radius is ${rr} inches, so the whole pizza has area ${m(`${rr * rr}\\pi`)}. The slice is ${m(`\\frac{${th}}{360}`)} of it: ${m(`a = \\frac{${th}}{360}(${rr * rr}) = ${a.tex()}`)}.`, verify: () => close(a.val(), rr * rr * th / 360) };
});

def('complementary-trig', 2, 'spr', 2, SK.rt, (r, v) => {
  if (v === 0) { const T0 = r.pick(TRIPLES.slice(0, 4)); const [a, , c] = T0;
    return { stem: `<p>In right triangle ${m('ABC')}, angle ${m('C')} is a right angle and ${m(`\\sin A = \\frac{${a}}{${c}}`)}. What is the value of ${m('\\cos B')}?</p>`, answer: spr(F(a, c)),
      explanation: `Angles ${m('A')} and ${m('B')} are complementary, so ${m('\\cos B = \\sin(90^\\circ - B) = \\sin A')}. Both equal ${m(`\\frac{${a}}{${c}}`)}: the side opposite ${m('A')} is the side adjacent to ${m('B')}.`, verify: () => close(Math.cos(Math.PI / 2 - Math.asin(a / c)), a / c) }; }
  const p = r.int(2, 4), q = r.int(1, 3), c1 = r.int(-10, 15), c2 = r.int(-10, 15); const k = F(90 - c1 - c2, p + q); need(k.isInt() && p * k.n + c1 > 0 && q * k.n + c2 > 0);
  return { stem: `<p>For acute angles, ${m(`\\sin(${lin(p, c1, 'k')})${DEG} = \\cos(${lin(q, c2, 'k')})${DEG}`)}. What is the value of ${m('k')}?</p>`, answer: spr(k),
    explanation: `${m('\\sin x^\\circ = \\cos y^\\circ')} for acute angles exactly when ${m('x + y = 90')}. So ${m(`(${lin(p, c1, 'k')}) + (${lin(q, c2, 'k')}) = 90`)}, which gives ${m(`${p + q}k = ${90 - c1 - c2}`)} and ${m(`k = ${k.n}`)}.`, verify: () => close(Math.sin(rad(p * k.n + c1)), Math.cos(rad(q * k.n + c2))) };
});

def('cone-sphere', 2, 'mcq', 2, SK.av, (r, v) => {
  if (v === 0) { const rr = r.int(2, 6), h = 3 * r.int(1, 4);
    const vals = [F(rr * rr * h, 3), F(rr * rr * h), F(rr * h, 3), F(2 * rr * rr * h, 3)]; need(new Set(vals.map((x) => x.str())).size === 4);
    return { stem: `<p>A right circular cone has a radius of ${rr} centimeters and a height of ${h} centimeters. What is the volume, in cubic centimeters, of the cone?</p>`, ...numCh(vals, (k) => m(piTex(k))),
      explanation: `The volume of a cone is ${m('\\frac{1}{3}\\pi r^2 h')}: ${m(`\\frac{1}{3}\\pi(${rr})^2(${h}) = ${piTex(vals[0])}`)}.`, verify: () => close(vals[0].val(), rr * rr * h / 3) }; }
  const rr = 3 * r.int(1, 3);
  const vals = [F(4 * rr ** 3, 3), F(4 * rr * rr), F(rr ** 3), F(4 * rr ** 3)];
  return { stem: `<p>A sphere has a radius of ${rr} inches. What is the volume, in cubic inches, of the sphere?</p>`, ...numCh(vals, (k) => m(piTex(k))),
    explanation: `The volume of a sphere is ${m('\\frac{4}{3}\\pi r^3')}: ${m(`\\frac{4}{3}\\pi(${rr})^3 = \\frac{4}{3}(${rr ** 3})\\pi = ${piTex(vals[0])}`)}.`, verify: () => close(vals[0].val(), 4 / 3 * rr ** 3) };
});

def('circle-eq-write', 2, 'mcq', 2, SK.cir, (r, v) => {
  const h = r.nz(-6, 6), k = r.nz(-6, 6); const T0 = r.pick([[3, 4, 5], [5, 12, 13], [6, 8, 10]]); const sgn = [r.sign(), r.sign()];
  const p = h + sgn[0] * T0[0], q = k + sgn[1] * T0[1]; const R2 = T0[2] ** 2;
  const C = (hh, kk, rr) => m(`(x ${hh > 0 ? '-' : '+'} ${Math.abs(hh)})^2 + (y ${kk > 0 ? '-' : '+'} ${Math.abs(kk)})^2 = ${rr}`);
  const stem = v === 0 ? `<p>A circle in the ${m('xy')}-plane has its center at ${m(`(${h}, ${k})`)} and passes through the point ${m(`(${p}, ${q})`)}. Which of the following is an equation of the circle?</p>`
    : `<p>In the ${m('xy')}-plane, the points ${m(`(${p}, ${q})`)} and ${m(`(${2 * h - p}, ${2 * k - q})`)} are the endpoints of a diameter of a circle. Which of the following is an equation of the circle?</p>`;
  return { stem, choices: [C(h, k, R2), C(h, k, T0[2]), C(-h, -k, R2), C(-h, -k, T0[2])],
    explanation: `${v === 1 ? `The center is the midpoint of the diameter, ${m(`(${h}, ${k})`)}. ` : ''}The radius squared is the squared distance from the center to ${m(`(${p}, ${q})`)}: ${m(`(${p} - ${pn(h)})^2 + (${q} - ${pn(k)})^2 = ${T0[0] ** 2} + ${T0[1] ** 2} = ${R2}`)}. So the equation is ${C(h, k, R2)}.`, verify: () => (p - h) ** 2 + (q - k) ** 2 === R2 };
});

def('radians', 2, 'mcq', 2, SK.rt, (r, v) => {
  if (v === 0) { const dgs = r.pick([150, 120, 135, 210, 240, 300, 330, 225]); const k = F(dgs, 180);
    return { stem: `<p>What is the measure, in radians, of an angle that measures ${m(`${dgs}${DEG}`)}?</p>`, ...numCh([k, F(k.d, k.n), F(dgs, 90), F(dgs, 360)], (x) => m(piTex(x))),
      explanation: `Multiply by ${m('\\frac{\\pi}{180}')}: ${m(`${dgs} \\cdot \\frac{\\pi}{180} = ${piTex(k)}`)}.`, verify: () => close(k.val() * Math.PI, rad(dgs)) }; }
  const k = r.pick([F(3, 4), F(5, 6), F(2, 3), F(7, 6), F(5, 4), F(4, 3), F(5, 3)]); const dgs = k.mul(180);
  return { stem: `<p>An angle measures ${m(piTex(k))} radians. What is the measure of the angle in degrees?</p>`, ...numCh([dgs, k.mul(360), k.mul(90), F(180).sub(dgs).abs()], (x) => m(`${num(x)}${DEG}`)),
    explanation: `Multiply by ${m('\\frac{180}{\\pi}')}: ${m(`${piTex(k)} \\cdot \\frac{180}{\\pi} = ${dgs.n}`)} degrees.`, verify: () => close(dgs.val(), k.val() * 180) };
});

def('polygon-angles', 2, 'mcq', 2, SK.lat, (r, v) => {
  const n = r.pick([5, 6, 8, 9, 10, 12]); const names = { 5: 'pentagon', 6: 'hexagon', 8: 'octagon', 9: 'nonagon', 10: 'decagon', 12: 'dodecagon' };
  if (v === 0) return { stem: `<p>What is the sum of the measures, in degrees, of the interior angles of a ${n}-sided polygon (${names[n]})?</p>`, ...numCh([180 * (n - 2), 180 * n, 180 * (n - 1), 360 * (n - 2)], (z) => m(L.nice(z))),
    explanation: `A polygon with ${m('n')} sides can be divided into ${m('n - 2')} triangles, so the sum is ${m(`180(${n} - 2) = ${180 * (n - 2)}`)} degrees.`, verify: () => true };
  return { stem: `<p>What is the measure, in degrees, of each interior angle of a regular ${names[n]}, which has ${n} sides?</p>`, ...numCh([F(180 * (n - 2), n), F(360, n), F(180 * (n - 2)), F(180 * (n - 1), n)], (z) => m(L.nice(z))),
    explanation: `The interior angles sum to ${m(`180(${n - 2}) = ${180 * (n - 2)}`)} degrees, and a regular polygon's angles are all equal: ${m(`\\frac{${180 * (n - 2)}}{${n}} = ${F(180 * (n - 2), n).tex()}`)}. (Equivalently, each exterior angle is ${m(`\\frac{360}{${n}}`)}.)`, verify: () => close(180 - 360 / n, 180 * (n - 2) / n) };
});

def('tan-side', 2, 'spr', 2, SK.rt, (r, v) => {
  const T0 = r.pick(TRIPLES.slice(0, 4)); const [a, b, c] = T0; const k = r.int(2, 4);
  const BC = a * k, AC = b * k, AB = c * k;
  if (v === 0) { const svg = rightTri(a, b, [['C', 'A', String(AC)], ['B', 'C', it('x')]]);
    return { stem: `<p>In right triangle ${m('ABC')} shown, ${m(`\\tan A = \\frac{${a}}{${b}}`)}. What is the value of ${m('x')}?</p>` + svg + NOTE, answer: spr(BC),
      explanation: `${m('\\tan A = \\frac{BC}{AC}')}, so ${m(`\\frac{x}{${AC}} = \\frac{${a}}{${b}}`)} and ${m(`x = ${BC}`)}.`, verify: () => close(BC / AC, a / b) }; }
  const svg = rightTri(a, b, [['A', 'B', String(AB)], ['B', 'C', it('x')]]);
  return { stem: `<p>In right triangle ${m('ABC')} shown, ${m(`\\cos B = \\frac{${a}}{${c}}`)}. What is the value of ${m('x')}?</p>` + svg + NOTE, answer: spr(BC),
    explanation: `${m('\\cos B')} is the adjacent side over the hypotenuse: ${m(`\\frac{BC}{AB} = \\frac{x}{${AB}} = \\frac{${a}}{${c}}`)}, so ${m(`x = ${BC}`)}.`, verify: () => close(BC / AB, a / c) };
});

def('scale-factor', 2, 'mcq', 1, SK.av, (r, v) => {
  const k = r.int(2, 5);
  if (v === 0) return { stem: `<p>The length and the width of a rectangle are each multiplied by ${k}. The area of the new rectangle is how many times the area of the original rectangle?</p>`, ...numCh([k * k, k, 2 * k, k ** 3]),
    explanation: `Area is length times width, and each is multiplied by ${k}, so the area is multiplied by ${m(`${k} \\times ${k} = ${k * k}`)}.`, verify: () => true };
  return { stem: `<p>Each edge of a cube is multiplied by ${k} to form a larger cube. The volume of the larger cube is how many times the volume of the original cube?</p>`, ...numCh([k ** 3, k, 3 * k, k * k]),
    explanation: `Volume depends on three dimensions, each multiplied by ${k}: ${m(`${k}^3 = ${k ** 3}`)}.`, verify: () => true };
});

def('inscribed-angle', 2, 'spr', 2, SK.cir, (r, v) => {
  const ins = r.int(20, 75); const cen = 2 * ins;
  const a1 = r.int(-20, 10), a2 = a1 + cen, a3 = a1 + cen + (360 - cen) / 2 + r.int(-20, 20);
  const svg = circleFig(5, { A: a1, B: a2, C: a3 }, { segs: [['O', 'A'], ['O', 'B'], ['C', 'A'], ['C', 'B']], angles: v === 0 ? [['A', 'O', 'B', D(cen), 18], ['A', 'C', 'B', `${it('x')}°`, 30]] : [['A', 'O', 'B', `${it('x')}°`, 18], ['A', 'C', 'B', D(ins), 30]] });
  const ans = v === 0 ? ins : cen;
  return { stem: `<p>Points ${m('A')}, ${m('B')}, and ${m('C')} lie on the circle with center ${m('O')} shown. What is the value of ${m('x')}?</p>` + svg, answer: spr(ans),
    explanation: `An inscribed angle measures half the central angle that intercepts the same arc. Angle ${m('ACB')} and angle ${m('AOB')} both intercept arc ${m('AB')}, so ${v === 0 ? m(`x = \\frac{${cen}}{2} = ${ins}`) : m(`x = 2(${ins}) = ${cen}`)}.`, verify: () => cen === 2 * ins };
});

def('exterior-angle', 2, 'spr', 1, SK.lat, (r) => {
  const A = r.int(30, 70), B = r.int(35, 75); need(A + B < 150);
  const a = r.int(2, 4), b = r.int(-20, 20); const x = F(180 - B - b, a); need(x.isInt() && x.n > 0);
  const P = triAngles(A, B); P.E = [P.B[0] + 0.45, 0];
  const svg = figure({ pts: P, segs: [['A', 'E'], ['B', 'C'], ['C', 'A']], angleLabels: [['B', 'A', 'C', D(A), 26], ['A', 'C', 'B', D(180 - A - B), 22], ['E', 'B', 'C', `(${a}${it('x')} ${b >= 0 ? '+' : '−'} ${Math.abs(b)})°`, 30]], W: 280, H: 190 });
  return { stem: `<p>In the figure, a side of the triangle is extended. What is the value of ${m('x')}?</p>` + svg + NOTE, answer: spr(x),
    explanation: `An exterior angle of a triangle equals the sum of the two remote interior angles: ${m(`${lin(a, b)} = ${A} + ${180 - A - B}`)}. So ${m(`${a}x = ${180 - B - b}`)} and ${m(`x = ${x.tex()}`)}.`, verify: () => close(a * x.val() + b, A + (180 - A - B)) };
});

/* ============================ HARD ============================ */
def('circle-complete-square', 3, 'spr', 2, SK.cir, (r, v) => {
  const h = r.nz(-7, 7), k = r.nz(-7, 7), rr = r.int(2, 9); const c = h * h + k * k - rr * rr;
  const eq = `x^2 + y^2 ${poly([[-2 * h, 'x'], [-2 * k, 'y'], [c, '']]).replace(/^(?!-)/, '+ ').replace(/^-/, '- ')} = 0`;
  if (v === 0) return { stem: `<p>The graph of ${m(eq)} in the ${m('xy')}-plane is a circle. What is the radius of the circle?</p>`, answer: spr(rr),
    explanation: `Complete the square: ${m(`(x^2 ${-2 * h > 0 ? '+' : '-'} ${Math.abs(2 * h)}x + ${h * h}) + (y^2 ${-2 * k > 0 ? '+' : '-'} ${Math.abs(2 * k)}y + ${k * k}) = ${-c} + ${h * h} + ${k * k}`)}, so ${m(`(x ${h > 0 ? '-' : '+'} ${Math.abs(h)})^2 + (y ${k > 0 ? '-' : '+'} ${Math.abs(k)})^2 = ${rr * rr}`)}. The radius is ${m(`\\sqrt{${rr * rr}} = ${rr}`)}.`,
    verify: () => [0, 1, 2].every((t) => { const x = h + rr * Math.cos(t), y = k + rr * Math.sin(t); return close(x * x + y * y - 2 * h * x - 2 * k * y + c, 0); }) };
  return { stem: `<p>The equation ${m(eq)} defines a circle in the ${m('xy')}-plane. The center of the circle is ${m('(h, k)')}. What is the value of ${m('h + k')}?</p>`, answer: spr(h + k),
    explanation: `Completing the square gives ${m(`(x ${h > 0 ? '-' : '+'} ${Math.abs(h)})^2 + (y ${k > 0 ? '-' : '+'} ${Math.abs(k)})^2 = ${rr * rr}`)}, so the center is ${m(`(${h}, ${k})`)} and ${m(`h + k = ${h + k}`)}. (The center's coordinates are the opposites of half the ${m('x')}- and ${m('y')}-coefficients.)`, verify: () => close(-(-2 * h) / 2 + -(-2 * k) / 2, h + k) };
});

def('trig-similar', 3, 'spr', 2, SK.rt, (r, v) => {
  const T0 = r.pick(TRIPLES); const [a, b, c] = T0; const k = r.int(2, 3);
  const svg = figure({ pts: { D: [0, 0], E: [b * k, 0], F: [0, a * k] }, segs: [['D', 'E'], ['E', 'F'], ['F', 'D']], right: [['E', 'D', 'F']], labels: { D: 'D', E: 'E', F: 'F' }, sideLabels: [['D', 'F', String(a * k)], ['E', 'F', String(c * k)]], W: 250, H: 170 });
  if (v === 0) return { stem: `<p>Right triangle ${m('DEF')} is shown. Triangle ${m('PQR')} (not shown) is similar to triangle ${m('DEF')}, with ${m('P')}, ${m('Q')}, and ${m('R')} corresponding to ${m('D')}, ${m('E')}, and ${m('F')}, respectively. What is the value of ${m('\\tan Q')}?</p>` + svg, answer: spr(F(a, b)),
    explanation: `By the Pythagorean theorem, ${m(`DE = \\sqrt{${c * k}^2 - ${a * k}^2} = ${b * k}`)}. Corresponding angles of similar triangles are congruent, so ${m(`\\tan Q = \\tan E = \\frac{DF}{DE} = \\frac{${a * k}}{${b * k}} = ${F(a, b).tex()}`)}.`, verify: () => close(Math.tan(Math.atan2(a, b)), a / b) };
  const s = r.int(2, 5);
  return { stem: `<p>Right triangle ${m('DEF')} is shown. Triangle ${m('JKL')} is similar to triangle ${m('DEF')}, with ${m('J')}, ${m('K')}, and ${m('L')} corresponding to ${m('D')}, ${m('E')}, and ${m('F')}, respectively. If ${m(`KL = ${c * s}`)}, what is the length of ${m('\\overline{JK}')}?</p>` + svg, answer: spr(b * s),
    explanation: `In triangle ${m('DEF')}, ${m(`DE = \\sqrt{${(c * k) ** 2} - ${(a * k) ** 2}} = ${b * k}`)}, so ${m(`\\cos E = \\frac{${b * k}}{${c * k}} = ${F(b, c).tex()}`)}. Since ${m('K')} corresponds to ${m('E')}, ${m(`\\cos K = ${F(b, c).tex()} = \\frac{JK}{KL}`)}, so ${m(`JK = ${F(b, c).tex()}(${c * s}) = ${b * s}`)}.`, verify: () => close(b * s / (c * s), b / c) };
});

def('arc-radians', 3, 'mcq', 2, SK.cir, (r, v) => {
  if (v === 0) { const rr = r.int(3, 12), k = r.pick([F(1, 3), F(2, 3), F(3, 4), F(5, 6), F(1, 4), F(5, 4)]); const arc = k.mul(rr); need(arc.d <= 2);
    return { stem: `<p>A circle has a radius of ${rr} centimeters. An arc of the circle has a length of ${m(piTex(arc))} centimeters. What is the measure, in radians, of the central angle that intercepts this arc?</p>`, ...numCh([k, k.mul(2), F(k.d, k.n), arc], (x) => m(piTex(x))),
      explanation: `For a central angle ${m('\\theta')} in radians, arc length is ${m('s = r\\theta')}. So ${m(`\\theta = \\frac{${piTex(arc)}}{${rr}}${`\\frac{${piTex(arc)}}{${rr}}` === piTex(k) ? '' : ` = ${piTex(k)}`}`)}.`, verify: () => close(arc.val() * Math.PI / rr, k.val() * Math.PI) }; }
  const rr = r.int(4, 18), k = r.pick([F(5, 6), F(2, 3), F(3, 4), F(5, 3), F(7, 6)]); const arc = k.mul(rr); need(arc.d <= 2);
  const sector = k.mul(rr * rr).div(2);
  return { stem: `<p>In a circle with center ${m('O')} and radius ${rr}, central angle ${m('AOB')} has a measure of ${m(piTex(k))} radians. What is the length of the arc ${m('AB')} intercepted by angle ${m('AOB')}?</p>`, ...numCh([arc, k.mul(2 * rr), sector, F(rr).mul(k.d).div(k.n)], (x) => m(piTex(x))),
    explanation: `Arc length in radians is ${m('s = r\\theta')}: ${m(`${rr}\\cdot${piTex(k)} = ${piTex(arc)}`)}.`, verify: () => close(arc.val(), rr * k.val()) };
});

def('volume-change', 3, 'mcq', 2, SK.av, (r, v) => {
  if (v === 0) { const a = r.pick([2, 3]), b = r.pick([2, 3, 4]);
    const f = F(a * a, b);
    return { stem: `<p>The radius of a right circular cylinder is multiplied by ${a}, and its height is divided by ${b}. The volume of the new cylinder is how many times the volume of the original cylinder?</p>`, ...numCh([f, F(a, b), F(a * a * b), F(a ** 3, b)], (x) => m(x.tex())),
      explanation: `${m('V = \\pi r^2 h')}. The new volume is ${m(`\\pi(${a}r)^2\\left(\\frac{h}{${b}}\\right) = \\frac{${a * a}}{${b}}\\pi r^2 h`)}, so it is ${m(f.tex())} times the original.`, verify: () => close(a * a / b, f.val()) }; }
  const Vc = r.pick([36, 54, 72, 90]);
  const ans = F(Vc * 2, 3);
  return { stem: `<p>A right circular cylinder has a volume of ${m(`${Vc}\\pi`)} cubic inches. A right circular cone has the same radius as the cylinder and twice its height. What is the volume, in cubic inches, of the cone?</p>`, ...numCh([ans, F(Vc, 3), F(Vc * 2), F(Vc * 6)], (x) => m(piTex(x))),
    explanation: `The cylinder's volume is ${m(`\\pi r^2 h = ${Vc}\\pi`)}. The cone's volume is ${m(`\\frac{1}{3}\\pi r^2(2h) = \\frac{2}{3}\\pi r^2 h = \\frac{2}{3}(${Vc}\\pi) = ${piTex(ans)}`)}.`, verify: () => close(ans.val(), Vc * 2 / 3) };
});

def('tangent', 3, 'spr', 2, SK.cir, (r, v) => {
  const T0 = r.pick(TRIPLES.slice(0, 5)); const [a, b, c] = T0; // radius a, tangent b, OP c
  const ang = Math.atan2(b, a) * 180 / Math.PI;
  const P = { O: [0, 0], A: [a * Math.cos(rad(ang)), a * Math.sin(rad(ang))], Pp: [c, 0] };
  void P;
  const svg = circleFig(a, { A: ang }, { extraPts: { P: [c, 0] }, segs: [['O', 'A'], ['A', 'P'], ['O', 'P']], labels: { A: 'A', P: 'P' }, right: [['O', 'A', 'P']],
    labelCenter: [(a * Math.cos(rad(ang)) + c) / 3, a * Math.sin(rad(ang)) / 3],
    sides: v === 0 ? [['O', 'A', String(a)], ['O', 'P', String(c)]] : [['O', 'A', String(a)], ['A', 'P', String(b)]] });
  if (v === 0) return { stem: `<p>In the figure, ${m('\\overline{PA}')} is tangent to the circle with center ${m('O')} at point ${m('A')}. If ${m(`OA = ${a}`)} and ${m(`OP = ${c}`)}, what is the length of ${m('\\overline{PA}')}?</p>` + svg + NOTE, answer: spr(b),
    explanation: `A tangent line is perpendicular to the radius at the point of tangency, so triangle ${m('OAP')} has a right angle at ${m('A')}. Then ${m(`PA = \\sqrt{${c}^2 - ${a}^2} = \\sqrt{${c * c - a * a}} = ${b}`)}.`, verify: () => a * a + b * b === c * c };
  return { stem: `<p>In the figure, ${m('\\overline{PA}')} is tangent to the circle with center ${m('O')} at point ${m('A')}. The radius of the circle is ${a} and ${m(`PA = ${b}`)}. What is the distance from point ${m('P')} to the nearest point on the circle?</p>` + svg + NOTE, answer: spr(c - a),
    explanation: `Since ${m('\\overline{OA} \\perp \\overline{PA}')}, ${m(`OP = \\sqrt{${a}^2 + ${b}^2} = ${c}`)}. The nearest point on the circle lies on segment ${m('\\overline{OP}')}, at distance ${m(`${c} - ${a} = ${c - a}`)} from ${m('P')}.`, verify: () => a * a + b * b === c * c };
});

def('triangle-inequality', 3, 'mcq', 2, SK.lat, (r, v) => {
  const a = r.int(4, 12), b = a + r.int(2, 8);
  const lo = b - a, hi = a + b;
  const good = r.int(lo + 1, hi - 1);
  if (v === 0) return { stem: `<p>Two sides of a triangle have lengths ${a} and ${b}. Which of the following could be the length of the third side?</p>`, ...numCh([good, lo, hi, hi + r.int(1, 4)]),
    explanation: `The third side must be greater than ${m(`${b} - ${a} = ${lo}`)} and less than ${m(`${b} + ${a} = ${hi}`)}. Only ${good} satisfies ${m(`${lo} \\lt s \\lt ${hi}`)}; lengths of exactly ${lo} or ${hi} would make a degenerate "triangle."`, verify: () => good > lo && good < hi };
  const opts = [`${m(lo)} only`, `${m(hi)} only`, `Both ${m(lo)} and ${m(hi)}`, 'Neither'];
  return { stem: `<p>A triangle has side lengths ${a}, ${b}, and ${m('x')}. Which of the following values could be ${m('x')}: ${m(lo)} or ${m(hi)}?</p>`, choices: [opts[3], opts[0], opts[1], opts[2]], order: [3, 0, 1, 2],
    explanation: `The triangle inequality requires ${m(`${lo} \\lt x \\lt ${hi}`)} (strictly). Neither ${lo} nor ${hi} satisfies this strict inequality.`, verify: () => true };
});

def('sphere', 3, 'mcq', 2, SK.av, (r, v) => {
  const rr = r.int(2, 9);
  if (v === 0) { const Vk = F(4 * rr ** 3, 3); need(Vk.isInt());
    return { stem: `<p>A sphere has a volume of ${m(`${Vk.n}\\pi`)} cubic centimeters. The surface area of the sphere is ${m('k\\pi')} square centimeters. What is the value of ${m('k')}? (The surface area of a sphere is ${m('4\\pi r^2')}.)</p>`, ...numCh([4 * rr * rr, 2 * rr * rr, rr * rr, 4 * rr ** 3]),
      explanation: `${m(`\\frac{4}{3}\\pi r^3 = ${Vk.n}\\pi`)} gives ${m(`r^3 = ${rr ** 3}`)}, so ${m(`r = ${rr}`)}. The surface area is ${m(`4\\pi(${rr})^2 = ${4 * rr * rr}\\pi`)}, so ${m(`k = ${4 * rr * rr}`)}.`, verify: () => close(4 / 3 * rr ** 3, Vk.val()) }; }
  const Vk = F(4 * rr ** 3, 3); need(!Vk.isInt() && L.sprFits(Vk.str()));
  return { stem: `<p>A sphere has a surface area of ${m(`${4 * rr * rr}\\pi`)} square inches. The volume of the sphere is ${m('a\\pi')} cubic inches. What is the value of ${m('a')}? (The surface area of a sphere is ${m('4\\pi r^2')}.)</p>`, ...numCh([Vk, F(4 * rr ** 3), F(4 * rr * rr), F(rr ** 3, 3)]),
    explanation: `${m(`4\\pi r^2 = ${4 * rr * rr}\\pi`)} gives ${m(`r = ${rr}`)}. The volume is ${m(`\\frac{4}{3}\\pi(${rr})^3 = ${Vk.tex()}\\pi`)}, so ${m(`a = ${Vk.tex()}`)}.`, verify: () => close(Vk.val(), 4 / 3 * rr ** 3) };
});

def('shaded-area', 3, 'mcq', 2, SK.av, (r, v) => {
  if (v === 0) { const s = 2 * r.int(2, 7); const rr = s / 2;
    const P = { A: [0, 0], B: [s, 0], C: [s, s], Dd: [0, s] };
    const svg = figure({ pts: P, segs: [['A', 'B'], ['B', 'C'], ['C', 'Dd'], ['Dd', 'A']], W: 200, H: 200,
      under: (X, Y, sc) => `<rect x='${X(0)}' y='${Y(s)}' width='${s * sc}' height='${s * sc}' fill='#c4c4c4'/><circle cx='${X(rr)}' cy='${Y(rr)}' r='${rr * sc}' fill='#fff' stroke='#000' stroke-width='1.6'/>`, sideLabels: [['A', 'B', String(s)]] });
    const c = [`${s * s} - ${rr * rr}\\pi`, `${s * s} - ${s * s}\\pi`, `${s * s} - ${s}\\pi`, `${4 * s} - ${rr * rr}\\pi`];
    return { stem: `<p>The figure shows a circle inscribed in a square with side length ${s}. The circle touches each side of the square. What is the area of the shaded region?</p>` + svg, choices: c.map(m),
      explanation: `The square has area ${m(`${s}^2 = ${s * s}`)}. The circle's diameter equals the side of the square, so its radius is ${rr} and its area is ${m(`${rr * rr}\\pi`)}. The shaded area is ${m(c[0])}.`, verify: () => s * s - rr * rr * Math.PI > 0 }; }
  const rr = r.int(3, 9);
  const c = [`${rr * rr}\\pi - ${2 * rr * rr}`, `${rr * rr}\\pi - ${4 * rr * rr}`, `${rr * rr}\\pi - ${rr * rr}`, `${2 * rr}\\pi - ${2 * rr * rr}`];
  const svg = circleFig(rr, { A: 45, B: 135, C: 225, Dd: 315 }, { labels: { A: 'A', B: 'B', C: 'C', Dd: 'D' }, segs: [['A', 'B'], ['B', 'C'], ['C', 'Dd'], ['Dd', 'A']] });
  return { stem: `<p>Square ${m('ABCD')} is inscribed in a circle with center ${m('O')} and radius ${rr}, as shown. What is the area of the region inside the circle but outside the square?</p>` + svg, choices: c.map(m),
    explanation: `The diagonal of the square is a diameter, ${m(2 * rr)}. A square with diagonal ${m('d')} has area ${m('\\frac{d^2}{2}')}, so the square's area is ${m(`\\frac{${4 * rr * rr}}{2} = ${2 * rr * rr}`)}. The circle's area is ${m(`${rr * rr}\\pi`)}, so the region has area ${m(c[0])}.`, verify: () => rr * rr * Math.PI - 2 * rr * rr > 0 };
});

def('isosceles-trig', 3, 'spr', 1, SK.rt, (r, v) => {
  const T0 = r.pick(TRIPLES.slice(0, 4)); const [a, b, c] = T0; const k = r.int(1, 3);
  // isosceles triangle with base 2b k and legs c k; height a k
  if (v === 0) return { stem: `<p>In isosceles triangle ${m('ABC')}, ${m('AB = AC')} and the base ${m('\\overline{BC}')} has length ${2 * b * k}. The measure of angle ${m('B')} is ${m('\\theta')}, where ${m(`\\tan \\theta = \\frac{${a}}{${b}}`)}. What is the area of triangle ${m('ABC')}?</p>`, answer: spr(a * b * k * k),
    explanation: `The altitude from ${m('A')} bisects the base, forming right triangles with base ${b * k}. Then ${m(`\\tan \\theta = \\frac{h}{${b * k}} = \\frac{${a}}{${b}}`)} gives ${m(`h = ${a * k}`)}. The area is ${m(`\\frac{1}{2}(${2 * b * k})(${a * k}) = ${a * b * k * k}`)}.`, verify: () => close(0.5 * 2 * b * k * a * k, a * b * k * k) };
  return { stem: `<p>In right triangle ${m('RST')}, angle ${m('T')} is a right angle, ${m(`RS = ${c * k}`)}, and ${m(`\\sin R = \\frac{${a}}{${c}}`)}. What is the perimeter of triangle ${m('RST')}?</p>`, answer: spr((a + b + c) * k),
    explanation: `${m(`\\sin R = \\frac{ST}{RS}`)}, so ${m(`ST = \\frac{${a}}{${c}}(${c * k}) = ${a * k}`)}. Then ${m(`RT = \\sqrt{${c * k}^2 - ${a * k}^2} = ${b * k}`)}, and the perimeter is ${m(`${c * k} + ${a * k} + ${b * k} = ${(a + b + c) * k}`)}.`, verify: () => (a * k) ** 2 + (b * k) ** 2 === (c * k) ** 2 };
});

def('equilateral-area', 3, 'mcq', 2, SK.rt, (r, v) => {
  if (v === 0) { const s = 2 * r.int(2, 8); const q = s * s / 4;
    return { stem: `<p>An equilateral triangle has a side length of ${s}. What is the area of the triangle?</p>`, choices: [`${q}\\sqrt{3}`, `${s * s / 2}\\sqrt{3}`, `${q}`, `${s * s / 2}`].map(m),
      explanation: `An altitude splits the triangle into two 30-60-90 triangles, so the height is ${m(`\\frac{${s}}{2}\\sqrt{3} = ${s / 2}\\sqrt{3}`)}. The area is ${m(`\\frac{1}{2}(${s})(${s / 2}\\sqrt{3}) = ${q}\\sqrt{3}`)}.`, verify: () => close(Math.sqrt(3) / 4 * s * s, q * Math.sqrt(3)) }; }
  const t = r.int(2, 6); const s = 2 * t; // height t*sqrt3
  return { stem: `<p>The height of an equilateral triangle is ${m(`${t}\\sqrt{3}`)}. What is the area of the triangle?</p>`, choices: [`${t * t}\\sqrt{3}`, `${2 * t * t}\\sqrt{3}`, `${t * t}`, `${3 * t * t}`].map(m),
    explanation: `In a 30-60-90 triangle the height is ${m('\\sqrt{3}')} times half the side, so half the side is ${t} and the side is ${s}. The area is ${m(`\\frac{1}{2}(${s})(${t}\\sqrt{3}) = ${t * t}\\sqrt{3}`)}.`, verify: () => close(Math.sqrt(3) / 4 * s * s, t * t * Math.sqrt(3)) };
});

def('circle-point', 3, 'spr', 1, SK.cir, (r, v) => {
  if (v === 0) { const h = r.nz(-5, 5), kk = r.nz(-5, 5); const T0 = r.pick([[3, 4, 5], [6, 8, 10], [5, 12, 13]]); const yq = kk + T0[1]; const ans = h + T0[0];
    const eq = `(x ${h > 0 ? '-' : '+'} ${Math.abs(h)})^2 + (y ${kk > 0 ? '-' : '+'} ${Math.abs(kk)})^2 = ${T0[2] ** 2}`;
    return { stem: `<p>The point ${m(`(a, ${yq})`)} lies on the circle with equation ${m(eq)} in the ${m('xy')}-plane, and ${m(`a \\gt ${h}`)}. What is the value of ${m('a')}?</p>`, answer: spr(ans),
      explanation: `Substitute ${m(`y = ${yq}`)}: ${m(`(a ${h > 0 ? '-' : '+'} ${Math.abs(h)})^2 + ${T0[1] ** 2} = ${T0[2] ** 2}`)}, so ${m(`(a ${h > 0 ? '-' : '+'} ${Math.abs(h)})^2 = ${T0[0] ** 2}`)} and ${m(`a ${h > 0 ? '-' : '+'} ${Math.abs(h)} = \\pm ${T0[0]}`)}. Since ${m(`a \\gt ${h}`)}, ${m(`a = ${ans}`)}.`, verify: () => (ans - h) ** 2 + (yq - kk) ** 2 === T0[2] ** 2 }; }
  const h = r.nz(-8, 8), kk = r.int(2, 9); const sgn = r.sign(); const k2 = sgn * kk;
  return { stem: `<p>A circle in the ${m('xy')}-plane has center ${m(`(${h}, ${k2})`)} and is tangent to the ${m('x')}-axis. The equation of the circle can be written as ${m('(x - h)^2 + (y - k)^2 = c')}, where ${m('h')}, ${m('k')}, and ${m('c')} are constants. What is the value of ${m('c')}?</p>`, answer: spr(kk * kk),
    explanation: `A circle tangent to the ${m('x')}-axis touches it at the point directly ${sgn > 0 ? 'below' : 'above'} the center, so the radius equals the distance from the center to the ${m('x')}-axis, ${m(`|${k2}| = ${kk}`)}. Thus ${m(`c = r^2 = ${kk * kk}`)}.`, verify: () => true };
});

def('similar-solids', 3, 'mcq', 2, SK.av, (r, v) => {
  const a = r.int(2, 4), b = a + r.int(1, 3); need(L.gcd(a, b) === 1);
  if (v === 0) { const Vs = r.int(1, 4) * a ** 3; const VL = F(Vs * b ** 3, a ** 3); need(VL.isInt() && L.sprFits(VL.str()));
    return { stem: `<p>Two right circular cylinders are similar. The height of the smaller cylinder is ${a * 2} centimeters, and the height of the larger cylinder is ${b * 2} centimeters. The volume of the smaller cylinder is ${m(`${Vs}\\pi`)} cubic centimeters. The volume of the larger cylinder is ${m('k\\pi')} cubic centimeters. What is the value of ${m('k')}?</p>`, ...numCh([VL, F(Vs * b, a), F(Vs * b * b, a * a), F(Vs * a ** 3, b ** 3)]),
      explanation: `The ratio of corresponding lengths is ${m(`\\frac{${b * 2}}{${a * 2}} = \\frac{${b}}{${a}}`)}, so the ratio of volumes is ${m(`\\left(\\frac{${b}}{${a}}\\right)^3 = \\frac{${b ** 3}}{${a ** 3}}`)}. Thus ${m(`k = ${Vs}\\cdot\\frac{${b ** 3}}{${a ** 3}} = ${VL.n}`)}.`, verify: () => close(VL.val() / Vs, (b / a) ** 3) }; }
  const As = r.int(2, 6) * a * a; const AL = F(As * b * b, a * a); need(AL.isInt());
  return { stem: `<p>Two similar triangles have corresponding sides in the ratio ${a} to ${b}. The area of the smaller triangle is ${As} square inches. What is the area, in square inches, of the larger triangle?</p>`, ...numCh([AL, F(As * b, a), F(As * b ** 3, a ** 3), F(As * a * a, b * b)]),
    explanation: `Areas of similar figures are in the ratio of the squares of corresponding lengths: ${m(`\\left(\\frac{${b}}{${a}}\\right)^2 = \\frac{${b * b}}{${a * a}}`)}. So the larger area is ${m(`${As}\\cdot\\frac{${b * b}}{${a * a}} = ${AL.n}`)}.`, verify: () => close(AL.val() / As, (b / a) ** 2) };
});

def('parallel-algebra', 3, 'spr', 1, SK.lat, (r, v) => {
  const phi = r.int(50, 70);
  const regs = ['ur', 'ul', 'll', 'lr'];
  const rp = r.pick(regs), rq = r.pick(regs); need(!facing(rp, rq));
  const mp = regionMeasure(rp, phi), mq = regionMeasure(rq, phi);
  const same = mp === mq; need(v === 0 ? same : !same);
  // choose expressions: a x + b = mp, c x + d = mq with integer x
  const x = r.int(8, 25), a = r.int(2, 5), c = r.int(2, 6); need(a !== c);
  const b = mp - a * x, d = mq - c * x; need(Math.abs(b) < 80 && Math.abs(d) < 80 && b !== 0 && d !== 0);
  const ex = (p, q) => `(${p}${it('x')} ${q >= 0 ? '+' : '−'} ${Math.abs(q)})°`;
  const svg = parallelFig(phi, [rp, ex(a, b)], [rq, ex(c, d)]);
  const ask = r.pick(['x', 'angle']);
  const ans = ask === 'x' ? x : mp;
  return { stem: `<p>In the figure, line ${m('\\ell')} is parallel to line ${m('m')}. ${ask === 'x' ? `What is the value of ${m('x')}?` : `What is the value of ${m(`${lin(a, b)}`)}?`}</p>` + svg + NOTE, answer: spr(ans),
    explanation: same ? `The two marked angles are both ${mp < 90 ? 'acute' : 'obtuse'} angles formed by a transversal crossing parallel lines, so they are congruent: ${m(`${lin(a, b)} = ${lin(c, d)}`)}. Then ${m(`${a - c}x = ${d - b}`)} and ${m(`x = ${x}`)}${ask === 'x' ? '' : `, so ${m(`${lin(a, b)} = ${mp}`)}`}.`
      : `One marked angle is acute and the other is obtuse, so they are supplementary: ${m(`(${lin(a, b)}) + (${lin(c, d)}) = 180`)}. Then ${m(`${a + c}x ${b + d >= 0 ? '+' : '-'} ${Math.abs(b + d)} = 180`)}, so ${m(`x = ${x}`)}${ask === 'x' ? '' : ` and ${m(`${lin(a, b)} = ${mp}`)}`}.`,
    verify: () => (same ? a * x + b === c * x + d : a * x + b + c * x + d === 180) };
});

def('chord', 3, 'mcq', 2, SK.cir, (r, v) => {
  const T0 = r.pick(TRIPLES.slice(0, 5)); const [dd, half, R] = r.chance(0.5) ? T0 : [T0[1], T0[0], T0[2]];
  const ang = Math.atan2(half, dd) * 180 / Math.PI;
  const svg = circleFig(R, { A: -ang, B: ang }, { extraPts: { M: [dd, 0] }, segs: [['A', 'B'], ['O', 'M', 'dash'], ['O', 'A']], labels: { A: 'A', B: 'B', M: 'M' }, right: [['O', 'M', 'B']] });
  if (v === 0) return { stem: `<p>In the circle shown with center ${m('O')} and radius ${R}, chord ${m('\\overline{AB}')} is ${dd} units from the center (${m(`OM = ${dd}`)}). What is the length of chord ${m('\\overline{AB}')}?</p>` + svg + NOTE, ...numCh([2 * half, half, 2 * R, R + dd]),
    explanation: `The perpendicular from the center to a chord bisects the chord. In right triangle ${m('OMA')}, ${m(`AM = \\sqrt{${R}^2 - ${dd}^2} = ${half}`)}, so ${m(`AB = 2(${half}) = ${2 * half}`)}.`, verify: () => dd * dd + half * half === R * R };
  return { stem: `<p>In the circle shown with center ${m('O')}, chord ${m('\\overline{AB}')} has length ${2 * half} and segment ${m('\\overline{OM}')} is perpendicular to ${m('\\overline{AB}')} with ${m(`OM = ${dd}`)}. What is the radius of the circle?</p>` + svg + NOTE, ...numCh([R, dd + half, half, 2 * R]),
    explanation: `${m('\\overline{OM}')} bisects the chord, so ${m(`AM = ${half}`)}. The radius is ${m(`OA = \\sqrt{${dd}^2 + ${half}^2} = ${R}`)}.`, verify: () => dd * dd + half * half === R * R };
});

module.exports = out;
