// 创建ECharts图表（直接使用数据，无需读取文件）
function createTermDistributionChart() {
    // 获取图表容器
    const chartDom = document.getElementById('chart1');
    if (!chartDom) {
        console.error('找不到chart1容器');
        return;
    }
    // 处置已存在的实例，避免重复与渲染异常
    const existing = echarts.getInstanceByDom(chartDom);
    if (existing) {
        try { existing.dispose(); } catch(e) {}
    }
    const myChart = echarts.init(chartDom);
    
    // 直接嵌入JSON数据
    const data = [
        {
            "游戏":"CSGO",
            "交流/指挥类":0.0206185567,
            "地图/副本类":0.0721649485,
            "机制类":0.0103092784,
            "物品/装备类":0.0206185567,
            "玩家/群体标签":0.0206185567,
            "社交类/梗类":0.0,
            "经济交易类":0.0,
            "职业类":0.0515463918,
            "行为类":0.793814433,
            "跨游戏通用语":0.0103092784
        },
        {
            "游戏":"英雄联盟",
            "交流/指挥类":0.0,
            "地图/副本类":0.03,
            "机制类":0.11,
            "物品/装备类":0.07,
            "玩家/群体标签":0.02,
            "社交类/梗类":0.0,
            "经济交易类":0.0,
            "职业类":0.14,
            "行为类":0.59,
            "跨游戏通用语":0.04
        },
        {
            "游戏":"最终幻想14",
            "交流/指挥类":0.0118577075,
            "地图/副本类":0.0158102767,
            "机制类":0.2134387352,
            "物品/装备类":0.04743083,
            "玩家/群体标签":0.1541501976,
            "社交类/梗类":0.0079051383,
            "经济交易类":0.0316205534,
            "职业类":0.2845849802,
            "行为类":0.1778656126,
            "跨游戏通用语":0.0553359684
        },
        {
            "游戏":"三角洲行动",
            "交流/指挥类":0.0126582278,
            "地图/副本类":0.0548523207,
            "机制类":0.0253164557,
            "物品/装备类":0.0168776371,
            "玩家/群体标签":0.1476793249,
            "社交类/梗类":0.0042194093,
            "经济交易类":0.0,
            "职业类":0.0168776371,
            "行为类":0.4135021097,
            "跨游戏通用语":0.3080168776
        },
        {
            "游戏":"原神",
            "交流/指挥类":0.0,
            "地图/副本类":0.0289017341,
            "机制类":0.0809248555,
            "物品/装备类":0.0346820809,
            "玩家/群体标签":0.0867052023,
            "社交类/梗类":0.0,
            "经济交易类":0.0057803468,
            "职业类":0.4335260116,
            "行为类":0.2774566474,
            "跨游戏通用语":0.0520231214
        },
        {
            "游戏":"怪物猎人",
            "交流/指挥类":0.0,
            "地图/副本类":0.0043478261,
            "机制类":0.1826086957,
            "物品/装备类":0.0782608696,
            "玩家/群体标签":0.0608695652,
            "社交类/梗类":0.0043478261,
            "经济交易类":0.0,
            "职业类":0.047826087,
            "行为类":0.5695652174,
            "跨游戏通用语":0.052173913
        },
        {
            "游戏":"文明6",
            "交流/指挥类":0.0,
            "地图/副本类":0.1156462585,
            "机制类":0.0340136054,
            "物品/装备类":0.0,
            "玩家/群体标签":0.0204081633,
            "社交类/梗类":0.0,
            "经济交易类":0.0272108844,
            "职业类":0.0068027211,
            "行为类":0.7959183673,
            "跨游戏通用语":0.0
        },
        {
            "游戏":"无畏契约",
            "交流/指挥类":0.0,
            "地图/副本类":0.0438596491,
            "机制类":0.149122807,
            "物品/装备类":0.0614035088,
            "玩家/群体标签":0.0526315789,
            "社交类/梗类":0.0,
            "经济交易类":0.0087719298,
            "职业类":0.0087719298,
            "行为类":0.6754385965,
            "跨游戏通用语":0.0
        },
        {
            "游戏":"永劫无间",
            "交流/指挥类":0.0054054054,
            "地图/副本类":0.0432432432,
            "机制类":0.1513513514,
            "物品/装备类":0.0864864865,
            "玩家/群体标签":0.0918918919,
            "社交类/梗类":0.0,
            "经济交易类":0.0162162162,
            "职业类":0.0864864865,
            "行为类":0.4918918919,
            "跨游戏通用语":0.027027027
        },
        {
            "游戏":"王者荣耀",
            "交流/指挥类":0.0,
            "地图/副本类":0.0240963855,
            "机制类":0.078313253,
            "物品/装备类":0.0240963855,
            "玩家/群体标签":0.0903614458,
            "社交类/梗类":0.0120481928,
            "经济交易类":0.0361445783,
            "职业类":0.1265060241,
            "行为类":0.578313253,
            "跨游戏通用语":0.0301204819
        },
        {
            "游戏":"绝地求生",
            "交流/指挥类":0.0045248869,
            "地图/副本类":0.0407239819,
            "机制类":0.0180995475,
            "物品/装备类":0.0316742081,
            "玩家/群体标签":0.1176470588,
            "社交类/梗类":0.0814479638,
            "经济交易类":0.0,
            "职业类":0.0452488688,
            "行为类":0.6063348416,
            "跨游戏通用语":0.0542986425
        },
        {
            "游戏":"艾尔登法环",
            "交流/指挥类":0.0,
            "地图/副本类":0.0746268657,
            "机制类":0.2313432836,
            "物品/装备类":0.0895522388,
            "玩家/群体标签":0.0447761194,
            "社交类/梗类":0.0,
            "经济交易类":0.0074626866,
            "职业类":0.0895522388,
            "行为类":0.4552238806,
            "跨游戏通用语":0.0074626866
        },
        {
            "游戏":"魔兽世界",
            "交流/指挥类":0.0,
            "地图/副本类":0.0182926829,
            "机制类":0.1829268293,
            "物品/装备类":0.0975609756,
            "玩家/群体标签":0.0609756098,
            "社交类/梗类":0.0,
            "经济交易类":0.0243902439,
            "职业类":0.2987804878,
            "行为类":0.2743902439,
            "跨游戏通用语":0.0426829268
        },
        {
            "游戏":"鸣潮",
            "交流/指挥类":0.005899705,
            "地图/副本类":0.017699115,
            "机制类":0.1061946903,
            "物品/装备类":0.0471976401,
            "玩家/群体标签":0.0825958702,
            "社交类/梗类":0.0324483776,
            "经济交易类":0.01179941,
            "职业类":0.3628318584,
            "行为类":0.2330383481,
            "跨游戏通用语":0.1002949853
        }
    ];

    // 提取游戏名称和分类
    const gamesRaw = data.map(item => item['游戏'].replace('.xlsx', ''));
    const gamesDisplay = (window.i18n ? gamesRaw.map(n => i18n.tGame(n)) : gamesRaw);

    // 获取所有分类名称（除了游戏名称）
    const categoriesRaw = Object.keys(data[0]).filter(key => key !== '游戏');
    const categoriesDisplay = (window.i18n ? categoriesRaw.map(c => i18n.tCategory(c)) : categoriesRaw);

    // 构建分类数据（使用原始中文键索引，避免因翻译导致取值失败）
    const categoryDataByRaw = {};
    categoriesRaw.forEach(rawKey => {
        categoryDataByRaw[rawKey] = data.map(item => item[rawKey] || 0);
    });

    // 定义颜色方案，适配清华紫主题风格
    const colors = [
        '#7F0056', // 交流/指挥类 - 清华紫主色调
        '#A6006B', // 地图/副本类 - 浅紫色
        '#5A003D', // 机制类 - 深紫色
        '#D946EF', // 物品/装备类 - 粉紫色
        '#7F0056', // 玩家/群体标签 - 清华紫主色调
        '#A6006B', // 社交类/梗类 - 浅紫色
        '#5A003D', // 经济交易类 - 深紫色
        '#D946EF', // 职业类 - 粉紫色
        '#7F0056', // 行为类 - 清华紫主色调
        '#A6006B'  // 跨游戏通用语 - 浅紫色
    ];

    // ECharts实例已在函数开头初始化

    // 配置选项
    const option = {
        title: {
            text: (window.i18n ? (i18n.getLang() === 'zh' ? '游戏术语分类分布' : 'Term Category Distribution') : '游戏术语分类分布'),
            left: 'center',
            top: 10,
            textStyle: {
                fontSize: 18,
                fontWeight: 'bold',
                color: '#ffffff',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
            }
        },
        tooltip: {
            trigger: 'axis',
            axisPointer: {
                type: 'shadow'
            },
            formatter: function(params) {
                let result = params[0].axisValue + '<br/>';
                params.forEach(param => {
                    if (param.value > 0) {
                        result += param.marker + param.seriesName + ': ' + (param.value * 100).toFixed(1) + '%<br/>';
                    }
                });
                return result;
            }
        },
        legend: {
            type: 'scroll',
            orient: 'horizontal',
            top: 40,
            left: 'center',
            itemWidth: 14,
            itemHeight: 14,
            textStyle: {
                fontSize: 12,
                color: '#f9fafb',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
            }
        },
        grid: {
            left: '3%',
            right: '4%',
            bottom: '3%',
            top: 80,
            containLabel: true
        },
        xAxis: {
            type: 'category',
            // 使用原始游戏键作为类目，避免语言切换时索引错位
            data: gamesRaw,
            axisLabel: {
                // 显示时翻译为英文/中文
                formatter: function(value){
                  try {
                    return (window.i18n ? i18n.tGame(value) : value);
                  } catch(e){ return value; }
                },
                rotate: 45,
                fontSize: 11,
                color: '#e5e7eb',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
            },
            axisLine: {
                lineStyle: {
                    color: '#d1d5db'
                }
            }
        },
        yAxis: {
            type: 'value',
            max: 1,
            axisLabel: {
                formatter: function(value) {
                    return (value * 100) + '%';
                },
                fontSize: 11,
                color: '#e5e7eb',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
            },
            axisLine: {
                lineStyle: {
                    color: '#d1d5db'
                }
            },
            splitLine: {
                lineStyle: {
                    color: '#f3f4f6'
                }
            }
        },
        legend: {
            type: 'scroll',
            orient: 'horizontal',
            top: 40,
            left: 'center',
            itemWidth: 14,
            itemHeight: 14,
            textStyle: {
                fontSize: 12,
                color: '#f9fafb',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
            },
            // 明确指定图例项，避免语言切换时自动推断失效
            data: categoriesDisplay
        },
    series: categoriesRaw.map((rawKey, index) => ({
            name: categoriesDisplay[index],
            type: 'bar',
            stack: 'total',
            data: categoryDataByRaw[rawKey],
            itemStyle: {
                color: colors[index % colors.length]
            },
            emphasis: {
                focus: 'series'
            }
        }))
    };

    // 设置配置并渲染图表
    myChart.setOption(option, true); // notMerge=true，确保完整刷新

    // 响应式调整
    window.addEventListener('resize', function() {
        myChart.resize();
    });

    return myChart;
}

// 语言切换时重新渲染
window.addEventListener('languagechange', function(){
  try { createTermDistributionChart(); } catch(e){}
});

// 图表创建函数，需要手动调用