import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const content = require('../assets/quiz-content.js');
const model = require('../assets/quiz-model.js');
const source = readFileSync(new URL('../assets/blackspeak-dna.js', import.meta.url), 'utf8');

function report(answers) {
    class Node {
        constructor() { this.children = []; this.events = new Map(); this.style = {}; this.classList = { toggle() {} }; this.value = ''; }
        set textContent(value) { this.value = String(value); this.children = []; }
        get textContent() { return this.value + this.children.map(child => child.textContent).join(''); }
        append(...children) { this.children.push(...children); }
        replaceChildren(...children) { this.value = ''; this.children = children; }
        setAttribute() {}
        addEventListener(type, fn) { this.events.set(type, fn); }
        emit(type) { this.events.get(type)?.(); }
    }
    const ids = new Map();
    const node = id => { if (!ids.has(id)) ids.set(id, new Node()); return ids.get(id); };
    let locale = 'zh';
    const window = new Node();
    Object.assign(window, { QuizContent: content, QuizModel: model, i18n: { getLang: () => locale } });
    const document = { documentElement: {}, getElementById: node, createElement: () => new Node(),
        createElementNS: () => new Node(), createTextNode(value) { const result = new Node(); result.textContent = value; return result; } };
    const saved = JSON.stringify({ version: content.version, step: 7, answers });
    vm.runInNewContext(source, { window, document, localStorage: { getItem: () => saved }, requestAnimationFrame() {}, Intl });
    node('startBtn').emit('click');
    return { evidence: () => node('evidenceContainer').children.map(item => item.textContent),
        language(value) { locale = value; window.emit('languagechange'); } };
}

test('rank report evidence shows the actual priority when a second-place answer supports the overall leading dimension, in both languages', () => {
    const answers = Object.fromEntries(content.questions.map(question => [question.id, [question.options.find(option => option.neutral).id]]));
    answers.q1 = ['q1_practice'];
    answers.q4 = ['q4_help', 'q4_retry', 'q4_detour']; // B, A, C as selected in browser QA.
    const before = structuredClone(answers), result = report(answers);
    const zh = result.evidence();
    assert.ok(zh.some(text => text.includes('你排在第 2 位：再试一次刚才没过的挑战')));
    assert.ok(zh.some(text => text.includes('你排在第 1 位：帮队友把手头的任务收个尾')));
    assert.ok(zh.some(text => text.includes('你的选择：先试一关有点难度的挑战')));
    assert.ok(!zh.some(text => text.includes('你的选择：再试一次刚才没过的挑战')));
    result.language('en');
    const en = result.evidence();
    assert.ok(en.some(text => text.includes('Ranked #2: Retry the challenge I did not finish')));
    assert.ok(en.some(text => text.includes('Ranked #1: Help a teammate finish their current task')));
    assert.ok(en.some(text => text.includes('Your choice: Try a tricky challenge')));
    assert.deepEqual(answers, before);
    const scores = model.evaluate(answers).dimensions;
    assert.equal(scores.find(item => item.id === 'challenge').score, 4);
    assert.equal(scores.find(item => item.id === 'cooperation').score, 1.5);
    assert.equal(scores.find(item => item.id === 'exploration').score, .5);
});
