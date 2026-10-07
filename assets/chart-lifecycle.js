/* Own chart instances, delayed work and one coalesced resize listener. */
(function (global) {
  'use strict';
  function createManager(host) {
    var scopes = new Map();
    var renders = new Map();
    var frame = null;
    var listening = false;
    var observer = null;
    var observed = new Map();
    function runResize() {
      frame = null;
      scopes.forEach(function (scope) { scope.resize(); });
    }
    function onResize() {
      if (frame === null) frame = host.requestAnimationFrame(runResize);
    }
    function listen() {
      if (!listening) { host.addEventListener('resize',onResize); listening=true; }
    }
    function stopIfIdle() {
      if (scopes.size || renders.size) return;
      if (frame!==null) { host.cancelAnimationFrame(frame); frame=null; }
      if (listening) { host.removeEventListener('resize',onResize); listening=false; }
      if (observer) { observer.disconnect(); observer=null; }
      observed.clear();
    }
    function cancelRender(key) {
      if (renders.has(key)) { host.clearTimeout(renders.get(key)); renders.delete(key); }
    }
    function begin(key) {
      cancelRender(key);
      if (scopes.has(key)) scopes.get(key).dispose();
      var charts = new Set(), timers = new Map(), cleanups = [], elements = new Set(), beforeResize = null, active = true;
      var scope = {
        track:function (chart) { if (active) charts.add(chart); else if (!chart.isDisposed || !chart.isDisposed()) chart.dispose(); return chart; },
        release:function (chart) {
          if (!charts.delete(chart)) return;
          if (!chart.isDisposed || !chart.isDisposed()) chart.dispose();
        },
        cleanup:function (callback) { if (active) cleanups.push(callback); else callback(); },
        observe:function (element) {
          if (!active || typeof host.ResizeObserver!=='function' || elements.has(element)) return;
          if (!observer) observer = new host.ResizeObserver(onResize);
          elements.add(element); observed.set(element,scope); observer.observe(element);
        },
        beforeResize:function (callback) { beforeResize=callback; },
        resize:function () {
          if (!active) return;
          if (beforeResize) beforeResize();
          charts.forEach(function (chart) { if (!chart.isDisposed || !chart.isDisposed()) chart.resize(); });
        },
        schedule:function (name,callback,delay) {
          if (timers.has(name)) host.clearTimeout(timers.get(name));
          var timer=host.setTimeout(function () {
            timers.delete(name);
            if (active) callback();
          },delay);
          timers.set(name,timer);
        },
        dispose:function () {
          if (!active) return;
          active=false;
          cleanups.splice(0).forEach(function (callback) { try { callback(); } catch (_) {} });
          elements.forEach(function (element) {
            if (observed.get(element)===scope) { observer?.unobserve(element); observed.delete(element); }
          });
          elements.clear();
          timers.forEach(function (timer) { host.clearTimeout(timer); });
          timers.clear();
          charts.forEach(function (chart) { if (!chart.isDisposed || !chart.isDisposed()) chart.dispose(); });
          charts.clear();
          if (scopes.get(key)===scope) scopes.delete(key);
          stopIfIdle();
        }
      };
      scopes.set(key,scope);
      listen();
      return scope;
    }
    return {
      begin:begin,
      scheduleRender:function (key,callback,delay) {
        cancelRender(key);
        renders.set(key,host.setTimeout(function () { renders.delete(key); callback(); },delay));
      },
      dispose:function () {
        Array.from(scopes.values()).forEach(function (scope) { scope.dispose(); });
        renders.forEach(function (timer) { host.clearTimeout(timer); });
        renders.clear();
        if (frame!==null) { host.cancelAnimationFrame(frame); frame=null; }
        if (listening) { host.removeEventListener('resize',onResize); listening=false; }
        if (observer) { observer.disconnect(); observer=null; }
        observed.clear();
      }
    };
  }
  global.createGameChartLifecycle = createManager;
  if (global.document) global.GameChartLifecycle = createManager(global);
})(typeof window!=='undefined'?window:globalThis);
