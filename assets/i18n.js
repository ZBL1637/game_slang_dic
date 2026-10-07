// Simple i18n utility for bilingual (zh/en) toggle
;(function(){
  const state = {
    lang: 'zh'
  };

  const storageKey = 'gameslang_focused_lang';

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
        zh: "主播的造梗能力与弹幕的即时玩梗，形成了'黑话'的狂欢广场。'芜湖起飞'、'肉蛋葱鸡'……一个操作，一个口误，都能在瞬间成为全网热词。“黑话”从游戏圈破壁，通过表情包和群聊入侵日常。'肝论文'、'今天又非了'——游戏词汇被赋予了全新的生活化内涵。",
        en: "Streamers' knack for coining memes, paired with viewers' real-time riffing in danmu (bullet chats), has turned the space into a carnival for gaming slang. 'Wuhu, take off!', 'meat-egg-scallion chicken' — a single move or a slip of the tongue can go viral in seconds. This slang has broken out of the gaming circle, infiltrating everyday life through memes and group chats. 'grind a thesis', 'got unlucky again today' — game vocabulary is being repurposed with fresh, everyday meanings."
      },
      intro2: { zh: "我们在 Bilibili（B站）不同游戏 tag 的视频下采集了超过10万条评论，并结合补充的游戏黑话，整理成这份游戏黑话词典。你可以按游戏浏览词条，也可以查询它们的含义与使用场景。", en: "We collected over 100,000 comments under videos with different game tags on Bilibili and combined them with additional gaming terms to build this dictionary. Browse by game or look up meanings and usage contexts." }
    },
    selector: {
      label: { zh: '选择游戏：', en: 'Select Game:' },
      all: { zh: '所有游戏', en: 'All Games' }
    },
    stats: {
      slangs: { zh: "当前收录条目", en: "Entries in this view" },
      gamers: { zh: '游戏玩家', en: 'Gamers' },
      gamersValue: { zh: '6亿+', en: '600M+' },
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
      searchAction: { zh: '查询黑话', en: 'Search gaming terms' },
      title: { zh: '🔎 智能词典查询', en: '🔎 Smart Dictionary Search' },
      subtitle: { zh: "AI 辅助解释，结合本地词库查询", en: "AI-assisted explanations with local dictionary lookup" },
      placeholder: { zh: '请输入游戏黑话，如：躺平、卷王、开黑...', en: 'Type a gaming slang, e.g., AFK, carry, scrim...' },
      loading: { zh: "正在查找词条与解释…", en: "Finding terms and explanations…" },
      popular: { zh: "✦ 随机发现", en: "✦ Explore terms" }
    },
    charts: {
      sunburstTitle: {"zh":"游戏黑话，如何分门别类？","en":"How is gaming slang organized?"},
      sunburstIntro: {"zh":"从内向外阅读分类、细类与词条。点击分类展开，看看熟悉的黑话属于哪一支。","en":"Read outward through categories, subcategories and terms. Click a category to explore its branches."},
      networkTitle: {"zh":"哪些词经常一起出现？","en":"Which terms appear together?"},
      networkIntro: {"zh":"沿着词语之间的微光，看看黑话如何在同一段交流里相遇。点击一个词，展开它的关联。","en":"Follow the connections between gaming expressions. Select a term to explore the words mentioned alongside it."},
      categoryLabel: {"zh":"查看分类","en":"Category"},
      nodeLabel: {"zh":"定位词条","en":"Find a term"},
      reset: {"zh":"恢复全景","en":"Reset view"},
      pending: {"zh":"图表将在进入视野后加载","en":"The chart loads when it comes into view."},
      methodTitle: {"zh":"图表怎么看","en":"How to read this chart"},
      sunburstMethod: {"zh":"颜色区分一级分类，同一分支沿用相近色。扇区大小按源数据中的频次权重绘制；点击上级分类可展开小扇区，中心返回上一级。分类权重不等于收录词条数，也不代表玩家人数。","en":"Colors distinguish top-level categories, with related shades for their branches. Sector sizes follow frequency weights in the source data. Open a parent category to inspect smaller sectors; click the center to go back. Weights are not counts of dictionary entries or players."},
      networkMethod: {"zh":"概览保留参考图的 96 个词条与 90 条联系，再为非“游戏／玩家”的词，选取一条两端均非这两个泛词的最强联系，合并去重后共 149 条。全部连线来自源数据，权重至少 24。点击词条时，从这 96 个词之间的原始候选联系中展示最强的 12 条。颜色区分词性，点的大小随词频作对数变化；位置用于展开关系，不代表语义距离。共现不等于近义或因果。","en":"The overview keeps the reference view’s 96 terms and 90 links, then adds each non-generic term’s strongest link whose endpoints are neither 游戏 nor 玩家. Deduplication yields 149 source links, all with weight at least 24. Selecting a term displays its 12 strongest links from all qualifying source edges among these 96 terms. Colors indicate parts of speech and dot sizes use log-scaled frequency. Positions organize the view rather than measure semantic distance; co-occurrence is not synonymy or causation."},
      sunburstConclusion: {"zh":"在这份分类数据中，“游戏玩法用语”的权重最大。继续展开，可以看到通用表达与不同游戏类型的具体用词。一个熟悉的词既有自己的位置，也与更大的玩法语境相连。","en":"Gameplay vocabulary has the largest weight in this classification dataset. Explore it to see general expressions alongside terms associated with different game types. Each familiar term sits within a broader gameplay context."},
      networkConclusion: {"zh":"“辅助”与“打野”、“氪金”与“肝”、“开荒”与“副本”——这些共现联系，让单个词回到玩家交流的语境中。试着从一个熟悉的词出发，看看它最常与哪些词一起出现。","en":"Pairs such as 辅助–打野, 氪金–肝 and 开荒–副本 place individual terms back into the context of player conversations. Start with a familiar expression and explore the words that accompany it."},
      insightTitle: { zh: '📊 数据解读', en: '📊 Interpretation' },
      timeTitle: { zh: "游戏术语类别的动态分布", en: "Gaming term categories in motion" },
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
        '物品类': { zh: '物品类', en: 'Items' },
        // 游戏类型分类（用于选择器与标签）
        '大逃杀': { zh: '大逃杀', en: 'Battle Royale' },
        '动作游戏': { zh: '动作游戏', en: 'Action' },
        '沙盒游戏': { zh: '沙盒游戏', en: 'Sandbox' },
        '策略游戏': { zh: '策略游戏', en: 'Strategy' }
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
      chart1Conclusion: { zh: "这份样本覆盖14款游戏。许多游戏的行为类词条占比较高，原神、鸣潮等游戏的职业类词条也较突出。图中比较的是各游戏样本内的词条构成比例，可以结合图例与数值明细逐类查看。", en: "This sample covers 14 games. Behavior terms make up a large share in many games, while class-related terms stand out in games such as Genshin Impact and Wuthering Waves. These percentages describe the composition of each game sample; use the legend and data table to compare categories." },
      chart2Conclusion: { zh: "多数游戏样本中，中性词条占比较高，但不同游戏的分布并不相同。例如，CSGO 的中性比例为93.81%，原神的正面比例为67.63%。这些差异描述当前词条的情感标注分布，不能直接等同于整个玩家社区的情绪。", en: "Neutral entries make up a large share in most game samples, but the distributions differ: CSGO is 93.81% neutral, while Genshin Impact is 67.63% positive. These values describe sentiment labels in the current entries, rather than the mood of an entire player community." },
      chart3Conclusion: { zh: "按类别分别比较情感比例，机制类词条的负面比例最高，为30.5%；地图/副本类的中性比例为94.7%。这些比例体现不同类别的标注差异，具体词语表达什么，仍要放回使用语境中理解。", en: "Comparing sentiment within each category, mechanics has the highest negative share at 30.5%, while maps/dungeons is 94.7% neutral. These are differences between labeled categories; individual meanings still depend on context." },
      chart4Conclusion: { zh: "这组雷达图展示12款游戏的分类构成，与前面的14款游戏总览相比，未包含魔兽世界和鸣潮。沿同一条轴比较不同游戏，或打开数值明细，可以更清楚地看到行为、职业、装备等类别的占比差异。", en: "These radar charts cover 12 games, excluding World of Warcraft and Wuthering Waves from the earlier 14-game overview. Compare the same axis across games, or open the data table, to inspect differences in behavior, classes, equipment and other categories." }
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
    wukong: {
      zh: '《游戏黑话》出海：从"Wukong"到"Loong"的文化穿越',
      en: 'Game Slang Going Global: Cultural Crossing from "Wukong" to "Loong"'
    },
    "wukongIntro": {
      "zh": "从玩家之间的黑话，到游戏里的名字、称谓与名物，词语的跨语言之旅仍在继续。《黑神话：悟空》提供了一个具体的观察入口：一个名字被怎样写成英文，它背后的故事又能被读懂多少？",
      "en": "From slang shared by players to the names, designations, and objects within games, words continue their journey across languages. Black Myth: Wukong offers a concrete example: how is a name rendered in English, and how much of its story can a reader understand?"
    },
    "wukongKeywordComparison": {
      "zh": {
        "title": "关键词对比",
        "subtitle": "对照文化词语的写法与具体语境",
        "tooltips": {
          "wukong": "英文游戏标题采用 Wukong；人物背景可对照《西游记》第一回。",
          "loong": "官方公告在名称 Yellow Loong 中使用 Loong，不据此限定其他语境的译法。",
          "yaoguai": "官方英文公告使用 yaoguai；具体身份仍需结合人物与情节理解。",
          "shifu": "Shifu 展示“师父”的音译形式；具体关系仍需结合上下文理解。",
          "yaomo": "Yaomo 展示“妖魔”的音译形式；拼写本身不能说明角色的全部特征。",
          "jingubang": "Jingubang 是已核对的官方宣传用名；器物描写可对照原著。",
          "pigsy": "本页已核对的开发者公告用名为 Zhu Bajie；不同称呼应结合具体来源阅读。"
        }
      },
      "en": {
        "title": "Keyword Comparison",
        "subtitle": "Compare cultural terms in their specific contexts",
        "tooltips": {
          "wukong": "The English game title uses Wukong; Chapter 1 of Journey to the West provides the naming scene.",
          "loong": "The official announcement uses Loong in Yellow Loong. This does not prescribe its use in every context.",
          "yaoguai": "The official English announcement uses yaoguai; characters and plot supply the specific context.",
          "shifu": "Shifu illustrates a transliteration of 师父; context is still needed to understand the relationship.",
          "yaomo": "Yaomo illustrates a transliteration of 妖魔; spelling alone does not explain every character trait.",
          "jingubang": "Jingubang is attested in official publicity; the novel provides the object’s description.",
          "pigsy": "The developer announcement checked here uses Zhu Bajie. Read each designation with its specific source."
        }
      }
    },
    "wukongTranslationStyle": {
      "zh": {
        "title": "翻译风格切换",
        "subtitle": "用教学拟译比较一个文化称谓的两种处理",
        "foreignization": "异化倾向",
        "domestication": "归化倾向"
      },
      "en": {
        "title": "Translation Style Toggle",
        "subtitle": "A teaching exercise comparing two ways to render one cultural term",
        "foreignization": "Foreignizing tendency",
        "domestication": "Domesticating tendency"
      }
    },
    "wukongMetaphorMap": {
      "zh": {
        "title": "文化关联地图",
        "subtitle": "沿着名字与名物回到原著的具体段落",
        "buddhism": {
          "marker": "佛",
          "label": "戒行与称谓"
        },
        "taoism": {
          "marker": "道",
          "label": "拜师与命名"
        },
        "poetry": {
          "marker": "诗",
          "label": "古典诗词"
        },
        "idioms": {
          "marker": "语",
          "label": "成语典故"
        },
        "tooltips": {
          "buddhism": "第十九回记载悟能的法名与八戒的别名，可回到原文阅读。",
          "taoism": "第一回的拜师与命名场景提供原著线索；文学描写与教义解释应分开。",
          "poetry": "原著诗句应结合所在回目和叙事情境阅读。",
          "idioms": "先确认词语的出处，再讨论它在具体情境里的意思。"
        }
      },
      "en": {
        "title": "Cultural Connections",
        "subtitle": "Follow names and objects to specific passages in the novel",
        "buddhism": {
          "marker": "Precepts",
          "label": "Precepts and names"
        },
        "taoism": {
          "marker": "Teacher",
          "label": "Learning and naming"
        },
        "poetry": {
          "marker": "Poetry",
          "label": "Classical poetry"
        },
        "idioms": {
          "marker": "Idioms",
          "label": "Idioms and allusions"
        },
        "tooltips": {
          "buddhism": "Chapter 19 records Wuneng as a religious name and Bajie as an additional name.",
          "taoism": "Chapter 1 provides the teaching and naming scene; distinguish literary description from doctrinal interpretation.",
          "poetry": "Read poems alongside their chapter and narrative context.",
          "idioms": "Establish the source of an expression before discussing its meaning in context."
        }
      }
    },
    "wukongCharacterNames": {
      "zh": {
        "title": "角色与名物注解",
        "subtitle": "对照人物称谓与器物名称，查看各自的文本位置",
        "clickToView": "点击查看名称与背景"
      },
      "en": {
        "title": "Characters and Objects",
        "subtitle": "Compare character designations and object names in their textual contexts",
        "clickToView": "View names and context"
      }
    },
    "wukongSummary": {
      "zh": {
        "title": "一个词，通向更远的故事",
        "text": "一个词跨越语言时，改变的不只是写法。译名可以保留一种陌生的声音，也可以先解释它是什么；而名字背后的故事，还需要人物、情节和玩家的探索来补全。"
      },
      "en": {
        "title": "One word, a way into a wider story",
        "text": "When a word crosses languages, more than its spelling can change. A translated name may preserve an unfamiliar sound or begin by explaining what it refers to; the story behind it still unfolds through characters, plot, and the player's own exploration."
      }
    },
    wukongModal: {
      zh: {
        close: '关闭'
      },
      en: {
        close: 'Close'
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
    let cached;
    try { cached = localStorage.getItem(storageKey); } catch (_) {}
    if (cached === 'zh' || cached === 'en') return cached;
    const navLang = (navigator.language || navigator.userLanguage || 'zh').toLowerCase();
    return navLang.startsWith('zh') ? 'zh' : 'en';
  }

  function setLang(lang){
    state.lang = lang === 'en' ? 'en' : 'zh';
    try { localStorage.setItem(storageKey, state.lang); } catch (_) {}
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
    // 先尝试常规路径查找（末级为 { zh, en } 对象）
    let node = translations;
    for (const p of parts){
      node = node && node[p];
    }
    if (node && typeof node === 'object' && (node.zh || node.en)) {
      const val = node[state.lang] || node.zh;
      return typeof val === 'string' ? val : key;
    }

    // 兼容分组结构：group 下为 zh/en 对象，末级为具体键
    const group = translations[parts[0]];
    if (group && typeof group === 'object' && group.zh && group.en) {
      let curZh = group.zh;
      let curEn = group.en;
      for (let i = 1; i < parts.length; i++) {
        curZh = curZh && curZh[parts[i]];
        curEn = curEn && curEn[parts[i]];
      }
      const val2 = state.lang === 'en' ? curEn : curZh;
      return typeof val2 === 'string' && val2 ? val2 : key;
    }

    // 找不到时返回 key 作为降级
    return key;
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
      // 仅当找到有效翻译时才覆盖，避免显示键名
      if (text && text !== key) el.textContent = text;
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
  document.documentElement.setAttribute('lang', state.lang);
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
