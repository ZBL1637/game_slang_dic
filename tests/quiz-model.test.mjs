import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const content = require('../assets/quiz-content.js');
const model = require('../assets/quiz-model.js');
const question = id => content.questions.find(item => item.id === id);
const choose = (id, dimension) => [question(id).options.find(option => option.dimension === dimension).id];
const blank = () => Object.fromEntries(content.questions.map(item => [item.id, [item.options.find(option => option.neutral).id]]));
const rank = (...dimensions) => dimensions.map(dimension => choose('q4', dimension)[0]);
const score = (result, id) => result.dimensions.find(dimension => dimension.id === id);
const sum = result => result.dimensions.reduce((total, dimension) => total + dimension.score, 0);

test('content contains eight bilingual cards with balanced behavioral choices and two knowledge items', () => {
    assert.equal(content.version, '2026-10-quiz-1');
    assert.equal(content.questions.length, 8);
    assert.equal(content.questions.filter(item => item.type === 'knowledge').length, 2);
    assert.equal(content.questions.filter(item => item.type === 'rank').length, 1);
    assert.equal(content.questions.filter(item => item.type === 'chat').length, 1);
    const ids = content.dimensions.map(item => item.id);
    for (const dimension of content.dimensions) for (const locale of ['zh', 'en']) {
        assert.ok(dimension.label[locale].trim());
        assert.equal(typeof dimension.games[locale], 'string');
    }
    for (const item of content.questions) {
        assert.equal(new Set(item.options.map(option => option.id)).size, item.options.length);
        for (const locale of ['zh', 'en']) {
            assert.ok(item.title[locale].trim()); assert.ok(item.subtitle[locale].trim());
            for (const option of item.options) assert.ok(option.label[locale].trim());
        }
        if (item.type === 'knowledge') {
            assert.equal(item.options.filter(option => option.correct).length, 1);
            assert.equal(item.options.filter(option => option.neutral).length, 1);
            for (const locale of ['zh', 'en']) assert.ok(item.explanation[locale].trim());
            assert.ok(item.options.every(option => !option.dimension && !option.communication));
        } else {
            assert.deepEqual(item.options.filter(option => option.dimension).map(option => option.dimension), ids);
        }
        if (!['q2', 'q6'].includes(item.id)) assert.ok(item.options.every(option => !option.communication));
    }
});

test('single answers require one real string ID, including rejecting sparse arrays and numeric legacy indexes', () => {
    assert.equal(model.isAnswerValid(question('q1'), choose('q1', 'challenge')), true);
    for (const answer of [null, undefined, [], 'q1_practice', [0], ['missing'], ['q1_practice', 'q1_roam'], new Array(1), [undefined]]) {
        assert.equal(model.isAnswerValid(question('q1'), answer), false);
    }
    assert.equal(model.isAnswerValid(null, ['x']), false);
});

test('rank accepts exactly three unique choices in order or one neutral choice, with no mixing', () => {
    assert.equal(model.isAnswerValid(question('q4'), rank('challenge', 'cooperation', 'exploration')), true);
    assert.equal(model.isAnswerValid(question('q4'), ['q4_neutral']), true);
    for (const answer of [rank('challenge'), rank('challenge', 'cooperation'), rank('challenge', 'cooperation', 'exploration', 'story'),
        ['q4_retry', 'q4_retry', 'q4_help'], ['q4_neutral', 'q4_retry', 'q4_help'], ['q4_retry', 'stale', 'q4_help'], new Array(3)]) {
        assert.equal(model.isAnswerValid(question('q4'), answer), false);
    }
});

test('sanitize drops unknown, stale, inherited and malformed answers without salvaging partial ranks', () => {
    const input = Object.assign(Object.create({ q1: ['q1_practice'] }), {
        q2: ['q2_roles'], q3: [0], q4: ['q4_retry', 'missing', 'q4_help'], q7: ['q7_unknown'], old_q: ['a']
    });
    assert.deepEqual(model.sanitizeAnswers(input), { q2: ['q2_roles'], q7: ['q7_unknown'] });
    assert.deepEqual(model.sanitizeAnswers({ version: 'old-version', answers: blank() }), {});
    for (const value of [null, 2, [], 'bad']) assert.deepEqual(model.sanitizeAnswers(value), {});
    const clean = model.sanitizeAnswers({ q1: ['q1_practice'] });
    clean.q1.push('q1_roam');
    assert.deepEqual(model.sanitizeAnswers({ q1: ['q1_practice'] }), { q1: ['q1_practice'] });
});

test('evaluation rejects incomplete or invalid answer sets with actionable question IDs', () => {
    const answers = blank(); delete answers.q3;
    assert.throws(() => model.evaluate(answers), error => error.code === 'INCOMPLETE_ANSWERS' && error.questionIds.join(',') === 'q3');
    assert.throws(() => model.evaluate({}), error => error.code === 'INCOMPLETE_ANSWERS' && error.questionIds.length === 8);
    answers.q3 = new Array(1);
    assert.throws(() => model.evaluate(answers), error => error.code === 'INCOMPLETE_ANSWERS');
});

