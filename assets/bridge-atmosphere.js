/* Only the reading bridge is animated. No frame loop or pointer interception. */
(() => {
    'use strict';
    const bridge = document.getElementById('history-culture-bridge');
    if (!bridge) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let visible = false;
    let pageActive = true;
    const update = () => {
        const active = visible && pageActive && !document.hidden;
        bridge.classList.toggle('hx-bridge-running', active && !reduced.matches);
        if (active) bridge.classList.add('hx-bridge-entered');
    };
    if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver(entries => {
            visible = entries[0].isIntersecting;
            update();
        }, { rootMargin: '-15% 0px -15% 0px', threshold: 0 });
        observer.observe(bridge);
        // Keep this lightweight observer alive across back/forward cache restores.
        window.addEventListener('pagehide', event => {
            pageActive = false;
            update();
            if (!event.persisted) observer.disconnect();
        });
        window.addEventListener('pageshow', () => { pageActive = true; update(); });
    }
    // Without IntersectionObserver, the decoration and text remain static and visible.
    document.addEventListener('visibilitychange', update);
    reduced.addEventListener('change', update);
})();
