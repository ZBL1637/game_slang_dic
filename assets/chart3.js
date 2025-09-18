// 创建术语类别情感分布雷达图
function createTermSentimentRadarChart() {
    // 获取图表容器
    const chartDom = document.getElementById('chart3');
    if (!chartDom) {
        console.error('找不到chart3容器');
        return;
    }
    const myChart = echarts.init(chartDom);
    
    // 直接嵌入JSON数据
    const sentimentData = [
        {
            "术语类别":"交流/指挥类",
            "中性":0.5833333333,
            "正面":0.4166666667,
            "负面":0.0
        },
        {
            "术语类别":"地图/副本类",
            "中性":0.9473684211,
            "正面":0.0526315789,
            "负面":0.0
        },
        {
            "术语类别":"机制类",
            "中性":0.5924657534,
            "正面":0.102739726,
            "负面":0.3047945205
        },
        {
            "术语类别":"物品/装备类",
            "中性":0.7952755906,
            "正面":0.188976378,
            "负面":0.0157480315
        },
        {
            "术语类别":"玩家/群体标签",
            "中性":0.7568807339,
            "正面":0.1834862385,
            "负面":0.0596330275
        },
        {
            "术语类别":"社交类/梗类",
            "中性":0.8857142857,
            "正面":0.1142857143,
            "负面":0.0
        },
        {
            "术语类别":"经济交易类",
            "中性":0.875,
            "正面":0.125,
            "负面":0.0
        },
        {
            "术语类别":"职业类",
            "中性":0.7512077295,
            "正面":0.2125603865,
            "负面":0.0362318841
        },
        {
            "术语类别":"行为类",
            "中性":0.8402417962,
            "正面":0.1243523316,
            "负面":0.0354058722
        },
        {
            "术语类别":"跨游戏通用语",
            "中性":0.8079096045,
            "正面":0.0960451977,
            "负面":0.0960451977
        }
    ];

    // 获取图表容器 (需要页面中有id为'radarChart'的div元素)
// ECharts实例已在函数开头初始化

    // 提取类别名称作为雷达图指标
    const indicators = sentimentData.map(item => ({
        name: item['术语类别'],
        max: 1.0,
        axisLabel: {
            color: '#ffffff',
            fontSize: 14,
            fontWeight: 'bold'
        }
    }));

    // 准备三个系列的数据
    const neutralData = sentimentData.map(item => (item['中性'] || 0).toFixed(3));
    const positiveData = sentimentData.map(item => (item['正面'] || 0).toFixed(3));
    const negativeData = sentimentData.map(item => (item['负面'] || 0).toFixed(3));

    // 配置选项
    const option = {
        tooltip: {
            trigger: 'item',
            formatter: function(params) {
                const category = indicators[params.dataIndex].name;
                const value = (parseFloat(params.value) * 100).toFixed(1);
                return `${category}<br/>${params.seriesName}: ${value}%`;
            },
            backgroundColor: 'rgba(255,255,255,0.95)',
            borderColor: '#ccc',
            borderWidth: 1,
            textStyle: {
                color: '#333'
            }
        },
        title: {
            text: '术语类别情感分布',
            left: 'center',
            top: 10,
            textStyle: {
                color: '#ffffff',
                fontSize: 20,
                fontWeight: 'bold'
            }
        },
        legend: {
            data: [
                {name: '中性', itemStyle: {color: '#752AEE'}},
                {name: '正面', itemStyle: {color: '#A78BFA'}},
                {name: '负面', itemStyle: {color: '#5B21B6'}}
            ],
            top: 60,
            left: 'center',
            orient: 'horizontal',
            itemGap: 50,
            textStyle: {
                color: '#ffffff',
                fontSize: 14,
                fontWeight: 'bold'
            }
        },
        radar: {
            indicator: indicators,
            radius: '65%',
            center: ['50%', '60%'],
            startAngle: 90,
            splitNumber: 5,
            shape: 'polygon',
            axisName: {
                color: '#ffffff',
                fontSize: 14,
                fontWeight: 'bold'
            },
            splitLine: {
                lineStyle: {
                    color: '#bdc3c7',
                    width: 2
                }
            },
            splitArea: {
                areaStyle: {
                    color: ['rgba(236,240,241,0.1)', 'rgba(189,195,199,0.1)']
                }
            },
            axisLine: {
                lineStyle: {
                    color: '#7f8c8d',
                    width: 2
                }
            }
        },
        series: [{
            name: '中性',
            type: 'radar',
            data: [{
                value: neutralData,
                name: '中性',
                itemStyle: {
                    color: '#752AEE'
                },
                lineStyle: {
                    color: '#752AEE',
                    width: 4
                },
                areaStyle: {
                    color: 'rgba(117, 42, 238, 0.25)'
                }
            }],
            symbol: 'circle',
            symbolSize: 6
        }, {
            name: '正面',
            type: 'radar',
            data: [{
                value: positiveData,
                name: '正面',
                itemStyle: {
                    color: '#A78BFA'
                },
                lineStyle: {
                    color: '#A78BFA',
                    width: 4
                },
                areaStyle: {
                    color: 'rgba(167, 139, 250, 0.25)'
                }
            }],
            symbol: 'diamond',
            symbolSize: 6
        }, {
            name: '负面',
            type: 'radar',
            data: [{
                value: negativeData,
                name: '负面',
                itemStyle: {
                    color: '#5B21B6'
                },
                lineStyle: {
                    color: '#5B21B6',
                    width: 4
                },
                areaStyle: {
                    color: 'rgba(91, 33, 182, 0.25)'
                }
            }],
            symbol: 'triangle',
            symbolSize: 6
        }],
        animationDuration: 1000,
        animationEasing: 'cubicOut'
    };

    // 渲染图表
    myChart.setOption(option);

    // 响应式调整
    window.addEventListener('resize', function() {
        myChart.resize();
    });

    // 输出数据统计
    console.log('术语类别情感分布数据:', sentimentData);
    
    // 计算一些统计信息
    const avgNeutral = sentimentData.reduce((sum, item) => sum + item['中性'], 0) / sentimentData.length;
    const avgPositive = sentimentData.reduce((sum, item) => sum + item['正面'], 0) / sentimentData.length;
    const avgNegative = sentimentData.reduce((sum, item) => sum + item['负面'], 0) / sentimentData.length;
    
    console.log('平均情感分布:', {
        中性: (avgNeutral * 100).toFixed(1) + '%',
        正面: (avgPositive * 100).toFixed(1) + '%',
        负面: (avgNegative * 100).toFixed(1) + '%'
    });

    return myChart;
}

// 图表创建函数，需要手动调用