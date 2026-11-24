/*
 * Graphing Calculator — canvas graph view.
 * Grid/axes, adaptive explicit plotting, marching-squares implicit curves and
 * inequality shading, parametric/polar curves, points, points of interest,
 * tracing, pan / pinch / wheel zoom.  Depends on SatCalcCore (parser.js).
 * Exposes window.SatCalcGraph (constructor).
 */
(function (G) {
  'use strict';
  const Core = G.SatCalcCore;
  const D2R = Math.PI / 180;
  const POI_GREY = '#7d838c';

  function niceStep(raw) {
    const p = Math.pow(10, Math.floor(Math.log10(raw)));
    const m = raw / p;
    const s = m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10;
    return { step: s * p, mant: s === 10 ? 1 : s };
  }
  const SUP = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻' };
  function fmtTick(v, step) {
    if (Math.abs(v) < step * 1e-6) return '0';
    if (step >= 1e6 || step < 1e-5) {
      const e = Math.floor(Math.log10(Math.abs(v)) + 1e-9);
      let m = v / Math.pow(10, e);
      m = Math.round(m * 1000) / 1000;
      const es = String(e).split('').map((c) => SUP[c] || c).join('');
      return (m === 1 ? '' : m === -1 ? '-' : m + '×') + '10' + es;
    }
    const d = Math.max(0, -Math.floor(Math.log10(step) + 1e-9));
    return v.toFixed(d).replace(/^-/, '−');
  }

  function Graph(host) {
    this.host = host;
    const c = document.createElement('canvas');
    c.className = 'sc-canvas';
    c.setAttribute('aria-label', 'Graph');
    host.appendChild(c);
    this.canvas = c;
    this.ctx = c.getContext('2d');
    this.W = 300; this.H = 200; this.dpr = 1;
    this.cx = 0; this.cy = 0; this.ppu = 0;
    this.items = [];
    this.curves = [];
    this.selId = null;
    this.pois = [];
    this.poiOpen = new Set();
    this.ptOpen = new Set();
    this.trace = null;
    this.showGrid = true;
    this.showNums = true;
    this.deg = false;
    this.interacting = false;
    this.ptrs = new Map();
    this.mode = null;
    this.onSelect = null;
    this.onViewChange = null;
    this._raf = 0;
    this._idle = 0;
    this._poiTimer = 0;
    this.lastRenderMs = 0;
    this.bind();
  }
  const P = Graph.prototype;

  // ------------------------------------------------------------ view
  P.X = function (x) { return this.W / 2 + (x - this.cx) * this.ppu; };
  P.Y = function (y) { return this.H / 2 - (y - this.cy) * this.ppu; };
  P.wx = function (px) { return this.cx + (px - this.W / 2) / this.ppu; };
  P.wy = function (py) { return this.cy - (py - this.H / 2) / this.ppu; };
  P.defaultPPU = function () { return Math.max(1e-9, Math.min(this.W / 20, this.H / 14)); };
  P.getView = function () {
    return { cx: this.cx, cy: this.cy, ppu: this.ppu || this.defaultPPU(), w: this.W, h: this.H };
  };
  P.setView = function (v) {
    if (v && isFinite(v.cx) && isFinite(v.cy) && isFinite(v.ppu) && v.ppu > 0) {
      this.cx = +v.cx; this.cy = +v.cy; this.ppu = Math.min(1e12, Math.max(1e-9, +v.ppu));
    } else this.home(true);
    this.viewChanged(true);
  };
  P.home = function (silent) {
    this.cx = 0; this.cy = 0; this.ppu = this.defaultPPU();
    if (!silent) this.viewChanged(true);
  };
  P.zoomBy = function (f, px, py) {
    if (px == null) { px = this.W / 2; py = this.H / 2; }
    const wx = this.wx(px), wy = this.wy(py);
    this.ppu = Math.min(1e12, Math.max(1e-9, this.ppu * f));
    this.cx = wx - (px - this.W / 2) / this.ppu;
    this.cy = wy + (py - this.H / 2) / this.ppu;
    this.viewChanged(true);
  };
  P.viewChanged = function (final) {
    if (final) this.endInteraction(); else this.request();
    if (this.onViewChange) this.onViewChange();
  };
  P.resize = function () {
    const r = this.host.getBoundingClientRect();
    const W = Math.max(1, Math.round(r.width)), H = Math.max(1, Math.round(r.height));
    const dpr = Math.min(3, G.devicePixelRatio || 1);
    if (W === this.W && H === this.H && dpr === this.dpr && this.ppu) return;
    this.W = W; this.H = H; this.dpr = dpr;
    this.canvas.width = Math.round(W * dpr);
    this.canvas.height = Math.round(H * dpr);
    this.canvas.style.width = W + 'px';
    this.canvas.style.height = H + 'px';
    if (!this.ppu) this.ppu = this.defaultPPU();
    this.renderNow();
    this.schedulePOI();
  };

  // ------------------------------------------------------------ data
  P.setItems = function (items) {
    this.items = items || [];
    if (this.selId != null && !this.items.some((it) => it.id === this.selId && this.isCurve(it))) {
      this.selId = null; this.pois = []; this.trace = null;
    }
    if (this.trace && !this.items.some((it) => it.id === this.trace.id)) this.trace = null;
    this.request();
    this.schedulePOI();
  };
  P.isCurve = function (it) { return it.kind === 'fx' || it.kind === 'fy' || it.kind === 'F' || it.kind === 'ineq' || it.kind === 'param' || it.kind === 'polar'; };
  P.select = function (id, silent) {
    if (this.selId === id) return;
    this.selId = id;
    this.poiOpen.clear();
    if (this.trace && this.trace.id !== id) this.trace = null;
    this.pois = [];
    this.request();
    this.schedulePOI(0);
    if (!silent && this.onSelect) this.onSelect(id);
  };

  // ------------------------------------------------------------ render scheduling
  P.request = function () {
    if (this._raf) return;
    const raf = G.requestAnimationFrame || ((f) => setTimeout(f, 16));
    this._raf = raf(() => { this._raf = 0; this.renderNow(); });
  };
  P.endInteraction = function () {
    clearTimeout(this._idle);
    this._idle = setTimeout(() => {
      this.interacting = false;
      this.request();
      this.schedulePOI(0);
    }, 140);
    this.request();
  };
  P.schedulePOI = function (delay) {
    clearTimeout(this._poiTimer);
    this._poiTimer = setTimeout(() => { this.computePOIs(); this.request(); }, delay == null ? 60 : delay);
  };

  // ------------------------------------------------------------ rendering
  P.renderNow = function () {
    const t0 = (G.performance || Date).now();
    const ctx = this.ctx, W = this.W, H = this.H;
    if (!this.ppu) this.ppu = this.defaultPPU();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
    const grid = this.gridInfo();
    if (this.showGrid) this.drawGridLines(grid);
    this.drawAxes();
    const curves = [];
    const vkey = [this.cx, this.cy, this.ppu, W, H, this.interacting ? 1 : 0, this.deg ? 1 : 0].join(',');
    // inequality fills first
    for (const it of this.items) {
      if (it.kind !== 'ineq') continue;
      (it.Fs || []).forEach((F, b) => {
        const res = this.contourCached(F, vkey, true);
        if (!res) return;
        ctx.save();
        ctx.globalAlpha = 0.22;
        ctx.fillStyle = it.color;
        ctx.fill(res.fill);
        ctx.restore();
        curves.push({ id: it.id, b: b, type: 'F', F: F, chains: res.chains, color: it.color, strict: it.strict, ineq: true });
      });
    }
    if (this.showNums) this.drawLabels(grid);
    for (const it of this.items) {
      try {
        if (it.kind === 'fx' || it.kind === 'fy') {
          (it.fns || []).forEach((f, b) => {
            const chains = this.explicitCached(f, it.kind === 'fy', vkey);
            curves.push({ id: it.id, b: b, type: it.kind, f: f, chains: chains, color: it.color });
          });
        } else if (it.kind === 'F') {
          (it.Fs || []).forEach((F, b) => {
            const res = this.contourCached(F, vkey, false);
            if (res) curves.push({ id: it.id, b: b, type: 'F', F: F, chains: res.chains, color: it.color });
          });
        } else if (it.kind === 'param' || it.kind === 'polar') {
          const fs = it.kind === 'param' ? it.pfns : it.fns;
          (fs || []).forEach((f, b) => {
            const chains = this.paramCached(it, f, vkey);
            curves.push({ id: it.id, b: b, type: 'param', chains: chains, color: it.color });
          });
        }
      } catch (e) { /* a bad curve must not stop the others */ }
    }
    this.curves = curves;
    // stroke curves
    for (const c of curves) {
      const sel = c.id === this.selId;
      ctx.save();
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.strokeStyle = c.color;
      ctx.lineWidth = sel ? 3.6 : 2.5;
      if (c.strict) { ctx.setLineDash([9, 6]); ctx.lineCap = 'butt'; }
      ctx.beginPath();
      for (const ch of c.chains) {
        if (ch.length < 4) continue;
        ctx.moveTo(ch[0], ch[1]);
        for (let i = 2; i < ch.length; i += 2) ctx.lineTo(ch[i], ch[i + 1]);
      }
      ctx.stroke();
      ctx.restore();
    }
    this.drawPoints();
    this.drawPOIs();
    this.drawTrace();
    this.lastRenderMs = (G.performance || Date).now() - t0;
  };

  P.gridInfo = function () {
    const major = niceStep(Math.max(1e-300, (this.W < 500 ? 36 : 64) / this.ppu));
    const ratio = major.mant === 2 ? 4 : 5;
    return { major: major.step, minor: major.step / ratio, ratio: ratio };
  };
  P.drawGridLines = function (g) {
    const ctx = this.ctx, W = this.W, H = this.H;
    const minorPx = g.minor * this.ppu;
    const x0 = this.wx(0), x1 = this.wx(W), y0 = this.wy(H), y1 = this.wy(0);
    const lines = (step, color, skipMajor) => {
      ctx.beginPath();
      const kx0 = Math.ceil(x0 / step), kx1 = Math.floor(x1 / step);
      for (let k = kx0; k <= kx1 && k - kx0 < 4000; k++) {
        if (skipMajor && k % g.ratio === 0) continue;
        const px = Math.round(this.X(k * step)) + 0.5;
        ctx.moveTo(px, 0); ctx.lineTo(px, H);
      }
      const ky0 = Math.ceil(y0 / step), ky1 = Math.floor(y1 / step);
      for (let k = ky0; k <= ky1 && k - ky0 < 4000; k++) {
        if (skipMajor && k % g.ratio === 0) continue;
        const py = Math.round(this.Y(k * step)) + 0.5;
        ctx.moveTo(0, py); ctx.lineTo(W, py);
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.stroke();
    };
    if (minorPx >= 7) lines(g.minor, '#eef0f3', true);
    lines(g.major, '#d9dde3', false);
  };
  P.drawAxes = function () {
    const ctx = this.ctx, W = this.W, H = this.H;
    ctx.beginPath();
    const ax = Math.round(this.X(0)) + 0.5, ay = Math.round(this.Y(0)) + 0.5;
    if (ax >= 0 && ax <= W) { ctx.moveTo(ax, 0); ctx.lineTo(ax, H); }
    if (ay >= 0 && ay <= H) { ctx.moveTo(0, ay); ctx.lineTo(W, ay); }
    ctx.strokeStyle = '#4a4f57';
    ctx.lineWidth = 1.3;
    ctx.stroke();
  };
  P.drawLabels = function (g) {
    const ctx = this.ctx, W = this.W, H = this.H;
    ctx.save();
    ctx.font = '12px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = 'rgba(255,255,255,0.92)';
    ctx.lineJoin = 'round';
    ctx.fillStyle = '#3b4048';
    const step = g.major;
    const ay = this.Y(0), ax = this.X(0);
    // x labels
    let ly = ay + 4, base = 'top';
    if (ly > H - 17) { ly = H - 4; base = 'bottom'; }
    if (ay < 0) { ly = 4; base = 'top'; }
    ctx.textBaseline = base;
    ctx.textAlign = 'center';
    const kx0 = Math.ceil(this.wx(0) / step), kx1 = Math.floor(this.wx(W) / step);
    for (let k = kx0; k <= kx1 && k - kx0 < 400; k++) {
      if (k === 0) continue;
      const px = this.X(k * step);
      if (px < 8 || px > W - 8) continue;
      const s = fmtTick(k * step, step);
      const off = s[0] === '−' ? -3 : 0;
      ctx.strokeText(s, px + off, ly); ctx.fillText(s, px + off, ly);
    }
    // y labels
    let lx = ax - 5, align = 'right';
    if (ax < 30) { lx = Math.max(ax, 0) + 5; align = 'left'; }
    if (ax > W - 2) { lx = W - 5; align = 'right'; }
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    const ky0 = Math.ceil(this.wy(H) / step), ky1 = Math.floor(this.wy(0) / step);
    for (let k = ky0; k <= ky1 && k - ky0 < 400; k++) {
      if (k === 0) continue;
      const py = this.Y(k * step);
      if (py < 8 || py > H - 8) continue;
      const s = fmtTick(k * step, step);
      ctx.strokeText(s, lx, py); ctx.fillText(s, lx, py);
    }
    if (ax >= 0 && ax <= W && ay >= 0 && ay <= H) {
      ctx.textAlign = 'right'; ctx.textBaseline = 'top';
      ctx.strokeText('0', ax - 4, ay + 4); ctx.fillText('0', ax - 4, ay + 4);
    }
    ctx.restore();
  };

  // ------------------------------------------------------------ explicit curves
  P.explicitCached = function (f, swap, vkey) {
    const k = vkey + (swap ? 'y' : 'x');
    if (f.__gk === k) return f.__gc;
    let chains;
    try { chains = this.plotExplicit(f, swap); } catch (e) { chains = []; }
    f.__gk = k; f.__gc = chains;
    return chains;
  };
  P.plotExplicit = function (f, swap) {
    const self = this;
    const N = Math.ceil((swap ? this.H : this.W) * 2);
    const u0 = swap ? this.wy(this.H) : this.wx(0);
    const u1 = swap ? this.wy(0) : this.wx(this.W);
    const du = (u1 - u0) / N;
    const Lim = swap ? this.W : this.H;
    const sv = swap ? (v) => self.X(v) : (v) => self.Y(v);
    const su = swap ? (u) => self.Y(u) : (u) => self.X(u);
    const PAD = 4, MAXD = 11, JUMP = 3;
    const chains = [];
    let cur = null;
    let budget = 60000;
    const clamp = (p) => (p < -1e5 ? -1e5 : p > 1e5 ? 1e5 : p);
    const emit = (u, v) => {
      const a = su(u), b = clamp(sv(v));
      if (!cur) { cur = []; chains.push(cur); }
      if (swap) cur.push(b, a); else cur.push(a, b);
    };
    const line = (ua, va, ub, vb) => { if (!cur) emit(ua, va); emit(ub, vb); };
    const seg = (ua, va, ub, vb, depth) => {
      const fa = isFinite(va), fb = isFinite(vb);
      if (fa && fb) {
        const pa = sv(va), pb = sv(vb);
        if ((pa < -PAD && pb < -PAD) || (pa > Lim + PAD && pb > Lim + PAD)) { cur = null; return; }
        const d = Math.abs(pa - pb);
        if (d <= 1.25 || budget <= 0) { line(ua, va, ub, vb); return; }
        if (depth >= MAXD) {
          if (d > JUMP) cur = null; else line(ua, va, ub, vb);
          return;
        }
      } else if (!fa && !fb) { cur = null; return; } else if (depth >= MAXD || budget <= 0) { cur = null; return; }
      budget--;
      const um = 0.5 * (ua + ub);
      const vm = f(um);
      seg(ua, va, um, vm, depth + 1);
      seg(um, vm, ub, vb, depth + 1);
    };
    let pu = u0, pv = f(u0);
    for (let i = 1; i <= N; i++) {
      const u = u0 + i * du;
      const v = f(u);
      seg(pu, pv, u, v, 0);
      pu = u; pv = v;
    }
    // isolated defined samples (e.g. a single point) are ignored
    return chains.filter((c) => c.length >= 4);
  };

  // ------------------------------------------------------------ parametric / polar
  P.paramCached = function (it, f, vkey) {
    const k = vkey + '|' + it.t0 + '|' + it.t1;
    if (f.__gk === k) return f.__gc;
    let chains;
    try { chains = this.plotParam(it, f); } catch (e) { chains = []; }
    f.__gk = k; f.__gc = chains;
    return chains;
  };
  P.plotParam = function (it, f) {
    const self = this;
    let t0 = +it.t0, t1 = +it.t1;
    if (!isFinite(t0) || !isFinite(t1) || t0 === t1) return [];
    const polar = it.kind === 'polar';
    const deg = this.deg;
    const pt = (t) => {
      let x, y;
      if (polar) {
        const r = f(t);
        if (!isFinite(r)) return null;
        const th = deg ? t * D2R : t;
        x = r * Math.cos(th); y = r * Math.sin(th);
      } else {
        const p = f(t);
        if (!p) return null;
        x = p.x; y = p.y;
      }
      if (!isFinite(x) || !isFinite(y)) return null;
      return [self.X(x), self.Y(y)];
    };
    const N = 600, MAXD = 10;
    const chains = [];
    let cur = null, budget = 40000;
    const W = this.W, H = this.H;
    const off = (a, b) => (a[0] < -50 && b[0] < -50) || (a[0] > W + 50 && b[0] > W + 50) || (a[1] < -50 && b[1] < -50) || (a[1] > H + 50 && b[1] > H + 50);
    const clamp = (p) => [Math.max(-1e5, Math.min(1e5, p[0])), Math.max(-1e5, Math.min(1e5, p[1]))];
    const line = (A, B) => {
      if (!cur) { cur = []; chains.push(cur); const a = clamp(A); cur.push(a[0], a[1]); }
      const b = clamp(B); cur.push(b[0], b[1]);
    };
    const seg = (ta, A, tb, B, depth) => {
      if (A && B) {
        if (off(A, B) && depth > 2) { cur = null; return; }
        const d = Math.abs(A[0] - B[0]) + Math.abs(A[1] - B[1]);
        if (d <= 2.5 || budget <= 0) { line(A, B); return; }
        if (depth >= MAXD) { if (d > 12) cur = null; else line(A, B); return; }
      } else if (!A && !B) { if (depth >= 3) { cur = null; return; } } else if (depth >= MAXD || budget <= 0) { cur = null; return; }
      budget--;
      const tm = 0.5 * (ta + tb);
      const M = pt(tm);
      seg(ta, A, tm, M, depth + 1);
      seg(tm, M, tb, B, depth + 1);
    };
    let pa = t0, A = pt(t0);
    for (let i = 1; i <= N; i++) {
      const t = t0 + (t1 - t0) * i / N;
      const B = pt(t);
      seg(pa, A, t, B, 0);
      pa = t; A = B;
    }
    return chains.filter((c) => c.length >= 4);
  };

  // ------------------------------------------------------------ implicit curves (marching squares)
  P.contourCached = function (F, vkey, fill) {
    const k = vkey + (fill ? 'f' : 'c');
    if (F.__gk === k) return F.__gc;
    let res = null;
    try { res = this.contour(F, fill); } catch (e) { res = null; }
    F.__gk = k; F.__gc = res;
    return res;
  };
  P.contour = function (F, wantFill) {
    const W = this.W, H = this.H;
    const step = this.interacting ? (W * H > 350000 ? 5 : 4) : (W * H > 300000 ? 2.5 : 2);
    const du = step / this.ppu;
    const x0 = this.wx(0), y0 = this.wy(0);
    const nx = Math.ceil(W / step) + 1, ny = Math.ceil(H / step) + 1;
    const vals = new Float64Array(nx * ny);
    const have = new Uint8Array(nx * ny);
    const V = (i, j) => {
      const k = j * nx + i;
      if (!have[k]) { have[k] = 1; vals[k] = F(x0 + i * du, y0 - j * du); }
      return vals[k];
    };
    const K = 4;
    const cnx = Math.ceil((nx - 1) / K), cny = Math.ceil((ny - 1) / K);
    const flag = new Uint8Array(cnx * cny);
    const full = new Int8Array(cnx * cny);
    for (let cj = 0; cj < cny; cj++) {
      for (let ci = 0; ci < cnx; ci++) {
        const i0 = ci * K, i1 = Math.min(i0 + K, nx - 1), j0 = cj * K, j1 = Math.min(j0 + K, ny - 1);
        const a = V(i0, j0), b = V(i1, j0), c = V(i1, j1), d = V(i0, j1);
        let fin = 0, pos = 0, mn = Infinity, mx = -Infinity, mabs = Infinity;
        for (let q = 0; q < 4; q++) {
          const v = q === 0 ? a : q === 1 ? b : q === 2 ? c : d;
          if (isFinite(v)) { fin++; if (v > 0) pos++; if (v < mn) mn = v; if (v > mx) mx = v; const av = v < 0 ? -v : v; if (av < mabs) mabs = av; }
        }
        const idx = cj * cnx + ci;
        if (fin === 4 && (pos === 0 || pos === 4)) {
          full[idx] = pos ? 1 : -1;
          if (mabs < 0.5 * (mx - mn)) flag[idx] = 1;
        } else if (fin === 0) full[idx] = -1;
        else flag[idx] = 1;
      }
    }
    const fl2 = flag;
    const segK = [], segP = [];
    const fillPath = wantFill ? new Path2D() : null;
    const HK = (i, j) => (j * nx + i) * 2, VK = (i, j) => (j * nx + i) * 2 + 1;
    // --- fill: merge horizontal runs of fully-satisfied cells, polygons for partial cells
    if (wantFill) {
      const poly = (i, j, a, b, c, d) => {
        const fa = isFinite(a), fb = isFinite(b), fc = isFinite(c), fd = isFinite(d);
        const pa = fa && a > 0, pb = fb && b > 0, pc = fc && c > 0, pd = fd && d > 0;
        const pts = [];
        const ed = (p, q, fp, fq, pp, pq, x1, y1, x2, y2) => {
          if (pp) pts.push(x1, y1);
          if (pp !== pq) { const t = fp && fq ? p / (p - q) : 0.5; pts.push(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t); }
        };
        const X0 = i * step, Y0 = j * step, X1 = X0 + step, Y1 = Y0 + step;
        ed(a, b, fa, fb, pa, pb, X0, Y0, X1, Y0);
        ed(b, c, fb, fc, pb, pc, X1, Y0, X1, Y1);
        ed(c, d, fc, fd, pc, pd, X1, Y1, X0, Y1);
        ed(d, a, fd, fa, pd, pa, X0, Y1, X0, Y0);
        if (pts.length >= 6) {
          fillPath.moveTo(pts[0], pts[1]);
          for (let q = 2; q < pts.length; q += 2) fillPath.lineTo(pts[q], pts[q + 1]);
          fillPath.closePath();
        }
      };
      for (let cj = 0; cj < cny; cj++) {
        const j0 = cj * K, j1 = Math.min(j0 + K, ny - 1);
        let rowFlag = false;
        for (let ci = 0; ci < cnx; ci++) if (fl2[cj * cnx + ci]) { rowFlag = true; break; }
        const rowsList = rowFlag ? [] : [[j0, j1]];
        if (rowFlag) for (let j = j0; j < j1; j++) rowsList.push([j, j + 1]);
        for (const rr of rowsList) {
          const ja = rr[0], jb = rr[1];
          let run = -1;
          const close = (iEnd) => { if (run >= 0) { fillPath.rect(run * step, ja * step, (iEnd - run) * step, (jb - ja) * step); run = -1; } };
          for (let ci = 0; ci < cnx; ci++) {
            const idx = cj * cnx + ci;
            const i0 = ci * K, i1 = Math.min(i0 + K, nx - 1);
            if (!fl2[idx]) {
              if (full[idx] === 1) { if (run < 0) run = i0; } else close(i0);
              continue;
            }
            for (let i = i0; i < i1; i++) {
              const a = V(i, ja), b = V(i + 1, ja), c = V(i + 1, ja + 1), d = V(i, ja + 1);
              if (a > 0 && b > 0 && c > 0 && d > 0) { if (run < 0) run = i; continue; }
              close(i);
              if (a > 0 || b > 0 || c > 0 || d > 0) poly(i, ja, a, b, c, d);
            }
          }
          close(nx - 1);
        }
      }
    }
    // --- contour segments
    for (let cj = 0; cj < cny; cj++) {
      for (let ci = 0; ci < cnx; ci++) {
        if (!fl2[cj * cnx + ci]) continue;
        const i0 = ci * K, i1 = Math.min(i0 + K, nx - 1), j0 = cj * K, j1 = Math.min(j0 + K, ny - 1);
        for (let j = j0; j < j1; j++) {
          for (let i = i0; i < i1; i++) {
            const a = V(i, j), b = V(i + 1, j), c = V(i + 1, j + 1), d = V(i, j + 1);
            const fa = isFinite(a), fb = isFinite(b), fc = isFinite(c), fd = isFinite(d);
            const pa = fa && a > 0, pb = fb && b > 0, pc = fc && c > 0, pd = fd && d > 0;
            let ncr = 0;
            if (fa && fb && pa !== pb) ncr++;
            if (fb && fc && pb !== pc) ncr++;
            if (fd && fc && pd !== pc) ncr++;
            if (fa && fd && pa !== pd) ncr++;
            if (ncr !== 2 && ncr !== 4) continue;
            let mx = 0;
            if (fa) mx = Math.max(mx, Math.abs(a));
            if (fb) mx = Math.max(mx, Math.abs(b));
            if (fc) mx = Math.max(mx, Math.abs(c));
            if (fd) mx = Math.max(mx, Math.abs(d));
            const ptX = (e) => (e === 0 ? i + a / (a - b) : e === 1 ? i + 1 : e === 2 ? i + d / (d - c) : i);
            const ptY = (e) => (e === 0 ? j : e === 1 ? j + b / (b - c) : e === 2 ? j + 1 : j + a / (a - d));
            const key = (e) => (e === 0 ? HK(i, j) : e === 1 ? VK(i + 1, j) : e === 2 ? HK(i, j + 1) : VK(i, j));
            const pushSeg = (e1, e2) => {
              const ax = ptX(e1), ay = ptY(e1), bx = ptX(e2), by = ptY(e2);
              // reject sign changes caused by poles: |F| mid-segment must be small
              const vm = F(x0 + (ax + bx) * 0.5 * du, y0 - (ay + by) * 0.5 * du);
              if (!isFinite(vm) || Math.abs(vm) > 0.5 * mx) return;
              segK.push(key(e1), key(e2));
              segP.push(ax * step, ay * step, bx * step, by * step);
            };
            if (ncr === 2) {
              const cr = [];
              if (fa && fb && pa !== pb) cr.push(0);
              if (fb && fc && pb !== pc) cr.push(1);
              if (fd && fc && pd !== pc) cr.push(2);
              if (fa && fd && pa !== pd) cr.push(3);
              pushSeg(cr[0], cr[1]);
            } else {
              const pm = F(x0 + (i + 0.5) * du, y0 - (j + 0.5) * du) > 0;
              if (pa !== pm) pushSeg(3, 0);
              if (pb !== pm) pushSeg(0, 1);
              if (pc !== pm) pushSeg(1, 2);
              if (pd !== pm) pushSeg(2, 3);
            }
          }
        }
      }
    }
    return { chains: linkSegments(segK, segP), fill: fillPath };
  };

  function linkSegments(K, Pn) {
    const n = K.length / 2;
    const map = new Map();
    const add = (k, s) => { const l = map.get(k); if (l) l.push(s); else map.set(k, [s]); };
    for (let s = 0; s < n; s++) { add(K[2 * s], s); add(K[2 * s + 1], s); }
    const used = new Uint8Array(n);
    const chains = [];
    const walk = (key, out) => {
      for (;;) {
        const l = map.get(key);
        let nx = -1;
        if (l) for (const s of l) if (!used[s]) { nx = s; break; }
        if (nx < 0) return;
        used[nx] = 1;
        if (K[2 * nx] === key) { out.push(Pn[4 * nx + 2], Pn[4 * nx + 3]); key = K[2 * nx + 1]; } else { out.push(Pn[4 * nx], Pn[4 * nx + 1]); key = K[2 * nx]; }
      }
    };
    for (let s = 0; s < n; s++) {
      if (used[s]) continue;
      used[s] = 1;
      const fwd = [Pn[4 * s], Pn[4 * s + 1], Pn[4 * s + 2], Pn[4 * s + 3]];
      walk(K[2 * s + 1], fwd);
      const back = [];
      walk(K[2 * s], back);
      if (back.length) {
        const rev = [];
        for (let i = back.length - 2; i >= 0; i -= 2) rev.push(back[i], back[i + 1]);
        chains.push(rev.concat(fwd));
      } else chains.push(fwd);
    }
    return chains;
  }

  // ------------------------------------------------------------ points, POIs, trace
  P.drawDot = function (x, y, r, fill, ring) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    if (ring) { ctx.lineWidth = 2; ctx.strokeStyle = ring; ctx.stroke(); }
  };
  P.drawLabel = function (px, py, text, color) {
    const ctx = this.ctx;
    ctx.save();
    ctx.font = '600 13px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
    const w = ctx.measureText(text).width + 12, h = 22;
    let x = px + 9, y = py - h - 7;
    if (x + w > this.W - 2) x = px - w - 9;
    if (x < 2) x = 2;
    if (y < 2) y = py + 9;
    if (y + h > this.H - 2) y = this.H - h - 2;
    ctx.fillStyle = 'rgba(255,255,255,0.96)';
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, 5); else ctx.rect(x, y, w, h);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = color || '#22262c';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText(text, x + 6, y + h / 2 + 0.5);
    ctx.restore();
  };
  const coordText = (x, y) => '(' + Core.formatCoord(x) + ', ' + Core.formatCoord(y) + ')';
  P.drawPoints = function () {
    const labels = [];
    for (const it of this.items) {
      if (it.kind !== 'pts') continue;
      (it.series || []).forEach((sr, si) => {
        sr.pts.forEach((p, i) => {
          if (!isFinite(p[0]) || !isFinite(p[1])) return;
          const px = this.X(p[0]), py = this.Y(p[1]);
          if (px < -10 || py < -10 || px > this.W + 10 || py > this.H + 10) return;
          this.drawDot(px, py, it.id === this.selId ? 6 : 5, sr.color || it.color, null);
          const key = it.id + ':' + si + ':' + i;
          if ((it.labels && sr.pts.length <= 12) !== this.ptOpen.has(key)) labels.push([px, py, coordText(p[0], p[1])]);
        });
      });
    }
    labels.forEach((l) => this.drawLabel(l[0], l[1], l[2]));
  };
  P.drawPOIs = function () {
    const open = [];
    this.pois.forEach((p, i) => {
      const px = this.X(p.x), py = this.Y(p.y);
      if (px < -8 || py < -8 || px > this.W + 8 || py > this.H + 8) return;
      this.drawDot(px, py, 5, POI_GREY, '#ffffff');
      if (this.poiOpen.has(i)) open.push([px, py, coordText(p.x, p.y)]);
    });
    open.forEach((l) => this.drawLabel(l[0], l[1], l[2]));
  };
  P.drawTrace = function () {
    const t = this.trace;
    if (!t) return;
    const px = this.X(t.x), py = this.Y(t.y);
    if (!isFinite(px) || !isFinite(py)) return;
    this.drawDot(px, py, 6.5, '#ffffff', t.color);
    this.drawDot(px, py, 3, t.color, null);
    this.drawLabel(px, py, coordText(t.x, t.y));
  };

  P.computePOIs = function () {
    if (this.selId == null) { this.pois = []; return; }
    const view = { xmin: this.wx(0), xmax: this.wx(this.W), ymin: this.wy(this.H), ymax: this.wy(0), n: Math.min(1400, Math.max(400, Math.round(this.W * 1.5))) };
    const toWorld = (ch) => { const o = new Float64Array(ch.length); for (let i = 0; i < ch.length; i += 2) { o[i] = this.wx(ch[i]); o[i + 1] = this.wy(ch[i + 1]); } return o; };
    const desc = (c) => c.type === 'fx' ? { type: 'fx', f: c.f, id: c.id } : c.type === 'fy' ? { type: 'fy', f: c.f, id: c.id } : c.type === 'F' ? { type: 'F', F: c.F, id: c.id, chains: c.chains.map(toWorld) } : null;
    const all = this.curves.filter((c) => c.type !== 'param');
    const sel = all.filter((c) => c.id === this.selId);
    const res = [];
    try {
      sel.forEach((s) => {
        const others = all.filter((c) => c !== s).map(desc).filter(Boolean);
        Core.findPOIs(desc(s), others, view).forEach((p) => {
          if (!res.some((q) => Math.abs(this.X(q.x) - this.X(p.x)) < 1 && Math.abs(this.Y(q.y) - this.Y(p.y)) < 1)) res.push(p);
        });
      });
    } catch (e) { /* ignore */ }
    const old = this.pois;
    const keep = new Set();
    this.poiOpen.forEach((i) => {
      const o = old[i];
      if (!o) return;
      const j = res.findIndex((p) => Math.abs(p.x - o.x) < 1e-6 * (1 + Math.abs(o.x)) && Math.abs(p.y - o.y) < 1e-6 * (1 + Math.abs(o.y)));
      if (j >= 0) keep.add(j);
    });
    this.poiOpen = keep;
    this.pois = res;
  };

  // ------------------------------------------------------------ hit testing
  P.hitTest = function (px, py, touch) {
    const R = touch ? 22 : 12;
    let best = null;
    this.pois.forEach((p, i) => {
      const d = Math.hypot(this.X(p.x) - px, this.Y(p.y) - py);
      if (d < R && (!best || d < best.d)) best = { type: 'poi', i: i, d: d };
    });
    if (best) return best;
    for (const it of this.items) {
      if (it.kind !== 'pts') continue;
      (it.series || []).forEach((sr, si) => sr.pts.forEach((p, i) => {
        const d = Math.hypot(this.X(p[0]) - px, this.Y(p[1]) - py);
        if (d < R && (!best || d < best.d)) best = { type: 'pt', key: it.id + ':' + si + ':' + i, id: it.id, d: d };
      }));
    }
    if (best) return best;
    for (const c of this.curves) {
      const d = this.distToCurve(c, px, py, R);
      if (d < R && (!best || d < best.d)) best = { type: 'curve', c: c, d: d };
    }
    return best;
  };
  P.distToCurve = function (c, px, py, R) {
    let best = Infinity;
    const R2 = R + 4;
    for (const ch of c.chains) {
      for (let i = 0; i + 3 < ch.length; i += 2) {
        const ax = ch[i], ay = ch[i + 1], bx = ch[i + 2], by = ch[i + 3];
        if ((ax < px - R2 && bx < px - R2) || (ax > px + R2 && bx > px + R2) || (ay < py - R2 && by < py - R2) || (ay > py + R2 && by > py + R2)) continue;
        const dx = bx - ax, dy = by - ay;
        const L = dx * dx + dy * dy;
        let t = L ? ((px - ax) * dx + (py - ay) * dy) / L : 0;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const d = Math.hypot(ax + t * dx - px, ay + t * dy - py);
        if (d < best) best = d;
      }
    }
    return best;
  };
  P.tracePoint = function (c, px, py) {
    // snap to a POI of this curve when close
    for (const p of this.pois) {
      if (Math.hypot(this.X(p.x) - px, this.Y(p.y) - py) < 14) return { x: p.x, y: p.y };
    }
    if (c.type === 'fx') { const x = this.wx(px), y = c.f(x); if (isFinite(y)) return { x: x, y: y }; }
    if (c.type === 'fy') { const y = this.wy(py), x = c.f(y); if (isFinite(x)) return { x: x, y: y }; }
    // nearest point on polyline
    let best = Infinity, bx = 0, by = 0;
    for (const ch of c.chains) {
      for (let i = 0; i + 3 < ch.length; i += 2) {
        const ax = ch[i], ay = ch[i + 1], dx = ch[i + 2] - ax, dy = ch[i + 3] - ay;
        const L = dx * dx + dy * dy;
        let t = L ? ((px - ax) * dx + (py - ay) * dy) / L : 0;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const qx = ax + t * dx, qy = ay + t * dy;
        const d = (qx - px) * (qx - px) + (qy - py) * (qy - py);
        if (d < best) { best = d; bx = qx; by = qy; }
      }
    }
    if (!isFinite(best)) return null;
    let x = this.wx(bx), y = this.wy(by);
    if (c.type === 'F') {
      // project onto F = 0 with a couple of gradient steps
      const F = c.F, h = 1e-6 / Math.max(1e-12, this.ppu) * 50;
      for (let k = 0; k < 3; k++) {
        const v = F(x, y), gx = (F(x + h, y) - v) / h, gy = (F(x, y + h) - v) / h;
        const g2 = gx * gx + gy * gy;
        if (!isFinite(v) || !isFinite(g2) || g2 === 0) break;
        const nx = x - v * gx / g2, ny = y - v * gy / g2;
        if (Math.hypot(nx - x, ny - y) * this.ppu > 4) break;
        x = nx; y = ny;
      }
    }
    return { x: x, y: y };
  };

  // ------------------------------------------------------------ input
  P.bind = function () {
    const c = this.canvas;
    const pos = (e) => { const r = c.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    c.addEventListener('pointerdown', (e) => {
      if (e.button !== undefined && e.button > 0) return;
      e.preventDefault();
      try { c.setPointerCapture(e.pointerId); } catch (ex) { /* ignore */ }
      const p = pos(e);
      this.ptrs.set(e.pointerId, p);
      const touch = e.pointerType === 'touch' || e.pointerType === 'pen';
      if (this.ptrs.size === 1) {
        this.down = { x: p.x, y: p.y, cx: this.cx, cy: this.cy, moved: false, t: Date.now() };
        const hit = this.hitTest(p.x, p.y, touch);
        this.downHit = hit;
        if (hit && hit.type === 'curve') {
          this.mode = 'trace';
          this.select(hit.c.id);
          this.traceCurve = hit.c;
          this.updateTrace(p.x, p.y);
        } else this.mode = 'pan';
      } else if (this.ptrs.size === 2) {
        const pts = Array.from(this.ptrs.values());
        const cxp = (pts[0].x + pts[1].x) / 2, cyp = (pts[0].y + pts[1].y) / 2;
        this.pinch = { d: Math.max(10, Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)), wx: this.wx(cxp), wy: this.wy(cyp), ppu: this.ppu };
        this.mode = 'pinch';
        this.interacting = true;
      }
    });
    c.addEventListener('pointermove', (e) => {
      if (!this.ptrs.has(e.pointerId)) return;
      const p = pos(e);
      this.ptrs.set(e.pointerId, p);
      if (this.mode === 'pinch' && this.ptrs.size >= 2) {
        const pts = Array.from(this.ptrs.values());
        const d = Math.max(10, Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y));
        const cxp = (pts[0].x + pts[1].x) / 2, cyp = (pts[0].y + pts[1].y) / 2;
        this.ppu = Math.min(1e12, Math.max(1e-9, this.pinch.ppu * d / this.pinch.d));
        this.cx = this.pinch.wx - (cxp - this.W / 2) / this.ppu;
        this.cy = this.pinch.wy + (cyp - this.H / 2) / this.ppu;
        this.viewChanged(false);
        return;
      }
      if (!this.down) return;
      const dx = p.x - this.down.x, dy = p.y - this.down.y;
      if (!this.down.moved && Math.hypot(dx, dy) > 6) this.down.moved = true;
      if (this.mode === 'pan' && this.down.moved) {
        this.interacting = true;
        this.cx = this.down.cx - dx / this.ppu;
        this.cy = this.down.cy + dy / this.ppu;
        this.viewChanged(false);
      } else if (this.mode === 'trace') {
        this.updateTrace(p.x, p.y);
      }
    });
    const up = (e) => {
      if (!this.ptrs.has(e.pointerId)) return;
      this.ptrs.delete(e.pointerId);
      if (this.mode === 'pinch') {
        if (this.ptrs.size === 0) { this.mode = null; this.down = null; this.viewChanged(true); }
        else { this.mode = 'pinch-end'; }
        return;
      }
      if (this.mode === 'pinch-end') { if (!this.ptrs.size) { this.mode = null; this.down = null; } return; }
      if (this.down && !this.down.moved && this.mode === 'pan') {
        const hit = this.downHit;
        if (hit && hit.type === 'poi') {
          if (this.poiOpen.has(hit.i)) this.poiOpen.delete(hit.i); else this.poiOpen.add(hit.i);
          this.request();
        } else if (hit && hit.type === 'pt') {
          if (this.ptOpen.has(hit.key)) this.ptOpen.delete(hit.key); else this.ptOpen.add(hit.key);
          this.request();
        } else {
          this.trace = null;
          this.select(null);
          this.request();
        }
      }
      if (this.mode === 'pan' && this.down && this.down.moved) this.viewChanged(true);
      this.mode = null;
      this.down = null;
    };
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', up);
    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      const p = pos(e);
      let dy = e.deltaY;
      if (e.deltaMode === 1) dy *= 16; else if (e.deltaMode === 2) dy *= 400;
      this.interacting = true;
      const f = Math.exp(-Math.max(-300, Math.min(300, dy)) * 0.0022);
      const wx = this.wx(p.x), wy = this.wy(p.y);
      this.ppu = Math.min(1e12, Math.max(1e-9, this.ppu * f));
      this.cx = wx - (p.x - this.W / 2) / this.ppu;
      this.cy = wy + (p.y - this.H / 2) / this.ppu;
      this.viewChanged(true);
    }, { passive: false });
  };
  P.updateTrace = function (px, py) {
    const c = this.traceCurve;
    if (!c) return;
    const p = this.tracePoint(c, px, py);
    if (p) { this.trace = { id: c.id, x: p.x, y: p.y, color: c.color }; this.request(); }
  };

  G.SatCalcGraph = Graph;
})(typeof globalThis !== 'undefined' ? globalThis : window);
