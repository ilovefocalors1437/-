/* SAT Math Practice – test engine: assembly, adaptive routing, scoring, answer checking.
   Pure logic, no DOM. Works in the browser (window.SatEngine) and in Node (module.exports). */
(function (root) {
  'use strict';

  var MODULE_SIZE = 22;
  var MODULE_SECONDS = 35 * 60;
  var ROUTE_THRESHOLD = 14;            // Module 1 correct answers needed for the harder Module 2
  var DOMAIN_COUNTS = { algebra: 7, advanced: 7, psda: 4, geometry: 4 };
  var DIFF_MIX = {
    m1:   { 1: 7,  2: 9, 3: 6 },
    hard: { 1: 2,  2: 7, 3: 13 },
    easy: { 1: 12, 2: 8, 3: 2 }
  };

  /* ---------- random ---------- */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffle(arr, rnd) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /* ---------- module assembly ---------- */
  // bank: array of questions. opts: { kind: 'm1'|'hard'|'easy', usedIds:{}, usedTpls:{}, seen:{}, seed }
  function buildModule(bank, opts) {
    var best = null, bestCost = Infinity;
    for (var attempt = 0; attempt < 24; attempt++) {
      var rnd = mulberry32((opts.seed || 1) * 7919 + attempt * 104729);
      var cand = assembleOnce(bank, opts, rnd);
      var spr = cand.filter(function (q) { return q.type === 'spr'; }).length;
      var cost = Math.abs(spr - 6) + cand.cost;
      if (cost < bestCost) { best = cand; bestCost = cost; }
      if (cost === 0) break;
    }
    return best.map(function (q) { return q.id; });
  }

  function assembleOnce(bank, opts, rnd) {
    var mix = DIFF_MIX[opts.kind];
    var domains = [], diffs = [];
    Object.keys(DOMAIN_COUNTS).forEach(function (d) { for (var i = 0; i < DOMAIN_COUNTS[d]; i++) domains.push(d); });
    [1, 2, 3].forEach(function (k) { for (var i = 0; i < mix[k]; i++) diffs.push(k); });
    domains = shuffle(domains, rnd); diffs = shuffle(diffs, rnd);
    var usedIds = Object.assign({}, opts.usedIds || {});
    var usedTpls = Object.assign({}, opts.usedTpls || {});
    var seen = opts.seen || {};
    var picked = [], cost = 0;
    var pool = shuffle(bank, rnd);
    for (var s = 0; s < MODULE_SIZE; s++) {
      var dom = domains[s], dif = diffs[s];
      var q = pick(pool, function (x) { return x.domain === dom && x.difficulty === dif; }) ||
              (cost += 1, pick(pool, function (x) { return x.domain === dom && Math.abs(x.difficulty - dif) === 1; })) ||
              (cost += 1, pick(pool, function (x) { return x.difficulty === dif; })) ||
              (cost += 2, pick(pool, function () { return true; }));
      if (!q) break;
      usedIds[q.id] = 1; usedTpls[q.tpl || q.id] = 1;
      picked.push(q);
    }
    function pick(list, pred) {
      var fallback = null;
      for (var i = 0; i < list.length; i++) {
        var x = list[i];
        if (usedIds[x.id] || usedTpls[x.tpl || x.id] || !pred(x)) continue;
        if (!seen[x.id]) return x;          // prefer questions never shown before
        if (!fallback) fallback = x;
      }
      return fallback;
    }
    // order roughly easy -> hard like a real module
    var keyed = picked.map(function (q) { return { q: q, k: q.difficulty + rnd() * 1.15 }; });
    keyed.sort(function (a, b) { return a.k - b.k; });
    var out = keyed.map(function (o) { return o.q; });
    out.cost = cost;
    return out;
  }

  /* ---------- answer checking ---------- */
  function parseNum(s) {
    if (typeof s !== 'string') return NaN;
    s = s.trim().replace(/−/g, '-');
    var m;
    if ((m = /^(-?)(\d+)\/(\d+)$/.exec(s))) {
      var den = parseInt(m[3], 10);
      if (!den) return NaN;
      return (m[1] ? -1 : 1) * parseInt(m[2], 10) / den;
    }
    if (/^-?(\d+\.?\d*|\.\d+)$/.test(s)) return parseFloat(s);
    return NaN;
  }
  // SAT grid-in rules: up to 5 characters (6 with a leading minus). Decimals that do not fit must be
  // truncated or rounded at the last available digit; shorter approximations are not accepted.
  function sprMatches(input, key) {
    var v = parseNum(input), t = parseNum(key);
    if (isNaN(v) || isNaN(t)) return false;
    if (Math.abs(v - t) <= 1e-9 * Math.max(1, Math.abs(t))) return true;
    var s = input.trim().replace(/−/g, '-');
    if (s.indexOf('/') >= 0 || s.indexOf('.') < 0) return false;
    var neg = s[0] === '-';
    var body = neg ? s.slice(1) : s;
    if (body.length < 5) return false;                 // must fill the grid before approximating
    if ((t < 0) !== neg && t !== 0) return false;
    var decimals = body.length - body.indexOf('.') - 1;
    var p = Math.pow(10, decimals), at = Math.abs(t), av = Math.abs(v);
    var trunc = Math.floor(at * p + 1e-9) / p, rnd = Math.round(at * p) / p;
    return Math.abs(av - trunc) < 1e-9 || Math.abs(av - rnd) < 1e-9;
  }
  function isCorrect(q, resp) {
    if (resp === null || resp === undefined || resp === '') return false;
    if (q.type === 'mcq') return resp === q.answer;
    var keys = Array.isArray(q.answer) ? q.answer : [q.answer];
    for (var i = 0; i < keys.length; i++) if (sprMatches(String(resp), String(keys[i]))) return true;
    return false;
  }
  function sanitizeSpr(s) {
    s = String(s || '').replace(/−/g, '-').replace(/[^0-9.\/-]/g, '');
    var neg = s[0] === '-';
    s = s.replace(/-/g, '');
    var out = '', dot = false, slash = false;
    for (var i = 0; i < s.length; i++) {
      var c = s[i];
      if (c === '.') { if (dot || slash) continue; dot = true; }
      if (c === '/') { if (slash || dot || !out) continue; slash = true; }
      out += c;
    }
    out = out.slice(0, 5);
    return (neg ? '-' : '') + out;
  }

  /* ---------- scoring ----------
     Item-response-theory scoring, like the real digital SAT: each question has a difficulty (b),
     discrimination (a) and guessing (c) parameter. The score is the ability estimate (EAP) that best
     explains the whole answer pattern, so a correct answer on a hard question is worth more than on an
     easy one, and the easier Module 2 cannot reach the top of the scale. */
  var B = { 1: -1.15, 2: 0.05, 3: 1.2 };
  var A = { 1: 1.0, 2: 1.15, 3: 1.3 };
  function theta(items) {            // items: [{difficulty, type, correct}]
    var num = 0, den = 0;
    for (var t = -4; t <= 4.0001; t += 0.05) {
      var logL = -0.5 * (t / 1.6) * (t / 1.6);          // wide normal prior
      for (var i = 0; i < items.length; i++) {
        var it = items[i], c = it.type === 'mcq' ? 0.2 : 0;
        var p = c + (1 - c) / (1 + Math.exp(-1.7 * A[it.difficulty] * (t - B[it.difficulty])));
        logL += Math.log(it.correct ? p : 1 - p);
      }
      var w = Math.exp(logL);
      num += t * w; den += w;
    }
    return num / den;
  }
  function scaleScore(th) {
    var s = 500 + th * SCALE_SLOPE + SCALE_SHIFT;
    return Math.max(200, Math.min(800, Math.round(s / 10) * 10));
  }
  var SCALE_SLOPE = 130, SCALE_SHIFT = -20;

  // session: { m1:[ids], m2:[ids], answers:{id:resp}, path }, byId: id -> question
  function score(session, byId) {
    var items = [], raw = { m1: 0, m2: 0 }, dom = {};
    ['m1', 'm2'].forEach(function (m) {
      (session[m] || []).forEach(function (id) {
        var q = byId[id]; if (!q) return;
        var ok = isCorrect(q, session.answers[id]);
        if (ok) raw[m]++;
        var d = dom[q.domain] || (dom[q.domain] = { correct: 0, total: 0 });
        d.total++; if (ok) d.correct++;
        items.push({ difficulty: q.difficulty, type: q.type, correct: ok });
      });
    });
    var th = theta(items);
    var sc = scaleScore(th);
    var total = raw.m1 + raw.m2;
    if (total === 0) sc = 200;
    if (total === items.length && session.path === 'hard') sc = 800;
    else if (sc > 790) sc = 790;
    return { scaled: sc, theta: th, raw: raw, total: total, count: items.length, domains: dom,
             low: Math.max(200, sc - 30), high: Math.min(800, sc + 30) };
  }

  var api = {
    MODULE_SIZE: MODULE_SIZE, MODULE_SECONDS: MODULE_SECONDS, ROUTE_THRESHOLD: ROUTE_THRESHOLD,
    DIFF_MIX: DIFF_MIX, DOMAIN_COUNTS: DOMAIN_COUNTS,
    buildModule: buildModule, isCorrect: isCorrect, sprMatches: sprMatches, sanitizeSpr: sanitizeSpr,
    parseNum: parseNum, score: score, theta: theta, scaleScore: scaleScore, mulberry32: mulberry32,
    _setScale: function (a, b) { SCALE_SLOPE = a; SCALE_SHIFT = b; }
  };
  root.SatEngine = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
