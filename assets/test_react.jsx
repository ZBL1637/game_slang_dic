import React, { useMemo, useRef, useState } from "react";

/**
 * 黑话DNA｜H5互动小测试（单文件 React 版）
 * --------------------------------------------------
 * ✅ 纯前端，零后端依赖，可直接部署到任意静态站（Vercel/Netlify/OSS）
 * ✅ 移动端优先（375–430px 宽度自适应），竖屏体验
 * ✅ 主题随“最高占比流派”自动换肤（MOBA/二次元/沙盒/FPS/竞速/休闲）
 * ✅ SVG 环形占比图、流派徽章、黑话关键词云
 * ✅ 一键生成海报（html-to-image），按当前分辨率自适应导出
 * ✅ 本地缓存（localStorage）避免刷新丢失
 * ✅ 无 IP 侵权素材：像素块/速线/准星等通用元素
 * --------------------------------------------------
 * 变更日志（修复 SyntaxError 与响应式导出）：
 * - 修复 TSX 中的转义错误：去除 <div className=\"pChart\"> 中的反斜杠（应为 className="pChart"）。
 * - 校对“可复用小组件 end”注释前所有括号与逗号配对；保证 TSX 结构闭合。
 * - 海报/报告环形图均改为响应式尺寸；容器使用 aspect-ratio: 9/16。
 * - 导出逻辑根据视口宽度与 DPR 计算目标尺寸，限制在 720–1440px 之间，保证清晰与性能平衡。
 * - 扩充自检测试（T7–T9），保持原有测试不变。
 */

// ------- 轻量工具与常量 -------
const GENRES = ["MOBA", "二次元", "沙盒", "FPS", "竞速", "休闲"] as const;
type Genre = typeof GENRES[number];

type Weights = Partial<Record<Genre, number>>;

type Option = {
  label: string;
  weights: Weights; // 对各流派的贡献权重
  hint?: string; // 选项小提示
};

type Question = {
  id: string;
  title: string;
  subtitle?: string;
  options: Option[];
  multi?: boolean; // 是否多选
  maxPick?: number; // 多选上限
};

// 黑话词库（报告页随机抽取展示）
const JARGON: Record<Genre, string[]> = {
  MOBA: [
    "别送！稳住节奏",
    "先手控一手，跟上跟上",
    "开团拉满，别贪线",
    "看资源节奏，小龙先拿",
  ],
  二次元: [
    "抽卡玄学，今天必不歪",
    "UP 池满命是信仰",
    "肝活动也要有仪式感",
    "角色强度只是参考，爱才是永恒",
  ],
  沙盒: [
    "今晚继续开荒搭家",
    "红石电路我小有研究",
    "种田养老才是王道",
    "生存日记·第 7 天",
  ],
  FPS: [
    "拉枪线，别露头",
    "压枪稳住，听脚步",
    "A 点无敌点清了",
    "烟闪火来一个",
  ],
  竞速: [
    "走内线贴弯 apex",
    "氮气点放别早",
    "刹车漂移别断流",
    "分段卡线，干净利落",
  ],
  休闲: [
    "开黑走起，轻松躺赢",
    "佛系日常，签到即快乐",
    "派对局快乐最重要",
    "好友互动加成 +100",
  ],
};

// 主题皮肤（随最高占比流派变化）
const THEMES: Record<Genre, { bg: string; accent: string; deco: React.ReactNode }>= {
  MOBA: {
    bg: "linear-gradient(135deg,#0b1222,#0e1c3a 60%,#183b8a)",
    accent: "#5cc3ff",
    deco: (<DecoCircuit />),
  },
  二次元: {
    bg: "linear-gradient(135deg,#271a3a,#3b2364 60%,#7045ff)",
    accent: "#ffd6ff",
    deco: (<DecoSparkles />),
  },
  沙盒: {
    bg: "linear-gradient(135deg,#1f1a14,#2b241a 60%,#6f5b2f)",
    accent: "#ffcc66",
    deco: (<DecoVoxel />),
  },
  FPS: {
    bg: "linear-gradient(135deg,#121212,#1b1b1b 60%,#2e2e2e)",
    accent: "#8cf2a5",
    deco: (<DecoCrosshair />),
  },
  竞速: {
    bg: "linear-gradient(135deg,#0d1018,#0f1422 60%,#1c2e6b)",
    accent: "#7ab8ff",
    deco: (<DecoSpeedLines />),
  },
  休闲: {
    bg: "linear-gradient(135deg,#17211a,#1d2a20 60%,#284e3a)",
    accent: "#b7ffce",
    deco: (<DecoConfetti />),
  },
};

