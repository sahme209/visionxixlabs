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
function readPointerObservation() {
  const descriptor = Object.getOwnPropertyDescriptor(window, '__axiomPointerObservation');
  return descriptor && Object.hasOwn(descriptor, 'value') ? descriptor.value : null;
}
function sanitizePointerObservation(value) {
  const fields = ['type', 'trusted', 'primary', 'anchorPresent', 'anchorReplaced', 'target', 'hit', 'x', 'y', 'rect', 'scroll', 'layout', 'visual'];
  function array(data, max) {
    if (!Array.isArray(data) || Object.getPrototypeOf(data) !== Array.prototype) return null;
    const length = Object.getOwnPropertyDescriptor(data, 'length');
    if (!length || !Object.hasOwn(length, 'value') || !Number.isInteger(length.value) || length.value < 0 || length.value > max || Reflect.ownKeys(data).length !== length.value + 1) return null;
    const result = [];
    for (let i = 0; i < length.value; i++) {
      const descriptor = Object.getOwnPropertyDescriptor(data, String(i));
      if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) return null;
      result.push(descriptor.value);
    }
    return result;
  }
  const entries = array(value, 3); if (!entries) return null;
  const result = []; let last = -1;
  const number = (x, limit) => x === null || typeof x === 'number' && Number.isFinite(x) && Math.abs(x) <= limit;
  for (const entry of entries) {
    if (!entry || Object.getPrototypeOf(entry) !== Object.prototype || Reflect.ownKeys(entry).length !== fields.length) return null;
    const sample = {};
    for (const key of fields) {
      const descriptor = Object.getOwnPropertyDescriptor(entry, key);
      if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) return null;
      sample[key] = descriptor.value;
    }
    const order = ['pointerdown', 'pointerup', 'click'].indexOf(sample.type);
    if (order <= last || order < 0) return null; last = order;
    if (['trusted', 'primary', 'anchorPresent', 'anchorReplaced'].some(key => typeof sample[key] !== 'boolean')) return null;
    if (['target', 'hit'].some(key => !['none', 'link', 'descendant', 'other'].includes(sample[key]))) return null;
    if (!number(sample.x, 32768) || !number(sample.y, 32768)) return null;
    for (const [key, length, limit, nullable] of [['rect', 4, 32768, true], ['scroll', 2, 10000000, false], ['layout', 2, 32768, false], ['visual', 5, 32768, true]]) {
      if (sample[key] === null && nullable) continue;
      const tuple = array(sample[key], length);
      if (!tuple || tuple.length !== length || !tuple.every(x => number(x, limit)) || key === 'visual' && !number(tuple[4], 64)) return null;
      sample[key] = tuple;
    }
    result.push(sample);
  }
  return result;
}
module.exports = { installPointerObservation, readPointerObservation, sanitizePointerObservation };
