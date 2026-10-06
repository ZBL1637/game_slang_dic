/* Own chart instances, delayed work and one coalesced resize listener. */
(function (global) {
  'use strict';
  function createManager(host) {
    var scopes = new Map();
    var renders = new Map();
    var frame = null;
    var listening = false;
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
    function cancelRender(key) {
      if (renders.has(key)) { host.clearTimeout(renders.get(key)); renders.delete(key); }
    }
    function begin(key) {
      cancelRender(key);
      if (scopes.has(key)) scopes.get(key).dispose();
      var charts = new Set(), timers = new Map(), beforeResize = null, active = true;
      var scope = {
        track:function (chart) { charts.add(chart); return chart; },
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
          timers.forEach(function (timer) { host.clearTimeout(timer); });
          timers.clear();
          charts.forEach(function (chart) { if (!chart.isDisposed || !chart.isDisposed()) chart.dispose(); });
          charts.clear();
          if (scopes.get(key)===scope) scopes.delete(key);
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
      }
    };
  }
  global.createGameChartLifecycle = createManager;
  if (global.document) global.GameChartLifecycle = createManager(global);
})(typeof window!=='undefined'?window:globalThis);