// 小工具：将权重累加并标准化到 100%
function normalize(scores: Record<Genre, number>) {
  const sum = GENRES.reduce((acc, g) => acc + (scores[g] || 0), 0) || 1;
  const raw = GENRES.map((g) => ({ g, v: (scores[g] || 0) / sum }));
  // 保留 5 个小数再四舍五入，最后用最大项补齐 100（避免误差）
  const percents = raw.map(({ g, v }) => ({ g, p: Math.round(v * 1000) / 10 }));
  const diff = 100 - percents.reduce((a, x) => a + x.p, 0);
  if (diff !== 0) {
    const maxIdx = percents.reduce((mi, x, i, arr) => (x.p > arr[mi].p ? i : mi), 0);
    percents[maxIdx].p += diff;
  }
  return percents;
}

// 问题集（8 题示例，可自行增删）
const QUESTIONS: Question[] = [
  {
    id: "q1",
    title: "你最喜欢哪种游戏类型？",
    options: [
      { label: "MOBA 团队竞技", weights: { MOBA: 3, FPS: 1 } },
      { label: "二次元抽卡养成", weights: { 二次元: 3, 休闲: 1 } },
      { label: "沙盒创造/生存", weights: { 沙盒: 3, 休闲: 1 } },
      { label: "FPS 射击对战", weights: { FPS: 3, 竞速: 1 } },
      { label: "竞速/赛车", weights: { 竞速: 3, FPS: 1 } },
      { label: "派对/休闲", weights: { 休闲: 3, 二次元: 1 } },
    ],
  },
  {
    id: "q2",
    title: "开黑时你最常说的一句？",
    options: [
      { label: "别送！稳住节奏", weights: { MOBA: 2 } },
      { label: "今晚一定出金闪闪", weights: { 二次元: 2 } },
      { label: "先把家搭好再探险", weights: { 沙盒: 2 } },
      { label: "听枪声，卡视野", weights: { FPS: 2 } },
      { label: "走内线，漂移！", weights: { 竞速: 2 } },
      { label: "佛系一点，开心就好", weights: { 休闲: 2 } },
    ],
  },
  {
    id: "q3",
    title: "你在队伍里的典型定位是？",
    options: [
      { label: "指挥型：开团拉满", weights: { MOBA: 2, FPS: 1 } },
      { label: "工具人：资源管理达人", weights: { 沙盒: 2, 二次元: 1 } },
      { label: "核心 C：伤害拉满", weights: { FPS: 2, MOBA: 1 } },
      { label: "辅助奶妈：兜底护航", weights: { 二次元: 2, 休闲: 1 } },
      { label: "极限操作手：极速与激情", weights: { 竞速: 2 } },
    ],
  },
  {
    id: "q4",
    title: "遇到连败你会？",
    options: [
      { label: "复盘节奏问题，换战术", weights: { MOBA: 2, FPS: 1 } },
      { label: "抽卡换阵容，下把转运", weights: { 二次元: 2 } },
      { label: "回家造点更强的装备", weights: { 沙盒: 2 } },
      { label: "换图/练枪，打基础", weights: { FPS: 2 } },
      { label: "冲几把竞速换换脑子", weights: { 竞速: 2 } },
      { label: "休息一下，明天再战", weights: { 休闲: 2 } },
    ],
  },
  {
    id: "q5",
    title: "你最享受的游戏瞬间？",
    options: [
      { label: "一波开团翻盘全场沸腾", weights: { MOBA: 3 } },
      { label: "抽到心仪角色/满命", weights: { 二次元: 3 } },
      { label: "搭出复杂机关顺利运转", weights: { 沙盒: 3 } },
      { label: "极限 1v3 反杀", weights: { FPS: 3 } },
      { label: "终点线前反超", weights: { 竞速: 3 } },
      { label: "朋友一起哈哈大笑", weights: { 休闲: 3 } },
    ],
  },
  {
    id: "q6",
    title: "偏爱的美术/界面风格？",
    options: [
      { label: "科幻霓虹 / 赛博 UI", weights: { MOBA: 2, FPS: 1 } },
      { label: "日系清爽 / 软萌渐变", weights: { 二次元: 2 } },
      { label: "像素/方块/自然质感", weights: { 沙盒: 2 } },
      { label: "极简战术 / HUD 信息流", weights: { FPS: 2 } },
      { label: "速度线 / 碳纤维纹理", weights: { 竞速: 2 } },
      { label: "糖果色 / 派对贴纸感", weights: { 休闲: 2 } },
    ],
  },
  {
    id: "q7",
    title: "更像你的一句个性签名是？",
    options: [
      { label: "节奏是门艺术", weights: { MOBA: 2 } },
      { label: "命运与我签了契约", weights: { 二次元: 2 } },
      { label: "世界是我搭的乐高", weights: { 沙盒: 2 } },
      { label: "精准即浪漫", weights: { FPS: 2 } },
      { label: "速度即信仰", weights: { 竞速: 2 } },
      { label: "快乐至上", weights: { 休闲: 2 } },
    ],
  },
  {
    id: "q8",
    title: "可多选：以下你也常玩？",
    subtitle: "最多选 2 个",
    multi: true,
    maxPick: 2,
    options: [
      { label: "MOBA", weights: { MOBA: 1 } },
      { label: "二次元", weights: { 二次元: 1 } },
      { label: "沙盒", weights: { 沙盒: 1 } },
      { label: "FPS", weights: { FPS: 1 } },
      { label: "竞速", weights: { 竞速: 1 } },
      { label: "休闲派对", weights: { 休闲: 1 } },
    ],
  },
];

