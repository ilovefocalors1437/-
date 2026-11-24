/* SAT Math Practice – UI. Depends on SatEngine, SAT_QUESTIONS, KaTeX, SatCalc (optional). */
(function () {
  'use strict';
  var E = window.SatEngine;
  var BANK = window.SAT_QUESTIONS || [];
  var BY_ID = {};
  BANK.forEach(function (q) { BY_ID[q.id] = q; });

  var K_SESSION = 'satp.session.v1', K_HISTORY = 'satp.history.v1', K_SEEN = 'satp.seen.v1';
  var DOMAIN_NAMES = { algebra: 'Algebra', advanced: 'Advanced Math', psda: 'Problem-Solving and Data Analysis', geometry: 'Geometry and Trigonometry' };
  var LETTERS = ['A', 'B', 'C', 'D'];

  var app = document.getElementById('app');
  var pauseEl = document.getElementById('pause-screen');
  var S = null;            // active session
  var view = 'home';       // home | test | review | inter | results | detail
  var ticker = null, lastTick = 0, saveCounter = 0;
  var calcMounted = false, calcPanel = null;
  var resultCtx = null;    // { rec, idx }

  /* ---------------- storage ---------------- */
  function load(key, dflt) { try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : dflt; } catch (e) { return dflt; } }
  function store(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* storage full or unavailable */ } }
  function saveSession() {
    if (!S) return;
    if (calcMounted && window.SatCalc) { try { S.calc = window.SatCalc.getState(); } catch (e) { /* ignore */ } }
    S.savedAt = Date.now();
    store(K_SESSION, S);
  }
  function clearSession() { try { localStorage.removeItem(K_SESSION); } catch (e) { /* ignore */ } S = null; }

  /* ---------------- helpers ---------------- */
  function h(tag, attrs, kids) {
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (k === 'class') el.className = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'text') el.textContent = v;
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else if (v !== false && v !== null && v !== undefined) el.setAttribute(k, v === true ? '' : v);
    });
    (kids || []).forEach(function (c) { if (c) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return el;
  }
  function math(el) {
    if (window.renderMathInElement) {
      try {
        window.renderMathInElement(el, { delimiters: [
          { left: '\\(', right: '\\)', display: false }, { left: '\\[', right: '\\]', display: true }
        ], throwOnError: false });
      } catch (e) { /* leave raw text */ }
    }
    return el;
  }
  function fmtTime(sec) { sec = Math.max(0, Math.ceil(sec)); var m = Math.floor(sec / 60), s = sec % 60; return m + ':' + (s < 10 ? '0' : '') + s; }
  function fmtDate(ts) { var d = new Date(ts); return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) + ' · ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }); }
  function modIds() { return S.module === 1 ? S.m1 : S.m2; }
  function curQ() { return BY_ID[modIds()[S.idx]]; }
  function answered(id) { var a = S.answers[id]; return a !== undefined && a !== null && a !== ''; }
  var ICON = {
    calc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="5" y="2.5" width="14" height="19" rx="2"/><rect x="8" y="5.5" width="8" height="3.5"/><path d="M8.5 13h.01M12 13h.01M15.5 13h.01M8.5 17h.01M12 17h.01M15.5 17h.01" stroke-width="2.4" stroke-linecap="round"/></svg>',
    ref: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 4h6l-4 8 4 8H5M13 9h6M13 15h6M16 6v6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    pause: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9.5"/><path d="M9.5 8v8M14.5 8v8" stroke-width="2.4" stroke-linecap="round"/></svg>',
    exit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
    flag: '<svg viewBox="0 0 16 18"><path d="M2 1h12v15l-6-4-6 4z"/></svg>'
  };

  /* ---------------- session lifecycle ---------------- */
  function startTest() {
    var seen = load(K_SEEN, {});
    if (Object.keys(seen).length > BANK.length * 0.8) seen = {};
    var seed = (Date.now() % 2147483647) | 0;
    var m1 = E.buildModule(BANK, { kind: 'm1', seen: seen, seed: seed });
    S = { v: 1, id: 't' + Date.now(), startedAt: Date.now(), seed: seed, module: 1, idx: 0, m1: m1, m2: [], path: null,
          answers: {}, flags: {}, strikes: {}, timeLeft: E.MODULE_SECONDS, paused: false, hideTimer: false,
          stage: 'test', strikeMode: false, warned: false, calc: null, calcOpen: false, calcSplit: false };
    if (window.SatCalc && calcMounted) { try { window.SatCalc.reset(); } catch (e) { /* ignore */ } }
    saveSession();
    show('test');
  }

  function finishModule() {
    closePopups();
    if (S.module === 1) {
      var correct = S.m1.filter(function (id) { return E.isCorrect(BY_ID[id], S.answers[id]); }).length;
      S.m1Raw = correct;
      S.path = correct >= E.ROUTE_THRESHOLD ? 'hard' : 'easy';
      var usedIds = {}, usedTpls = {};
      S.m1.forEach(function (id) { usedIds[id] = 1; usedTpls[BY_ID[id].tpl || id] = 1; });
      S.m2 = E.buildModule(BANK, { kind: S.path, usedIds: usedIds, usedTpls: usedTpls, seen: load(K_SEEN, {}), seed: S.seed + 17 });
      S.module = 2; S.idx = 0; S.timeLeft = E.MODULE_SECONDS; S.stage = 'inter'; S.warned = false; S.strikeMode = false;
      saveSession();
      show('inter');
    } else {
      completeTest();
    }
  }

  function completeTest() {
    stopTicker();
    var res = E.score(S, BY_ID);
    var rec = { id: S.id, date: Date.now(), startedAt: S.startedAt, m1: S.m1, m2: S.m2, path: S.path, answers: S.answers,
                scaled: res.scaled, low: res.low, high: res.high, raw: res.raw, total: res.total, count: res.count, domains: res.domains };
    var hist = load(K_HISTORY, []);
    hist.unshift(rec);
    store(K_HISTORY, hist.slice(0, 60));
    var seen = load(K_SEEN, {});
    S.m1.concat(S.m2).forEach(function (id) { seen[id] = 1; });
    store(K_SEEN, seen);
    clearSession();
    resultCtx = { rec: rec };
    show('results');
  }

  /* ---------------- timer / pause ---------------- */
  function startTicker() {
    stopTicker();
    lastTick = Date.now();
    ticker = setInterval(tick, 250);
  }
  function stopTicker() { if (ticker) { clearInterval(ticker); ticker = null; } }
  function tick() {
    if (!S || S.paused || S.stage !== 'test') { lastTick = Date.now(); return; }
    var now = Date.now(), dt = (now - lastTick) / 1000;
    lastTick = now;
    if (dt > 5) dt = 0;                   // the app was suspended: never charge for time away
    S.timeLeft -= dt;
    paintClock();
    if (!S.warned && S.timeLeft <= 300) { S.warned = true; S.hideTimer = false; paintClock(); toast('5 minutes left in this module.'); }
    if (++saveCounter % 8 === 0) saveSession();
    if (S.timeLeft <= 0) { S.timeLeft = 0; toast('Time is up for Module ' + S.module + '.'); finishModule(); }
  }
  function paintClock() {
    var c = document.querySelector('.t-clock');
    if (!c) return;
    c.textContent = S.hideTimer ? '' : fmtTime(S.timeLeft);
    c.className = 't-clock' + (S.timeLeft <= 300 ? ' low' : '');
    var b = document.querySelector('.t-hide');
    if (b) b.textContent = S.hideTimer ? 'Show' : 'Hide';
  }
  function pause() {
    if (!S || S.paused) return;
    S.paused = true;
    saveSession();
    pauseEl.hidden = false;
    document.activeElement && document.activeElement.blur && document.activeElement.blur();
  }
  function unpause() {
    pauseEl.hidden = true;
    if (!S) return;
    S.paused = false;
    lastTick = Date.now();
    saveSession();
  }
  document.getElementById('unpause-btn').addEventListener('click', unpause);
  // Leaving the app (home button, phone call, screen off) pauses automatically and saves.
  document.addEventListener('visibilitychange', function () {
    if (document.hidden && S && (S.stage === 'test' || S.stage === 'inter')) pause();
  });
  window.addEventListener('pagehide', function () { if (S) { S.paused = true; saveSession(); } });

  /* ---------------- rendering ---------------- */
  function show(v) {
    view = v;
    closePopups();
    if (v === 'home') { stopTicker(); renderHome(); }
    else if (v === 'test' || v === 'review') { S.stage = 'test'; S.onReview = v === 'review'; renderTest(); if (!ticker) startTicker(); }
    else if (v === 'inter') renderInter();
    else if (v === 'results') { stopTicker(); renderResults(); }
    else if (v === 'detail') renderDetail();
  }
  function mountPage(nodes) { app.innerHTML = ''; nodes.forEach(function (n) { if (n) app.appendChild(n); }); }

  function renderHome() {
    var hist = load(K_HISTORY, []);
    var counts = { mcq: 0, spr: 0 };
    BANK.forEach(function (q) { counts[q.type]++; });
    var best = hist.reduce(function (m, r) { return Math.max(m, r.scaled); }, 0);
    var saved = load(K_SESSION, null);
    var canResume = saved && saved.m1 && saved.m1.every(function (id) { return BY_ID[id]; }) && (saved.m2 || []).every(function (id) { return BY_ID[id]; });
    var resumeCard = canResume ? h('div', { class: 'card resume' }, [
      h('div', {}, [h('b', { text: 'Test in progress' }),
        h('div', { class: 'muted small', text: 'Module ' + saved.module + ' · ' + fmtTime(saved.timeLeft) + ' left · ' +
          (saved.module === 1 ? saved.m1 : saved.m2).filter(function (id) { var a = saved.answers[id]; return a !== undefined && a !== null && a !== ''; }).length + ' / 22 answered' })]),
      h('div', { class: 'row' }, [
        h('button', { class: 'btn primary', text: 'Resume', onclick: function () {
          S = saved; S.paused = false; lastTick = Date.now();
          if (calcMounted && window.SatCalc) { try { if (S.calc) window.SatCalc.setState(S.calc); else window.SatCalc.reset(); } catch (e) { /* ignore */ } }
          show(S.stage === 'inter' ? 'inter' : 'test');
        } }),
        h('button', { class: 'btn danger', text: 'Discard', onclick: function () {
          popup(h('div', { class: 'sheet' }, [
            h('h3', { text: 'Discard the saved test?' }),
            h('p', { class: 'muted', style: 'text-align:center', text: 'Its answers will be deleted and no score will be recorded.' }),
            h('div', { class: 'row', style: 'justify-content:center' }, [
              h('button', { class: 'btn', text: 'Cancel', onclick: closePopups }),
              h('button', { class: 'btn danger', text: 'Discard', onclick: function () { clearSession(); show('home'); } })
            ])
          ]), true);
        } })
      ])
    ]) : null;
    var wrap = h('div', { class: 'wrap' }, [
      resumeCard,
      h('div', { class: 'hero' }, [
        h('h1', { text: 'SAT Math Practice' }),
        h('p', { text: 'A full adaptive Math section: 2 modules × 22 questions, 35 minutes each. Works offline.' }),
        h('div', { class: 'row' }, [
          h('button', { class: 'btn primary', text: 'Start a new test', onclick: function () {
            if (!BANK.length) { toast('Question bank failed to load.'); return; }
            if (canResume) {
              popup(h('div', { class: 'sheet' }, [
                h('h3', { text: 'Start over?' }),
                h('p', { class: 'muted', style: 'text-align:center', text: 'You have a test in progress. Starting a new one discards it.' }),
                h('div', { class: 'row', style: 'justify-content:center' }, [
                  h('button', { class: 'btn', text: 'Cancel', onclick: closePopups }),
                  h('button', { class: 'btn primary', text: 'Start new test', onclick: startTest })
                ])
              ]), true);
              return;
            }
            startTest();
          } })
        ])
      ]),
      h('div', { class: 'facts' }, [
        h('div', { class: 'fact' }, [h('b', { text: String(BANK.length) }), 'questions in the bank']),
        h('div', { class: 'fact' }, [h('b', { text: String(hist.length) }), 'tests completed']),
        h('div', { class: 'fact' }, [h('b', { text: best ? String(best) : '—' }), 'best score'])
      ]),
      h('h2', { text: 'How it works' }),
      h('div', { class: 'card small' }, [h('div', { html:
        '<b>Adaptive.</b> Module 1 is a mix of easy, medium and hard questions. Get ' + E.ROUTE_THRESHOLD + ' or more right and Module 2 is the harder set, where each question is worth more; otherwise Module 2 is the easier set and the top of the score scale is out of reach.<br><br>' +
        '<b>Pause.</b> The pause button stops the clock, saves everything and blacks out the screen so you cannot keep working on the question. Leaving the app pauses automatically.<br><br>' +
        '<b>Tools.</b> Built-in graphing and scientific calculator, reference sheet, mark for review and answer eliminator.' })]),
      h('h2', { text: 'Past tests' }),
      hist.length ? h('div', {}, hist.map(function (r) {
        return h('button', { class: 'hist', onclick: function () { resultCtx = { rec: r }; show('results'); } }, [
          h('div', { class: 'sc', text: String(r.scaled) }),
          h('div', { class: 'spacer' }, [
            h('div', { text: r.total + ' / ' + r.count + ' correct · ' + (r.path === 'hard' ? 'harder' : 'easier') + ' Module 2' }),
            h('div', { class: 'muted small', text: fmtDate(r.date) })
          ]),
          h('div', { class: 'chev', text: '›' })
        ]);
      })) : h('p', { class: 'muted', text: 'No tests yet. Your scores will appear here.' })
    ]);
    mountPage([h('div', { class: 'page' }, [wrap])]);
  }

  function header() {
    var calcBtn = h('button', { class: 'tool' + (S.calcOpen ? ' on' : ''), html: ICON.calc + 'Calculator', onclick: toggleCalc });
    return h('div', { class: 't-header' }, [
      h('button', { class: 't-exit', 'aria-label': 'Exit test', html: ICON.exit + '<span>Exit</span>', onclick: openExit }),
      h('div', { class: 't-title' }, ['Section 2: Math', h('span', { text: 'Module ' + S.module })]),
      h('div', { class: 't-timer' }, [
        h('div', { class: 't-clock' }),
        h('button', { class: 't-hide', text: 'Hide', onclick: function () { S.hideTimer = !S.hideTimer; paintClock(); saveSession(); } })
      ]),
      h('div', { class: 't-tools' }, [
        calcBtn,
        h('button', { class: 'tool', html: ICON.ref + 'Reference', onclick: openReference }),
        h('button', { class: 'tool', html: ICON.pause + 'Pause', onclick: pause })
      ])
    ]);
  }

  function renderTest() {
    var ids = modIds();
    var body = h('div', { class: 't-body' + (S.calcOpen ? ' calc-open' : '') + (S.calcSplit ? ' split' : '') });
    if (S.calcOpen) body.appendChild(getCalcPanel());
    var pane = h('div', { class: 'q-pane' });
    body.appendChild(pane);
    var footer;
    if (S.onReview) {
      pane.appendChild(reviewPage());
      footer = h('div', { class: 't-footer' }, [
        h('div', { class: 'spacer' }),
        h('button', { class: 'btn', text: 'Back', onclick: function () { S.idx = ids.length - 1; show('test'); } }),
        h('button', { class: 'btn primary', text: S.module === 1 ? 'Next' : 'Submit', onclick: confirmSubmit })
      ]);
    } else {
      pane.appendChild(questionView(curQ(), S.idx));
      footer = h('div', { class: 't-footer' }, [
        h('button', { class: 'nav-pill', text: 'Question ' + (S.idx + 1) + ' of ' + ids.length + ' ⌃', onclick: openNavigator }),
        h('div', { class: 'spacer' }),
        S.idx > 0 ? h('button', { class: 'btn', text: 'Back', onclick: function () { go(S.idx - 1); } }) : null,
        h('button', { class: 'btn primary', text: 'Next', onclick: function () { if (S.idx < ids.length - 1) go(S.idx + 1); else show('review'); } })
      ]);
    }
    mountPage([header(), body, footer]);
    paintClock();
    if (S.paused) pauseEl.hidden = false;
  }
  function go(i) { S.idx = i; saveSession(); show('test'); }

  function questionView(q, idx) {
    var id = q.id;
    var flagBtn = h('button', { class: 'q-flag' + (S.flags[id] ? ' on' : ''), html: ICON.flag + '<span>Mark for Review</span>', onclick: function () {
      if (S.flags[id]) delete S.flags[id]; else S.flags[id] = 1;
      flagBtn.className = 'q-flag' + (S.flags[id] ? ' on' : '');
      saveSession();
    } });
    var bar = h('div', { class: 'q-bar' }, [h('div', { class: 'q-num', text: String(idx + 1) }), flagBtn]);
    var inner = h('div', { class: 'q-inner' }, [bar, math(h('div', { class: 'stem', html: q.stem }))]);
    if (q.type === 'mcq') {
      bar.appendChild(h('button', { class: 'q-abc' + (S.strikeMode ? ' on' : ''), text: 'ABC', title: 'Cross out answer choices', onclick: function () { S.strikeMode = !S.strikeMode; saveSession(); renderTest(); } }));
      var list = h('div', { class: 'choices' });
      var strikes = S.strikes[id] || {};
      q.choices.forEach(function (c, i) {
        var struck = !!strikes[i];
        var btn = h('button', { class: 'choice' + (S.answers[id] === i ? ' sel' : '') + (struck ? ' struck' : ''), onclick: function () {
          if (S.answers[id] === i) delete S.answers[id]; else S.answers[id] = i;
          if (S.strikes[id]) delete S.strikes[id][i];
          saveSession(); renderKeepScroll();
        } }, [h('span', { class: 'let', text: LETTERS[i] }), math(h('span', { class: 'txt', html: c }))]);
        var row = h('div', { class: 'ch-row' }, [btn]);
        if (S.strikeMode) row.appendChild(h('button', { class: 'strike' + (struck ? ' undo' : ''), text: struck ? 'Undo' : LETTERS[i], onclick: function () {
          var st = S.strikes[id] || (S.strikes[id] = {});
          if (st[i]) delete st[i]; else { st[i] = 1; if (S.answers[id] === i) delete S.answers[id]; }
          saveSession(); renderKeepScroll();
        } }));
        list.appendChild(row);
      });
      inner.appendChild(list);
    } else {
      var prev = h('div', { class: 'prev' });
      var input = h('input', { type: 'text', inputmode: 'text', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', maxlength: '6', value: S.answers[id] || '', 'aria-label': 'Your answer' });
      var paint = function () {
        var v = input.value;
        prev.innerHTML = '';
        prev.appendChild(document.createTextNode('Answer Preview: '));
        if (v) {
          var tex = v.replace(/^(-?)(\d+)\/(\d+)$/, '$1\\dfrac{$2}{$3}');
          var sp = h('span');
          try { window.katex.render(tex, sp, { throwOnError: false }); } catch (e) { sp.textContent = v; }
          prev.appendChild(sp);
        }
      };
      input.addEventListener('input', function () {
        var clean = E.sanitizeSpr(input.value);
        if (clean !== input.value) input.value = clean;
        if (clean) S.answers[id] = clean; else delete S.answers[id];
        paint(); saveSession();
      });
      paint();
      inner.appendChild(h('div', { class: 'spr' }, [input, prev,
        h('details', { class: 'spr-help' }, [h('summary', { text: 'Student-produced response directions' }), h('ul', { html:
          '<li>Enter only one answer, even if there are several correct ones.</li>' +
          '<li>Up to 5 characters for a positive answer, 6 (including the negative sign) for a negative answer.</li>' +
          '<li>A fraction that does not fit must be entered as a decimal. A decimal that does not fit must be truncated or rounded at the fourth digit.</li>' +
          '<li>Mixed numbers such as 3½ must be entered as 7/2 or 3.5.</li><li>Do not enter symbols such as %, $ or commas.</li>' })])
      ]));
    }
    return inner;
  }
  function renderKeepScroll() {
    var p = document.querySelector('.q-pane'), y = p ? p.scrollTop : 0;
    renderTest();
    p = document.querySelector('.q-pane'); if (p) p.scrollTop = y;
  }

  function gridCells(onPick, showCur) {
    var ids = modIds();
    return h('div', { class: 'grid' }, ids.map(function (id, i) {
      var cls = 'cell' + (answered(id) ? ' ans' : '') + (S.flags[id] ? ' flag' : '') + (showCur && i === S.idx ? ' cur' : '');
      return h('button', { class: cls, text: String(i + 1), onclick: function () { onPick(i); } });
    }));
  }
  function legend() {
    return h('div', { class: 'legend', html: '<span><i class="cur"></i>📍 Current</span><span><i></i>Unanswered</span><span><i class="flag"></i>For Review</span>' });
  }
  function reviewPage() {
    var ids = modIds(), un = ids.filter(function (id) { return !answered(id); }).length;
    return h('div', { class: 'q-inner review-page' }, [
      h('h1', { text: 'Check Your Work' }),
      h('p', { class: 'muted', html: 'On test day you cannot move on to the next module until time expires. Here, tap <b>' + (S.module === 1 ? 'Next' : 'Submit') + '</b> when you are ready to move on.' + (un ? '<br><b>' + un + ' unanswered.</b>' : '') }),
      h('div', { class: 'box' }, [
        h('b', { text: 'Section 2, Module ' + S.module + ': Math' }), legend(),
        gridCells(function (i) { go(i); }, false)
      ])
    ]);
  }

  /* ---------------- popups ---------------- */
  function closePopups() { Array.prototype.forEach.call(document.querySelectorAll('.scrim'), function (n) { n.remove(); }); }
  function popup(content, center) {
    closePopups();
    var sc = h('div', { class: 'scrim' + (center ? ' center' : ''), onclick: function (e) { if (e.target === sc) sc.remove(); } }, [content]);
    document.body.appendChild(sc);
    return sc;
  }
  function openNavigator() {
    popup(h('div', { class: 'sheet' }, [
      h('button', { class: 'x', text: '×', onclick: closePopups }),
      h('h3', { text: 'Section 2, Module ' + S.module + ': Math' }), legend(),
      gridCells(function (i) { closePopups(); go(i); }, true),
      h('div', { class: 'row', style: 'justify-content:center' }, [h('button', { class: 'btn', text: 'Go to Review Page', onclick: function () { show('review'); } })]),
    ]));
  }
  function openExit() {
    var wasPaused = S.paused;
    S.paused = true;                       // the clock never runs while this dialog is open
    var resume = function () { closePopups(); S.paused = wasPaused; lastTick = Date.now(); };
    var sc = popup(h('div', { class: 'sheet' }, [
      h('h3', { text: 'Exit the test?' }),
      h('p', { class: 'muted', style: 'text-align:center', text: 'Save & exit stops the clock at ' + fmtTime(S.timeLeft) + ' and keeps every answer. Resume it any time from the home screen.' }),
      h('div', { class: 'exit-opts' }, [
        h('button', { class: 'btn primary', text: 'Save & exit', onclick: saveAndExit }),
        h('button', { class: 'btn', text: 'Keep working', onclick: resume }),
        h('button', { class: 'btn danger', text: 'Discard test', onclick: confirmExit })
      ])
    ]), true);
    sc.addEventListener('click', function (e) { if (e.target === sc) resume(); });
  }
  function saveAndExit() {
    S.paused = true;
    saveSession();
    stopTicker();
    S = null;
    show('home');
  }
  function confirmExit() {
    popup(h('div', { class: 'sheet' }, [
      h('h3', { text: 'Discard this test?' }),
      h('p', { class: 'muted', style: 'text-align:center', text: 'Your answers will be deleted and no score will be recorded.' }),
      h('div', { class: 'row', style: 'justify-content:center' }, [
        h('button', { class: 'btn', text: 'Keep working', onclick: closePopups }),
        h('button', { class: 'btn danger', text: 'Discard test', onclick: function () { stopTicker(); clearSession(); show('home'); } })
      ])
    ]), true);
  }
  function confirmSubmit() {
    var un = modIds().filter(function (id) { return !answered(id); }).length;
    popup(h('div', { class: 'sheet' }, [
      h('h3', { text: S.module === 1 ? 'Finish Module 1?' : 'Submit the test?' }),
      h('p', { class: 'muted', style: 'text-align:center', text: (un ? un + ' question' + (un > 1 ? 's are' : ' is') + ' unanswered. ' : '') + 'You will not be able to return to this module. ' + fmtTime(S.timeLeft) + ' left on the clock.' }),
      h('div', { class: 'row', style: 'justify-content:center' }, [
        h('button', { class: 'btn', text: 'Keep working', onclick: closePopups }),
        h('button', { class: 'btn primary', text: S.module === 1 ? 'Go to Module 2' : 'Submit', onclick: finishModule })
      ])
    ]), true);
  }
  var toastTimer = null;
  function toast(msg) {
    var old = document.querySelector('.toast'); if (old) old.remove();
    var t = h('div', { class: 'toast', text: msg });
    document.body.appendChild(t);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.remove(); }, 4200);
  }
  function openReference() {
    var F = [
      ['Circle', 'A = \\pi r^2', 'C = 2\\pi r'], ['Rectangle', 'A = \\ell w'], ['Triangle', 'A = \\tfrac{1}{2}bh'],
      ['Right triangle', 'c^2 = a^2 + b^2'], ['30°–60°–90° triangle', 'x,\\; x\\sqrt{3},\\; 2x'], ['45°–45°–90° triangle', 's,\\; s,\\; s\\sqrt{2}'],
      ['Rectangular prism', 'V = \\ell w h'], ['Cylinder', 'V = \\pi r^2 h'], ['Sphere', 'V = \\tfrac{4}{3}\\pi r^3'],
      ['Cone', 'V = \\tfrac{1}{3}\\pi r^2 h'], ['Pyramid', 'V = \\tfrac{1}{3}\\ell w h']
    ];
    var grid = h('div', { class: 'f' }, F.map(function (f) {
      return h('div', {}, [h('b', { text: f[0] })].concat(f.slice(1).map(function (tex) {
        var d = h('div'); try { window.katex.render(tex, d, { throwOnError: false }); } catch (e) { d.textContent = tex; } return d;
      })));
    }));
    popup(h('div', { class: 'sheet ref' }, [
      h('button', { class: 'x', text: '×', onclick: closePopups }),
      h('h3', { text: 'Reference Sheet' }), grid,
      h('p', { class: 'small', html: 'The number of degrees of arc in a circle is 360.<br>The number of radians of arc in a circle is 2π.<br>The sum of the measures in degrees of the angles of a triangle is 180.' })
    ]), true);
  }

  /* ---------------- calculator ---------------- */
  function getCalcPanel() {
    if (!calcPanel) {
      var host = h('div', { class: 'calc-host' });
      calcPanel = h('div', { class: 'calc-panel' }, [
        h('div', { class: 'calc-bar' }, [
          h('span', { text: 'Calculator' }), h('div', { class: 'spacer' }),
          h('button', { class: 'calc-split-btn', text: 'Show question', onclick: function () { S.calcSplit = !S.calcSplit; saveSession(); renderTest(); } }),
          h('button', { text: 'Close', onclick: toggleCalc })
        ]), host
      ]);
      calcPanel._host = host;
    }
    var sb = calcPanel.querySelector('.calc-split-btn');
    if (sb) sb.textContent = S.calcSplit ? 'Hide question' : 'Show question';
    if (!calcMounted && window.SatCalc) {
      // mount after the panel is in the document so the calculator can measure itself
      setTimeout(function () {
        if (calcMounted || !calcPanel.isConnected) return;
        try {
          window.SatCalc.mount(calcPanel._host);
          calcMounted = true;
          if (S && S.calc) window.SatCalc.setState(S.calc);
          window.SatCalc.onChange = function () { if (S) saveSession(); };
        } catch (e) { calcPanel._host.textContent = 'Calculator failed to load: ' + e.message; }
      }, 0);
    } else if (!window.SatCalc) {
      calcPanel._host.textContent = 'Calculator is not available.';
    }
    return calcPanel;
  }
  function toggleCalc() { S.calcOpen = !S.calcOpen; saveSession(); renderKeepScroll(); }

  /* ---------------- between modules ---------------- */
  function renderInter() {
    stopTicker();
    var n = 5;
    var label = h('p', { class: 'muted' });
    var paint = function () { label.textContent = 'Module 2 starts in ' + n + '…'; };
    paint();
    mountPage([h('div', { class: 'inter' }, [
      h('div', { class: 'spinner' }), h('h1', { text: 'This Module Is Over' }),
      h('p', { text: 'All your work has been saved.' }), label,
      h('button', { class: 'btn primary', text: 'Start Module 2 now', onclick: begin })
    ])]);
    var iv = setInterval(function () {
      if (view !== 'inter') { clearInterval(iv); return; }
      if (S.paused) return;
      n--; paint();
      if (n <= 0) begin();
    }, 1000);
    function begin() { clearInterval(iv); if (view !== 'inter') return; S.stage = 'test'; saveSession(); show('test'); }
    if (S.paused) pauseEl.hidden = false;
  }

  /* ---------------- results ---------------- */
  function renderResults() {
    var r = resultCtx.rec;
    var all = r.m1.concat(r.m2);
    var cells = function (ids, off) {
      return h('div', { class: 'grid' }, ids.map(function (id, i) {
        var q = BY_ID[id], a = r.answers[id];
        var cls = !q ? 'skip' : (a === undefined || a === null || a === '') ? 'skip' : E.isCorrect(q, a) ? 'ok' : 'bad';
        return h('button', { class: 'cell ' + cls, text: String(i + 1), onclick: function () { resultCtx.idx = off + i; show('detail'); } });
      }));
    };
    var doms = Object.keys(DOMAIN_NAMES).filter(function (d) { return r.domains[d]; }).map(function (d) {
      var x = r.domains[d], pct = Math.round(100 * x.correct / x.total);
      return h('div', { class: 'dom' }, [
        h('div', { class: 'row' }, [h('span', { text: DOMAIN_NAMES[d] }), h('b', { text: x.correct + ' / ' + x.total })]),
        h('div', { class: 'bar' }, [h('i', { style: 'width:' + pct + '%' })])
      ]);
    });
    var wrap = h('div', { class: 'wrap' }, [
      h('div', { class: 'row' }, [h('button', { class: 'btn', text: '‹ Home', onclick: function () { show('home'); } })]),
      h('div', { class: 'card', style: 'text-align:center' }, [
        h('div', { class: 'muted', text: 'Your Math score' }),
        h('div', { class: 'score-big', text: String(r.scaled) }),
        h('div', { class: 'muted small', text: 'Score range ' + r.low + '–' + r.high + ' · scale 200–800' }),
        h('p', { html: '<b>' + r.total + ' of ' + r.count + '</b> correct · Module 1: ' + r.raw.m1 + '/' + r.m1.length + ' · Module 2: ' + r.raw.m2 + '/' + r.m2.length })
      ]),
      h('div', { class: 'card small' }, [h('div', { html: r.path === 'hard'
        ? '<b>You were routed to the harder Module 2.</b> Its questions carry more weight, which is what makes scores above about 600 reachable.'
        : '<b>You were routed to the easier Module 2</b> (fewer than ' + E.ROUTE_THRESHOLD + ' correct in Module 1). Its questions carry less weight, so the top of the scale was out of reach on this attempt.' }),
        h('div', { class: 'muted', style: 'margin-top:8px', text: 'The score is an estimate from an item-response model similar in spirit to the real test; it is not an official College Board score.' })]),
      h('h2', { text: 'By content domain' }), h('div', { class: 'card' }, doms),
      h('h2', { text: 'Module 1' }), cells(r.m1, 0),
      h('h2', { text: 'Module 2 (' + (r.path === 'hard' ? 'harder' : 'easier') + ')' }), cells(r.m2, r.m1.length),
      h('p', { class: 'muted small', text: 'Green = correct, red = incorrect, grey = omitted. Tap a number to see the question and explanation.' }),
      all.length ? null : h('p', { text: 'No questions recorded.' })
    ]);
    mountPage([h('div', { class: 'page' }, [wrap])]);
  }

  function renderDetail() {
    var r = resultCtx.rec, all = r.m1.concat(r.m2), i = resultCtx.idx;
    var id = all[i], q = BY_ID[id], a = r.answers[id];
    var modNo = i < r.m1.length ? 1 : 2, num = modNo === 1 ? i + 1 : i - r.m1.length + 1;
    var nav = h('div', { class: 't-footer' }, [
      h('button', { class: 'btn', text: 'Results', onclick: function () { show('results'); } }),
      h('div', { class: 'spacer' }),
      i > 0 ? h('button', { class: 'btn', text: 'Back', onclick: function () { resultCtx.idx--; show('detail'); } }) : null,
      i < all.length - 1 ? h('button', { class: 'btn primary', text: 'Next', onclick: function () { resultCtx.idx++; show('detail'); } }) : null
    ]);
    var inner;
    if (!q) inner = h('div', { class: 'q-inner', text: 'This question is no longer in the bank.' });
    else {
      var omitted = a === undefined || a === null || a === '';
      var ok = E.isCorrect(q, a);
      inner = h('div', { class: 'q-inner rv' }, [
        h('div', { style: 'margin-bottom:12px' }, [
          h('span', { class: 'tag ' + (ok ? 'ok' : 'bad'), text: ok ? 'Correct' : omitted ? 'Omitted' : 'Incorrect' }),
          h('span', { class: 'tag', text: 'Module ' + modNo + ' · Q' + num }),
          h('span', { class: 'tag', text: ['', 'Easy', 'Medium', 'Hard'][q.difficulty] }),
          h('span', { class: 'tag', text: q.skill || DOMAIN_NAMES[q.domain] })
        ]),
        math(h('div', { class: 'stem', html: q.stem }))
      ]);
      if (q.type === 'mcq') {
        inner.appendChild(h('div', { class: 'choices' }, q.choices.map(function (c, k) {
          var cls = 'choice' + (k === q.answer ? ' right' : (a === k ? ' wrong' : ''));
          return h('div', { class: cls }, [h('span', { class: 'let', text: LETTERS[k] }), math(h('span', { class: 'txt', html: c }))]);
        })));
        inner.appendChild(h('p', { class: 'small muted', text: 'Your answer: ' + (omitted ? '—' : LETTERS[a]) + ' · Correct answer: ' + LETTERS[q.answer] }));
      } else {
        var keys = Array.isArray(q.answer) ? q.answer : [q.answer];
        inner.appendChild(h('p', { html: 'Your answer: <b>' + (omitted ? '—' : String(a).replace(/</g, '&lt;')) + '</b><br>Correct answer: <b>' + keys.join(' or ') + '</b>' }));
      }
      if (q.explanation) inner.appendChild(math(h('div', { class: 'expl', html: '<b>Explanation</b><br>' + q.explanation })));
    }
    mountPage([
      h('div', { class: 't-header' }, [h('div', { class: 't-title' }, ['Review', h('span', { text: 'Score ' + r.scaled })])]),
      h('div', { class: 't-body' }, [h('div', { class: 'q-pane' }, [inner])]), nav
    ]);
  }

  /* ---------------- Android back button (called from the native shell) ---------------- */
  window.onAndroidBack = function () {
    if (!pauseEl.hidden) return true;                       // stay paused
    if (document.querySelector('.scrim')) { closePopups(); return true; }
    if (view === 'detail') { show('results'); return true; }
    if (view === 'results') { show('home'); return true; }
    if (view === 'test' || view === 'review' || view === 'inter') {
      if (S.calcOpen) { toggleCalc(); return true; }
      if (view === 'inter') { pause(); return true; }
      openExit(); return true;
    }
    return false;                                           // home: let the app close
  };

  /* ---------------- boot ---------------- */
  function boot() {
    var saved = load(K_SESSION, null);
    if (saved && saved.m1 && saved.m1.every(function (id) { return BY_ID[id]; }) && (saved.m2 || []).every(function (id) { return BY_ID[id]; })) {
      S = saved;
      S.paused = true;                    // a restored test always comes back paused
      show(S.stage === 'inter' ? 'inter' : 'test');
      pauseEl.hidden = false;
    } else {
      show('home');
    }
  }
  window.__sat = { get session() { return S; }, finishModule: finishModule, pause: pause, unpause: unpause };
  boot();
})();
