/* Wukong culture exhibit: persistent controls, local details and sourced comparisons. */
(function (global) {
  'use strict';
  var doc=global.document, scriptURL=doc && doc.currentScript && doc.currentScript.src;
  var ui={
    zh:{sources:'资料与说明',close:'关闭资料',view:'查看原文',term:'关键词对比',termIntro:'点选一个词，观察中文名称、英文写法与它们保留的信息。',lab:'翻译风格切换',labIntro:'同一句中文，两种英文处理。把译句放在一起，观察各自带来的理解线索。',map:'词语的原著来处',mapIntro:'从词语找到回目，再读一段与它有关的原文。',dossier:'名字与身份辨析',dossierIntro:'放在一起比较，分清名字、称谓与器物的不同所指。',sourceSentence:'中文原句',target:'英文目标语',chapter:'回',original:'原文片段',mapLabel:'选择一条原著线索',dossierLabel:'选择一组名字辨析',termLabel:'选择官方术语',strategyLabel:'选择观察角度',sourceCaption:'依据',sourceLead:'每条资料标明证据类型、定位与适用范围。',image2:'夕阳水面上，两名披甲角色持棍对峙',imageTitle:'名字背后的故事',imageSubtitle:'词语与叙事',verified:'资料核对',carries:'保留的信息',needs:'理解时还需要',boundary:'怎样阅读这组对照',teachingNote:'两句英文均为教学拟译，不是官方台词。',types:{official_store:'官方商店',official_announcement:'开发者公告',official_press_release:'官方新闻稿',primary_text:'原著文本',teaching_example:'教学拟译',editorial_note:'编辑说明'},kinds:{character:'人物 / 称谓',object:'器物',name_component:'名称成分',category:'类别词'}},
    en:{sources:'Sources & notes',close:'Close sources',view:'Read source',term:'Keyword comparison',termIntro:'Select a term to compare its Chinese name, English spelling and the information they carry.',lab:'Translation styles',labIntro:'One Chinese sentence, two English choices. Read them together and compare the clues each provides.',map:'Words in the original novel',mapIntro:'Follow a word to a chapter, then read the passage that gives it context.',dossier:'Names and identities',dossierIntro:'Compare names, designations and objects to distinguish what they refer to.',sourceSentence:'Chinese source sentence',target:'English target language',chapter:'Chapter',original:'Original passage',mapLabel:'Choose a trail into the novel',dossierLabel:'Choose a comparison of names',termLabel:'Choose an official term',strategyLabel:'Choose a reading perspective',sourceCaption:'Evidence',sourceLead:'Each source identifies its evidence type, location and scope.',image2:'Two armoured figures face each other with staffs on water at sunset',imageTitle:'Names carry stories',imageSubtitle:'Words & narratives',verified:'Sources checked',carries:'Information carried forward',needs:'What readers still need',boundary:'How to read this comparison',teachingNote:'Both English sentences are teaching translations, not official dialogue.',types:{official_store:'Official store',official_announcement:'Developer announcement',official_press_release:'Official press release',primary_text:'Primary text',teaching_example:'Teaching translation',editorial_note:'Editorial note'},kinds:{character:'Person / designation',object:'Object',name_component:'Name component',category:'Category term'}}
  };
  function lang(value){return value==='en'?'en':'zh';}
  function t(value,locale){return typeof value==='string'?value:value && (value[locale]||value.zh||value.en)||'';}
  function esc(value){return String(value==null?'':value).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function both(key){return {zh:ui.zh[key],en:ui.en[key]};}
  function local(tag,classes,value,locale,extra){return '<'+tag+(classes?' class="'+classes+'"':'')+' data-ce-zh="'+esc(t(value,'zh'))+'" data-ce-en="'+esc(t(value,'en'))+'"'+(extra||'')+'>'+esc(t(value,locale))+'</'+tag+'>';}
  function aria(value,locale){return ' aria-label="'+esc(t(value,locale))+'" data-ce-aria-zh="'+esc(t(value,'zh'))+'" data-ce-aria-en="'+esc(t(value,'en'))+'"';}
  function bilingual(value){return value && typeof value.zh==='string' && value.zh.trim() && typeof value.en==='string' && value.en.trim();}
  function validateData(data){
    if(!data||data.schemaVersion!==1||!Array.isArray(data.sources)||!Array.isArray(data.terms)||!data.terms.length||!Array.isArray(data.routes)||!data.routes.length||!Array.isArray(data.dossiers)||!data.dossiers.length)throw new Error('Unsupported exhibit schema');
    var sourceIds=new Set();
    data.sources.forEach(function(source){
      if(!source.id||sourceIds.has(source.id)||!ui.en.types[source.sourceType])throw new Error('Invalid source');
      sourceIds.add(source.id);
      if(source.url && new URL(source.url).protocol!=='https:')throw new Error('Source must use HTTPS');
      if(!source.url&&source.sourceType!=='teaching_example'&&source.sourceType!=='editorial_note')throw new Error('Missing source URL');
      ['title','locator','note'].forEach(function(key){if(!bilingual(source[key]))throw new Error('Missing source translation');});
    });
    [data.terms,data.routes,data.dossiers].forEach(function(records){
      var ids=new Set();records.forEach(function(record){
        if(!record.id||ids.has(record.id))throw new Error('Duplicate record');ids.add(record.id);
        if(!Array.isArray(record.sourceIds)||!record.sourceIds.length||record.sourceIds.some(function(id){return !sourceIds.has(id);}))throw new Error('Missing evidence');
      });
    });
    var experiment=data.experiment;
    if(!experiment||experiment.sourceType!=='teaching_example'||!Array.isArray(experiment.variants)||experiment.variants.length!==2||!Array.isArray(experiment.sourceIds)||!experiment.sourceIds.length||experiment.sourceIds.some(function(id){return !sourceIds.has(id);}))throw new Error('Teaching material must be identified');
    var termIds=new Set(data.terms.map(function(item){return item.id;}));
    data.routes.concat(data.dossiers).forEach(function(item){if(!termIds.has(item.termId))throw new Error('Unknown term');});
    data.terms.forEach(function(item){if(item.observation!=null&&!bilingual(item.observation))throw new Error('Missing observation translation');});
    experiment.variants.forEach(function(item){
      if(!item.keyword||typeof item.english!=='string'||!item.english.includes(item.keyword))throw new Error('Translation keyword must match its sentence');
      ['carries','needs'].forEach(function(key){if(item[key]!=null&&!bilingual(item[key]))throw new Error('Missing comparison translation');});
    });
    if(experiment.boundary!=null&&!bilingual(experiment.boundary))throw new Error('Missing teaching boundary');
    data.routes.forEach(function(item){if(item.highlight!=null&&(typeof item.highlight!=='string'||!item.highlight||!item.quote.includes(item.highlight)))throw new Error('Highlight must match original quote');});
    data.dossiers.forEach(function(item){if(item.left||item.right){
      if(!bilingual(item.label)||!bilingual(item.takeaway))throw new Error('Missing identity comparison');
      [item.left,item.right].forEach(function(side){if(!side||['name','role','description'].some(function(key){return !bilingual(side[key]);}))throw new Error('Missing identity comparison');});
    }});
    return data;
  }
  function createController(data,initialLocale,onChange){
    validateData(data);
    var state={locale:lang(initialLocale),term:data.terms[0].id,strategy:data.experiment.variants[0].id,route:data.routes[0].id,dossier:data.dossiers[0].id,sourcesOpen:false,sourceId:null};
    function publish(){if(onChange)onChange(Object.assign({},state));}
    return {
      getState:function(){return Object.assign({},state);},
      setLocale:function(locale){var next=lang(locale);if(state.locale===next)return false;state.locale=next;publish();return true;},
      choose:function(key,id){
        var sets={term:data.terms,strategy:data.experiment.variants,route:data.routes,dossier:data.dossiers};
        if(!Object.prototype.hasOwnProperty.call(sets,key)||!sets[key].some(function(item){return item.id===id;})||state[key]===id)return false;
        state[key]=id;publish();return true;
      },
      showSources:function(open,id){
        var next=Boolean(open),sourceId=next&&id?id:null;
        if(sourceId&&!data.sources.some(function(source){return source.id===sourceId;}))return false;
        if(state.sourcesOpen===next&&state.sourceId===sourceId)return false;
        state.sourcesOpen=next;state.sourceId=sourceId;publish();return true;
      }
    };
  }
  function bindLanguage(controller,target){
    function handle(event){controller.setLocale(event.detail&&event.detail.lang);}
    target.addEventListener('languagechange',handle);
    return function(){target.removeEventListener('languagechange',handle);};
  }
  function highlight(text,keyword,classes){return !keyword||!String(text).includes(keyword)?esc(text):String(text).split(keyword).map(esc).join('<mark'+(classes?' class="'+classes+'"':'')+'>'+esc(keyword)+'</mark>');}
  function sourceLinks(data,ids,locale){return '<div class="ce-citations">'+local('span','',both('sourceCaption'),locale)+ids.map(function(id){
    var source=data.sources.find(function(item){return item.id===id;});
    return '<button type="button" class="ce-text-link" data-ce-action="sources" data-ce-source="'+esc(id)+'" aria-haspopup="dialog" aria-controls="ce-sources-dialog">'+local('span','',source.title,locale)+' <span aria-hidden="true">+</span></button>';
  }).join('')+'</div>';}
  function sectionHead(id,key,locale){return '<header class="ce-section-head">'+local('h3','',both(key),locale,' id="'+id+'"')+local('p','ce-section-intro',both(key+'Intro'),locale)+'</header>';}
  function selected(data,key,id){return data[key].find(function(item){return item.id===id;})||data[key][0];}
  function termDetail(data,state){
    var item=selected(data,'terms',state.term),locale=state.locale;
    return '<span class="ce-label">'+esc(ui[locale].kinds[item.kind])+'</span><h4 class="ce-term-pair"><span class="ce-term-zh" lang="zh">'+esc(item.pairZh||item.zh)+'</span><span class="ce-term-separator" aria-hidden="true">→</span><span class="ce-term-en" lang="en">'+esc(item.pairEn||item.en)+'</span></h4><p class="ce-term-observation">'+esc(t(item.observation||item.description,locale))+'</p><p>'+esc(t(item.description,locale))+'</p><p class="ce-scope">'+esc(t(item.scope,locale))+'</p>'+sourceLinks(data,item.sourceIds,locale);
  }
  function strategyDetail(data,state){var item=selected({variants:data.experiment.variants},'variants',state.strategy);return '<h4>'+esc(t(item.heading,state.locale))+'</h4><p>'+esc(t(item.note,state.locale))+'</p>';}
  function routeDetail(data,state){
    var item=selected(data,'routes',state.route),locale=state.locale;
    return '<span class="ce-label">'+ui[locale].original+'</span><h4>'+esc(t(item.title,locale))+'</h4><blockquote lang="zh-Hant">“'+highlight(item.quote,item.highlight,'ce-quote-highlight')+'”</blockquote><p>'+esc(t(item.note,locale))+'</p>'+sourceLinks(data,item.sourceIds,locale);
  }
  function dossierDetail(data,state){
    var item=selected(data,'dossiers',state.dossier),locale=state.locale;
    if(item.left&&item.right)return '<div class="ce-identity-pair">'+[item.left,item.right].map(function(side){return '<section class="ce-identity"><p class="ce-identity-role">'+esc(t(side.role,locale))+'</p><h4 class="ce-identity-name">'+esc(t(side.name,locale))+'</h4><p class="ce-identity-description">'+esc(t(side.description,locale))+'</p></section>';}).join('')+'</div><p class="ce-identity-takeaway">'+esc(t(item.takeaway,locale))+'</p>'+sourceLinks(data,item.sourceIds,locale);
    return '<h4>'+esc(t(item.heading,locale))+'</h4><dl>'+item.facts.map(function(fact){return '<div><dt>'+esc(t(fact.label,locale))+'</dt><dd>'+esc(t(fact.value,locale))+'</dd></div>';}).join('')+'</dl>'+sourceLinks(data,item.sourceIds,locale);
  }
  function marker(active){return '<span class="ce-selection-marker" data-ce-marker aria-hidden="true">'+(active?'●':'+')+'</span>';}
  function sourceDialog(data,locale){
    return '<dialog id="ce-sources-dialog" class="ce-sources-dialog" aria-labelledby="ce-sources-title"><div class="ce-dialog-head">'+local('h3','',both('sources'),locale,' id="ce-sources-title"')+'<button type="button" class="ce-close-button" data-ce-action="close-sources"'+aria(both('close'),locale)+'>×</button></div>'+local('p','ce-dialog-intro',both('sourceLead'),locale)+'<ol class="ce-source-list">'+data.sources.map(function(source){
      return '<li id="ce-source-'+esc(source.id)+'" data-ce-source-entry="'+esc(source.id)+'" tabindex="-1"><div class="ce-source-meta">'+local('span','',{zh:ui.zh.types[source.sourceType],en:ui.en.types[source.sourceType]},locale)+(source.date?'<time>'+esc(source.date)+'</time>':'')+'</div>'+local('h4','',source.title,locale)+local('p','ce-source-publisher',source.publisher,locale)+local('p','',source.locator,locale)+local('p','ce-source-note',source.note,locale)+(source.url?'<a href="'+esc(source.url)+'" target="_blank" rel="noopener noreferrer">'+local('span','',both('view'),locale)+' <span aria-hidden="true">↗</span></a>':'')+'</li>';
    }).join('')+'</ol><p class="ce-verified">'+local('span','',both('verified'),locale)+' · '+esc(data.verifiedOn)+'</p></dialog>';
  }
  function renderExhibit(data,state){
    var locale=lang(state.locale);state=Object.assign({},state,{locale:locale});
    var h='<div class="ce-toolbar"><button type="button" class="ce-source-button" data-ce-action="sources" data-ce-key="sources" aria-haspopup="dialog" aria-controls="ce-sources-dialog">'+local('span','',both('sources'),locale)+' <span aria-hidden="true">+</span></button></div>';
    h+='<section class="ce-module ce-catalogue" aria-labelledby="ce-term-title">'+sectionHead('ce-term-title','term',locale)+'<div class="ce-catalogue-grid"><figure class="ce-image ce-catalogue-image"><img src="assets/wukong2.jpg" alt="'+esc(ui[locale].image2)+'" data-ce-alt-zh="'+esc(ui.zh.image2)+'" data-ce-alt-en="'+esc(ui.en.image2)+'" loading="lazy" decoding="async"><figcaption>'+local('span','',both('imageSubtitle'),locale)+local('strong','',both('imageTitle'),locale)+'</figcaption></figure><div class="ce-term-content"><div class="ce-term-list" role="group"'+aria(both('termLabel'),locale)+'>';
    h+=data.terms.map(function(item){return '<button type="button" class="ce-term-button" data-ce-action="term" data-ce-id="'+esc(item.id)+'" data-ce-key="term-'+esc(item.id)+'" aria-pressed="'+(item.id===state.term)+'" aria-controls="ce-term-detail"><span class="ce-term-mark" lang="zh" aria-hidden="true">'+esc(item.mark)+'</span><span><strong lang="zh">'+esc(item.zh)+'</strong><small lang="en">'+esc(item.en)+'</small></span>'+marker(item.id===state.term)+'</button>';}).join('');
    h+='</div><div class="ce-term-detail" id="ce-term-detail" aria-live="polite" aria-atomic="true">'+termDetail(data,state)+'</div></div></div></section>';
    h+='<section class="ce-module ce-lab" aria-labelledby="ce-lab-title">'+sectionHead('ce-lab-title','lab',locale)+'<div class="ce-lab-top"><div>'+local('span','ce-label',both('sourceSentence'),locale)+'<p class="ce-original-sentence" lang="zh">'+esc(data.experiment.original)+'</p></div></div><div class="ce-translation-pair" role="group"'+aria(both('strategyLabel'),locale)+'>';
    h+=data.experiment.variants.map(function(item,index){
      return '<div class="ce-translation-card"><button type="button" class="ce-translation-option" data-ce-action="strategy" data-ce-id="'+esc(item.id)+'" data-ce-key="strategy-'+esc(item.id)+'" aria-pressed="'+(item.id===state.strategy)+'" aria-controls="ce-strategy-detail"><span class="ce-option-head"><span class="ce-option-letter">'+(index===0?'A':'B')+'</span><span>'+local('span','',item.label,locale)+local('small','',item.strategy,locale)+'</span>'+marker(item.id===state.strategy)+'</span>'+local('span','ce-target-label',both('target'),locale)+'<span class="ce-english-sentence" lang="en">'+highlight(item.english,item.keyword)+'</span></button><dl class="ce-variant-notes">'+local('dt','',both('carries'),locale)+local('dd','',item.carries||item.note,locale)+local('dt','',both('needs'),locale)+local('dd','',item.needs||item.tradeoff,locale)+'</dl></div>';
    }).join('')+'</div><div class="ce-lab-reading"><div class="ce-strategy-detail" id="ce-strategy-detail" aria-live="polite" aria-atomic="true">'+strategyDetail(data,state)+'</div><aside class="ce-lab-boundary">'+local('h4','',both('boundary'),locale)+local('p','',data.experiment.boundary||both('teachingNote'),locale)+sourceLinks(data,data.experiment.sourceIds,locale)+'</aside></div></section>';
    h+='<section class="ce-module ce-connections" aria-labelledby="ce-map-title">'+sectionHead('ce-map-title','map',locale)+'<div class="ce-map-grid"><div class="ce-route-list" role="group"'+aria(both('mapLabel'),locale)+'>'+data.routes.map(function(item){return '<button type="button" class="ce-route" data-ce-action="route" data-ce-id="'+esc(item.id)+'" data-ce-key="route-'+esc(item.id)+'" aria-pressed="'+(item.id===state.route)+'" aria-controls="ce-route-detail">'+local('span','ce-route-word',item.label,locale)+'<span class="ce-route-line" aria-hidden="true"></span><span class="ce-chapter-number">'+local('small','',both('chapter'),locale)+esc(item.chapter)+'</span></button>';}).join('')+local('p','ce-map-note',{zh:'词语 → 回目 → 原文',en:'Term → Chapter → Passage'},locale)+'</div><article class="ce-passage" id="ce-route-detail" aria-live="polite" aria-atomic="true">'+routeDetail(data,state)+'</article></div></section>';
    h+='<section class="ce-module ce-records" aria-labelledby="ce-dossier-title">'+sectionHead('ce-dossier-title','dossier',locale)+'<div class="ce-dossier-tabs" role="group"'+aria(both('dossierLabel'),locale)+'>'+data.dossiers.map(function(item){var term=selected(data,'terms',item.termId);return '<button type="button" data-ce-action="dossier" data-ce-id="'+esc(item.id)+'" data-ce-key="dossier-'+esc(item.id)+'" aria-pressed="'+(item.id===state.dossier)+'" aria-controls="ce-dossier-detail">'+local('span','',item.label||{zh:term.zh,en:term.en},locale)+marker(item.id===state.dossier)+'</button>';}).join('')+'</div><article id="ce-dossier-detail" class="ce-dossier-detail" aria-live="polite" aria-atomic="true">'+dossierDetail(data,state)+'</article></section>';
    return h+sourceDialog(data,locale);
  }
  function mount(data,section,target){
    if(!section||section.dataset.cultureExhibitMounted==='true')return null;
    validateData(data);
    var owner=section.ownerDocument,oldContent=section.querySelector('.culture-content');
    if(!oldContent)return null;
    var root=owner.createElement('div');root.className='ce-exhibit';root.setAttribute('data-culture-exhibit','');
    oldContent.replaceWith(root);section.classList.add('culture-exhibit-ready');section.dataset.cultureExhibitMounted='true';
    var controller,previous=null,sourceTrigger=null,sourceOrigin=null,disposed=false;
    var animations=new Map(), motion=typeof target.matchMedia==='function'?target.matchMedia('(prefers-reduced-motion: reduce)'):null;
    var locale=(target.i18n&&target.i18n.getLang())||owner.documentElement.lang;
    var renderers={term:termDetail,strategy:strategyDetail,route:routeDetail,dossier:dossierDetail};
    var ids={term:'ce-term-detail',strategy:'ce-strategy-detail',route:'ce-route-detail',dossier:'ce-dossier-detail'};
    function translate(locale){
      root.querySelectorAll('[data-ce-zh]').forEach(function(element){element.textContent=element.getAttribute('data-ce-'+locale);});
      root.querySelectorAll('[data-ce-aria-zh]').forEach(function(element){element.setAttribute('aria-label',element.getAttribute('data-ce-aria-'+locale));});
      root.querySelectorAll('[data-ce-alt-zh]').forEach(function(element){element.setAttribute('alt',element.getAttribute('data-ce-alt-'+locale));});
    }
    function focusSource(dialog,id){
      if(!id){dialog.scrollTop=0;return;}
      var entry=Array.from(dialog.querySelectorAll('[data-ce-source-entry]')).find(function(item){return item.dataset.ceSourceEntry===id;});
      if(!entry)return;
      var head=dialog.querySelector('.ce-dialog-head'), headHeight=head?head.getBoundingClientRect().height:0;
      var top=dialog.scrollTop+entry.getBoundingClientRect().top-dialog.getBoundingClientRect().top-headHeight-24;
      dialog.scrollTop=Math.max(0,top);entry.focus({preventScroll:true});
    }
    function stopAnimations(){animations.forEach(function(animation){animation.cancel();});animations.clear();}
    function motionChanged(){if(motion&&motion.matches)stopAnimations();}
    function updateDetail(element,html){
      var previousAnimation=animations.get(element);if(previousAnimation)previousAnimation.cancel();animations.delete(element);
      element.innerHTML=html;
      if(owner.hidden||(motion&&motion.matches)||typeof element.animate!=='function')return;
      var animation=element.animate([{opacity:.5,transform:'translateY(3px)'},{opacity:1,transform:'translateY(0)'}],{duration:180,easing:'ease-out'});
      animations.set(element,animation);
      animation.onfinish=function(){if(animations.get(element)===animation)animations.delete(element);};
    }
    function draw(state){
      if(disposed)return;
      var localeChanged=previous&&previous.locale!==state.locale;
      if(!previous)root.innerHTML=renderExhibit(data,state);
      else{
        if(localeChanged)translate(state.locale);
        Object.keys(renderers).forEach(function(key){
          if(localeChanged||previous[key]!==state[key])updateDetail(root.querySelector('#'+ids[key]),renderers[key](data,state));
          if(previous[key]!==state[key])root.querySelectorAll('[data-ce-action="'+key+'"]').forEach(function(button){
            var active=button.dataset.ceId===state[key];button.setAttribute('aria-pressed',String(active));
            var indicator=button.querySelector('[data-ce-marker]');if(indicator)indicator.textContent=active?'●':'+';
          });
        });
      }
      root.lang=state.locale;
      var dialog=root.querySelector('dialog');
      if(state.sourcesOpen&&!dialog.open)dialog.showModal();
      if(state.sourcesOpen&&(!previous||!previous.sourcesOpen||previous.sourceId!==state.sourceId))focusSource(dialog,state.sourceId);
      if(!state.sourcesOpen&&previous&&previous.sourcesOpen){
        if(dialog.open)dialog.close();
        var trigger=sourceTrigger&&root.contains(sourceTrigger)?sourceTrigger:null;
        if(!trigger&&sourceOrigin){
          var panel=root.querySelector('#'+sourceOrigin.panel);
          if(panel)trigger=Array.from(panel.querySelectorAll('[data-ce-source]')).find(function(button){return button.dataset.ceSource===sourceOrigin.source;});
        }
        if(!trigger)trigger=root.querySelector('[data-ce-key="sources"]');
        if(trigger)trigger.focus({preventScroll:true});sourceTrigger=null;sourceOrigin=null;
      }
      previous=Object.assign({},state);
    }
    controller=createController(data,locale,draw);draw(controller.getState());
    var dialog=root.querySelector('dialog');
    function click(event){
      var element=event.target&&(event.target.nodeType===3?event.target.parentElement:event.target),button=element&&element.closest&&element.closest('[data-ce-action]');
      if(!button||!root.contains(button))return;
      var action=button.dataset.ceAction;
      if(action==='sources'){
        sourceTrigger=button;
        var panel=button.closest('[id]');
        sourceOrigin=panel&&root.contains(panel)&&button.dataset.ceSource?{panel:panel.id,source:button.dataset.ceSource}:null;
        controller.showSources(true,button.dataset.ceSource);
      }
      else if(action==='close-sources')controller.showSources(false);
      else controller.choose(action,button.dataset.ceId);
    }
    function cancel(event){event.preventDefault();controller.showSources(false);}
    function close(){if(controller.getState().sourcesOpen)controller.showSources(false);}
    function backdrop(event){
      if(event.target!==dialog)return;
      var rect=dialog.getBoundingClientRect();
      if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)controller.showSources(false);
    }
    root.addEventListener('click',click);dialog.addEventListener('cancel',cancel);dialog.addEventListener('close',close);dialog.addEventListener('click',backdrop);
    var unbind=bindLanguage(controller,target);
    if(motion&&motion.addEventListener)motion.addEventListener('change',motionChanged);
    controller.destroy=function(){
      if(disposed)return;disposed=true;unbind();stopAnimations();
      if(motion&&motion.removeEventListener)motion.removeEventListener('change',motionChanged);
      root.removeEventListener('click',click);dialog.removeEventListener('cancel',cancel);dialog.removeEventListener('close',close);dialog.removeEventListener('click',backdrop);
      if(dialog.open)dialog.close();sourceTrigger=null;sourceOrigin=null;
    };
    root.cultureController=controller;return controller;
  }
  async function init(){
    var section=doc.querySelector('.wukong-culture-section');
    if(!section||section.dataset.cultureExhibitMounted==='true')return;
    try{
      var response=await global.fetch(new URL('culture-exhibit.json',scriptURL||new URL('assets/culture-exhibit.js',global.location.href)).href);
      if(!response.ok)throw new Error('Exhibit data HTTP '+response.status);
      mount(await response.json(),section,global);
    }catch(error){console.warn('Culture exhibit could not load:',error.message);}
  }
  global.CultureExhibit={validateData:validateData,createController:createController,bindLanguage:bindLanguage,renderExhibit:renderExhibit,mount:mount,init:init};
  if(doc){if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',init,{once:true});else init();}
})(typeof window!=='undefined'?window:globalThis);