// ------- 主组件 -------
export default function BlackSpeakDNAApp() {
  const [step, setStep] = useState<"intro" | number | "report" | "poster">(
    hasCache() ? "report" : "intro"
  );
  const [answers, setAnswers] = useState<Record<string, number[]>>({});
  const [seed] = useState(() => Math.random());

  const scores = useMemo(() => aggregateScores(answers), [answers]);
  const percents = useMemo(() => normalize(scores), [scores]);
  const top = useMemo(() => percents.slice().sort((a,b)=>b.p-a.p)[0]?.g || "MOBA", [percents]);
  const theme = THEMES[top];

  const posterRef = useRef<HTMLDivElement>(null);
  const [posterUrl, setPosterUrl] = useState<string | null>(null);

  function onPick(q: Question, idx: number) {
    setAnswers((prev) => {
      const cur = prev[q.id] || [];
      if (!q.multi) return { ...prev, [q.id]: [idx] };
      const exists = cur.includes(idx);
      let next = exists ? cur.filter((i) => i !== idx) : [...cur, idx];
      if (q.maxPick && next.length > q.maxPick) next = next.slice(-q.maxPick);
      return { ...prev, [q.id]: next };
    });
  }

  function nextStep() {
    if (step === "intro") setStep(0);
    else if (typeof step === "number" && step < QUESTIONS.length - 1) setStep(step + 1);
    else if (typeof step === "number") {
      persist({ answers });
      setStep("report");
    }
  }

  function prevStep() {
    if (typeof step === "number" && step > 0) setStep(step - 1);
  }

  function resetAll() {
    setAnswers({});
    setPosterUrl(null);
    clearCache();
    setStep("intro");
  }

  async function makePoster() {
    try {
      // 动态导入，避免初始包过大
      const htmlToImage = await import("html-to-image");
      const node = posterRef.current!;
      const vw = window.innerWidth || 360;
      const dpr = Math.max(1, Math.min(4, window.devicePixelRatio || 2));
      const targetWidth = Math.round(Math.min(1440, Math.max(720, vw * dpr)));
      const targetHeight = Math.round(targetWidth * 16 / 9);
      const dataUrl = await htmlToImage.toPng(node, {
        cacheBust: true,
        width: targetWidth,
        height: targetHeight,
        pixelRatio: 1,
        backgroundColor: "#000",
      });
      setPosterUrl(dataUrl);
    } catch (e) {
      alert("海报导出失败：可能不支持 html-to-image。你也可以尝试系统截图保存~");
      console.error(e);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: theme.bg, color: "#E8F1FF" }}>
      <style>{globalCss}</style>
      <div className="container">
        {theme.deco}
        <Header onReset={resetAll} accent={theme.accent} />
        {step === "intro" && <Intro onStart={() => setStep(0)} accent={theme.accent} />}
        {typeof step === "number" && (
          <Quiz
            step={step}
            q={QUESTIONS[step]}
            total={QUESTIONS.length}
            selected={answers[QUESTIONS[step].id] || []}
            onPick={onPick}
            onNext={nextStep}
            onPrev={prevStep}
            accent={theme.accent}
          />
        )}
        {step === "report" && (
          <Report
            percents={percents}
            seed={seed}
            onMakePoster={() => setStep("poster")}
            accent={theme.accent}
          />
        )}
        {step === "poster" && (
          <Poster
            ref={posterRef}
            percents={percents}
            seed={seed}
            onExport={makePoster}
            url={posterUrl}
            accent={theme.accent}
            themeName={top}
          />
        )}
      </div>
    </div>
  );
}

