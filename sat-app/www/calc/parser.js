/*
 * Graphing Calculator — core math engine (no DOM).
 * Tokenizer, parser (plain-text math -> AST), compiler (AST -> JS closures),
 * line analysis/classification for the graphing list, least-squares
 * regression, numeric points-of-interest search, number formatting and
 * AST -> LaTeX.  Runs in browsers and in Node: attaches globalThis.SatCalcCore.
 */
(function (G) {
  'use strict';

  // ---------------------------------------------------------------- errors
  class CalcError extends Error {
    constructor(msg) { super(msg); this.name = 'CalcError'; this.calc = true; }
  }
  function err(m) { return new CalcError(m); }

  // ---------------------------------------------------------------- values
  function Pt(x, y) { this.x = x; this.y = y; }
  const isPt = (v) => v instanceof Pt;

  const D2R = Math.PI / 180, R2D = 180 / Math.PI;

  // ---------------------------------------------------------------- tokenizer
  const FN_WORDS = ['arcsinh', 'arccosh', 'arctanh', 'arcsin', 'arccos', 'arctan', 'arccsc', 'arcsec', 'arccot',
    'nthroot', 'quartile', 'factorial', 'variance', 'median', 'stdevp', 'stddev', 'length', 'stdev', 'floor', 'round',
    'total', 'count', 'asin', 'acos', 'atan', 'sinh', 'cosh', 'tanh', 'csch', 'sech', 'coth', 'sqrt', 'cbrt', 'ceil',
    'sign', 'mean', 'sort', 'sgn', 'sin', 'cos', 'tan', 'csc', 'sec', 'cot', 'exp', 'abs', 'mod', 'gcd', 'lcm', 'nCr',
    'nPr', 'ncr', 'npr', 'min', 'max', 'var', 'sum', 'log', 'ln'];
  const ID_WORDS = ['theta', 'ans', 'pi'];
  const WORDS = FN_WORDS.concat(ID_WORDS).sort((a, b) => b.length - a.length);
  const FN_SET = new Set(FN_WORDS);
  const ALIAS = { asin: 'arcsin', acos: 'arccos', atan: 'arctan', sgn: 'sign', stddev: 'stdev', variance: 'var',
    sum: 'total', count: 'length', ncr: 'nCr', npr: 'nPr', theta: 'θ' };
  const TRIG_INV = { sin: 'arcsin', cos: 'arccos', tan: 'arctan', csc: 'arccsc', sec: 'arcsec', cot: 'arccot',
    sinh: 'arcsinh', cosh: 'arccosh', tanh: 'arctanh' };

  const isDigit = (c) => c >= '0' && c <= '9';
  const isLetter = (c) => !!c && /[A-Za-zα-ωΑ-Ω]/.test(c) && c !== 'π' && c !== 'θ';
  const isAlnum = (c) => isDigit(c) || (!!c && /[A-Za-z]/.test(c));

  const SYM = {
    '≤': '<=', '≥': '>=', '×': '*', '·': '*', '∙': '*', '⋅': '*', '÷': '/', '−': '-', '–': '-', '…': '...',
    '∼': '~', '′': "'", '’': "'"
  };

  function tokenize(src) {
    const toks = [];
    let i = 0;
    const n = src.length;
    while (i < n) {
      const c = src[i];
      if (c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === ' ') { i++; continue; }
      const start = i;
      if (isDigit(c) || (c === '.' && isDigit(src[i + 1]))) {
        let j = i;
        while (j < n && isDigit(src[j])) j++;
        if (src[j] === '.' && src[j + 1] !== '.') { j++; while (j < n && isDigit(src[j])) j++; }
        if (src[j] === 'E' && (isDigit(src[j + 1]) ||
          ((src[j + 1] === '-' || src[j + 1] === '+' || src[j + 1] === '−') && isDigit(src[j + 2])))) {
          j += 2;
          while (j < n && isDigit(src[j])) j++;
        }
        const s = src.slice(i, j).replace('−', '-');
        toks.push({ t: 'num', v: parseFloat(s), s: s, pos: start });
        i = j;
        continue;
      }
      if (c === 'd' && src.startsWith('d/dx', i) && !isLetter(src[i - 1]) && !isLetter(src[i + 4])) {
        toks.push({ t: 'fn', v: 'ddx', pos: i });
        i += 4;
        continue;
      }
      if (c === 'f' && i > 0 && src.startsWith('for', i) && !isLetter(src[i - 1]) && !src.startsWith('fort', i)) {
        toks.push({ t: 'kw', v: 'for', pos: i });
        i += 3;
        continue;
      }
      if (isLetter(c)) {
        let w = null;
        for (let k = 0; k < WORDS.length; k++) {
          if (src.startsWith(WORDS[k], i)) { w = WORDS[k]; break; }
        }
        if (w) {
          i += w.length;
          if (!FN_SET.has(w)) { toks.push({ t: 'id', v: ALIAS[w] || w, pos: start }); continue; }
          const tok = { t: 'fn', v: ALIAS[w] || w, pos: start };
          if (tok.v === 'log' && src[i] === '_') {
            i++;
            let b = '';
            if (src[i] === '{' || src[i] === '(') {
              const close = src[i] === '{' ? '}' : ')';
              const k = src.indexOf(close, i);
              if (k < 0) throw err('Missing ' + close + ' in log base');
              b = src.slice(i + 1, k); i = k + 1;
            } else {
              let j = i;
              while (j < n && (isDigit(src[j]) || src[j] === '.')) j++;
              if (j === i) while (j < n && isAlnum(src[j])) j++;
              b = src.slice(i, j); i = j;
            }
            if (!b.trim()) throw err('Missing log base');
            tok.base = b;
          }
          toks.push(tok);
          continue;
        }
        let name = c;
        i++;
        if (src[i] === '_') {
          let j = i + 1, sub = '';
          if (src[j] === '{') {
            const k = src.indexOf('}', j);
            if (k < 0) throw err('Missing } in subscript');
            sub = src.slice(j + 1, k).trim(); j = k + 1;
          } else {
            while (j < n && isDigit(src[j])) j++;
            if (j === i + 1) while (j < n && isAlnum(src[j])) j++;
            sub = src.slice(i + 1, j);
          }
          if (!sub || !/^[A-Za-z0-9]+$/.test(sub)) throw err('Invalid subscript');
          name += '_' + sub;
          i = j;
        }
        toks.push({ t: 'id', v: name, pos: start });
        continue;
      }
      if (c === 'π') { toks.push({ t: 'id', v: 'pi', pos: i }); i++; continue; }
      if (c === 'θ') { toks.push({ t: 'id', v: 'θ', pos: i }); i++; continue; }
      if (c === '√') { toks.push({ t: 'fn', v: 'sqrt', sym: true, pos: i }); i++; continue; }
      if (c === '∛') { toks.push({ t: 'fn', v: 'cbrt', sym: true, pos: i }); i++; continue; }
      if (c === '²' || c === '³') {
        toks.push({ t: 'op', v: '^', pos: i });
        toks.push({ t: 'num', v: c === '²' ? 2 : 3, s: c === '²' ? '2' : '3', pos: i });
        i++; continue;
      }
      const two = src.substr(i, 2);
      if (two === '<=' || two === '>=' || two === '==' || two === '**' || two === '=<' || two === '=>') {
        const v = two === '==' ? '=' : two === '**' ? '^' : two === '=<' ? '<=' : two === '=>' ? '>=' : two;
        toks.push({ t: 'op', v: v, pos: i }); i += 2; continue;
      }
      if (src.substr(i, 3) === '...') { toks.push({ t: 'op', v: '...', pos: i }); i += 3; continue; }
      const m = SYM[c] || c;
      if ('+-*/^()[]{},:!|<>=~%.\'°'.indexOf(m) >= 0 || m === '...' || m === '<=' || m === '>=') {
        toks.push({ t: 'op', v: m, pos: i }); i++; continue;
      }
      throw err("Unexpected character '" + c + "'");
    }
    return toks;
  }

  // ---------------------------------------------------------------- parser
  const CMP_OPS = new Set(['<', '<=', '>', '>=', '=', '~']);

  function parse(src) {
    const toks = tokenize(String(src == null ? '' : src));
    if (!toks.length) return null;
    let p = 0;
    let absDepth = 0;
    const peek = () => toks[p];
    const isOp = (t, v) => !!t && t.t === 'op' && t.v === v;
    const describe = (t) => t ? (t.t === 'num' ? t.s : t.v) : 'end';
    function expect(v) {
      const t = toks[p];
      if (!isOp(t, v)) {
        if (!t) throw err("Missing '" + v + "'");
        throw err("Expected '" + v + "' but found '" + describe(t) + "'");
      }
      p++;
    }
    function grouped(fn) { const s = absDepth; absDepth = 0; try { return fn(); } finally { absDepth = s; } }

    function top() {
      const items = seq();
      if (p < toks.length) {
        const t = toks[p];
        if (isOp(t, ')') || isOp(t, ']') || isOp(t, '}')) throw err("Unmatched '" + t.v + "'");
        throw err("Unexpected '" + describe(t) + "'");
      }
      return items.length === 1 ? items[0] : { type: 'list', items: items, bare: true };
    }
    function seq() {
      const items = [cmp()];
      while (isOp(peek(), ',')) { p++; items.push(cmp()); }
      return items;
    }
    function cmp() {
      const a = add();
      const t = peek();
      if (!(t && t.t === 'op' && CMP_OPS.has(t.v))) return a;
      const args = [a], ops = [];
      while (peek() && peek().t === 'op' && CMP_OPS.has(peek().v)) { ops.push(toks[p++].v); args.push(add()); }
      return { type: 'cmp', ops: ops, args: args };
    }
    function add() {
      let a = mul();
      for (;;) {
        const t = peek();
        if (isOp(t, '+') || isOp(t, '-')) { p++; a = { type: 'bin', op: t.v, a: a, b: mul() }; } else return a;
      }
    }
    function startsImplicit(t) {
      if (!t) return false;
      if (t.t === 'num' || t.t === 'id' || t.t === 'fn') return true;
      if (t.t !== 'op') return false;
      return t.v === '(' || t.v === '[' || t.v === '{' || (t.v === '|' && absDepth === 0);
    }
    function mul() {
      let a = unary();
      for (;;) {
        const t = peek();
        if (!t) return a;
        if (isOp(t, '*') || isOp(t, '/')) { p++; a = { type: 'bin', op: t.v, a: a, b: unary() }; continue; }
        if (startsImplicit(t)) { a = { type: 'bin', op: '*', a: a, b: pow(), implicit: true }; continue; }
        return a;
      }
    }
    function unary() {
      const t = peek();
      if (isOp(t, '-')) { p++; return { type: 'neg', a: unary() }; }
      if (isOp(t, '+')) { p++; return unary(); }
      return pow();
    }
    function pow() {
      const base = postfix();
      if (isOp(peek(), '^')) { p++; return { type: 'pow', a: base, b: powExp() }; }
      return base;
    }
    function powExp() {
      const t = peek();
      if (isOp(t, '-')) { p++; return { type: 'neg', a: powExp() }; }
      if (isOp(t, '+')) { p++; return powExp(); }
      if (isOp(t, '{')) {
        p++;
        const inner = grouped(() => add());
        expect('}');
        const e = { type: 'paren', a: inner, brace: true };
        if (isOp(peek(), '^')) { p++; return { type: 'pow', a: e, b: powExp() }; }
        return e;
      }
      return pow();
    }
    function postfix() {
      let a = primary();
      for (;;) {
        const t = peek();
        if (!t || t.t !== 'op') return a;
        if (t.v === '!') { p++; a = { type: 'call', name: 'factorial', args: [a], builtin: true, bang: true }; continue; }
        if (t.v === '%') { p++; a = { type: 'pct', a: a }; continue; }
        if (t.v === '°') { p++; a = { type: 'degsym', a: a }; continue; }
        if (t.v === '[' && (a.type === 'id' || a.type === 'list' || a.type === 'index' || a.type === 'range')) {
          p++;
          const items = grouped(() => seq());
          expect(']');
          a = { type: 'index', a: a, items: items };
          continue;
        }
        if (t.v === '.' && toks[p + 1] && toks[p + 1].t === 'id' && (toks[p + 1].v === 'x' || toks[p + 1].v === 'y')) {
          a = { type: 'member', a: a, m: toks[p + 1].v };
          p += 2;
          continue;
        }
        return a;
      }
    }
    function primary() {
      const t = toks[p++];
      if (!t) throw err('Incomplete expression');
      if (t.t === 'num') return { type: 'num', v: t.v, s: t.s };
      if (t.t === 'id') {
        let primes = 0;
        while (isOp(peek(), "'")) { p++; primes++; }
        if (isOp(peek(), '(')) {
          p++;
          const args = isOp(peek(), ')') ? [] : grouped(() => seq());
          expect(')');
          return { type: 'call', name: t.v, args: args, primes: primes };
        }
        if (primes) throw err("Expected '(' after " + t.v + "'");
        return { type: 'id', name: t.v };
      }
      if (t.t === 'fn') return fnCall(t);
      if (t.t === 'kw') throw err("'for' only works inside a list, e.g. [n^2 for n=[1...5]]");
      if (t.t === 'op') {
        if (t.v === '(') {
          if (isOp(peek(), ')')) throw err('Empty parentheses');
          const items = grouped(() => seq());
          expect(')');
          return items.length === 1 ? { type: 'paren', a: items[0] } : { type: 'tuple', items: items };
        }
        if (t.v === '[') return grouped(listLit);
        if (t.v === '{') return grouped(braces);
        if (t.v === '|') {
          absDepth++;
          let a;
          try { a = add(); } finally { absDepth--; }
          expect('|');
          return { type: 'call', name: 'abs', args: [a], builtin: true, bars: true };
        }
        if (t.v === "'" || t.v === '.') throw err("Unexpected '" + t.v + "'");
      }
      if (t.t === 'op' && (t.v === ')' || t.v === ']' || t.v === '}')) throw err("Unexpected '" + t.v + "'");
      if (t.t === 'op' && CMP_OPS.has(t.v)) throw err("Missing expression before '" + t.v + "'");
      throw err("Unexpected '" + describe(t) + "'");
    }
    function fnCall(t) {
      let name = t.v;
      const base = t.base != null ? parse(t.base) : null;
      if (t.base != null && !base) throw err('Missing log base');
      let powE = null;
      if (isOp(peek(), '^')) { p++; powE = powExp(); }
      if (powE && powE.type === 'paren' && powE.a.type === 'neg') powE = powE.a;
      if (powE && powE.type === 'neg' && powE.a.type === 'num' && powE.a.v === 1 && TRIG_INV[name]) {
        name = TRIG_INV[name]; powE = null;
      }
      let args;
      if (isOp(peek(), '(')) {
        p++;
        args = isOp(peek(), ')') ? [] : grouped(() => seq());
        expect(')');
      } else {
        if (!peek()) throw err(name + ' needs an argument');
        let a;
        if (t.sym || name === 'sqrt' || name === 'cbrt') a = postfix();
        else {
          a = pow();
          while (peek() && (peek().t === 'num' || peek().t === 'id')) {
            a = { type: 'bin', op: '*', a: a, b: pow(), implicit: true };
          }
        }
        args = [a];
      }
      let node = { type: 'call', name: name, args: args, builtin: true };
      if (base) node.base = base;
      if (t.sym) node.sym = true;
      if (powE) node = { type: 'pow', a: node, b: powE, fnpow: true };
      return node;
    }
    function listLit() {
      if (isOp(peek(), ']')) { p++; return { type: 'list', items: [] }; }
      const items = [];
      let rangeAt = -1;
      for (;;) {
        if (isOp(peek(), '...')) {
          p++;
          if (rangeAt >= 0) throw err("Only one '...' allowed");
          rangeAt = items.length;
          if (isOp(peek(), ',')) p++;
          continue;
        }
        items.push(cmp());
        if (items.length === 1 && rangeAt < 0 && peek() && peek().t === 'kw' && peek().v === 'for') {
          p++;
          const binds = [];
          for (;;) {
            const t = toks[p++];
            if (!t || t.t !== 'id') throw err("Expected a variable after 'for'");
            expect('=');
            binds.push({ name: t.v, list: add() });
            if (isOp(peek(), ',') && toks[p + 1] && toks[p + 1].t === 'id' && isOp(toks[p + 2], '=')) { p++; continue; }
            break;
          }
          expect(']');
          return { type: 'comp', body: items[0], binds: binds };
        }
        if (isOp(peek(), ',')) { p++; continue; }
        if (isOp(peek(), '...')) continue;
        break;
      }
      expect(']');
      if (rangeAt >= 0) {
        if (rangeAt === 0 || rangeAt >= items.length || rangeAt > 2 || items.length - rangeAt !== 1) {
          throw err('Range should look like [1...5] or [1,3,...,9]');
        }
        return { type: 'range', start: items.slice(0, rangeAt), end: items[rangeAt] };
      }
      return { type: 'list', items: items };
    }
    function braces() {
      if (isOp(peek(), '}')) throw err('Empty { }');
      const br = [];
      for (;;) {
        const c = cmp();
        if (isOp(peek(), ':')) { p++; br.push({ cond: c, val: cmp() }); } else br.push({ cond: c, val: null });
        if (isOp(peek(), ',')) { p++; continue; }
        break;
      }
      expect('}');
      const withVal = br.filter((b) => b.val);
      if (!withVal.length) {
        if (br.length === 1 && br[0].cond.type !== 'cmp') return { type: 'paren', a: br[0].cond, brace: true };
        return { type: 'restrict', conds: br.map((b) => b.cond) };
      }
      let elseVal = null;
      br.forEach((b, i) => {
        if (!b.val) {
          if (i === br.length - 1) elseVal = b.cond;
          else throw err('Piecewise: each part needs "condition: value"');
        }
      });
      return { type: 'piecewise', branches: withVal, else: elseVal };
    }
    return top();
  }

  // ---------------------------------------------------------------- numeric helpers
  function fracApprox(x, maxDen) {
    if (!isFinite(x)) return null;
    const sgn = x < 0 ? -1 : 1;
    let v = Math.abs(x);
    let h0 = 1, h1 = 0, k0 = 0, k1 = 1;
    let b = v;
    for (let i = 0; i < 40; i++) {
      const a = Math.floor(b);
      const h2 = a * h0 + h1, k2 = a * k0 + k1;
      if (k2 > maxDen) break;
      h1 = h0; h0 = h2; k1 = k0; k0 = k2;
      if (Math.abs(v - h0 / k0) <= 1e-12 * Math.max(1, v)) return [sgn * h0, k0];
      const f = b - a;
      if (f < 1e-15) break;
      b = 1 / f;
    }
    if (k0 && Math.abs(v - h0 / k0) <= 1e-12 * Math.max(1, v)) return [sgn * h0, k0];
    return null;
  }

  function powF(a, b) {
    if (a < 0 && !Number.isInteger(b) && isFinite(b)) {
      const f = fracApprox(b, 999);
      if (f && f[1] % 2 === 1) {
        const r = Math.pow(-a, b);
        return (Math.abs(f[0]) % 2 === 1) ? -r : r;
      }
      return NaN;
    }
    return Math.pow(a, b);
  }

  const FACT = [1];
  for (let i = 1; i <= 170; i++) FACT[i] = FACT[i - 1] * i;
  function gamma(z) {
    if (z < 0.5) return Math.PI / (Math.sin(Math.PI * z) * gamma(1 - z));
    z -= 1;
    const g = 7;
    const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
      -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
    let x = c[0];
    for (let i = 1; i < g + 2; i++) x += c[i] / (z + i);
    const t = z + g + 0.5;
    return Math.sqrt(2 * Math.PI) * Math.pow(t, z + 0.5) * Math.exp(-t) * x;
  }
  function factorial(n) {
    if (Number.isInteger(n)) {
      if (n < 0) return NaN;
      return n <= 170 ? FACT[n] : Infinity;
    }
    if (n < 0 && Number.isInteger(n)) return NaN;
    return gamma(n + 1);
  }
  function nCr(n, r) {
    if (Number.isInteger(n) && Number.isInteger(r)) {
      if (r < 0 || n < 0 || r > n) return 0;
      r = Math.min(r, n - r);
      let v = 1;
      for (let i = 1; i <= r; i++) v = v * (n - r + i) / i;
      return Math.round(v);
    }
    return factorial(n) / (factorial(r) * factorial(n - r));
  }
  function nPr(n, r) {
    if (Number.isInteger(n) && Number.isInteger(r)) {
      if (r < 0 || n < 0 || r > n) return 0;
      let v = 1;
      for (let i = 0; i < r; i++) v *= (n - i);
      return v;
    }
    return factorial(n) / factorial(n - r);
  }
  function gcd2(a, b) {
    a = Math.abs(Math.round(a)); b = Math.abs(Math.round(b));
    if (!isFinite(a) || !isFinite(b)) return NaN;
    while (b) { const t = a % b; a = b; b = t; }
    return a;
  }
  function lcm2(a, b) {
    a = Math.round(a); b = Math.round(b);
    if (!a || !b) return 0;
    return Math.abs(a * b) / gcd2(a, b);
  }
  function modF(a, b) { if (b === 0) return NaN; const r = a - b * Math.floor(a / b); return Math.abs(r) < 1e-12 * Math.abs(b) ? 0 : r; }
  function roundF(x, d) {
    if (d === undefined) return x < 0 ? -Math.round(-x) : Math.round(x);
    d = Math.round(d);
    const m = Math.pow(10, d);
    return (x < 0 ? -Math.round(-x * m) : Math.round(x * m)) / m;
  }
  function nthroot(x, n) {
    if (n === 0) return NaN;
    if (x < 0) { if (Number.isInteger(n) && Math.abs(n) % 2 === 1) return -Math.pow(-x, 1 / n); return NaN; }
    return Math.pow(x, 1 / n);
  }
  // exact-ish trig in degrees
  function sinD(x) {
    const r = ((x % 360) + 360) % 360;
    if (r === 0 || r === 180) return 0;
    if (r === 90) return 1;
    if (r === 270) return -1;
    if (r === 30 || r === 150) return 0.5;
    if (r === 210 || r === 330) return -0.5;
    return Math.sin(x * D2R);
  }
  function cosD(x) { return sinD(x + 90); }
  function tanD(x) {
    const r = ((x % 180) + 180) % 180;
    if (r === 0) return 0;
    if (r === 90) return NaN;
    if (r === 45) return 1;
    if (r === 135) return -1;
    return Math.tan(x * D2R);
  }

  function unaryTable(deg) {
    const sin = deg ? sinD : Math.sin, cos = deg ? cosD : Math.cos, tan = deg ? tanD : Math.tan;
    const inv = deg ? (f) => (x) => f(x) * R2D : (f) => f;
    return {
      sin: sin, cos: cos, tan: tan,
      csc: (x) => 1 / sin(x), sec: (x) => 1 / cos(x), cot: (x) => { const t = tan(x); return t === 0 ? NaN : 1 / t; },
      arcsin: inv(Math.asin), arccos: inv(Math.acos), arctan: inv(Math.atan),
      arccsc: inv((x) => Math.asin(1 / x)), arcsec: inv((x) => Math.acos(1 / x)),
      arccot: inv((x) => Math.PI / 2 - Math.atan(x)),
      sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
      csch: (x) => 1 / Math.sinh(x), sech: (x) => 1 / Math.cosh(x), coth: (x) => 1 / Math.tanh(x),
      arcsinh: Math.asinh, arccosh: Math.acosh, arctanh: Math.atanh,
      ln: Math.log, log: Math.log10, exp: Math.exp, sqrt: Math.sqrt, cbrt: Math.cbrt, abs: Math.abs,
      floor: Math.floor, ceil: Math.ceil, sign: Math.sign, factorial: factorial, round: (x) => roundF(x)
    };
  }
  const UNARY_RAD = unaryTable(false), UNARY_DEG = unaryTable(true);
  const BINARY = { mod: modF, gcd: gcd2, lcm: lcm2, nCr: nCr, nPr: nPr, nthroot: nthroot };

  // statistics
  function nums(list) { return list.filter((v) => typeof v === 'number' && !isNaN(v)); }
  function sorted(l) { return nums(l).sort((a, b) => a - b); }
  function medianOf(s) { const n = s.length; if (!n) return NaN; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; }
  function meanOf(l) { const a = nums(l); if (!a.length) return NaN; let t = 0; for (const v of a) t += v; return t / a.length; }
  function varOf(l, pop) {
    const a = nums(l); const n = a.length;
    if (n < (pop ? 1 : 2)) return NaN;
    const m = meanOf(a); let t = 0;
    for (const v of a) t += (v - m) * (v - m);
    return t / (pop ? n : n - 1);
  }
  function quartileOf(l, q) {
    const s = sorted(l); const n = s.length;
    if (!n) return NaN;
    q = Math.round(q);
    if (q === 0) return s[0];
    if (q === 4) return s[n - 1];
    if (q === 2) return medianOf(s);
    if (q !== 1 && q !== 3) return NaN;
    if (n === 1) return s[0];
    const half = Math.floor(n / 2);
    return q === 1 ? medianOf(s.slice(0, half)) : medianOf(s.slice(n - half));
  }
  const LISTFN = {
    mean: meanOf,
    median: (l) => medianOf(sorted(l)),
    min: (l) => { const a = nums(l); return a.length ? Math.min.apply(null, a) : NaN; },
    max: (l) => { const a = nums(l); return a.length ? Math.max.apply(null, a) : NaN; },
    total: (l) => { let t = 0; for (const v of nums(l)) t += v; return t; },
    length: (l) => l.length,
    stdev: (l) => Math.sqrt(varOf(l, false)),
    stdevp: (l) => Math.sqrt(varOf(l, true)),
    var: (l) => varOf(l, false),
    sort: (l) => sorted(l)
  };

  // ---------------------------------------------------------------- broadcasting ops
  function badType(op) { return err("Can't use " + op + ' with these values'); }
  function bc(f, a, b, op) {
    const ta = typeof a, tb = typeof b;
    if (ta === 'number' && tb === 'number') return f(a, b);
    if (Array.isArray(a)) {
      if (Array.isArray(b)) {
        const n = Math.min(a.length, b.length), out = new Array(n);
        for (let i = 0; i < n; i++) out[i] = bc(f, a[i], b[i], op);
        return out;
      }
      return a.map((v) => bc(f, v, b, op));
    }
    if (Array.isArray(b)) return b.map((v) => bc(f, a, v, op));
    if (ta === 'boolean' || tb === 'boolean') return NaN;
    if (isPt(a) || isPt(b)) {
      if (isPt(a) && isPt(b)) {
        if (op === '+' || op === '-') return new Pt(f(a.x, b.x), f(a.y, b.y));
        throw badType(op === '*' ? 'multiplication' : op);
      }
      if (op === '*' || (op === '/' && isPt(a))) {
        if (isPt(a)) return new Pt(f(a.x, b), f(a.y, b));
        return new Pt(f(a, b.x), f(a, b.y));
      }
      throw err("Can't use " + op + ' with a point');
    }
    return NaN;
  }
  function map1(f, a, name) {
    if (typeof a === 'number') return f(a);
    if (Array.isArray(a)) return a.map((v) => map1(f, v, name));
    if (isPt(a)) throw err("Can't take " + name + ' of a point');
    return NaN;
  }
  const fAdd = (a, b) => a + b, fSub = (a, b) => a - b, fMul = (a, b) => a * b, fDiv = (a, b) => a / b;
  function eqTol(a, b) { return a === b || Math.abs(a - b) <= 1e-12 * Math.max(1, Math.abs(a), Math.abs(b)); }
  function cmpOp(op, a, b) {
    if (typeof a !== 'number' || typeof b !== 'number') {
      if (Array.isArray(a) || Array.isArray(b)) {
        const n = Math.min(Array.isArray(a) ? a.length : Infinity, Array.isArray(b) ? b.length : Infinity);
        const out = new Array(n);
        for (let i = 0; i < n; i++) out[i] = cmpOp(op, Array.isArray(a) ? a[i] : a, Array.isArray(b) ? b[i] : b);
        return out;
      }
      return false;
    }
    switch (op) {
      case '<': return a < b;
      case '<=': return a <= b || eqTol(a, b);
      case '>': return a > b;
      case '>=': return a >= b || eqTol(a, b);
      case '=': return eqTol(a, b);
    }
    return false;
  }

  // ---------------------------------------------------------------- compiler
  const ALL_LOCALS = new Set(['x', 'y', 't', 'θ']);
  const NO_LOCALS = new Set();
  let dKeyCounter = 0;

  function makeCtx(o) {
    o = o || {};
    return {
      locals: o.locals || NO_LOCALS,
      localsFirst: !!o.localsFirst,
      getVar: o.getVar || (() => undefined),
      fns: o.fns || new Map(),
      deg: !!o.deg,
      missing: new Set(),
      used: new Set(),
      subst: null,
      depth: 0
    };
  }

  function konst(v) { const f = () => v; f.c = true; return f; }
  function fold(fn, kids) {
    for (let i = 0; i < kids.length; i++) if (!kids[i].c) return fn;
    try { const v = fn({}); return konst(v); } catch (e) { return fn; }
  }

  function compile(node, cx) {
    switch (node.type) {
      case 'num': return konst(node.v);
      case 'id': return compileId(node.name, cx);
      case 'paren': return compile(node.a, cx);
      case 'neg': {
        const A = compile(node.a, cx);
        return fold((s) => { const a = A(s); return typeof a === 'number' ? -a : bc(fMul, -1, a, '*'); }, [A]);
      }
      case 'bin': {
        const A = compile(node.a, cx), B = compile(node.b, cx);
        let fn;
        switch (node.op) {
          case '+': fn = (s) => { const a = A(s), b = B(s); return (typeof a === 'number' && typeof b === 'number') ? a + b : bc(fAdd, a, b, '+'); }; break;
          case '-': fn = (s) => { const a = A(s), b = B(s); return (typeof a === 'number' && typeof b === 'number') ? a - b : bc(fSub, a, b, '-'); }; break;
          case '*': fn = (s) => { const a = A(s), b = B(s); return (typeof a === 'number' && typeof b === 'number') ? a * b : bc(fMul, a, b, '*'); }; break;
          case '/': fn = (s) => { const a = A(s), b = B(s); return (typeof a === 'number' && typeof b === 'number') ? a / b : bc(fDiv, a, b, '/'); }; break;
          default: throw err('Unknown operator ' + node.op);
        }
        return fold(fn, [A, B]);
      }
      case 'pow': {
        const A = compile(node.a, cx), B = compile(node.b, cx);
        if (B.c && B() === 2) return fold((s) => { const a = A(s); return typeof a === 'number' ? a * a : bc(powF, a, 2, '^'); }, [A]);
        return fold((s) => { const a = A(s), b = B(s); return (typeof a === 'number' && typeof b === 'number') ? powF(a, b) : bc(powF, a, b, '^'); }, [A, B]);
      }
      case 'call': return compileCall(node, cx);
      case 'list': {
        const I = node.items.map((it) => compile(it, cx));
        const n = I.length;
        return fold((s) => {
          const out = [];
          for (let i = 0; i < n; i++) {
            const v = I[i](s);
            if (Array.isArray(v)) { for (const w of v) out.push(w); } else if (typeof v === 'boolean') throw err('Lists cannot contain conditions');
            else out.push(v);
          }
          return out;
        }, I);
      }
      case 'range': {
        const S = node.start.map((it) => compile(it, cx)), E = compile(node.end, cx);
        return fold((s) => {
          const a = S[0](s), e = E(s);
          if (typeof a !== 'number' || typeof e !== 'number') throw err('Range bounds must be numbers');
          let step = S.length > 1 ? S[1](s) - a : (e >= a ? 1 : -1);
          if (!isFinite(a) || !isFinite(e) || !isFinite(step) || step === 0) throw err('Invalid range');
          if ((e - a) / step < 0) return [a];
          const n = Math.floor((e - a) / step + 1e-9) + 1;
          if (n > 10000) throw err('Range too long (max 10000 items)');
          const out = new Array(n);
          for (let i = 0; i < n; i++) out[i] = roundSmall(a + i * step);
          return out;
        }, S.concat([E]));
      }
      case 'tuple': {
        if (node.items.length !== 2) throw err('Only 2D points (x, y) are supported');
        const X = compile(node.items[0], cx), Y = compile(node.items[1], cx);
        return fold((s) => mkPoint(X(s), Y(s)), [X, Y]);
      }
      case 'cmp': {
        if (node.ops.indexOf('~') >= 0) throw err("'~' is only for regressions");
        const A = node.args.map((a) => compile(a, cx)), ops = node.ops;
        return fold((s) => {
          let prev = A[0](s), acc = true;
          for (let i = 0; i < ops.length; i++) {
            const cur = A[i + 1](s);
            const r = cmpOp(ops[i], prev, cur);
            if (Array.isArray(r)) acc = Array.isArray(acc) ? acc.map((v, k) => v && r[k] === true).slice(0, Math.min(acc.length, r.length)) : (acc ? r.map((v) => v === true) : r.map(() => false));
            else if (Array.isArray(acc)) { if (!r) acc = acc.map(() => false); }
            else if (!r) return false;
            prev = cur;
          }
          return acc;
        }, A);
      }
      case 'restrict': {
        const Cs = node.conds.map((c) => compileCond(c, cx));
        return fold((s) => {
          let list = null;
          for (let i = 0; i < Cs.length; i++) {
            const c = Cs[i](s);
            if (Array.isArray(c)) list = list ? list.map((v, k) => v && c[k] === true) : c.map((v) => v === true);
            else if (c !== true) return NaN;
          }
          return list ? list.map((v) => (v ? 1 : NaN)) : 1;
        }, Cs);
      }
      case 'piecewise': {
        const Cs = node.branches.map((b) => compileCond(b.cond, cx));
        const Vs = node.branches.map((b) => compile(b.val, cx));
        const E = node.else ? compile(node.else, cx) : null;
        const n = Cs.length;
        const pick = (v, k) => (Array.isArray(v) ? (v[k] === undefined ? NaN : v[k]) : v);
        return fold((s) => {
          for (let i = 0; i < n; i++) {
            const c = Cs[i](s);
            if (c === true) return Vs[i](s);
            if (Array.isArray(c)) {
              // element-wise piecewise over lists
              const conds = Cs.map((f) => f(s)), vals = Vs.map((f) => f(s)), ev = E ? E(s) : NaN;
              const len = Math.max.apply(null, conds.concat(vals, [ev]).map((v) => (Array.isArray(v) ? v.length : 0)));
              const out = new Array(len);
              for (let k = 0; k < len; k++) {
                out[k] = pick(ev, k);
                for (let j = 0; j < n; j++) if (pick(conds[j], k) === true) { out[k] = pick(vals[j], k); break; }
              }
              return out;
            }
          }
          return E ? E(s) : NaN;
        }, Cs.concat(Vs, E ? [E] : []));
      }
      case 'index': {
        const A = compile(node.a, cx), I = node.items.map((it) => compile(it, cx));
        return fold((s) => {
          const a = A(s);
          if (!Array.isArray(a)) throw err('Only lists can be indexed with [ ]');
          const pick = (i) => {
            if (typeof i !== 'number') return NaN;
            const v = a[Math.round(i) - 1];
            return v === undefined ? NaN : v;
          };
          if (I.length === 1) {
            const i = I[0](s);
            if (Array.isArray(i) && i.length && typeof i[0] === 'boolean') return a.filter((v, k) => i[k] === true);
            return Array.isArray(i) ? i.map(pick) : pick(i);
          }
          return I.map((f) => pick(f(s)));
        }, [A].concat(I));
      }
      case 'member': {
        const A = compile(node.a, cx), m = node.m;
        const get = (v) => isPt(v) ? v[m] : Array.isArray(v) ? v.map(get) : (() => { throw err('.' + m + ' needs a point'); })();
        return fold((s) => get(A(s)), [A]);
      }
      case 'comp': {
        const keys = node.binds.map(() => '\u0001c' + (++dKeyCounter));
        const Ls = node.binds.map((b) => compile(b.list, cx));
        const sub = new Map(cx.subst || []);
        node.binds.forEach((b, i) => sub.set(b.name, (s) => s[keys[i]]));
        const B = compile(node.body, Object.assign({}, cx, { subst: sub }));
        return (s) => {
          const lists = Ls.map((f) => { const v = f(s); return Array.isArray(v) ? v : [v]; });
          const out = [];
          const old = keys.map((k) => s[k]);
          const rec = (d) => {
            if (d === lists.length) {
              const v = B(s);
              if (Array.isArray(v)) { for (const w of v) out.push(w); } else out.push(v);
              if (out.length > 10000) throw err('List too long (max 10000 items)');
              return;
            }
            for (const v of lists[d]) { s[keys[d]] = v; rec(d + 1); }
          };
          rec(0);
          keys.forEach((k, i) => { s[k] = old[i]; });
          return out;
        };
      }
      case 'pct': {
        const A = compile(node.a, cx);
        return fold((s) => map1((v) => v / 100, A(s), '%'), [A]);
      }
      case 'degsym': {
        const A = compile(node.a, cx);
        if (cx.deg) return A;
        return fold((s) => map1((v) => v * D2R, A(s), '°'), [A]);
      }
    }
    throw err('Unsupported expression');
  }
  function roundSmall(v) { const r = Math.round(v); return Math.abs(v - r) < 1e-9 ? r : v; }

  function mkPoint(x, y) {
    if (typeof x === 'number' && typeof y === 'number') return new Pt(x, y);
    if (Array.isArray(x) || Array.isArray(y)) {
      const n = Math.min(Array.isArray(x) ? x.length : Infinity, Array.isArray(y) ? y.length : Infinity);
      const out = new Array(n);
      for (let i = 0; i < n; i++) out[i] = mkPoint(Array.isArray(x) ? x[i] : x, Array.isArray(y) ? y[i] : y);
      return out;
    }
    if (isPt(x) || isPt(y)) throw err("Points can't contain points");
    return new Pt(NaN, NaN);
  }

  function compileCond(node, cx) {
    if (node.type !== 'cmp') throw err('Conditions need a comparison like x > 0');
    return compile(node, cx);
  }

  function compileId(name, cx) {
    if (cx.subst && cx.subst.has(name)) return cx.subst.get(name);
    if (name === 'pi') return konst(Math.PI);
    if (name === 'e') return konst(Math.E);
    if (cx.localsFirst && cx.locals.has(name)) { cx.used.add(name); return localGetter(name); }
    const gv = cx.getVar(name);
    if (gv !== undefined) return konst(gv);
    if (cx.locals.has(name)) { cx.used.add(name); return localGetter(name); }
    if (cx.fns.has(name)) throw err(name + ' is a function — use ' + name + '(x)');
    cx.missing.add(name);
    return () => NaN;
  }

  function localGetter(name) {
    if (name === 'x') return (s) => s.x;
    if (name === 'y') return (s) => s.y;
    if (name === 't') return (s) => s.t;
    return (s) => s[name];
  }

  // ---------------------------------------------------------------- code generation fast path
  // Scalar-only expressions are turned into JS source and compiled with new Function
  // (much faster than walking closures in plotting loops). Returns null when the
  // expression uses anything unsupported (lists, points, derivatives...), in which
  // case callers keep the closure version.
  const GEN_HELPERS = {
    pw: powF,
    sq: (a) => a * a,
    eq: eqTol,
    le: (a, b) => a <= b || eqTol(a, b),
    ge: (a, b) => a >= b || eqTol(a, b),
    lg: (x, b) => Math.log(x) / Math.log(b),
    rnd: roundF,
    b: BINARY
  };
  const GEN_LOCAL = { x: 'x', y: 'y', t: 't', 'θ': 'th' };
  function codegen(node, cx) {
    const sub = new Map();
    let depth = 0;
    const lit = (v) => (typeof v === 'number' ? (isNaN(v) ? 'NaN' : v === Infinity ? 'Infinity' : v === -Infinity ? '(-Infinity)' : '(' + String(v) + ')') : null);
    function g(n, subst) {
      switch (n.type) {
        case 'num': return lit(n.v);
        case 'paren': return g(n.a, subst);
        case 'id': {
          if (subst && subst.has(n.name)) return subst.get(n.name);
          if (n.name === 'pi') return lit(Math.PI);
          if (n.name === 'e') return lit(Math.E);
          if (cx.localsFirst && cx.locals.has(n.name)) return GEN_LOCAL[n.name] || null;
          let gv;
          try { gv = cx.getVar(n.name); } catch (e) { return null; }
          if (gv !== undefined) return lit(gv);
          if (cx.locals.has(n.name)) return GEN_LOCAL[n.name] || null;
          return null;
        }
        case 'neg': { const a = g(n.a, subst); return a && '(-' + a + ')'; }
        case 'bin': {
          const a = g(n.a, subst), b = g(n.b, subst);
          return a && b && '(' + a + n.op + b + ')';
        }
        case 'pow': {
          const a = g(n.a, subst), b = g(n.b, subst);
          if (!a || !b) return null;
          if (n.b.type === 'num' && n.b.v === 2) return 'H.sq(' + a + ')';
          if (n.b.type === 'num' && Number.isInteger(n.b.v)) return 'Math.pow(' + a + ',' + b + ')';
          return 'H.pw(' + a + ',' + b + ')';
        }
        case 'pct': { const a = g(n.a, subst); return a && '(' + a + '/100)'; }
        case 'degsym': { const a = g(n.a, subst); return a && (cx.deg ? a : '(' + a + '*' + lit(D2R) + ')'); }
        case 'cmp': {
          if (n.ops.indexOf('~') >= 0) return null;
          const args = n.args.map((x) => g(x, subst));
          if (args.some((x) => !x)) return null;
          const parts = n.ops.map((o, i) => {
            const a = args[i], b = args[i + 1];
            return o === '<' ? '(' + a + '<' + b + ')' : o === '>' ? '(' + a + '>' + b + ')' : o === '<=' ? 'H.le(' + a + ',' + b + ')' : o === '>=' ? 'H.ge(' + a + ',' + b + ')' : 'H.eq(' + a + ',' + b + ')';
          });
          return '(' + parts.join('&&') + ')';
        }
        case 'restrict': {
          const cs = n.conds.map((c) => (c.type === 'cmp' ? g(c, subst) : null));
          if (cs.some((x) => !x)) return null;
          return '((' + cs.join('&&') + ')?1:NaN)';
        }
        case 'piecewise': {
          let out = n.else ? g(n.else, subst) : 'NaN';
          if (!out) return null;
          for (let i = n.branches.length - 1; i >= 0; i--) {
            const br = n.branches[i];
            if (br.cond.type !== 'cmp') return null;
            const c = g(br.cond, subst), v = g(br.val, subst);
            if (!c || !v) return null;
            out = '(' + c + '?' + v + ':' + out + ')';
          }
          return out;
        }
        case 'minof': {
          const parts = n.items.map((x) => g(x, subst));
          if (parts.some((x) => !x)) return null;
          return parts.length === 1 ? parts[0] : 'Math.min(' + parts.join(',') + ')';
        }
        case 'call': {
          const args = n.args.map((x) => g(x, subst));
          if (args.some((x) => !x)) return null;
          if (!n.builtin) {
            const fd = cx.fns.get(n.name);
            if (!fd) {
              if (args.length !== 1) return null;
              const a = g({ type: 'id', name: n.name }, subst);
              return a && '(' + a + '*' + args[0] + ')';
            }
            if (n.primes || fd.params.length !== args.length || depth > 24) return null;
            const s2 = new Map();
            fd.params.forEach((p, i) => s2.set(p, args[i]));
            depth++;
            const r = g(fd.body, s2);
            depth--;
            return r;
          }
          const name = n.name;
          if (n.base) { const b = g(n.base, subst); return b && args.length === 1 ? 'H.lg(' + args[0] + ',' + b + ')' : null; }
          if (name === 'round' && args.length === 2) return 'H.rnd(' + args[0] + ',' + args[1] + ')';
          if (name === 'arctan' && args.length === 2) return '(Math.atan2(' + args[0] + ',' + args[1] + ')*' + (cx.deg ? lit(R2D) : '1') + ')';
          if (name === 'log' && args.length === 2) return 'H.lg(' + args[0] + ',' + args[1] + ')';
          if (BINARY[name] && args.length === 2) return 'H.b.' + name + '(' + args[0] + ',' + args[1] + ')';
          const U = cx.deg ? UNARY_DEG : UNARY_RAD;
          if (U[name] && !LISTFN[name] && args.length === 1) return 'H.u.' + name + '(' + args[0] + ')';
          return null;
        }
      }
      return null;
    }
    let src;
    try { src = g(node, null); } catch (e) { return null; }
    if (!src) return null;
    try {
      const H = Object.assign({}, GEN_HELPERS, { u: cx.deg ? UNARY_DEG : UNARY_RAD });
      // eslint-disable-next-line no-new-func
      const f = new Function('H', '"use strict";return function(x,y,t,th){return ' + src + ';};')(H);
      const probe = f(0.5123, 0.4871, 0.5123, 0.5123);
      if (typeof probe !== 'number') return null;
      return f;
    } catch (e) { return null; }
  }

  function compileCall(node, cx) {
    const name = node.name;
    if (node.builtin) return compileBuiltin(node, cx);
    const fd = cx.fns.get(name);
    if (fd) {
      if (cx.depth > 24) throw err('Functions are nested too deeply (recursive definition?)');
      if (node.args.length !== fd.params.length) {
        throw err(name + ' takes ' + fd.params.length + ' argument' + (fd.params.length === 1 ? '' : 's'));
      }
      const argC = node.args.map((a) => compile(a, cx));
      if (node.primes) {
        if (fd.params.length !== 1) throw err('Derivatives need a one-variable function');
        if (node.primes > 2) throw err('Only first and second derivatives are supported');
        const key = '\u0001d' + (++dKeyCounter);
        const sub = new Map([[fd.params[0], (s) => s[key]]]);
        const B = compile(fd.body, Object.assign({}, cx, { subst: sub, depth: cx.depth + 1 }));
        const A = argC[0];
        const order = node.primes;
        const d1 = (s, a) => {
          if (typeof a !== 'number') return NaN;
          const old = s[key];
          let r;
          if (order === 1) {
            const h = 1e-5 * Math.max(1, Math.abs(a));
            s[key] = a + h; const f1 = B(s); s[key] = a - h; const f0 = B(s);
            r = (typeof f1 === 'number' && typeof f0 === 'number') ? (f1 - f0) / (2 * h) : NaN;
          } else {
            const h = 1e-3 * Math.max(1, Math.abs(a));
            s[key] = a + h; const f1 = B(s); s[key] = a; const fm = B(s); s[key] = a - h; const f0 = B(s);
            r = (f1 - 2 * fm + f0) / (h * h);
          }
          s[key] = old;
          return r;
        };
        return (s) => { const a = A(s); return Array.isArray(a) ? a.map((v) => d1(s, v)) : d1(s, a); };
      }
      const sub = new Map();
      fd.params.forEach((p, i) => sub.set(p, argC[i]));
      return compile(fd.body, Object.assign({}, cx, { subst: sub, depth: cx.depth + 1 }));
    }
    if (node.primes) throw err(name + ' is not a function');
    if (node.args.length === 1) {
      return compile({ type: 'bin', op: '*', a: { type: 'id', name: name }, b: { type: 'paren', a: node.args[0] }, implicit: true }, cx);
    }
    if (node.args.length === 2) {
      return compile({ type: 'bin', op: '*', a: { type: 'id', name: name }, b: { type: 'tuple', items: node.args }, implicit: true }, cx);
    }
    if (!cx.getVar(name) && !(cx.locals.has(name))) cx.missing.add(name);
    throw err(name + ' is not a function');
  }

  function arity(name, args, n) {
    if (args.length !== n) throw err(name + ' takes ' + n + ' argument' + (n === 1 ? '' : 's'));
  }

  function compileBuiltin(node, cx) {
    const name = node.name;
    const args = node.args.map((a) => compile(a, cx));
    const U = cx.deg ? UNARY_DEG : UNARY_RAD;
    if (node.base) {
      arity('log', args, 1);
      const Bs = compile(node.base, cx), A = args[0];
      return fold((s) => bc((x, b) => Math.log(x) / Math.log(b), A(s), Bs(s), 'log'), [A, Bs]);
    }
    if (name === 'round' && args.length === 2) {
      const A = args[0], D = args[1];
      return fold((s) => bc(roundF, A(s), D(s), 'round'), args);
    }
    if (name === 'arctan' && args.length === 2) {
      const Y = args[0], X = args[1], k = cx.deg ? R2D : 1;
      return fold((s) => bc((y, x) => Math.atan2(y, x) * k, Y(s), X(s), 'arctan'), args);
    }
    if (name === 'log' && args.length === 2) {
      const A = args[0], Bs = args[1];
      return fold((s) => bc((x, b) => Math.log(x) / Math.log(b), A(s), Bs(s), 'log'), args);
    }
    if ((name === 'gcd' || name === 'lcm') && args.length !== 2) {
      const f = BINARY[name];
      return fold((s) => {
        let l = [];
        args.forEach((A) => { const v = A(s); if (Array.isArray(v)) l = l.concat(v); else l.push(v); });
        l = nums(l);
        if (!l.length) return NaN;
        return l.reduce((a, b) => f(a, b));
      }, args);
    }
    if (name === 'ddx') {
      arity('d/dx', args, 1);
      const key = '\u0001d' + (++dKeyCounter);
      const sub = new Map(cx.subst || []);
      sub.set('x', (s) => s[key]);
      const B = compile(node.args[0], Object.assign({}, cx, { subst: sub }));
      const X = compileId('x', cx);
      const d1 = (s, a) => {
        if (typeof a !== 'number') return NaN;
        const old = s[key], h = 1e-5 * Math.max(1, Math.abs(a));
        s[key] = a + h; const f1 = B(s); s[key] = a - h; const f0 = B(s); s[key] = old;
        return (typeof f1 === 'number' && typeof f0 === 'number') ? (f1 - f0) / (2 * h) : NaN;
      };
      return (s) => { const a = X(s); return Array.isArray(a) ? a.map((v) => d1(s, v)) : d1(s, a); };
    }
    if (U[name] && !(LISTFN[name])) {
      arity(name, args, 1);
      const f = U[name], A = args[0];
      return fold((s) => { const a = A(s); return typeof a === 'number' ? f(a) : map1(f, a, name); }, args);
    }
    if (BINARY[name]) {
      arity(name, args, 2);
      const f = BINARY[name], A = args[0], B = args[1];
      return fold((s) => { const a = A(s), b = B(s); return (typeof a === 'number' && typeof b === 'number') ? f(a, b) : bc(f, a, b, name); }, args);
    }
    if (name === 'quartile') {
      arity(name, args, 2);
      const A = args[0], Q = args[1];
      return fold((s) => {
        const l = A(s), q = Q(s);
        if (!Array.isArray(l)) throw err('quartile needs a list');
        return Array.isArray(q) ? q.map((v) => quartileOf(l, v)) : quartileOf(l, q);
      }, args);
    }
    if (LISTFN[name]) {
      if (!args.length) throw err(name + ' needs a list');
      const f = LISTFN[name];
      return fold((s) => {
        let l;
        if (args.length === 1) {
          const v = args[0](s);
          if (Array.isArray(v)) l = v;
          else if (typeof v === 'number') l = [v];
          else throw err(name + ' needs a list of numbers');
        } else {
          l = [];
          args.forEach((A) => { const v = A(s); if (Array.isArray(v)) l = l.concat(v); else l.push(v); });
        }
        if (l.some(isPt)) throw err(name + ' needs a list of numbers');
        return f(l);
      }, args);
    }
    throw err('Unknown function ' + name);
  }

  // ---------------------------------------------------------------- AST utilities
  function walk(node, fn) {
    if (!node || typeof node !== 'object') return;
    fn(node);
    switch (node.type) {
      case 'paren': case 'neg': case 'pct': case 'degsym': case 'member': walk(node.a, fn); break;
      case 'bin': case 'pow': walk(node.a, fn); walk(node.b, fn); break;
      case 'call': node.args.forEach((a) => walk(a, fn)); if (node.base) walk(node.base, fn); break;
      case 'list': case 'tuple': node.items.forEach((a) => walk(a, fn)); break;
      case 'range': node.start.forEach((a) => walk(a, fn)); walk(node.end, fn); break;
      case 'cmp': node.args.forEach((a) => walk(a, fn)); break;
      case 'restrict': node.conds.forEach((a) => walk(a, fn)); break;
      case 'piecewise': node.branches.forEach((b) => { walk(b.cond, fn); walk(b.val, fn); }); walk(node.else, fn); break;
      case 'index': walk(node.a, fn); node.items.forEach((a) => walk(a, fn)); break;
      case 'comp': walk(node.body, fn); node.binds.forEach((b) => walk(b.list, fn)); break;
    }
  }
  function collectNames(ast, fns) {
    const out = new Set();
    walk(ast, (n) => {
      if (n.type === 'id') out.add(n.name);
      else if (n.type === 'call' && !n.builtin && !(fns && fns.has(n.name))) out.add(n.name);
    });
    return out;
  }
  const isId = (n, name) => !!n && n.type === 'id' && (name === undefined || n.name === name);
  const RESERVED = new Set(['x', 'y', 'e', 'pi', 'θ', 'r', 'ans']);

  function isNumLiteral(n) {
    if (!n) return false;
    if (n.type === 'num') return true;
    if (n.type === 'neg' && n.a.type === 'num') return true;
    return false;
  }

  function detectDef(ast) {
    if (ast.type !== 'cmp' || ast.ops.length !== 1 || ast.ops[0] !== '=') return null;
    const L = ast.args[0], R = ast.args[1];
    if (L.type === 'id' && !RESERVED.has(L.name)) return { kind: 'var', name: L.name, ast: R };
    if (L.type === 'call' && !L.builtin && !L.primes && !RESERVED.has(L.name) && L.args.length >= 1 &&
      L.args.every((a) => a.type === 'id' && a.name !== L.name)) {
      const params = L.args.map((a) => a.name);
      if (new Set(params).size === params.length) return { kind: 'fn', name: L.name, params: params, body: R };
    }
    return null;
  }

  // ---------------------------------------------------------------- linear algebra & fitting
  function solveLinear(A, b) {
    const n = b.length;
    const M = A.map((row, i) => row.slice().concat([b[i]]));
    for (let c = 0; c < n; c++) {
      let piv = c, best = Math.abs(M[c][c]);
      for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > best) { best = Math.abs(M[r][c]); piv = r; }
      if (!(best > 1e-300)) return null;
      if (piv !== c) { const t = M[c]; M[c] = M[piv]; M[piv] = t; }
      for (let r = 0; r < n; r++) {
        if (r === c) continue;
        const f = M[r][c] / M[c][c];
        if (f) for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
      }
    }
    const x = new Array(n);
    for (let i = 0; i < n; i++) x[i] = M[i][n] / M[i][i];
    return x.every(isFinite) ? x : null;
  }
  function sumsq(r) { let t = 0; for (let i = 0; i < r.length; i++) t += r[i] * r[i]; return t; }

  // least squares min ||r0 + J p|| via (scaled) normal equations
  function linLSQ(J, r0, k) {
    const m = r0.length;
    const scale = new Array(k).fill(0);
    for (let j = 0; j < k; j++) { let t = 0; for (let i = 0; i < m; i++) t += J[i][j] * J[i][j]; scale[j] = Math.sqrt(t) || 1; }
    const A = [], b = [];
    for (let a = 0; a < k; a++) {
      A.push(new Array(k).fill(0)); b.push(0);
      for (let i = 0; i < m; i++) b[a] -= J[i][a] * r0[i] / scale[a];
      for (let c = 0; c < k; c++) { let t = 0; for (let i = 0; i < m; i++) t += J[i][a] * J[i][c]; A[a][c] = t / (scale[a] * scale[c]); }
    }
    const p = solveLinear(A, b);
    return p ? p.map((v, j) => v / scale[j]) : null;
  }

  function levmar(F, p0, maxIter) {
    let p = p0.slice();
    let r = F(p);
    let cost = r ? sumsq(r) : Infinity;
    if (!isFinite(cost)) return null;
    const k = p.length;
    let lambda = 1e-3;
    for (let it = 0; it < (maxIter || 200); it++) {
      const m = r.length;
      const J = new Array(m);
      for (let i = 0; i < m; i++) J[i] = new Array(k);
      for (let j = 0; j < k; j++) {
        const h = 1e-7 * Math.max(1, Math.abs(p[j]));
        const pj = p.slice(); pj[j] += h;
        const rj = F(pj);
        for (let i = 0; i < m; i++) J[i][j] = rj ? (rj[i] - r[i]) / h : 0;
      }
      const A = [], g = [];
      for (let a = 0; a < k; a++) {
        A.push(new Array(k)); let t = 0;
        for (let i = 0; i < m; i++) t += J[i][a] * r[i];
        g.push(-t);
        for (let c = 0; c < k; c++) { let u = 0; for (let i = 0; i < m; i++) u += J[i][a] * J[i][c]; A[a][c] = u; }
      }
      let improved = false;
      for (let tries = 0; tries < 16; tries++) {
        const Ad = A.map((row, a) => row.map((v, c) => a === c ? v * (1 + lambda) + lambda * 1e-12 + 1e-300 : v));
        const d = solveLinear(Ad, g);
        if (d) {
          const pn = p.map((v, j) => v + d[j]);
          const rn = F(pn);
          const cn = rn ? sumsq(rn) : Infinity;
          if (isFinite(cn) && cn < cost) {
            const rel = (cost - cn) / (cost + 1e-300);
            p = pn; r = rn; cost = cn;
            lambda = Math.max(lambda / 4, 1e-15);
            improved = true;
            if (rel < 1e-14) return { p: p, cost: cost };
            break;
          }
        }
        lambda *= 5;
      }
      if (!improved || cost < 1e-28) break;
    }
    return { p: p, cost: cost };
  }

  function seeded(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

  // F(p) -> array of residuals (may contain NaN). Returns {p, cost, linear}
  function fitParams(F, k) {
    const ones = new Array(k).fill(1);
    const probe = F(ones), probe2 = F(new Array(k).fill(0.37));
    if (!probe) throw err('Regression needs list data');
    const m = probe.length;
    const mask = [];
    for (let i = 0; i < m; i++) if (isFinite(probe[i]) || (probe2 && isFinite(probe2[i]))) mask.push(i);
    if (mask.length === 0) throw err('No data to fit');
    const Fm = (p) => {
      const r = F(p);
      if (!r) return null;
      const out = new Float64Array(mask.length);
      for (let i = 0; i < mask.length; i++) { const v = r[mask[i]]; if (!isFinite(v)) return null; out[i] = v; }
      return out;
    };
    // linear test
    let linear = false, best = null;
    const r0 = Fm(new Array(k).fill(0));
    if (r0) {
      const J = [];
      let ok = true;
      for (let i = 0; i < mask.length; i++) J.push(new Array(k));
      for (let j = 0; j < k && ok; j++) {
        const e = new Array(k).fill(0); e[j] = 1;
        const rj = Fm(e);
        if (!rj) { ok = false; break; }
        for (let i = 0; i < mask.length; i++) J[i][j] = rj[i] - r0[i];
      }
      if (ok) {
        const tests = [[1.37, -0.71, 2.13, 0.29, -1.9, 3.1, 0.5, -2.2], [-3.3, 2.7, -0.45, 1.8, 0.9, -1.1, 2.4, 0.66]];
        linear = true;
        for (const tv of tests) {
          const pt = tv.slice(0, k);
          while (pt.length < k) pt.push(0.77);
          const rt = Fm(pt);
          if (!rt) { linear = false; break; }
          for (let i = 0; i < mask.length && linear; i++) {
            let pred = r0[i];
            for (let j = 0; j < k; j++) pred += J[i][j] * pt[j];
            if (Math.abs(pred - rt[i]) > 1e-7 * (1 + Math.abs(rt[i]) + Math.abs(pred))) linear = false;
          }
          if (!linear) break;
        }
        if (linear) {
          const p = linLSQ(J, r0, k);
          if (p) {
            const r = Fm(p);
            if (r) best = { p: p, cost: sumsq(r) };
          }
        }
      }
    }
    if (!best) {
      linear = false;
      const rnd = seeded(12345);
      const starts = [ones, new Array(k).fill(0.5), new Array(k).fill(2), new Array(k).fill(-1), new Array(k).fill(0.1)];
      for (let i = 0; i < 12; i++) {
        const st = [];
        for (let j = 0; j < k; j++) st.push((rnd() < 0.25 ? -1 : 1) * Math.exp((rnd() - 0.5) * 4));
        starts.push(st);
      }
      for (const st of starts) {
        const res = levmar(Fm, st, 300);
        if (res && isFinite(res.cost) && (!best || res.cost < best.cost)) best = res;
        if (best && best.cost < 1e-24) break;
      }
      if (!best) throw err('Could not fit this model to the data');
    }
    best.linear = linear;
    best.mask = mask;
    best.n = mask.length;
    return best;
  }

  // ---------------------------------------------------------------- line analysis
  const REG_CACHE = new Map();

  function missingError(missing, extra) {
    const names = Array.from(missing);
    const e = err((extra || 'Undefined: ') + names.join(', '));
    e.missing = names.filter((n) => /^([A-Za-zα-ωΑ-Ω](_[A-Za-z0-9]+)?|θ)$/.test(n) && !RESERVED.has(n) || n === 'θ' || n === 'r');
    return e;
  }

  function analyze(items, opts) {
    opts = opts || {};
    const deg = !!opts.deg;
    const entries = [];
    const defs = new Map();
    const fns = new Map();
    const dup = new Set();
    function define(name, d) {
      if (defs.has(name) || fns.has(name)) { dup.add(name); return; }
      if (d.kind === 'fn') fns.set(name, d); else defs.set(name, d);
    }

    // pass 1: parse + collect definitions
    (items || []).forEach((it, idx) => {
      if (!it || typeof it !== 'object') return;
      const e = { it: it, id: it.id != null ? it.id : idx };
      entries.push(e);
      if (it.type === 'table') { prepTable(e); return; }
      const text = String(it.text == null ? '' : it.text).trim();
      if (!text) { e.res = { kind: 'empty' }; return; }
      try { e.ast = parse(text); } catch (ex) { e.res = { kind: 'error', error: ex.calc ? ex.message : 'Invalid expression' }; return; }
      if (!e.ast) { e.res = { kind: 'empty' }; return; }
      const d = detectDef(e.ast);
      if (d) { e.def = d; d.entry = e; define(d.name, d); }
      if (e.ast.type === 'cmp' && e.ast.ops.indexOf('~') >= 0) e.reg = true;
    });

    function prepTable(e) {
      const cols = Array.isArray(e.it.columns) ? e.it.columns : [];
      e.cols = cols.map((c, ci) => {
        const col = { header: String((c && c.header) || '').trim(), cells: Array.isArray(c && c.values) ? c.values.map((v) => String(v == null ? '' : v)) : [], ci: ci };
        try { col.ast = col.header ? parse(col.header) : null; } catch (ex) { col.error = ex.message; }
        if (col.ast && col.ast.type === 'id') {
          col.name = col.ast.name;
          if (!RESERVED.has(col.name) && !(ci === 0 && col.name === 'x')) {
            col.def = { kind: 'list', name: col.name, col: col, entry: e };
            define(col.name, col.def);
          }
        } else if (col.ast) col.computed = true;
        return col;
      });
    }

    // regression params
    entries.forEach((e) => {
      if (!e.reg || e.res) return;
      if (e.ast.ops.length !== 1) { e.res = { kind: 'error', error: 'A regression looks like y_1 ~ m x_1 + b' }; return; }
      const names = collectNames(e.ast, fns);
      const params = [];
      names.forEach((n) => { if (!defs.has(n) && !fns.has(n) && !RESERVED.has(n) && n !== 't') params.push(n); });
      e.params = params;
      params.forEach((n) => define(n, { kind: 'reg', name: n, entry: e }));
    });
    // residual lists e_1, e_2, ... (next free name for each regression, in order)
    let residK = 1;
    entries.forEach((e) => {
      if (!e.reg || e.res) return;
      while (defs.has('e_' + residK) || fns.has('e_' + residK)) residK++;
      e.residName = 'e_' + residK;
      define(e.residName, { kind: 'resid', name: e.residName, entry: e });
      residK++;
    });

    const cache = new Map(), busy = new Set();
    function getVar(name) {
      if (cache.has(name)) { const c = cache.get(name); if (c instanceof Error) throw c; return c; }
      const d = defs.get(name);
      if (!d) return undefined;
      if (dup.has(name)) { const e = err("'" + name + "' is defined more than once"); cache.set(name, e); throw e; }
      if (busy.has(name)) throw err("'" + name + "' is defined in terms of itself");
      busy.add(name);
      try {
        let v;
        if (d.kind === 'var') {
          const cx = ctx(NO_LOCALS);
          const f = compile(d.ast, cx);
          if (cx.missing.size) {
            const mm = Array.from(cx.missing);
            if (mm.some((n) => n === 'x' || n === 'y')) throw err("A variable can't depend on x or y");
            throw missingError(cx.missing);
          }
          v = f({});
          if (typeof v === 'boolean') throw err('A variable must be a number, point or list');
        } else if (d.kind === 'list') {
          v = columnValues(d.col.entry, d.col);
        } else if (d.kind === 'reg') {
          const fit = fitEntry(d.entry);
          v = fit.params[name];
        } else if (d.kind === 'resid') {
          v = fitEntry(d.entry).resid;
        }
        cache.set(name, v);
        return v;
      } catch (ex) {
        const e2 = ex.calc ? ex : err(String(ex && ex.message || ex));
        if (ex.missing) e2.missing = ex.missing;
        cache.set(name, e2);
        throw e2;
      } finally {
        busy.delete(name);
      }
    }
    function ctx(locals, extra) {
      const cx = makeCtx({ locals: locals, getVar: getVar, fns: fns, deg: deg });
      if (extra) Object.assign(cx, extra);
      return cx;
    }

    function cellValue(text) {
      const t = String(text).trim();
      if (!t) return NaN;
      const ast = parse(t);
      const cx = ctx(NO_LOCALS);
      const v = compile(ast, cx)({});
      if (cx.missing.size) throw missingError(cx.missing);
      if (typeof v !== 'number') throw err('Table cells must be numbers');
      return v;
    }
    function columnValues(e, col) {
      if (col.values) return col.values;
      if (col.error) throw err(col.error);
      if (col.computed && col.ci > 0) {
        const c0 = e.cols[0];
        const base = c0 ? columnValues(e, c0) : [];
        const locals = c0 && c0.name === 'x' ? new Set(['x']) : NO_LOCALS;
        const cx = ctx(locals);
        const f = compile(col.ast, cx);
        if (cx.missing.size) throw missingError(cx.missing);
        let v = f({ x: base });
        if (typeof v === 'number') v = base.map(() => v);
        if (!Array.isArray(v)) throw err('Column formula must give numbers');
        col.values = base.map((_, i) => (typeof v[i] === 'number' ? v[i] : NaN));
        return col.values;
      }
      col.cellErrors = [];
      col.values = col.cells.map((c, i) => {
        try { return cellValue(c); } catch (ex) { col.cellErrors[i] = ex.message; return NaN; }
      });
      while (col.values.length && isNaN(col.values[col.values.length - 1]) && !String(col.cells[col.values.length - 1] || '').trim()) col.values.pop();
      return col.values;
    }

    function fitEntry(e) {
      if (e.fit) return e.fit;
      if (e.fitErr) throw e.fitErr;
      try {
        const L = e.ast.args[0], R = e.ast.args[1];
        const params = e.params;
        if (!params.length) throw err('Nothing to fit — add parameters like m and b');
        const cx = ctx(new Set(params), { localsFirst: true });
        const Rf = compile({ type: 'bin', op: '-', a: L, b: R }, cx);
        if (cx.missing.size) {
          if (cx.missing.has('x') || cx.missing.has('y')) throw err('Regressions use lists, e.g. y_1 ~ m x_1 + b');
          throw missingError(cx.missing);
        }
        // cache key
        const names = collectNames(e.ast, fns);
        const vals = {};
        names.forEach((n) => { if (params.indexOf(n) < 0) { try { vals[n] = getVar(n); } catch (ex) { /* ignore */ } } });
        const key = String(e.it.text) + '|' + deg + '|' + JSON.stringify(vals);
        let best = REG_CACHE.get(key);
        const sc = {};
        const F = (p) => {
          for (let i = 0; i < params.length; i++) sc[params[i]] = p[i];
          let v = Rf(sc);
          if (typeof v === 'number') v = [v];
          if (!Array.isArray(v)) return null;
          return v.map((w) => (typeof w === 'number' ? w : NaN));
        };
        if (!best) {
          best = fitParams(F, params.length);
          REG_CACHE.set(key, best);
          if (REG_CACHE.size > 60) REG_CACHE.delete(REG_CACHE.keys().next().value);
        }
        const pvals = {};
        params.forEach((n, i) => { pvals[n] = roundSmallRel(best.p[i]); });
        // r^2
        const Lf = compile(L, ctx(new Set(params), { localsFirst: true }));
        let ly = Lf(sc);
        if (typeof ly === 'number') ly = [ly];
        let r2 = NaN;
        if (Array.isArray(ly)) {
          const ys = best.mask.map((i) => ly[i]).filter((v) => typeof v === 'number' && isFinite(v));
          const mean = ys.reduce((a, b) => a + b, 0) / ys.length;
          let tot = 0;
          for (const v of ys) tot += (v - mean) * (v - mean);
          r2 = tot > 0 ? 1 - best.cost / tot : (best.cost < 1e-20 ? 1 : NaN);
        }
        // curve: substitute the single list variable in R with x
        let curve = null, indep = null;
        const rn = collectNames(R, fns);
        const lists = [];
        rn.forEach((n) => { if (params.indexOf(n) < 0) { let v; try { v = getVar(n); } catch (ex) { v = undefined; } if (Array.isArray(v)) lists.push(n); } });
        if (lists.length === 1) {
          indep = lists[0];
          const sub = new Map();
          sub.set(indep, (s) => s.x);
          params.forEach((n) => sub.set(n, konst(pvals[n])));
          const cc = ctx(new Set(['x']));
          cc.subst = sub;
          const Cf = compile(R, cc);
          const s2 = { x: 0 };
          curve = (x) => { s2.x = x; const v = Cf(s2); return typeof v === 'number' ? v : NaN; };
        }
        // residuals (lhs - model) over the full data, statistics
        const rfull = F(best.p) || [];
        const resid = rfull.map((v, i) => (best.mask.indexOf(i) >= 0 ? roundTiny(v) : NaN));
        const rmse = roundTiny(Math.sqrt(best.cost / Math.max(1, best.n)));
        const plainLhs = L.type === 'id';
        let r = NaN;
        if (plainLhs && best.linear && params.length === 2 && curve) {
          const c0 = curve(0), c1 = curve(1), c2 = curve(2);
          if (isFinite(c0) && isFinite(c1) && Math.abs((c2 - c1) - (c1 - c0)) < 1e-9 * (1 + Math.abs(c1 - c0))) r = (c1 >= c0 ? 1 : -1) * Math.sqrt(Math.max(0, r2));
        }
        e.fit = { params: pvals, order: params, r2: plainLhs ? r2 : NaN, r: r, rmse: rmse, plainLhs: plainLhs, curve: curve, indep: indep, n: best.n, linear: best.linear, resid: resid, residName: e.residName };
        return e.fit;
      } catch (ex) {
        e.fitErr = ex.calc ? ex : err(String(ex.message || ex));
        if (ex.missing) e.fitErr.missing = ex.missing;
        throw e.fitErr;
      }
    }

    function checkLocals(cx, allowed) {
      cx.used.forEach((u) => {
        if (allowed.indexOf(u) >= 0) return;
        if (u === 't' || u === 'θ') cx.missing.add(u);
        else throw err(u === 'y' ? "Can't use y here — try an equation with '='" : "Can't use " + u + ' here');
      });
      if (cx.missing.size) throw missingError(cx.missing);
    }

    function sampleScope() { return { x: 0.5123, y: 0.4871, t: 0.5123, 'θ': 0.5123 }; }
    function evalSample(Cf) { return Cf(sampleScope()); }

    function branchesOf(Cf, v, key, ast, cx) {
      // returns list of functions of a single number (key = local name)
      const n = Array.isArray(v) ? v.length : 0;
      if (Array.isArray(v) && v.some(isPt)) throw err('Expected numbers, got points');
      if (isPt(v)) throw err('Expected a number, got a point');
      if (!n && ast && cx && opts.codegen !== false) {
        const fast = codegen(ast, cx);
        if (fast) {
          if (key === 'x') return [(u) => fast(u, 0, 0, 0)];
          if (key === 'y') return [(u) => fast(0, u, 0, 0)];
          if (key === 'θ') return [(u) => fast(0, 0, 0, u)];
        }
      }
      const out = [];
      const count = n || 1;
      for (let i = 0; i < count; i++) {
        const s = { x: 0, y: 0, t: 0, 'θ': 0 };
        const idx = n ? i : -1;
        out.push((u) => {
          s[key] = u;
          let r = Cf(s);
          if (idx >= 0 && Array.isArray(r)) r = r[idx];
          return typeof r === 'number' ? r : NaN;
        });
      }
      return out;
    }
    function fields2(Cf, v, ast, cx) {
      const n = Array.isArray(v) ? v.length : 0;
      if (isPt(v) || (n && v.some(isPt))) throw err('Expected numbers, got points');
      if (!n && ast && cx && opts.codegen !== false) {
        const fast = codegen(ast, cx);
        if (fast) return [(x, y) => fast(x, y, 0, 0)];
      }
      const out = [];
      for (let i = 0; i < (n || 1); i++) {
        const s = { x: 0, y: 0, t: 0, 'θ': 0 };
        const idx = n ? i : -1;
        out.push((x, y) => {
          s.x = x; s.y = y;
          let r = Cf(s);
          if (idx >= 0 && Array.isArray(r)) r = r[idx];
          return typeof r === 'number' ? r : NaN;
        });
      }
      return out;
    }

    function valueResult(v, extra) {
      const r = Object.assign({ kind: 'value', value: v, display: formatValue(v) }, extra || {});
      const pts = pointsOf(v);
      if (pts) { r.kind = extra && extra.kind ? extra.kind : 'points'; r.pts = pts; }
      return r;
    }

    function lineResult(e) {
      const ast = e.ast, d = e.def;
      if (d && dup.has(d.name)) throw err("'" + d.name + "' is defined more than once");
      if (e.reg) {
        const fit = fitEntry(e);
        return { kind: 'regression', params: fit.params, order: fit.order, r2: fit.r2, r: fit.r, rmse: fit.rmse, plainLhs: fit.plainLhs, residName: fit.residName, resid: fit.resid, indep: fit.indep, fns: fit.curve && fit.plainLhs ? [fit.curve] : [], n: fit.n, linear: fit.linear };
      }
      if (d && d.kind === 'var') {
        const v = getVar(d.name);
        const slider = isNumLiteral(d.ast) && typeof v === 'number';
        const r = { kind: slider ? 'slider' : 'var', name: d.name, value: v, display: formatValue(v) };
        const pts = pointsOf(v);
        if (pts) r.pts = pts;
        return r;
      }
      if (d && d.kind === 'fn') {
        // validate body (collect missing) and plot one-variable functions
        const locals = new Set(d.params);
        const bcx = ctx(locals, { localsFirst: true });
        compile(d.body, bcx);
        bcx.used.forEach((u) => locals.has(u) || bcx.missing.add(u));
        if (bcx.missing.size) throw missingError(bcx.missing);
        if (d.params.length === 1) {
          const cx = ctx(ALL_LOCALS);
          const callAst = { type: 'call', name: d.name, args: [{ type: 'id', name: 'x' }], primes: 0 };
          const Cf = compile(callAst, cx);
          checkLocals(cx, ['x']);
          const v = evalSample(Cf);
          if (isPt(v) || (Array.isArray(v) && v.some(isPt))) return { kind: 'fn', name: d.name };
          return { kind: 'explicit', fns: branchesOf(Cf, v, 'x', callAst, cx), fnName: d.name };
        }
        return { kind: 'fn', name: d.name };
      }
      if (ast.type === 'cmp') {
        const ops = ast.ops;
        if (ops.every((o) => o === '=')) {
          if (ops.length > 1) throw err("Too many '=' signs");
          const L = ast.args[0], R = ast.args[1];
          const tryExplicit = (lhsName, other, allowed, kind) => {
            const cx = ctx(ALL_LOCALS);
            const Cf = compile(other, cx);
            if (cx.used.has(lhsName)) return null;
            checkLocals(cx, allowed);
            const v = evalSample(Cf);
            return { kind: kind, fns: branchesOf(Cf, v, allowed[0], other, cx) };
          };
          let r = null;
          if (isId(L, 'y')) r = tryExplicit('y', R, ['x'], 'explicit');
          else if (isId(R, 'y') && !isId(L, 'x')) r = tryExplicit('y', L, ['x'], 'explicit');
          if (!r && isId(L, 'x')) r = tryExplicit('x', R, ['y'], 'explicitx');
          if (!r && isId(R, 'x') && !isId(L, 'y')) r = tryExplicit('x', L, ['y'], 'explicitx');
          if (r) return r;
          if (isId(L, 'r') || isId(R, 'r')) {
            const cx = ctx(ALL_LOCALS);
            const pa = isId(L, 'r') ? R : L;
            const Cf = compile(pa, cx);
            checkLocals(cx, ['θ']);
            const v = evalSample(Cf);
            return { kind: 'polar', fns: branchesOf(Cf, v, 'θ', pa, cx) };
          }
          const cx = ctx(ALL_LOCALS);
          const diffAst = { type: 'bin', op: '-', a: L, b: R };
          const Cf = compile(diffAst, cx);
          if (!cx.used.has('x') && !cx.used.has('y')) {
            checkLocals(cx, []);
            const a = compile(L, ctx(NO_LOCALS))({}), b = compile(R, ctx(NO_LOCALS))({});
            const ok = typeof a === 'number' && typeof b === 'number' ? eqTol(a, b) : false;
            return { kind: 'value', value: ok, display: ok ? 'true' : 'false' };
          }
          checkLocals(cx, ['x', 'y']);
          const v = evalSample(Cf);
          return { kind: 'implicit', Fs: fields2(Cf, v, diffAst, cx) };
        }
        if (ops.every((o) => o !== '=' && o !== '~')) {
          const cx = ctx(ALL_LOCALS);
          const A = ast.args.map((a) => compile(a, cx));
          const n = ops.length;
          const signs = ops.map((o) => (o === '<' || o === '<=') ? 1 : -1);
          const Cf = (s) => {
            let m = null;
            for (let i = 0; i < n; i++) {
              const a = A[i](s), b = A[i + 1](s);
              const d = (typeof a === 'number' && typeof b === 'number') ? signs[i] * (b - a) : bc(fMul, signs[i], bc(fSub, b, a, '-'), '*');
              m = m === null ? d : (typeof m === 'number' && typeof d === 'number') ? (m < d || isNaN(m) ? m : d) : bc((p, q) => (isNaN(p) || isNaN(q)) ? NaN : Math.min(p, q), m, d, 'min');
            }
            return m;
          };
          if (!cx.used.has('x') && !cx.used.has('y')) {
            checkLocals(cx, []);
            const s = {};
            let prev = A[0](s), ok = true;
            for (let i = 0; i < n; i++) { const cur = A[i + 1](s); if (!cmpOp(ops[i], prev, cur)) ok = false; prev = cur; }
            return { kind: 'value', value: ok, display: ok ? 'true' : 'false' };
          }
          checkLocals(cx, ['x', 'y']);
          const v = evalSample(Cf);
          const marginAst = { type: 'minof', items: ops.map((o, i) => signs[i] > 0 ? { type: 'bin', op: '-', a: ast.args[i + 1], b: ast.args[i] } : { type: 'bin', op: '-', a: ast.args[i], b: ast.args[i + 1] }) };
          return { kind: 'ineq', Fs: fields2(Cf, v, marginAst, cx), strict: ops.every((o) => o === '<' || o === '>') };
        }
        throw err("Can't mix '=' with inequalities");
      }
      // bare expression
      const cx = ctx(ALL_LOCALS);
      const Cf = compile(ast, cx);
      const used = cx.used;
      if (!used.size) {
        if (cx.missing.size) throw missingError(cx.missing);
        const v = Cf({});
        const r = valueResult(v);
        if (r.kind === 'points' && ast.type === 'tuple' && ast.items.length === 2) {
          const spec = (n) => {
            if (isNumLiteral(n)) return { c: true };
            if (n.type === 'id') { const dd = defs.get(n.name); if (dd && dd.kind === 'var' && isNumLiteral(dd.ast) && !dup.has(n.name)) return { name: n.name }; }
            return null;
          };
          const dx = spec(ast.items[0]), dy = spec(ast.items[1]);
          if (dx || dy) r.drag = { x: dx, y: dy };
        }
        return r;
      }
      if (used.has('t') && !used.has('x') && !used.has('y') && !used.has('θ')) {
        if (cx.missing.size) throw missingError(cx.missing);
        const v = evalSample(Cf);
        if (isPt(v) || (Array.isArray(v) && v.length && v.every(isPt))) {
          const n = Array.isArray(v) ? v.length : 0;
          const fns2 = [];
          for (let i = 0; i < (n || 1); i++) {
            const s = { t: 0 };
            const idx = n ? i : -1;
            fns2.push((t) => { s.t = t; let r = Cf(s); if (idx >= 0 && Array.isArray(r)) r = r[idx]; return isPt(r) ? r : null; });
          }
          return { kind: 'parametric', pfns: fns2 };
        }
        checkLocals(cx, []);
      }
      if (used.has('y')) {
        throw err(used.has('x') ? "Add '=' to make an equation, e.g. " + 'x^2 + y^2 = 4' : "Try writing x = ... to graph in terms of y");
      }
      checkLocals(cx, ['x']);
      const v = evalSample(Cf);
      return { kind: 'explicit', fns: branchesOf(Cf, v, 'x', ast, cx) };
    }

    function tableResult(e) {
      const cols = e.cols.map((c) => {
        const out = { header: c.header, name: c.name || null, computed: !!c.computed };
        try {
          if (dup.has(c.name)) throw err("'" + c.name + "' is defined more than once");
          out.values = columnValues(e, c);
          if (c.cellErrors && c.cellErrors.some(Boolean)) out.cellErrors = c.cellErrors;
        } catch (ex) {
          out.error = ex.message;
          if (ex.missing) out.missing = ex.missing;
          out.values = [];
        }
        return out;
      });
      const series = [];
      const xs = cols[0] ? cols[0].values : [];
      for (let k = 1; k < cols.length; k++) {
        const ys = cols[k].values;
        const pts = [];
        const n = Math.min(xs.length, ys.length);
        for (let i = 0; i < n; i++) if (isFinite(xs[i]) && isFinite(ys[i])) pts.push([xs[i], ys[i]]);
        series.push({ col: k, pts: pts });
      }
      // residual columns requested by regressions ("plot residuals")
      entries.forEach((re) => {
        if (!re.reg || !re.it || !re.it.plotResid) return;
        let fit;
        try { fit = fitEntry(re); } catch (ex) { return; }
        const ci = e.cols.findIndex((c) => c.name && c.name === fit.indep);
        if (ci < 0) return;
        const xv = cols[ci].values;
        cols.push({ header: fit.residName, name: fit.residName, computed: true, virtual: true, regId: re.id, values: fit.resid.slice() });
        const pts = [];
        for (let i = 0; i < Math.min(xv.length, fit.resid.length); i++) if (isFinite(xv[i]) && isFinite(fit.resid[i])) pts.push([xv[i], fit.resid[i]]);
        series.push({ col: cols.length - 1, pts: pts, resid: true, regId: re.id });
      });
      const errCol = cols.find((c) => c.error);
      const r = { kind: 'table', cols: cols, series: series };
      if (errCol) { r.error = errCol.error; r.missing = errCol.missing; }
      return r;
    }

    const results = new Map();
    for (const e of entries) {
      if (!e.res) {
        try {
          e.res = e.cols ? tableResult(e) : lineResult(e);
        } catch (ex) {
          if (!ex || !ex.calc) {
            e.res = { kind: 'error', error: 'Something went wrong evaluating this line' };
            if (opts.debug) e.res.debug = String(ex && ex.stack || ex);
          } else {
            e.res = { kind: 'error', error: ex.message };
            if (ex.missing && ex.missing.length) e.res.missing = ex.missing;
          }
        }
      }
      e.res.ast = e.ast || null;
      results.set(e.id, e.res);
    }
    return { results: results, getVar: getVar, fns: fns };
  }

  function roundTiny(v) { return Math.abs(v) < 1e-9 ? 0 : v; }
  function roundSmallRel(v) {
    if (!isFinite(v)) return v;
    const r = Math.round(v);
    if (Math.abs(v - r) < 1e-10 * Math.max(1, Math.abs(v))) return r;
    return v;
  }

  function pointsOf(v) {
    if (isPt(v)) return [[v.x, v.y]];
    if (Array.isArray(v) && v.length && v.every(isPt)) return v.map((p) => [p.x, p.y]);
    return null;
  }

  // ---------------------------------------------------------------- formatting
  const SUP = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻', '+': '' };
  function formatNumber(v, sig) {
    sig = sig || 10;
    if (typeof v === 'boolean') return v ? 'true' : 'false';
    if (typeof v !== 'number') return String(v);
    if (isNaN(v)) return 'undefined';
    if (!isFinite(v)) return v > 0 ? '∞' : '-∞';
    if (Math.abs(v) < 1e-15) return '0';
    const a = Math.abs(v);
    if (a >= 1e12 || a < 1e-6) {
      const s = v.toExponential(sig - 1);
      let parts = s.split('e');
      let mant = parts[0];
      if (mant.indexOf('.') >= 0) mant = mant.replace(/0+$/, '').replace(/\.$/, '');
      const ex = parts[1].replace('+', '');
      return mant + '×10' + ex.split('').map((c) => SUP[c]).join('');
    }
    let s = String(Number(v.toPrecision(sig)));
    if (s.indexOf('e') >= 0) s = v.toFixed(Math.max(0, sig - 1 - Math.floor(Math.log10(a))));
    return s;
  }
  function formatValue(v) {
    if (typeof v === 'number' || typeof v === 'boolean') return formatNumber(v);
    if (isPt(v)) return '(' + formatNumber(v.x) + ', ' + formatNumber(v.y) + ')';
    if (Array.isArray(v)) {
      const parts = v.slice(0, 20).map(formatValue);
      return '[' + parts.join(', ') + (v.length > 20 ? ', …' : '') + ']';
    }
    return String(v);
  }
  // coordinates on graph labels, e.g. (1.5, -0.25)
  function formatCoord(v) {
    if (!isFinite(v)) return 'undefined';
    if (Math.abs(v) < 5e-11) return '0';
    const a = Math.abs(v);
    if (a >= 1e6 || a < 1e-4) return formatNumber(Number(v.toPrecision(4)), 4);
    let d = a >= 1 ? 3 : Math.min(8, 3 - Math.floor(Math.log10(a)));
    let s = v.toFixed(d);
    if (s.indexOf('.') >= 0) s = s.replace(/0+$/, '').replace(/\.$/, '');
    if (s === '-0') s = '0';
    return s;
  }
  function toFraction(v, maxDen) {
    if (typeof v !== 'number' || !isFinite(v) || Number.isInteger(v)) return null;
    const f = fracApprox(v, maxDen || 10000);
    if (!f || f[1] === 1) return null;
    return { n: f[0], d: f[1] };
  }

  // ---------------------------------------------------------------- LaTeX
  const FN_TEX = {
    sin: '\\sin', cos: '\\cos', tan: '\\tan', csc: '\\csc', sec: '\\sec', cot: '\\cot', sinh: '\\sinh', cosh: '\\cosh',
    tanh: '\\tanh', coth: '\\coth', ln: '\\ln', log: '\\log', exp: '\\exp', arcsin: '\\arcsin', arccos: '\\arccos',
    arctan: '\\arctan', min: '\\min', max: '\\max', gcd: '\\gcd'
  };
  function idTex(name) {
    if (name === 'pi') return '\\pi';
    if (name === 'θ') return '\\theta';
    if (name === 'ans') return '\\operatorname{ans}';
    const greek = { α: 'alpha', β: 'beta', γ: 'gamma', δ: 'delta', λ: 'lambda', μ: 'mu', σ: 'sigma', φ: 'phi', ω: 'omega' };
    const m = name.split('_');
    let b = m[0];
    if (greek[b]) b = '\\' + greek[b];
    return m.length > 1 ? b + '_{' + m[1] + '}' : b;
  }
  function numTex(n) {
    const s = n.s != null ? n.s : String(n.v);
    const i = s.indexOf('E');
    if (i >= 0) return s.slice(0, i) + '\\times10^{' + s.slice(i + 1) + '}';
    return s;
  }
  const strip = (n) => (n && n.type === 'paren' ? n.a : n);
  function toLatex(node) {
    if (!node) return '';
    const T = toLatex;
    const wrapIf = (n, cond) => cond ? '\\left(' + T(n) + '\\right)' : T(n);
    switch (node.type) {
      case 'num': return numTex(node);
      case 'id': return idTex(node.name);
      case 'paren': return node.brace ? '{' + T(node.a) + '}' : '\\left(' + T(node.a) + '\\right)';
      case 'neg': return '-' + wrapIf(node.a, node.a.type === 'bin' && (node.a.op === '+' || node.a.op === '-'));
      case 'bin': {
        if (node.op === '/') return '\\frac{' + T(strip(node.a)) + '}{' + T(strip(node.b)) + '}';
        if (node.op === '*') {
          const a = T(node.a), b = T(node.b);
          if (!node.implicit) return a + '\\cdot ' + b;
          const lastDigit = /[0-9.}]$/.test(a) && /^[0-9.]/.test(b);
          return a + (lastDigit ? '\\cdot ' : (/[a-zA-Z]$/.test(a) && /^[a-zA-Z]/.test(b) ? ' ' : '')) + b;
        }
        const b = node.b.type === 'neg' ? '\\left(' + T(node.b) + '\\right)' : T(node.b);
        return T(node.a) + node.op + b;
      }
      case 'pow': {
        const base = node.a;
        if (node.fnpow && base.type === 'call') return callTex(base, '^{' + T(strip(node.b)) + '}');
        const needs = base.type === 'bin' || base.type === 'neg' || base.type === 'pow' || base.type === 'cmp' ||
          (base.type === 'num' && base.v < 0);
        const bt = needs ? '\\left(' + T(base) + '\\right)' : T(base);
        return '{' + bt + '}^{' + T(strip(node.b)) + '}';
      }
      case 'call': return callTex(node, '');
      case 'list': return node.bare ? node.items.map(T).join(',') : '\\left[' + node.items.map(T).join(',') + '\\right]';
      case 'range': return '\\left[' + node.start.map(T).join(',') + ',\\ldots,' + T(node.end) + '\\right]';
      case 'tuple': return '\\left(' + node.items.map(T).join(',') + '\\right)';
      case 'cmp': {
        const map = { '<': '<', '>': '>', '<=': '\\le ', '>=': '\\ge ', '=': '=', '~': '\\sim ' };
        let s = T(node.args[0]);
        node.ops.forEach((o, i) => { s += map[o] + T(node.args[i + 1]); });
        return s;
      }
      case 'restrict': return '\\left\\{' + node.conds.map(T).join(',') + '\\right\\}';
      case 'piecewise': {
        const parts = node.branches.map((b) => T(b.cond) + ':' + T(b.val));
        if (node.else) parts.push(T(node.else));
        return '\\left\\{' + parts.join(',\\ ') + '\\right\\}';
      }
      case 'index': return T(node.a) + '\\left[' + node.items.map(T).join(',') + '\\right]';
      case 'comp': return '\\left[' + T(node.body) + '\\operatorname{for}' + node.binds.map((b) => idTex(b.name) + '=' + T(b.list)).join(',') + '\\right]';
      case 'member': return T(node.a) + '.' + node.m;
      case 'pct': return T(node.a) + '\\%';
      case 'degsym': return T(node.a) + '^{\\circ}';
    }
    return '';
  }
  function callTex(node, sup) {
    const T = toLatex;
    const a = node.args;
    const name = node.name;
    if (!node.builtin) {
      return idTex(name) + "'".repeat(node.primes || 0) + '\\left(' + a.map(T).join(',') + '\\right)';
    }
    if (name === 'ddx') return '\\frac{d}{dx}\\left(' + a.map(T).join(',') + '\\right)' + sup;
    if (name === 'sqrt' && a.length === 1) return '\\sqrt{' + T(strip(a[0])) + '}' + sup;
    if (name === 'cbrt' && a.length === 1) return '\\sqrt[3]{' + T(strip(a[0])) + '}' + sup;
    if (name === 'nthroot' && a.length === 2) return '\\sqrt[' + T(a[1]) + ']{' + T(a[0]) + '}' + sup;
    if (name === 'abs' && a.length === 1) return '\\left|' + T(strip(a[0])) + '\\right|' + sup;
    if (name === 'factorial' && node.bang) {
      const x = a[0];
      const simple = x.type === 'num' || x.type === 'id' || x.type === 'paren';
      return (simple ? T(x) : '\\left(' + T(x) + '\\right)') + '!' + sup;
    }
    if (name === 'nCr' || name === 'nPr') return '\\operatorname{' + name + '}\\left(' + a.map(T).join(',') + '\\right)' + sup;
    const head = (FN_TEX[name] || '\\operatorname{' + name + '}') + (node.base ? '_{' + T(node.base) + '}' : '') + sup;
    return head + '\\left(' + a.map(T).join(',') + '\\right)';
  }

  // ---------------------------------------------------------------- points of interest
  function bisect(h, a, b, ha, hb) {
    for (let i = 0; i < 100; i++) {
      const m = 0.5 * (a + b);
      if (m === a || m === b) break;
      const hm = h(m);
      if (hm === 0) return m;
      if (!isFinite(hm)) return NaN;
      if ((hm < 0) === (ha < 0)) { a = m; ha = hm; } else { b = m; hb = hm; }
    }
    return Math.abs(ha) < Math.abs(hb) ? a : b;
  }
  function golden(f, a, b, sign) {
    const g = 0.6180339887498949;
    let c = b - g * (b - a), d = a + g * (b - a);
    let fc = sign * f(c), fd = sign * f(d);
    for (let i = 0; i < 90; i++) {
      if (fc > fd) { b = d; d = c; fd = fc; c = b - g * (b - a); fc = sign * f(c); } else { a = c; c = d; fc = fd; d = a + g * (b - a); fd = sign * f(d); }
      if (Math.abs(b - a) < 1e-13 * (1 + Math.abs(a))) break;
    }
    return 0.5 * (a + b);
  }
  function sample(f, a, b, n) {
    const xs = new Float64Array(n + 1), ys = new Float64Array(n + 1);
    for (let i = 0; i <= n; i++) { const x = a + (b - a) * i / n; xs[i] = x; ys[i] = f(x); }
    return { xs: xs, ys: ys };
  }
  // roots of h on [a,b]; includes tangential roots (local extrema of |h| ~ 0)
  function roots1d(h, a, b, n) {
    const S = sample(h, a, b, n), xs = S.xs, ys = S.ys;
    const out = [];
    // coincident curves (h identically ~0) have no isolated intersections
    let zeros = 0, big = 0;
    for (let i = 0; i <= n; i++) { const v = Math.abs(ys[i]); if (isFinite(v)) big = Math.max(big, v); }
    for (let i = 0; i <= n; i++) if (Math.abs(ys[i]) <= 1e-12 * Math.max(1, big)) zeros++;
    if (zeros > Math.max(8, n * 0.02)) return out;
    for (let i = 0; i < n; i++) {
      const y0 = ys[i], y1 = ys[i + 1];
      if (y0 === 0 && isFinite(y0)) { out.push(xs[i]); continue; }
      if (!isFinite(y0) || !isFinite(y1)) continue;
      if ((y0 < 0) !== (y1 < 0) && y1 !== 0) {
        const r = bisect(h, xs[i], xs[i + 1], y0, y1);
        if (!isFinite(r)) continue;
        const hr = Math.abs(h(r));
        if (hr <= 1e-6 * Math.min(Math.abs(y0), Math.abs(y1)) || hr < 1e-12) out.push(r);
      }
    }
    if (ys[n] === 0) out.push(xs[n]);
    for (let i = 1; i < n; i++) {
      const y0 = Math.abs(ys[i - 1]), y1 = Math.abs(ys[i]), y2 = Math.abs(ys[i + 1]);
      if (!(isFinite(y0) && isFinite(y1) && isFinite(y2))) continue;
      if (y1 < y0 && y1 <= y2 && ((ys[i - 1] < 0) === (ys[i + 1] < 0)) && ys[i] !== 0 && (ys[i] < 0) === (ys[i - 1] < 0)) {
        const m = golden((x) => Math.abs(h(x)), xs[i - 1], xs[i + 1], -1);
        const hm = Math.abs(h(m));
        if (hm < 1e-9 * Math.max(y0, y2) || hm < 1e-13) out.push(m);
      }
    }
    return out;
  }
  function extrema1d(f, a, b, n) {
    const S = sample(f, a, b, n), xs = S.xs, ys = S.ys;
    const out = [];
    for (let i = 1; i < n; i++) {
      const y0 = ys[i - 1], y1 = ys[i], y2 = ys[i + 1];
      if (!(isFinite(y0) && isFinite(y1) && isFinite(y2))) continue;
      let sign = 0;
      if (y1 > y0 && y1 >= y2 && y1 > y2 - 1e-300) sign = 1;
      else if (y1 < y0 && y1 <= y2) sign = -1;
      if (!sign || (y1 === y2)) {
        // plateau check: equal neighbours are ignored (constant pieces)
        if (!sign) continue;
        let j = i + 1;
        while (j < n && ys[j] === y1) j++;
        if (j >= n || (sign > 0 ? ys[j] > y1 : ys[j] < y1) || !isFinite(ys[j])) continue;
      }
      const m = golden(f, xs[i - 1], xs[i + 1], sign);
      const fm = f(m);
      if (!isFinite(fm)) continue;
      // reject spikes at discontinuities: check value near both sides
      const dx = (xs[i + 1] - xs[i - 1]) * 1e-3;
      const fl = f(m - dx), fr = f(m + dx);
      if (!isFinite(fl) || !isFinite(fr)) continue;
      const span = Math.abs(y0 - y1) + Math.abs(y2 - y1) + 1e-300;
      if (Math.abs(fl - fm) > span * 2 || Math.abs(fr - fm) > span * 2) continue;
      out.push({ x: m, y: fm, type: sign > 0 ? 'max' : 'min' });
    }
    return out;
  }
  function newton2(FA, FB, x, y, scale) {
    for (let i = 0; i < 12; i++) {
      const a = FA(x, y), b = FB(x, y);
      if (!isFinite(a) || !isFinite(b)) return null;
      const h = 1e-7 * scale;
      const ax = (FA(x + h, y) - a) / h, ay = (FA(x, y + h) - a) / h;
      const bx = (FB(x + h, y) - b) / h, by = (FB(x, y + h) - b) / h;
      const det = ax * by - ay * bx;
      if (!isFinite(det) || Math.abs(det) < 1e-300) return null;
      const dx = (-a * by + ay * b) / det, dy = (-ax * b + bx * a) / det;
      x += dx; y += dy;
      if (Math.abs(dx) + Math.abs(dy) < 1e-13 * scale) break;
    }
    return [x, y];
  }
  // curve descriptors: {type:'fx', f}, {type:'fy', f}, {type:'F', F, chains:[Float64Array world xy...]}
  function swapCurve(c) {
    if (c.type === 'P') { const fn = c.fn; return { type: 'P', id: c.id, t0: c.t0, t1: c.t1, fn: (t) => { const p = fn(t); return p ? [p[1], p[0]] : null; } }; }
    if (c.type === 'fx') return { type: 'fy', f: c.f, id: c.id };
    if (c.type === 'fy') return { type: 'fx', f: c.f, id: c.id };
    const F = c.F;
    return { type: 'F', F: (x, y) => F(y, x), id: c.id, chains: c.chains && c.chains.map((ch) => { const o = new Float64Array(ch.length); for (let i = 0; i < ch.length; i += 2) { o[i] = ch[i + 1]; o[i + 1] = ch[i]; } return o; }) };
  }
  function implicitOf(c) {
    if (c.type === 'F') return c.F;
    if (c.type === 'fx') { const f = c.f; return (x, y) => y - f(x); }
    const f = c.f; return (x, y) => x - f(y);
  }
  function findPOIs(sel, others, view) {
    others = others || [];
    if (sel.type === 'fy') {
      const sv = { xmin: view.ymin, xmax: view.ymax, ymin: view.xmin, ymax: view.xmax, n: view.n };
      const r = findPOIs(swapCurve(sel), others.map(swapCurve), sv);
      const tmap = { zero: 'yint', yint: 'zero', max: 'right', min: 'left', int: 'int' };
      return r.map((p) => ({ x: p.y, y: p.x, type: tmap[p.type] || p.type, other: p.other }));
    }
    const n = view.n || 600;
    const out = [];
    const xr = view.xmax - view.xmin, yr = view.ymax - view.ymin;
    const scale = Math.max(xr, yr);
    const paramXY = (P) => {
      const X = (t) => { const p = P.fn(t); return p ? p[0] : NaN; };
      const Y = (t) => { const p = P.fn(t); return p ? p[1] : NaN; };
      return [X, Y];
    };
    const tn = Math.max(n, 800);
    if (sel.type === 'P') {
      const XY = paramXY(sel), X = XY[0], Y = XY[1];
      roots1d(Y, sel.t0, sel.t1, tn).forEach((t) => out.push({ x: X(t), y: 0, type: 'zero' }));
      roots1d(X, sel.t0, sel.t1, tn).forEach((t) => out.push({ x: 0, y: Y(t), type: 'yint' }));
      extrema1d(Y, sel.t0, sel.t1, tn).forEach((p) => out.push({ x: X(p.x), y: p.y, type: p.type }));
      others.forEach((o) => {
        if (o.type === 'P') return;
        const G = implicitOf(o);
        roots1d((t) => G(X(t), Y(t)), sel.t0, sel.t1, tn).forEach((t) => out.push({ x: X(t), y: Y(t), type: 'int', other: o.id }));
      });
    }
    // intersections of non-parametric selections with parametric curves
    others.forEach((o) => {
      if (o.type !== 'P' || sel.type === 'P') return;
      const XY = paramXY(o), X = XY[0], Y = XY[1];
      const G = implicitOf(sel);
      roots1d((t) => G(X(t), Y(t)), o.t0, o.t1, tn).forEach((t) => out.push({ x: X(t), y: Y(t), type: 'int', other: o.id }));
    });
    others = others.filter((o) => o.type !== 'P');
    if (sel.type === 'fx') {
      const f = sel.f;
      roots1d(f, view.xmin, view.xmax, n).forEach((x) => out.push({ x: x, y: 0, type: 'zero' }));
      extrema1d(f, view.xmin, view.xmax, n).forEach((p) => out.push(p));
      if (view.xmin <= 0 && view.xmax >= 0) { const y0 = f(0); if (isFinite(y0)) out.push({ x: 0, y: y0, type: 'yint' }); }
      others.forEach((o) => {
        let h;
        if (o.type === 'fx') { const g = o.f; h = (x) => f(x) - g(x); }
        else if (o.type === 'fy') { const g = o.f; h = (x) => x - g(f(x)); }
        else { const F = o.F; h = (x) => F(x, f(x)); }
        roots1d(h, view.xmin, view.xmax, n).forEach((x) => { const y = f(x); if (isFinite(y)) out.push({ x: x, y: y, type: 'int', other: o.id }); });
      });
    } else if (sel.type === 'F') {
      const F = sel.F;
      // top/bottom points (horizontal tangents) found along the traced curve
      if (sel.chains && !sel.noExtrema) {
        const h = 1e-7 * Math.max(1, scale);
        const Fx = (x, y) => (F(x + h, y) - F(x - h, y)) / (2 * h);
        sel.chains.forEach((ch) => {
          const m = ch.length / 2;
          if (m < 3) return;
          let pg = Fx(ch[0], ch[1]);
          for (let i = 1; i < m; i++) {
            const qx = ch[2 * i], qy = ch[2 * i + 1], qg = Fx(qx, qy);
            const px = ch[2 * i - 2], py = ch[2 * i - 1];
            if (isFinite(pg) && isFinite(qg) && (pg < 0) !== (qg < 0)) {
              const t = bisect((u) => Fx(px + (qx - px) * u, py + (qy - py) * u), 0, 1, pg, qg);
              if (isFinite(t)) {
                const nw = newton2(F, Fx, px + (qx - px) * t, py + (qy - py) * t, scale);
                if (nw && Math.hypot(nw[0] - px, nw[1] - py) < scale * 0.02) {
                  const a = Math.max(0, i - 4), b = Math.min(m - 1, i + 3);
                  const ya = ch[2 * a + 1], yb = ch[2 * b + 1];
                  if (nw[1] >= ya && nw[1] >= yb) out.push({ x: nw[0], y: nw[1], type: 'max' });
                  else if (nw[1] <= ya && nw[1] <= yb) out.push({ x: nw[0], y: nw[1], type: 'min' });
                }
              }
            }
            pg = qg;
          }
        });
      }
      roots1d((x) => F(x, 0), view.xmin, view.xmax, n).forEach((x) => out.push({ x: x, y: 0, type: 'zero' }));
      roots1d((y) => F(0, y), view.ymin, view.ymax, n).forEach((y) => out.push({ x: 0, y: y, type: 'yint' }));
      others.forEach((o) => {
        if (o.type === 'fx') {
          const g = o.f;
          roots1d((x) => F(x, g(x)), view.xmin, view.xmax, n).forEach((x) => out.push({ x: x, y: g(x), type: 'int', other: o.id }));
        } else if (o.type === 'fy') {
          const g = o.f;
          roots1d((y) => F(g(y), y), view.ymin, view.ymax, n).forEach((y) => out.push({ x: g(y), y: y, type: 'int', other: o.id }));
        } else if (sel.chains) {
          const Gf = o.F;
          sel.chains.forEach((ch) => {
            let px = ch[0], py = ch[1], pg = Gf(px, py);
            for (let i = 2; i < ch.length; i += 2) {
              const qx = ch[i], qy = ch[i + 1], qg = Gf(qx, qy);
              if (isFinite(pg) && isFinite(qg) && (pg < 0) !== (qg < 0)) {
                const t = bisect((u) => Gf(px + (qx - px) * u, py + (qy - py) * u), 0, 1, pg, qg);
                if (isFinite(t)) {
                  let x = px + (qx - px) * t, y = py + (qy - py) * t;
                  const nw = newton2(F, Gf, x, y, scale);
                  const tol = scale * 0.01;
                  if (nw && Math.abs(nw[0] - x) < tol && Math.abs(nw[1] - y) < tol) { x = nw[0]; y = nw[1]; out.push({ x: x, y: y, type: 'int', other: o.id }); }
                  else if (Math.abs(Gf(x, y)) < 1e-6 * (Math.abs(pg) + Math.abs(qg))) out.push({ x: x, y: y, type: 'int', other: o.id });
                }
              }
              px = qx; py = qy; pg = qg;
            }
          });
        }
      });
    }
    // filter to view and dedupe
    const padx = xr * 0.001, pady = yr * 0.001;
    const res = [];
    const prio = { int: 0, zero: 1, yint: 2, max: 3, min: 4 };
    out.sort((a, b) => (prio[a.type] || 9) - (prio[b.type] || 9));
    out.forEach((p) => {
      if (!isFinite(p.x) || !isFinite(p.y)) return;
      if (p.x < view.xmin - padx || p.x > view.xmax + padx || p.y < view.ymin - pady || p.y > view.ymax + pady) return;
      p.x = cleanNum(p.x, scale); p.y = cleanNum(p.y, scale);
      for (const q of res) if (Math.abs(q.x - p.x) < xr * 2e-4 && Math.abs(q.y - p.y) < yr * 2e-4) return;
      res.push(p);
    });
    return res;
  }
  function cleanNum(v, scale) {
    if (Math.abs(v) < 1e-11 * Math.max(1, scale)) return 0;
    const r = Math.round(v);
    if (Math.abs(v - r) < 1e-9 * Math.max(1, Math.abs(v))) return r;
    return v;
  }

  // ---------------------------------------------------------------- scientific evaluation
  function evaluate(text, opts) {
    opts = opts || {};
    const vars = opts.vars || {};
    const ast = parse(text);
    if (!ast) return { empty: true };
    const getVar = (n) => {
      if (n === 'ans') return opts.ans !== undefined ? opts.ans : 0;
      if (opts.getVar) { try { const v = opts.getVar(n); if (v !== undefined) return v; } catch (e) { /* ignore */ } }
      return Object.prototype.hasOwnProperty.call(vars, n) ? vars[n] : undefined;
    };
    let assign = null, node = ast;
    if (ast.type === 'cmp' && ast.ops.length === 1 && ast.ops[0] === '=' && ast.args[0].type === 'id' && !RESERVED.has(ast.args[0].name)) {
      assign = ast.args[0].name; node = ast.args[1];
    }
    if (node.type === 'cmp' && node.ops.indexOf('~') >= 0) throw err("'~' regressions only work in graphing mode");
    const cx = makeCtx({ locals: NO_LOCALS, getVar: getVar, deg: opts.deg });
    const f = compile(node, cx);
    if (cx.missing.size) throw missingError(cx.missing);
    const v = f({});
    return { value: v, assign: assign, display: formatValue(v), ast: ast };
  }

  G.SatCalcCore = {
    CalcError: CalcError, Pt: Pt, tokenize: tokenize, parse: parse, compile: compile, makeCtx: makeCtx,
    analyze: analyze, evaluate: evaluate, toLatex: toLatex, formatNumber: formatNumber, formatValue: formatValue,
    formatCoord: formatCoord, toFraction: toFraction, fracApprox: fracApprox, findPOIs: findPOIs, roots1d: roots1d,
    extrema1d: extrema1d, codegen: codegen, fitParams: fitParams, factorial: factorial, nCr: nCr, nPr: nPr, implicitOf: implicitOf,
    ALL_LOCALS: ALL_LOCALS, WORDS: WORDS.concat(['for'])
  };
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
