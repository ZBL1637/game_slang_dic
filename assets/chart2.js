// Original source data; presentation and lifecycle are shared by LegacyChartUI.
function createGameSentimentCharts() {
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
    return window.LegacyChartUI.mountGames('chart2', sentimentData, 'pie');
}
window.LegacyChartUI.register('chart2', createGameSentimentCharts);