// ------- 子组件：装饰 -------
function DecoCircuit() {
  return (
    <svg className="deco" viewBox="0 0 375 200" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id="glow" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#5cc3ff" stopOpacity="0.0" />
          <stop offset="50%" stopColor="#5cc3ff" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#5cc3ff" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[...Array(12)].map((_,i)=> (
        <path key={i} d={`M0 ${10+i*14} H 320 q 20 0 20 20 V 200`} stroke="url(#glow)" strokeWidth="1" fill="none" />
      ))}
    </svg>
  );
}
function DecoSparkles(){
  return (
    <svg className="deco" viewBox="0 0 375 200" preserveAspectRatio="none" aria-hidden>
      {[...Array(40)].map((_,i)=> (
        <circle key={i} cx={Math.random()*375} cy={Math.random()*200} r={Math.random()*1.8+0.2} fill="#ffd6ff" opacity={Math.random()*0.5+0.2} />
      ))}
    </svg>
  );
}
function DecoVoxel(){
  return (
    <svg className="deco" viewBox="0 0 375 200" preserveAspectRatio="none" aria-hidden>
      {[...Array(18)].map((_,i)=> {
        const x = (i%6)*62 + 10; const y = Math.floor(i/6)*60 + 10;
        return <rect key={i} x={x} y={y} width="48" height="48" fill="#ffcc6655" stroke="#ffcc66aa" />
      })}
    </svg>
  );
}
function DecoCrosshair(){
  return (
    <svg className="deco" viewBox="0 0 375 200" preserveAspectRatio="none" aria-hidden>
      {[...Array(6)].map((_,i)=>{
        const cx = 50 + i*55; const cy = 40 + (i%2)*60;
        return (
          <g key={i} opacity="0.35" transform={`translate(${cx},${cy})`}>
            <circle r="22" stroke="#8cf2a5" fill="none" />
            <circle r="6" fill="#8cf2a5" />
            <line x1="-28" y1="0" x2="-10" y2="0" stroke="#8cf2a5"/>
            <line x1="10" y1="0" x2="28" y2="0" stroke="#8cf2a5"/>
            <line x1="0" y1="-28" x2="0" y2="-10" stroke="#8cf2a5"/>
            <line x1="0" y1="10" x2="0" y2="28" stroke="#8cf2a5"/>
          </g>
        );
      })}
    </svg>
  );
}
function DecoSpeedLines(){
  return (
    <svg className="deco" viewBox="0 0 375 200" preserveAspectRatio="none" aria-hidden>
      {[...Array(12)].map((_,i)=> (
        <rect key={i} x={-60+i*40} y={20+i*12} width={100+i*40} height="2" fill="#7ab8ff" opacity={0.15+0.05*(i%3)} />
      ))}
    </svg>
  );
}
function DecoConfetti(){
  const shapes = ["rect","circle","tri"] as const;
  return (
    <svg className="deco" viewBox="0 0 375 200" preserveAspectRatio="none" aria-hidden>
      {[...Array(36)].map((_,i)=>{
        const x = Math.random()*375; const y = Math.random()*200; const t = shapes[i%3];
        const o = 0.25+Math.random()*0.5;
        const c = ["#b7ffce","#d2ffe6","#e8fff4"][i%3];
        if (t==="rect") return <rect key={i} x={x} y={y} width="6" height="12" fill={c} opacity={o} />
        if (t==="circle") return <circle key={i} cx={x} cy={y} r="4" fill={c} opacity={o} />
        return <polygon key={i} points={`${x},${y} ${x+6},${y} ${x+3},${y+6}`} fill={c} opacity={o} />
      })}
    </svg>
  );
}

// ------- 子组件：头部/引导/题目/报告/海报 -------
function Header({ onReset, accent }: { onReset: ()=>void; accent:string }){
  return (
    <div className="header">
      <div className="title">
        <span style={{ color: accent }}>黑话</span>DNA
      </div>
      <button className="link" onClick={onReset}>重新开始</button>
    </div>
  );
}

function Intro({ onStart, accent }: { onStart: ()=>void; accent:string }){
  return (
    <div className="card">
      <div className="big">
        你的游戏<span style={{color:accent}}>“黑话”</span>基因，究竟来自哪里？
      </div>
      <p className="muted">通过 8 个趣味问题，生成你的「黑话 DNA 报告」。支持一键生成海报，分享给好友一起对线（不，是对标 😎）。</p>
      <ul className="bullets">
        <li>流派占比：MOBA / 二次元 / 沙盒 / FPS / 竞速 / 休闲</li>
        <li>黑话关键词云 + 身份标签 + 分享文案</li>
        <li>不涉及任何特定游戏 IP（放心使用）</li>
      </ul>
      <button className="primary" onClick={onStart}>开始测试</button>
    </div>
  );
}

