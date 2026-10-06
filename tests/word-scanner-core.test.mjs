import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const core = require('../assets/word-scanner-core.js');
const groups = count => Array.from({ length: count }, (_, index) => ({ key: String(index), term: String(index), entries: [] }));
const keys = list => list.map(group => group.key);
const seeded = seed => () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
function assertSafe(layout, width, motion = 8, gap = 12) {
    const epsilon = 1e-6;
    for (const card of layout.items) {
        assert.ok(card.x >= motion - epsilon && card.y >= motion - epsilon, `leading bounds: ${card.id}`);
        assert.ok(card.x + card.width + motion <= width + epsilon, `right bound: ${card.id}`);
        assert.ok(card.y + card.height + motion <= layout.height + epsilon, `bottom bound: ${card.id}`);
    }
    for (let i = 0; i < layout.items.length; i += 1) for (let j = i + 1; j < layout.items.length; j += 1) {
        const a = layout.items[i], b = layout.items[j], distance = 2 * motion + gap;
        assert.ok(a.x + a.width + distance <= b.x + epsilon || b.x + b.width + distance <= a.x + epsilon
            || a.y + a.height + distance <= b.y + epsilon || b.y + b.height + distance <= a.y + epsilon,
        `motion and visible gap clearance: ${a.id} / ${b.id}`);
    }
}

test('term grouping trims and ignores case while retaining distinct source games and meanings', () => {
    const rows = [
        { slang: ' NB ', definition: '解释一', gameKey: 'LOL', game: '英雄联盟' },
        { slang: 'nb', definition: ' 解释一 ', gameKey: 'LOL', game: '英雄联盟' },
        { slang: 'Nb', definition: '解释二', gameKey: 'LOL', game: '英雄联盟' },
        { slang: 'NB', definition: '解释一', gameKey: 'Delta', game: '三角洲行动' }
    ];
    const before = structuredClone(rows), result = core.groupRows(rows);
    assert.equal(result.length, 1); assert.equal(result[0].key, 'nb'); assert.equal(result[0].term, 'NB');
    assert.equal(result[0].entries.length, 3); assert.deepEqual(rows, before);
    result[0].entries[0].definition = 'changed'; assert.equal(rows[0].definition, '解释一');
});

test('grouping treats special keys and markup as ordinary data without coercing malformed values', () => {
    const result = core.groupRows([null, {}, { slang: 12 }, { slang: ' ' }, { slang: '__proto__', definition: '<script>text</script>' },
        { slang: 'constructor', game: {}, definition: null }, { slang: 'a  b' }, { slang: 'a b' }]);
    assert.deepEqual(keys(result), ['__proto__', 'constructor', 'a  b', 'a b']);
    assert.equal(result[0].entries[0].definition, '<script>text</script>');
    assert.deepEqual(result[1].entries[0], { definition: '', gameKey: '', game: '' });
    assert.deepEqual(core.groupRows({}), []);
});

test('sampling avoids the previous batch when possible and fills small pools without duplication or mutation', () => {
    const input = groups(8), original = structuredClone(input), previous = ['0', '1', '2', '3'];
    assert.deepEqual(new Set(keys(core.sampleGroups(input, 4, previous, seeded(1)))), new Set(['4', '5', '6', '7']));
    const sampled = keys(core.sampleGroups(input, 6, new Set(previous), seeded(4)));
    assert.equal(sampled.length, 6); assert.equal(new Set(sampled).size, 6);
    assert.deepEqual(new Set(sampled.slice(0, 4)), new Set(['4', '5', '6', '7']));
    assert.equal(core.sampleGroups([...input, input[0]], 100, keys(input), seeded(1)).length, 8);
    assert.deepEqual(input, original);
    for (const count of [0, -1, NaN, Infinity]) assert.deepEqual(core.sampleGroups(input, count), []);
});

test('injected Fisher–Yates choices generate all six three-item permutations without bias', () => {
    const results = [];
    for (let a = 0; a < 3; a += 1) for (let b = 0; b < 2; b += 1) {
        const values = [(a + .5) / 3, (b + .5) / 2];
        results.push(keys(core.sampleGroups(groups(3), 3, [], () => values.shift())).join(','));
    }
    assert.equal(new Set(results).size, 6);
});

