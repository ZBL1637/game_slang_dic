// 创建多游戏术语分布雷达图
function createMultiGameRadarCharts() {
    // 获取图表容器
    const chartDom = document.getElementById('chart4');
    if (!chartDom) {
        console.error('找不到chart4容器');
        return;
    }
    
    // 清空容器并创建网格布局
    chartDom.innerHTML = '';
    chartDom.style.display = 'flex';
    chartDom.style.flexDirection = 'column';
    chartDom.style.padding = '20px';
    
    // 添加大标题
    const titleElement = document.createElement('h2');
    titleElement.textContent = '多游戏术语分类雷达图';
    titleElement.style.color = '#ffffff';
    titleElement.style.textAlign = 'center';
    titleElement.style.fontSize = '24px';
    titleElement.style.fontWeight = 'bold';
    titleElement.style.marginBottom = '30px';
    titleElement.style.marginTop = '0';
    chartDom.appendChild(titleElement);
    
    // 创建雷达图容器
    const radarContainer = document.createElement('div');
    radarContainer.style.display = 'grid';
    radarContainer.style.gridTemplateColumns = 'repeat(3, 1fr)';
    radarContainer.style.gap = '20px';
    chartDom.appendChild(radarContainer);
    
    // 直接嵌入JSON数据
    const gameTermData = [
        {
            "游戏":"CSGO",
            "交流/指挥类":0.0206185567,
            "地图/副本类":0.0721649485,
            "机制类":0.0103092784,
            "物品类":0.0206185567,
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
            "物品类":0.07,
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
            "物品类":0.04743083,
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
            "物品类":0.0168776371,
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
            "物品类":0.0346820809,
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
            "物品类":0.0782608696,
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
            "物品类":0.0,
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
            "物品类":0.0614035088,
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
            "物品类":0.0864864865,
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
            "物品类":0.0240963855,
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
            "物品类":0.0316742081,
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
            "物品类":0.0895522388,
            "玩家/群体标签":0.0447761194,
            "社交类/梗类":0.0,
            "经济交易类":0.0074626866,
            "职业类":0.0895522388,
            "行为类":0.4552238806,
            "跨游戏通用语":0.0074626866
        }
    ];

    // 定义每个游戏的颜色 - 清华紫主题配色方案
    const gameColors = [
        '#7F0056', // CSGO - 清华紫主色
        '#A6006B', // LOL - 清华紫亮色
        '#B5007A', // ff14 - 清华紫最亮色
        '#9A0070', // 三角洲行动 - 清华紫亮中色
        '#5A003D', // 原神 - 清华紫深色
        '#8F0062', // 怪物猎人 - 清华紫中色
        '#6B0049', // 文明6 - 清华紫暗色
        '#4A0030', // 无畏契约 - 清华紫最深色
        '#9A0070', // 永劫 - 清华紫亮中色
        '#B5007A', // 王者荣耀 - 清华紫最亮色
        '#5A003D', // 绝地求生 - 清华紫深色
        '#7F0056'  // 艾尔登法环 - 清华紫主色
     ];

    // 获取术语类别（排除游戏名称）
    const categories = Object.keys(gameTermData[0]).filter(key => key !== '游戏');

    // 创建综合雷达图
    // 准备雷达图指标
    const indicators = categories.map(category => ({
        name: category,
        max: 1.0
    }));

    // 为每个游戏创建单独的雷达图
    gameTermData.forEach((gameData, index) => {
        // 创建单独的容器
        const gameContainer = document.createElement('div');
        gameContainer.style.width = '100%';
        gameContainer.style.height = '400px';
        gameContainer.style.backgroundColor = 'rgba(255,255,255,0.05)';
        gameContainer.style.borderRadius = '8px';
        gameContainer.style.border = '1px solid rgba(255,255,255,0.1)';
        gameContainer.id = `radar_${index}`;
        radarContainer.appendChild(gameContainer);
        
        // 初始化ECharts实例
        const gameChart = echarts.init(gameContainer);
        
        // 准备当前游戏的数据
        const values = categories.map(category => gameData[category] || 0);
        const gameColor = gameColors[index % gameColors.length];
        
        // 计算当前游戏数据的最大值，并设置合适的雷达图最大值
        const maxValue = Math.max(...values);
        const radarMax = Math.ceil(maxValue * 1.2 * 10) / 10; // 增加20%的余量并保留一位小数
        
        // 为当前游戏准备雷达图指标
        const gameIndicators = categories.map(category => ({
            name: category,
            max: radarMax
        }));

        // 配置单个游戏的雷达图选项
        const option = {
            title: {
                text: gameData['游戏'],
                left: 'center',
                top: 5,
                textStyle: {
                    color: '#ffffff',
                    fontSize: 14,
                    fontWeight: 'bold'
                }
            },
            tooltip: {
                trigger: 'item',
                formatter: function(params) {
                    const category = gameIndicators[params.dataIndex].name;
                    const value = (parseFloat(params.value) * 100).toFixed(1);
                    return `${category}: ${value}%`;
                },
                backgroundColor: 'rgba(255,255,255,0.95)',
                borderColor: '#ccc',
                borderWidth: 1,
                textStyle: {
                    color: '#333'
                }
            },
            radar: {
                indicator: gameIndicators.map(indicator => ({
                    ...indicator,
                    axisLabel: {
                        show: false
                    }
                })),
                center: ['50%', '55%'],
                radius: '65%',
                startAngle: 90,
                splitNumber: 4,
                shape: 'polygon',
                axisName: {
                    color: '#ffffff',
                    fontSize: 10,
                    fontWeight: 'normal'
                },
                splitLine: {
                    lineStyle: {
                        color: '#bdc3c7',
                        width: 1
                    }
                },
                splitArea: {
                    areaStyle: {
                        color: ['rgba(236,240,241,0.05)', 'rgba(189,195,199,0.05)']
                    }
                },
                axisLine: {
                    lineStyle: {
                        color: '#7f8c8d',
                        width: 1
                    }
                }
            },
            series: [{
                type: 'radar',
                data: [{
                    value: values,
                    name: gameData['游戏'],
                    itemStyle: {
                        color: gameColor
                    },
                    lineStyle: {
                        color: gameColor,
                        width: 2
                    },
                    areaStyle: {
                        color: gameColor,
                        opacity: 0.2
                    },
                    symbol: 'circle',
                    symbolSize: 4
                }]
            }],
            animationDuration: 1000,
            animationEasing: 'cubicOut'
        };
        
        gameChart.setOption(option);
        
        // 响应式调整
        window.addEventListener('resize', function() {
            gameChart.resize();
        });
    });
}