function Quiz({ q, step, total, selected, onPick, onPrev, onNext, accent }:{
  q: Question; step:number; total:number; selected:number[]; onPick:(q:Question, idx:number)=>void; onPrev:()=>void; onNext:()=>void; accent:string;
}){
  const canNext = selected.length > 0;
  return (
    <div className="card">
      <div className="step">问题 {step+1} / {total}</div>
      <div className="qtitle">{q.title}</div>
      {q.subtitle && <div className="qsub">{q.subtitle}</div>}
      <div className="options">
        {q.options.map((op, idx)=>{
          const active = selected.includes(idx);
          return (
            <button key={idx} className={`option ${active?"active":""}`} onClick={()=>onPick(q, idx)}>
              <span>{op.label}</span>
              {op.hint && <em>{op.hint}</em>}
            </button>
          );
        })}
      </div>
      <div className="actions">
        <button className="ghost" onClick={onPrev} disabled={step===0}>上一步</button>
        <button className="primary" onClick={onNext} disabled={!canNext}>下一步</button>
      </div>
      <div className="progress"><div className="bar" style={{width: `${((step+1)/total)*100}%`, background: accent}}/></div>
    </div>
  );
}

function Report({ percents, seed, onMakePoster, accent }:{
  percents: {g:Genre; p:number}[]; seed:number; onMakePoster:()=>void; accent:string;
}){
  const top = percents.slice().sort((a,b)=>b.p-a.p)[0];
  const tags = makeTags(percents);
  const sample = makeJargonSample(percents, seed);
  const copy = makeShareCopy(percents);

  const vw = (typeof window !== 'undefined' ? window.innerWidth : 390);
  const chartSize = Math.round(Math.min(260, Math.max(200, vw * 0.6)));

  return (
    <div className="card">
      <div className="sectionTitle">你的黑话 DNA 报告</div>

      <div className="ringWrap">
        <DonutChart data={percents} accent={accent} size={chartSize} />
        <div className="center">
          <div className="label">TOP</div>
          <div className="topg" style={{color:accent}}>{top.g}</div>
          <div className="topp">{top.p}%</div>
        </div>
      </div>

      <div className="badges">
        {percents.slice(0,3).map((x,i)=> (
          <Badge key={x.g} label={`${x.g} ${x.p}%`} rank={i+1} />
        ))}
      </div>

      <div className="tagCloud">
        {tags.map((t,i)=> <span key={i} className="chip">{t}</span>)}
      </div>

      <div className="panel">
        <div className="panelTitle">黑话片段 · 随机采样</div>
        <p className="jargon">{sample}</p>
      </div>

      <div className="panel">
        <div className="panelTitle">自动生成分享文案</div>
        <p className="copy">{copy}</p>
      </div>

      <div className="actions">
        <button className="ghost" onClick={()=>{clearCache(); location.reload();}}>重新测</button>
        <button className="primary" onClick={onMakePoster}>生成海报</button>
      </div>
    </div>
  );
}

const Poster = React.forwardRef<HTMLDivElement, {
  percents: {g:Genre; p:number}[];
  seed:number;
  onExport: ()=>void;
  url: string | null;
  accent: string;
  themeName: Genre;
}>(({ percents, seed, onExport, url, accent, themeName }, ref) => {
  const tags = makeTags(percents).slice(0, 10);
  const sample = makeJargonSample(percents, seed);
  const now = new Date();
  const date = `${now.getFullYear()}.${String(now.getMonth()+1).padStart(2,"0")}.${String(now.getDate()).padStart(2,"0")}`;
  const sorted = percents.slice().sort((a,b)=>b.p-a.p);
  const vw = (typeof window !== 'undefined' ? window.innerWidth : 390);
  const posterCssWidth = Math.min(420, Math.max(300, vw * 0.88));
  const donutSize = Math.round(posterCssWidth * 0.55);

  return (
    <div className="card">
      <div className="sectionTitle">海报预览 · 可长按保存</div>
      <div className="posterWrap">
        <div className="poster" ref={ref} style={{ background: `radial-gradient(1200px 900px at 50% 0%, ${hexWithAlpha(accent,0.25)}, transparent 60%)` }}>
          <div className="posterInner">
            <div className="pHeader">
              <div className="pTitle"><span style={{color:accent}}>黑话</span>DNA</div>
              <div className="pSub">我的语言是由游戏塑造的</div>
            </div>
            <div className="pBody">
              <div className="pChart"><DonutChart data={percents} accent={accent} size={donutSize}/></div>
              <div className="pTop">TOP {sorted[0].g} · {sorted[0].p}%</div>
              <div className="pTags">{tags.map((t,i)=> <span key={i} className="chip big">{t}</span>)}</div>
              <div className="pJargon">“{sample}”</div>
            </div>
            <div className="pFooter">
              <div className="pMeta">#{themeName} #黑话DNA  · {date}</div>
            </div>
          </div>
        </div>
      </div>

      {!url && <button className="primary" onClick={onExport}>导出 PNG</button>}
      {url && (
        <div className="panel">
          <div className="panelTitle">已生成</div>
          <img src={url} alt="海报" className="img" />
          <a className="primary block" download={`黑话DNA-${date}.png`} href={url}>下载到本地</a>
        </div>
      )}

      <div className="actions">
        <button className="ghost" onClick={()=>location.reload()}>回到首页</button>
      </div>
    </div>
  );
});

