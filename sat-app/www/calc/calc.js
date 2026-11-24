/*
 * Graphing Calculator — public entry point (window.SatCalc).
 *
 * Load order (plain <script> tags, no modules; KaTeX optional but recommended):
 *   1. ../vendor/katex/katex.min.css   (stylesheet)  +  calc/calc.css
 *   2. ../vendor/katex/katex.min.js    (optional pretty math)
 *   3. calc/parser.js   – math engine (SatCalcCore; also runs in Node)
 *   4. calc/graph.js    – canvas graph view (SatCalcGraph)
 *   5. calc/ui.js       – user interface (SatCalcApp)
 *   6. calc/calc.js     – this file: window.SatCalc API
 *
 * API:
 *   SatCalc.mount(containerEl)  build the UI inside the container (fills it, tracks resize)
 *   SatCalc.getState()          JSON-serialisable state
 *   SatCalc.setState(state)     restore (tolerates null / partial / garbage)
 *   SatCalc.reset()             clear everything
 *   SatCalc.onChange = fn       called (debounced) with getState() whenever state changes
 */
(function (G) {
  'use strict';
  if (!G.SatCalcCore || !G.SatCalcGraph || !G.SatCalcApp) {
    if (G.console) G.console.error('SatCalc: load parser.js, graph.js and ui.js before calc.js');
    return;
  }
  let app = null;
  const getApp = () => (app || (app = new G.SatCalcApp()));
  const api = {
    onChange: null,
    mount: function (el) {
      if (!el || typeof el.appendChild !== 'function') throw new Error('SatCalc.mount needs a container element');
      getApp().mount(el);
      return api;
    },
    getState: function () {
      try { return getApp().getState(); } catch (e) { return null; }
    },
    setState: function (s) {
      try { getApp().setState(s); } catch (e) {
        if (G.console) G.console.warn('SatCalc.setState: ignoring bad state', e);
        try { getApp().setState(null); } catch (e2) { /* ignore */ }
      }
    },
    reset: function () { getApp().reset(); },
    // for tests / debugging
    _app: getApp
  };
  G.SatCalc = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