for (const width of [223, 280, 390, 900, 1200]) {
    test(`cloud uses actual long-word dimensions and preserves independent motion clearance at ${width}px`, () => {
        const padding = width < 600 ? 16 : 32, available = width - 2 * padding;
        const cards = Array.from({ length: width < 600 ? 12 : 30 }, (_, index) => ({ id: `word-${index}`,
            width: index % 7 === 0 ? available : Math.min(available, 44 + index * 43 % 210),
            height: index % 7 === 0 ? 84 : 30 + index * 7 % 24 }));
        const original = structuredClone(cards), options = { padding, seed: 'cloud-2026' };
        const layout = core.layoutCloud(cards, width, options);
        assert.deepEqual(layout.items.map(({ id, width, height }) => ({ id, width, height })), cards);
        assert.ok(layout.height >= 560); assertSafe(layout, width);
        assert.deepEqual(core.layoutCloud(cards, width, options), layout);
        core.layoutCloud(cards, width + 40, options);
        assert.deepEqual(core.layoutCloud(cards, width, options), layout);
        assert.deepEqual(cards, original);
    });
}

test('same-height desktop words form an ellipse with varied coordinates rather than repeated rows or columns', () => {
    const cards = Array.from({ length: 30 }, (_, index) => ({ id: index, width: 76, height: 32 }));
    const width = 1200, padding = 32, result = core.layoutCloud(cards, width, { seed: 7 });
    assert.equal(new Set(result.items.map(card => card.y.toFixed(3))).size, cards.length);
    assert.ok(new Set(result.items.map(card => card.x.toFixed(3))).size > cards.length * .9);
    for (const card of result.items) {
        const nx = (card.x + card.width / 2 - width / 2) / ((width - padding * 2 - card.width) / 2);
        const ny = (card.y + card.height / 2 - result.height / 2) / ((result.height - padding * 2 - card.height) / 2);
        assert.ok(nx * nx + ny * ny <= 1 + 1e-8);
    }
    const byY = [...result.items].sort((a, b) => a.y - b.y);
    assert.ok(new Set(byY.slice(1).map((card, index) => (card.y - byY[index].y).toFixed(1))).size > 15);
    assert.notDeepEqual(core.layoutCloud(cards, width, { seed: 8 }), result);
    assertSafe(result, width);
});

test('real 948px browser measurements fit thirty 49px-high words into a compact natural cloud', () => {
    const widths = [74,103,74,123,79,123,99,99,123,99,74,99,74,99,74,74,123,74,123,74,99,99,79,74,99,197,74,74,148,74];
    const cards = widths.map((width, id) => ({ id, width, height: 49 }));
    for (const seed of [1, 2, 7, 8, 'browser-qa', '英文词条']) {
        const result = core.layoutCloud(cards, 948, { motion: 8, gap: 8, seed });
        assert.ok(result.height >= 560 && result.height <= 650, `unexpected cloud height ${result.height} for ${seed}`);
        assert.equal(result.items.length, 30);
        assert.deepEqual(result.items.map(({ id, width, height }) => ({ id, width, height })), cards);
        assert.equal(new Set(result.items.map(card => card.y.toFixed(3))).size, 30);
        assertSafe(result, 948, 8, 8);
    }
});

test('real 289px mobile measurements spread laterally and fit twelve words below 600px', () => {
    const widths = [58,64,64,84,104,104,104,64,84,64,84,64];
    const cards = widths.map((width, id) => ({ id, width, height: 44 }));
    for (const seed of [0, 1, 2, 3, 7, 19, 39, 'root-mobile', '手机黑话']) {
        const result = core.layoutCloud(cards, 289, { minHeight: 500, padding: 16, motion: 6, gap: 8, seed });
        const centers = result.items.map(card => card.x + card.width / 2);
        assert.ok(result.height >= 500 && result.height <= 600, `mobile height ${result.height} for ${seed}`);
        assert.ok(Math.max(...centers) - Math.min(...centers) >= 120);
        assert.ok(centers.filter(x => x < 144.5 - 20).length >= 4);
        assert.ok(centers.filter(x => x > 144.5 + 20).length >= 4);
        assert.ok(centers.filter(x => Math.abs(x - 144.5) <= 20).length <= 3);
        assert.equal(new Set(result.items.map(card => card.y.toFixed(3))).size, 12);
        assert.deepEqual(result.items.map(({ id, width, height }) => ({ id, width, height })), cards);
        assert.deepEqual(core.layoutCloud(cards, 289, { minHeight: 500, padding: 16, motion: 6, gap: 8, seed }), result);
        assertSafe(result, 289, 6, 8);
    }
});