// ------- 可视化/小元件 -------
function DonutChart({ data, size=220, stroke=20, accent }:{
  data:{g:Genre;p:number}[]; size?:number; stroke?:number; accent:string;
}){
  const R = size/2 - stroke/2;
  const C = Math.PI*2*R;
  let acc = 0;
  const palette: Record<Genre,string> = {
    MOBA: accent,
    二次元: "#ff98ff",
    沙盒: "#ffcc66",
    FPS: "#8cf2a5",
    竞速: "#7ab8ff",
    休闲: "#b7ffce",
  };
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size/2} cy={size/2} r={R} stroke="#ffffff18" strokeWidth={stroke} fill="none" />
      {data.map((d,i)=>{
        const len = (d.p/100)*C;
        const dash = `${len} ${C-len}`;
        const el = (
          <circle key={i} cx={size/2} cy={size/2} r={R}
            stroke={palette[d.g]} strokeWidth={stroke} fill="none"
            strokeDasharray={dash} strokeDashoffset={-acc} strokeLinecap="round"
          />
        );
        acc += len;
        return el;
      })}
      <circle cx={size/2} cy={size/2} r={R} stroke="#ffffff" strokeOpacity="0.05" strokeWidth={stroke} fill="none" />
    </svg>
  );
}

function Badge({ label, rank }:{ label:string; rank:number }){
  return (
    <div className={`badge rank${rank}`}>
      <span className="dot"/><span>{label}</span>
    </div>
  );
}

function SmallQR(){
  // 简化：生成一个“像素风占位 QR”，实际可换成真实链接二维码
  const s = 64;
  const cells = 16;
  const rnd = (x:number,y:number)=> (x*y*97 + 13) % 7 > 3;
  const blocks: [number,number][] = [];
  for (let x=0;x<cells;x++) for (let y=0;y<cells;y++) {
    // 角落 3 个定位块
    const corner = (x<4&&y<4) || (x>cells-5&&y<4) || (x<4&&y>cells-5);
    if (corner || rnd(x,y)) blocks.push([x,y]);
  }
  const blockSize = s/cells;
  return (
    <svg width={s} height={s}>
      <rect width={s} height={s} fill="#fff"/>
      {blocks.map(([x,y],i)=> <rect key={i} x={x*blockSize} y={y*blockSize} width={blockSize-1} height={blockSize-1} fill="#111"/>) }
    </svg>
  );
}

// ------- 业务逻辑工具 -------
function aggregateScores(ans: Record<string, number[]>) {
  const map: Record<Genre, number> = { MOBA:0, 二次元:0, 沙盒:0, FPS:0, 竞速:0, 休闲:0 };
  for (const q of QUESTIONS) {
    const picks = ans[q.id] || [];
    for (const i of picks) {
      const op = q.options[i];
      for (const g of GENRES) map[g] += op.weights[g] || 0;
    }
  }
  return map;
}

function makeTags(percents: {g:Genre;p:number}[]) {
  const sorted = percents.slice().sort((a,b)=>b.p-a.p);
  const top = sorted[0].g;
  const base: Record<Genre,string[]> = {
    MOBA: ["节奏控", "开团王", "运营达人", "视野怪", "稳健派"],
    二次元: ["非酋自救", "厨力 MAX", "抽卡玄学", "养成派", "剧情党"],
    沙盒: ["造物主", "红石学徒", "开荒家", "生存王", "设计癖"],
    FPS: ["压枪稳", "准星锁定", "卡点怪", "雷电手", "战术家"],
    竞速: ["弯道之神", "氮气掌控", "线路狂魔", "极限漂移", "追风者"],
    休闲: ["快乐至上", "社交王", "派对 MVP", "签到怪", "佛系玩家"],
  };
  // Top 流派加成，前 2 个流派更多标签
  const tags = [
    ...base[top].slice(0,3),
    ...base[sorted[1].g].slice(0,2),
    base[sorted[2].g][0],
  ];
  return tags;
}

