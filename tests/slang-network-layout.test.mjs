import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const model = require('../assets/slang-network-layout.js');
const [source, text] = await Promise.all([
  fs.readFile(new URL('../assets/slang-network-layout.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../assets/data/graph_data.json', import.meta.url), 'utf8')
]);
const raw = JSON.parse(text);
const edgeKey = edge => [edge.source, edge.target].sort().join('\u0000');

// Reproduce the documented input independently of the UI module, which is
// intentionally not loaded by these geometry tests.
function suppliedGraph() {
  const adjacency = new Map(raw.nodes.map(node => [node.id, []]));
  for (const edge of raw.links.filter(edge => edge.value >= 24)) {
    adjacency.get(edge.source)?.push(edge); adjacency.get(edge.target)?.push(edge);
  }
  const chosen = new Set();
  for (const edges of adjacency.values()) edges.sort((a, b) => b.value - a.value).slice(0, 1).forEach(edge => chosen.add(edge));
  const active = new Set([...chosen].flatMap(edge => [edge.source, edge.target]));
  const nodes = raw.nodes.filter(node => active.has(node.id) && node.value >= 140).sort((a, b) => b.value - a.value).slice(0, 96);
  const ids = new Set(nodes.map(node => node.id));
  const base = [...chosen].filter(edge => ids.has(edge.source) && ids.has(edge.target)).sort((a, b) => b.value - a.value).slice(0, 140);
  const sourceLinks = raw.links.filter(edge => ids.has(edge.source) && ids.has(edge.target) && edge.value >= 24 && edge.source !== edge.target);
  const links = new Map(base.map(edge => [edgeKey(edge), edge]));
  for (const node of nodes) {
    if (['游戏', '玩家'].includes(node.id)) continue;
    const strongest = sourceLinks.filter(edge => (edge.source === node.id || edge.target === node.id)
      && !['游戏', '玩家'].includes(edge.source) && !['游戏', '玩家'].includes(edge.target)).sort((a, b) => b.value - a.value)[0];
    if (strongest) links.set(edgeKey(strongest), strongest);
  }
  return { nodes, links: [...links.values()], sourceLinks };
}
const graph = suppliedGraph();
const clone = value => JSON.parse(JSON.stringify(value));
const mobile = { width: 260, height: 430, mobile: true };
const desktop = { width: 900, height: 440, mobile: false };

function checkGeometry(points, size) {
  const labels = points.filter(point => point.labelShow);
  for (const point of points) {
    assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y), `finite coordinates: ${point.id}`);
    assert.ok(point.x - point.nodeRadius >= 0 && point.x + point.nodeRadius <= size.width, `node horizontal bounds: ${point.id}`);
    assert.ok(point.y - point.nodeRadius >= 0 && point.y + point.nodeRadius <= size.height, `node vertical bounds: ${point.id}`);
  }
  for (let i = 0; i < points.length; i++) for (let j = i + 1; j < points.length; j++) {
    assert.ok(Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y) > points[i].nodeRadius + points[j].nodeRadius + 2,
      `separate dots: ${points[i].id}/${points[j].id}`);
  }
  for (const point of labels) {
    const rect = point.labelBounds;
    assert.ok(rect && ['left', 'right', 'top', 'bottom'].includes(point.labelPosition));
    assert.ok(rect.x >= 4.9 && rect.y >= 4.9 && rect.x + rect.width <= size.width - 4.9 && rect.y + rect.height <= size.height - 4.9,
      `label bounds: ${point.id}`);
    for (const other of points) {
      if (other.id === point.id) continue;
      const x = Math.max(rect.x, Math.min(other.x, rect.x + rect.width));
      const y = Math.max(rect.y, Math.min(other.y, rect.y + rect.height));
      assert.ok(Math.hypot(other.x - x, other.y - y) >= other.nodeRadius + 1.9, `label/dot collision: ${point.id}/${other.id}`);
    }
  }
  for (let i = 0; i < labels.length; i++) for (let j = i + 1; j < labels.length; j++) {
    assert.equal(model.rectanglesOverlap(labels[i].labelBounds, labels[j].labelBounds, 2.9), false,
      `label collision: ${labels[i].id}/${labels[j].id}`);
  }
}