test('progress preserves ordered rank drafts through JSON storage without treating them as completed answers', () => {
    for (const ordered of [rank('creation'), rank('relax', 'challenge')]) {
        const input = blank(); input.q4 = ordered;
        const stored = JSON.parse(JSON.stringify(model.sanitizeProgressAnswers(input)));
        const restored = model.sanitizeProgressAnswers(stored);
        assert.deepEqual(restored, input);
        assert.notStrictEqual(restored.q4, stored.q4);
        assert.equal(model.isAnswerValid(question('q4'), restored.q4), false);
        assert.equal(Object.keys(model.sanitizeAnswers(restored)).length, 7);
        assert.throws(() => model.evaluate(restored), error => error.code === 'INCOMPLETE_ANSWERS'
            && error.questionIds.join(',') === 'q4');
    }
    for (const ordered of [rank('story', 'exploration', 'cooperation'), ['q4_neutral']]) {
        const input = blank(); input.q4 = ordered;
        assert.deepEqual(model.sanitizeProgressAnswers(input), model.sanitizeAnswers(input));
        assert.equal(model.isAnswerValid(question('q4'), model.sanitizeProgressAnswers(input).q4), true);
        assert.doesNotThrow(() => model.evaluate(model.sanitizeProgressAnswers(input)));
    }
});

test('progress rejects whole malformed rank drafts instead of salvaging foreign, duplicate or empty entries', () => {
    const malformed = [null, undefined, [], 'q4_retry', { 0: 'q4_retry', length: 1 },
        [0], [null], [undefined], [false], [['q4_retry']], ['q1_practice'],
        ['q4_retry', 'q1_practice'], ['q4_retry', 'stale'], ['q4_retry', 'q4_retry'],
        ['q4_neutral', 'q4_retry'], ['q4_retry', 'q4_neutral'], ['q4_neutral', 'q4_neutral'],
        rank('challenge', 'cooperation', 'exploration', 'story'), new Array(1), ['q4_retry', ,],
        Object.assign(new Array(3), { 0: 'q4_retry', 2: 'q4_help' })];
    for (const q4 of malformed) {
        const input = { q1: ['q1_practice'], q4 };
        assert.deepEqual(model.sanitizeProgressAnswers(input), { q1: ['q1_practice'] });
    }
});

test('progress keeps strict non-rank validation, ignores inherited or stale payloads and clones selected arrays', () => {
    const input = Object.assign(Object.create({ q4: ['q4_retry'] }), {
        q1: ['q1_practice'], q2: ['q2_roles', 'q2_route'], q3: new Array(1), q7: ['q7_unknown'], old_q: ['x']
    });
    assert.deepEqual(model.sanitizeProgressAnswers(input), model.sanitizeAnswers(input));
    for (const raw of [null, undefined, false, 3, [], 'bad', { version: 'old-version', answers: blank() }]) {
        assert.deepEqual(model.sanitizeProgressAnswers(raw), {});
    }
    const draft = Object.assign(Object.create(null), { q4: ['q4_help', 'q4_retry'] });
    const clean = model.sanitizeProgressAnswers(draft);
    assert.deepEqual(clean, { q4: ['q4_help', 'q4_retry'] });
    clean.q4.reverse();
    assert.deepEqual(draft.q4, ['q4_help', 'q4_retry']);
});

test('all-neutral completion produces no preference or communication claim and no fabricated 100 percent', () => {
    const result = model.evaluate(blank());
    assert.equal(result.hasPreference, false); assert.equal(result.preferenceAnswers, 0);
    assert.equal(sum(result), 0); assert.deepEqual(result.communication, []);
    assert.ok(result.dimensions.every(item => item.score === 0 && item.percent === 0 && item.evidence.length === 0));
    assert.equal(result.knowledge.correct, 0); assert.equal(result.knowledge.answered, 0); assert.equal(result.knowledge.total, 2);
    assert.ok(result.knowledge.items.every(item => item.uncertain && !item.correct && item.correctOptionId));
});

test('rank uses 1.5, 1 and 0.5 points, contributes one answered preference card, and changes with order', () => {
    const answers = blank(); answers.q4 = rank('challenge', 'cooperation', 'exploration');
    const result = model.evaluate(answers);
    assert.equal(sum(result), 3); assert.equal(result.preferenceAnswers, 1);
    assert.equal(score(result, 'challenge').score, 1.5); assert.equal(score(result, 'cooperation').score, 1); assert.equal(score(result, 'exploration').score, .5);
    assert.equal(score(result, 'challenge').percent, 50);
    answers.q4.reverse();
    const reversed = model.evaluate(answers);
    assert.equal(score(reversed, 'challenge').score, .5); assert.equal(score(reversed, 'exploration').score, 1.5); assert.equal(sum(reversed), 3);
});

