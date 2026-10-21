'use strict';
// Self-contained for browser evaluation. Observation only; no dispatch or waits.
function installPointerObservation() {
  const selector = '#product-tour a[href="/docs/approval-workflow"]';
  const original = document.querySelector(selector);
  const samples = [];
  const bounded = (value, limit) => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= limit ? Math.round(value * 100) / 100 : null;
  const category = (anchor, target) => !target ? 'none' : target === anchor ? 'link' : anchor && anchor.contains(target) ? 'descendant' : 'other';
  for (const type of ['pointerdown', 'pointerup', 'click']) {
    document.addEventListener(type, event => {
      const anchor = document.querySelector(selector);
      const rect = anchor?.getBoundingClientRect();
      const x = bounded(event.clientX, 32768), y = bounded(event.clientY, 32768);
      const hit = x === null || y === null ? null : document.elementFromPoint(event.clientX, event.clientY);
      const viewport = window.visualViewport;
      samples.push({ type, trusted: event.isTrusted === true, primary: event.button === 0,
        anchorPresent: Boolean(anchor), anchorReplaced: Boolean(anchor && original && anchor !== original),
        target: category(anchor, event.target), hit: category(anchor, hit),
        x, y, rect: rect ? [rect.x, rect.y, rect.width, rect.height].map(value => bounded(value, 32768)) : null,
        scroll: [bounded(window.scrollX, 10000000), bounded(window.scrollY, 10000000)],
        layout: [bounded(window.innerWidth, 32768), bounded(window.innerHeight, 32768)],
        visual: viewport ? [bounded(viewport.offsetLeft, 32768), bounded(viewport.offsetTop, 32768), bounded(viewport.width, 32768), bounded(viewport.height, 32768), bounded(viewport.scale, 64)] : null });
    }, { capture: true, passive: true, once: true });
  }
  Object.defineProperty(window, '__axiomPointerObservation', { value: samples, configurable: true });
}
module.exports = { installPointerObservation };
