/* Pure scanner helpers. Classic browser script + Node CommonJS; no DOM access.
 * Measure cards at <= width - 2 * padding before layout; oversized measurements
 * throw RangeError so callers can remeasure wrapped text rather than distort it.
 * Static padding includes motion; neighboring rectangles reserve gap + 2 * motion.
 * Free-space packing plus seeded relaxation fills the field without row anchors.
 * maxHeight opts into a fixed field; overflowIds explicitly identifies words that
 * did not fit. Without it, the helper grows rather than discarding input cards.
 * Popover coordinates are viewport-relative. The caller must cap popover width at
 * viewport.width - 2 * inset, and apply returned maxHeight with overflow scrolling.
 */
(() => {
    'use strict';
    const finite = (value, fallback = 0) => typeof value === 'number' && Number.isFinite(value) ? value : fallback;
    const nonnegative = (value, fallback = 0) => Math.max(0, finite(value, fallback));
    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
    const cleanString = value => typeof value === 'string' ? value.trim() : '';

    function groupRows(rows) {
        const groups = new Map();
        if (!Array.isArray(rows)) return [];
        for (const row of rows) {
            if (!row || typeof row !== 'object') continue;
            const term = cleanString(row.slang);
            if (!term) continue;
            const key = term.toLowerCase();
            if (!groups.has(key)) groups.set(key, { key, term, entries: [], seen: new Set() });
            const group = groups.get(key);
            const entry = { definition: cleanString(row.definition), gameKey: cleanString(row.gameKey), game: cleanString(row.game) };
            const signature = JSON.stringify([entry.definition, entry.gameKey, entry.game]);
            if (group.seen.has(signature)) continue;
            group.seen.add(signature);
            group.entries.push(entry);
        }
        return [...groups.values()].map(({ key, term, entries }) => ({ key, term, entries }));
    }

    function sampleGroups(groups, count, previousKeys = [], rng = Math.random) {
        const limit = Math.floor(nonnegative(count));
        if (!limit || !Array.isArray(groups)) return [];
        const previous = new Set(Array.isArray(previousKeys) || previousKeys instanceof Set ? previousKeys : []);
        const random = typeof rng === 'function' ? rng : Math.random;
        const seen = new Set(), fresh = [], repeated = [];
        for (const group of groups) {
            if (!group || typeof group.key !== 'string' || seen.has(group.key)) continue;
            seen.add(group.key);
            (previous.has(group.key) ? repeated : fresh).push(group);
        }
        const shuffle = list => {
            for (let index = list.length - 1; index > 0; index -= 1) {
                const other = Math.min(index, Math.floor(clamp(finite(random()), 0, 1) * (index + 1)));
                [list[index], list[other]] = [list[other], list[index]];
            }
            return list;
        };
        return shuffle(fresh).concat(shuffle(repeated)).slice(0, limit);
    }

    function seedNumber(value) {
        const text = typeof value === 'string' || typeof value === 'number' ? String(value) : '1';
        let hash = 2166136261;
        for (let index = 0; index < text.length; index += 1) hash = Math.imul(hash ^ text.charCodeAt(index), 16777619);
        return hash >>> 0;
    }

    function radicalInverse(value, base) {
        let fraction = 1 / base, result = 0;
        while (value > 0) {
            result += (value % base) * fraction;
            value = Math.floor(value / base);
            fraction /= base;
        }
        return result;
    }

    function layoutCloud(cards, width, options = {}) {
        if (!Array.isArray(cards) || !cards.length) return { items: [], height: 0 };
        const settings = options && typeof options === 'object' ? options : {};
        const containerWidth = nonnegative(width);
        const motion = nonnegative(settings.motion, 8);
        const padding = Math.max(nonnegative(settings.padding, 32), motion);
        const gap = nonnegative(settings.gap, 12), clearance = gap + motion * 2;
        const available = containerWidth - padding * 2;
        if (available <= 0) throw new RangeError('Measure the cloud after its container has usable width.');
        const measured = cards.map((card, index) => {
            const cardWidth = nonnegative(card?.width), cardHeight = nonnegative(card?.height);
            if (cardWidth > available + 1e-7) throw new RangeError('Card exceeds cloud width; cap its CSS width and remeasure.');
            return { id: card?.id, width: Math.min(cardWidth, available), height: cardHeight, index };
        });
        const priority = new Set(settings.priorityIds || []);
        const ordered = [...measured].sort((a, b) => Number(priority.has(b.id)) - Number(priority.has(a.id))
            || b.width * b.height - a.width * a.height || b.width - a.width || a.index - b.index);
        const area = measured.reduce((sum, card) => sum + (card.width + clearance) * (card.height + clearance), 0);
        const fixedHeight = Number.isFinite(settings.maxHeight) && settings.maxHeight > 0;
        let height = fixedHeight ? settings.maxHeight : Math.ceil(Math.max(nonnegative(settings.minHeight, 560),
            Math.max(...measured.map(card => card.height)) + padding * 2,
            area / (available * .78) + padding * 2));
        const hash = seedNumber(settings.seed), phase = hash / 4294967296;
        const separated = (a, b) => a.x + a.width + clearance <= b.x + 1e-7
            || b.x + b.width + clearance <= a.x + 1e-7
            || a.y + a.height + clearance <= b.y + 1e-7
            || b.y + b.height + clearance <= a.y + 1e-7;
        function finish(placed) {
            // Stretch available gaps, not card dimensions, toward all four edges.
            // Expanding coordinate distances preserves every collision constraint.
            if (placed.length === 1) {
                placed[0].x = (containerWidth - placed[0].width) / 2;
                placed[0].y = (height - placed[0].height) / 2;
            } else for (const [axis, dimension, extent] of [['x', 'width', containerWidth], ['y', 'height', height]]) {
                const leading = Math.min(...placed.map(card => card[axis]));
                const factors = placed.filter(card => card[axis] > leading + .001)
                    .map(card => (extent - padding * 2 - card[dimension]) / (card[axis] - leading));
                const scale = factors.length ? Math.max(1, Math.min(...factors)) : 1;
                for (const card of placed) card[axis] = padding + (card[axis] - leading) * scale;
            }
            // Bounded, seeded relaxation breaks packing alignments. This happens
            // only on layout, with full motion clearance checked for each move.
            for (let pass = 0; placed.length > 1 && pass < 3; pass += 1) for (const card of placed) {
                const step = Math.min(26, clearance + gap + 6) / (1 + pass);
                for (let probe = 0; probe < 16; probe += 1) {
                    const sample = 1 + card.index * 53 + pass * 17 + probe + hash % 127;
                    const candidate = { ...card,
                        x: clamp(card.x + (radicalInverse(sample, 2) - .5) * step, padding, containerWidth - padding - card.width),
                        y: clamp(card.y + (radicalInverse(sample, 3) - .5) * step, padding, height - padding - card.height) };
                    if (Math.abs(candidate.x - card.x) + Math.abs(candidate.y - card.y) > .5
                        && placed.every(other => other === card || separated(candidate, other))) { card.x = candidate.x; card.y = candidate.y; break; }
                }
            }
            // Redistribute cards from crowded boundaries into interior holes.
            // The probes measure empty space, not placement slots: all accepted
            // positions remain continuous and retain independent motion clearance.
            if (fixedHeight && placed.length > 2) {
                const columns = Math.min(28, Math.max(6, Math.ceil(available / 40)));
                const rows = Math.min(18, Math.max(6, Math.ceil((height - padding * 2) / 40)));
                const probes = [];
                for (let row = 0; row <= rows; row += 1) for (let column = 0; column <= columns; column += 1) {
                    probes.push({ x: padding + available * column / columns, y: padding + (height - padding * 2) * row / rows });
                }
                const distance = (point, card) => {
                    const dx = point.x < card.x ? card.x - point.x : point.x > card.x + card.width ? point.x - card.x - card.width : 0;
                    const dy = point.y < card.y ? card.y - point.y : point.y > card.y + card.height ? point.y - card.y - card.height : 0;
                    return dx * dx + dy * dy;
                };
                const cost = value => value + value * value / 1600;
                function measure() {
                    for (const point of probes) {
                        point.first = Infinity; point.second = Infinity; point.owner = null;
                        for (const card of placed) {
                            const value = distance(point, card);
                            if (value < point.first) { point.second = point.first; point.first = value; point.owner = card; }
                            else if (value < point.second) point.second = value;
                        }
                        point.cost = cost(point.first);
                    }
                }
                measure();
                for (let pass = 0; pass < 3; pass += 1) {
                    let changes = 0;
                    for (const card of placed) {
                        const holes = [...probes].sort((a, b) => b.first - a.first).slice(0, 12);
                        const candidates = holes.map((point, index) => ({ x: point.x - card.width / 2
                            + (radicalInverse(index + card.index + 1, 2) - .5) * 16,
                        y: point.y - card.height / 2 + (radicalInverse(index + card.index + 1, 3) - .5) * 16 }));
                        for (let probe = 0; probe < 12; probe += 1) {
                            const sample = 1 + hash % 127 + card.index * 17 + pass * 19 + probe;
                            candidates.push({ x: card.x + (radicalInverse(sample, 2) - .5) * 52,
                                y: card.y + (radicalInverse(sample, 3) - .5) * 52 });
                        }
                        let best = null, bestDelta = -1;
                        for (const position of candidates) {
                            const candidate = { ...card, x: clamp(position.x, padding, containerWidth - padding - card.width),
                                y: clamp(position.y, padding, height - padding - card.height) };
                            if (!placed.every(other => other === card || separated(candidate, other))) continue;
                            let delta = 0;
                            for (const point of probes) {
                                const remaining = point.owner === card ? point.second : point.first;
                                const next = distance(point, candidate);
                                delta += cost(next < remaining ? next : remaining) - point.cost;
                            }
                            if (delta < bestDelta) { bestDelta = delta; best = candidate; }
                        }
                        if (best) { card.x = best.x; card.y = best.y; changes += 1; measure(); }
                    }
                    if (!changes) break;
                }
                // A few already-measured, short reserve terms may fill residual
                // holes. They never displace the chosen words or enlarge the field.
                const present = new Set(placed.map(card => card.id));
                const reserves = (Array.isArray(settings.reserveCards) ? settings.reserveCards : [])
                    .filter(card => card && !present.has(card.id) && Number.isFinite(card.width) && Number.isFinite(card.height)
                        && card.width > 0 && card.width <= available && card.height > 0 && card.height <= height - padding * 2)
                    .sort((a, b) => a.width * a.height - b.width * b.height);
                let added = 0, occupied = placed.reduce((sum, card) => sum + card.width * card.height, 0);
                for (const reserve of reserves) {
                    if (present.has(reserve.id)) continue;
                    if (added >= 4 || occupied + reserve.width * reserve.height > containerWidth * height * .5) break;
                    let best = null, gain = 0;
                    for (const point of probes) {
                        const candidate = { id: reserve.id, width: reserve.width, height: reserve.height,
                            index: measured.length + added,
                            x: clamp(point.x - reserve.width / 2, padding, containerWidth - padding - reserve.width),
                            y: clamp(point.y - reserve.height / 2, padding, height - padding - reserve.height) };
                        if (!placed.every(other => separated(candidate, other))) continue;
                        let reduction = 0;
                        for (const probe of probes) {
                            const next = distance(probe, candidate);
                            if (next < probe.first) reduction += probe.cost - cost(next);
                        }
                        if (reduction > gain) { gain = reduction; best = candidate; }
                    }
                    if (best) {
                        placed.push(best); present.add(best.id); added += 1; occupied += best.width * best.height; measure();
                    }
                }
            }
            const ids = new Set(placed.map(card => card.id));
            return { items: placed.sort((a, b) => a.index - b.index).map(({ index, ...card }) => card), height,
                overflowIds: measured.filter(card => !ids.has(card.id)).map(card => card.id) };
        }
        let best = [];
        for (let attempt = 0; attempt < (fixedHeight ? 1 : 8); attempt += 1) {
            best = [];
            for (let variant = 0; variant < 4; variant += 1) {
                const packingClearance = clearance + 4;
                let free = [{ x: padding, y: padding, width: available + packingClearance, height: height - padding * 2 + packingClearance }];
                const placed = [];
                for (const card of ordered) {
                    const w = card.width + packingClearance, h = card.height + packingClearance;
                    let slot = null, score = Infinity;
                    for (const rect of free) if (rect.width >= w && rect.height >= h) {
                        const cost = Math.min(rect.width - w, rect.height - h) + .08 * Math.max(rect.width - w, rect.height - h);
                        if (cost < score) { slot = rect; score = cost; }
                    }
                    if (!slot) continue;
                    const turn = (card.index * .61803398875 + phase + variant * .25) % 1;
                    const x = slot.x + (turn < .5 ? 0 : slot.width - w);
                    const y = slot.y + (turn < .25 || turn >= .75 ? 0 : slot.height - h);
                    placed.push({ ...card, x, y });
                    const split = [];
                    for (const rect of free) {
                        const right = rect.x + rect.width, bottom = rect.y + rect.height;
                        if (x >= right || x + w <= rect.x || y >= bottom || y + h <= rect.y) { split.push(rect); continue; }
                        if (x > rect.x) split.push({ ...rect, width: x - rect.x });
                        if (x + w < right) split.push({ ...rect, x: x + w, width: right - x - w });
                        if (y > rect.y) split.push({ ...rect, height: y - rect.y });
                        if (y + h < bottom) split.push({ ...rect, y: y + h, height: bottom - y - h });
                    }
                    free = split.filter((rect, index) => !split.some((other, j) => j !== index
                        && other.x <= rect.x && other.y <= rect.y && other.x + other.width >= rect.x + rect.width
                        && other.y + other.height >= rect.y + rect.height && (j < index || other.width * other.height > rect.width * rect.height)));
                }
                if (placed.length > best.length) best = placed;
                if (placed.length === measured.length) return finish(placed);
            }
            if (fixedHeight) return finish(best);
            if (attempt < 7) height = Math.ceil(height * 1.08 + 6);
        }
        // The unrestricted helper still preserves every input for exceptional
        // measurements. The controller uses maxHeight and explicitly drops overflow.
        const ids = new Set(best.map(card => card.id));
        let bottom = Math.max(padding, ...best.map(card => card.y + card.height));
        for (const card of ordered.filter(card => !ids.has(card.id))) {
            const x = padding + radicalInverse(card.index + 1, 2) * (available - card.width);
            const y = bottom + clearance;
            best.push({ ...card, x, y }); bottom = y + card.height;
        }
        height = Math.ceil(Math.max(height, bottom + padding));
        return finish(best);
    }

    function nearestCard(point, items, radius = 80) {
        if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y) || !Array.isArray(items)
            || typeof radius !== 'number' || !Number.isFinite(radius) || radius < 0) return null;
        let nearest = null, minimum = radius * radius;
        for (const card of items) {
            if (!card || ![card.x, card.y, card.width, card.height].every(Number.isFinite) || card.width < 0 || card.height < 0) continue;
            const dx = Math.max(card.x - point.x, 0, point.x - card.x - card.width);
            const dy = Math.max(card.y - point.y, 0, point.y - card.y - card.height);
            const distance = dx * dx + dy * dy;
            if (distance <= minimum && (nearest === null || distance < minimum)) {
                minimum = distance;
                nearest = card.id;
            }
        }
        return nearest;
    }

    function placePopover(anchor, size, viewport) {
        const rect = anchor || {}, box = size || {}, screen = viewport || {};
        const width = nonnegative(screen.width), height = nonnegative(screen.height);
        const inset = Math.min(nonnegative(screen.inset, 12), width / 2, height / 2);
        const availableWidth = Math.max(0, width - inset * 2), availableHeight = Math.max(0, height - inset * 2);
        const boxWidth = Math.min(nonnegative(box.width), availableWidth);
        const boxHeight = Math.min(nonnegative(box.height), availableHeight);
        const left = finite(rect.left, finite(rect.x)), top = finite(rect.top, finite(rect.y));
        const right = finite(rect.right, left + nonnegative(rect.width));
        const bottom = finite(rect.bottom, top + nonnegative(rect.height));
        const gap = 12;
        let x = right + gap, y = bottom + gap;
        if (x + boxWidth > width - inset) x = left - gap - boxWidth;
        if (y + boxHeight > height - inset) y = top - gap - boxHeight;
        x = clamp(x, inset, Math.max(inset, width - inset - boxWidth));
        y = clamp(y, inset, Math.max(inset, height - inset - boxHeight));
        return { x, y, maxHeight: Math.max(0, height - inset - y) };
    }

    const api = { groupRows, sampleGroups, layoutCloud, nearestCard, placePopover };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else window.WordScannerCore = api;
})();
