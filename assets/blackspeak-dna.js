/**
 * 黑话DNA测试 - JavaScript逻辑
 * 转换自React版本，适配原生HTML/CSS/JS
 */

// 游戏流派常量
const GENRES = ["MOBA", "二次元", "沙盒", "FPS", "竞速", "休闲"];

// 黑话词库
const JARGON = {
    "MOBA": [
        "别送！稳住节奏",
        "先手控一手，跟上跟上", 
        "开团拉满，别贪线",
        "看资源节奏，小龙先拿"
    ],
    "二次元": [
        "抽卡玄学，今天必不歪",
        "UP 池满命是信仰",
        "肝活动也要有仪式感", 
        "角色强度只是参考，爱才是永恒"
    ],
    "沙盒": [
        "今晚继续开荒搭家",
        "红石电路我小有研究",
        "种田养老才是王道",
        "生存日记·第 7 天"
    ],
    "FPS": [
        "拉枪线，别露头",
        "压枪稳住，听脚步",
        "A 点无敌点清了",
        "烟闪火来一个"
    ],
    "竞速": [
        "走内线贴弯 apex",
        "氮气点放别早", 
        "刹车漂移别断流",
        "分段卡线，干净利落"
    ],
    "休闲": [
        "开黑走起，轻松躺赢",
        "佛系日常，签到即快乐",
        "派对局快乐最重要",
        "好友互动加成 +100"
    ]
};

// 主题配色 - 统一网页配色方案
const THEMES = {
    "MOBA": { bg: "linear-gradient(135deg,#0b1222,#0e1c3a 60%,#183b8a)", accent: "#7F0056" },
    "二次元": { bg: "linear-gradient(135deg,#271a3a,#3b2364 60%,#7045ff)", accent: "#D946EF" },
    "沙盒": { bg: "linear-gradient(135deg,#1f1a14,#2b241a 60%,#6f5b2f)", accent: "#3B82F6" },
    "FPS": { bg: "linear-gradient(135deg,#121212,#1b1b1b 60%,#2e2e2e)", accent: "#7F0056" },
    "竞速": { bg: "linear-gradient(135deg,#0d1018,#0f1422 60%,#1c2e6b)", accent: "#3B82F6" },
    "休闲": { bg: "linear-gradient(135deg,#17211a,#1d2a20 60%,#284e3a)", accent: "#D946EF" }
};