test('all 120 valid rankings have the same three-point budget and unique traceable evidence', () => {
    const dimensions = content.dimensions.map(item => item.id); let checked = 0;
    for (const first of dimensions) for (const second of dimensions) for (const third of dimensions) {
        if (new Set([first, second, third]).size !== 3) continue;
        const answers = blank(); answers.q4 = rank(first, second, third);
        const result = model.evaluate(answers); assert.equal(sum(result), 3);
        assert.equal(result.dimensions.flatMap(item => item.evidence).length, 3); checked += 1;
    }
    assert.equal(checked, 120);
});

test('each ordinary behavior card has a three-point budget and six completed cards total eighteen', () => {
    const answers = blank();
    for (const id of ['q1', 'q2', 'q3', 'q5', 'q6']) answers[id] = choose(id, 'challenge');
    answers.q4 = rank('challenge', 'cooperation', 'exploration');
    const result = model.evaluate(answers);
    assert.equal(sum(result), 18); assert.equal(result.preferenceAnswers, 6); assert.equal(score(result, 'challenge').score, 16.5);
    assert.ok(Math.abs(result.dimensions.reduce((total, item) => total + item.percent, 0) - 100) < 1e-10);
});

test('changing only knowledge answers never changes preference or communication results', () => {
    const answers = blank(); answers.q1 = choose('q1', 'creation'); answers.q2 = choose('q2', 'cooperation');
    const before = model.evaluate(answers);
    answers.q7 = ['q7_angles']; answers.q8 = ['q8_objective'];
    const correct = model.evaluate(answers);
    assert.equal(correct.knowledge.correct, 2); assert.equal(correct.knowledge.answered, 2);
    answers.q7 = ['q7_range']; answers.q8 = ['q8_chase'];
    const incorrect = model.evaluate(answers);
    assert.equal(incorrect.knowledge.correct, 0); assert.equal(incorrect.knowledge.answered, 2);
    assert.ok(incorrect.knowledge.items.every(item => !item.correct && !item.uncertain));
    for (const result of [correct, incorrect]) {
        assert.deepEqual(result.dimensions, before.dimensions); assert.deepEqual(result.communication, before.communication);
        assert.equal(result.preferenceAnswers, before.preferenceAnswers);
    }
});

test('equal scores keep equal percentages and deterministic order without rounding a winner into existence', () => {
    const answers = blank(); answers.q1 = choose('q1', 'challenge'); answers.q2 = choose('q2', 'cooperation'); answers.q3 = choose('q3', 'exploration');
    const result = model.evaluate(answers), top = result.dimensions.slice(0, 3);
    assert.deepEqual(top.map(item => item.id), ['challenge', 'cooperation', 'exploration']);
    assert.ok(top.every(item => item.score === 3 && item.percent === top[0].percent));
});

test('communication counts only explicit selections and includes the exact two supporting answers', () => {
    const answers = blank(); answers.q2 = choose('q2', 'challenge'); answers.q6 = choose('q6', 'relax');
    const result = model.evaluate(answers);
    assert.deepEqual(result.communication, [{ id: 'encourage', count: 2, evidence: [
        { questionId: 'q2', optionId: 'q2_practice' }, { questionId: 'q6', optionId: 'q6_rest' }
    ] }]);
    const other = blank(); other.q1 = choose('q1', 'cooperation'); other.q3 = choose('q3', 'cooperation');
    assert.deepEqual(model.evaluate(other).communication, []);
});

test('every preference evidence item points to a selected behavior option of that dimension', () => {
    const answers = blank(); answers.q2 = choose('q2', 'story'); answers.q5 = choose('q5', 'creation'); answers.q4 = rank('relax', 'exploration', 'challenge');
    const original = structuredClone(answers), result = model.evaluate(answers);
    for (const dimension of result.dimensions) for (const evidence of dimension.evidence) {
        assert.ok(answers[evidence.questionId].includes(evidence.optionId));
        assert.notEqual(question(evidence.questionId).type, 'knowledge');
        assert.equal(question(evidence.questionId).options.find(option => option.id === evidence.optionId).dimension, dimension.id);
    }
    assert.deepEqual(answers, original);
    result.dimensions[0].score = 999;
    assert.notEqual(model.evaluate(answers).dimensions[0].score, 999);
});

test('classic scripts expose the same API without requiring DOM access; reversed load order fails clearly', () => {
    const contentSource = readFileSync(new URL('../assets/quiz-content.js', import.meta.url), 'utf8');
    const modelSource = readFileSync(new URL('../assets/quiz-model.js', import.meta.url), 'utf8');
    const sandbox = { window: {} }; vm.createContext(sandbox);
    vm.runInContext(contentSource, sandbox); vm.runInContext(modelSource, sandbox);
    assert.equal(sandbox.window.QuizContent.questions.length, 8);
    assert.equal(sandbox.window.QuizModel.version, model.version);
    assert.equal(typeof sandbox.window.QuizModel.sanitizeProgressAnswers, 'function');
    assert.equal(sandbox.window.QuizModel.sanitizeProgressAnswers({ q4: ['q4_retry'] }).q4[0], 'q4_retry');
    assert.equal(sandbox.window.QuizModel.evaluate(blank()).hasPreference, false);
    assert.throws(() => vm.runInNewContext(modelSource, { window: {} }), /Load quiz-content/);
});