test('classic and CommonJS APIs load without document, timers, ECharts or network access', () => {
  const context = { window: {} }; vm.createContext(context); vm.runInContext(source, context);
  assert.equal(typeof context.window.GameSlangNetworkLayout.layout, 'function');
  assert.equal(typeof model.layout, 'function');
  assert.deepEqual(clone(context.window.GameSlangNetworkLayout.layout({ nodes: [], links: [] })), []);
  assert.equal(Object.keys(context).join(','), 'window');
});

test('the real input fixture has 96 original nodes and 149 sourced edges; layout preserves data and input order', () => {
  assert.equal(graph.nodes.length, 96); assert.equal(graph.links.length, 149);
  const before = JSON.stringify(graph), points = model.layout(graph, desktop);
  assert.equal(JSON.stringify(graph), before);
  assert.deepEqual(points.map(point => point.id), graph.nodes.map(node => node.id));
  for (const point of points) {
    const original = graph.nodes.find(node => node.id === point.id);
    for (const [key, value] of Object.entries(original)) assert.deepEqual(point[key], value);
  }
});

for (const size of [desktop, mobile, { width: 600, height: 440, mobile: false }, { width: 220, height: 430, mobile: true }]) {
  test(`overview ${size.width}×${size.height} is repeatable, bounded, legible and collision-free`, () => {
    const points = model.layout(graph, size);
    assert.deepEqual(points, model.layout(graph, size));
    checkGeometry(points, size);
    const labels = points.filter(point => point.labelShow);
    assert.ok(labels.length >= (size.mobile ? 12 : 30));
    assert.ok(labels.length <= (size.mobile ? 16 : 40));
    assert.equal(new Set(points.map(point => `${point.x}/${point.y}`)).size, 96);
    // A free whole-cloud fit may put one extreme on an inset, but cannot pile
    // many nodes into straight boundary rows as per-node clamping used to do.
    const minY = Math.min(...points.map(point => point.y));
    assert.ok(points.filter(point => Math.abs(point.y - minY) < .5).length <= 3);
    const quadrants = [0, 0, 0, 0];
    for (const point of points) quadrants[(point.x < size.width / 2 ? 0 : 1) + (point.y < size.height / 2 ? 0 : 2)]++;
    assert.ok(quadrants.every(count => count >= 10), `distributed quadrants: ${quadrants}`);
    assert.ok(points.filter(point => Math.abs(point.x - size.width / 2) < size.width * .15
      && Math.abs(point.y - size.height / 2) < size.height * .15).length < 24, 'center must not swallow the majority');
  });
}

test('default labels prefer readable multi-character terms over generic hubs or one-letter terms', () => {
  for (const size of [desktop, mobile]) {
    const shown = new Set(model.layout(graph, size).filter(point => point.labelShow).map(point => point.name));
    for (const term of ['氪金', '开荒', '辅助']) assert.ok(shown.has(term), `${term} is useful at ${size.width}`);
    for (const term of ['游戏', '玩家', '火', 't']) assert.equal(shown.has(term), false);
  }
});

