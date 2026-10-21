import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { expect, it, vi } from 'vitest';
const source = readFileSync(`${process.cwd()}/scripts/capture-owned-website.mjs`, 'utf8');
const start = source.indexOf('function pointerForControl('); const end = source.indexOf('function controlToken(', start);
if (start < 0 || end < 0) throw Error('pointer_source_missing');
function fixture() {
  let y = 500;
  const target = { disabled: false, textContent: 'Play', getAttribute: () => 'Play story', scrollIntoView: vi.fn((options: ScrollIntoViewOptions) => { if (options.behavior === 'instant') y = 20; }), getBoundingClientRect: () => ({ x: 10, y, width: 30, height: 20 }), contains: vi.fn(() => false) };
  const document = { querySelectorAll: () => [target], elementFromPoint: vi.fn(() => target as unknown) };
  const point = vm.compileFunction(`${source.slice(start, end)}; return pointerForControl(label);`, ['document', 'innerWidth', 'innerHeight', 'label']);
  return { target, document, point: () => point(document, 100, 100, 'Play story') };
}
it('uses instant scroll before measuring despite the application smooth-scroll style', () => {
  expect(readFileSync(`${process.cwd()}/app/globals.css`, 'utf8')).toContain('scroll-behavior: smooth');
  const f = fixture();
  f.target.scrollIntoView({ block: 'center' }); expect(f.target.getBoundingClientRect().y).toBe(500);
  expect(f.point()).toEqual({ x: 25, y: 30 });
  expect(f.target.scrollIntoView).toHaveBeenLastCalledWith({ block: 'center', behavior: 'instant' });
  expect(f.document.elementFromPoint).toHaveBeenCalledWith(25, 30);
});
it('refuses obstructed, missing, disabled and invalid pointer targets without dispatching a DOM click', () => {
  const f = fixture(); f.document.elementFromPoint.mockReturnValue({}); expect(f.point).toThrow('control_target_obscured');
  f.document.elementFromPoint.mockReturnValue(f.target); f.target.disabled = true; expect(f.point).toThrow('missing_control');
  f.target.disabled = false; f.target.getBoundingClientRect = () => ({ x: -100, y: 20, width: 30, height: 20 }); expect(f.point).toThrow('control_geometry_invalid');
  const g = fixture(); g.document.querySelectorAll = () => []; expect(g.point).toThrow('missing_control');
  expect(source).toContain("send('Input.dispatchMouseEvent'"); expect(source).not.toContain('.click()');
});
it('allows a descendant hit and keeps every fixture scroll explicit and instant', () => {
  const f = fixture(); f.document.elementFromPoint.mockReturnValue({}); f.target.contains.mockReturnValue(true); expect(f.point()).toEqual({ x: 25, y: 30 });
  const scrollCalls = source.split('\n').filter(line => /scrollIntoView\(|scrollTo\(/.test(line));
  expect(scrollCalls).toHaveLength(4); for (const line of scrollCalls) expect(line).toContain("behavior: 'instant'");
});

it('measures documentation around the original scroll and retains the original coordinates', () => {
 const calls: string[] = [];
 const target = { disabled: false, getAttribute: () => 'Read approval workflow', scrollIntoView: () => { calls.push('scroll'); }, getBoundingClientRect: () => ({ x: 10, y: 20, width: 30, height: 20 }), contains: () => false };
 const window = Object.defineProperty({}, '__axiomPointerMeasure', { value: (phase: string, point?: unknown) => { calls.push(phase); if (phase === 'after_scroll_call') expect(point).toEqual({ x: 25, y: 30 }); } });
 const document = { querySelectorAll: () => [target], elementFromPoint: () => target };
 const point = vm.compileFunction(`${source.slice(start, end)}; return pointerForControl('Read approval workflow');`, ['document', 'window', 'innerWidth', 'innerHeight'])(document, window, 100, 100);
 expect(point).toEqual({ x: 25, y: 30 });
 expect(calls).toEqual(['selection', 'scroll', 'after_scroll_call']);
});
