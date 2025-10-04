// Simple i18n utility for bilingual (zh/en) toggle
;(function(){
  const state = {
    lang: 'zh'
  };

  const storageKey = 'site_lang';

  const translations = {
    nav: {
      home: { zh: '开开首页', en: 'Home' },
      visualization: { zh: '读读数据', en: 'Visualize Data' },
      search: { zh: '查查黑话', en: 'Search Slang' },
      charts: { zh: '看看图表', en: 'Charts' }
    },
    // 站点级文案
    site: {
      footer: {
        zh: '© 2025 游戏黑话数据可视化. 基于bilibili评论数据爬取.',
        en: '© 2025 Gaming Slang Data Visualization. Based on bilibili comment data scraping.'
      }
    },
    hero: {
      subtitle: { zh: '游戏场景如何塑造我们的"黑话DNA"', en: 'How game contexts shape our "slang DNA"' },
      titleCyber: { zh: '赛博', en: 'Cyber' },
      titleDictionary: { zh: '词典', en: 'Dictionary' },
      intro1: {
        zh: "主播的造梗能力与弹幕的即时玩梗，形成了'黑话'的狂欢广场。'芜湖起飞'、'肉蛋葱鸡'……一个操作，一个口误，都能在瞬间成为全网热词。",
        en: "Streamers' meme-making and real-time bullet chats turn slang into a carnival. 'Wuhu take off', 'meat-egg scallion chicken'… a single play or slip of the tongue can instantly become a viral catchphrase."
      },
      intro2: {
        zh: "'黑话'从游戏圈破壁，通过表情包和群聊入侵日常。'肝论文'、'今天又非了'——游戏词汇被赋予了全新的生活化内涵。",
        en: "Gaming slang breaks out of game circles, invading everyday life via memes and group chats. 'grind a thesis', 'unlucky again today'—game vocabulary gains new everyday meanings."
      }
    },
    selector: {
      label: { zh: '选择游戏：', en: 'Select Game:' },
      all: { zh: '所有游戏', en: 'All Games' }
    },
    stats: {
      slangs: { zh: '黑话词汇', en: 'Slang Terms' },
      gamers: { zh: '游戏玩家', en: 'Gamers' },
      years: { zh: '年演变', en: 'Years of Evolution' }
    },
    sections: {
      know: { zh: '你知道这些游戏黑话吗？', en: 'Do you know these gaming slangs?' },
      dataTitle: { zh: '游戏黑话背后的数据是怎么样的？', en: 'What do the data behind game slangs look like?' },
      knowIntro: {
        zh: '从"芜湖起飞"到"肉蛋葱鸡"，这些看似无厘头的词汇背后，蕴含着数字原生代的文化密码。让我们一起探索这些游戏"黑话"的奥秘。',
        en: 'From "Wuhu take off" to "meat‑egg scallion chicken", these seemingly nonsensical phrases encode the culture of digital natives. Let’s explore the secrets of gaming slang.'
      }
    },
    ai: {
      intro: {
        zh: '我们引入前沿的大语言模型与知识图谱技术，构建了新一代智能语义分析系统。该系统能够深度解析游戏术语的语义结构、情感倾向及使用场景，并揭示其背后的文化动因与社群特征，为游戏内容优化、社区精细化运营及玩家体验提升提供数据支持。',
        en: 'We use cutting-edge LLMs and knowledge graphs to build a new semantic analysis system. It decodes the structure, sentiment and usage of gaming terms, revealing cultural dynamics and community traits to support content optimization, operations and player experience.'
      },
      title: { zh: '🤖 AI智能查询', en: '🤖 AI Semantic Search' },
      subtitle: { zh: '输入游戏术语，AI为您提供详细解释和使用场景', en: 'Enter a gaming term; AI explains meaning and usage.' },
      placeholder: { zh: '请输入游戏黑话，如：躺平、卷王、开黑...', en: 'Type a gaming slang, e.g., AFK, carry, scrim...' },
      loading: { zh: 'AI正在分析中...', en: 'AI is analyzing...' },
      popular: { zh: '🔥 热门推荐', en: '🔥 Trending Terms' }
    },
    charts: {
      insightTitle: { zh: '📊 数据解读', en: '📊 Interpretation' },
      timeTitle: { zh: '游戏类别使用随时间怎么变化的呢？', en: 'How do category usages change over time?' },
      intro1: {
        zh: '游戏"黑话"作为玩家社群自发形成的语言符号体系，其背后隐藏着怎样一幅数据图景？在虚拟世界的交流场域中，从"GG""ADCarry"到"肝""氪金"，每一句高频术语不仅是沟通工具，更是玩家行为、情感态度与文化演变的微观镜像。为了系统解析这些语言现象背后的规律，我们借助大数据分析与机器学习算法，对跨越多个主流游戏平台、论坛及直播场景的数万条游戏术语进行了多维度挖掘。',
        en: 'Gaming slang, as a spontaneously formed symbolic system of player communities, reflects a rich data landscape. From “GG” and “AD Carry” to “grind” and “pay‑to‑win”, high‑frequency terms mirror player behaviors, sentiments and cultural evolution. We use big‑data analytics and ML to mine tens of thousands of terms across platforms, forums and streams.'
      },
      intro2: {
        zh: '我们首先对非结构化评论文本进行清洗与分词，提取出具有代表性的游戏黑话词库；随后运用情感分析模型识别术语在使用中所附带的情感极性。例如，"佛系"往往关联轻松正向的情绪，而"坑"则常映射负面体验。进一步地，我们引入时间序列分析，追踪关键术语的流行度变迁，识别不同版本更新、电竞赛事等外部事件对玩家语言生态的冲击与塑造。基于关联规则挖掘与语义网络分析，我们还绘制出术语之间的共现关系，揭示出诸如"氪金"与"抽卡"等行为类词汇的强相关性，从而勾勒出玩家群体在消费、社交与竞技等不同维度中的行为偏好。',
        en: 'We clean and tokenize unstructured comments to build a representative slang lexicon, then run sentiment models to identify polarities. For instance, “Buddhist” tones are often positive/relaxed, while “troll” maps to negative experiences. Time‑series tracking reveals popularity shifts; event impacts such as patches or esports are quantified. Association rules and semantic networks expose co‑occurrence patterns like strong ties between “spend” and “gacha”.'
      },
      intro3: {
        zh: '这一分析的价值不仅在于理解语言本身，更在于为游戏开发者、运营者以及社区平台提供具备操作性的洞见。例如，识别出具有高情感负载的术语可辅助优化游戏内聊天监管机制；对术语演变趋势的把握有助于预判玩家兴趣迁移，为内容更新与活动策划提供参考；而对不同玩家圈层用语差异的分析，则可推动个性化推荐与精准社群运营的实现。透过数据的力量，我们不仅是在解读"游戏黑话"，更是在系统解构一个动态变化中的数字文化生态，为理解下一代玩家的行为逻辑与情感结构打开一扇新的窗口。',
        en: 'Beyond language understanding, these analyses offer actionable insights: flag high‑sentiment terms to refine chat moderation, anticipate term trends to guide content and events, and map vocabulary differences across cohorts to power personalization and targeted operations. By reading the data, we decode a dynamic digital culture and open a window into next‑gen player behavior and emotion.'
      },
      sentiment: {
        neutral: { zh: '中性', en: 'Neutral' },
        positive: { zh: '正面', en: 'Positive' },
        negative: { zh: '负面', en: 'Negative' }
      },
      categories: {
        '交流/指挥类': { zh: '交流/指挥类', en: 'Communication/Command' },
        '地图/副本类': { zh: '地图/副本类', en: 'Maps/Dungeons' },
        '机制类': { zh: '机制类', en: 'Mechanics' },
        '物品/装备类': { zh: '物品/装备类', en: 'Items/Equipment' },
        '玩家/群体标签': { zh: '玩家/群体标签', en: 'Player/Group Tags' },
        '社交类/梗类': { zh: '社交类/梗类', en: 'Social/Memes' },
        '经济交易类': { zh: '经济交易类', en: 'Economy/Trading' },
        '职业类': { zh: '职业类', en: 'Classes/Professions' },
        '行为类': { zh: '行为类', en: 'Behavior' },
        '跨游戏通用语': { zh: '跨游戏通用语', en: 'Cross-game Common Terms' },
        // chart4 使用的简化“物品类”标签
        '物品类': { zh: '物品类', en: 'Items' }
      },
      games: {
        '英雄联盟': { zh: '英雄联盟', en: 'League of Legends' },
        '最终幻想14': { zh: '最终幻想14', en: 'Final Fantasy XIV' },
        '三角洲行动': { zh: '三角洲行动', en: 'Delta Force' },
        '原神': { zh: '原神', en: 'Genshin Impact' },
        'CS:GO': { zh: 'CS:GO', en: 'CS:GO' },
        'CSGO': { zh: 'CSGO', en: 'CSGO' },
        '无畏契约': { zh: '无畏契约', en: 'Valorant' },
        '我的世界': { zh: '我的世界', en: 'Minecraft' },
        '绝地求生': { zh: '绝地求生', en: 'PUBG' },
        '怪物猎人': { zh: '怪物猎人', en: 'Monster Hunter' },
        '艾尔登法环': { zh: '艾尔登法环', en: 'Elden Ring' },
        '永劫无间': { zh: '永劫无间', en: 'Naraka: Bladepoint' },
        '王者荣耀': { zh: '王者荣耀', en: 'Honor of Kings' },
        '鸣潮': { zh: '鸣潮', en: 'Wuthering Waves' },
        '魔兽世界': { zh: '魔兽世界', en: 'World of Warcraft' },
        '文明6': { zh: '文明6', en: 'Civilization VI' }
      },
      chart1Conclusion: {
        zh: '从游戏黑话类型使用频率我们不难发现，行为类术语占据各大游戏的主要术语使用。但个别游戏如”原神“”鸣朝“之类的RPG游戏等职业类术语占据较大使用份额',
        en: 'Usage frequency shows behavior terms dominate across games, while some RPGs (e.g., Genshin, Wuthering Waves) exhibit higher shares of class/profession terms.'
      },
      chart2Conclusion: {
        zh: '从各游戏术语情感分布可以看出，中性术语占据主流，主要用于日常交流和行为描述。然而，正面和负面术语的分布比例与游戏类型和社区氛围密切相关，竞技类游戏往往呈现更强烈的情感极化现象。',
        en: 'Sentiment distributions indicate neutral terms dominate routine communication, while the shares of positive/negative terms vary by genre and community—competitive titles often show stronger polarization.'
      },
      chart3Conclusion: {
        zh: '从类别情感雷达图中我们发现，负面情绪主要集中在机制类术语上，这反映了玩家对游戏平衡性、bug修复和体验优化的强烈关注。这种现象揭示了玩家与游戏开发者之间的互动关系。',
        en: 'The category sentiment radar shows negatives cluster around mechanics, reflecting players’ focus on balance, bug fixing and UX optimizations—highlighting dynamics between players and devs.'
      },
      chart4Conclusion: {
        zh: '多游戏术语分布雷达图展现了不同游戏类型的语言特色：MOBA游戏注重团队协作术语，FPS游戏强调战术定位词汇，RPG游戏突出角色职业概念，体现了游戏机制对语言文化的深刻影响。',
        en: 'The multi‑game radar highlights linguistic features by genre: MOBA emphasizes team‑coordination terms, FPS stresses tactical positioning, RPG foregrounds class concepts—showing how mechanics shape language.'
      }
    }
    ,
    timeline: {
      title: { zh: '我们的“黑话”从何而来？', en: 'Where do our slangs come from?' },
      arcade: {
        title: { zh: '街机时代', en: 'Arcade Era' },
        period: { zh: '（1980-1990年代）', en: '(1980s–1990s)' },
        description: {
          zh: '游戏厅文化的黄金时代，黑话具有强烈的地域特色和社交属性，街机厅成为青少年社交中心，独特黑话是融入圈子的必备技能。',
          en: 'In the golden age of arcades, slang had strong regional and social traits. Arcades were youth hubs, and unique terms were essential to fit in.'
        },
        event1983: {
          title: { zh: '术语地域化', en: 'Regionalized Terms' },
          detail1: { zh: '受方言影响，同一游戏概念在不同城市诞生了截然不同的叫法。这种地域差异强化了本地游戏圈子的认同感和排他性。', en: 'Dialects led to different names for the same concepts across cities, reinforcing local identity and exclusivity.' },
          detail2: { zh: '上海："老鬼"=BOSS，广东："大嘢"=BOSS，"打机"=玩游戏', en: 'Shanghai: “laogui” = boss; Guangdong: “daye” = boss; “daji” = play games.' }
        },
        event1987: {
          title: { zh: '暴力美学主导', en: 'Violence Aesthetics Dominate' },
          detail1: { zh: '动作格斗游戏盛行，催生了描述击杀特效的简短有力词汇。术语往往直接模拟动作声音或描述视觉冲击。"放雷"、"勾死了"', en: 'Fighting games thrived, spawning punchy terms for kill effects—often onomatopoeic or visually descriptive, e.g., “drop a bomb”, “hooked to death”.' },
          detail2: { zh: '黑话成为游戏厅社交准入证，能否听懂并使用本地“行话”是区分圈内人与新手的标志。', en: 'Slang served as a social pass; understanding and using local jargon marked insiders vs. newcomers.' }
        }
      },
      pc: {
        title: { zh: 'PC网游时代', en: 'PC Online Era' },
        period: { zh: '（2000-2009年）', en: '(2000–2009)' },
        description: {
          zh: 'MMORPG兴起，黑话开始标准化和制度化，大规模破圈',
          en: 'MMORPGs rise; slang becomes standardized and institutionalized, breaking into the mainstream.'
        },
        event2000: {
          title: { zh: 'MMORPG术语制度化', en: 'Institutionalized MMORPG Terminology' },
          detail1: { zh: '公会管理、副本挑战等核心玩法建立了标准化表达词汇。', en: 'Guild management and dungeon challenges established standardized expressions for core gameplay.' },
          detail2: { zh: '“工会”、“PK”、“刷图”、“开荒”、“Farm”、“OT”等词精确描述了团队协作中的复杂状态和策略。', en: 'Terms like “Guild”, “PK”, “grind maps”, “first clear”, “Farm”, “OT” precisely described complex team states and tactics.' }
        },
        event2005: {
          title: { zh: '大规模破圈', en: 'Mainstream Breakout' },
          detail1: { zh: '游戏词汇因其形象生动，开始被选秀、电商等主流领域借用。', en: 'Vivid game vocabulary began to be borrowed by mainstream fields such as talent shows and e‑commerce.' },
          detail2: { zh: '《超级女声》引入"PK"为淘汰赛代称；"秒杀"进入电商', en: '“PK” became an elimination‑round term on talent shows; “flash sale/秒杀” entered e‑commerce.' }
        }
      },
      mobile: {
        title: { zh: '手游时代', en: 'Mobile Era' },
        period: { zh: '（2010-2019年）', en: '(2010–2019)' },
        description: { zh: '移动互联网普及，付费文化兴起，抽卡玄学体系形成', en: 'Mobile internet spreads; pay culture rises; gacha luck folklore emerges.' },
        event2012: {
          title: { zh: '付费文化兴起', en: 'Rise of Pay Culture' },
          detail1: { zh: '“氪金”（付费）与“肝”（投入大量时间）成为玩家状态的核心描述词。', en: '“Whaling” (paying) and “grinding” (heavy time investment) became core descriptors of player status.' },
          detail2: { zh: '这些术语成为移动游戏中投入与消费的日常表达。', en: 'These terms became everyday shorthand for effort and spending in mobile games.' }
        },
        event2016: {
          title: { zh: '抽卡玄学体系', en: 'Gacha Luck Folklore' },
          detail1: { zh: '概率获取机制衍生出玩家自嘲和迷信性质的运气评价系统。形成了独特的“运气文化”，将随机结果戏剧化和社群化。', en: 'Randomized rewards spawned self‑deprecating and superstitious luck frameworks, turning chance into shared culture.' },
          detail2: { zh: '“欧皇/非酋”、“玄不救非，氪不改命”等表达广泛流行。', en: 'Expressions like “欧皇/非酋” (lucky/unlucky) and “superstition can’t fix bad luck; paying won’t change fate” spread widely.' }
        }
      },
      year2000: { zh: '2000年', en: '2000' },
      year2005: { zh: '2005年', en: '2005' },
      year2012: { zh: '2012年', en: '2012' },
      year2016: { zh: '2016年', en: '2016' }
      ,
      // 现代/泛娱乐时代（2020年至今）
      modern: {
        title: { zh: '泛娱乐时代', en: 'Pan‑Entertainment Era' },
        period: { zh: '（2020年至今）', en: '(2020–Present)' }
      },
      eraDescription: {
        zh: '直播、短视频兴起，黑话全面破圈并反向影响主流文化',
        en: 'Livestreaming and short videos rise; gaming slang breaks into the mainstream and influences it back.'
      },
      year2020: { zh: '2020年', en: '2020' },
      event2020: {
        title: { zh: '电竞造梗全网化', en: 'Esports Memes Go Mainstream' },
        detail1: { zh: '电竞赛事和主播成为流行语的重要发源地，', en: 'Esports events and streamers became key sources of catchphrases.' },
        detail2: { zh: '“YYDS”、“毒奶”。这些梗往往源于某个高光或下饭操作的名场面解说，极具画面感和传播力。', en: 'Terms like “YYDS” and “cursed milk” emerged from iconic moments and commentary—highly visual and viral.' }
      },
      year2021: { zh: '2021年', en: '2021' },
      event2021: {
        title: { zh: '情感符号迁移现实', en: 'Emotional Symbols Enter Everyday Life' },
        detail1: { zh: '游戏中的情绪表达被广泛用于描述现实遭遇。', en: 'In‑game emotion expressions are widely used to describe real‑life situations.' },
        detail2: { zh: '“破防”等词因其高度概括情绪爆点的能力，成为网络共情的高效表达。', en: 'Phrases like “break defense” concisely capture emotional hits, enabling efficient online empathy.' }
      },
      year2023: { zh: '2023年', en: '2023' },
      event2023: {
        title: { zh: '职场术语游戏化', en: 'Gamification of Workplace Jargon' },
        detail1: { zh: '游戏中的任务机制词汇被借用来调侃或描述枯燥重复的日常工作。年轻一代试图用熟悉的游戏框架解构现实压力。', en: 'Game mission terms are borrowed to describe repetitive work, using familiar gameplay frames to cope with real‑world stress.' },
        detail2: { zh: '“搬砖”=重复性工作、“副本”=专项任务', en: '“moving bricks” = repetitive work; “dungeon/instance” = special task.' }
      }
    }
    ,
    conclusion: {
      title: { zh: '数字时代的语言密码', en: 'Language codes of the digital age' },
      p1: { zh: '游戏黑话不仅仅是玩家间的交流工具，更是数字原住民一代文化认同的重要载体。从主播直播间的即兴创造，到弹幕文化的集体狂欢，再到日常生活的广泛渗透，这些看似简单的词汇背后，蕴含着深刻的社会文化意义。', en: 'Gaming slang is not only a communication tool but also a carrier of cultural identity for digital natives. From improvised creation in streams to collective carnival in bullet chats and everyday infiltration, seemingly simple terms carry deep social‑cultural meanings.' },
      p2: { zh: '通过大数据分析和人工智能技术，我们得以窥见这个庞大语言体系的内在规律：不同游戏类型塑造着不同的语言特色，玩家情感在虚拟世界中得到充分表达，而技术的进步正在加速这种文化现象的演进。', en: 'Through big‑data and AI, we glimpse the inner rules of this linguistic system: genres shape distinct language features; player emotions are fully expressed in virtual worlds; technology accelerates the evolution of these cultural phenomena.' },
      p3: { zh: '在这个数字化浪潮中，游戏黑话已经成为连接虚拟与现实、个体与群体、传统与创新的桥梁。它们不仅记录着游戏产业的发展轨迹，更见证着一代人的成长足迹，成为我们理解当代青年文化的重要窗口。', en: 'Gaming slang bridges virtual and real, individuals and groups, tradition and innovation. It records industry trajectories and witnesses a generation’s growth, becoming a key window into contemporary youth culture.' },
      infinity: { zh: '无限可能', en: 'Infinite possibilities' },
      footer: { zh: '语言的演进永不停歇，游戏文化的创新永无止境。在这个充满无限可能的数字世界里，每一个新词汇的诞生，都在书写着属于我们这个时代的独特篇章。', en: 'Language keeps evolving and game culture keeps innovating. In this digital world of infinite possibilities, each new term writes a unique chapter of our era.' }
    }
  };

  function detectLang(){
    const cached = localStorage.getItem(storageKey);
    if (cached) return cached;
    const navLang = (navigator.language || navigator.userLanguage || 'zh').toLowerCase();
    return navLang.startsWith('zh') ? 'zh' : 'en';
  }

  function setLang(lang){
    state.lang = lang === 'en' ? 'en' : 'zh';
    localStorage.setItem(storageKey, state.lang);
    document.documentElement.setAttribute('lang', state.lang);
    applyTranslations();
    const evt = new CustomEvent('languagechange', { detail: { lang: state.lang } });
    window.dispatchEvent(evt);
  }

  function getLang(){
    return state.lang;
  }

  function t(key){
    const parts = key.split('.');
    let node = translations;
    for (const p of parts){
      node = node && node[p];
    }
    if (!node) return key; // fallback
    return node[state.lang] || node.zh || key;
  }

  function tCategory(label){
    const node = translations.charts.categories[label];
    if (!node) return label;
    return node[state.lang] || node.zh || label;
  }

  function tGame(name){
    const node = translations.charts.games[name];
    if (!node) return name;
    return node[state.lang] || node.zh || name;
  }

  function applyTranslations(){
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      const text = t(key);
      if (text) el.textContent = text;
    });
    // handle attributes: data-i18n-attr="attr:key"
    document.querySelectorAll('[data-i18n-attr]').forEach(el => {
      const spec = el.getAttribute('data-i18n-attr');
      const parts = spec.split(':');
      const attr = parts[0];
      const key = parts[1];
      const val = t(key);
      if (attr && key && val) el.setAttribute(attr, val);
    });
    const toggle = document.getElementById('langToggle');
    if (toggle){
      toggle.textContent = state.lang === 'zh' ? '中文 / EN' : 'EN / 中文';
      toggle.setAttribute('aria-label', state.lang === 'zh' ? '切换语言' : 'Toggle language');
    }
  }

  // expose
  window.i18n = {
    setLang,
    getLang,
    t,
    tCategory,
    tGame,
    applyTranslations,
    translations
  };

  // init
  state.lang = detectLang();
  document.addEventListener('DOMContentLoaded', function(){
    applyTranslations();
    const btn = document.getElementById('langToggle');
    if (btn){
      btn.addEventListener('click', function(){
        setLang(state.lang === 'zh' ? 'en' : 'zh');
      });
    }
  });
})();