test('geometric groups are connected by actual non-generic edges and cannot merge through a generic hub', () => {
  const nodes = ['游戏', '玩家', 'a', 'b', 'c', 'd', 'e'].map(id => ({ id, name: id, value: 200 }));
  const links = [{ source: '游戏', target: 'a', value: 1000 }, { source: '游戏', target: 'c', value: 1000 },
    { source: 'a', target: 'b', value: 50 }, { source: 'c', target: 'd', value: 40 }];
  const groups = model.connectedGroups({ nodes, links }, 3).map(group => group.map(node => node.id).sort());
  assert.deepEqual(groups, [['a', 'b'], ['c', 'd'], ['e']]);
  const actual = new Set(graph.links.map(edgeKey));
  for (const group of model.connectedGroups(graph, 12)) {
    assert.ok(group.length <= 12);
    assert.ok(group.every(node => !['游戏', '玩家'].includes(node.id)));
    const visited = new Set([group[0].id]), ids = new Set(group.map(node => node.id));
    let changed = true;
    while (changed) {
      changed = false;
      for (const edge of graph.links) if (ids.has(edge.source) && ids.has(edge.target) && (visited.has(edge.source) || visited.has(edge.target))) {
        const before = visited.size; visited.add(edge.source); visited.add(edge.target); changed ||= before !== visited.size;
        assert.ok(actual.has(edgeKey(edge)));
      }
    }
    assert.equal(visited.size, group.length);
  }
});

test('all 96 real focus views show their center and up to 12 actual neighbors without overlapping labels', () => {
  for (const size of [desktop, mobile]) for (const center of graph.nodes) {
    const neighbors = graph.sourceLinks.filter(edge => edge.source === center.id || edge.target === center.id)
      .sort((a, b) => b.value - a.value).slice(0, 12);
    const ids = new Set([center.id, ...neighbors.flatMap(edge => [edge.source, edge.target])]);
    const focused = { nodes: graph.nodes.filter(node => ids.has(node.id)), links: neighbors };
    const points = model.layout(focused, { ...size, focusId: center.id });
    assert.equal(points.length, focused.nodes.length);
    assert.equal(points.filter(point => point.labelShow).length, points.length, `all labels: ${center.id}/${size.width}`);
    const selected = points.find(point => point.id === center.id);
    assert.equal(selected.x, size.width / 2); assert.equal(selected.y, size.height / 2);
    assert.equal(selected.labelFontSize, size.mobile ? 15 : 17);
    checkGeometry(points, size);
  }
});

test('focus selection keeps only true one-hop nodes and does not change source data', () => {
  const input = { nodes: ['A', 'B', 'C', 'D'].map(id => ({ id, name: `${id}词`, value: 200 })),
    links: [{ source: 'A', target: 'B', value: 24 }, { source: 'B', target: 'C', value: 50 }] };
  const original = JSON.stringify(input), focused = model.layout(input, { ...mobile, focusId: 'A' });
  assert.deepEqual(focused.map(point => point.id), ['A', 'B']);
  assert.ok(focused.every(point => point.labelShow)); checkGeometry(focused, mobile);
  assert.equal(JSON.stringify(input), original);
  assert.equal(model.layout(input, { ...mobile, focusId: 'missing' }).length, 4);
});

test('empty, singleton, long labels and invalid input fail or degrade without invented nodes and coordinates', () => {
  assert.deepEqual(model.layout({ nodes: [], links: [] }), []);
  const singleton = model.layout({ nodes: [{ id: 'x', name: '独立词', value: 200 }], links: [] }, desktop);
  assert.equal(singleton.length, 1); assert.equal(singleton[0].x, 450); assert.equal(singleton[0].y, 220);
  assert.equal(singleton[0].labelShow, true);
  const long = model.layout({ nodes: [{ id: 'long', name: '长'.repeat(80), value: 200 }], links: [] }, mobile);
  assert.equal(long[0].labelShow, false, 'an unfit long label is hidden instead of overflowing');
  assert.throws(() => model.layout({ nodes: [] }), TypeError);
  assert.throws(() => model.layout(graph, { width: 0, height: 400 }), RangeError);
  assert.throws(() => model.layout(graph, { width: 300, height: 10 }), RangeError);
  assert.ok(model.estimateLabelWidth('开荒', 12) > model.estimateLabelWidth('ii', 12));
  assert.ok(model.estimateLabelWidth('开荒', 17) > model.estimateLabelWidth('开荒', 12));
});
