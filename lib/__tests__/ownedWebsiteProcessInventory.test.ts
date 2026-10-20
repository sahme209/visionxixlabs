import { createRequire } from "node:module";
import { describe, expect, it, vi } from "vitest";
const require = createRequire(import.meta.url);
const policy = require("../../scripts/fixtures/ownedWebsitePolicy.cjs");
const row = { pid: 42, state: "S", group: 42, start: "100" };
const denied = () => Object.assign(Error("denied"), { code: "EACCES" });
const gone = () => Object.assign(Error("gone"), { code: "ENOENT" });

describe("stat-first owned group inventory", () => {
  it("does not read executable metadata for an unrelated protected process", () => {
    const executable = vi.fn((pid: number) => { if (pid === 1) throw denied(); return "/owned/node"; });
    const io = { pids: () => [1, 42], stat: (pid: number) => pid === 1 ? { ...row, pid: 1, group: 1 } : row, executable };
    expect(policy.groupMembers(42, io)).toEqual([{ ...row, executable: "/owned/node" }]); expect(executable).toHaveBeenCalledExactlyOnceWith(42);
  });
  it("refuses inaccessible metadata for a live relevant member", () => {
    expect(() => policy.groupMembers(42, { pids: () => [42], stat: () => row, executable: () => { throw denied(); } })).toThrow("denied");
  });
  it.each([{ group: 99 }, { pid: 99 }, { start: "101" }])("refuses changed identity after reading relevant executable %o", change => {
    let reads = 0;
    expect(() => policy.groupMembers(42, { pids: () => [42], stat: () => ++reads === 1 ? row : { ...row, ...change }, executable: () => "/owned/node" })).toThrow("website_group_identity_changed");
  });
  it("accepts a state transition with stable identity", () => {
    let reads = 0;
    expect(policy.groupMembers(42, { pids: () => [42], stat: () => ++reads === 1 ? row : { ...row, state: "R" }, executable: () => "/owned/node" })).toEqual([{ ...row, state: "R", executable: "/owned/node" }]);
  });
  it("distinguishes a vanished process from a live process with unreadable executable", () => {
    let reads = 0;
    expect(policy.groupMembers(42, { pids: () => [42], stat: () => { if (++reads > 1) throw gone(); return row; }, executable: () => { throw gone(); } })).toEqual([]);
    expect(() => policy.groupMembers(42, { pids: () => [42], stat: () => row, executable: () => { throw gone(); } })).toThrow("gone");
  });
  it("refuses unknown relevance when stat itself cannot be read", () => {
    expect(() => policy.groupMembers(42, { pids: () => [42], stat: () => { throw denied(); }, executable: vi.fn() })).toThrow("denied");
  });
  it("does not inspect executable metadata for zombies", () => {
    const executable = vi.fn(); expect(policy.groupMembers(42, { pids: () => [42], stat: () => ({ ...row, state: "Z" }), executable })).toEqual([]); expect(executable).not.toHaveBeenCalled();
  });
  it("accepts a confirmed zombie transition after executable metadata vanishes", () => {
    let reads = 0;
    expect(policy.groupMembers(42, { pids: () => [42], stat: () => ++reads === 1 ? row : { ...row, state: "Z" }, executable: () => { throw gone(); } })).toEqual([]);
  });
  it("retains an unreadable relevant member even if its later state is not a confirmed zombie", () => {
    let reads = 0;
    expect(() => policy.groupMembers(42, { pids: () => [42], stat: () => ++reads === 1 ? row : { ...row, state: "X" }, executable: () => { throw gone(); } })).toThrow("gone");
  });
});

it("selects supported custom-server Webpack without widening config roots or worker settings", () => {
  const actual = { turbopack: { root: "/workspace/owned" }, experimental: { cpus: 1, webpackBuildWorker: true }, typescript: { tsconfigPath: "tsconfig.next.json" }, serverExternalPackages: ["provider-sdk"] };
  const options = policy.ownedNextOptions({ root: "/workspace/owned", dist: "/workspace/owned/.next/visual-fixture", appPort: 38001, actual });
  expect(options).toEqual({ dev: true, webpack: true, dir: "/workspace/owned", hostname: "127.0.0.1", port: 38001, conf: { ...actual, experimental: { ...actual.experimental, reactDebugChannel: false }, distDir: ".next/visual-fixture", typescript: { tsconfigPath: ".next/visual-fixture/tsconfig.json" } } });
  expect(options.conf.turbopack).toBe(actual.turbopack); expect(options.conf.experimental).toEqual({ ...actual.experimental, reactDebugChannel: false }); expect(actual.experimental).not.toHaveProperty("reactDebugChannel"); expect(options.conf.serverExternalPackages).toBe(actual.serverExternalPackages);
});
