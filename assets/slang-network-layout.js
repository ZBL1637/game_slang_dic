/* Deterministic, DOM-free layout for the supplied co-occurrence network. */
(function (global) {
  'use strict';
  const GENERIC = new Set(['游戏', '玩家']);
  const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const compare = (a, b) => String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
  const generic = node => GENERIC.has(String(node.name || node.id));
  const round = value => Math.round(value * 1000) / 1000;
  function hash(value) {
    let state = 2166136261;
    for (const character of String(value)) { state ^= character.codePointAt(0); state = Math.imul(state, 16777619); }
    return state >>> 0;
  }
  function unit(value) { return hash(value) / 4294967296; }

  function normalizedGraph(input) {
    if (!input || !Array.isArray(input.nodes) || !Array.isArray(input.links)) throw new TypeError('Expected graph.nodes and graph.links arrays');
    const ids = new Set();
    const nodes = input.nodes.filter(node => {
      if (!node || node.id == null || ids.has(node.id)) return false;
      ids.add(node.id); return true;
    }).map(node => ({ ...node }));
    const links = input.links.filter(link => link && ids.has(link.source) && ids.has(link.target) && link.source !== link.target)
      .map(link => ({ ...link, value: Math.max(0, finite(link.value)) }));
    return { nodes, links };
  }
  function focusGraph(input, focusId) {
    const graph = normalizedGraph(input);
    if (focusId == null || !graph.nodes.some(node => node.id === focusId)) return graph;
    const ids = new Set([focusId]);
    graph.links.forEach(link => { if (link.source === focusId) ids.add(link.target); if (link.target === focusId) ids.add(link.source); });
    return { nodes: graph.nodes.filter(node => ids.has(node.id)), links: graph.links.filter(link => ids.has(link.source) && ids.has(link.target)) };
  }

  // Groups are connected by real edges. Their bounded size only affects geometry;
  // they are deliberately not exposed as semantic communities or new relations.
  function connectedGroups(graph, limit = 12) {
    const ordinary = graph.nodes.filter(node => !generic(node)).sort((a, b) => compare(a.id, b.id));
    const parents = new Map(ordinary.map(node => [node.id, node.id]));
    const members = new Map(ordinary.map(node => [node.id, [node]]));
    function root(id) { while (parents.get(id) !== id) id = parents.get(id); return id; }
    const edges = graph.links.filter(link => parents.has(link.source) && parents.has(link.target))
      .sort((a, b) => b.value - a.value || compare([a.source, a.target].sort(compare).join('\u0000'), [b.source, b.target].sort(compare).join('\u0000')));
    for (const edge of edges) {
      let a = root(edge.source), b = root(edge.target);
      if (a === b || members.get(a).length + members.get(b).length > limit) continue;
      if (compare(a, b) > 0) [a, b] = [b, a];
      parents.set(b, a); members.set(a, members.get(a).concat(members.get(b))); members.delete(b);
    }
    const groups = [...members.values()].map(nodes => nodes.sort((a, b) => finite(b.value) - finite(a.value) || compare(a.id, b.id)));
    return groups.sort((a, b) => b.length - a.length || compare(a[0].id, b[0].id));
  }

  function estimateLabelWidth(text, fontSize = 12) {
    let units = 0;
    for (const character of String(text)) {
      if (/\s/u.test(character)) units += .34;
      else if (/[^\u0000-\u00ff]/u.test(character)) units += 1;
      else if (/[MW@#%]/.test(character)) units += .88;
      else if (/[ilItf.,:;'!|]/.test(character)) units += .36;
      else if (/[A-Z0-9]/.test(character)) units += .65;
      else units += .59;
    }
    // Include a small reserve for font fallback, weight and antialiasing.
    return Math.ceil(units * fontSize + 5);
  }
  function labelRect(point, position, fontSize) {
    const width = estimateLabelWidth(point.name || point.id, fontSize), height = Math.ceil(fontSize * 1.3 + 3);
    const radius = point.nodeRadius || 6.5, gap = 7;
    let x = point.x - width / 2, y = point.y - height / 2;
    if (position === 'right') x = point.x + radius + gap;
    else if (position === 'left') x = point.x - radius - gap - width;
    else if (position === 'top') y = point.y - radius - gap - height;
    else y = point.y + radius + gap;
    return { x, y, width, height };
  }
  function rectanglesOverlap(a, b, gap = 3) {
    return a.x < b.x + b.width + gap && a.x + a.width + gap > b.x && a.y < b.y + b.height + gap && a.y + a.height + gap > b.y;
  }
  function circleTouchesRect(point, rect, gap = 2) {
    const x = Math.max(rect.x, Math.min(point.x, rect.x + rect.width));
    const y = Math.max(rect.y, Math.min(point.y, rect.y + rect.height));
    return Math.hypot(point.x - x, point.y - y) < point.nodeRadius + gap;
  }

  function nodeRadius(node, minimum, maximum, focusId) {
    if (node.id === focusId) return 9.5;
    if (focusId == null && generic(node)) return 4;
    const low = Math.log1p(Math.max(0, minimum)), high = Math.log1p(Math.max(0, maximum));
    const ratio = high > low ? (Math.log1p(Math.max(0, finite(node.value))) - low) / (high - low) : .5;
    return 2.5 + Math.max(0, Math.min(1, ratio)) * 4;
  }
  function fit(points, width, height, inset, focusId) {
    if (!points.length) return;
    const center = points.find(point => point.id === focusId);
    if (center) {
      const centerX = center.x, centerY = center.y;
      const reachX = Math.max(...points.map(point => Math.abs(point.x - centerX)));
      const reachY = Math.max(...points.map(point => Math.abs(point.y - centerY)));
      points.forEach(point => {
        point.x = width / 2 + (point.x - centerX) / (reachX || 1) * (width / 2 - inset);
        point.y = height / 2 + (point.y - centerY) / (reachY || 1) * (height / 2 - inset);
      });
      return;
    }
    const xs = points.map(point => point.x), ys = points.map(point => point.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    points.forEach(point => {
      point.x = maxX === minX ? width / 2 : inset + (point.x - minX) / (maxX - minX) * (width - inset * 2);
      point.y = maxY === minY ? height / 2 : inset + (point.y - minY) / (maxY - minY) * (height - inset * 2);
    });
  }
  function separate(points, width, height, mobile, focusId) {
    const clearance = mobile ? 5 : 9, inset = mobile ? 16 : 22;
    // Free displacement, followed by a whole-cloud fit, avoids pinning many
    // independent points to identical rectangular boundary coordinates.
    for (let cycle = 0; cycle < 3; cycle++) {
      for (let step = 0; step < 45; step++) {
        let moved = false;
        for (let i = 0; i < points.length; i++) for (let j = i + 1; j < points.length; j++) {
          const a = points[i], b = points[j]; let dx = b.x - a.x, dy = b.y - a.y;
          if (Math.abs(dx) + Math.abs(dy) < .0001) { const angle = unit(`${a.id}/${b.id}`) * Math.PI * 2; dx = Math.cos(angle) * .01; dy = Math.sin(angle) * .01; }
          const distance = Math.hypot(dx, dy), needed = a.nodeRadius + b.nodeRadius + clearance;
          if (distance >= needed) continue;
          const shift = (needed - distance) / distance * .505;
          a.x -= dx * shift; a.y -= dy * shift; b.x += dx * shift; b.y += dy * shift; moved = true;
        }
        if (!moved) break;
      }
      fit(points, width, height, inset, focusId);
    }
  }

  function overviewPositions(graph, width, height, mobile) {
    const groups = connectedGroups(graph, mobile ? 9 : 12), area = width * height;
    const groupCenters = [], points = [], count = Math.max(1, graph.nodes.length);
    const aspect = width / height, stretchX = Math.sqrt(aspect), stretchY = 1 / stretchX;
    for (const group of groups) {
      const radius = Math.sqrt(area * group.length / count / Math.PI) * .54;
      let best = null, bestScore = Infinity;
      // Low-discrepancy candidates fill an ellipse without imposing rings or a grid.
      for (let candidate = 0; candidate < 180; candidate++) {
        const angle = candidate * 2.3999632297 + unit(group[0].id) * Math.PI * 2;
        const reach = Math.sqrt((candidate + .5) / 180);
        const x = width / 2 + Math.cos(angle) * reach * width * .405;
        const y = height / 2 + Math.sin(angle) * reach * height * .39;
        let score = reach * reach * .18;
        for (const center of groupCenters) {
          const distance = Math.hypot((x - center.x) / stretchX, (y - center.y) / stretchY);
          const needed = radius + center.radius + 9;
          const overlap = Math.max(0, needed - distance);
          score += overlap * overlap / (needed * needed) * 100;
          score += needed * .015 / (distance + 1);
        }
        if (score < bestScore) { bestScore = score; best = { x, y, radius, id: group[0].id }; }
      }
      groupCenters.push(best);
      const local = group.map((node, index) => {
        const angle = index * 2.3999632297 + unit(node.id) * .75;
        const distance = group.length === 1 ? 0 : radius * Math.sqrt((index + .35) / group.length) * .86;
        return { ...node, x: Math.cos(angle) * distance * stretchX, y: Math.sin(angle) * distance * stretchY };
      });
      const ids = new Map(local.map((point, index) => [point.id, index]));
      const edges = graph.links.filter(link => ids.has(link.source) && ids.has(link.target));
      // Only within-group real edges attract. Generic hubs cannot collapse the
      // entire network into a star; cross-group connections remain visible edges.
      const ideal = Math.sqrt(area / count) * .53;
      for (let step = 0; step < 35; step++) {
        const offsets = local.map(() => ({ x: 0, y: 0 }));
        for (let a = 0; a < local.length; a++) for (let b = a + 1; b < local.length; b++) {
          const dx = local[b].x - local[a].x, dy = local[b].y - local[a].y, distance = Math.hypot(dx, dy) || 1;
          const strength = Math.min(5, ideal * ideal / (distance * distance)) * .75;
          offsets[a].x -= dx / distance * strength; offsets[a].y -= dy / distance * strength;
          offsets[b].x += dx / distance * strength; offsets[b].y += dy / distance * strength;
        }
        for (const edge of edges) {
          const a = ids.get(edge.source), b = ids.get(edge.target), dx = local[b].x - local[a].x, dy = local[b].y - local[a].y;
          const distance = Math.hypot(dx, dy) || 1, strength = (distance - ideal) * .02;
          offsets[a].x += dx / distance * strength; offsets[a].y += dy / distance * strength;
          offsets[b].x -= dx / distance * strength; offsets[b].y -= dy / distance * strength;
        }
        local.forEach((point, index) => { point.x += offsets[index].x; point.y += offsets[index].y; });
      }
      for (const point of local) { point.x += best.x; point.y += best.y; points.push(point); }
    }
    const placed = new Map(points.map(point => [point.id, point]));
    graph.nodes.filter(generic).sort((a, b) => compare(a.id, b.id)).forEach((node, index) => {
      const neighbors = graph.links.filter(link => link.source === node.id || link.target === node.id)
        .map(link => placed.get(link.source === node.id ? link.target : link.source)).filter(Boolean);
      const x = neighbors.length ? neighbors.reduce((sum, point) => sum + point.x, 0) / neighbors.length : width * .5;
      const y = neighbors.length ? neighbors.reduce((sum, point) => sum + point.y, 0) / neighbors.length : height * .5;
      points.push({ ...node, x: x + (index ? 1 : -1) * width * .08, y: y + (index ? -.1 : .1) * height });
    });
    return points;
  }

  function focusPositions(graph, focusId, width, height, phase = 0) {
    const center = graph.nodes.find(node => node.id === focusId), neighbors = graph.nodes.filter(node => node.id !== focusId);
    if (!center) return overviewPositions(graph, width, height, width < 420);
    const weight = new Map(graph.links.map(link => [link.source === focusId ? link.target : link.source, finite(link.value)]));
    neighbors.sort((a, b) => (weight.get(b.id) || 0) - (weight.get(a.id) || 0) || compare(a.id, b.id));
    const points = [{ ...center, x: width / 2, y: height / 2 }];
    // An open elliptical fan leaves the central word readable, with mild radial
    // variation instead of a perfectly regular wheel.
    neighbors.forEach((node, index) => {
      const angle = -Math.PI / 2 + phase + index / Math.max(1, neighbors.length) * Math.PI * 2 + (unit(node.id) - .5) * .08;
      const distance = .8 + unit(`${node.id}/focus`) * .16;
      points.push({ ...node, x: width / 2 + Math.cos(angle) * width * .36 * distance, y: height / 2 + Math.sin(angle) * height * .39 * distance });
    });
    return points;
  }

  function applyLabels(points, graph, width, height, mobile, focusId) {
    const degrees = new Map(points.map(point => [point.id, 0]));
    graph.links.forEach(link => { if (degrees.has(link.source)) degrees.set(link.source, degrees.get(link.source) + 1); if (degrees.has(link.target)) degrees.set(link.target, degrees.get(link.target) + 1); });
    const focused = points.some(point => point.id === focusId), budget = focused ? points.length : mobile ? 14 : 36;
    const priority = point => {
      const text = String(point.name || point.id), length = [...text].length;
      return (point.id === focusId ? 10000 : 0) + (length >= 2 && length <= 5 ? 120 : length === 1 ? -200 : 25)
        + (/[^\u0000-\u00ff]/u.test(text) ? 30 : 0) + (['氪金', '开荒', '辅助'].includes(text) ? 35 : 0)
        + Math.min(20, degrees.get(point.id) || 0) * 2 + Math.log1p(Math.max(0, finite(point.value)))
        - (generic(point) ? 500 : 0);
    };
    const ordered = [...points].sort((a, b) => priority(b) - priority(a) || compare(a.id, b.id));
    const selected = [];
    for (const point of ordered) {
      point.labelShow = false; point.labelFontSize = point.id === focusId ? (mobile ? 15 : 17) : mobile ? 11 : 12;
      if (selected.length >= budget) continue;
      const start = { x: point.x, y: point.y }, shifts = [{ x: 0, y: 0 }];
      // Give a useful word a little room before hiding it. Moving the dot and
      // its incident real edges together keeps labels attached and truthful.
      if (!focused) for (const distance of [mobile ? 9 : 12, mobile ? 17 : 22]) {
        for (let direction = 0; direction < 8; direction++) shifts.push({ x: Math.cos(direction * Math.PI / 4) * distance, y: Math.sin(direction * Math.PI / 4) * distance });
      }
      for (const shift of shifts) {
        point.x = round(start.x + shift.x); point.y = round(start.y + shift.y);
        if (point.x - point.nodeRadius < 6 || point.y - point.nodeRadius < 6
          || point.x + point.nodeRadius > width - 6 || point.y + point.nodeRadius > height - 6) continue;
        if ((shift.x || shift.y) && (points.some(other => other !== point
          && Math.hypot(point.x - other.x, point.y - other.y) < point.nodeRadius + other.nodeRadius + 3)
          || selected.some(other => circleTouchesRect(point, other.labelBounds)))) continue;
        const side = point.x < width / 2 ? ['right', 'left'] : ['left', 'right'];
        const positions = [...side, point.y < height / 2 ? 'bottom' : 'top', point.y < height / 2 ? 'top' : 'bottom'];
        for (const position of positions) {
          const rect = labelRect(point, position, point.labelFontSize);
          if (rect.x < 5 || rect.y < 5 || rect.x + rect.width > width - 5 || rect.y + rect.height > height - 5) continue;
          if (selected.some(other => rectanglesOverlap(rect, other.labelBounds))) continue;
          if (points.some(other => other !== point && circleTouchesRect(other, rect))) continue;
          point.labelShow = true; point.labelPosition = position;
          point.labelBounds = { x: round(rect.x), y: round(rect.y), width: rect.width, height: rect.height };
          selected.push(point); break;
        }
        if (point.labelShow) break;
      }
      if (!point.labelShow) { point.x = start.x; point.y = start.y; }
    }
  }

  function layout(input, settings = {}) {
    const width = finite(settings.width, 900), height = finite(settings.height, 440);
    if (width < 80 || height < 100) throw new RangeError('Layout requires width >= 80 and height >= 100');
    const mobile = settings.mobile == null ? width < 420 : Boolean(settings.mobile);
    const graph = settings.focusId == null ? normalizedGraph(input) : focusGraph(input, settings.focusId);
    if (!graph.nodes.length) return [];
    const minimum = Math.min(...graph.nodes.map(node => finite(node.value))), maximum = Math.max(...graph.nodes.map(node => finite(node.value)));
    const focused = settings.focusId != null && graph.nodes.some(node => node.id === settings.focusId);
    const arrange = phase => {
      const result = focused ? focusPositions(graph, settings.focusId, width, height, phase) : overviewPositions(graph, width, height, mobile);
      result.forEach(point => { point.nodeRadius = nodeRadius(point, minimum, maximum, settings.focusId); });
      fit(result, width, height, mobile ? 18 : 28, focused ? settings.focusId : undefined);
      separate(result, width, height, mobile, focused ? settings.focusId : undefined);
      result.forEach(point => { point.x = round(point.x); point.y = round(point.y); });
      applyLabels(result, graph, width, height, mobile, settings.focusId);
      return result;
    };
    let points = arrange(0);
    // A few deterministic alternatives allow a long neighbor label to move
    // away from a crowded flank. No timer or ongoing force simulation is used.
    if (focused && graph.nodes.length <= 24) {
      let visible = points.filter(point => point.labelShow).length;
      for (const phase of [.15, -.15, .3, -.3, .45, -.45, .6]) {
        if (visible === points.length) break;
        const candidate = arrange(phase), count = candidate.filter(point => point.labelShow).length;
        if (count > visible) { points = candidate; visible = count; }
      }
    }
    const byId = new Map(points.map(point => [point.id, point]));
    return graph.nodes.map(node => byId.get(node.id));
  }

  const api = Object.freeze({ layout, connectedGroups, focusGraph, estimateLabelWidth, rectanglesOverlap });
  if (typeof module === 'object' && module.exports) module.exports = api;
  global.GameSlangNetworkLayout = api;
})(typeof window !== 'undefined' ? window : globalThis);