// 创建容器HTML的辅助函数
function createRadarChartsContainer() {
    // 游戏列表
    const gameList = [
        "CSGO", "LOL", "ff14", "三角洲行动", 
        "原神", "怪物猎人", "文明6", "无畏契约",
        "永劫", "王者荣耀", "绝地求生", "艾尔登法环"
    ];
    
    const containerHTML = `
        <div class="multi-radar-container" style="
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 20px;
            padding: 20px;
            background-color: #f8f9fa;
            max-width: 1200px;
            margin: 0 auto;
        ">
            ${gameList.map((game, index) => `
                <div class="radar-item" style="
                    background: white;
                    border-radius: 8px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                    padding: 10px;
                    aspect-ratio: 1;
                ">
                    <div id="radarChart_${index}" style="width: 100%; height: 100%;"></div>
                </div>
            `).join('')}
        </div>
        
        <style>
        @media (max-width: 1024px) {
            .multi-radar-container {
                grid-template-columns: repeat(3, 1fr) !important;
            }
        }
        
        @media (max-width: 768px) {
            .multi-radar-container {
                grid-template-columns: repeat(2, 1fr) !important;
                gap: 15px !important;
            }
        }
        
        @media (max-width: 480px) {
            .multi-radar-container {
                grid-template-columns: 1fr !important;
                gap: 10px !important;
            }
        }
        </style>
    `;
    
    return containerHTML;
}

// 使用示例：
// 1. 创建容器: document.body.innerHTML = createRadarChartsContainer();
// 2. 确保已引入ECharts库: <script src="https://cdnjs.cloudflare.com/ajax/libs/echarts/5.4.3/echarts.min.js"></script>
// 3. 调用函数创建图表: createMultiGameRadarCharts();

// 图表创建函数，需要手动调用