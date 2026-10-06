/* Adapted from the reference co-occurrence graph; filtering precedes deterministic layout. */
(function (global) {
  'use strict';
  const LIMITS = Object.freeze({ weight: 24, topK: 1, nodeValue: 140, maxNodes: 96, maxEdges: 140 });
  const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));

  function filterGraph(raw) {
    if (!raw || !Array.isArray(raw.nodes) || !Array.isArray(raw.links)) throw new TypeError('Invalid graph data');
    const byId = new Map();
    for (const input of raw.nodes) {
      if (!input || typeof input.id !== 'string' || !input.id || byId.has(input.id)) continue;
      byId.set(input.id, { id: input.id, name: String(input.name || input.id), value: number(input.value),
        doc_freq: input.doc_freq == null ? null : number(input.doc_freq), category: String(input.category || '其他') });
    }
    let links = raw.links.filter(link => link && byId.has(link.source) && byId.has(link.target) && number(link.value) >= LIMITS.weight)
      .map(link => ({ source: link.source, target: link.target, value: number(link.value) }));
    // Top one is taken for every original node BEFORE the frequency/size filters.
    // The union can therefore give an individual retained node more than one link.
    const adjacency = new Map([...byId.keys()].map(id => [id, []]));
    for (const link of links) { adjacency.get(link.source).push(link); adjacency.get(link.target).push(link); }
    const kept = new Set();
    for (const edges of adjacency.values()) {
      edges.sort((a, b) => b.value - a.value);
      edges.slice(0, LIMITS.topK).forEach(link => kept.add(link));
    }
    links = [...kept];
    const activeIds = new Set(links.flatMap(link => [link.source, link.target]));
    const nodes = [...byId.values()].filter(node => activeIds.has(node.id) && node.value >= LIMITS.nodeValue)
      .sort((a, b) => b.value - a.value).slice(0, LIMITS.maxNodes);
    const finalIds = new Set(nodes.map(node => node.id));
    links = links.filter(link => finalIds.has(link.source) && finalIds.has(link.target))
      .sort((a, b) => b.value - a.value).slice(0, LIMITS.maxEdges);
    return { nodes, links };
  }

  function neighbors(graph, id) {
    const names = new Map(graph.nodes.map(node => [node.id, node.name]));
    return graph.links.filter(link => link.source === id || link.target === id)
      .map(link => { const other = link.source === id ? link.target : link.source; return { id: other, name: names.get(other) || other, weight: link.value }; })
      .sort((a, b) => b.weight - a.weight);
  }

  const generic = id => id === '游戏' || id === '玩家';
  const edgeKey = link => [link.source, link.target].sort().join('\u0000');
  function extendGraph(raw) {
    const base = filterGraph(raw), ids = new Set(base.nodes.map(node => node.id));
    const unique = new Map();
    for (const input of raw.links) {
      if (!input || input.source === input.target || !ids.has(input.source) || !ids.has(input.target) || number(input.value) < LIMITS.weight) continue;
      const link = { source: input.source, target: input.target, value: number(input.value) }, key = edgeKey(link);
      if (!unique.has(key) || unique.get(key).value < link.value) unique.set(key, link);
    }
    const sourceLinks = [...unique.values()], strongest = new Map();
    for (const link of sourceLinks) {
      if (generic(link.source) || generic(link.target)) continue;
      for (const id of [link.source, link.target]) if (!strongest.has(id) || strongest.get(id).value < link.value) strongest.set(id, link);
    }
    const kept = new Map(base.links.map(link => [edgeKey(link), link]));
    const extras = [...new Map([...strongest.values()].map(link => [edgeKey(link), link])).values()].sort((a,b) => b.value-a.value);
    for (const link of extras) if (kept.size < 160) kept.set(edgeKey(link), link);
    return { nodes: base.nodes, links: [...kept.values()], sourceLinks };
  }
  function selectGraph(graph, id, limit = 12) {
    if (!id || !graph.nodes.some(node => node.id === id)) return { nodes: graph.nodes, links: graph.links };
    const available = { nodes: graph.nodes, links: graph.sourceLinks || graph.links };
    const adjacent = neighbors(available, id).slice(0, Math.max(0, limit)), ids = new Set([id, ...adjacent.map(node => node.id)]);
    return { nodes: graph.nodes.filter(node => ids.has(node.id)), links: available.links.filter(link =>
      (link.source === id && ids.has(link.target)) || (link.target === id && ids.has(link.source))) };
  }
  function nodeSize(value, min, max, mobile = false) {
    const low = Math.log1p(Math.max(0,number(min))), high = Math.log1p(Math.max(0,number(max)));
    const ratio = high > low ? Math.max(0,Math.min(1,(Math.log1p(Math.max(0,number(value)))-low)/(high-low))) : .5;
    return (5 + 7 * ratio) * (mobile ? .9 : 1);
  }
  function layoutNodes(graph, settings = {}) {
    if (!global.GameSlangNetworkLayout?.layout) throw new Error('Network layout unavailable');
    return global.GameSlangNetworkLayout.layout(graph, settings);
  }
  const categoryColors = { '名词':'#b18cdd', '动词':'#59aebc', '形容词':'#d277b8', '其他':'#887aaf' };
  const categoryLabel = (category,lang) => lang === 'en' ? ({'名词':'Noun','动词':'Verb','形容词':'Adjective','其他':'Other'}[category] || category) : category;
  function buildOption(graph, positions, lang = 'zh', mobile = false, settings = {}) {
    const english=lang==='en', focused=Boolean(settings.focusId), categories=[...new Set(graph.nodes.map(node=>node.category))].sort();
    const categoryIndex=new Map(categories.map((category,index)=>[category,index]));
    const names=new Map(graph.nodes.map(node=>[node.id,node.name])), values=graph.nodes.map(node=>node.value);
    const min=Math.min(...values),max=Math.max(...values), maxWeight=Math.max(1,...graph.links.map(link=>link.value));
    const data=positions.map(node=>{
      const central=node.id===settings.focusId, muted=!focused&&generic(node.id), color=categoryColors[node.category]||categoryColors['其他'];
      return {...node,rawCategory:node.category,category:categoryIndex.get(node.category),
        symbolSize:central?(mobile?16:19):muted?5:nodeSize(node.value,min,max,mobile),
        label:{show:Boolean(node.labelShow),position:node.labelPosition||'right',distance:7,
          fontSize:central?(mobile?15:17):(mobile?11:12),fontWeight:central?600:400,
          color:muted?'#9580a5':central?'#faf0ff':'#dfcdea',opacity:muted?.65:1},
        itemStyle:{color:muted?'#66516e':color,opacity:muted?.45:1,borderColor:central?'#edd7fa':'rgba(220,196,239,.4)',
          borderWidth:central?1.5:.6,shadowBlur:central?16:node.labelShow?5:2,shadowColor:color+'66'}};
    });
    const motion=!settings.reducedMotion;
    return {
      backgroundColor:'transparent',animation:motion,animationDuration:400,animationDurationUpdate:420,animationEasingUpdate:'cubicOut',
      aria:{enabled:true,description:english?'Explore gaming terms and their source co-occurrence links. Use the selector or term buttons for text details.':'点击词条展开共现联系；也可通过选词菜单和下方词条按钮浏览。'},
      legend:{bottom:0,selectedMode:false,icon:'circle',itemWidth:6,itemHeight:6,itemGap:22,textStyle:{color:'#a994b5',fontSize:11},
        data:categories.map(category=>categoryLabel(category,lang))},
      tooltip:{trigger:'item',confine:true,backgroundColor:'rgba(17,7,23,.97)',borderColor:'#825091',padding:[10,13],
        textStyle:{color:'#eee0f5',fontSize:12},extraCssText:'max-width:260px;white-space:normal;overflow-wrap:anywhere;',
        formatter(params){const item=params?.data||{};if(params?.dataType==='edge')return escapeHTML(names.get(item.source)||item.source)+' ↔ '+escapeHTML(names.get(item.target)||item.target)+'<br>'+ (english?'Co-occurrence weight':'共现权重')+'：'+number(item.value);
          return escapeHTML(item.name)+' · '+escapeHTML(categoryLabel(item.rawCategory||'其他',lang))+'<br>'+(english?'Frequency weight':'词频权重')+'：'+number(item.value)+'<br>'+(english?'Click to explore connections':'点击展开关联词');}},
      series:[{id:'slang-network-series',type:'graph',layout:'none',data,
        links:graph.links.map(link=>({...link,lineStyle:{color:focused?'#aa7bc0':'#8e67a8',
          opacity:focused ? .58 : (generic(link.source)||generic(link.target) ? .1 : .3),
          width:(focused?1:.55)+Math.log1p(link.value)/Math.log1p(maxWeight)*(focused?.65:.55)}})),
        categories:categories.map(category=>({name:categoryLabel(category,lang),itemStyle:{color:categoryColors[category]||categoryColors['其他']}})),
        left:mobile?18:24,right:mobile?22:36,top:26,bottom:42,
        roam:true,draggable:true,scaleLimit:{min:.65,max:2.6},zoom:1,center:null,selectedMode:false,
        animation:motion,animationDurationUpdate:420,
        label:{show:false,color:'#dfcdea',fontFamily:'Inter, sans-serif',fontSize:mobile?11:12,
          backgroundColor:'rgba(14,5,19,.66)',padding:[3,4],borderRadius:3,textBorderColor:'#100817',textBorderWidth:2},
        labelLayout:{hideOverlap:true},lineStyle:{curveness:.12},
        emphasis:{focus:'adjacency',scale:1.25,label:{show:true,color:'#fff1ff'},
          lineStyle:{color:'#d5a2de',opacity:.8,width:1.5},itemStyle:{borderColor:'#f2d4ff',shadowBlur:12}},
        blur:{itemStyle:{opacity:.12},lineStyle:{opacity:.035},label:{opacity:.12}}
      }]
    };
  }

  global.GameSlangNetworkModel = { LIMITS, filterGraph, extendGraph, selectGraph, neighbors, layoutNodes, nodeSize, buildOption, escapeHTML };
  if (!global.document) return;

  const doc = global.document;
  let controller = null;
  function init() {
    if (controller) return controller;
    const panel = doc.getElementById('slang-network-panel'), canvas = doc.getElementById('slang-network-chart');
    const status = doc.getElementById('slang-network-status'), select = doc.getElementById('slang-network-select');
    const reset = doc.getElementById('slang-network-reset'), detail = doc.getElementById('slang-network-detail');
    if (!panel || !canvas || !status || !select || !reset || !detail) return null;
    if (typeof global.IntersectionObserver !== 'function') panel.classList?.add('animate-in');
    let graph = null, view = null, positions = null, scope = null, chart = null, abort = null, revision = 0;
    let expanded = false, selected = '', phase = 'idle', disposed = false, suspended = false, activated = false, mobile = false, layoutWidth = 0, layoutHeight = 0;
    const disposers = [];
    const reduced = global.matchMedia('(prefers-reduced-motion: reduce)');
    const lang = () => global.i18n?.getLang() === 'en' ? 'en' : 'zh';
    const text = (zh, en) => lang() === 'en' ? en : zh;
    const make = (tag, className, content) => { const node = doc.createElement(tag); if (className) node.className = className; if (content !== undefined) node.textContent = content; return node; };
    function listen(target, type, handler, options) { target.addEventListener(type, handler, options); disposers.push(() => target.removeEventListener(type, handler, options)); }
    function setPhase(value) {
      phase = value; panel.dataset.state = value; canvas.dataset.state = value;
      select.disabled = value !== 'ready';
      status.textContent = value === 'ready' ? (selected ? text('正在探索：' + selected + ' · ' + view.links.length + ' 条强联系', 'Exploring ' + selected + ' · ' + view.links.length + ' strongest links') : text(`${graph.nodes.length} 个词条 · ${graph.links.length} 条联系`, `${graph.nodes.length} terms · ${graph.links.length} links`))
        : value === 'loading' ? text('正在加载共现网络…', 'Loading the network…')
          : value === 'error' ? text('网络图暂时无法加载，请点击重试。', 'The network could not load. Select Retry to try again.')
            : value === 'empty' ? text('当前筛选条件下没有可显示的词条。', 'There are no terms under the current filters.')
              : text('滚动到这里后加载共现网络。', 'The network loads when this section comes into view.');
      reset.textContent = value === 'error' ? text('重试加载', 'Retry') : text('恢复全景', 'Restore overview');
      select.setAttribute('aria-label', text('选择词条查看联系', 'Choose a term to inspect its links'));
      canvas.dataset.nodeCount = String(graph?.nodes.length || 0); canvas.dataset.edgeCount = String(graph?.links.length || 0);
    }
    function renderSelect() {
      const placeholder = make('option', '', text('选择一个词条', 'Choose a term')); placeholder.value = '';
      const options = (graph?.nodes || []).map(node => { const option = make('option', '', node.name); option.value = node.id; return option; });
      select.replaceChildren(placeholder, ...options); select.value = selected;
    }

    function renderDetail() {
      const node=graph?.nodes.find(item=>item.id===selected);
      const title=make('p','network-detail-title',node?node.name:text('从一个熟悉的词开始','Start with a familiar term'));
      title.setAttribute('tabindex','-1');
      const source={nodes:graph?.nodes||[],links:graph?.sourceLinks||graph?.links||[]};
      const adjacent=node?neighbors(source,selected):[];
      const lead=make('p','network-detail-metrics',node?
        text('词频权重 '+node.value.toLocaleString('zh-CN')+' · 可查联系 '+adjacent.length+' 条 · 图中展示最强 '+Math.min(12,adjacent.length)+' 条',
          'Frequency weight '+node.value.toLocaleString('en-US')+' · Available links '+adjacent.length+' · Showing the strongest '+Math.min(12,adjacent.length)):
        text('点选词名，展开它与其他黑话的联系。','Select a term to unfold its connections.'));
      const examples=['氪金','开荒','辅助','打野','奶'].map(id=>graph?.nodes.find(item=>item.id===id)).filter(Boolean);
      const choices=node?(expanded?adjacent:adjacent.slice(0,12)):(examples.length?examples:(graph?.nodes||[]).slice(0,5));
      const list=make('div','network-neighbor-list');
      const buttons=choices.map(item=>{
        const button=make('button','network-neighbor-button');button.type='button';button.dataset.termId=item.id;
        const name=make('span','network-neighbor-name',item.name);
        const parts=[name];if(node)parts.push(make('span','network-neighbor-weight',number(item.weight).toLocaleString(lang()==='en'?'en-US':'zh-CN')));
        button.replaceChildren(...parts);button.setAttribute('aria-label',text('查看“'+item.name+'”的关联','Explore connections for '+item.name));return button;
      });
      list.replaceChildren(...buttons);
      const children=[title,lead,list];
      if(node && adjacent.length>12){const more=make('button','network-more-button',expanded?text('收起其余联系','Show fewer'):text('查看其余 '+(adjacent.length-12)+' 个关联词','Show '+(adjacent.length-12)+' more linked terms'));
        more.type='button';more.dataset.expand='true';more.setAttribute('aria-expanded',String(expanded));children.push(more);}
      if(node)children.push(make('p','network-detail-note',text('数值为源数据中的共现权重。点击关联词可以继续探索。','Values are co-occurrence weights from the source data. Select a linked term to continue.')));
      detail.replaceChildren(...children);
    }

    function selectNode(id) {
      selected=graph?.nodes.some(node=>node.id===id)?id:'';expanded=false;
      select.value=selected;
      if(chart){refreshPositions(true);chart.setOption(option(),false);}
      renderDetail();setPhase(phase);panel.dataset.selectedTerm=selected;
    }

    function option(preserveView = false) {
      const next = buildOption(view, positions, lang(), mobile, { focusId:selected, reducedMotion:reduced.matches });
      // Animate only changes of view; there is no continuously running force solver.
      if (reduced.matches) next.animation = false;
      if (preserveView && chart?.getOption) {
        const previous = chart.getOption().series?.[0];
        if (Number.isFinite(previous?.zoom)) next.series[0].zoom = previous.zoom;
        if (previous?.center) next.series[0].center = previous.center;
      }
      return next;
    }
    function disposeChart() { scope?.dispose(); scope = null; chart = null; }
    function refreshPositions(force = false) {
      const nextMobile = canvas.clientWidth < 600;
      const width = Math.max(120, canvas.clientWidth - (nextMobile ? 40 : 60));
      const height = Math.max(160, (canvas.clientHeight || (nextMobile ? 480 : 560)) - 68);
      if (!force && positions && nextMobile === mobile && Math.abs(width - layoutWidth) < 48 && Math.abs(height - layoutHeight) < 48) return false;
      mobile = nextMobile; layoutWidth = width; layoutHeight = height;
      view=selectGraph(graph,selected);positions = layoutNodes(view, { width, height, mobile, focusId:selected || undefined }); return true;
    }
    function renderChart() {
      if (disposed || suspended || !graph) return;
      if (!graph.nodes.length) { disposeChart(); setPhase('empty'); renderSelect(); renderDetail(); return; }
      if (!global.echarts || !global.GameChartLifecycle) throw new Error('Chart runtime is unavailable');
      disposeChart(); scope = global.GameChartLifecycle.begin('slang-network');
      chart = scope.track(global.echarts.init(canvas)); refreshPositions();
      chart.setOption(option(), true);
      chart.on('click', params => { if (params?.dataType === 'node') selectNode(String(params.data?.id || '')); });
      scope.beforeResize(() => {
        if (chart && refreshPositions()) chart.setOption(option(true), true);
      });
      setPhase('ready'); renderSelect(); renderDetail(); scope.resize();
    }
    async function load() {
      if (disposed || suspended) return;
      activated = true; lazy?.disconnect(); abort?.abort(); abort = new global.AbortController();
      const version = ++revision; setPhase('loading');
      try {
        const response = await global.fetch('assets/data/graph_data.json', { signal: abort.signal });
        if (!response.ok) throw new Error(`Graph HTTP ${response.status}`);
        const raw = await response.json();
        if (version !== revision || disposed || suspended) return;
        graph = extendGraph(raw); positions = null; renderChart();
      } catch (error) {
        if (version !== revision || disposed || suspended) return;
        disposeChart(); graph = null; positions = null; selected = ''; renderSelect(); renderDetail(); setPhase('error');
      } finally { if (version === revision) abort = null; }
    }
    const lazy = typeof global.IntersectionObserver === 'function' ? new global.IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting) && !activated) load();
    }, { rootMargin: '120px 0px', threshold: .01 }) : null;
    const resize = typeof global.ResizeObserver === 'function' ? new global.ResizeObserver(() => {
      if (chart && !suspended && canvas.clientWidth > 0) scope.resize();
    }) : null;
    function destroy() {
      if (disposed) return;
      disposed = true; revision += 1; abort?.abort(); abort = null; disposeChart();
      lazy?.disconnect(); resize?.disconnect(); disposers.forEach(dispose => dispose());
      if (controller === api) controller = null;
    }
    const api = { destroy, retry: load, getState: () => ({ phase, selected, nodeCount: graph?.nodes.length || 0, edgeCount: graph?.links.length || 0, visibleNodes:view?.nodes.length||0, visibleEdges:view?.links.length||0, suspended, disposed }) };
    detail.setAttribute('aria-live', 'polite'); detail.setAttribute('aria-atomic', 'true');
    status.setAttribute('role', 'status'); canvas.setAttribute('aria-label', text('游戏黑话共现网络', 'Gaming slang co-occurrence network'));
    listen(select, 'change', () => selectNode(select.value));
    listen(detail,'click',event=>{
      const button=event.target?.closest?.('button');
      if(button?.dataset.termId){selectNode(button.dataset.termId);detail.querySelector?.('.network-detail-title')?.focus?.({preventScroll:true});}
      else if(button?.dataset.expand){expanded=!expanded;renderDetail();detail.querySelector?.('.network-more-button')?.focus?.({preventScroll:true});}
    });
    listen(reset, 'click', () => {
      if (phase === 'error' || phase === 'idle') { load(); return; }
      if (!chart) return;
      selectNode(''); scope.resize();
    });
    listen(global, 'languagechange', () => {
      setPhase(phase); renderSelect(); renderDetail();
      canvas.setAttribute('aria-label', text('游戏黑话共现网络', 'Gaming slang co-occurrence network'));
      if (chart) chart.setOption(option(true), true);
    });
    listen(reduced, 'change', () => { if (chart) chart.setOption(option(true), true); });
    listen(global, 'pagehide', event => {
      if (!event.persisted) { destroy(); return; }
      suspended = true; revision += 1; abort?.abort(); abort = null; disposeChart(); lazy?.disconnect(); resize?.disconnect();
    });
    listen(global, 'pageshow', () => {
      if (disposed || !suspended) return;
      suspended = false; resize?.observe(canvas);
      if (activated) { if (graph) { try { renderChart(); } catch (_) { setPhase('error'); } } else load(); }
      else if (lazy) lazy.observe(panel); else load();
    });
    renderSelect(); renderDetail(); setPhase('idle'); resize?.observe(canvas);
    if (lazy) lazy.observe(panel); else load();
    controller = api; return api;
  }
  global.GameSlangNetwork = { init, destroy: () => controller?.destroy(), getState: () => controller?.getState() || null };
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})(typeof window !== 'undefined' ? window : globalThis);
