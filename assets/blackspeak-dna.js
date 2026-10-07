/* Eight-question card controller; scoring stays independent of presentation. */
(() => {
  'use strict';
  const content=window.QuizContent, model=window.QuizModel;
  const questions=content.questions, storageKey='gameslang-quiz-progress';
  const $=id=>document.getElementById(id);
  const lang=()=>window.i18n?.getLang()==='en'?'en':'zh';
  const local=value=>value?.[lang()]||value?.zh||'';
  const tr=(zh,en)=>lang()==='en'?en:zh;
  const el=(tag,className,text)=>{
    const node=document.createElement(tag);
    if(className)node.className=className;
    if(text!==undefined)node.textContent=text;
    return node;
  };
  let answers={}, step=0, screen='intro', generation=0;
  function restore(){
    try{
      const saved=JSON.parse(localStorage.getItem(storageKey));
      if(!saved||saved.version!==content.version)return;
      answers=model.sanitizeProgressAnswers(saved.answers);
      step=Number.isInteger(saved.step)?Math.max(0,Math.min(questions.length-1,saved.step)):0;
    }catch(_){/* Blocked or damaged storage must not stop the quiz. */}
  }
  function persist(){
    try{localStorage.setItem(storageKey,JSON.stringify({version:content.version,answers:model.sanitizeProgressAnswers(answers),step}));}
    catch(_){/* In-memory answers remain usable without storage. */}
  }
  function staticLabels(){
    document.documentElement.lang=lang()==='en'?'en':'zh-CN';
    document.title=tr('黑话 DNA 测试','Game Slang DNA');
    try{if(window.frameElement)window.frameElement.title=document.title;}catch(_){/* Standalone or foreign embed. */}
    const labels={
      brandLabel:tr('黑话','SLANG'),headerReset:tr('重新开始','Start over'),
      introEyebrow:tr('8 个问题 · 一份游戏偏好速写','8 questions · A sketch of your play preferences'),
      introTitle:tr('你的游戏“黑话”基因，究竟来自哪里？','Where does your game-slang DNA come from?'),
      introDescription:tr('回到你熟悉的游戏现场：怎样回复队友，把时间留给什么，能否听懂一条战术指令。','Back in the game: how you reply to teammates, what you make time for, and how you read a tactical call.'),
      prevBtn:tr('上一步','Previous'),reportTitle:tr('你的黑话 DNA 报告','Your game-slang DNA'),
      evidenceTitle:tr('从你的选择看','What your choices suggest'),
      communicationTitle:tr('你会怎样和队友沟通','How you communicate'),
      gamesTitle:tr('可以试试的游戏体验','Experiences to explore'),
      knowledgeTitle:tr('黑话理解 · 单独看看','Slang understanding · A separate look'),
      shareTitle:tr('把这次结果带走','Take your result with you'),
      reportReset:tr('重新测试','Try again'),shareBtn:tr('复制结果','Copy result'),
      quizFooter:tr('结果来自本次选择，用于观察游戏偏好与沟通习惯。','A reflection of these choices: play preferences and communication habits.')
    };
    Object.entries(labels).forEach(([id,value])=>$(id).textContent=value);
    $('introBullets').replaceChildren(...[
      tr('6 道情境题：回复队友、取舍资源，再排一次优先级。','6 scenarios: reply to teammates, make trade-offs and rank your priorities.'),
      tr('2 道黑话题：放进真实语境，看看你会怎样理解。','2 slang questions: interpret a call in its game context.'),
      tr('报告保留选择依据，游戏偏好和黑话理解分开呈现。','See the choices behind your result, with preferences and slang kept separate.')
    ].map(text=>el('li','',text)));
  }
  function showCard(name){
    screen=name;
    ['intro','quiz','report'].forEach(id=>$(id+'Card').classList.toggle('dna-hidden',id!==name));
  }
  function focusHeading(id){
    requestAnimationFrame(()=>{
      $(id).focus({preventScroll:true});
      // The host owns scrolling; avoid a hidden scroll offset inside the growing iframe.
      try{
        const frame=window.frameElement;
        if(frame&&parent.location.origin===location.origin){
          const top=frame.getBoundingClientRect().top;
          if(top<90||top>parent.innerHeight*.7)parent.scrollBy({top:top-130,behavior:'instant'});
        }else $(id).scrollIntoView({block:'nearest'});
      }catch(_){/* Foreign embeds retain their normal document flow. */}
    });
  }
  function showIntro(){
    showCard('intro');
    const count=Object.keys(model.sanitizeAnswers(answers)).length;
    $('savedNote').hidden=count===0;
    $('savedNote').textContent=tr('已保留 '+count+' / 8 题的选择，可继续，也可从头开始。',count+' / 8 answers saved. Continue or start over.');
    $('startBtn').textContent=count===8?tr('查看上次结果','View saved result'):count?tr('继续测试','Continue'):tr('开始测试','Start test');
    $('headerReset').disabled=count===0;
  }
  function renderQuestion(moveFocus=false){
    showCard('quiz');$('headerReset').disabled=false;
    const q=questions[step];
    $('stepInfo').textContent=tr('问题 ','Question ')+(step+1)+' / '+questions.length;
    $('questionType').textContent=({single:tr('情境选择','Scenario'),chat:tr('聊天回复','Chat reply'),rank:tr('优先级排序','Rank priorities'),knowledge:tr('黑话语境','Slang in context')})[q.type];
    $('questionTitle').textContent=local(q.title);$('questionSubtitle').textContent=local(q.subtitle);
    $('questionContext').hidden=!q.context;$('questionContext').textContent=local(q.context);
    $('optionsContainer').dataset.type=q.type;
    $('optionsContainer').replaceChildren(...q.options.map((option,index)=>{
      const button=el('button','dna-option'+(option.neutral?' neutral':''));
      button.type='button';button.dataset.option=option.id;
      const marker=el('span','dna-option-marker',String.fromCharCode(65+index));marker.setAttribute('aria-hidden','true');
      button.append(marker,el('span','dna-option-label',local(option.label)));return button;
    }));
    $('prevBtn').disabled=step===0;
    $('nextBtn').textContent=step===questions.length-1?tr('查看报告','See result'):tr('下一步','Next');
    $('progressBar').style.width=((step+1)/questions.length*100)+'%';
    $('progressTrack').setAttribute('aria-valuenow',String(step+1));
    $('progressTrack').setAttribute('aria-label',tr('答题进度','Question progress'));
    updateSelection();if(moveFocus)focusHeading('questionTitle');
  }
  function updateSelection(message){
    const q=questions[step],selected=answers[q.id]||[];
    $('optionsContainer').querySelectorAll('[data-option]').forEach(button=>{
      const index=selected.indexOf(button.dataset.option),active=index!==-1;
      button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));
      const marker=button.querySelector('.dna-option-marker');
      marker.textContent=active?(q.type==='rank'&&!q.options.find(o=>o.id===button.dataset.option).neutral?String(index+1):'✓'):String.fromCharCode(65+q.options.findIndex(o=>o.id===button.dataset.option));
    });
    const valid=model.isAnswerValid(q,selected);$('nextBtn').disabled=!valid;
    $('answerStatus').textContent=message||(q.type==='rank'
      ?(selected.some(id=>q.options.find(o=>o.id===id)?.neutral)?tr('已记录：这次没有明确偏好。','Recorded: no clear preference this time.')
        :tr('已选 '+selected.length+' / 3 项，按先后排列；再次点击可取消。',selected.length+' / 3 ranked. Click a selected option again to remove it.'))
      :valid?tr('已记录，可以继续，也可以换一个回答。','Answer recorded. Continue, or choose another reply.')
        :q.type==='knowledge'?tr('选择你对这句话的理解，不确定也可以选。','Choose how you understand the phrase, or select “Not sure”.')
        :tr('选择最接近你实际反应的一项。','Choose the response closest to what you would actually do.'));
    renderRanking(q,selected);
  }
  function renderRanking(q,selected){
    const rows=selected.filter(id=>!q.options.find(o=>o.id===id)?.neutral);
    $('rankingContainer').hidden=q.type!=='rank'||rows.length===0;
    if($('rankingContainer').hidden){$('rankingContainer').replaceChildren();return;}
    const heading=el('p','dna-rank-heading',tr('你的优先顺序 · 可用箭头调整','Your order · Use the arrows to adjust')),list=el('ol','dna-rank-list');
    rows.forEach((id,index)=>{
      const option=q.options.find(o=>o.id===id),row=el('li','dna-rank-row');
      row.append(el('span','dna-rank-number',String(index+1)),el('span','',local(option.label)));
      const controls=el('span','dna-rank-controls');
      [['up','↑',index===0,tr('上移','Move up')],['down','↓',index===rows.length-1,tr('下移','Move down')],['remove','×',false,tr('移除','Remove')]].forEach(([action,symbol,disabled,label])=>{
        const button=el('button','dna-rank-button',symbol);
        button.type='button';button.dataset.rankAction=action;button.dataset.rankId=id;button.disabled=disabled;
        button.setAttribute('aria-label',label+'：'+local(option.label));controls.append(button);
      });
      row.append(controls);list.append(row);
    });
    $('rankingContainer').replaceChildren(heading,list);
  }
  function selectOption(id){
    const q=questions[step],option=q.options.find(o=>o.id===id);if(!option)return;
    let selected=answers[q.id]||[];
    if(q.type!=='rank'||option.neutral)selected=[id];
    else{
      selected=selected.filter(value=>!q.options.find(o=>o.id===value)?.neutral);
      if(selected.includes(id))selected=selected.filter(value=>value!==id);
      else if(selected.length<q.pickCount)selected=[...selected,id];
      else{updateSelection(tr('已经选了三项，请先取消一项再替换。','Three selected. Remove one before adding another.'));return;}
    }
    answers[q.id]=selected;persist();updateSelection();
  }
  function moveRank(button){
    const q=questions[step],selected=[...(answers[q.id]||[])],index=selected.indexOf(button.dataset.rankId);if(index<0)return;
    const action=button.dataset.rankAction,next=action==='up'?index-1:index+1;
    if(action==='remove')selected.splice(index,1);
    else if(next>=0&&next<selected.length)[selected[index],selected[next]]=[selected[next],selected[index]];
    answers[q.id]=selected;persist();updateSelection();
    const rowControls=[...$('rankingContainer').querySelectorAll('button')].filter(b=>b.dataset.rankId===button.dataset.rankId&&!b.disabled);
    const same=rowControls.find(b=>b.dataset.rankAction===action)||rowControls[0];
    (same||[...$('optionsContainer').querySelectorAll('[data-option]')].find(b=>b.dataset.option===button.dataset.rankId))?.focus({preventScroll:true});
  }
  function evidenceNode(item){
    const q=questions.find(question=>question.id===item.questionId),option=q.options.find(o=>o.id===item.optionId),p=el('p','dna-evidence');
    const rank=q.type==='rank'?(answers[q.id]||[]).indexOf(item.optionId)+1:0;
    const prefix=rank>0?tr('你排在第 '+rank+' 位：','Ranked #'+rank+': '):tr('你的选择：','Your choice: ');
    p.append(el('strong','',tr('第 '+(questions.indexOf(q)+1)+' 题','Question '+(questions.indexOf(q)+1))),document.createTextNode(' · '+local(q.title)),el('br'),document.createTextNode(prefix+local(option.label)));return p;
  }
  const percent=value=>new Intl.NumberFormat(lang(),{maximumFractionDigits:1}).format(value)+'%';
  function showReport(moveFocus=false){
    let result;
    try{result=model.evaluate(answers);}
    catch(_){step=questions.findIndex(q=>!model.isAnswerValid(q,answers[q.id]));if(step<0)step=0;renderQuestion(true);return;}
    showCard('report');$('headerReset').disabled=false;
    const positive=result.dimensions.filter(d=>d.score>0),top=positive[0],leaders=positive.filter(d=>d.score===top?.score);
    const dimension=id=>content.dimensions.find(d=>d.id===id);
    const leadingLabel=!top?tr('暂未定型','Still open'):leaders.length>1?tr('混合偏好','Mixed interests'):local(dimension(top.id).label);
    $('reportCaption').textContent=tr('偏好图谱 · 基于 '+result.preferenceAnswers+' 道有效情境回答','Preference map · Based on '+result.preferenceAnswers+' scenario answers');
    $('ringLabel').textContent=leaders.length>1?tr('并列倾向','Shared lead'):tr('本次偏好','This time');
    $('topGenre').textContent=leadingLabel;$('topPercent').textContent=top?percent(top.percent):'—';
    const svg=$('donutChart'),circle=(color,dash,offset)=>{
      const node=document.createElementNS('http://www.w3.org/2000/svg','circle');
      Object.entries({cx:100,cy:100,r:80,fill:'none',stroke:color,'stroke-width':18}).forEach(([k,v])=>node.setAttribute(k,String(v)));
      if(dash!==undefined){node.setAttribute('stroke-dasharray',dash+' '+(Math.PI*160-dash));node.setAttribute('stroke-dashoffset',String(-offset));node.setAttribute('transform','rotate(-90 100 100)');}return node;
    };
    svg.replaceChildren(circle('rgba(255,255,255,.1)'));let offset=0;
    positive.forEach(d=>{const length=Math.PI*160*d.percent/100;svg.append(circle(dimension(d.id).color,length,offset));offset+=length;});
    $('badgesContainer').replaceChildren(...positive.map(d=>{
      const badge=el('span','dna-badge'),dot=el('span','dna-badge-dot');dot.style.background=dimension(d.id).color;
      badge.append(dot,document.createTextNode(local(dimension(d.id).label)+' '+percent(d.percent)));return badge;
    }));
    const evidence=positive.slice(0,2).flatMap(d=>d.evidence.slice(0,2));
    $('evidenceContainer').replaceChildren(...(evidence.length?evidence.map(evidenceNode):[el('p','dna-evidence',tr('你暂时没有选出明确的偏好，可以换一种状态再试。','You did not express a clear preference this time. Try again when you feel like it.'))]));
    const communication=result.communication,maxCount=Math.max(0,...communication.map(c=>c.count)),communicationLeads=communication.filter(c=>c.count===maxCount);
    const communicationLabel=communicationLeads.map(c=>local(content.communication.find(s=>s.id===c.id).label)).join(' / ');
    $('communicationSummary').textContent=communicationLabel||tr('这次先不贴标签','No label this time');
    $('communicationEvidence').replaceChildren(...(communication.length?communication.flatMap(c=>c.evidence.map(evidenceNode)):[el('p','dna-evidence',tr('还没有足够的回复选择来描述你的沟通习惯。','There are not enough reply choices to describe your communication habits.'))]));
    const games=leaders.length>1?leaders:positive.slice(0,2);
    $('gamesContainer').replaceChildren(...(games.length?games.map(d=>{
      const node=el('p','dna-game-match');node.append(el('strong','',local(dimension(d.id).label)+' · '),document.createTextNode(local(dimension(d.id).games)));return node;
    }):[el('p','dna-game-match',tr('先从你愿意花时间的体验开始，不急着限定游戏类型。','Start with an experience you want to spend time on; no genre label is needed yet.'))]));
    const k=result.knowledge,unsure=k.total-k.answered;
    $('knowledgeSummary').textContent=tr('理解正确 '+k.correct+' / '+k.total+' 题'+(unsure?' · '+unsure+' 题暂未判断':''),k.correct+' / '+k.total+' understood'+(unsure?' · '+unsure+' not sure':''));
    $('knowledgeContainer').replaceChildren(...k.items.map(item=>{
      const q=questions.find(question=>question.id===item.questionId),selected=q.options.find(o=>o.id===item.optionId),details=el('details','dna-knowledge-item'),summary=el('summary');
      summary.append(el('span','',local(q.title)),el('span','dna-knowledge-state',item.uncertain?tr('未判断','Not sure'):item.correct?tr('正确','Correct'):tr('看解读','Read why')));
      details.append(summary,el('p','',tr('你的选择：','Your answer: ')+local(selected.label)),el('p','',local(q.explanation)));return details;
    }));
    $('shareCopy').textContent=tr('我的游戏偏好：','My play preferences: ')+(positive.length?positive.map(d=>local(dimension(d.id).label)+' '+percent(d.percent)).join(' / '):leadingLabel)
      +tr('。沟通习惯：','. Communication: ')+(communicationLabel||tr('暂未判断','still open'))
      +tr('。这次黑话语境理解正确 '+k.correct+' / '+k.total+' 题。','. Slang in context: '+k.correct+' / '+k.total+' understood.');
    $('shareStatus').textContent='';if(moveFocus)focusHeading('reportTitle');
  }
  function reset(){
    generation++;answers={};step=0;try{localStorage.removeItem(storageKey);}catch(_){}
    staticLabels();showIntro();focusHeading('introTitle');
  }
  function start(){
    const missing=questions.findIndex(q=>!model.isAnswerValid(q,answers[q.id]));
    if(missing<0)showReport(true);else{step=missing;renderQuestion(true);}
  }
  async function copyResult(){
    const version=generation,button=$('shareBtn');button.disabled=true;
    try{await navigator.clipboard.writeText($('shareCopy').textContent);if(version===generation&&screen==='report')$('shareStatus').textContent=tr('已复制，可以粘贴给朋友。','Copied. Paste it wherever you like.');}
    catch(_){
      if(version===generation&&screen==='report'){
        const selection=window.getSelection(),range=document.createRange();range.selectNodeContents($('shareCopy'));selection.removeAllRanges();selection.addRange(range);
        $('shareStatus').textContent=tr('结果文字已选中，可长按或按 Ctrl / Command + C 复制。','Result selected. Long-press or press Ctrl / Command + C to copy.');
      }
    }finally{button.disabled=false;}
  }
  restore();staticLabels();showIntro();$('introTitle').tabIndex=-1;
  $('startBtn').addEventListener('click',start);
  $('headerReset').addEventListener('click',reset);$('reportReset').addEventListener('click',reset);
  $('optionsContainer').addEventListener('click',event=>{const button=event.target.closest('[data-option]');if(button)selectOption(button.dataset.option);});
  $('rankingContainer').addEventListener('click',event=>{const button=event.target.closest('[data-rank-action]');if(button&&!button.disabled)moveRank(button);});
  $('prevBtn').addEventListener('click',()=>{if(step>0){step--;persist();renderQuestion(true);}});
  $('nextBtn').addEventListener('click',()=>{
    if(!model.isAnswerValid(questions[step],answers[questions[step].id]))return;
    if(step<questions.length-1){step++;persist();renderQuestion(true);}else{persist();showReport(true);}
  });
  $('shareBtn').addEventListener('click',copyResult);
  window.addEventListener('languagechange',()=>{generation++;staticLabels();if(screen==='quiz')renderQuestion();else if(screen==='report')showReport();else showIntro();});
})();
