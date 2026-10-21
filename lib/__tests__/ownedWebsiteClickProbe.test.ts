import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { expect, it, vi } from 'vitest';
import * as ci from '../../scripts/owned-website-ci.mjs';
const source = readFileSync(`${process.cwd()}/scripts/capture-owned-website.mjs`, 'utf8');
function fixture() {
  const start = source.indexOf('function installDocumentationClickProbe(');
  const end = source.indexOf('function controlToken(', start);
  expect(start).toBeGreaterThanOrEqual(0);
  const handlers: Record<string, (event: unknown) => void> = {};
  const anchor = { contains: (target: unknown) => target === anchor };
  const window = { addEventListener: vi.fn((_name, fn) => { handlers[_name === 'click' ? 'bubble' : 'intent'] = fn; }) };
  const document = { querySelector: () => anchor, addEventListener: vi.fn((_name, fn) => { handlers.capture = fn; }) };
  const run = vm.compileFunction(`${source.slice(start, end)}; installDocumentationClickProbe(); return readDocumentationClickProbe;`, ['window', 'document'])(window, document);
  return { read: run, handlers, anchor };
}
it('distinguishes no click, captured target and final bubble prevention without intercepting events', () => {
  const f = fixture();
  expect(f.read()).toEqual({ captureSeen: false, bubbleSeen: false, targetIsDocumentation: null, trusted: null, primaryButton: null, defaultPrevented: null, routerIntentSeen: false });
  const event = { target: f.anchor, isTrusted: true, button: 0, defaultPrevented: false, preventDefault: vi.fn(), stopPropagation: vi.fn() };
  f.handlers.capture(event); event.defaultPrevented = true; f.handlers.bubble(event);
  expect(f.read()).toEqual({ captureSeen: true, bubbleSeen: true, targetIsDocumentation: true, trusted: true, primaryButton: true, defaultPrevented: true, routerIntentSeen: false });
  expect(event.preventDefault).not.toHaveBeenCalled(); expect(event.stopPropagation).not.toHaveBeenCalled();
});
it('reports an unexpected target and missing bubble without guessing router failure', () => {
  const f = fixture(); f.handlers.capture({ target: {}, isTrusted: true, button: 0 });
  expect(f.read()).toMatchObject({ targetIsDocumentation: false, bubbleSeen: false, defaultPrevented: null, routerIntentSeen: false });
});
it('publishes only seven exact boolean-or-null observations; rejects extra fields and accessors', () => {
  const sanitize = (ci as unknown as { publicDocumentationClick: (v: unknown) => unknown }).publicDocumentationClick;
  expect(sanitize).toBeTypeOf('function');
  const value = { captureSeen: true, bubbleSeen: true, targetIsDocumentation: true, trusted: true, primaryButton: true, defaultPrevented: false, routerIntentSeen: false };
  expect(sanitize(value)).toEqual(value); expect(sanitize({ ...value, url: 'PRIVATE' })).toBeNull();
  let reads = 0; const accessor = { ...value }; Object.defineProperty(accessor, 'trusted', { enumerable: true, get() { reads++; return true; } });
  expect(sanitize(accessor)).toBeNull(); expect(reads).toBe(0);
  expect(sanitize({ ...value, captureSeen: null })).toBeNull();
});

it('records the public Next Link intent callback separately from click prevention', () => {
  const f = fixture(); f.handlers.intent({});
  expect(f.read()).toMatchObject({ routerIntentSeen: true, captureSeen: false, bubbleSeen: false });
  const component = readFileSync(`${process.cwd()}/components/marketing/CinematicAxiomDemo.tsx`, 'utf8');
  expect(component).toContain('onNavigate={() => window.dispatchEvent(new Event("axiom:documentation-navigation-intent"))}');
});
it('retains bounded diagnostics only during documentation phases without reading accessors', () => {
  const value = { captureSeen: true, bubbleSeen: true, targetIsDocumentation: true, trusted: true, primaryButton: true, defaultPrevented: true, routerIntentSeen: true };
  const capture = { currentInteraction: 'documentation_check', documentationClick: value, documentationTransitionSeen: false };
  expect(ci.publicSummary('a'.repeat(40), undefined, capture, undefined, undefined)).toMatchObject({ documentationClick: value, documentationTransitionSeen: false, outcome: 'unavailable' });
  let reads = 0;
  const accessors = { currentInteraction: 'documentation_check', get documentationClick() { reads++; return value; }, get documentationTransitionSeen() { reads++; return true; } };
  expect(ci.publicSummary('a'.repeat(40), undefined, accessors, undefined, undefined).documentationClick).toBeNull(); expect(reads).toBe(0);
  expect(ci.publicSummary('a'.repeat(40), undefined, { ...capture, currentInteraction: 'play' }, undefined, undefined).documentationClick).toBeNull();
});

it('refreshes router-intent observation during each documentation poll, including delayed replay', async () => {
  const start = source.indexOf('  async function waitFor('); const end = source.indexOf('  async function viewport(', start);
  let now = 0, reads = 0;
  const evaluate = async (fn: unknown) => {
    reads++;
    return vm.compileFunction(`return (${String(fn)})();`, ['reads'])(reads);
  };
  const run = vm.compileFunction(`let documentationClick = null, documentationPointer = null; ${source.slice(start, end)}; return { waitFor, read: () => documentationClick };`, ['evaluate', 'sleep', 'Date', 'assert', 'readDocumentationClickProbe', 'pointerObservation'])(evaluate, async () => { now += 100; }, { now: () => now }, { ok: (value: unknown) => { if (!value) throw Error('assertion'); } }, () => ({ routerIntentSeen: reads > 1 }), { readPointerObservation: () => null });
  await expect(run.waitFor(() => false, undefined, 250, undefined, undefined, true)).rejects.toThrow('website_dom_timeout');
  expect(reads).toBe(3); expect(run.read()).toEqual({ routerIntentSeen: true });
});
it('attributes transitions only to the main frame and fixed same-origin destination', () => {
  const start = source.indexOf('onEvent: (data, send) => {'); const end = source.indexOf('\n  } });', start);
  const callback = source.slice(start + 'onEvent: '.length, end + 4);
  const origin = 'http://127.0.0.1:38001';
  const f = vm.compileFunction(`let mainFrameId = null, documentationTransitionSeen = false; const currentInteraction = 'documentation_check'; const windowState = { origin }; return { event: ${callback}, read: () => documentationTransitionSeen };`, ['origin', 'URL'])(origin, URL);
  f.event({ method: 'Page.frameNavigated', params: { frame: { id: 'main', url: `${origin}/product` } } });
  f.event({ method: 'Page.frameNavigated', params: { frame: { id: 'child', parentId: 'main', url: `${origin}/docs/approval-workflow` } } });
  f.event({ method: 'Page.navigatedWithinDocument', params: { frameId: 'child', url: `${origin}/docs/approval-workflow` } });
  f.event({ method: 'Page.navigatedWithinDocument', params: { frameId: 'main', url: 'https://unapproved.example/docs/approval-workflow' } });
  expect(f.read()).toBe(false);
  f.event({ method: 'Page.navigatedWithinDocument', params: { frameId: 'main', url: `${origin}/docs/approval-workflow` } });
  expect(f.read()).toBe(true);
});
