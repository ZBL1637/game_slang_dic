import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {createHash} from 'node:crypto';

const assets = new URL('../assets/', import.meta.url);
const helper = await fs.readFile(new URL('chart-lifecycle.js', assets), 'utf8');
const charts = await Promise.all([1,2,3,4].map(n => fs.readFile(new URL('chart'+n+'.js',assets),'utf8')));
const names = ['createTermDistributionChart','createGameSentimentCharts','createTermSentimentRadarChart','createMultiGameRadarCharts'];
// Captured from the pre-lifecycle versions, including all data, options and formatter functions.
const originalOptions = [
  '0cfdd13a556c08e3a228e519f8ee47bfa80627a03215b5a3f8471235c8f4690e',
  '342f229949e5fb96374c5177899b3354bc5fdde9e5c28dfff9386074040cc2fc',
  'c2e49c4334ddc911ca4dbc1555f355c6a84997e5d9331d30e9707e3d7e660d51',
  '10bd9631be414e5918d94c31bc52d392df490ec65e18a7a00b090dc2226079d9'
];
function harness(width=1440) {
  const listeners = new Map(), timers=new Map(), frames=new Map(), instances=[];
  const instanceByDom = new WeakMap(), roots={};
  let nextId=0;
  class Element {
    constructor(root=false) { this.root=root; this.parent=null; this.children=[]; this.style={}; }
    get connected() { return this.root || Boolean(this.parent?.connected); }
    get offsetWidth() { return this.connected ? Math.max(0,host.innerWidth-160) : 0; }
    appendChild(child) { child.parent=this; this.children.push(child); return child; }
    set innerHTML(value) { this.children.forEach(child=>{child.parent=null;}); this.children=[]; this.content=value; }
  }
  for(let n=1;n<=4;n++) roots['chart'+n]=new Element(true);
  const host = {
    innerWidth:width,
    document:{getElementById:id=>roots[id],createElement:()=>new Element()},
    console:{log(){},warn(){},error(){}},
    addEventListener(type,fn) { if(!listeners.has(type)) listeners.set(type,new Set()); listeners.get(type).add(fn); },
    removeEventListener(type,fn) { listeners.get(type)?.delete(fn); },
    setTimeout(fn) { const id=++nextId;timers.set(id,fn);return id; },
    clearTimeout(id) {timers.delete(id);},
    requestAnimationFrame(fn) {const id=++nextId;frames.set(id,fn);return id;},
    cancelAnimationFrame(id) {frames.delete(id);},
    echarts:{
      getInstanceByDom:node=>instanceByDom.get(node),
      init(node) {
        const instance={
          node,disposed:false,resizeCount:0,option:null,
          setOption(option) {this.option=option;},
          isDisposed(){return this.disposed;},
          dispose(){this.disposed=true;instanceByDom.delete(node);},
          resize(){assert.equal(this.disposed,false,'disposed instances must not resize');assert.equal(this.node.connected,true,'detached instances must not resize');this.resizeCount++;}
        };
        instances.push(instance);instanceByDom.set(node,instance);return instance;
      }
    }
  };
  host.window=host;
  vm.createContext(host);
  vm.runInContext(helper,host);
  charts.forEach((code,index)=>vm.runInContext(code,host,{filename:'chart'+(index+1)+'.js'}));
  return {
    host,roots,listeners,timers,frames,instances,
    init(){names.forEach(name=>host[name]());},
    emit(type){Array.from(listeners.get(type)||[]).forEach(fn=>fn());},
    flushTimers(){while(timers.size){const [id,fn]=timers.entries().next().value;timers.delete(id);fn();}},
    flushFrame(){const batch=Array.from(frames);frames.clear();batch.forEach(([,fn])=>fn());},
    active(){return instances.filter(instance=>!instance.disposed);}
  };
}
function digest(options) {
  return createHash('sha256').update(JSON.stringify(options,(_key,value)=>typeof value==='function'?value.toString():value)).digest('hex');
}

test('every chart keeps its exact original data, visual options and formatter functions',()=>{
  const h=harness();
  names.forEach((name,index)=>{
    const before=h.instances.length;
    h.host[name]();
    assert.equal(digest(h.instances.slice(before).map(instance=>instance.option)),originalOptions[index]);
  });
});

test('language redraw disposes every replaced child and keeps one resize listener',()=>{
  const h=harness();h.init();h.flushTimers();
  assert.equal(h.active().length,28);
  assert.equal(h.listeners.get('resize').size,1);
  const initial=h.instances.slice();
  h.emit('languagechange');h.flushTimers();
  assert.ok(initial.every(instance=>instance.disposed));
  assert.equal(h.active().length,28);
  assert.ok(h.active().every(instance=>instance.node.connected));
  assert.equal(h.listeners.get('resize').size,1);
  h.emit('resize');h.flushFrame();h.flushTimers();
  assert.ok(h.active().every(instance=>instance.resizeCount===1));
});

test('rapid resize and language changes coalesce work and cancel stale delayed redraws',()=>{
  const h=harness();h.init();
  h.emit('languagechange');h.emit('languagechange');h.emit('languagechange');
  assert.equal(h.timers.size,2,'only current pie height and last chart3 redraw remain');
  const chart3Before=h.instances.filter(instance=>instance.node===h.roots.chart3).length;
  h.flushTimers();
  assert.equal(h.instances.filter(instance=>instance.node===h.roots.chart3).length,chart3Before+1);
  assert.equal(h.active().length,28);
  h.emit('resize');h.emit('resize');h.emit('resize');
  assert.equal(h.frames.size,1);
  h.flushFrame();
  assert.equal(h.timers.size,1,'only one current pie height update');
  assert.ok(h.active().every(instance=>instance.resizeCount===1));
  h.host.GameChartLifecycle.dispose();
  assert.equal(h.active().length,0);
  assert.equal(h.timers.size,0);
  assert.equal(h.frames.size,0);
  assert.equal(h.listeners.get('resize').size,0);
});

test('radar grid switches to one phone column before resize and releases fixed page height',()=>{
  const h=harness();h.init();h.flushTimers();
  const radarGrid=h.roots.chart4.children[2];
  assert.equal(radarGrid.style.gridTemplateColumns,'repeat(3, minmax(0, 1fr))');
  assert.equal(h.roots.chart4.style.height,'auto');
  h.host.innerWidth=390;
  h.emit('resize');h.flushFrame();h.flushTimers();
  assert.equal(radarGrid.style.gridTemplateColumns,'repeat(1, minmax(0, 1fr))');
  assert.ok(radarGrid.children.every(element=>element.style.minWidth==='0' && element.style.height==='400px'));
  assert.ok(Number.isFinite(parseFloat(h.roots.chart2.style.height)));
  assert.doesNotMatch(h.roots.chart2.style.height,/Infinity|NaN/);
  h.host.innerWidth=800;h.emit('resize');h.flushFrame();
  assert.equal(radarGrid.style.gridTemplateColumns,'repeat(2, minmax(0, 1fr))');
});
