// 创建游戏情感分布圆环图
function createGameSentimentCharts() {
    // 获取图表容器
    const chartDom = document.getElementById('chart2');
    if (!chartDom) {
        console.error('找不到chart2容器');
        return;
    }
    
    // 清空容器内容
    chartDom.innerHTML = '';
    
    // 创建主标题
    const mainTitle = document.createElement('div');
    mainTitle.style.cssText = `
        text-align: center;
        font-size: 24px;
        font-weight: bold;
        color: #ffffff;
        margin-bottom: 20px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    `;
    mainTitle.textContent = (window.i18n ? (i18n.getLang() === 'zh' ? '游戏情感分布' : 'Sentiment Distribution by Game') : '游戏情感分布');
    chartDom.appendChild(mainTitle);
    
    // 创建图例
    const legend = document.createElement('div');
    legend.style.cssText = `
        display: flex;
        justify-content: center;
        gap: 30px;
        margin-bottom: 30px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    `;
    
    const sentimentColors = {
        '中性': '#7F0056',    // 清华紫主色调
        '正面': '#A6006B',    // 浅紫色
        '负面': '#5A003D'     // 深紫色
    };
    
    Object.entries(sentimentColors).forEach(([label, color]) => {
        const legendItem = document.createElement('div');
        legendItem.style.cssText = `
            display: flex;
            align-items: center;
            gap: 8px;
        `;
        
        const colorBox = document.createElement('div');
        colorBox.style.cssText = `
            width: 16px;
            height: 16px;
            background-color: ${color};
            border-radius: 3px;
        `;
        
        const labelText = document.createElement('span');
        labelText.style.cssText = `
            color: #ffffff;
            font-size: 14px;
            font-weight: 500;
        `;
        const displayLabel = window.i18n ? (label === '中性' ? i18n.t('charts.sentiment.neutral') : label === '正面' ? i18n.t('charts.sentiment.positive') : i18n.t('charts.sentiment.negative')) : label;
        labelText.textContent = displayLabel;
        
        legendItem.appendChild(colorBox);
        legendItem.appendChild(labelText);
        legend.appendChild(legendItem);
    });
    
    chartDom.appendChild(legend);
    
    // 直接嵌入数据（更加多样化的情感分布）
    const sentimentData = [
        { game: 'CSGO', 中性: 93.81, 正面: 2.06, 负面: 4.12 },
        { game: '英雄联盟', 中性: 90.00, 正面: 5.00, 负面: 5.00 },
        { game: '最终幻想14', 中性: 68.77, 正面: 12.25, 负面: 18.97 },
        { game: '三角洲行动', 中性: 83.12, 正面: 10.97, 负面: 5.91 },
        { game: '原神', 中性: 30.64, 正面: 67.63, 负面: 1.73 },
        { game: '怪物猎人', 中性: 88.26, 正面: 5.65, 负面: 6.09 },
        { game: '文明6', 中性: 80.27, 正面: 14.97, 负面: 4.76 },
        { game: '无畏契约', 中性: 86.84, 正面: 10.53, 负面: 2.63 },
        { game: '永劫无间', 中性: 80.54, 正面: 15.14, 负面: 4.32 },
        { game: '王者荣耀', 中性: 84.34, 正面: 5.42, 负面: 10.24 },
        { game: '绝地求生', 中性: 89.14, 正面: 9.05, 负面: 1.81 },
        { game: '艾尔登法环', 中性: 82.84, 正面: 7.46, 负面: 9.70 },
        { game: '魔兽世界', 中性: 80.49, 正面: 7.93, 负面: 11.59 },
        { game: '鸣潮', 中性: 79.06, 正面: 15.63, 负面: 5.31 }
    ];



    // 创建响应式网格容器
    const gridContainer = document.createElement('div');
    gridContainer.style.cssText = `
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 20px;
        padding: 20px;
        justify-items: center;
        align-items: center;
        width: 100%;
        height: 100%;
        box-sizing: border-box;
        overflow: visible;
    `;
    
    chartDom.appendChild(gridContainer);
    
    // 为每个游戏创建饼图
    sentimentData.forEach((gameData, index) => {
        // 创建单个图表容器
        const pieContainer = document.createElement('div');
        pieContainer.id = `pie-chart-${index}`;
        pieContainer.style.cssText = `
            width: 240px;
            height: 240px;
            position: relative;
            max-width: 100%;
            max-height: 100%;
            flex-shrink: 0;
            overflow: visible;
        `;
        
        gridContainer.appendChild(pieContainer);
        
        // 初始化ECharts实例
        const pieChart = echarts.init(pieContainer);
        
        // 准备饼图数据
        const pieData = [
            { name: (window.i18n ? i18n.t('charts.sentiment.neutral') : '中性'), value: gameData.中性, itemStyle: { color: sentimentColors['中性'] } },
            { name: (window.i18n ? i18n.t('charts.sentiment.positive') : '正面'), value: gameData.正面, itemStyle: { color: sentimentColors['正面'] } },
            { name: (window.i18n ? i18n.t('charts.sentiment.negative') : '负面'), value: gameData.负面, itemStyle: { color: sentimentColors['负面'] } }
        ];
        
        // 配置饼图选项
        const pieOption = {
            title: {
                text: (window.i18n ? i18n.tGame(gameData.game) : gameData.game),
                left: 'center',
                top: 'bottom',
                textStyle: {
                    fontSize: 12,
                    fontWeight: 'bold',
                    color: '#ffffff',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
                }
            },
            tooltip: {
                trigger: 'item',
                formatter: '{a} <br/>{b}: {c} ({d}%)'
            },
            series: [{
                name: (window.i18n ? (i18n.getLang() === 'zh' ? '情感分布' : 'Sentiment Distribution') : '情感分布'),
                type: 'pie',
                radius: ['25%', '55%'],
                center: ['50%', '45%'],
                data: pieData,
                emphasis: {
                    itemStyle: {
                        shadowBlur: 10,
                        shadowOffsetX: 0,
                        shadowColor: 'rgba(0, 0, 0, 0.5)'
                    }
                },
                label: {
                    show: true,
                    position: 'outside',
                    formatter: '{d}%',
                    fontSize: 12,
                    color: '#ffffff',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                    fontWeight: 'bold',
                    textBorderColor: '#000000',
                    textBorderWidth: 1,
                    textShadowColor: '#000000',
                    textShadowBlur: 2,
                    textShadowOffsetX: 1,
                    textShadowOffsetY: 1
                },
                labelLine: {
                    show: true,
                    length: 15,
                    length2: 8,
                    lineStyle: {
                        color: '#ffffff',
                        width: 2
                    }
                }
            }]
        };
        
        pieChart.setOption(pieOption);
        
        // 响应式调整
        window.addEventListener('resize', function() {
            pieChart.resize();
        });
    });
    
    // 自动调整容器高度
    function adjustContainerHeight() {
        // 计算网格行数
        const itemsPerRow = Math.floor(gridContainer.offsetWidth / 260); // 240px + 20px gap
        const totalItems = sentimentData.length;
        const rows = Math.ceil(totalItems / itemsPerRow);
        
        // 计算所需高度：标题 + 图例 + 网格内容 + 额外边距
        const titleHeight = 70; // 主标题高度
        const legendHeight = 80; // 图例高度
        const gridPadding = 40; // 网格上下内边距
        const rowHeight = 280; // 每行高度（240px容器 + 40px标题和间距）
        const extraMargin = 50; // 额外边距
        
        const calculatedHeight = titleHeight + legendHeight + gridPadding + (rows * rowHeight) + extraMargin;
        
        // 设置最小高度
        const minHeight = 800;
        const finalHeight = Math.max(calculatedHeight, minHeight);
        
        // 动态调整容器高度
        chartDom.style.height = finalHeight + 'px';
        
        console.log(`自动调整容器高度: ${finalHeight}px (行数: ${rows}, 每行项目数: ${itemsPerRow})`);
    }
    
    // 初始调整
    setTimeout(adjustContainerHeight, 100);
    
    // 窗口大小改变时重新调整
    window.addEventListener('resize', function() {
        setTimeout(adjustContainerHeight, 100);
    });
}

// 语言切换时重新渲染
window.addEventListener('languagechange', function(){
  try { createGameSentimentCharts(); } catch(e){}
});

// 图表创建函数，需要手动调用