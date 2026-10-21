import { createRequire } from 'node:module';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { publicSummary } from '../../scripts/owned-website-ci.mjs';
import { expect, it, vi } from 'vitest';
const require = createRequire(import.meta.url);
const { installPointerObservation } = require('../../scripts/fixtures/ownedWebsitePointerObservation.cjs');
function fixture() {
 const handlers: Record<string, (event: unknown) => void> = {};
 const original = { contains: () => false, getBoundingClientRect: () => ({ x: 10, y: 20, width: 100, height: 40 }) };
 let anchor = original;
 const document = { querySelector: () => anchor, elementFromPoint: vi.fn(() => anchor), addEventListener: vi.fn((type: string, fn: (event: unknown) => void, _options?: unknown) => { handlers[type] = fn; }) };
 const window = { innerWidth: 1440, innerHeight: 1000, scrollX: 0, scrollY: 100, visualViewport: { offsetLeft: 0, offsetTop: 0, width: 1440, height: 1000, scale: 1 } };
 vm.compileFunction(`(${installPointerObservation.toString()})();`, ['document', 'window'])(document, window);
 return { document, window, handlers, original, replace: () => { anchor = { ...original }; return anchor; }, read: () => (window as unknown as { __axiomPointerObservation: unknown[] }).__axiomPointerObservation };
}
it('records event-time current geometry and replacement without blocking or dispatching', () => {
 const f = fixture(); const anchor = f.replace();
 const event = { target: anchor, clientX: 60, clientY: 40, button: 0, isTrusted: true, preventDefault: vi.fn(), stopPropagation: vi.fn() };
 f.handlers.pointerdown(event);
 expect(f.read()[0]).toMatchObject({ type: 'pointerdown', anchorReplaced: true, target: 'link', hit: 'link', rect: [10, 20, 100, 40], layout: [1440, 1000] });
 expect(event.preventDefault).not.toHaveBeenCalled(); expect(event.stopPropagation).not.toHaveBeenCalled();
 for (const call of f.document.addEventListener.mock.calls) expect(call[2]).toEqual({ capture: true, passive: true, once: true });
});
it('distinguishes an overlay at the delivered point and bounds malformed coordinates', () => {
 const f = fixture(); f.document.elementFromPoint.mockReturnValue({} as typeof f.original);
 f.handlers.click({ target: {}, clientX: 60, clientY: 40, button: 0, isTrusted: true });
 expect(f.read()[0]).toMatchObject({ target: 'other', hit: 'other' });
 f.handlers.pointerup({ target: {}, clientX: Infinity, clientY: 1e12, button: 0, isTrusted: false });
 expect(f.read()[1]).toMatchObject({ x: null, y: null, trusted: false, hit: 'none' });
 expect(JSON.stringify(f.read())).not.toContain('approval-workflow');
});

it('hit-tests original validated coordinates and rounds only stored evidence', () => {
 const f = fixture();
 f.handlers.click({ target: f.original, clientX: 60.004, clientY: 40.006, button: 0, isTrusted: true });
 expect(f.document.elementFromPoint).toHaveBeenCalledWith(60.004, 40.006);
 expect(f.read()[0]).toMatchObject({ x: 60, y: 40.01 });
});

it('projects closed event samples and refuses accessors, extra keys and oversized arrays', () => {
 const { sanitizePointerObservation } = require('../../scripts/fixtures/ownedWebsitePointerObservation.cjs');
 const f = fixture(); f.handlers.click({ target: f.original, clientX: 60, clientY: 40, button: 0, isTrusted: true });
 const sample = f.read()[0] as Record<string, unknown>;
 expect(sanitizePointerObservation([sample])).toEqual([sample]);
 expect(sanitizePointerObservation([{ ...sample, secret: 'PRIVATE' }])).toBeNull();
 expect(sanitizePointerObservation([sample, sample])).toBeNull();
 expect(sanitizePointerObservation([{ ...sample, x: Infinity }])).toBeNull();
 let reads = 0; const bad = { ...sample }; Object.defineProperty(bad, 'x', { enumerable: true, get() { reads++; throw Error('PRIVATE'); } });
 expect(sanitizePointerObservation([bad])).toBeNull();
 const tuple = [0, 0]; Object.defineProperty(tuple, '0', { enumerable: true, get() { reads++; throw Error('PRIVATE'); } });
 expect(sanitizePointerObservation([{ ...sample, scroll: tuple }])).toBeNull();
 const entries = [sample]; Object.defineProperty(entries, '0', { enumerable: true, get() { reads++; throw Error('PRIVATE'); } });
 expect(sanitizePointerObservation(entries)).toBeNull(); expect(reads).toBe(0);
});

it('binds observation to documentation receipts and hashes the helper source', () => {
 const f = fixture(); f.handlers.click({ target: f.original, clientX: 60, clientY: 40, button: 0, isTrusted: true });
 const capture = { currentInteraction: 'documentation_check', documentationPointer: f.read() };
 expect(publicSummary('a'.repeat(40), undefined, capture, undefined, undefined).documentationPointer).toEqual(f.read());
 expect(publicSummary('a'.repeat(40), undefined, { ...capture, currentInteraction: 'setup' }, undefined, undefined).documentationPointer).toBeNull();
 let reads = 0; const bad = { currentInteraction: 'documentation_check', get documentationPointer() { reads++; throw Error('PRIVATE'); } };
 expect(publicSummary('a'.repeat(40), undefined, bad, undefined, undefined).documentationPointer).toBeNull(); expect(reads).toBe(0);
 const driver = readFileSync('scripts/capture-owned-website.mjs', 'utf8');
 expect(driver).toContain('await evaluate(pointerObservation.installPointerObservation)');
 expect(driver).toContain('pointer: (${pointerObservation.readPointerObservation})()');
 expect(readFileSync('scripts/run-owned-website-visual.mjs', 'utf8')).toContain("'scripts/fixtures/ownedWebsitePointerObservation.cjs'");
});

it('captures selection and post-scroll measurements without recomputing the sent point', () => {
 const f = fixture();
 const descriptor = Object.getOwnPropertyDescriptor(f.window, '__axiomPointerMeasure');
 expect(descriptor && Object.hasOwn(descriptor, 'value')).toBe(true);
 descriptor!.value('selection');
 descriptor!.value('after_scroll_call', { x: 60, y: 40 });
 f.handlers.pointerdown({ target: f.original, clientX: 60, clientY: 40, button: 0, isTrusted: true });
 expect(f.read()).toHaveLength(3);
 expect(f.read()[0]).toMatchObject({ type: 'selection', rect: [10, 20, 100, 40], x: null, y: null });
 expect(f.read()[1]).toMatchObject({ type: 'after_scroll_call', x: 60, y: 40, scroll: [0, 100] });
 const { sanitizePointerObservation } = require('../../scripts/fixtures/ownedWebsitePointerObservation.cjs');
 expect(sanitizePointerObservation(f.read())).toEqual(f.read());
});
