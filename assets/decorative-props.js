/* Local decorative feedback only: no requests, navigation or content actions. */
(() => {
    'use strict';
    if (window.DecorativeProps) window.DecorativeProps.destroy();
    const modelURL = new URL('decorative-models.js', document.currentScript.src).href;

    const drawings = {
        controller: `<path class="dp-shell" d="M24 27h32c8 0 12 5 14 13l5 20c1 7-6 10-11 5L53 54H27L16 65C11 70 4 67 5 60l5-20c2-8 6-13 14-13Z"/>
            <path class="dp-edge" d="M14 38c2-6 5-8 11-8h29c5 0 9 2 11 6"/>
            <path class="dp-inset dp-part dp-part-direction" d="M22 33h7v7h7v7h-7v7h-7v-7h-7v-7h7Z"/>
            <g class="dp-fill dp-part dp-part-action"><circle cx="59" cy="35" r="3"/><circle cx="67" cy="43" r="3"/><circle cx="59" cy="51" r="3"/><circle cx="51" cy="43" r="3"/></g>
            <path class="dp-detail" d="M37 37h6m-4 8h2"/><circle class="dp-inset" cx="33" cy="54" r="4"/><circle class="dp-inset" cx="47" cy="54" r="4"/>`,
        mouse: `<path class="dp-shell" d="M40 8c17 0 28 13 28 31v13c0 16-10 24-28 24S12 68 12 52V39C12 21 23 8 40 8Z"/>
            <path class="dp-inset dp-part dp-part-left" d="M37 11C23 12 15 22 15 39v3h22Z"/>
            <path class="dp-inset dp-part dp-part-right" d="M43 11c14 1 22 11 22 28v3H43Z"/>
            <rect class="dp-inset" x="37" y="24" width="6" height="12" rx="3"/>
            <path class="dp-edge" d="M19 22c4-6 9-9 15-10m13 0c6 1 11 4 15 10m-42 40c3 5 9 8 17 8"/>
            <path class="dp-detail" d="M37 57h6"/>`,
        crosshair: `<circle class="dp-detail" cx="40" cy="40" r="26"/><circle class="dp-detail" cx="40" cy="40" r="16" opacity=".4"/>
            <path class="dp-detail" d="M40 5v20m0 30v20M5 40h20m30 0h20"/><circle class="dp-fill" cx="40" cy="40" r="2.5"/>`,
        shield: `<path class="dp-shell" d="m40 8 24 10v24c0 15-10 25-24 31C26 67 16 57 16 42V18Z"/>
            <path class="dp-edge" d="m23 22 17-7 17 7"/><path class="dp-detail" d="m29 33 22 22m0-22L29 55"/>`,
        keys: `<rect class="dp-shell" x="28" y="8" width="23" height="23" rx="4"/><path class="dp-edge" d="M32 11h15"/>
            <rect class="dp-shell" x="3" y="36" width="23" height="23" rx="4"/><rect class="dp-shell" x="28" y="36" width="23" height="23" rx="4"/><rect class="dp-shell" x="53" y="36" width="23" height="23" rx="4"/>
            <path class="dp-edge" d="M7 39h15m10 0h15m10 0h15"/><text class="dp-glyph" x="39.5" y="24">W</text><text class="dp-glyph" x="14.5" y="52">A</text><text class="dp-glyph" x="39.5" y="52">S</text><text class="dp-glyph" x="64.5" y="52">D</text>`,
        headphones: `<path class="dp-detail" d="M14 44V33C14 17 25 9 40 9s26 8 26 24v11"/>
            <path class="dp-edge" d="M20 29c2-10 9-15 20-15s18 5 20 15"/>
            <rect class="dp-shell" x="9" y="34" width="14" height="27" rx="5"/><rect class="dp-shell" x="57" y="34" width="14" height="27" rx="5"/>
            <path class="dp-detail" d="M65 61c-1 8-10 11-21 11"/><rect class="dp-inset" x="35" y="69" width="10" height="5" rx="2"/>`,
        crystal: `<path class="dp-shell" d="m40 5 22 27-9 27-13 17-22-27 9-27Z"/><path class="dp-edge" d="m40 5 7 30-7 41-7-30 7-41m-13 17 20 13 15-3M18 49l15-3 20 13"/>`,
        coin: `<ellipse class="dp-shell" cx="40" cy="42" rx="27" ry="31"/><ellipse class="dp-inset" cx="38" cy="39" rx="22" ry="26"/><path class="dp-detail" d="m38 22 5 12 11 5-11 5-5 12-5-12-11-5 11-5Z"/>`,
        spark: `<path class="dp-shell" d="m40 6 9 25 25 9-25 9-9 25-9-25-25-9 25-9Z"/><path class="dp-edge" d="m40 6 0 34 34 0M6 40h34v34"/>`
    };
    const placements = [
        { kind: 'controller', side: 'left', top: 18, inset: 19, size: 78, angle: -16, duration: 10.6, lift: 17, drift: 5, sway: 6, alpha: .91, glow: true },
        { kind: 'crystal', side: 'left', top: 44, inset: 44, size: 33, angle: 18, duration: 14.2, lift: 23, drift: -8, sway: 10, alpha: .56 },
        { kind: 'coin', side: 'left', top: 27, inset: 74, size: 30, angle: -19, duration: 12.4, lift: 14, drift: 6, sway: 9, alpha: .70 },
        { kind: 'keys', side: 'left', top: 64, inset: 36, size: 61, angle: 13, duration: 11.8, lift: 19, drift: -4, sway: 6, alpha: .80, glow: true },
        { kind: 'spark', side: 'left', top: 69, inset: 12, size: 24, angle: 23, duration: 16.1, lift: 26, drift: 7, sway: 15, alpha: .46, extra: true },
        { kind: 'shield', side: 'left', top: 86, inset: 52, size: 47, angle: -18, duration: 13.3, lift: 16, drift: -5, sway: 7, alpha: .72 },
        { kind: 'coin', side: 'right', top: 14, inset: 44, size: 29, angle: 14, duration: 17.2, lift: 17, drift: -6, sway: 12, alpha: .51, extra: true },
        { kind: 'mouse', side: 'right', top: 31, inset: 19, size: 74, angle: 18, duration: 12.8, lift: 22, drift: -5, sway: 7, alpha: .91, glow: true },
        { kind: 'crosshair', side: 'right', top: 43, inset: 66, size: 36, angle: -8, duration: 18.4, lift: 13, drift: 6, sway: 15, alpha: .60 },
        { kind: 'headphones', side: 'right', top: 68, inset: 14, size: 64, angle: 12, duration: 14.6, lift: 19, drift: 4, sway: 8, alpha: .81 },
        { kind: 'crystal', side: 'right', top: 85, inset: 60, size: 38, angle: -25, duration: 15.7, lift: 21, drift: -7, sway: 11, alpha: .61 }
    ];
    const labels = {
        left: ['装饰鼠标左键', 'Decorative mouse: left button'],
        right: ['装饰鼠标右键', 'Decorative mouse: right button'],
        direction: ['装饰手柄方向键', 'Decorative controller: directional pad'],
        action: ['装饰手柄按钮', 'Decorative controller: action buttons']
    };
    let state = null;

    function init() {
        if (state) return api;
        const abort = new AbortController();
        const layer = document.createElement('div');
        layer.id = 'decorativeProps';
        layer.className = 'decorative-props';
        const current = { layer, abort, controls: [], timers: new Map(), activations: 0, props: [], motion: window.matchMedia('(prefers-reduced-motion: reduce)'), renderer: null, loading: false, failed: false, resizeFrame: 0 };
        state = current;
        const listen = (target, type, handler, options = {}) => target.addEventListener(type, handler, { ...options, signal: abort.signal });

        function fallback() {
            current.failed = true;
            current.renderer?.dispose();
            current.renderer = null;
            current.props.forEach(prop => prop.classList.remove('dp-rendered'));
        }
        function renderProp(prop) {
            if (state !== current || !current.renderer || document.hidden || getComputedStyle(layer).display === 'none' || getComputedStyle(prop).display === 'none') return;
            const pressed = current.controls.filter(control => control.prop === prop && prop.classList.contains(`dp-pressed-${control.part}`)).map(control => control.part);
            try {
                if (current.renderer.render(prop.dataset.kind, prop.querySelector('canvas'), pressed) !== false) prop.classList.add('dp-rendered');
            } catch (_) { fallback(); }
        }
        async function renderVisible() {
            if (state !== current || document.hidden || getComputedStyle(layer).display === 'none' || current.failed) return;
            if (!current.renderer) {
                if (current.loading) return;
                current.loading = true;
                try {
                    const { createDecorativeRenderer } = await import(modelURL);
                    if (state !== current || document.hidden || getComputedStyle(layer).display === 'none') return;
                    current.renderer = createDecorativeRenderer({ onContextLost: () => { if (state === current) fallback(); } });
                } catch (_) { if (state === current) fallback(); }
                finally { current.loading = false; }
            }
            if (state === current) current.props.forEach(renderProp);
        }
        function clear(control, redraw = true) {
            const timer = current.timers.get(control);
            if (timer) clearTimeout(timer);
            current.timers.delete(control);
            control.prop.classList.remove(`dp-pressed-${control.part}`);
            if (redraw) renderProp(control.prop);
        }
        function press(control) {
            clear(control, false);
            control.prop.classList.add(`dp-pressed-${control.part}`);
            renderProp(control.prop);
        }
        function pulse(control) {
            press(control);
            current.activations += 1;
            current.timers.set(control, setTimeout(() => clear(control), 160));
        }
        function addControl(prop, kind, part) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = `dp-pad dp-${kind}-${part}`;
            const control = { button, prop, part };
            current.controls.push(control);
            prop.append(button);
            let pointerControl = control;
            listen(button, 'pointerdown', event => {
                event.stopPropagation();
                pointerControl = kind === 'mouse' && event.button === 2
                    ? current.controls.find(item => item.prop === prop && item.part === 'right') || control : control;
                press(pointerControl);
                if (event.pointerId != null) button.setPointerCapture?.(event.pointerId);
            });
            listen(button, 'pointerup', event => {
                event.stopPropagation();
                if (event.button === 2) pulse(pointerControl);
                else clear(pointerControl);
            });
            listen(button, 'pointercancel', () => clear(pointerControl));
            listen(button, 'lostpointercapture', () => {
                if (!current.timers.has(pointerControl)) clear(pointerControl);
            });
            listen(button, 'contextmenu', event => {
                event.preventDefault();
                event.stopPropagation();
            });
            listen(button, 'click', event => {
                event.preventDefault();
                event.stopPropagation();
                pulse(control);
            });
            listen(button, 'keydown', event => {
                if ((event.key === ' ' || event.key === 'Enter') && !event.repeat) press(control);
            });
            listen(button, 'keyup', event => {
                if (event.key === ' ' || event.key === 'Enter') clear(control);
            });
            listen(button, 'blur', () => clear(control));
        }

        placements.forEach((placement, index) => {
            const prop = document.createElement('div');
            const interactive = placement.kind === 'mouse' || placement.kind === 'controller';
            prop.className = `dp-prop dp-left dp-${placement.kind}`.replace('dp-left', `dp-${placement.side}`) + (interactive ? ' dp-interactive' : '');
            if (placement.glow) prop.classList.add('dp-glow');
            if (placement.extra) prop.classList.add('dp-extra');
            prop.dataset.kind = placement.kind;
            prop.style.top = `${placement.top}%`;
            for (const [key, value] of Object.entries({ size: `${placement.size}px`, inset: `${placement.inset}px`, angle: `${placement.angle}deg`, duration: `${placement.duration}s`, delay: `${-index * 2.31}s`, lift: `${placement.lift}px`, drift: `${placement.drift}px`, sway: `${placement.sway}deg`, alpha: placement.alpha })) prop.style.setProperty(`--dp-${key}`, value);
            // Templates are fixed local SVG strings; no user or remote content is inserted.
            prop.innerHTML = `<svg viewBox="0 0 80 80" fill="none" aria-hidden="true" focusable="false">${drawings[placement.kind]}</svg>`;
            const canvas = document.createElement('canvas');
            canvas.className = 'dp-model';
            canvas.setAttribute('aria-hidden', 'true');
            prop.append(canvas);
            if (!interactive) prop.setAttribute('aria-hidden', 'true');
            if (placement.kind === 'mouse') { addControl(prop, 'mouse', 'left'); addControl(prop, 'mouse', 'right'); }
            if (placement.kind === 'controller') { addControl(prop, 'controller', 'direction'); addControl(prop, 'controller', 'action'); }
            current.props.push(prop);
            layer.append(prop);
        });

        const updateLabels = () => {
            const english = (window.i18n?.getLang?.() || document.documentElement.lang) === 'en';
            for (const control of current.controls) control.button.setAttribute('aria-label', labels[control.part][english ? 1 : 0]);
        };
        const pause = () => {
            layer.classList.toggle('dp-paused', document.hidden || current.motion.matches);
            if (document.hidden) for (const control of current.controls) clear(control);
            else void renderVisible();
        };
        listen(window, 'languagechange', updateLabels);
        listen(document, 'visibilitychange', pause);
        listen(current.motion, 'change', pause);
        listen(window, 'pagehide', () => {
            layer.classList.add('dp-paused');
            for (const control of current.controls) clear(control);
        });
        listen(window, 'pageshow', pause);
        listen(window, 'resize', () => {
            cancelAnimationFrame(current.resizeFrame);
            current.resizeFrame = requestAnimationFrame(() => { current.resizeFrame = 0; void renderVisible(); });
        }, { passive: true });
        updateLabels();
        document.body.append(layer);
        pause();
        return api;
    }

    function destroy() {
        document.removeEventListener('DOMContentLoaded', boot);
        if (!state) return;
        state.abort.abort();
        cancelAnimationFrame(state.resizeFrame);
        for (const timer of state.timers.values()) clearTimeout(timer);
        state.timers.clear();
        state.renderer?.dispose();
        state.layer.remove();
        state = null;
    }

    const api = {
        init,
        destroy,
        getStats() {
            if (!state) return { initialized: false, decorations: 0, visibleDecorations: 0, controls: 0, pendingFeedback: 0 };
            const displayed = getComputedStyle(state.layer).display !== 'none';
            return { initialized: true, decorations: state.props.length,
                visibleDecorations: displayed ? state.props.filter(prop => getComputedStyle(prop).display !== 'none').length : 0,
                controls: state.controls.length, pendingFeedback: state.timers.size,
                activations: state.activations, reducedMotion: state.motion.matches,
                animationPaused: state.layer.classList.contains('dp-paused') || !displayed,
                renderer: state.renderer ? 'Three.js / WebGL' : 'SVG fallback',
                rendering: state.renderer?.getStats(), loading3D: state.loading, fallback: state.failed,
                contentInteractions: 0 };
        }
    };
    function boot() { init(); }
    window.DecorativeProps = api;
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
    else init();
})();