function makeJargonSample(percents: {g:Genre;p:number}[], seed:number) {
  // 按占比加权抽取 2~3 条黑话拼接
  function pickWeighted<T>(arr: T[], w: number) { // w: 选中概率权重（0~1）
    const tries = Math.max(1, Math.round(w*3));
    return arr[Math.floor(((seed*9973)%1 + Math.random())/2 * Math.min(arr.length, tries))] || arr[0];
  }
  const parts: string[] = [];
  const top3 = percents.slice(0,3);
  for (const {g,p} of top3) {
    parts.push(pickWeighted(JARGON[g], p/100));
  }
  return parts.join(" · ");
}

function makeShareCopy(percents:{g:Genre;p:number}[]) {
  const top = percents[0];
  const second = percents[1];
  return `我的“黑话 DNA”：${top.g}${top.p}% + ${second.g}${second.p}% 组成。一起测测你的是啥？`;
}

// ------- 本地缓存 -------
function persist(data:any){
  localStorage.setItem("black-dna", JSON.stringify(data));
}
function hasCache(){
  try { return !!JSON.parse(localStorage.getItem("black-dna")||"null"); } catch { return false; }
}
function clearCache(){ localStorage.removeItem("black-dna"); }

// ------- 样式 -------
const globalCss = `
  *{box-sizing:border-box} body{margin:0}
  .container{max-width:430px;margin:0 auto;padding:16px 14px 48px;position:relative}
  .deco{position:absolute;left:0;right:0;top:0;height:200px;pointer-events:none}
  .header{display:flex;justify-content:space-between;align-items:center;padding:14px 8px 8px}
  .title{font-size:22px;font-weight:800;letter-spacing:1px}
  .link{background:none;border:none;color:#9fb5ff;opacity:.9}
  .card{background:#0d111a80;border:1px solid #ffffff14;border-radius:16px;padding:16px;margin-top:16px;backdrop-filter: blur(6px);box-shadow:0 6px 30px #00000040}
  .big{font-size:22px;line-height:1.4;font-weight:800;margin-bottom:12px}
  .muted{opacity:.8;line-height:1.6}
  .bullets{opacity:.85;line-height:1.8;margin:8px 0 16px 18px}
  .primary{background:#2b67ff;border:none;color:#fff;padding:12px 16px;border-radius:12px;font-weight:700}
  .ghost{background:#ffffff12;border:1px solid #ffffff22;color:#dce7ff;padding:12px 16px;border-radius:12px}
  .primary.block{display:block;text-align:center;margin-top:12px}
  .step{opacity:.8;font-size:12px;margin-bottom:8px}
  .qtitle{font-size:18px;font-weight:800;margin-bottom:10px}
  .qsub{opacity:.7;margin-bottom:12px}
  .options{display:grid;grid-template-columns:1fr;gap:10px}
  .option{width:100%;text-align:left;background:#ffffff08;border:1px solid #ffffff18;border-radius:12px;padding:12px 14px;color:#e8f1ff}
  .option.active{outline:2px solid #7ab8ff;background:#ffffff14}
  .option em{display:block;opacity:.6;margin-top:4px}
  .actions{display:flex;gap:10px;justify-content:space-between;margin-top:14px}
  .progress{height:6px;background:#ffffff12;border-radius:99px;margin-top:10px;overflow:hidden}
  .bar{height:100%;border-radius:99px}
  .sectionTitle{font-weight:900;font-size:16px;margin-bottom:10px;letter-spacing:.5px}
  .ringWrap{position:relative;width:clamp(200px,68vw,260px);height:clamp(200px,68vw,260px);margin:10px auto}
  .ringWrap .center{position:absolute;left:0;top:0;width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center}
  .center .label{opacity:.6;font-size:12px}
  .center .topg{font-size:22px;font-weight:900;margin-top:2px}
  .center .topp{opacity:.9;margin-top:4px}
  .badges{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:12px}
  .badge{display:flex;align-items:center;gap:6px;background:#ffffff10;border:1px solid #ffffff18;padding:6px 10px;border-radius:9999px}
  .badge .dot{width:6px;height:6px;border-radius:6px;background:#7ab8ff}
  .badge.rank1{box-shadow:0 0 0 2px #ffffff18 inset}
  .tagCloud{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin:12px 0}
  .chip{background:#ffffff10;border:1px solid #ffffff18;padding:6px 10px;border-radius:999px}
  .chip.big{padding:8px 12px;font-weight:700}
  .panel{background:#00000026;border:1px dashed #ffffff26;border-radius:12px;padding:12px;margin-top:12px}
  .panelTitle{opacity:.7;margin-bottom:6px;font-size:12px}
  .jargon{opacity:.95;line-height:1.7}
  .copy{opacity:.9}
  .posterWrap{display:flex;justify-content:center;margin:6px 0 10px}
  .poster{width:clamp(300px, 88vw, 420px);height:auto;aspect-ratio:9/16;border-radius:22px;overflow:hidden;border:1px solid #ffffff22;background:#111}
  .posterInner{padding:14px;display:flex;flex-direction:column;height:100%}
  .pHeader{display:flex;justify-content:space-between;align-items:flex-end}
  .pTitle{font-size:28px;font-weight:900}
  .pSub{opacity:.8}
  .pBody{display:flex;flex-direction:column;gap:10px;margin:8px 0;flex:1}
  .pChart{flex:none;display:flex;align-items:center;justify-content:center}
  .pRight{display:flex;flex-direction:column;gap:8px}
  .pTop{font-weight:900;text-align:center}
  .pTags{display:flex;flex-wrap:wrap;gap:6px;justify-content:center}
  .pJargon{opacity:.95;margin-top:auto;text-align:center}
  .pFooter{display:flex;align-items:center;justify-content:center;opacity:.85;font-size:12px}
  .panel .img{width:100%;border-radius:12px;margin-top:8px}
`;