// 问题数据
const QUESTIONS = [
    {
        id: "q1",
        title: "你最喜欢哪种游戏类型？",
        options: [
            { label: "MOBA 团队竞技", weights: { "MOBA": 3, "FPS": 1 } },
            { label: "二次元抽卡养成", weights: { "二次元": 3, "休闲": 1 } },
            { label: "沙盒创造/生存", weights: { "沙盒": 3, "休闲": 1 } },
            { label: "FPS 射击对战", weights: { "FPS": 3, "竞速": 1 } },
            { label: "竞速/赛车", weights: { "竞速": 3, "FPS": 1 } },
            { label: "派对/休闲", weights: { "休闲": 3, "二次元": 1 } }
        ]
    },
    {
        id: "q2", 
        title: "开黑时你最常说的一句？",
        options: [
            { label: "别送！稳住节奏", weights: { "MOBA": 2 } },
            { label: "今晚一定出金闪闪", weights: { "二次元": 2 } },
            { label: "先把家搭好再探险", weights: { "沙盒": 2 } },
            { label: "听枪声，卡视野", weights: { "FPS": 2 } },
            { label: "走内线，漂移！", weights: { "竞速": 2 } },
            { label: "佛系一点，开心就好", weights: { "休闲": 2 } }
        ]
    },
    {
        id: "q3",
        title: "你在队伍里的典型定位是？", 
        options: [
            { label: "指挥型：开团拉满", weights: { "MOBA": 2, "FPS": 1 } },
            { label: "工具人：资源管理达人", weights: { "沙盒": 2, "二次元": 1 } },
            { label: "核心 C：伤害拉满", weights: { "FPS": 2, "MOBA": 1 } },
            { label: "辅助奶妈：兜底护航", weights: { "二次元": 2, "休闲": 1 } },
            { label: "极限操作手：极速与激情", weights: { "竞速": 2 } }
        ]
    },
    {
        id: "q4",
        title: "遇到连败你会？",
        options: [
            { label: "复盘节奏问题，换战术", weights: { "MOBA": 2, "FPS": 1 } },
            { label: "抽卡换阵容，下把转运", weights: { "二次元": 2 } },
            { label: "回家造点更强的装备", weights: { "沙盒": 2 } },
            { label: "换图/练枪，打基础", weights: { "FPS": 2 } },
            { label: "冲几把竞速换换脑子", weights: { "竞速": 2 } },
            { label: "休息一下，明天再战", weights: { "休闲": 2 } }
        ]
    },
    {
        id: "q5",
        title: "你最享受的游戏瞬间？",
        options: [
            { label: "一波开团翻盘全场沸腾", weights: { "MOBA": 3 } },
            { label: "抽到心仪角色/满命", weights: { "二次元": 3 } },
            { label: "搭出复杂机关顺利运转", weights: { "沙盒": 3 } },
            { label: "极限 1v3 反杀", weights: { "FPS": 3 } },
            { label: "终点线前反超", weights: { "竞速": 3 } },
            { label: "朋友一起哈哈大笑", weights: { "休闲": 3 } }
        ]
    },
    {
        id: "q6",
        title: "偏爱的美术/界面风格？",
        options: [
            { label: "科幻霓虹 / 赛博 UI", weights: { "MOBA": 2, "FPS": 1 } },
            { label: "日系清爽 / 软萌渐变", weights: { "二次元": 2 } },
            { label: "像素/方块/自然质感", weights: { "沙盒": 2 } },
            { label: "极简战术 / HUD 信息流", weights: { "FPS": 2 } },
            { label: "速度线 / 碳纤维纹理", weights: { "竞速": 2 } },
            { label: "糖果色 / 派对贴纸感", weights: { "休闲": 2 } }
        ]
    },
    {
        id: "q7",
        title: "更像你的一句个性签名是？",
        options: [
            { label: "节奏是门艺术", weights: { "MOBA": 2 } },
            { label: "命运与我签了契约", weights: { "二次元": 2 } },
            { label: "世界是我搭的乐高", weights: { "沙盒": 2 } },
            { label: "精准即浪漫", weights: { "FPS": 2 } },
            { label: "速度即信仰", weights: { "竞速": 2 } },
            { label: "快乐至上", weights: { "休闲": 2 } }
        ]
    },
    {
        id: "q8",
        title: "可多选：以下你也常玩？",
        subtitle: "最多选 2 个",
        multi: true,
        maxPick: 2,
        options: [
            { label: "MOBA", weights: { "MOBA": 1 } },
            { label: "二次元", weights: { "二次元": 1 } },
            { label: "沙盒", weights: { "沙盒": 1 } },
            { label: "FPS", weights: { "FPS": 1 } },
            { label: "竞速", weights: { "竞速": 1 } },
            { label: "休闲派对", weights: { "休闲": 1 } }
        ]
    }
];

// 全局状态
let currentStep = 0;
let answers = {};
let scores = {};

// 初始化
function init() {
    // 检查是否有缓存数据
    const cached = localStorage.getItem('blackspeak-dna-answers');
    if (cached) {
        try {
            answers = JSON.parse(cached);
            if (Object.keys(answers).length > 0) {
                showReport();
                return;
            }
        } catch (e) {
            console.log('缓存数据解析失败');
        }
    }
    
    showIntro();
}

// 显示介绍页面
function showIntro() {
    hideAllCards();
    document.getElementById('introCard').classList.remove('dna-hidden');
}

// 开始测试
function startTest() {
    currentStep = 0;
    answers = {};
    showQuestion();
}

// 显示问题
function showQuestion() {
    hideAllCards();
    document.getElementById('quizCard').classList.remove('dna-hidden');
    
    const question = QUESTIONS[currentStep];
    document.getElementById('stepInfo').textContent = `问题 ${currentStep + 1} / ${QUESTIONS.length}`;
    document.getElementById('questionTitle').textContent = question.title;
    
    const subtitleEl = document.getElementById('questionSubtitle');
    if (question.subtitle) {
        subtitleEl.textContent = question.subtitle;
        subtitleEl.classList.remove('dna-hidden');
    } else {
        subtitleEl.classList.add('dna-hidden');
    }
    
    // 生成选项
    const optionsContainer = document.getElementById('optionsContainer');
    optionsContainer.innerHTML = '';
    
    question.options.forEach((option, index) => {
        const button = document.createElement('button');
        button.className = 'dna-option';
        button.textContent = option.label;
        button.onclick = () => selectOption(index);
        button.setAttribute('data-index', index);
        optionsContainer.appendChild(button);
    });
    
    // 恢复之前的选择
    const currentAnswers = answers[question.id] || [];
    currentAnswers.forEach(index => {
        const button = optionsContainer.querySelector(`[data-index="${index}"]`);
        if (button) button.classList.add('active');
    });
    
    // 更新按钮状态
    updateButtons();
    
    // 更新进度条
    const progress = ((currentStep + 1) / QUESTIONS.length) * 100;
    document.getElementById('progressBar').style.width = `${progress}%`;
}

