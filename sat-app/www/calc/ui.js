/*
 * Graphing Calculator — user interface.
 * Mode switch, expression list (rows, tables, sliders, regression results),
 * graph pane, custom math keypad, scientific calculator, settings.
 * Depends on SatCalcCore (parser.js) and SatCalcGraph (graph.js); KaTeX optional.
 * Exposes window.SatCalcApp (constructor) used by calc.js.
 */
(function (G) {
  'use strict';
  const Core = G.SatCalcCore, Graph = G.SatCalcGraph;
  const PALETTE = ['#c8433e', '#2d6fbe', '#2e8b45', '#7b48b5', '#e07b1a', '#1f2328'];
  const GRAPHABLE = { explicit: 1, explicitx: 1, implicit: 1, ineq: 1, points: 1, parametric: 1, polar: 1, regression: 1, table: 1 };

  // ------------------------------------------------------------ small helpers
  function h(tag, cls, attrs, kids) {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (attrs) for (const k in attrs) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'text') el.textContent = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    if (kids) kids.forEach((c) => c && el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c));
    return el;
  }
  function texHTML(latex) {
    if (G.katex && latex != null) {
      try { return G.katex.renderToString(latex, { throwOnError: false, displayMode: false, strict: 'ignore' }); } catch (e) { /* fall through */ }
    }
    return null;
  }
  function setTex(el, latex, plain) {
    const key = latex != null ? 'L' + latex : 'P' + plain;
    if (el._tex === key) return;
    el._tex = key;
    const html = latex != null ? texHTML(latex) : null;
    if (html) el.innerHTML = html; else el.textContent = plain || '';
  }
  function mathInput(cls, value, placeholder) {
    const el = h('input', cls, { type: 'text', inputmode: 'none', autocomplete: 'off', autocorrect: 'off', autocapitalize: 'off', spellcheck: 'false', placeholder: placeholder || null });
    el.value = value || '';
    return el;
  }
  const isTouch = () => ('ontouchstart' in G) || (G.navigator && G.navigator.maxTouchPoints > 0);
  const clampNum = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);
  function fmtSlider(v, step) {
    if (!isFinite(v)) return '0';
    let d = 0;
    if (step > 0 && step < 1) d = Math.min(10, Math.ceil(-Math.log10(step) - 1e-9));
    else if (!(step > 0)) d = 4;
    let s = v.toFixed(d);
    if (s.indexOf('.') >= 0) s = s.replace(/0+$/, '').replace(/\.$/, '');
    if (s === '-0') s = '0';
    return s;
  }
  function evalNum(text, getVar, deg) {
    try {
      const r = Core.evaluate(String(text), { getVar: getVar, deg: deg });
      return typeof r.value === 'number' ? r.value : NaN;
    } catch (e) { return NaN; }
  }

  // ------------------------------------------------------------ keypad layouts
  function K(l, ins, back, extra) { return Object.assign({ l: l, i: ins == null ? l : ins, b: back || 0 }, extra || {}); }
  function A(l, act, extra) { return Object.assign({ l: l, a: act }, extra || {}); }
  const FNK = (name, label) => K(label || name, name + '()', 1, { cls: 'fn' });
  const BOTTOM = (abcLabel) => [A(abcLabel, 'tab-abc', { w: 1.5, cls: 'alt' }), A('f(x)', 'tab-fn', { w: 1.5, cls: 'alt' }), A('←', 'left', { cls: 'alt', aria: 'Cursor left' }), A('→', 'right', { cls: 'alt', aria: 'Cursor right' }), A('⌫', 'bs', { w: 1.5, cls: 'alt', aria: 'Backspace' }), A('↵', 'enter', { w: 1.5, cls: 'go', aria: 'Enter' })];
  const GRAPH_PANELS = {
    main: [
      [K('x', 'x', 0, { cls: 'var' }), K('y', 'y', 0, { cls: 'var' }), K('a²', '^2', 0, { html: 'a<sup>2</sup>' }), K('aᵇ', '^', 0, { html: 'a<sup>b</sup>' }), K('7'), K('8'), K('9'), K('÷', '/', 0, { cls: 'op' })],
      [K('('), K(')'), K('<'), K('>'), K('4'), K('5'), K('6'), K('×', '*', 0, { cls: 'op' })],
      [K('|a|', '||', 1), K(','), K('≤'), K('≥'), K('1'), K('2'), K('3'), K('−', '-', 0, { cls: 'op' })],
      [K('√', '√()', 1), K('π'), K('e'), K('a₁', '_', 0, { html: 'a<sub>1</sub>' }), K('0'), K('.'), K('='), K('+', '+', 0, { cls: 'op' })],
      BOTTOM('ABC')
    ],
    fn: [
      [FNK('sin'), FNK('cos'), FNK('tan'), FNK('csc'), FNK('sec'), FNK('cot')],
      [K('sin⁻¹', 'arcsin()', 1, { cls: 'fn' }), K('cos⁻¹', 'arccos()', 1, { cls: 'fn' }), K('tan⁻¹', 'arctan()', 1, { cls: 'fn' }), FNK('ln'), FNK('log'), K('logₐ', 'log_()()', 3, { cls: 'fn' })],
      [K('eˣ', 'e^()', 1, { cls: 'fn' }), K('n!', '!'), FNK('nCr'), FNK('nPr'), K('mod', 'mod(,)', 2, { cls: 'fn' }), K('∛', 'cbrt()', 1)],
      [K('ⁿ√', 'nthroot(,)', 2, { cls: 'fn' }), FNK('floor'), FNK('ceil'), FNK('round'), FNK('sign'), FNK('abs')],
      [K('{ }', '{}', 1), K('[ ]', '[]', 1), K(':'), K('~'), K('…', '...'), K('θ')],
      [FNK('mean'), FNK('median'), FNK('stdev'), FNK('stdevp'), FNK('var'), FNK('total')],
      [FNK('min'), FNK('max'), FNK('length'), FNK('sort'), K('quartile', 'quartile(,)', 2, { cls: 'fn' }), K('gcd', 'gcd(,)', 2, { cls: 'fn' })],
      [K('lcm', 'lcm(,)', 2, { cls: 'fn' }), FNK('exp'), K('t'), K("f′", "'"), K('°'), K('%')],
      BOTTOM('ABC')
    ],
    abc: [
      'abcdefgh'.split('').map((c) => K(c, c, 0, { cls: 'var' })),
      'ijklmnop'.split('').map((c) => K(c, c, 0, { cls: 'var' })),
      'qrstuvwx'.split('').map((c) => K(c, c, 0, { cls: 'var' })),
      [K('y', 'y', 0, { cls: 'var' }), K('z', 'z', 0, { cls: 'var' }), K('θ'), K('a₁', '_', 0, { html: 'a<sub>1</sub>' }), K("'"), K('!'), A('⇧', 'shift', { cls: 'alt' }), K('~')],
      BOTTOM('123')
    ]
  };
  const SCI_ROWS = [
    [FNK('sin'), FNK('cos'), FNK('tan'), K('('), K(')'), A('⌫', 'bs', { cls: 'alt', aria: 'Backspace' })],
    [K('sin⁻¹', 'arcsin()', 1, { cls: 'fn' }), K('cos⁻¹', 'arccos()', 1, { cls: 'fn' }), K('tan⁻¹', 'arctan()', 1, { cls: 'fn' }), K('x²', '^2', 0, { html: 'x<sup>2</sup>' }), K('xʸ', '^', 0, { html: 'x<sup>y</sup>' }), A('AC', 'clear', { cls: 'warn' })],
    [FNK('ln'), FNK('log'), K('7'), K('8'), K('9'), K('÷', '/', 0, { cls: 'op' })],
    [K('eˣ', 'e^()', 1, { html: 'e<sup>x</sup>', cls: 'fn' }), K('10ˣ', '10^()', 1, { html: '10<sup>x</sup>', cls: 'fn' }), K('4'), K('5'), K('6'), K('×', '*', 0, { cls: 'op' })],
    [K('√', '√()', 1), K('ⁿ√', 'nthroot(,)', 2, { html: '<sup>n</sup>√' }), K('1'), K('2'), K('3'), K('−', '-', 0, { cls: 'op' })],
    [K('π'), K('e'), K('0'), K('.'), K('ans', 'ans', 0, { cls: 'fn' }), K('+', '+', 0, { cls: 'op' })],
    [K('|x|', 'abs()', 1), K('n!', '!'), K('nCr', 'nCr(,)', 2, { cls: 'fn' }), K('nPr', 'nPr(,)', 2, { cls: 'fn' }), K('EE', 'E'), K('%')],
    [A('DEG', 'angle', { cls: 'alt angle' }), A('←', 'left', { cls: 'alt', aria: 'Cursor left' }), A('→', 'right', { cls: 'alt', aria: 'Cursor right' }), A('a/b', 'frac', { cls: 'alt', aria: 'Toggle fraction' }), K(','), A('=', 'enter', { cls: 'go', aria: 'Equals' })]
  ];

  // ------------------------------------------------------------ App
  function App() {
    this.uid = 1;
    this.colorIx = 0;
    this.results = new Map();
    this.root = null;
    this.rows = new Map();
    this.panel = 'main';
    this.shift = false;
    this.keypadOpen = false;
    this.activeField = null;
    this.state = this.defaultState();
    this.ensureTrailing();
  }
  const P = App.prototype;

  P.defaultState = function () {
    return { mode: 'graph', angle: 'rad', grid: true, nums: true, items: [], viewport: null, split: 0.52, sci: { history: [], entry: '', vars: {}, ans: 0 } };
  };
  P.nextColor = function () { const c = PALETTE[this.colorIx % PALETTE.length]; this.colorIx++; return c; };
  P.newExpr = function (text, extra) { return Object.assign({ id: this.uid++, type: 'expr', text: text || '', color: this.nextColor(), hidden: false }, extra || {}); };
  P.newTable = function () {
    let n = 1;
    const used = new Set();
    this.state.items.forEach((it) => { if (it.type === 'table') it.columns.forEach((c) => used.add(String(c.header).trim())); else used.add(String(it.text).split(/[=~<>]/)[0].trim()); });
    while (used.has('x_' + n) || used.has('y_' + n)) n++;
    const color = this.nextColor();
    return { id: this.uid++, type: 'table', color: color, hidden: false, columns: [
      { header: 'x_' + n, values: ['', '', ''], color: color },
      { header: 'y_' + n, values: ['', '', ''], color: color }
    ] };
  };
  P.ensureTrailing = function () {
    const items = this.state.items;
    const last = items[items.length - 1];
    if (!last || last.type !== 'expr' || String(last.text).trim() !== '') {
      const it = this.newExpr('');
      items.push(it);
      return it;
    }
    return null;
  };
  P.itemById = function (id) { return this.state.items.find((it) => it.id === id); };
  P.deg = function () { return this.state.angle === 'deg'; };

  // ------------------------------------------------------------ state API
  P.getState = function () {
    const s = this.state;
    const items = s.items.filter((it, i) => !(it.type === 'expr' && !String(it.text).trim() && i === s.items.length - 1)).map((it) => {
      if (it.type === 'table') {
        return { type: 'table', color: it.color, hidden: !!it.hidden, columns: it.columns.map((c) => ({ header: c.header, values: c.values.slice(), color: c.color, hidden: !!c.hidden })) };
      }
      const o = { type: 'expr', text: it.text, color: it.color, hidden: !!it.hidden };
      if (it.slider) o.slider = { min: it.slider.min, max: it.slider.max, step: it.slider.step };
      if (it.domain) o.domain = { min: it.domain.min, max: it.domain.max };
      return o;
    });
    const vp = this.graph ? this.graph.getView() : s.viewport;
    return {
      version: 1,
      mode: s.mode,
      angle: s.angle,
      grid: s.grid,
      nums: s.nums,
      items: items,
      viewport: vp ? { cx: vp.cx, cy: vp.cy, ppu: vp.ppu } : null,
      split: s.split,
      sci: {
        history: s.sci.history.slice(-200).map((e) => ({ expr: e.expr, display: e.display, value: typeof e.value === 'number' ? e.value : null, frac: !!e.frac })),
        entry: s.sci.entry,
        vars: Object.assign({}, s.sci.vars),
        ans: typeof s.sci.ans === 'number' ? s.sci.ans : 0
      }
    };
  };
  P.setState = function (raw) {
    const st = this.defaultState();
    this.colorIx = 0;
    const isObj = (o) => o && typeof o === 'object' && !Array.isArray(o);
    const str = (v, max) => (typeof v === 'string' ? v : (typeof v === 'number' && isFinite(v) ? String(v) : '')).slice(0, max || 2000);
    const color = (c) => (typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c) ? c : this.nextColor());
    if (isObj(raw)) {
      if (raw.mode === 'sci' || raw.mode === 'graph') st.mode = raw.mode;
      if (raw.angle === 'deg' || raw.angle === 'rad') st.angle = raw.angle;
      if (typeof raw.grid === 'boolean') st.grid = raw.grid;
      if (typeof raw.nums === 'boolean') st.nums = raw.nums;
      if (typeof raw.split === 'number' && raw.split > 0.15 && raw.split < 0.85) st.split = raw.split;
      if (Array.isArray(raw.items)) {
        raw.items.slice(0, 200).forEach((it) => {
          if (!isObj(it)) return;
          if (it.type === 'table') {
            const cols = Array.isArray(it.columns) ? it.columns.slice(0, 12).filter(isObj) : [];
            if (!cols.length) return;
            const tc = color(it.color);
            st.items.push({ id: this.uid++, type: 'table', color: tc, hidden: !!it.hidden, columns: cols.map((c) => ({
              header: str(c.header, 200), values: (Array.isArray(c.values) ? c.values.slice(0, 1000) : []).map((v) => str(v, 100)),
              color: typeof c.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(c.color) ? c.color : tc, hidden: !!c.hidden
            })) });
          } else {
            const e = { id: this.uid++, type: 'expr', text: str(it.text), color: color(it.color), hidden: !!it.hidden };
            if (isObj(it.slider)) {
              const mn = +it.slider.min, mx = +it.slider.max, sp = +it.slider.step;
              if (isFinite(mn) && isFinite(mx) && mn < mx) e.slider = { min: mn, max: mx, step: isFinite(sp) && sp >= 0 ? sp : 0.1 };
            }
            if (isObj(it.domain)) e.domain = { min: str(it.domain.min, 100) || '0', max: str(it.domain.max, 100) || '1' };
            st.items.push(e);
          }
        });
      }
      const vp = raw.viewport;
      if (isObj(vp) && isFinite(vp.cx) && isFinite(vp.cy) && isFinite(vp.ppu) && vp.ppu > 0) st.viewport = { cx: +vp.cx, cy: +vp.cy, ppu: +vp.ppu };
      if (isObj(raw.sci)) {
        const sc = raw.sci;
        if (Array.isArray(sc.history)) {
          st.sci.history = sc.history.slice(-200).filter(isObj).map((e) => ({ expr: str(e.expr, 500), display: str(e.display, 200), value: typeof e.value === 'number' && isFinite(e.value) ? e.value : null, frac: !!e.frac })).filter((e) => e.expr);
        }
        st.sci.entry = str(sc.entry, 500);
        if (isObj(sc.vars)) for (const k in sc.vars) if (/^[A-Za-z](_[A-Za-z0-9]+)?$/.test(k) && typeof sc.vars[k] === 'number' && isFinite(sc.vars[k])) st.sci.vars[k] = sc.vars[k];
        if (typeof sc.ans === 'number' && isFinite(sc.ans)) st.sci.ans = sc.ans;
      }
    }
    this.state = st;
    this.ensureTrailing();
    this.selId = null;
    if (this.root) {
      if (this.graph) this.graph.setView(st.viewport);
      this.renderAll();
    }
  };
  P.reset = function () { this.setState(null); if (this.graph) this.graph.home(); this.changed(); };
  P.changed = function () {
    clearTimeout(this._chg);
    this._chg = setTimeout(() => {
      const fn = G.SatCalc && G.SatCalc.onChange;
      if (typeof fn === 'function') { try { fn(this.getState()); } catch (e) { /* host error */ } }
    }, 350);
  };

  // ------------------------------------------------------------ mount / layout
  P.mount = function (container) {
    if (this.root) this.unmount();
    const root = h('div', 'satcalc');
    this.root = root;
    container.appendChild(root);
    this.buildTop();
    const body = h('div', 'sc-body');
    root.appendChild(body);
    this.body = body;
    // graph mode
    const gm = h('div', 'sc-gmode');
    this.gmode = gm;
    const gpane = h('div', 'sc-gpane');
    const ghost = h('div', 'sc-ghost');
    gpane.appendChild(ghost);
    const zoom = h('div', 'sc-zoom', null, [
      h('button', 'sc-zbtn', { type: 'button', 'aria-label': 'Zoom in', title: 'Zoom in', text: '+', onclick: () => this.graph.zoomBy(1.6) }),
      h('button', 'sc-zbtn', { type: 'button', 'aria-label': 'Zoom out', title: 'Zoom out', text: '−', onclick: () => this.graph.zoomBy(1 / 1.6) }),
      h('button', 'sc-zbtn sc-home', { type: 'button', 'aria-label': 'Default view', title: 'Default view', html: '<svg viewBox="0 0 24 24" width="20" height="20"><path d="M3 11.5 12 4l9 7.5M5.5 10v9.5h5v-5h3v5h5V10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>', onclick: () => this.graph.home() })
    ]);
    gpane.appendChild(zoom);
    this.gpane = gpane;
    const split = h('div', 'sc-split', { role: 'separator', 'aria-label': 'Resize graph' }, [h('span', 'sc-grip')]);
    this.splitEl = split;
    this.bindSplit(split);
    const lpane = h('div', 'sc-lpane');
    const lbar = h('div', 'sc-lbar', null, [
      h('button', 'sc-lbtn', { type: 'button', onclick: () => this.addItem('expr'), html: '<b>+</b> Expression' }),
      h('button', 'sc-lbtn', { type: 'button', onclick: () => this.addItem('table'), html: '<b>+</b> Table' }),
      h('span', 'sc-flex'),
      h('button', 'sc-lbtn sc-kbtn', { type: 'button', 'aria-label': 'Toggle keypad', title: 'Keypad', onclick: () => this.toggleKeypad(), html: '<svg viewBox="0 0 24 24" width="22" height="22"><rect x="2.5" y="6" width="19" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M6 10h1M9 10h1M12 10h1M15 10h1M18 10h0.5M6 13.5h1M9 13.5h6M18 13.5h0.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>' })
    ]);
    const list = h('div', 'sc-list');
    this.list = list;
    lpane.appendChild(lbar);
    lpane.appendChild(list);
    this.lpane = lpane;
    this.gkeys = this.buildGraphKeypad();
    lpane.appendChild(this.gkeys);
    gm.appendChild(gpane);
    gm.appendChild(split);
    gm.appendChild(lpane);
    body.appendChild(gm);
    // scientific mode
    this.buildSci(body);
    this.graph = new Graph(ghost);
    this.graph.onSelect = (id) => this.onGraphSelect(id);
    this.graph.onViewChange = () => this.changed();
    this._viewApplied = false;
    this.ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => this.layout()) : null;
    if (this.ro) this.ro.observe(root); else G.addEventListener('resize', this._winResize = () => this.layout());
    this.root.addEventListener('pointerdown', (e) => { if (this.pop && !this.pop.contains(e.target)) this.closePop(); }, true);
    this.renderAll();
    this.layout();
  };
  P.unmount = function () {
    if (!this.root) return;
    if (this.graph) this.state.viewport = this.graph.getView();
    if (this.ro) this.ro.disconnect();
    if (this._winResize) G.removeEventListener('resize', this._winResize);
    this.root.remove();
    this.root = null; this.graph = null; this.rows.clear();
  };
  P.layout = function () {
    if (!this.root) return;
    const r = this.root.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const wide = r.width >= 700;
    this.root.classList.toggle('sc-wide', wide);
    this.root.classList.toggle('sc-narrow', !wide);
    const kpHome = wide ? this.lpane : this.body;
    if (this.gkeys.parentNode !== kpHome) kpHome.appendChild(this.gkeys);
    // key height adapts to the available height
    const rowsG = 5, rowsS = 8;
    const kh = Math.max(38, Math.min(50, Math.floor((r.height - 44) * (wide ? 0.5 : 0.33) / rowsG)));
    const ks = Math.max(36, Math.min(54, Math.floor((r.height - 44) * (wide ? 0.82 : 0.52) / rowsS)));
    this.root.style.setProperty('--sc-kh', kh + 'px');
    this.root.style.setProperty('--sc-ks', ks + 'px');
    this.root.style.setProperty('--sc-split', Math.round(this.state.split * 100) + '%');
    if (this.graph) {
      this.graph.resize();
      if (!this._viewApplied && this.graph.W > 1) { this._viewApplied = true; this.graph.setView(this.state.viewport); }
    }
  };
  P.bindSplit = function (el) {
    let start = null;
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      const gm = this.gmode.getBoundingClientRect();
      start = { y: e.clientY, split: this.state.split, h: gm.height };
    });
    el.addEventListener('pointermove', (e) => {
      if (!start) return;
      const s = Math.max(0.18, Math.min(0.82, start.split + (e.clientY - start.y) / start.h));
      this.state.split = s;
      this.root.style.setProperty('--sc-split', Math.round(s * 1000) / 10 + '%');
      if (this.graph) this.graph.resize();
    });
    const end = () => { if (start) { start = null; this.changed(); } };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  };

  // ------------------------------------------------------------ top bar & settings
  P.buildTop = function () {
    const seg = h('div', 'sc-seg', { role: 'tablist' });
    this.tabG = h('button', 'sc-segbtn', { type: 'button', role: 'tab', text: 'Graphing', onclick: () => this.setMode('graph') });
    this.tabS = h('button', 'sc-segbtn', { type: 'button', role: 'tab', text: 'Scientific', onclick: () => this.setMode('sci') });
    seg.appendChild(this.tabG); seg.appendChild(this.tabS);
    this.angleBtn = h('button', 'sc-angle', { type: 'button', title: 'Angle mode', onclick: () => this.setAngle(this.deg() ? 'rad' : 'deg') });
    const gear = h('button', 'sc-gear', { type: 'button', 'aria-label': 'Settings', title: 'Settings', html: '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M14.7 6.3a4.5 4.5 0 0 0-5.9 5.9L3.5 17.5a1.6 1.6 0 0 0 2.3 2.3l5.3-5.3a4.5 4.5 0 0 0 5.9-5.9l-2.6 2.6-2.3-.4-.4-2.3z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>', onclick: (e) => this.openSettings(e.currentTarget) });
    this.top = h('div', 'sc-top', null, [seg, h('span', 'sc-flex'), this.angleBtn, gear]);
    this.root.appendChild(this.top);
  };
  P.setMode = function (m) {
    if (this.state.mode === m) return;
    this.state.mode = m;
    this.closePop();
    this.renderMode();
    this.changed();
    if (m === 'sci' && !isTouch()) setTimeout(() => this.sciIn && this.sciIn.focus({ preventScroll: true }), 0);
  };
  P.setAngle = function (a) {
    this.state.angle = a;
    this.renderMode();
    this.recompute();
    this.updateSciPreview();
    this.changed();
  };
  P.renderMode = function () {
    const m = this.state.mode;
    this.root.classList.toggle('sc-m-graph', m === 'graph');
    this.root.classList.toggle('sc-m-sci', m === 'sci');
    this.tabG.classList.toggle('on', m === 'graph');
    this.tabS.classList.toggle('on', m === 'sci');
    this.tabG.setAttribute('aria-selected', m === 'graph');
    this.tabS.setAttribute('aria-selected', m === 'sci');
    this.angleBtn.textContent = this.deg() ? 'DEG' : 'RAD';
    this.root.querySelectorAll('.sc-key.angle').forEach((b) => { b.textContent = this.deg() ? 'DEG' : 'RAD'; });
    this.root.classList.toggle('sc-kp', this.keypadOpen);
    if (m === 'graph' && this.graph) setTimeout(() => this.layout(), 0);
  };
  P.openPop = function (anchor, content, cls) {
    this.closePop();
    const pop = h('div', 'sc-pop ' + (cls || ''));
    pop.appendChild(content);
    this.root.appendChild(pop);
    const rr = this.root.getBoundingClientRect(), ar = anchor.getBoundingClientRect();
    const pw = pop.offsetWidth, ph = pop.offsetHeight;
    let left = ar.left - rr.left, top = ar.bottom - rr.top + 4;
    if (left + pw > rr.width - 6) left = rr.width - pw - 6;
    if (left < 6) left = 6;
    if (top + ph > rr.height - 6) top = Math.max(6, ar.top - rr.top - ph - 4);
    pop.style.left = left + 'px';
    pop.style.top = top + 'px';
    this.pop = pop;
  };
  P.closePop = function () { if (this.pop) { this.pop.remove(); this.pop = null; } };
  P.openSettings = function (anchor) {
    const mk = (label, on, fn) => h('button', 'sc-opt' + (on ? ' on' : ''), { type: 'button', text: label, onclick: () => { fn(); this.closePop(); } });
    const s = this.state;
    const box = h('div', 'sc-settings', null, [
      h('div', 'sc-ph', { text: 'Angles' }),
      h('div', 'sc-optrow', null, [mk('Radians', s.angle === 'rad', () => this.setAngle('rad')), mk('Degrees', s.angle === 'deg', () => this.setAngle('deg'))]),
      h('div', 'sc-ph', { text: 'Graph' }),
      h('div', 'sc-optrow', null, [
        mk('Grid', s.grid, () => { s.grid = !s.grid; this.applyGraphFlags(); this.changed(); }),
        mk('Axis numbers', s.nums, () => { s.nums = !s.nums; this.applyGraphFlags(); this.changed(); })
      ]),
      h('div', 'sc-optrow', null, [h('button', 'sc-opt sc-danger', { type: 'button', text: 'Reset calculator', onclick: () => { this.closePop(); this.reset(); } })])
    ]);
    this.openPop(anchor, box, 'sc-pop-settings');
  };
  P.applyGraphFlags = function () {
    if (!this.graph) return;
    this.graph.showGrid = this.state.grid;
    this.graph.showNums = this.state.nums;
    this.graph.deg = this.deg();
    this.graph.request();
  };

  // ------------------------------------------------------------ expression list
  P.renderAll = function () {
    if (!this.root) return;
    this.list.innerHTML = '';
    this.rows.clear();
    this.state.items.forEach((it, i) => { this.list.appendChild(this.buildRow(it)); this.rows.get(it.id).num.textContent = String(i + 1); });
    this.renderMode();
    this.applyGraphFlags();
    this.recompute();
    this.renderSci();
  };
  P.syncRows = function () {
    const ids = new Set(this.state.items.map((it) => it.id));
    this.rows.forEach((r, id) => { if (!ids.has(id)) { r.el.remove(); this.rows.delete(id); } });
    let prev = null;
    this.state.items.forEach((it) => {
      let r = this.rows.get(it.id);
      if (!r) { this.buildRow(it); r = this.rows.get(it.id); }
      const want = prev ? prev.nextSibling : this.list.firstChild;
      if (want !== r.el) this.list.insertBefore(r.el, want);
      prev = r.el;
    });
    this.state.items.forEach((it, i) => { const r = this.rows.get(it.id); if (r) r.num.textContent = String(i + 1); });
  };
  P.addItem = function (type, afterId, text, extra) {
    const items = this.state.items;
    const it = type === 'table' ? this.newTable() : this.newExpr(text || '', extra);
    let idx = items.length;
    if (afterId != null) { const i = items.findIndex((x) => x.id === afterId); if (i >= 0) idx = i + 1; }
    else {
      const last = items[items.length - 1];
      if (last && last.type === 'expr' && !String(last.text).trim()) {
        if (type === 'expr' && !text) { this.focusItem(last.id); return last; }
        idx = items.length - 1;
      }
    }
    items.splice(idx, 0, it);
    this.ensureTrailing();
    this.syncRows();
    this.recompute();
    this.changed();
    if (type === 'table') this.focusCell(it.id, 0, 0); else if (!extra || !extra.noFocus) this.focusItem(it.id);
    return it;
  };
  P.deleteItem = function (id, focusPrev) {
    const items = this.state.items;
    const i = items.findIndex((x) => x.id === id);
    if (i < 0) return;
    items.splice(i, 1);
    if (this.selId === id) this.selId = null;
    this.ensureTrailing();
    this.syncRows();
    this.recompute();
    this.changed();
    if (focusPrev) {
      const t = items[Math.max(0, i - 1)];
      if (t) { if (t.type === 'table') this.focusCell(t.id, 0, 0); else this.focusItem(t.id); }
    }
  };
  P.focusItem = function (id, caretEnd) {
    const r = this.rows.get(id);
    if (!r || !r.input) return;
    r.input.focus({ preventScroll: true });
    if (caretEnd !== false) { const n = r.input.value.length; try { r.input.setSelectionRange(n, n); } catch (e) { /* ignore */ } }
    r.el.scrollIntoView({ block: 'nearest' });
  };

  P.buildRow = function (it) {
    const r = { it: it };
    const num = h('span', 'sc-num');
    const dot = h('span', 'sc-dot');
    const tab = h('button', 'sc-tab', { type: 'button', 'aria-label': 'Color and visibility' }, [num, dot]);
    tab.addEventListener('click', () => this.openItemMenu(it.id, tab));
    const main = h('div', 'sc-main');
    const del = h('button', 'sc-del', { type: 'button', 'aria-label': 'Delete', title: 'Delete', html: '<svg viewBox="0 0 24 24" width="18" height="18"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>' });
    del.addEventListener('click', () => this.deleteItem(it.id));
    const el = h('div', 'sc-row', { 'data-id': it.id }, [tab, main, del]);
    r.el = el; r.tab = tab; r.num = num; r.dot = dot; r.main = main;
    if (it.type === 'table') this.buildTableBody(r);
    else {
      const input = mathInput('sc-in', it.text, null);
      const math = h('div', 'sc-math', { 'data-ph': 'Tap to type, e.g. y = 2x + 1' });
      const status = h('div', 'sc-status');
      main.appendChild(input); main.appendChild(math); main.appendChild(status);
      r.input = input; r.math = math; r.status = status;
      math.addEventListener('click', () => this.focusItem(it.id));
      input.addEventListener('focus', () => this.onFieldFocus(input, it.id));
      input.addEventListener('blur', () => { el.classList.remove('sc-editing'); this.cleanupAfterBlur(it.id); });
      input.addEventListener('input', () => {
        it.text = input.value;
        const created = this.ensureTrailing();
        if (created) this.syncRows();
        this.recompute();
        this.changed();
        this.keepVisible(el);
      });
      input.addEventListener('keydown', (e) => this.onRowKey(e, it, input));
    }
    this.rows.set(it.id, r);
    this.list.appendChild(el);
    return el;
  };
  P.keepVisible = function (el) {
    const lr = this.list.getBoundingClientRect(), r = el.getBoundingClientRect();
    if (r.bottom > lr.bottom) this.list.scrollTop += Math.min(r.bottom - lr.bottom, r.top - lr.top);
    else if (r.top < lr.top) this.list.scrollTop -= lr.top - r.top;
  };
  P.cleanupAfterBlur = function (id) {
    // remove empty rows that are not the trailing row once the user leaves them
    setTimeout(() => {
      if (!this.root) return;
      const items = this.state.items;
      const i = items.findIndex((x) => x.id === id);
      const ae = document.activeElement;
      if (i >= 0 && i < items.length - 1 && items[i].type === 'expr' && !String(items[i].text).trim()) {
        const r = this.rows.get(id);
        if (r && r.el.contains(ae)) return;
        items.splice(i, 1);
        this.syncRows();
        this.recompute();
      }
    }, 0);
  };
  P.onFieldFocus = function (input, id) {
    this.activeField = input;
    const r = this.rows.get(id);
    this.rows.forEach((x) => x.el.classList.toggle('sc-editing', x === r && x.input === input));
    if (r) r.el.classList.add('sc-editing');
    this.setSel(id, true);
    if (isTouch() && !this.keypadOpen && this.state.mode === 'graph') this.toggleKeypad(true);
  };
  P.setSel = function (id, fromRow) {
    this.selId = id;
    this.rows.forEach((x, k) => x.el.classList.toggle('sc-sel', k === id));
    if (this.graph && fromRow) {
      const res = this.results.get(id);
      const curve = res && (res.kind === 'explicit' || res.kind === 'explicitx' || res.kind === 'implicit' || res.kind === 'ineq' || res.kind === 'regression' || res.kind === 'polar' || res.kind === 'parametric');
      this.graph.select(curve ? id : null, true);
    }
  };
  P.onGraphSelect = function (id) {
    this.rows.forEach((x, k) => x.el.classList.toggle('sc-sel', k === id));
    this.selId = id;
    if (id != null) { const r = this.rows.get(id); if (r) r.el.scrollIntoView({ block: 'nearest' }); }
  };
  P.onRowKey = function (e, it, input) {
    const items = this.state.items;
    const i = items.indexOf(it);
    if (e.key === 'Enter') {
      e.preventDefault();
      const next = items[i + 1];
      if (next && next.type === 'expr' && !String(next.text).trim()) this.focusItem(next.id);
      else this.addItem('expr', it.id);
    } else if (e.key === 'ArrowUp' && i > 0) {
      e.preventDefault(); this.focusAny(items[i - 1]);
    } else if (e.key === 'ArrowDown' && i < items.length - 1) {
      e.preventDefault(); this.focusAny(items[i + 1]);
    } else if (e.key === 'Backspace' && input.value === '' && items.length > 1) {
      e.preventDefault();
      this.deleteItem(it.id, true);
    }
  };
  P.focusAny = function (it) { if (it.type === 'table') this.focusCell(it.id, 0, 0); else this.focusItem(it.id); };
  P.openItemMenu = function (id, anchor) {
    const it = this.itemById(id);
    if (!it) return;
    const sw = PALETTE.map((c) => h('button', 'sc-swatch' + (it.color === c ? ' on' : ''), {
      type: 'button', 'aria-label': 'Color ' + c, style: 'background:' + c,
      onclick: () => { it.color = c; if (it.type === 'table') it.columns.forEach((col, k) => { if (k > 0) col.color = c; }); this.recompute(); this.changed(); this.closePop(); }
    }));
    const box = h('div', 'sc-imenu', null, [
      h('button', 'sc-opt sc-wideopt', { type: 'button', text: it.hidden ? 'Show on graph' : 'Hide from graph', onclick: () => { it.hidden = !it.hidden; this.recompute(); this.changed(); this.closePop(); } }),
      h('div', 'sc-swatches', null, sw)
    ]);
    this.openPop(anchor, box);
  };

  // per-row status rendering
  P.updateRow = function (it, res) {
    const r = this.rows.get(it.id);
    if (!r) return;
    const graphable = res && GRAPHABLE[res.kind] || (res && res.pts);
    r.el.classList.toggle('sc-graphable', !!graphable);
    r.el.classList.toggle('sc-hidden', !!it.hidden);
    r.el.classList.toggle('sc-err', !!(res && (res.kind === 'error' || res.error)));
    r.dot.style.background = it.hidden ? 'transparent' : it.color;
    r.dot.style.borderColor = it.color;
    if (it.type === 'table') { this.updateTable(r, res); return; }
    const text = String(it.text);
    if (!text.trim()) {
      setTex(r.math, null, '');
      r.math.classList.add('sc-empty');
    } else {
      r.math.classList.remove('sc-empty');
      if (res && res.ast) setTex(r.math, Core.toLatex(res.ast), text); else setTex(r.math, null, text);
    }
    this.updateStatus(r, it, res || { kind: 'empty' });
  };
  P.updateStatus = function (r, it, res) {
    const st = r.status;
    let sig = res.kind;
    if (res.kind === 'error') sig += '|' + res.error + '|' + (res.missing || []).join(',');
    if (res.kind === 'regression') sig += '|' + (res.order || []).join(',');
    if (res.kind === 'slider') sig += '|' + res.name;
    if (r.sig !== sig) {
      r.sig = sig;
      st.innerHTML = '';
      st.className = 'sc-status';
      r.ctl = {};
      if (res.kind === 'error') {
        st.classList.add('sc-s-err');
        st.appendChild(h('span', 'sc-warn', { 'aria-hidden': 'true', text: '⚠' }));
        st.appendChild(h('span', 'sc-emsg', { text: res.error }));
        if (res.missing && res.missing.length) {
          const box = h('div', 'sc-addsl', null, [h('span', 'sc-addlbl', { text: 'add slider:' })]);
          res.missing.forEach((n) => box.appendChild(h('button', 'sc-chip', { type: 'button', html: texHTML(Core.toLatex({ type: 'id', name: n })) || n, onclick: () => this.addSliders([n], it.id) })));
          if (res.missing.length > 1) box.appendChild(h('button', 'sc-chip', { type: 'button', text: 'all', onclick: () => this.addSliders(res.missing, it.id) }));
          st.appendChild(box);
        }
      } else if (res.kind === 'value' || res.kind === 'var') {
        st.classList.add('sc-s-val');
        r.ctl.val = h('span', 'sc-val');
        st.appendChild(r.ctl.val);
      } else if (res.kind === 'slider') {
        st.classList.add('sc-s-slider');
        this.buildSlider(r, it, res);
      } else if (res.kind === 'regression') {
        st.classList.add('sc-s-reg');
        r.ctl.reg = h('div', 'sc-reg');
        st.appendChild(r.ctl.reg);
      } else if (res.kind === 'parametric' || res.kind === 'polar') {
        st.classList.add('sc-s-dom');
        this.buildDomain(r, it, res);
      }
    }
    // dynamic parts
    if (r.ctl && r.ctl.val) {
      const t = (res.kind === 'value' || res.kind === 'var') && res.display != null ? '= ' + res.display : '';
      if (r.ctl.val.textContent !== t) r.ctl.val.textContent = t;
      st.style.display = t ? '' : 'none';
    } else if (res.kind === 'empty' || res.kind === 'explicit' || res.kind === 'explicitx' || res.kind === 'implicit' || res.kind === 'ineq' || res.kind === 'points' || res.kind === 'fn') {
      st.style.display = 'none';
    } else st.style.display = '';
    if (res.kind === 'slider' && r.ctl.range) this.syncSlider(r, it, res);
    if (res.kind === 'regression' && r.ctl.reg) {
      const parts = (res.order || []).map((n) => Core.toLatex({ type: 'id', name: n }) + '=' + texNum(res.params[n]));
      parts.push('r^{2}=' + texNum(res.r2, 6));
      const key = parts.join('|');
      if (r.ctl.reg._k !== key) {
        r.ctl.reg._k = key;
        r.ctl.reg.innerHTML = '';
        parts.forEach((p) => r.ctl.reg.appendChild(h('span', 'sc-rp', { html: texHTML(p) || p })));
      }
    }
  };
  function texNum(v, sig) {
    const s = Core.formatNumber(v, sig || 6);
    return s.replace('×10', '\\times10^{').replace(/([⁻⁰¹²³⁴⁵⁶⁷⁸⁹]+)$/, (m) => m.split('').map((c) => '⁻⁰¹²³⁴⁵⁶⁷⁸⁹'.indexOf(c) === 0 ? '-' : String('⁻⁰¹²³⁴⁵⁶⁷⁸⁹'.indexOf(c) - 1)).join('') + '}');
  }
  P.addSliders = function (names, afterId) {
    let after = afterId;
    names.forEach((n) => {
      const it = this.addItem('expr', after, n + '=1', { noFocus: true, slider: { min: -10, max: 10, step: 0.1 } });
      after = it.id;
    });
  };
  P.buildSlider = function (r, it, res) {
    if (!it.slider) it.slider = { min: -10, max: 10, step: 0.1 };
    const s = it.slider;
    const mk = (cls, val, lbl) => { const el = mathInput('sc-sin ' + cls, String(val), null); el.setAttribute('aria-label', lbl); return el; };
    const mn = mk('sc-smin', s.min, 'Slider minimum');
    const mx = mk('sc-smax', s.max, 'Slider maximum');
    const stp = mk('sc-sstep', s.step, 'Slider step');
    const range = h('input', 'sc-range', { type: 'range', 'aria-label': 'Value of ' + res.name });
    const play = h('button', 'sc-play', { type: 'button', 'aria-label': 'Play', html: '<svg viewBox="0 0 24 24" width="16" height="16"><path d="M7 5v14l11-7z" fill="currentColor"/></svg>' });
    const row1 = h('div', 'sc-srow', null, [play, mn, range, mx]);
    const row2 = h('div', 'sc-srow2', null, [h('span', null, { text: 'step' }), stp]);
    r.status.appendChild(row1);
    r.status.appendChild(row2);
    r.ctl.range = range; r.ctl.min = mn; r.ctl.max = mx; r.ctl.step = stp;
    range.addEventListener('input', () => {
      const v = +range.value;
      const name = res.name;
      it.text = name + '=' + fmtSlider(v, it.slider.step);
      r.input.value = it.text;
      this.recompute();
      this.changed();
    });
    const onLim = () => {
      const g = (el, d) => { const v = evalNum(el.value, null, false); return isFinite(v) ? v : d; };
      const a = g(mn, s.min), b = g(mx, s.max), st = g(stp, s.step);
      if (a < b) { s.min = a; s.max = b; }
      s.step = Math.max(0, st);
      this.syncSlider(r, it, this.results.get(it.id) || res);
      this.changed();
    };
    [mn, mx, stp].forEach((el) => {
      el.addEventListener('input', onLim);
      el.addEventListener('focus', () => { this.activeField = el; r.el.classList.add('sc-editing'); if (isTouch() && !this.keypadOpen) this.toggleKeypad(true); });
      el.addEventListener('blur', () => r.el.classList.remove('sc-editing'));
      el.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); el.blur(); } });
    });
    play.addEventListener('click', () => {
      if (r.anim) { clearInterval(r.anim); r.anim = null; play.classList.remove('on'); return; }
      play.classList.add('on');
      let dir = 1;
      r.anim = setInterval(() => {
        if (!this.root || !document.contains(range)) { clearInterval(r.anim); r.anim = null; return; }
        const span = s.max - s.min;
        let v = +range.value + dir * Math.max(s.step || 0, span / 120);
        if (v > s.max) { v = s.max; dir = -1; }
        if (v < s.min) { v = s.min; dir = 1; }
        range.value = String(v);
        range.dispatchEvent(new Event('input'));
      }, 50);
    });
  };
  P.syncSlider = function (r, it, res) {
    const s = it.slider;
    const v = res.value;
    if (typeof v === 'number' && isFinite(v)) {
      if (v < s.min) s.min = Math.floor(v);
      if (v > s.max) s.max = Math.ceil(v);
    }
    const range = r.ctl.range;
    range.min = String(s.min); range.max = String(s.max);
    range.step = s.step > 0 ? String(s.step) : 'any';
    if (document.activeElement !== r.ctl.min) r.ctl.min.value = String(s.min);
    if (document.activeElement !== r.ctl.max) r.ctl.max.value = String(s.max);
    if (document.activeElement !== r.ctl.step) r.ctl.step.value = String(s.step);
    if (typeof v === 'number' && String(range.value) !== String(v)) range.value = String(v);
  };
  P.buildDomain = function (r, it, res) {
    const polar = res.kind === 'polar';
    const name = polar ? 'θ' : 't';
    const def = this.domainDefaults(polar);
    const d = it.domain || def;
    const a = mathInput('sc-dom', d.min), b = mathInput('sc-dom', d.max);
    a.setAttribute('aria-label', name + ' minimum'); b.setAttribute('aria-label', name + ' maximum');
    const lbl = h('span', 'sc-domv', { html: texHTML('\\le ' + (polar ? '\\theta' : 't') + '\\le') || ('≤ ' + name + ' ≤') });
    r.status.appendChild(h('div', 'sc-domrow', null, [a, lbl, b]));
    const on = () => { it.domain = { min: a.value, max: b.value }; this.recompute(); this.changed(); };
    [a, b].forEach((el) => {
      el.addEventListener('input', on);
      el.addEventListener('focus', () => { this.activeField = el; r.el.classList.add('sc-editing'); if (isTouch() && !this.keypadOpen) this.toggleKeypad(true); });
      el.addEventListener('blur', () => r.el.classList.remove('sc-editing'));
      el.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); el.blur(); } });
    });
  };
  P.domainDefaults = function (polar) {
    if (!polar) return { min: '0', max: '1' };
    return this.deg() ? { min: '0', max: '360' } : { min: '0', max: '2π' };
  };

  // ------------------------------------------------------------ tables
  P.buildTableBody = function (r) {
    const it = r.it;
    r.main.innerHTML = '';
    const wrap = h('div', 'sc-twrap');
    const table = h('table', 'sc-table');
    wrap.appendChild(table);
    const status = h('div', 'sc-status');
    r.main.appendChild(wrap);
    r.main.appendChild(status);
    r.table = table; r.status = status;
    this.renderTable(r);
  };
  P.tableRowCount = function (it, res) {
    let n = 0;
    it.columns.forEach((c) => { for (let i = c.values.length - 1; i >= 0; i--) if (String(c.values[i]).trim()) { n = Math.max(n, i + 1); break; } });
    if (res && res.cols && res.cols[0]) n = Math.max(n, res.cols[0].values.length);
    return Math.max(n + 1, 2);
  };
  P.renderTable = function (r) {
    const it = r.it;
    const res = this.results.get(it.id);
    const ae = document.activeElement;
    let focusRC = null;
    if (ae && r.table.contains(ae) && ae._rc) focusRC = { rc: ae._rc, s: ae.selectionStart, e: ae.selectionEnd };
    const table = r.table;
    table.innerHTML = '';
    const nrows = this.tableRowCount(it, res);
    r.nrows = nrows;
    const thead = h('thead'), tr = h('tr');
    it.columns.forEach((c, ci) => {
      const th = h('th', ci > 0 ? 'sc-th' : 'sc-th sc-th0');
      const inp = mathInput('sc-hin', c.header, ci === 0 ? 'x' : 'y');
      inp._rc = [-1, ci];
      const view = h('div', 'sc-hview');
      th.appendChild(inp); th.appendChild(view);
      if (ci > 0) th.style.setProperty('--col', c.color || it.color);
      view.addEventListener('click', () => { inp.focus({ preventScroll: true }); });
      this.bindCell(r, inp, -1, ci);
      tr.appendChild(th);
    });
    const addc = h('th', 'sc-thadd');
    addc.appendChild(h('button', 'sc-addcol', { type: 'button', 'aria-label': 'Add column', text: '+', onclick: () => {
      if (it.columns.length >= 10) return;
      const used = new Set();
      this.state.items.forEach((x) => { if (x.type === 'table') x.columns.forEach((c) => used.add(c.header.trim())); });
      let n = 1;
      while (used.has('y_' + n)) n++;
      it.columns.push({ header: 'y_' + n, values: [], color: this.nextColor() });
      this.recompute(); this.changed();
      this.focusCell(it.id, -1, it.columns.length - 1);
    } }));
    tr.appendChild(addc);
    thead.appendChild(tr);
    table.appendChild(thead);
    const tbody = h('tbody');
    for (let ri = 0; ri < nrows; ri++) {
      const row = h('tr');
      it.columns.forEach((c, ci) => {
        const td = h('td');
        const comp = res && res.cols && res.cols[ci] && res.cols[ci].computed && ci > 0;
        const inp = mathInput('sc-cin' + (comp ? ' sc-comp' : ''), comp ? '' : (c.values[ri] || ''), null);
        inp._rc = [ri, ci];
        if (comp) inp.readOnly = true;
        if (res && res.cols && res.cols[ci] && res.cols[ci].cellErrors && res.cols[ci].cellErrors[ri]) inp.classList.add('sc-cerr');
        td.appendChild(inp);
        this.bindCell(r, inp, ri, ci);
        row.appendChild(td);
      });
      row.appendChild(h('td', 'sc-tdpad'));
      tbody.appendChild(row);
    }
    table.appendChild(tbody);
    r.tsig = this.tableSig(it, res);
    this.fillTableDynamic(r, res);
    if (focusRC) {
      const el = this.cellEl(r, focusRC.rc[0], focusRC.rc[1]);
      if (el) { el.focus({ preventScroll: true }); try { el.setSelectionRange(focusRC.s, focusRC.e); } catch (e) { /* ignore */ } }
    }
  };
  P.tableSig = function (it, res) {
    return it.columns.length + '|' + this.tableRowCount(it, res) + '|' + (res && res.cols ? res.cols.map((c) => (c.computed ? 'c' : 'v') + (c.cellErrors ? c.cellErrors.map((e) => (e ? 1 : 0)).join('') : '')).join(',') : '');
  };
  P.cellEl = function (r, ri, ci) {
    if (ri < 0) { const th = r.table.querySelectorAll('thead th')[ci]; return th && th.querySelector('input'); }
    const tr = r.table.querySelectorAll('tbody tr')[ri];
    return tr && tr.children[ci] && tr.children[ci].querySelector('input');
  };
  P.focusCell = function (id, ri, ci) {
    const r = this.rows.get(id);
    if (!r || !r.table) return;
    const el = this.cellEl(r, ri, ci);
    if (el) { el.focus({ preventScroll: true }); const n = el.value.length; try { el.setSelectionRange(n, n); } catch (e) { /* ignore */ } el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
  };
  P.bindCell = function (r, inp, ri, ci) {
    const it = r.it;
    inp.addEventListener('focus', () => {
      this.activeField = inp;
      this.rows.forEach((x) => x.el.classList.remove('sc-editing'));
      r.el.classList.add('sc-editing');
      if (ri < 0) inp.parentNode.classList.add('sc-hedit');
      this.setSel(it.id, true);
      if (isTouch() && !this.keypadOpen && this.state.mode === 'graph') this.toggleKeypad(true);
    });
    inp.addEventListener('blur', () => { r.el.classList.remove('sc-editing'); if (ri < 0) inp.parentNode.classList.remove('sc-hedit'); });
    inp.addEventListener('input', () => {
      const col = it.columns[ci];
      if (!col) return;
      if (ri < 0) col.header = inp.value;
      else { while (col.values.length <= ri) col.values.push(''); col.values[ri] = inp.value; }
      this.recompute();
      this.changed();
    });
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || (e.key === 'ArrowDown')) { e.preventDefault(); this.focusCell(it.id, Math.min(ri + 1, r.nrows - 1), ci); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); if (ri >= 0) this.focusCell(it.id, ri - 1, ci); }
      else if (e.key === 'Backspace' && inp.value === '' && ri < 0 && ci > 0 && it.columns.length > 2) {
        e.preventDefault();
        it.columns.splice(ci, 1);
        this.recompute(); this.changed();
        this.focusCell(it.id, -1, ci - 1);
      }
    });
  };
  P.updateTable = function (r, res) {
    const sig = this.tableSig(r.it, res);
    if (sig !== r.tsig) this.renderTable(r); else this.fillTableDynamic(r, res);
    // status
    const st = r.status;
    const key = res && res.error ? res.error : '';
    if (st._k !== key) {
      st._k = key;
      st.innerHTML = '';
      st.className = 'sc-status';
      if (key) {
        st.classList.add('sc-s-err');
        st.appendChild(h('span', 'sc-warn', { text: '⚠' }));
        st.appendChild(h('span', 'sc-emsg', { text: res.error }));
        if (res.missing && res.missing.length) {
          const box = h('div', 'sc-addsl', null, [h('span', 'sc-addlbl', { text: 'add slider:' })]);
          res.missing.forEach((n) => box.appendChild(h('button', 'sc-chip', { type: 'button', text: n, onclick: () => this.addSliders([n], r.it.id) })));
          st.appendChild(box);
        }
      }
    }
    st.style.display = key ? '' : 'none';
  };
  P.fillTableDynamic = function (r, res) {
    const it = r.it;
    const ths = r.table.querySelectorAll('thead th');
    it.columns.forEach((c, ci) => {
      const th = ths[ci];
      if (!th) return;
      const view = th.querySelector('.sc-hview');
      let ast = null;
      try { ast = Core.parse(c.header); } catch (e) { ast = null; }
      setTex(view, ast ? Core.toLatex(ast) : null, c.header || (ci === 0 ? 'x' : 'y'));
      th.classList.toggle('sc-hidden', !!c.hidden);
      if (ci > 0) th.style.setProperty('--col', c.color || it.color);
    });
    if (!res || !res.cols) return;
    res.cols.forEach((c, ci) => {
      if (!c.computed || ci === 0) return;
      for (let ri = 0; ri < r.nrows; ri++) {
        const el = this.cellEl(r, ri, ci);
        if (!el) continue;
        const v = c.values[ri];
        el.value = v === undefined || isNaN(v) ? '' : Core.formatNumber(v, 8);
      }
    });
  };

  // ------------------------------------------------------------ analysis -> graph
  P.recompute = function () {
    const items = this.state.items;
    const A = Core.analyze(items.map((it) => it.type === 'table' ? { id: it.id, type: 'table', columns: it.columns } : { id: it.id, type: 'expr', text: it.text }), { deg: this.deg() });
    this.results = A.results;
    this.lastAnalysis = A;
    if (!this.root) return;
    items.forEach((it) => this.updateRow(it, A.results.get(it.id)));
    const draw = [];
    const getVar = (n) => { try { return A.getVar(n); } catch (e) { return undefined; } };
    items.forEach((it) => {
      const res = A.results.get(it.id);
      if (!res || it.hidden) return;
      const base = { id: it.id, color: it.color };
      switch (res.kind) {
        case 'explicit': case 'regression': draw.push(Object.assign(base, { kind: 'fx', fns: res.fns })); break;
        case 'explicitx': draw.push(Object.assign(base, { kind: 'fy', fns: res.fns })); break;
        case 'implicit': draw.push(Object.assign(base, { kind: 'F', Fs: res.Fs })); break;
        case 'ineq': draw.push(Object.assign(base, { kind: 'ineq', Fs: res.Fs, strict: res.strict })); break;
        case 'parametric': case 'polar': {
          const polar = res.kind === 'polar';
          const d = it.domain || this.domainDefaults(polar);
          let t0 = evalNum(d.min, getVar, false), t1 = evalNum(d.max, getVar, false);
          if (!isFinite(t0)) t0 = 0;
          if (!isFinite(t1)) t1 = polar ? (this.deg() ? 360 : 2 * Math.PI) : 1;
          draw.push(Object.assign(base, polar ? { kind: 'polar', fns: res.fns, t0: t0, t1: t1 } : { kind: 'param', pfns: res.pfns, t0: t0, t1: t1 }));
          break;
        }
        case 'table':
          draw.push(Object.assign(base, { kind: 'pts', labels: false, series: (res.series || []).filter((s) => !(it.columns[s.col] && it.columns[s.col].hidden)).map((s) => ({ pts: s.pts, color: (it.columns[s.col] && it.columns[s.col].color) || it.color })) }));
          break;
        default:
          if (res.pts) draw.push(Object.assign(base, { kind: 'pts', labels: true, series: [{ pts: res.pts, color: it.color }] }));
      }
    });
    if (this.graph) {
      this.graph.deg = this.deg();
      this.graph.setItems(draw);
    }
  };

  // ------------------------------------------------------------ keypad
  P.buildKeys = function (rows, cols, cls) {
    const grid = h('div', 'sc-kgrid ' + (cls || ''));
    grid.style.setProperty('--cols', cols);
    rows.forEach((row) => {
      row.forEach((k) => {
        const b = h('button', 'sc-key' + (k.cls ? ' ' + k.cls : ''), { type: 'button', tabindex: '-1', 'aria-label': k.aria || k.l });
        if (k.html) b.innerHTML = k.html; else b.textContent = k.l;
        b.setAttribute('data-k', k.l);
        if (k.w) b.style.gridColumn = 'span ' + Math.round(k.w * 2);
        else b.style.gridColumn = 'span 2';
        b._k = k;
        grid.appendChild(b);
      });
    });
    grid.style.gridTemplateColumns = 'repeat(' + (cols * 2) + ', minmax(0, 1fr))';
    // press handling: keep focus in the field; repeat backspace on hold
    grid.addEventListener('pointerdown', (e) => {
      const b = e.target.closest('.sc-key');
      if (!b) return;
      e.preventDefault();
      b.classList.add('down');
      const k = b._k;
      this.keyPress(k);
      if (k.a === 'bs' || k.a === 'left' || k.a === 'right') {
        clearTimeout(this._rep); clearInterval(this._repI);
        this._rep = setTimeout(() => { this._repI = setInterval(() => this.keyPress(k), 70); }, 420);
      }
    });
    const release = (e) => {
      clearTimeout(this._rep); clearInterval(this._repI);
      grid.querySelectorAll('.sc-key.down').forEach((b) => b.classList.remove('down'));
    };
    grid.addEventListener('pointerup', release);
    grid.addEventListener('pointercancel', release);
    grid.addEventListener('pointerleave', release);
    grid.addEventListener('mousedown', (e) => e.preventDefault());
    return grid;
  };
  P.buildGraphKeypad = function () {
    const kp = h('div', 'sc-keypad sc-gkeys');
    this.kpPanels = {};
    ['main', 'fn', 'abc'].forEach((name) => {
      const rows = GRAPH_PANELS[name];
      const body = rows.slice(0, -1), bottom = rows[rows.length - 1];
      const cols = name === 'fn' ? 6 : 8;
      const panel = h('div', 'sc-kpanel sc-kp-' + name);
      const top = this.buildKeys(body, cols, name === 'fn' ? 'sc-kscroll' : '');
      if (name === 'fn') top.addEventListener('scroll', () => top.classList.toggle('atend', top.scrollTop + top.clientHeight >= top.scrollHeight - 4), { passive: true });
      panel.appendChild(top);
      panel.appendChild(this.buildKeys([bottom], 8, 'sc-kbottom'));
      this.kpPanels[name] = panel;
      kp.appendChild(panel);
    });
    this.showPanel('main');
    return kp;
  };
  P.showPanel = function (name) {
    this.panel = name;
    for (const k in this.kpPanels) this.kpPanels[k].style.display = k === name ? '' : 'none';
    const fnBtn = this.kpPanels[name].querySelectorAll('.sc-kbottom .sc-key');
    fnBtn.forEach((b) => b.classList.toggle('on', (b._k.a === 'tab-fn' && name === 'fn')));
  };
  P.toggleKeypad = function (force) {
    this.keypadOpen = force === undefined ? !this.keypadOpen : !!force;
    this.root.classList.toggle('sc-kp', this.keypadOpen);
    if (this.keypadOpen && this.activeField && document.contains(this.activeField)) {
      const f = this.activeField;
      setTimeout(() => f.scrollIntoView({ block: 'nearest' }), 30);
    }
    if (this.graph) setTimeout(() => this.graph.resize(), 0);
  };
  P.targetField = function () {
    let el = this.activeField;
    if (this.state.mode === 'sci') { if (!el || !this.sci.contains(el)) el = this.sciIn; }
    else if (!el || !document.contains(el) || !this.gmode.contains(el)) {
      const last = this.state.items[this.state.items.length - 1];
      const r = last && this.rows.get(last.id);
      el = r && r.input;
    }
    return el;
  };
  P.keyPress = function (k) {
    if (k.a === 'tab-fn') { this.showPanel(this.panel === 'fn' ? 'main' : 'fn'); return; }
    if (k.a === 'tab-abc') { this.showPanel(this.panel === 'abc' ? 'main' : 'abc'); return; }
    if (k.a === 'shift') {
      this.shift = !this.shift;
      this.kpPanels.abc.querySelectorAll('.sc-key.var').forEach((b) => { if (b._k.i.length === 1) b.textContent = this.shift ? b._k.i.toUpperCase() : b._k.i; });
      return;
    }
    if (k.a === 'angle') { this.setAngle(this.deg() ? 'rad' : 'deg'); return; }
    if (k.a === 'frac') { this.toggleLastFrac(); return; }
    const el = this.targetField();
    if (!el) return;
    if (document.activeElement !== el) el.focus({ preventScroll: true });
    const v = el.value;
    let s = el.selectionStart == null ? v.length : el.selectionStart, e = el.selectionEnd == null ? v.length : el.selectionEnd;
    const set = (nv, caret) => {
      if (el.readOnly) return;
      el.value = nv;
      try { el.setSelectionRange(caret, caret); } catch (ex) { /* ignore */ }
      el.dispatchEvent(new Event('input', { bubbles: true }));
    };
    switch (k.a) {
      case 'left': { const p = s !== e ? s : Math.max(0, s - 1); el.setSelectionRange(p, p); return; }
      case 'right': { const p = s !== e ? e : Math.min(v.length, s + 1); el.setSelectionRange(p, p); return; }
      case 'bs': {
        if (s !== e) { set(v.slice(0, s) + v.slice(e), s); return; }
        if (s === 0) {
          if (v === '') el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true }));
          return;
        }
        const before = v.slice(0, s), after = v.slice(s);
        let m = /(?:[A-Za-z]{2,}(?:_\{?[^}()]*\}?)?|√|∛)\($/.exec(before);
        if (m && after[0] === ')') { set(before.slice(0, before.length - m[0].length) + after.slice(1), s - m[0].length); return; }
        if ((before.endsWith('(') && after[0] === ')') || (before.endsWith('[') && after[0] === ']') || (before.endsWith('{') && after[0] === '}') || (before.endsWith('|') && after[0] === '|' && /\|$/.test(before))) {
          set(before.slice(0, -1) + after.slice(1), s - 1); return;
        }
        m = /(?:<=|>=|\.\.\.)$/.exec(before);
        const n = m ? m[0].length : 1;
        set(before.slice(0, -n) + after, s - n);
        return;
      }
      case 'enter': el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })); return;
      case 'clear': this.sciClear(); return;
    }
    let ins = k.i;
    let back = k.b || 0;
    if (this.shift && ins.length === 1 && /[a-z]/.test(ins)) ins = ins.toUpperCase();
    // wrap a selection inside function parentheses
    if (s !== e && back > 0 && ins.endsWith(')')) {
      const sel = v.slice(s, e);
      const head = ins.slice(0, ins.length - back);
      const tail = ins.slice(ins.length - back);
      set(v.slice(0, s) + head + sel + tail, s + head.length + sel.length + tail.length);
      return;
    }
    // typing a closing bracket over an existing one just steps over it
    if (s === e && (ins === ')' || ins === ']' || ins === '}' || ins === ',') && v[s] === ins) { el.setSelectionRange(s + 1, s + 1); return; }
    // scientific: operator on empty entry continues from ans
    if (el === this.sciIn && v.trim() === '' && /^[+*/^!%]/.test(ins) && this.state.sci.history.length) ins = 'ans' + ins;
    set(v.slice(0, s) + ins + v.slice(e), s + ins.length - back);
  };

  // ------------------------------------------------------------ scientific mode
  P.buildSci = function (body) {
    const sci = h('div', 'sc-smode');
    this.sci = sci;
    const hist = h('div', 'sc-hist');
    this.hist = hist;
    const entry = h('div', 'sc-entry');
    const input = mathInput('sc-sciin', this.state.sci.entry, 'Type an expression');
    this.sciIn = input;
    const prev = h('div', 'sc-sprev');
    this.sciPrev = prev;
    const emath = h('div', 'sc-emath');
    this.sciMath = emath;
    entry.appendChild(input);
    entry.appendChild(emath);
    entry.appendChild(prev);
    const left = h('div', 'sc-sleft', null, [hist, entry]);
    const keys = h('div', 'sc-keypad sc-skeys');
    keys.appendChild(this.buildKeys(SCI_ROWS, 6, 'sc-sgrid'));
    sci.appendChild(left);
    sci.appendChild(keys);
    body.appendChild(sci);
    input.addEventListener('focus', () => { this.activeField = input; });
    input.addEventListener('input', () => { this.state.sci.entry = input.value; this.updateSciPreview(); this.changed(); });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); this.sciEval(); }
      else if (e.key === 'Escape') { e.preventDefault(); this.sciClear(); }
      else if (e.key === 'ArrowUp' && this.state.sci.history.length) {
        e.preventDefault();
        const hh = this.state.sci.history;
        this._hi = this._hi == null ? hh.length - 1 : Math.max(0, this._hi - 1);
        input.value = hh[this._hi].expr; input.dispatchEvent(new Event('input'));
      }
    });
    emath.addEventListener('click', () => input.focus());
  };
  P.sciScope = function () {
    const s = this.state.sci;
    return { deg: this.deg(), vars: s.vars, ans: s.ans };
  };
  P.updateSciPreview = function () {
    if (!this.sciIn) return;
    const t = this.sciIn.value;
    let pv = '', ok = false;
    let ast = null;
    if (t.trim()) {
      try {
        const r = Core.evaluate(t, this.sciScope());
        ast = r.ast;
        if (!r.empty) { pv = '= ' + r.display; ok = true; }
      } catch (e) { try { ast = Core.parse(t); } catch (e2) { ast = null; } pv = ''; }
    }
    this.sciPrev.textContent = pv;
    this.sciPrev.classList.toggle('ok', ok);
    setTex(this.sciMath, ast ? Core.toLatex(ast) : null, t);
  };
  P.sciEval = function () {
    const t = this.sciIn.value;
    if (!t.trim()) return;
    const s = this.state.sci;
    let entry;
    try {
      const r = Core.evaluate(t, this.sciScope());
      if (r.empty) return;
      const v = r.value;
      if (r.assign) {
        if (typeof v !== 'number') throw new Error('Only numbers can be stored');
        s.vars[r.assign] = v;
      }
      entry = { expr: t, value: typeof v === 'number' ? v : null, display: r.display, frac: false };
      if (typeof v === 'number' && isFinite(v)) s.ans = v;
    } catch (e) {
      entry = { expr: t, value: null, display: '', error: e.calc ? e.message : 'Error', frac: false };
    }
    s.history.push(entry);
    if (s.history.length > 200) s.history.shift();
    this._hi = null;
    if (!entry.error) { this.sciIn.value = ''; s.entry = ''; }
    this.renderSci();
    this.changed();
  };
  P.sciClear = function () {
    const s = this.state.sci;
    if (this.sciIn.value === '') { s.history = []; }
    this.sciIn.value = '';
    s.entry = '';
    this.renderSci();
    this.changed();
  };
  P.toggleLastFrac = function () {
    const hh = this.state.sci.history;
    for (let i = hh.length - 1; i >= 0; i--) {
      if (hh[i].value != null && Core.toFraction(hh[i].value)) { hh[i].frac = !hh[i].frac; this.renderSci(); this.changed(); return; }
    }
  };
  P.renderSci = function () {
    if (!this.hist) return;
    const s = this.state.sci;
    if (this.sciIn.value !== s.entry) this.sciIn.value = s.entry;
    this.hist.innerHTML = '';
    if (!s.history.length) this.hist.appendChild(h('div', 'sc-hempty', { text: 'Results appear here. Tap a past entry to reuse it.' }));
    s.history.forEach((e, i) => {
      let ast = null;
      try { ast = Core.parse(e.expr); } catch (ex) { ast = null; }
      const ex = h('button', 'sc-hexpr', { type: 'button', 'aria-label': 'Reuse ' + e.expr });
      setTex(ex, ast ? Core.toLatex(ast) : null, e.expr);
      ex.addEventListener('click', () => { this.sciIn.value = e.expr; this.sciIn.dispatchEvent(new Event('input')); this.sciIn.focus({ preventScroll: true }); });
      const resBox = h('div', 'sc-hres');
      if (e.error) resBox.appendChild(h('span', 'sc-herr', { text: '⚠ ' + e.error }));
      else {
        const fr = e.value != null ? Core.toFraction(e.value) : null;
        const val = h('button', 'sc-hval', { type: 'button', 'aria-label': 'Insert result' });
        let latex;
        if (fr && e.frac) latex = '=' + (fr.n < 0 ? '-' : '') + '\\frac{' + Math.abs(fr.n) + '}{' + fr.d + '}';
        else latex = '=' + texNumDisp(e.display);
        setTex(val, latex, '= ' + e.display);
        val.addEventListener('click', () => {
          const ins = e.value != null ? (fr && e.frac ? '(' + fr.n + '/' + fr.d + ')' : String(Number(e.value.toPrecision(15)))) : e.display;
          const el = this.sciIn;
          const st = el.selectionStart == null ? el.value.length : el.selectionStart, en = el.selectionEnd == null ? st : el.selectionEnd;
          el.value = el.value.slice(0, st) + ins + el.value.slice(en);
          el.dispatchEvent(new Event('input'));
          el.focus({ preventScroll: true });
          try { el.setSelectionRange(st + ins.length, st + ins.length); } catch (x) { /* ignore */ }
        });
        resBox.appendChild(val);
        if (fr) {
          resBox.appendChild(h('button', 'sc-fbtn' + (e.frac ? ' on' : ''), { type: 'button', 'aria-label': 'Toggle fraction', title: 'Fraction / decimal', html: e.frac ? '0.5' : '<sup>a</sup>⁄<sub>b</sub>', onclick: () => { e.frac = !e.frac; this.renderSci(); this.changed(); } }));
        }
      }
      this.hist.appendChild(h('div', 'sc-hrow', null, [ex, resBox]));
    });
    this.hist.scrollTop = this.hist.scrollHeight;
    this.updateSciPreview();
  };
  function texNumDisp(d) {
    const m = /^(-?[\d.]+)×10([⁻⁰¹²³⁴⁵⁶⁷⁸⁹]+)$/.exec(d);
    if (m) {
      const map = '⁰¹²³⁴⁵⁶⁷⁸⁹';
      const ex = m[2].split('').map((c) => c === '⁻' ? '-' : String(map.indexOf(c))).join('');
      return m[1] + '\\times10^{' + ex + '}';
    }
    return d.replace(/∞/g, '\\infty ').replace(/[{}\\]/g, '');
  }

  G.SatCalcApp = App;
})(typeof globalThis !== 'undefined' ? globalThis : window);