test('multiple full-width words and a very tall word expand the cloud without dropping or distorting measurements', () => {
    const width = 223, cards = Array.from({ length: 12 }, (_, index) => ({ id: index, width: 191, height: index === 0 ? 1200 : 60 + index * 7 }));
    const result = core.layoutCloud(cards, width, { minHeight: 100, padding: 16, seed: 'long-terms' });
    assert.equal(result.items.length, cards.length);
    assert.ok(result.height > 1200 + 32);
    assert.deepEqual(result.items.map(({ id, width, height }) => ({ id, width, height })), cards);
    assertSafe(result, width);
});

test('single-word and empty clouds stay bounded; unusable measurements request a remeasure', () => {
    assert.deepEqual(core.layoutCloud([], 0), { items: [], height: 0 });
    const result = core.layoutCloud([{ id: 'a', width: 120, height: 90 }], 280);
    assert.equal(result.items[0].x, 80); assert.equal(result.items[0].y, 235); assert.equal(result.height, 560);
    assertSafe(result, 280);
    assert.throws(() => core.layoutCloud([{ id: 'a', width: 400, height: 20 }], 280), RangeError);
    assert.throws(() => core.layoutCloud([{ id: 'a', width: 40, height: 20 }], 0), RangeError);
    const reducedPadding = core.layoutCloud([{ id: 'a', width: 80, height: 30 }], 223, { padding: 0, motion: 8, gap: 0 });
    assertSafe(reducedPadding, 223, 8, 0);
});

test('fractional dimensions and custom motion/gap options keep every pair collision-safe', () => {
    const rng = seeded(431);
    for (let run = 0; run < 30; run += 1) {
        const width = 223 + rng() * 977, padding = 16 + rng() * 20, motion = rng() * 12, gap = rng() * 22;
        const cards = Array.from({ length: 12 }, (_, id) => ({ id, width: Math.min(width - padding * 2, 30 + rng() * 280), height: 20 + rng() * 100 }));
        const result = core.layoutCloud(cards, width, { padding, motion, gap, seed: run });
        assert.equal(result.items.length, cards.length); assertSafe(result, width, motion, gap);
    }
});

test('nearest selection measures distance to the rectangle, respects an inclusive finite radius and resolves ties stably', () => {
    const items = [{ id: 'long', x: 10, y: 10, width: 200, height: 40 }, { id: 'short', x: 230, y: 10, width: 40, height: 40 }];
    assert.equal(core.nearestCard({ x: 205, y: 30 }, items, 0), 'long');
    assert.equal(core.nearestCard({ x: 220, y: 30 }, items, 10), 'long');
    assert.equal(core.nearestCard({ x: 220, y: 30 }, items, 9), null);
    assert.equal(core.nearestCard({ x: 221, y: 30 }, items, 10), 'short');
    assert.equal(core.nearestCard({ x: 213, y: 54 }, [items[0]], 5), 'long');
    assert.equal(core.nearestCard({ x: 213, y: 54 }, [items[0]], 4.99), null);
    for (const radius of [-1, Infinity, NaN, '80']) assert.equal(core.nearestCard({ x: 20, y: 20 }, items, radius), null);
    assert.equal(core.nearestCard({ x: NaN, y: 20 }, items), null);
    assert.equal(core.nearestCard({ x: 20, y: 20 }, []), null);
});

test('popover flips and clamps at all edges, including content much taller than the viewport', () => {
    for (const width of [223, 390, 1200]) for (const x of [-100, 0, width - 30, width + 100]) for (const y of [-100, 0, 690, 900]) {
        for (const height of [90, 9000]) {
            const size = { width: Math.min(width - 24, 320), height }, result = core.placePopover({ x, y, width: 30, height: 40 }, size, { width, height: 720 });
            assert.ok(result.x >= 12 && result.x + size.width <= width - 12 + 1e-8);
            assert.ok(result.y >= 12 && result.y + Math.min(size.height, result.maxHeight) <= 708 + 1e-8);
            if (height === 9000) assert.equal(result.maxHeight, 696);
        }
    }
});

test('classic browser script exports the complete API without DOM access or dependencies', () => {
    const source = readFileSync(new URL('../assets/word-scanner-core.js', import.meta.url), 'utf8');
    const sandbox = { window: {} }; vm.createContext(sandbox); vm.runInContext(source, sandbox);
    assert.deepEqual(Object.keys(sandbox.window.WordScannerCore), Object.keys(core));
    assert.equal(sandbox.window.WordScannerCore.groupRows([{ slang: ' LOL ' }])[0].key, 'lol');
    assert.equal(sandbox.window.WordScannerCore.layoutCloud([{ id: 'one', width: 80, height: 30 }], 390).items.length, 1);
});