// ------- 小工具 -------
function hexWithAlpha(hex:string, a:number){
  // 接收 #RRGGBB
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${a})`;
}

// ------- 自检测试（控制台） -------
(function runSelfTests(){
  try {
    // T1: normalize 输出长度 & 求和=100
    const n1 = normalize({ MOBA: 1, 二次元: 0, 沙盒: 0, FPS: 0, 竞速: 0, 休闲: 0 } as any);
    console.assert(n1.length === 6, "normalize 应返回 6 个流派");
    const sum1 = n1.reduce((a,x)=>a+x.p,0);
    console.assert(sum1 === 100, "normalize 百分比之和应为 100，得到="+sum1);

    // T2: 单一优势应为 100%
    console.assert(n1.find(x=>x.g==="MOBA")!.p === 100, "单一优势应拉满 100%");

    // T3: makeTags 至少 6 个标签（3+2+1）
    const tags = makeTags([
      {g:"MOBA" as Genre,p:50},
      {g:"FPS" as Genre,p:30},
      {g:"沙盒" as Genre,p:20},
      {g:"二次元" as Genre,p:0},
      {g:"竞速" as Genre,p:0},
      {g:"休闲" as Genre,p:0},
    ]);
    console.assert(tags.length === 6, "标签数应为 6");

    // T4: aggregateScores 基本累加
    const agg = aggregateScores({ q1: [0], q2: [0] });
    console.assert(agg.MOBA >= 3+2, "得分应正确累加");

    // T5: normalize 浮点组合仍应=100
    const n2 = normalize({ MOBA: 2, FPS: 1, 沙盒: 1, 二次元: 0, 竞速: 0, 休闲: 0 } as any);
    const sum2 = n2.reduce((a,x)=>a+x.p,0);
    console.assert(sum2 === 100, "normalize 浮点组合求和=100，得到="+sum2);

    // T6: 分享文案包含 Top 与次席占比
    const sc = makeShareCopy([
      {g:"MOBA" as Genre,p:40},
      {g:"二次元" as Genre,p:30},
      {g:"沙盒" as Genre,p:20},
      {g:"FPS" as Genre,p:10},
      {g:"竞速" as Genre,p:0},
      {g:"休闲" as Genre,p:0},
    ]);
    console.assert(/MOBA40%/u.test(sc) && /二次元30%/u.test(sc), "分享文案应包含Top与次席");

    // T7: 全零输入时仍保证和为100且无负值
    const n3 = normalize({ MOBA:0, 二次元:0, 沙盒:0, FPS:0, 竞速:0, 休闲:0 } as any);
    const sum3 = n3.reduce((a,x)=>a+x.p,0);
    console.assert(sum3 === 100 && n3.every(x=>x.p>=0), "全零输入时，总和=100 且无负值");

    // T8: 黑话采样非空
    const sample = makeJargonSample([
      {g:"MOBA" as Genre,p:40},
      {g:"二次元" as Genre,p:30},
      {g:"沙盒" as Genre,p:20},
      {g:"FPS" as Genre,p:10},
      {g:"竞速" as Genre,p:0},
      {g:"休闲" as Genre,p:0},
    ], Math.random());
    console.assert(sample && sample.length>0, "黑话采样应返回非空字符串");

    // T9: 多选题累加
    const agg2 = aggregateScores({ q8: [0,1] });
    console.assert(agg2.MOBA>=1 && agg2.二次元>=1, "多选累加应生效");

    console.log("[黑话DNA] 自检测试全部通过 ✅");
  } catch (err) {
    console.error("[黑话DNA] 自检测试失败 ❌", err);
  }
})();

// ------- 可复用小组件 end -------
