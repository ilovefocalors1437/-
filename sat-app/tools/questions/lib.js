'use strict';
/* Shared helpers for the SAT question generators: seeded RNG, exact fractions,
   LaTeX formatting, a small LaTeX evaluator (for verification), SPR answer forms,
   and SVG figure helpers. No dependencies. */

const T = String.raw;

/* ---------------- RNG ---------------- */
function hashStr(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function makeRng(seed) {
  const f = mulberry32(seed);
  const r = {
    f,
    int: (a, b) => a + Math.floor(f() * (b - a + 1)),
    pick: (arr) => arr[Math.floor(f() * arr.length)],
    sign: () => (f() < 0.5 ? -1 : 1),
    nz: (a, b) => { let v; do { v = a + Math.floor(f() * (b - a + 1)); } while (v === 0); return v; },
    shuffle: (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(f() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; },
    chance: (p) => f() < p,
  };
  return r;
}

/* ---------------- assertions ---------------- */
class Reject extends Error {}
function need(cond, msg) { if (!cond) throw new Reject(msg || 'precondition'); }
function assert(cond, msg) { if (!cond) throw new Error('ASSERT: ' + (msg || '')); }

/* ---------------- fractions ---------------- */
function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { [a, b] = [b, a % b]; } return a; }
function lcm(a, b) { return Math.abs(a * b) / gcd(a, b); }
class Fr {
  constructor(n, d = 1) {
    if (n instanceof Fr) { d = n.d; n = n.n; }
    assert(Number.isInteger(n) && Number.isInteger(d) && d !== 0, 'bad fraction ' + n + '/' + d);
    if (d < 0) { n = -n; d = -d; }
    const g = gcd(n, d) || 1;
    this.n = n / g; this.d = d / g;
    if (this.n === 0) this.n = 0; // kill -0
    assert(Math.abs(this.n) < 1e12 && this.d < 1e12, 'fraction overflow');
  }
  add(o) { o = fr(o); return new Fr(this.n * o.d + o.n * this.d, this.d * o.d); }
  sub(o) { o = fr(o); return new Fr(this.n * o.d - o.n * this.d, this.d * o.d); }
  mul(o) { o = fr(o); return new Fr(this.n * o.n, this.d * o.d); }
  div(o) { o = fr(o); assert(o.n !== 0, 'div0'); return new Fr(this.n * o.d, this.d * o.n); }
  neg() { return new Fr(-this.n, this.d); }
  eq(o) { o = fr(o); return this.n === o.n && this.d === o.d; }
  isInt() { return this.d === 1; }
  val() { return this.n / this.d; }
  sign() { return Math.sign(this.n); }
  abs() { return new Fr(Math.abs(this.n), this.d); }
  str() { return this.d === 1 ? String(this.n) : this.n + '/' + this.d; }
  tex() { return this.d === 1 ? String(this.n) : (this.n < 0 ? '-' : '') + '\\frac{' + Math.abs(this.n) + '}{' + this.d + '}'; }
}
function fr(x, d) { if (x instanceof Fr) return x; if (d !== undefined) return new Fr(x, d); assert(Number.isInteger(x), 'fr non-int ' + x); return new Fr(x, 1); }
function F(n, d = 1) { return new Fr(n, d); }

/* ---------------- LaTeX formatting ---------------- */
// number (int or Fr) -> tex
function num(x) {
  if (x instanceof Fr) return x.d === 1 && Math.abs(x.n) >= 1000 ? texInt(x.n) : x.tex();
  if (Number.isInteger(x)) return Math.abs(x) >= 1000 ? texInt(x) : String(x);
  return decStr(x);
}
function decStr(x, dp = 6) { let s = (+x.toFixed(dp)).toString(); return s; }
function commas(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
function texInt(n) { const s = commas(Math.abs(n)).replace(/,/g, '{,}'); return (n < 0 ? '-' : '') + s; }
// poly([[coef, mono], ...]) e.g. poly([[3,'x^2'],[-1,'x'],[5,'']]) -> "3x^2 - x + 5"
function poly(terms, opts = {}) {
  let out = '';
  for (const [c0, mono] of terms) {
    const c = c0 instanceof Fr ? c0 : (Number.isInteger(c0) ? F(c0) : c0);
    const isFr = c instanceof Fr;
    const v = isFr ? c.val() : c;
    if (v === 0) continue;
    const neg = v < 0;
    const absTex = isFr ? c.abs().tex() : decStr(Math.abs(v));
    const isOne = Math.abs(v) === 1;
    let body = mono ? ((isOne ? '' : absTex) + mono) : absTex;
    if (out === '') out = (neg ? '-' : '') + body;
    else out += (neg ? ' - ' : ' + ') + body;
  }
  return out === '' ? '0' : out;
}
function lin(a, b, v = 'x') { return poly([[a, v], [b, '']]); }
function quad(a, b, c, v = 'x') { return poly([[a, v + '^2'], [b, v], [c, '']]); }
// "(x - 3)" / "(x + 3)"
function binom(v, k) { return '(' + poly([[1, v], [k, '']]) + ')'; }
function m(tex) { return '\\(' + tex + '\\)'; }
function M(tex) { return '\\[' + tex + '\\]'; }
function money(x) { return '$' + (Number.isInteger(x) ? commas(x) : commas(x.toFixed(2).split('.')[0]) + '.' + x.toFixed(2).split('.')[1]); }

/* ---------------- SPR answers ---------------- */
function sprFits(s) { return s.startsWith('-') ? s.length <= 6 : s.length <= 5; }
function decForms(v) {
  const neg = v < 0, a = Math.abs(v), maxLen = neg ? 6 : 5, sg = neg ? '-' : '';
  const out = [];
  const ip = Math.floor(a + 1e-12);
  const prefixes = ip === 0 ? ['', '0'] : [String(ip)];
  for (const p of prefixes) {
    const nd = maxLen - sg.length - p.length - 1;
    if (nd < 1) continue;
    const sc = Math.pow(10, nd);
    for (const x of [Math.floor(a * sc + 1e-9), Math.round(a * sc)]) {
      const ipart = Math.floor(x / sc), fpart = x % sc;
      if (ipart !== ip) continue;
      const s = sg + p + '.' + String(fpart).padStart(nd, '0');
      if (!out.includes(s)) out.push(s);
    }
  }
  return out;
}
function terminates(d) { while (d % 2 === 0) d /= 2; while (d % 5 === 0) d /= 5; return d === 1; }
// returns acceptable answer strings; canonical exact first
function spr(x) {
  const v = fr(x);
  if (v.isInt()) { const s = String(v.n); need(sprFits(s), 'spr int too long'); return [s]; }
  const out = [];
  const fs = v.str();
  if (terminates(v.d)) {
    const dec = v.val();
    let s = (+dec.toFixed(10)).toString();
    const short = s.replace(/^(-?)0\./, '$1.');
    if (sprFits(fs)) out.push(fs);
    if (sprFits(s)) out.push(s);
    if (sprFits(short) && short !== s) out.push(short);
    need(out.length > 0, 'spr does not fit');
    return out;
  }
  need(sprFits(fs), 'spr fraction too long');
  out.push(fs);
  for (const s of decForms(v.val())) if (!out.includes(s)) out.push(s);
  return out;
}
function sprDec(x) { // a decimal answer given as a number (e.g. 2.5, 17.25)
  const s = (+x.toFixed(10)).toString();
  need(sprFits(s) || sprFits(s.replace(/^(-?)0\./, '$1.')), 'dec too long');
  const out = [];
  if (sprFits(s)) out.push(s);
  const sh = s.replace(/^(-?)0\./, '$1.');
  if (sh !== s && sprFits(sh)) out.push(sh);
  return out;
}

/* ---------------- tiny LaTeX evaluator (for verification) ---------------- */
function texEval(tex, vars = {}) {
  let s = tex.replace(/\\left|\\right|\\,|\\!|\\;|\\ /g, ' ').replace(/\{,\}/g, '').replace(/\\dfrac/g, '\\frac');
  let i = 0;
  const ws = () => { while (i < s.length && /\s/.test(s[i])) i++; };
  const peek = () => { ws(); return s[i]; };
  const startsCmd = (c) => { ws(); return s.startsWith(c, i) && !/[a-zA-Z]/.test(s[i + c.length] || ''); };
  function expr() {
    let v = term();
    for (;;) {
      const c = peek();
      if (c === '+') { i++; v += term(); }
      else if (c === '-') { i++; v -= term(); }
      else return v;
    }
  }
  function canStartFactor() {
    const c = peek();
    if (c === undefined) return false;
    if (/[0-9.a-zA-Z({]/.test(c)) return true;
    if (c === '\\') return startsCmd('\\frac') || startsCmd('\\sqrt') || startsCmd('\\pi') || startsCmd('\\cdot') === false && false;
    return false;
  }
  function term() {
    let v = unary();
    for (;;) {
      if (startsCmd('\\cdot') ) { i += 5; v *= unary(); continue; }
      if (startsCmd('\\times')) { i += 6; v *= unary(); continue; }
      const c = peek();
      if (c === '/') { i++; v /= unary(); continue; }
      if (canStartFactor()) { v *= power(); continue; }
      return v;
    }
  }
  function unary() { if (peek() === '-') { i++; return -unary(); } if (peek() === '+') { i++; return unary(); } return power(); }
  function power() {
    let b = base();
    if (peek() === '^') {
      i++;
      let e;
      if (peek() === '{') { i++; e = expr(); expectCh('}'); }
      else { ws(); const c = s[i++]; e = /[0-9]/.test(c) ? +c : vars[c]; }
      b = Math.pow(b, e);
    }
    return b;
  }
  function expectCh(ch) { if (peek() !== ch) throw new Error('texEval: expected ' + ch + ' at ' + i + ' in ' + tex); i++; }
  function group() { expectCh('{'); const v = expr(); expectCh('}'); return v; }
  function base() {
    const c = peek();
    if (c === '(') { i++; const v = expr(); expectCh(')'); return v; }
    if (c === '{') return group();
    if (/[0-9.]/.test(c)) { let j = i; while (j < s.length && /[0-9.]/.test(s[j])) j++; const v = parseFloat(s.slice(i, j)); i = j; return v; }
    if (c === '\\') {
      if (startsCmd('\\frac')) { i += 5; const a = group(); const b = group(); return a / b; }
      if (startsCmd('\\sqrt')) {
        i += 5; let n = 2;
        if (peek() === '[') { i++; n = expr(); expectCh(']'); }
        const a = group(); return n === 2 ? Math.sqrt(a) : (a < 0 && n % 2 === 1 ? -Math.pow(-a, 1 / n) : Math.pow(a, 1 / n));
      }
      if (startsCmd('\\pi')) { i += 3; return Math.PI; }
      throw new Error('texEval: unknown command at ' + s.slice(i, i + 10) + ' in ' + tex);
    }
    if (/[a-zA-Z]/.test(c)) { i++; if (!(c in vars)) throw new Error('texEval: unbound ' + c + ' in ' + tex); return vars[c]; }
    throw new Error('texEval: unexpected ' + c + ' at ' + i + ' in ' + tex);
  }
  const v = expr();
  ws();
  if (i !== s.length) throw new Error('texEval: trailing input "' + s.slice(i) + '" in ' + tex);
  return v;
}
function close(a, b, eps = 1e-7) { return Math.abs(a - b) <= eps * Math.max(1, Math.abs(a), Math.abs(b)); }
// does "lhs = rhs" hold for vars?
function eqHolds(eqTex, vars) { const [l, r] = eqTex.split('='); return close(texEval(l, vars), texEval(r, vars)); }
// are two expressions identically equal (checked at several random points)?
function sameExpr(t1, t2, varNames = ['x'], pts = 6) {
  for (let k = 0; k < pts; k++) {
    const vars = {}; varNames.forEach((v, j) => { vars[v] = 0.37 + k * 0.913 + j * 1.71; });
    if (!close(texEval(t1, vars), texEval(t2, vars), 1e-6)) return false;
  }
  return true;
}
function stripM(s) { return s.replace(/^\\\(|\\\)$/g, ''); }

/* ---------------- choices ---------------- */
// mc(correct, distractors...) -> {choices:[correct, ...]} ; asserts distinct
function distinct(arr) { return new Set(arr).size === arr.length; }

/* ---------------- HTML tables ---------------- */
function table(head, rows, caption) {
  let h = "<table class='qtable'>";
  if (caption) h += '<caption>' + caption + '</caption>';
  if (head) h += '<thead><tr>' + head.map((x) => '<th>' + x + '</th>').join('') + '</tr></thead>';
  h += '<tbody>' + rows.map((r) => '<tr>' + r.map((x, j) => (j === 0 && head && r.isHeadRow !== false ? '<th>' + x + '</th>' : '<td>' + x + '</td>')).join('') + '</tr>').join('') + '</tbody></table>';
  return h;
}
// plain table (no row headers)
function ptable(head, rows) {
  return "<table class='qtable'><thead><tr>" + head.map((x) => '<th>' + x + '</th>').join('') + '</tr></thead><tbody>' +
    rows.map((r) => '<tr>' + r.map((x) => '<td>' + x + '</td>').join('') + '</tr>').join('') + '</tbody></table>';
}

/* ---------------- SVG ---------------- */
const FONT = "font-family='system-ui, -apple-system, Segoe UI, Roboto, sans-serif'";
function r2(x) { return Math.round(x * 10) / 10; }
function svgWrap(W, H, body, maxw = 320) {
  return `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${W} ${H}' width='100%' style='max-width:${maxw}px;display:block;margin:8px auto;background:#fff' ${FONT} font-size='13' role='img'>` + body + '</svg>';
}
function txt(x, y, s, opt = {}) {
  const anchor = opt.anchor || 'middle';
  const size = opt.size ? ` font-size='${opt.size}'` : '';
  const style = opt.italic ? " font-style='italic'" : '';
  const weight = opt.bold ? " font-weight='bold'" : '';
  const base = opt.base || 'middle';
  const halo = opt.halo ? " stroke='#fff' stroke-width='3' paint-order='stroke' stroke-linejoin='round'" : '';
  const rot = opt.rotate ? ` transform='rotate(${opt.rotate} ${r2(x)} ${r2(y)})'` : '';
  return `<text x='${r2(x)}' y='${r2(y)}' text-anchor='${anchor}' dominant-baseline='${base}'${size}${style}${weight}${rot}${halo} fill='#000'>${s}</text>`;
}
function it(s) { return `<tspan font-style='italic'>${s}</tspan>`; }
function line(x1, y1, x2, y2, opt = {}) {
  const w = opt.w || 1.5; const dash = opt.dash ? ` stroke-dasharray='${opt.dash}'` : '';
  const col = opt.color || '#000';
  return `<line x1='${r2(x1)}' y1='${r2(y1)}' x2='${r2(x2)}' y2='${r2(y2)}' stroke='${col}' stroke-width='${w}'${dash}/>`;
}
function dot(x, y, rr = 3.2, fill = '#000') { return `<circle cx='${r2(x)}' cy='${r2(y)}' r='${rr}' fill='${fill}'/>`; }
function arrowHead(x, y, dx, dy, size = 7) {
  const L = Math.hypot(dx, dy); const ux = dx / L, uy = dy / L;
  const px = -uy, py = ux;
  const bx = x - ux * size, by = y - uy * size;
  return `<polygon points='${r2(x)},${r2(y)} ${r2(bx + px * size * 0.45)},${r2(by + py * size * 0.45)} ${r2(bx - px * size * 0.45)},${r2(by - py * size * 0.45)}' fill='#000'/>`;
}

/* Coordinate plane, SAT style: grid, axes with arrows, numbered ticks.
   opts: {x:[min,max], y:[min,max], grid:1, tick:k (label every), W, H, items:[...]}
   items: {fn, from, to} | {seg:[x1,y1,x2,y2]} | {pts:[[x,y]...], open:false} | {label:[x,y,text,anchor]} | {poly:[[x,y]..], fill} */
function plane(opts) {
  const W = opts.W || 300, H = opts.H || 300, pad = 22;
  const [x0, x1] = opts.x, [y0, y1] = opts.y;
  const gx = opts.grid || 1, gy = opts.gridY || gx;
  const tx = opts.tick || gx, ty = opts.tickY || tx;
  const X = (x) => pad + (x - x0) / (x1 - x0) * (W - 2 * pad);
  const Y = (y) => H - pad - (y - y0) / (y1 - y0) * (H - 2 * pad);
  let b = `<defs><clipPath id='${opts.id || 'c'}${Math.round(x0 * 7 + y1 * 13 + W)}'><rect x='${pad}' y='${pad}' width='${W - 2 * pad}' height='${H - 2 * pad}'/></clipPath></defs>`;
  const clip = `${opts.id || 'c'}${Math.round(x0 * 7 + y1 * 13 + W)}`;
  for (let x = Math.ceil(x0 / gx) * gx; x <= x1 + 1e-9; x += gx) b += line(X(x), Y(y0), X(x), Y(y1), { w: 0.6, color: '#c8c8c8' });
  for (let y = Math.ceil(y0 / gy) * gy; y <= y1 + 1e-9; y += gy) b += line(X(x0), Y(y), X(x1), Y(y), { w: 0.6, color: '#c8c8c8' });
  // axes
  if (y0 <= 0 && y1 >= 0) { b += line(X(x0) - 8, Y(0), X(x1) + 8, Y(0), { w: 1.3 }) + arrowHead(X(x1) + 12, Y(0), 1, 0) + arrowHead(X(x0) - 12, Y(0), -1, 0); b += txt(X(x1) + 12, Y(0) - 11, it('x')); }
  if (x0 <= 0 && x1 >= 0) { b += line(X(0), Y(y0) + 8, X(0), Y(y1) - 8, { w: 1.3 }) + arrowHead(X(0), Y(y1) - 12, 0, -1) + arrowHead(X(0), Y(y0) + 12, 0, 1); b += txt(X(0) + 11, Y(y1) - 12, it('y')); }
  const ox = (x0 <= 0 && x1 >= 0) ? X(0) : X(x0), oy = (y0 <= 0 && y1 >= 0) ? Y(0) : Y(y0);
  for (let x = Math.ceil(x0 / tx) * tx; x <= x1 + 1e-9; x += tx) { if (Math.abs(x) < 1e-9) continue; b += line(X(x), oy - 3, X(x), oy + 3, { w: 1 }) + txt(X(x), oy + 12, fmtTick(x), { size: 11, halo: true }); }
  for (let y = Math.ceil(y0 / ty) * ty; y <= y1 + 1e-9; y += ty) { if (Math.abs(y) < 1e-9) continue; b += line(ox - 3, Y(y), ox + 3, Y(y), { w: 1 }) + txt(ox - 6, Y(y), fmtTick(y), { size: 11, anchor: 'end', halo: true }); }
  if (x0 <= 0 && x1 >= 0 && y0 <= 0 && y1 >= 0) b += txt(X(0) - 8, Y(0) + 11, it('O'), { size: 11, halo: true });
  let g = '';
  for (const itm of opts.items || []) {
    if (itm.fn) {
      const a = itm.from !== undefined ? itm.from : x0, z = itm.to !== undefined ? itm.to : x1;
      let d = ''; const N = 240; let pen = false;
      for (let k = 0; k <= N; k++) {
        const x = a + (z - a) * k / N; const y = itm.fn(x);
        if (!isFinite(y) || y > y1 + (y1 - y0) || y < y0 - (y1 - y0)) { pen = false; continue; }
        d += (pen ? 'L' : 'M') + r2(X(x)) + ' ' + r2(Y(y)) + ' '; pen = true;
      }
      g += `<path d='${d}' fill='none' stroke='#000' stroke-width='2'${itm.dash ? " stroke-dasharray='6 4'" : ''}/>`;
    }
    if (itm.seg) { const [a, bb, c, dd] = itm.seg; g += line(X(a), Y(bb), X(c), Y(dd), { w: 2, dash: itm.dash }); }
    if (itm.poly) g += `<polygon points='${itm.poly.map(([x, y]) => r2(X(x)) + ',' + r2(Y(y))).join(' ')}' fill='${itm.fill || '#ddd'}' fill-opacity='${itm.opacity || 0.55}' stroke='none'/>`;
    if (itm.pts) for (const [x, y] of itm.pts) g += itm.open ? `<circle cx='${r2(X(x))}' cy='${r2(Y(y))}' r='3.5' fill='#fff' stroke='#000' stroke-width='1.5'/>` : dot(X(x), Y(y), itm.r || 3.5);
  }
  b += `<g clip-path='url(#${clip})'>` + g + '</g>';
  for (const itm of opts.items || []) if (itm.label) { const [x, y, s, an] = itm.label; b += txt(X(x), Y(y), s, { anchor: an || 'middle', size: 12 }); }
  return svgWrap(W, H, b, opts.maxw || 320);
}
function fmtTick(v) { return Number.isInteger(v) ? (v < 0 ? '−' + Math.abs(v) : String(v)) : String(+v.toFixed(2)).replace('-', '−'); }

/* Data chart (first-quadrant style) for scatterplots / line graphs.
   opts: {x:[0,max], y:[0,max], xt: tick, yt: tick, xlabel, ylabel, pts, fn, segs, W, H} */
function chart(opts) {
  const W = opts.W || 320, H = opts.H || 260, L = 50, R = 14, Tp = 14, B = 44;
  const [x0, x1] = opts.x, [y0, y1] = opts.y;
  const X = (x) => L + (x - x0) / (x1 - x0) * (W - L - R);
  const Y = (y) => H - B - (y - y0) / (y1 - y0) * (H - B - Tp);
  let b = '';
  const xt = opts.xt, yt = opts.yt;
  for (let x = x0; x <= x1 + 1e-9; x += xt) { b += line(X(x), Y(y0), X(x), Y(y1), { w: 0.6, color: '#c8c8c8' }); b += txt(X(x), Y(y0) + 12, fmtTick(+x.toFixed(4)), { size: 11 }); }
  for (let y = y0; y <= y1 + 1e-9; y += yt) { b += line(X(x0), Y(y), X(x1), Y(y), { w: 0.6, color: '#c8c8c8' }); b += txt(X(x0) - 5, Y(y), fmtTick(+y.toFixed(4)), { size: 11, anchor: 'end' }); }
  b += line(X(x0), Y(y0), X(x1), Y(y0), { w: 1.3 }) + line(X(x0), Y(y0), X(x0), Y(y1), { w: 1.3 });
  if (opts.xlabel) b += txt((X(x0) + X(x1)) / 2, H - 10, opts.xlabel, { size: 12 });
  if (opts.ylabel) b += txt(13, (Y(y0) + Y(y1)) / 2, opts.ylabel, { size: 12, rotate: -90 });
  if (opts.fn) {
    let d = ''; const a = opts.fnFrom !== undefined ? opts.fnFrom : x0, z = opts.fnTo !== undefined ? opts.fnTo : x1;
    for (let k = 0; k <= 200; k++) { const x = a + (z - a) * k / 200; const y = opts.fn(x); if (y < y0 || y > y1) continue; d += (d ? 'L' : 'M') + r2(X(x)) + ' ' + r2(Y(y)) + ' '; }
    b += `<path d='${d}' fill='none' stroke='#000' stroke-width='1.8'/>`;
  }
  for (const s of opts.segs || []) b += line(X(s[0]), Y(s[1]), X(s[2]), Y(s[3]), { w: 1.8 });
  for (const [x, y] of opts.pts || []) b += dot(X(x), Y(y), 3.3);
  if (opts.extra) b += opts.extra(X, Y);
  return svgWrap(W, H, b, opts.maxw || 320);
}

/* Bar chart. opts: {cats:[..], vals:[..], y:[0,max], yt, xlabel, ylabel} */
function barChart(opts) {
  const W = opts.W || 320, H = opts.H || 250, L = 50, R = 10, Tp = 14, B = 46;
  const [y0, y1] = opts.y; const n = opts.cats.length;
  const Y = (y) => H - B - (y - y0) / (y1 - y0) * (H - B - Tp);
  const slot = (W - L - R) / n;
  let b = '';
  for (let y = y0; y <= y1 + 1e-9; y += opts.yt) { b += line(L, Y(y), W - R, Y(y), { w: 0.6, color: '#c8c8c8' }); b += txt(L - 5, Y(y), fmtTick(y), { size: 11, anchor: 'end' }); }
  opts.cats.forEach((c, k) => {
    const x = L + slot * k + slot * 0.2, w = slot * 0.6;
    b += `<rect x='${r2(x)}' y='${r2(Y(opts.vals[k]))}' width='${r2(w)}' height='${r2(Y(y0) - Y(opts.vals[k]))}' fill='#9a9a9a' stroke='#000' stroke-width='1'/>`;
    b += txt(x + w / 2, Y(y0) + 12, c, { size: 11 });
  });
  b += line(L, Y(y0), W - R, Y(y0), { w: 1.3 }) + line(L, Y(y0), L, Y(y1), { w: 1.3 });
  if (opts.xlabel) b += txt((L + W - R) / 2, H - 10, opts.xlabel, { size: 12 });
  if (opts.ylabel) b += txt(13, (Y(y0) + Y(y1)) / 2, opts.ylabel, { size: 12, rotate: -90 });
  return svgWrap(W, H, b);
}

/* Dot plot. opts: {min, max, counts:{value:count}, label} */
function dotPlot(opts) {
  const W = opts.W || 320; const n = opts.max - opts.min; const L = 20, R = 20;
  const maxc = Math.max(...Object.values(opts.counts));
  const dy = 14; const H = 60 + maxc * dy;
  const base = H - 40;
  const X = (v) => L + (v - opts.min) / n * (W - L - R);
  let b = line(L - 8, base, W - R + 8, base, { w: 1.3 });
  for (let v = opts.min; v <= opts.max; v++) { b += line(X(v), base - 4, X(v), base + 4, { w: 1 }) + txt(X(v), base + 14, fmtTick(v), { size: 11 }); }
  for (const [v, c] of Object.entries(opts.counts)) for (let k = 0; k < c; k++) b += dot(X(+v), base - 10 - k * dy, 5);
  if (opts.label) b += txt(W / 2, H - 8, opts.label, { size: 12 });
  return svgWrap(W, H, b);
}

/* Generic geometric figure on abstract coordinates, fitted to a box.
   pts: {A:[x,y],...}; segs: [['A','B'],...]; labels: {A:'A'} (placed away from centroid),
   sideLabels: [['A','B','10']], angleLabels: [['B','A','C','40°']] (label for angle at A between B,C),
   right: [['B','A','C']] right-angle mark at A; extra(X,Y) for custom svg. */
function figure(opts) {
  const W = opts.W || 300, H0 = opts.H || 220, pad = opts.pad || 30;
  const P = opts.pts; const names = Object.keys(P);
  let xs = names.map((k) => P[k][0]), ys = names.map((k) => P[k][1]);
  if (opts.bounds) { xs = xs.concat(opts.bounds[0]); ys = ys.concat(opts.bounds[1]); }
  const minx = Math.min(...xs), maxx = Math.max(...xs), miny = Math.min(...ys), maxy = Math.max(...ys);
  const s = Math.min((W - 2 * pad) / ((maxx - minx) || 1), (H0 - 2 * pad) / ((maxy - miny) || 1));
  const H = Math.round((maxy - miny) * s + 2 * pad);
  const offx = (W - (maxx - minx) * s) / 2;
  const X = (x) => offx + (x - minx) * s, Y = (y) => H - pad - (y - miny) * s;
  const cx = opts.center ? opts.center[0] : xs.reduce((a, b) => a + b, 0) / xs.length;
  const cy = opts.center ? opts.center[1] : ys.reduce((a, b) => a + b, 0) / ys.length;
  let b = '';
  if (opts.under) b += opts.under(X, Y, s);
  for (const sg of opts.segs || []) { const [a, c, st] = sg; b += line(X(P[a][0]), Y(P[a][1]), X(P[c][0]), Y(P[c][1]), { w: 1.6, dash: st === 'dash' ? '5 4' : undefined }); }
  for (const [a, o, c] of opts.right || []) {
    const u = unit(P[a], P[o]), v = unit(P[c], P[o]); const k = 11 / s;
    const p1 = [P[o][0] + u[0] * k, P[o][1] + u[1] * k], p2 = [P[o][0] + (u[0] + v[0]) * k, P[o][1] + (u[1] + v[1]) * k], p3 = [P[o][0] + v[0] * k, P[o][1] + v[1] * k];
    b += `<polyline points='${r2(X(p1[0]))},${r2(Y(p1[1]))} ${r2(X(p2[0]))},${r2(Y(p2[1]))} ${r2(X(p3[0]))},${r2(Y(p3[1]))}' fill='none' stroke='#000' stroke-width='1.2'/>`;
  }
  for (const [a, o, c, lab, dist] of opts.angleLabels || []) {
    const u = unit(P[a], P[o]), v = unit(P[c], P[o]);
    let bx = u[0] + v[0], by = u[1] + v[1]; const L = Math.hypot(bx, by) || 1; bx /= L; by /= L;
    const half = Math.acos(Math.max(-1, Math.min(1, u[0] * v[0] + u[1] * v[1]))) / 2;
    const d = Math.min(70, Math.max(dist || 24, 10 + 17 / Math.max(0.2, Math.sin(half)))) / s;
    b += txt(X(P[o][0] + bx * d), Y(P[o][1] + by * d), lab, { size: 12, halo: true });
    if (opts.arcs !== false) {
      const rr = 13; const a1 = Math.atan2(u[1], u[0]), a2 = Math.atan2(v[1], v[0]);
      let da = a2 - a1; while (da <= -Math.PI) da += 2 * Math.PI; while (da > Math.PI) da -= 2 * Math.PI;
      const sx = X(P[o][0]) + rr * Math.cos(a1), sy = Y(P[o][1]) - rr * Math.sin(a1);
      const ex = X(P[o][0]) + rr * Math.cos(a1 + da), ey = Y(P[o][1]) - rr * Math.sin(a1 + da);
      b += `<path d='M${r2(sx)} ${r2(sy)} A${rr} ${rr} 0 0 ${da > 0 ? 0 : 1} ${r2(ex)} ${r2(ey)}' fill='none' stroke='#000' stroke-width='1'/>`;
    }
  }
  for (const [a, c, lab, side] of opts.sideLabels || []) {
    const mx = (P[a][0] + P[c][0]) / 2, my = (P[a][1] + P[c][1]) / 2;
    let nx = -(P[c][1] - P[a][1]), ny = P[c][0] - P[a][0]; const L = Math.hypot(nx, ny); nx /= L; ny /= L;
    const lc = opts.labelCenter || [cx, cy];
    if ((mx - lc[0]) * nx + (my - lc[1]) * ny < 0) { nx = -nx; ny = -ny; }
    if (side === 'in') { nx = -nx; ny = -ny; }
    const d = 13 / s;
    b += txt(X(mx + nx * d), Y(my + ny * d), lab, { size: 13 });
  }
  for (const pt of opts.dots || []) b += dot(X(P[pt][0]), Y(P[pt][1]), 2.8);
  for (const [k, lab] of Object.entries(opts.labels || {})) {
    let dx = P[k][0] - cx, dy = P[k][1] - cy; const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
    const d = 13 / s;
    b += txt(X(P[k][0] + dx * d), Y(P[k][1] + dy * d), lab, { size: 13, italic: false });
  }
  if (opts.extra) b += opts.extra(X, Y, s);
  if (opts.note) b += '';
  return svgWrap(W, H, b, opts.maxw || 300);
}
function unit(p, o) { const dx = p[0] - o[0], dy = p[1] - o[1]; const L = Math.hypot(dx, dy); return [dx / L, dy / L]; }
const NOTE = "<p class='fignote'><em>Note: Figure not drawn to scale.</em></p>";

/* ---------------- misc ---------------- */
function pickN(r, arr, n) { return r.shuffle(arr).slice(0, n); }
const deg = '^\\circ';

module.exports = {
  T, hashStr, makeRng, Reject, need, assert, gcd, lcm, Fr, fr, F, num, decStr, commas, texInt, poly, lin, quad, binom, m, M, money,
  spr, sprDec, sprFits, texEval, close, eqHolds, sameExpr, stripM, distinct, table, ptable,
  svgWrap, txt, it, line, dot, plane, chart, barChart, dotPlot, figure, NOTE, pickN, deg, arrowHead,
};

/* ---------------- choice builders ---------------- */
function valOf(x) { return x instanceof Fr ? x.val() : x; }
// numeric choices (first = correct), sorted ascending like the SAT
function numCh(vals, fmt) {
  fmt = fmt || ((v) => m(num(v)));
  const nv = vals.map(valOf);
  need(new Set(nv.map((x) => x.toFixed(9))).size === 4, 'numeric choices not distinct');
  return { choices: vals.map(fmt), order: nv };
}
module.exports.valOf = valOf;
module.exports.numCh = numCh;
// parenthesise negatives: pn(-3) -> "(-3)"
function pn(x) { return valOf(x) < 0 ? '(' + num(x) + ')' : num(x); }
// coefficient times variable: cv(1,'x') -> 'x', cv(-1,'x') -> '-x'
function cv(c, v) { return poly([[c, v]]); }
module.exports.pn = pn; module.exports.cv = cv;

// friendly number for answer choices: terminating values as decimals, others as fractions, big integers with commas
function nice(x) {
  if (x instanceof Fr) { if (x.d === 1) return texInt(x.n); let d = x.d; while (d % 2 === 0) d /= 2; while (d % 5 === 0) d /= 5; if (d === 1 && String(+x.val().toFixed(6)).length <= 7) return decStr(x.val()); return x.tex(); }
  if (Number.isInteger(x)) return texInt(x);
  return decStr(+x.toFixed(4));
}
module.exports.nice = nice;
