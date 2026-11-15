import { readFileSync } from 'node:fs';
import { compileFunction } from 'node:vm';
import assert from 'node:assert/strict';
import { test } from 'vitest';

const source = readFileSync(new URL('../../scripts/capture-owned-website.mjs', import.meta.url), 'utf8');
const helper = source.slice(source.indexOf('async function settleControlPointer('), source.indexOf('// Observation only:'));
const click = source.slice(source.indexOf('  async function click(label) {'), source.indexOf('  async function frame('));
const invoke = compileFunction(`${helper}\n${click}\nreturn click(label);`, ['label', 'evaluate', 'send', 'pointerForControl', 'controlToken', 'currentInteraction', 'lastInteraction']);
type PointerEvent = { method: string; type: string; x?: number; y?: number };

for (const label of ['Reject sample', 'Simulate approval', 'Step 3: Review the bounded check.']) {
  test(`${label} remeasures shifted layout before one real pointer click`, async () => {
    let reads = 0;
    const events: PointerEvent[] = [];
    const pointer = () => {};
    const evaluate = async (fn: unknown) => fn === pointer ? (++reads === 1 ? { x: 30, y: 100 } : { x: 30, y: 180 }) : true;
    await invoke(label, evaluate, async (method: string, event: Omit<PointerEvent, 'method'>) => events.push({ method, ...event }), pointer, () => 'sample', null, null);
    assert.ok(reads >= 4, 'layout must stabilize across two frame samples');
    const clicks = events.filter(event => event.type !== 'mouseMoved');
    assert.deepEqual(clicks.map(event => [event.type, event.x, event.y]), [['mousePressed', 30, 180], ['mouseReleased', 30, 180]]);
    assert.ok(events.every(event => event.method === 'Input.dispatchMouseEvent'));
  });
}

test('a continuously moving decision control refuses without any press or release', async () => {
  let reads = 0;
  const events: Omit<PointerEvent, 'method'>[] = [];
  const pointer = () => {};
  await assert.rejects(invoke('Reject sample', async (fn: unknown) => fn === pointer ? { x: reads++, y: 100 } : true,
    async (_method: string, event: Omit<PointerEvent, 'method'>) => events.push(event), pointer, () => 'sample', null, null), /control_geometry_unstable/);
  assert.equal(reads, 17);
  assert.ok(events.every(event => event.type === 'mouseMoved'));
});
