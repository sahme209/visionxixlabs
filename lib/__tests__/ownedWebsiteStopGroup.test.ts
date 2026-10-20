import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { expect, it, vi } from 'vitest';
const source = readFileSync(`${process.cwd()}/scripts/run-owned-website-visual.mjs`, 'utf8');
const start = source.indexOf('async function stopGroup(');
const end = source.indexOf('\nfunction directoryBytes', start);
if (start < 0 || end < 0) throw Error('stop_group_source_missing');
const stopGroup = vm.compileFunction(`${source.slice(start, end)}; return stopGroup;`, ['assert'])(assert);
const owner = { pid: 42, group: 42, start: '100', executable: '/owned/node' };
const missing = () => { throw Object.assign(Error('PRIVATE /proc/path'), { code: 'ENOENT' }); };
function fixture() {
  let now = 0;
  const io = { members: vi.fn(() => [owner]), snapshot: vi.fn(() => owner), sameOwner: (a: typeof owner, b: typeof owner) => a.pid === b.pid && a.start === b.start && a.executable === b.executable && a.group === b.group, kill: vi.fn(), now: () => now, pause: async (ms: number) => { now += ms; } };
  return { io, elapsed: () => now };
}
it('never signals when preflight metadata remains unknown; unknown is not empty', async () => {
  const f = fixture(); f.io.members.mockImplementation(missing);
  await expect(stopGroup(owner, f.io)).rejects.toThrow('website_cleanup_metadata_unverified');
  expect(f.io.kill).not.toHaveBeenCalled(); expect(f.elapsed()).toBe(5000);
  const g = fixture(); g.io.snapshot.mockImplementation(missing);
  await expect(stopGroup(owner, g.io)).rejects.toThrow('website_cleanup_metadata_unverified');
  expect(g.io.kill).not.toHaveBeenCalled(); expect(g.elapsed()).toBe(5000);
});
it('allows transient post-TERM missing metadata only when subsequently proven empty', async () => {
  const f = fixture(); f.io.members.mockImplementation(() => {
    if (!f.io.kill.mock.calls.length) return [owner];
    if (f.elapsed() < 50) return missing(); return [];
  });
  await stopGroup(owner, f.io); expect(f.io.kill.mock.calls).toEqual([[-42, 'SIGTERM']]); expect(f.elapsed()).toBe(50);
});
it('fails persistent post-TERM unknown metadata within seven seconds without SIGKILL', async () => {
  const f = fixture(); f.io.members.mockImplementation(() => f.io.kill.mock.calls.length ? missing() : [owner]);
  await expect(stopGroup(owner, f.io)).rejects.toThrow('website_cleanup_metadata_unverified');
  expect(f.io.kill.mock.calls).toEqual([[-42, 'SIGTERM']]); expect(f.elapsed()).toBe(7000);
});
it('does not escalate after leader replacement or disappearance', async () => {
  for (const replacement of [() => ({ ...owner, start: '101' }), missing]) {
    const f = fixture(); f.io.snapshot.mockImplementation(() => f.io.kill.mock.calls.length ? replacement() : owner);
    await expect(stopGroup(owner, f.io)).rejects.toThrow();
    expect(f.io.kill.mock.calls).toEqual([[-42, 'SIGTERM']]); expect(f.elapsed()).toBeLessThanOrEqual(7000);
  }
});
it('revalidates owner before normal bounded escalation and proves final emptiness', async () => {
  const f = fixture(); f.io.members.mockImplementation(() => f.io.kill.mock.calls.length === 2 ? [] : [owner]);
  await stopGroup(owner, f.io);
  expect(f.io.kill.mock.calls).toEqual([[-42, 'SIGTERM'], [-42, 'SIGKILL']]); expect(f.elapsed()).toBe(5000); expect(f.io.snapshot).toHaveBeenCalledTimes(2);
});
it('never signals a foreign group or replaced initial leader', async () => {
  const f = fixture(); f.io.members.mockReturnValue([{ ...owner, executable: '/foreign' }]);
  await expect(stopGroup(owner, f.io)).rejects.toThrow('website_cleanup_foreign_group_member'); expect(f.io.kill).not.toHaveBeenCalled();
  const g = fixture(); g.io.snapshot.mockReturnValue({ ...owner, start: '101' });
  await expect(stopGroup(owner, g.io)).rejects.toThrow('website_cleanup_leader_changed'); expect(g.io.kill).not.toHaveBeenCalled();
});
