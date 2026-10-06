/* Versioned content for the original eight-card quiz; no browser side effects. */
(() => {
    'use strict';
    const t = (zh, en) => ({ zh, en });
    const option = (id, zh, en, dimension, communication) => {
        const value = { id, label: t(zh, en) };
        if (dimension) value.dimension = dimension;
        if (communication) value.communication = communication;
        return value;
    };
    const neutral = id => ({ id, label: t('这次没有明确偏好', 'No clear preference this time'), neutral: true });
    const unknown = id => ({ id, label: t('不确定，或没接触过这个说法', 'Not sure, or I have not encountered this phrase'), neutral: true });
    const content = {
        version: '2026-10-quiz-1',
        dimensions: [
            { id: 'challenge', label: t('挑战', 'Challenge'), color: '#d88ba8', games: t('动作挑战、竞速、竞技', 'Action challenges, racing, competitive play') },
            { id: 'cooperation', label: t('协作', 'Cooperation'), color: '#ba89d4', games: t('团队竞技、合作闯关', 'Team games, co-op adventures') },
            { id: 'exploration', label: t('探索', 'Exploration'), color: '#849cd6', games: t('开放世界、探索冒险', 'Open worlds, exploration adventures') },
            { id: 'creation', label: t('创造', 'Creation'), color: '#b786bb', games: t('沙盒建造、模拟经营', 'Sandbox building, management simulations') },
            { id: 'story', label: t('叙事', 'Story'), color: '#cc91be', games: t('角色扮演、剧情冒险', 'Role-playing games, narrative adventures') },
            { id: 'relax', label: t('松弛', 'Relaxation'), color: '#87b5b0', games: t('轻度模拟、休闲玩法', 'Gentle simulations, casual play') }
        ],
        communication: [
            { id: 'coordinate', label: t('组织配合', 'Coordinate a plan') },
            { id: 'encourage', label: t('鼓励支持', 'Offer encouragement') },
            { id: 'independent', label: t('先行尝试', 'Try something first') },
            { id: 'observe', label: t('先确认线索', 'Check the clues first') }
        ],
        questions: [
            {
                id: 'q1', type: 'single', title: t('第一次进入一款新游戏，第一晚你会先做什么？', 'On your first evening in a new game, what would you do first?'),
                subtitle: t('假设这些玩法都能体验，选最接近你想法的一项。', 'Imagine all these activities are available. Choose the closest fit.'),
                options: [
                    option('q1_practice', '先试一关有点难度的挑战，看看能不能练过去', 'Try a tricky challenge and see whether practice helps me finish it', 'challenge'),
                    option('q1_party', '约上朋友，一起完成第一个任务', 'Invite friends to complete the first task together', 'cooperation'),
                    option('q1_roam', '离开主路线，看看地图边角藏着什么', 'Leave the main route and explore the corners of the map', 'exploration'),
                    option('q1_make', '试试建造和组合，做点自己的东西', 'Try building and combining things to make something of my own', 'creation'),
                    option('q1_lore', '看完开场剧情，再找角色聊聊这个世界', 'Watch the opening story, then talk to characters about the world', 'story'),
                    option('q1_scenery', '钓钓鱼、看看风景，不急着推进任务', 'Fish or enjoy the scenery without rushing through tasks', 'relax'),
                    neutral('q1_neutral')
                ]
            },
            {
                id: 'q2', type: 'chat', title: t('队友发来这句话，你更可能怎样回复？', 'A teammate sends this message. How would you be most likely to reply?'),
                subtitle: t('选你愿意说出口的一句，没有标准答案。', 'Choose something you would actually say. There is no correct reply.'),
                context: t('“刚才又是我失误了……要不我先退出？”', '“That was my mistake again… Should I leave the group?”'),
                options: [
                    option('q2_practice', '“先别急退，我陪你把刚才那一步再练一遍。”', '“No rush to leave. I will practice that step with you.”', 'challenge', 'encourage'),
                    option('q2_roles', '“我们重新分下工，这次我来接应你。”', '“Let us adjust the roles. I will cover you this time.”', 'cooperation', 'coordinate'),
                    option('q2_route', '“我先看看有没有别的路线，再一起决定。”', '“Let me check for another route, then we can decide together.”', 'exploration', 'observe'),
                    option('q2_setup', '“我先改个搭配，试试自己想的那个办法。”', '“I will change my setup first and try an idea I have.”', 'creation', 'independent'),
                    option('q2_hint', '“先等等，我想确认刚才那段剧情里留下的提示。”', '“Wait a moment. I want to check the clue in that story scene.”', 'story', 'observe'),
                    option('q2_pause', '“已经挺努力了，先歇会儿，想玩时再来。”', '“We have given it a good try. Let us rest and return when we feel like it.”', 'relax', 'encourage'),
                    { id: 'q2_neutral', label: t('这些都不像我会说的话，暂时不选', 'None of these sounds like me; I will leave this open'), neutral: true }
                ]
            },
            {
                id: 'q3', type: 'single', title: t('哪种游戏瞬间最让你想继续玩？', 'Which moment most makes you want to keep playing?'),
                subtitle: t('选你最在意的体验，不需要选别人觉得厉害的。', 'Choose the experience that matters to you, regardless of what impresses others.'),
                options: [
                    option('q3_clear', '试了好几次，终于过了原本卡住的那一关', 'Finally clearing a section after several attempts', 'challenge'),
                    option('q3_together', '一次配合刚好接上，大家一起完成目标', 'A plan coming together so the whole group finishes the objective', 'cooperation'),
                    option('q3_discovery', '在不起眼的地方，发现一条没见过的路', 'Finding an unfamiliar path in an overlooked corner', 'exploration'),
                    option('q3_invention', '自己设计的机关或搭配，真的运转起来了', 'Seeing a device or setup I designed actually work', 'creation'),
                    option('q3_reveal', '前面留下的剧情线索，终于在这一刻连起来', 'Seeing earlier story clues come together', 'story'),
                    option('q3_quiet', '没有倒计时催促，安安静静玩了一会儿', 'Spending a quiet stretch of time without a countdown rushing me', 'relax'),
                    neutral('q3_neutral')
                ]
            },
            {
                id: 'q4', type: 'rank', pickCount: 3,
                title: t('还剩 20 分钟，先把时间留给什么？', 'With 20 minutes left, what would you make time for first?'),
                subtitle: t('按优先顺序选 3 项，之后可以上下调整；没有明确偏好也可以单独选最后一项。', 'Choose three in priority order, then adjust their order if needed. The last option can be selected on its own.'),
                options: [
                    option('q4_retry', '再试一次刚才没过的挑战', 'Retry the challenge I did not finish', 'challenge'),
                    option('q4_help', '帮队友把手头的任务收个尾', 'Help a teammate finish their current task', 'cooperation'),
                    option('q4_detour', '去一个还没到过的角落看看', 'Visit a corner I have not explored', 'exploration'),
                    option('q4_build', '把自己的小作品补完', 'Finish something I have been building', 'creation'),
                    option('q4_chapter', '看完正在进行的这一段故事', 'Reach the end of the current story chapter', 'story'),
                    option('q4_unwind', '做点轻松的事，按自己的节奏收尾', 'Do something easy and wind down at my own pace', 'relax'),
                    neutral('q4_neutral')
                ]
            },
            {
                id: 'q5', type: 'single', title: t('这份游戏内奖励，你会优先用在哪里？', 'What would you spend this in-game reward on first?'),
                subtitle: t('假设这些用途花费相同，这次只能先选一种。', 'Assume each use costs the same and you can choose only one for now.'),
                context: t('完成任务后，你得到一份可以自由分配的游戏内资源。', 'After a task, you receive some in-game resources to use as you wish.'),
                options: [
                    option('q5_challenge', '解锁一项更有难度的挑战', 'Unlock a more demanding challenge', 'challenge'),
                    option('q5_supply', '准备队伍下一次行动需要的补给', 'Prepare supplies for the group’s next outing', 'cooperation'),
                    option('q5_area', '打开一片尚未探索的区域', 'Open an area I have not explored', 'exploration'),
                    option('q5_material', '换一批材料，做自己想做的东西', 'Get materials for something I want to make', 'creation'),
                    option('q5_side_story', '继续喜欢的角色支线，看看后续故事', 'Continue a character’s side story to see what happens next', 'story'),
                    option('q5_comfort', '解锁一项省心的日常功能，让后面玩得轻松些', 'Unlock a convenient everyday feature for more relaxed play', 'relax'),
                    neutral('q5_neutral')
                ]
            },
            {
                id: 'q6', type: 'single', title: t('这次尝试没成功，你更想怎么接着安排？', 'This attempt did not work out. What would you like to do next?'),
                subtitle: t('选最接近你当下想法的做法，停下来也完全可以。', 'Choose what fits your mood now. Stopping is a valid choice too.'),
                context: t('同行者问：“接下来还继续吗？”', 'Someone in the group asks, “Shall we keep going?”'),
                options: [
                    option('q6_practice', '告诉大家我想自己再试一次，专门练刚才卡住的操作', 'Say I would like another try on my own to practice the difficult move', 'challenge', 'independent'),
                    option('q6_plan', '先问问大家的想法，再商量下一次怎么配合', 'Ask what everyone thinks, then agree on how to coordinate the next attempt', 'cooperation', 'coordinate'),
                    option('q6_scout', '说一声我先去探探别的路线，有发现再回来分享', 'Offer to scout another route and come back with any discoveries', 'exploration', 'independent'),
                    option('q6_remake', '和队友约好先调整搭配，再一起试一种新办法', 'Agree with the group to change our setups and try a new approach', 'creation', 'coordinate'),
                    option('q6_notes', '先翻翻任务记录，确认有没有漏掉的故事线索', 'Check the task journal for story clues we may have missed', 'story', 'observe'),
                    option('q6_rest', '跟大家说已经很努力了，休息后再决定要不要继续', 'Tell everyone we have tried hard, and suggest resting before deciding', 'relax', 'encourage'),
                    neutral('q6_neutral')
                ]
            },
            {
                id: 'q7', type: 'knowledge', title: t('“拉枪线”在这里更接近什么意思？', 'What does “拉枪线” mean in this situation?'),
                subtitle: t('这题只看这句话的理解，不计入玩法偏好；不确定也可以选。', 'This checks understanding of the phrase, not your play preferences. “Not sure” is available.'),
                context: t('射击对局里，队友说：“拉枪线，别都挤在同一边。”', 'In a shooter, a teammate says, “拉枪线 — do not all crowd onto the same side.”'),
                explanation: t('这里的“拉枪线”指调整站位，从不同角度牵制或分散敌方火力，为队友创造出手机会。', 'Here, “拉枪线” means changing positions to draw or divide enemy fire from different angles, creating an opening for teammates.'),
                options: [
                    { ...option('q7_angles', '分散到不同角度牵制敌人，给队友创造机会', 'Take different angles to divide the enemy’s attention and create an opening'), correct: true },
                    option('q7_group', '所有人挤在同一个位置，同时开火', 'Group everyone into the same position and fire together'),
                    option('q7_range', '换一把射程更远的枪', 'Switch to a gun with a longer range'),
                    unknown('q7_unknown')
                ]
            },
            {
                id: 'q8', type: 'knowledge', title: t('“先控龙，别追人”主要在提醒什么？', 'What is the main point of “先控龙，别追人”?'),
                subtitle: t('这题只看这句话的理解，不计入玩法偏好；不确定也可以选。', 'This checks understanding of the phrase, not your play preferences. “Not sure” is available.'),
                context: t('MOBA 对局里，队友发来：“先控龙，别追人。”', 'During a MOBA match, a teammate says, “先控龙，别追人.”'),
                explanation: t('“控龙”指争夺龙类地图目标和对应资源。“别追人”是在提醒队伍先处理目标，而非继续追击敌人。', '“控龙” means contesting dragon objectives and their resources. “别追人” asks the team to prioritize that objective instead of continuing to chase opponents.'),
                options: [
                    { ...option('q8_objective', '优先争夺地图上的龙类目标与资源', 'Prioritize the dragon objective and its resources'), correct: true },
                    option('q8_chase', '继续追击对方落单的英雄', 'Keep chasing an isolated enemy hero'),
                    option('q8_base', '把兵线一直推到敌方主水晶', 'Push the minion wave all the way to the enemy base'),
                    unknown('q8_unknown')
                ]
            }
        ]
    };
    if (typeof module !== 'undefined' && module.exports) module.exports = content;
    else window.QuizContent = content;
})();