// 选择选项
function selectOption(index) {
    const question = QUESTIONS[currentStep];
    const currentAnswers = answers[question.id] || [];
    
    if (!question.multi) {
        // 单选
        answers[question.id] = [index];
        // 更新UI
        document.querySelectorAll('.dna-option').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[data-index="${index}"]`).classList.add('active');
    } else {
        // 多选
        const exists = currentAnswers.includes(index);
        let newAnswers;
        
        if (exists) {
            newAnswers = currentAnswers.filter(i => i !== index);
        } else {
            newAnswers = [...currentAnswers, index];
            if (question.maxPick && newAnswers.length > question.maxPick) {
                newAnswers = newAnswers.slice(-question.maxPick);
            }
        }
        
        answers[question.id] = newAnswers;
        
        // 更新UI
        document.querySelectorAll('.dna-option').forEach(btn => btn.classList.remove('active'));
        newAnswers.forEach(i => {
            document.querySelector(`[data-index="${i}"]`).classList.add('active');
        });
    }
    
    updateButtons();
}

// 更新按钮状态
function updateButtons() {
    const question = QUESTIONS[currentStep];
    const hasAnswers = answers[question.id] && answers[question.id].length > 0;
    
    document.getElementById('prevBtn').disabled = currentStep === 0;
    document.getElementById('nextBtn').disabled = !hasAnswers;
}

// 上一题
function prevQuestion() {
    if (currentStep > 0) {
        currentStep--;
        showQuestion();
    }
}

// 下一题
function nextQuestion() {
    if (currentStep < QUESTIONS.length - 1) {
        currentStep++;
        showQuestion();
    } else {
        // 完成测试
        calculateScores();
        saveAnswers();
        showReport();
    }
}

// 计算分数
function calculateScores() {
    scores = {};
    GENRES.forEach(genre => scores[genre] = 0);
    
    QUESTIONS.forEach(question => {
        const picks = answers[question.id] || [];
        picks.forEach(index => {
            const option = question.options[index];
            GENRES.forEach(genre => {
                scores[genre] += option.weights[genre] || 0;
            });
        });
    });
}

// 标准化百分比
function normalizeScores() {
    const total = GENRES.reduce((sum, genre) => sum + (scores[genre] || 0), 0) || 1;
    const percents = GENRES.map(genre => ({
        genre,
        percent: Math.round((scores[genre] || 0) / total * 100)
    }));
    
    // 确保总和为100%
    const sum = percents.reduce((acc, item) => acc + item.percent, 0);
    const diff = 100 - sum;
    if (diff !== 0) {
        const maxIndex = percents.reduce((maxIdx, item, idx, arr) => 
            item.percent > arr[maxIdx].percent ? idx : maxIdx, 0);
        percents[maxIndex].percent += diff;
    }
    
    return percents.sort((a, b) => b.percent - a.percent);
}

// 显示报告
function showReport() {
    hideAllCards();
    document.getElementById('reportCard').classList.remove('dna-hidden');
    
    calculateScores();
    const percents = normalizeScores();
    const topGenre = percents[0];
    
    // 更新主题
    updateTheme(topGenre.genre);
    
    // 更新中心显示
    document.getElementById('topGenre').textContent = topGenre.genre;
    document.getElementById('topPercent').textContent = `${topGenre.percent}%`;
    
    // 绘制环形图
    drawDonutChart(percents);
    
    // 生成徽章
    generateBadges(percents.slice(0, 3));
    
    // 生成标签云
    generateTagCloud(percents);
    
    // 生成黑话样本
    generateJargonSample(percents);
    
    // 生成分享文案
    generateShareCopy(percents);
}

// 更新主题
function updateTheme(topGenre) {
    const theme = THEMES[topGenre];
    const container = document.getElementById('dnaContainer');
    container.style.background = theme.bg;
    
    // 更新强调色
    document.documentElement.style.setProperty('--dna-accent', theme.accent);
    
    // 更新所有强调色元素
    document.querySelectorAll('.dna-accent, .dna-center-genre').forEach(el => {
        el.style.color = theme.accent;
    });
    
    document.querySelectorAll('.dna-progress-bar').forEach(el => {
        el.style.background = theme.accent;
    });
}

// 绘制环形图
function drawDonutChart(percents) {
    const svg = document.getElementById('donutChart');
    const size = 200;
    const stroke = 20;
    const radius = size / 2 - stroke / 2;
    const circumference = Math.PI * 2 * radius;
    
    // 清除现有内容
    svg.innerHTML = `<circle cx="100" cy="100" r="${radius}" stroke="rgba(255,255,255,0.1)" stroke-width="${stroke}" fill="none" />`;
    
    const colors = {
        "MOBA": "#7F0056",
        "二次元": "#D946EF", 
        "沙盒": "#3B82F6",
        "FPS": "#7F0056",
        "竞速": "#3B82F6",
        "休闲": "#D946EF"
    };
    
    let accumulatedPercent = 0;
    
    percents.forEach(item => {
        if (item.percent > 0) {
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', '100');
            circle.setAttribute('cy', '100');
            circle.setAttribute('r', radius.toString());
            circle.setAttribute('stroke', colors[item.genre] || '#7F0056');
            circle.setAttribute('stroke-width', stroke.toString());
            circle.setAttribute('fill', 'none');
            circle.setAttribute('stroke-dasharray', `${circumference * item.percent / 100} ${circumference}`);
            circle.setAttribute('stroke-dashoffset', `${-circumference * accumulatedPercent / 100}`);
            circle.setAttribute('transform', 'rotate(-90 100 100)');
            
            svg.appendChild(circle);
            accumulatedPercent += item.percent;
        }
    });
}

// 生成徽章
function generateBadges(topThree) {
    const container = document.getElementById('badgesContainer');
    container.innerHTML = '';
    
    topThree.forEach((item, index) => {
        const badge = document.createElement('div');
        badge.className = `dna-badge ${index === 0 ? 'rank1' : ''}`;
        badge.innerHTML = `
            <span class="dna-badge-dot"></span>
            <span>${item.genre} ${item.percent}%</span>
        `;
        container.appendChild(badge);
    });
}

// 生成标签云
function generateTagCloud(percents) {
    const tags = [];
    const tagMap = {
        "MOBA": ["团队协作", "策略思维", "节奏控制"],
        "二次元": ["收集癖", "颜值党", "剧情控"],
        "沙盒": ["创造力", "探索欲", "建造狂"],
        "FPS": ["反应速度", "精准操作", "战术意识"],
        "竞速": ["速度感", "操控欲", "竞技心"],
        "休闲": ["佛系玩家", "社交达人", "快乐至上"]
    };
    
    percents.slice(0, 3).forEach(item => {
        const genreTags = tagMap[item.genre] || [];
        tags.push(...genreTags);
    });
    
    const container = document.getElementById('tagCloud');
    container.innerHTML = '';
    
    tags.slice(0, 6).forEach(tag => {
        const chip = document.createElement('span');
        chip.className = 'dna-chip';
        chip.textContent = tag;
        container.appendChild(chip);
    });
}

// 生成黑话样本
function generateJargonSample(percents) {
    const parts = [];
    const top3 = percents.slice(0, 3);
    
    top3.forEach(item => {
        const jargons = JARGON[item.genre] || [];
        if (jargons.length > 0) {
            const randomIndex = Math.floor(Math.random() * jargons.length);
            parts.push(jargons[randomIndex]);
        }
    });
    
    document.getElementById('jargonSample').textContent = parts.join(' · ');
}

// 生成分享文案
function generateShareCopy(percents) {
    const top = percents[0];
    const copyMap = {
        "MOBA": "我是一个标准的 MOBA 玩家，节奏感拉满！",
        "二次元": "二次元世界的忠实信徒，为爱发电永不停歇！",
        "沙盒": "沙盒游戏建造狂魔，创造力就是我的超能力！",
        "FPS": "FPS 射击高手，精准操作就是我的代名词！",
        "竞速": "竞速游戏速度狂，追求极限就是我的信仰！",
        "休闲": "休闲游戏佛系玩家，快乐游戏才是王道！"
    };
    
    const baseCopy = copyMap[top.genre] || "游戏黑话达人，各种流派都有涉猎！";
    document.getElementById('shareCopy').textContent = `${baseCopy} 测测你的游戏黑话基因吧~`;
}

// 保存答案
function saveAnswers() {
    localStorage.setItem('blackspeak-dna-answers', JSON.stringify(answers));
}

// 重置测试
function resetTest() {
    currentStep = 0;
    answers = {};
    scores = {};
    localStorage.removeItem('blackspeak-dna-answers');
    showIntro();
}

// 分享结果
function shareResult() {
    const shareText = document.getElementById('shareCopy').textContent;
    
    if (navigator.share) {
        navigator.share({
            title: '黑话DNA测试结果',
            text: shareText,
            url: window.location.href
        });
    } else {
        // 复制到剪贴板
        navigator.clipboard.writeText(shareText).then(() => {
            alert('分享文案已复制到剪贴板！');
        }).catch(() => {
            alert('分享功能暂不可用，请手动复制文案分享~');
        });
    }
}

// 隐藏所有卡片
function hideAllCards() {
    document.querySelectorAll('.dna-card').forEach(card => {
        card.classList.add('dna-hidden');
    });
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', init);