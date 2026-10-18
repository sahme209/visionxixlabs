import { afterEach, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { EventEmitter } from "node:events";
import vm from "node:vm";
const require = createRequire(import.meta.url);
const helperPath = "../../scripts/fixtures/ecsCheckedInputDiagnostics.cjs";
const directories: string[] = [];
afterEach(() => { vi.restoreAllMocks(); for (const directory of directories.splice(0)) fs.rmSync(directory, { recursive: true, force: true }); });
function owner() { const recorder = require(helperPath).createDiagnostics("owner", "a".repeat(40)); directories.push(recorder.directory); return recorder; }
it("records the failed work phase separately from cleanup and preserves null vs observed zero", () => {
  const recorder = owner(); recorder.update({ stage: "child_running" }); recorder.fail(new Error("private secret")); recorder.update({ cleanupChild: "verified", guardDenied: 0 }); expect(recorder.write()).toBe(true);
  const record = JSON.parse(fs.readFileSync(path.join(recorder.directory, "owner.json"), "utf8"));
  expect(record).toMatchObject({ sourceCommit: "a".repeat(40), stage: "child_running", failureStage: "child_running", outcome: "failed", classification: "unknown", guardDenied: 0, mappedRequests: null, cleanupChild: "verified", cleanupContainer: "unobserved" });
  expect(fs.statSync(recorder.directory).mode & 0o777).toBe(0o700); expect(fs.statSync(path.join(recorder.directory, "owner.json")).mode & 0o777).toBe(0o600);
  expect(fs.readdirSync(recorder.directory)).toEqual(["owner.json"]);
});
it("constructs closed bounded records without evaluating getters, toJSON, Error payloads or arbitrary fields", () => {
  const recorder = owner(), trap = vi.fn(() => { throw new Error("secret getter"); });
  const malicious = { stage: "https://private.invalid/key", sourceCommit: "secret", guardDenied: 9e20, mappedRequests: -1, cleanupWire: "https://private", env: process.env, key: "SECRET", toJSON: trap };
  Object.defineProperty(malicious, "completedGroups", { get: trap }); recorder.update(malicious);
  const error = Object.create(null); Object.defineProperty(error, "name", { get: trap }); Object.defineProperty(error, "message", { get: trap }); error.toJSON = trap;
  recorder.fail(error); recorder.update(new Proxy({}, { getOwnPropertyDescriptor: () => { throw new Error("SECRET proxy"); } })); expect(recorder.write()).toBe(true);
  const text = fs.readFileSync(path.join(recorder.directory, "owner.json"), "utf8"); expect(text.length).toBeLessThan(8192); expect(text).not.toMatch(/SECRET|https:|"env"|"key"|stack|message|toJSON/); expect(trap).not.toHaveBeenCalled();
  expect(JSON.parse(text)).toMatchObject({ stage: "initializing", sourceCommit: "a".repeat(40), guardDenied: 1000000, mappedRequests: null, completedGroups: null, classification: "unknown" });
});
it.each([['AssertionError', undefined, 'assertion'], ['Error', 'EPERM', 'permission_denied'], ['AbortError', undefined, 'timeout_or_abort'], ['PrismaClientKnownRequestError', undefined, 'prisma_client_error'], ['Error', 'MODULE_NOT_FOUND', 'module_unavailable']])("classifies only closed safe descriptors %s/%s", (name, code, classification) => { const recorder = owner(); recorder.fail(Object.assign(new Error("postgresql://SECRET"), { name, code })); expect(recorder.snapshot().classification).toBe(classification); });
it("refuses symlink files and replaced/permissive directories without touching their targets", () => {
  const recorder = owner(), other = owner(); const target = path.join(other.directory, "owner.json"); other.write(); const before = fs.readFileSync(target, "utf8"); fs.symlinkSync(target, path.join(recorder.directory, "owner.json")); expect(recorder.write()).toBe(false); expect(fs.readFileSync(target, "utf8")).toBe(before);
  fs.unlinkSync(path.join(recorder.directory, "owner.json")); fs.chmodSync(recorder.directory, 0o755); expect(recorder.write()).toBe(false);
  expect(require(helperPath).createDiagnostics("child", "a".repeat(40), other.directory + "/../").write()).toBe(false);
});
it("refuses wrong ownership and write failures without replacing an original fatal or cleanup error", async () => {
  const recorder = owner(); const original = new Error("original fatal SECRET"), cleanup = new Error("original cleanup SECRET");
  vi.spyOn(fs, "writeFileSync").mockImplementation(() => { throw new Error("SECRET diagnostic writer failure"); });
  expect(() => recorder.fail(original)).not.toThrow(); expect(recorder.write()).toBe(false);
  const monitor = require(helperPath).fatalObserver(recorder, () => { throw new Error("SECRET report failure"); }); expect(() => monitor(original)).not.toThrow();
  await expect((async () => { try { throw original; } finally { recorder.fail(cleanup); recorder.write(); } })()).rejects.toBe(original);
  await expect((async () => { try { recorder.write(); } finally { throw cleanup; } })()).rejects.toBe(cleanup);
  vi.restoreAllMocks(); const stat = fs.lstatSync(recorder.directory); vi.spyOn(fs, "lstatSync").mockReturnValue(Object.assign(Object.create(Object.getPrototypeOf(stat)), stat, { uid: stat.uid + 1 })); expect(recorder.write()).toBe(false);
});
it("retains failure after later progress/completion and attaches only to the fixed private directory", () => {
  const recorder = owner(); recorder.fail({ code: "EPERM" }); recorder.update({ outcome: "completed", stage: "completed", caseIndex: 5, completedGroups: 4 });
  expect(recorder.snapshot().outcome).toBe("failed"); const child = require(helperPath).createDiagnostics("child", "a".repeat(40), recorder.directory); expect(child.write()).toBe(true); expect(fs.existsSync(path.join(recorder.directory, "child.json"))).toBe(true);
});

it("binds the checked source once and retains the primary failure stage through disconnect", () => {
  const recorder = require(helperPath).createDiagnostics("owner", null); directories.push(recorder.directory);
  recorder.bindSource("secret"); expect(recorder.snapshot().sourceCommit).toBeNull(); recorder.bindSource("b".repeat(40)); recorder.bindSource("c".repeat(40));
  recorder.update({ stage: "source_case" }); recorder.fail({ code: "EPERM" }); recorder.update({ stage: "disconnect" }); recorder.fail(new Error("cleanup SECRET"));
  expect(recorder.snapshot()).toMatchObject({ sourceCommit: "b".repeat(40), failureStage: "source_case", stage: "disconnect", classification: "permission_denied", outcome: "failed" });
});
it("records only closed per-operation counts and observed cleanup, never request contents", () => {
  const recorder = owner(); expect(recorder.snapshot().wireAssumeRole).toBeNull(); recorder.wireSummary({ requests: ["AssumeRole", "AssumeRole", "Bundle", "https://SECRET"], guardProcesses: 1, pendingResponses: 0, violation: false });
  recorder.containerFailure(new Error("owned_local_auth_http_cleanup_unverified"));
  expect(recorder.snapshot()).toMatchObject({ wireAssumeRole: 2, wireBundle: 1, wireDescribeImages: 0, wireRequests: 4, wireViolation: false, cleanupContainer: "unverified" });
  recorder.write(); expect(fs.readFileSync(path.join(recorder.directory, "owner.json"), "utf8")).not.toContain("SECRET");
});
it.each(["openSync", "fchmodSync", "writeFileSync", "renameSync"] as const)("contains %s writer failure without changing fatal outcome or leaving temporary files", method => {
  const recorder = owner(); recorder.update({ stage: "prisma_import" }); recorder.fail(new Error("SECRET fatal"));
  vi.spyOn(fs, method).mockImplementation(() => { throw new Error("SECRET writer"); }); expect(recorder.write()).toBe(false); expect(recorder.snapshot()).toMatchObject({ failureStage: "prisma_import", outcome: "failed" });
  expect(fs.readdirSync(recorder.directory)).toEqual([]);
});
it("still writes a failure stage when guard counters throw and never lets observer callbacks replace fatal", () => {
  const recorder = owner(); recorder.update({ stage: "guard_installing" });
  const observer = require(helperPath).fatalObserver(recorder, () => { throw new Error("SECRET report"); }); observer(new Error("SECRET fatal"));
  expect(JSON.parse(fs.readFileSync(path.join(recorder.directory, "owner.json"), "utf8"))).toMatchObject({ failureStage: "guard_installing", guardDenied: null, outcome: "failed" });
  const bad = () => { throw new Error("SECRET callback"); }; expect(() => require(helperPath).fatalObserver({ fail: bad, update: bad, write: bad }, bad)(new Error("SECRET original"))).not.toThrow();
});

it("records exact preload startup failure through a monitor without installing fatal/rejection handlers or importing an SDK", () => {
  const recorder = owner(), fixtureProcess = Object.assign(new EventEmitter(), { env: { AXIOM_OWNED_ECS_CHECKED_INPUTS: "1", AXIOM_OWNED_ECS_SOURCE_COMMIT: "a".repeat(40), AXIOM_OWNED_ECS_DIAGNOSTIC_DIRECTORY: recorder.directory, AXIOM_OWNED_ECS_ORIGIN: "invalid-SECRET-url" } });
  const preload = path.resolve(__dirname, "../../scripts/fixtures/ownedEcsCheckedInputPreload.cjs"), preloadRequire = createRequire(preload);
  const context = vm.createContext({ process: fixtureProcess, module: { exports: {} }, require: (name: string) => { if (!name.startsWith("node:") && name !== "./ecsCheckedInputDiagnostics.cjs") throw new Error("unexpected non-builtin import"); return preloadRequire(name); } });
  expect(() => vm.runInContext(fs.readFileSync(preload, "utf8"), context)).toThrow();
  expect(fixtureProcess.listenerCount("uncaughtExceptionMonitor")).toBe(1); expect(fixtureProcess.listenerCount("uncaughtException")).toBe(0); expect(fixtureProcess.listenerCount("unhandledRejection")).toBe(0);
  fixtureProcess.emit("uncaughtExceptionMonitor", new Error("SECRET token/headers https://secret.invalid postgresql://secret"));
  const contents = fs.readFileSync(path.join(recorder.directory, "child.json"), "utf8"); expect(contents).not.toContain("SECRET"); expect(JSON.parse(contents)).toMatchObject({ failureStage: "guard_installing", guardDenied: null, outcome: "failed" });
});
it("retains exact probe pre-async failure stage without importing TypeScript, SDK or DB", () => {
  const recorder = owner(), probe = path.resolve(__dirname, "../../scripts/fixtures/ecsCheckedInputSourceProbe.cjs"), probeRequire = createRequire(probe);
  const context = vm.createContext({ process: { env: {} }, __dirname: path.dirname(probe), require: (name: string) => { if (!name.startsWith("node:")) throw new Error("unexpected application import"); return probeRequire(name); }, [Symbol.for("axiom.owned.ecs.checked-input.diagnostics")]: recorder });
  let original: unknown; try { vm.runInContext(fs.readFileSync(probe, "utf8"), context); } catch (error) { original = error; }
  expect(original).toBeDefined(); require(helperPath).fatalObserver(recorder)(original);
  expect(recorder.snapshot()).toMatchObject({ failureStage: "source_graph_scan", outcome: "failed", guardDenied: null });
});
it("classifies exact guard failure without serializing assertion expected/actual or Error metadata", () => {
  const recorder = owner(); recorder.fail(Object.assign(new Error("owned_ecs_egress_denied"), { expected: "SECRET", actual: "SECRET", stack: "SECRET", headers: { authorization: "SECRET" } })); recorder.write();
  expect(recorder.snapshot().classification).toBe("guard_denied"); expect(fs.readFileSync(path.join(recorder.directory, "owner.json"), "utf8")).not.toContain("SECRET");
});
