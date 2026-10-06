/* Pure scoring API. Browser: load quiz-content.js first. Node: require this file.
 * Answers are { questionId: [optionId, ...] }; a rank answer is in priority order.
 * evaluate throws INCOMPLETE_ANSWERS when any of the eight answers is invalid.
 * Neutral rank answers contain only the neutral ID; otherwise exactly three IDs.
 * sanitizeProgressAnswers also preserves valid rank drafts of one or two IDs;
 * drafts remain invalid for completion counts and evaluate.
 * percent is an unrounded numeric share, so equal scores remain equal.
 * knowledge.answered excludes explicit uncertainty; total includes every knowledge question.
 * Persistence/version envelopes belong to the controller, not this module.
 */
(() => {
    'use strict';
    const isCjs = typeof module !== 'undefined' && module.exports;
    const content = isCjs ? require('./quiz-content.js') : window.QuizContent;
    if (!content?.questions || !content?.dimensions) throw new Error('Load quiz-content.js before quiz-model.js.');
    const kinds = new Set(['single', 'chat', 'rank', 'knowledge']);
    const questionMap = new Map(content.questions.map(question => [question.id, question]));

    function isAnswerValid(question, answer) {
        if (!question || !kinds.has(question.type) || !Array.isArray(question.options)) return false;
        if (!Array.isArray(answer) || !answer.length || [...answer].some(id => typeof id !== 'string')) return false;
        if (new Set(answer).size !== answer.length) return false;
        const options = new Map(question.options.map(option => [option.id, option]));
        if (answer.some(id => !options.has(id))) return false;
        const picked = answer.map(id => options.get(id));
        if (question.type !== 'rank') return answer.length === 1;
        if (picked.some(option => option.neutral)) return answer.length === 1 && picked[0].neutral === true;
        return Number.isInteger(question.pickCount) && question.pickCount > 0 && answer.length === question.pickCount;
    }

    function sanitizeAnswers(raw) {
        const clean = {};
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return clean;
        for (const question of content.questions) {
            if (!Object.prototype.hasOwnProperty.call(raw, question.id)) continue;
            if (isAnswerValid(question, raw[question.id])) clean[question.id] = [...raw[question.id]];
        }
        return clean;
    }

    function sanitizeProgressAnswers(raw) {
        const clean = sanitizeAnswers(raw);
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return clean;
        for (const question of content.questions) {
            if (question.type !== 'rank' || !Object.prototype.hasOwnProperty.call(raw, question.id)) continue;
            const answer = raw[question.id];
            if (!Number.isInteger(question.pickCount) || !Array.isArray(answer)
                || answer.length < 1 || answer.length > question.pickCount) continue;
            // Apply the same membership, uniqueness and neutral rules to a shorter draft.
            if (isAnswerValid({ ...question, pickCount: answer.length }, answer)) clean[question.id] = [...answer];
        }
        return clean;
    }

    function evaluate(raw) {
        const answers = sanitizeAnswers(raw);
        const missing = content.questions.filter(question => !Object.prototype.hasOwnProperty.call(answers, question.id));
        if (missing.length) {
            const error = new Error('Every question needs a valid answer before a report can be created.');
            error.code = 'INCOMPLETE_ANSWERS';
            error.questionIds = missing.map(question => question.id);
            throw error;
        }
        const dimensions = content.dimensions.map(dimension => ({ id: dimension.id, score: 0, percent: 0, evidence: [] }));
        const dimensionsById = new Map(dimensions.map(dimension => [dimension.id, dimension]));
        const communication = content.communication.map(style => ({ id: style.id, count: 0, evidence: [] }));
        const communicationById = new Map(communication.map(style => [style.id, style]));
        const knowledge = { correct: 0, answered: 0, total: 0, items: [] };
        let preferenceAnswers = 0;

        for (const [questionId, question] of questionMap) {
            const picked = answers[questionId].map(id => question.options.find(option => option.id === id));
            if (question.type === 'knowledge') {
                const option = picked[0];
                const uncertain = option.neutral === true;
                const correct = !uncertain && option.correct === true;
                knowledge.total += 1;
                knowledge.answered += uncertain ? 0 : 1;
                knowledge.correct += correct ? 1 : 0;
                knowledge.items.push({ questionId, optionId: option.id, correct, uncertain,
                    correctOptionId: question.options.find(candidate => candidate.correct === true)?.id || null });
                continue;
            }
            if (picked[0].neutral === true) continue;
            const rankTotal = question.type === 'rank' ? question.pickCount * (question.pickCount + 1) / 2 : 1;
            let hasEvidence = false;
            picked.forEach((option, index) => {
                const evidence = { questionId, optionId: option.id };
                const dimension = dimensionsById.get(option.dimension);
                if (dimension) {
                    const weight = question.type === 'rank' ? (question.pickCount - index) / rankTotal * 3 : 3;
                    dimension.score += weight;
                    dimension.evidence.push({ ...evidence });
                    hasEvidence = true;
                }
                const style = communicationById.get(option.communication);
                if (style) { style.count += 1; style.evidence.push({ ...evidence }); }
            });
            if (hasEvidence) preferenceAnswers += 1;
        }
        const total = dimensions.reduce((sum, dimension) => sum + dimension.score, 0);
        for (const dimension of dimensions) dimension.percent = total > 0 ? dimension.score / total * 100 : 0;
        const dimensionOrder = new Map(content.dimensions.map((dimension, index) => [dimension.id, index]));
        const communicationOrder = new Map(content.communication.map((style, index) => [style.id, index]));
        dimensions.sort((a, b) => b.score - a.score || dimensionOrder.get(a.id) - dimensionOrder.get(b.id));
        communication.sort((a, b) => b.count - a.count || communicationOrder.get(a.id) - communicationOrder.get(b.id));
        return { dimensions, communication: communication.filter(style => style.count > 0), knowledge,
            preferenceAnswers, hasPreference: total > 0 };
    }

    const api = { version: content.version, isAnswerValid, sanitizeAnswers, sanitizeProgressAnswers, evaluate };
    if (isCjs) module.exports = api;
    else window.QuizModel = api;
})();
