/* Pure scanner helpers. Classic browser script + Node CommonJS; no DOM access.
 * Measure cards at <= width - 2 * padding before layout; oversized measurements
 * throw RangeError so callers can remeasure wrapped text rather than distort it.
 * Static padding includes motion; neighboring rectangles reserve gap + 2 * motion.
 * Elliptical rejection sampling grows the cloud instead of removing words.
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
        const ordered = [...measured].sort((a, b) => b.width * b.height - a.width * a.height || b.width - a.width || a.index - b.index);
        const area = measured.reduce((sum, card) => sum + (card.width + clearance) * (card.height + clearance), 0);
        let height = Math.ceil(Math.max(nonnegative(settings.minHeight, 560),
            Math.max(...measured.map(card => card.height)) + padding * 2,
            area / (available * .54) + padding * 2));
        const hash = seedNumber(settings.seed), phase = hash / 4294967296;
        const pointCount = Math.max(384, Math.min(8192, measured.length * 40));
        const polar = [{ radius: 0, angle: 0 }];
        for (let index = 1; index < pointCount; index += 1) {
            // Low-discrepancy polar samples, biased gently toward the ellipse center.
            const radius = Math.pow(radicalInverse(index, 2), .65);
            const angle = radicalInverse(index, 3) * Math.PI * 2;
            polar.push({ radius, angle });
        }
        // Fill central gaps before spreading outward, without introducing row or grid anchors.
        polar.sort((a, b) => a.radius - b.radius);
        const separated = (a, b) => a.x + a.width + clearance <= b.x + 1e-7
            || b.x + b.width + clearance <= a.x + 1e-7
            || a.y + a.height + clearance <= b.y + 1e-7
            || b.y + b.height + clearance <= a.y + 1e-7;
        const present = placed => placed.sort((a, b) => a.index - b.index).map(({ index, ...card }) => card);
        let placed = [], points = [];
        for (let attempt = 0; attempt < 10; attempt += 1) {
            // Try several deterministic rotations at the same height before growing.
            // A single unlucky greedy packing should not turn a short field into a tall list.
            for (let variant = 0; variant < 12; variant += 1) {
                const turn = (phase + variant * .618033988749895) * Math.PI * 2;
                points = polar.map(point => ({ x: Math.cos(point.angle + turn) * point.radius,
                    y: Math.sin(point.angle + turn) * point.radius }));
                if (containerWidth < 450 && measured.length > 1) {
                    // On narrow screens a wide word on the centerline blocks both
                    // sides. Fill the ellipse's lateral space first, with continuous
                    // candidate coordinates rather than fixed columns or row bands.
                    const lateralCost = point => (1 - Math.abs(point.x)) * .75 + Math.abs(point.y);
                    points.sort((a, b) => lateralCost(a) - lateralCost(b));
                }
                placed = [];
                for (const card of ordered) {
                    const rx = Math.max(0, (available - card.width) / 2);
                    const ry = Math.max(0, (height - padding * 2 - card.height) / 2);
                    let selected = null;
                    for (const point of points) {
                        const candidate = { ...card, x: containerWidth / 2 + point.x * rx - card.width / 2,
                            y: height / 2 + point.y * ry - card.height / 2 };
                        if (placed.every(other => separated(candidate, other))) { selected = candidate; break; }
                    }
                    if (!selected) break;
                    placed.push(selected);
                }
                if (placed.length === measured.length) return { items: present(placed), height };
            }
            if (attempt < 9) height = Math.ceil(height * 1.06 + 8);
        }
        // Bounded fallback for unusually dense/degenerate input: append remaining
        // rectangles below the existing cloud with irregular offsets, never a grid.
        let bottom = Math.max(padding, ...placed.map(card => card.y + card.height));
        for (const card of ordered.slice(placed.length)) {
            const position = points[(card.index + hash % points.length) % points.length];
            const x = containerWidth / 2 + position.x * (available - card.width) / 2 - card.width / 2;
            const y = bottom + clearance + gap * (.25 + Math.abs(position.y));
            placed.push({ ...card, x, y });
            bottom = y + card.height;
        }
        return { items: present(placed), height: Math.ceil(Math.max(height, bottom + padding)) };
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
