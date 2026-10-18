import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { expect, it } from "vitest";

const require = createRequire(import.meta.url);
const policy = require("../../scripts/fixtures/ownedWebsitePolicy.cjs");
const source = readFileSync(`${process.cwd()}/scripts/run-owned-website-visual.mjs`, "utf8");
const paths = { directory: "/tmp/axiom-website-test", configPath: "/tmp/axiom-website-test/config.json" };
const selected = ["HOME", "HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "NO_PROXY", "http_proxy", "https_proxy", "all_proxy", "no_proxy", "NODE_EXTRA_CA_CERTS", "SSL_CERT_FILE", "SSL_CERT_DIR", "CODEX_PROXY_CERT", "NODE_USE_ENV_PROXY", "REQUESTS_CA_BUNDLE", "CURL_CA_BUNDLE", "AWS_CA_BUNDLE"];
const managed = { CODEX_CONTROL_FUTURE: "opaque value", CODEX_TOOL_CALL_ID: "invocation-one", CODEX_EMPTY: "", GNUPGHOME: "opaque gpg", HOME: "opaque home", HTTPS_PROXY: "opaque proxy", AWS_CA_BUNDLE: "opaque ca" };

it("preserves all own CODEX controls and GNUPGHOME without parent mutation or provider credentials", () => {
  const input = Object.freeze({ ...managed, DATABASE_URL: "private", AWS_SECRET_ACCESS_KEY: "private" });
  const child = policy.childEnvironment(input, paths, []);
  expect(child).toMatchObject(managed); expect(input).toEqual({ ...managed, DATABASE_URL: "private", AWS_SECRET_ACCESS_KEY: "private" });
  expect(child.DATABASE_URL).toBeUndefined(); expect(child.AWS_SECRET_ACCESS_KEY).toBeUndefined();
  expect(child.AWS_CONFIG_FILE).toBe("/dev/null"); expect(child.AWS_SHARED_CREDENTIALS_FILE).toBe("/dev/null");
});

it.each(["value", "", undefined])("preserves each managed selector and GNUPGHOME with exact absence (%s)", value => {
  const input = Object.fromEntries([...selected, "GNUPGHOME"].filter(() => value !== undefined).map(key => [key, value]));
  const child = policy.childEnvironment(input, paths, []);
  for (const key of [...selected, "GNUPGHOME"]) { expect(Object.hasOwn(child, key)).toBe(value !== undefined); expect(child[key]).toBe(value); }
});

it.each(["CODEX_UNKNOWN", "GNUPGHOME", ...selected])("refuses malformed or inherited %s without invoking its getter", key => {
  let reads = 0;
  const accessor = Object.defineProperty({}, key, { enumerable: true, get() { reads++; return "private"; } });
  const hidden = Object.defineProperty({}, key, { enumerable: false, value: "private" });
  for (const input of [accessor, hidden, { [key]: undefined }, { [key]: 7 }, Object.create({ [key]: "private" })]) expect(() => policy.childEnvironment(input, paths, [])).toThrow();
  expect(reads).toBe(0);
});

it("retains immutable invocation snapshots, allows fresh invocation metadata and privately pins stable selector identity", () => {
  const first = policy.captureManagedEnvironment(managed);
  expect(Object.isFrozen(first)).toBe(true); expect(Object.isFrozen(first.controls)).toBe(true); expect(Object.isFrozen(first.selectors)).toBe(true);
  const secondInput = { ...managed, CODEX_TOOL_CALL_ID: "invocation-two" };
  const second = policy.captureManagedEnvironment(secondInput);
  policy.revalidateManagedEnvironment(secondInput, second);
  expect(() => policy.revalidateManagedEnvironment(secondInput, first)).toThrow();
  expect(policy.managedSelectorIdentity(first)).toEqual(policy.managedSelectorIdentity(second));
  expect(policy.managedSelectorIdentity(first)).not.toEqual(policy.managedSelectorIdentity(policy.captureManagedEnvironment({ ...managed, HOME: "changed" })));
  expect(JSON.stringify(policy.managedSelectorIdentity(first))).not.toMatch(/opaque|invocation-one/);
});

function context(parent: Record<string, string>) {
  return { managed: policy.captureManagedEnvironment(parent), nodePath: null, gitEnv: Object.freeze({ ...policy.checkedEnvironment(parent, []), GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null" }) };
}
function functions(parent: Record<string, string>, environment: ReturnType<typeof context>) {
  const calls: Array<Record<string, string>> = [];
  const process = { env: parent, execArgv: [] };
  const managedNodePath = { revalidate() {} };
  const gitAt = source.indexOf("function git("); const gitEnd = source.indexOf("function capture(", gitAt);
  const git = vm.compileFunction(`${source.slice(gitAt, gitEnd)}; return git;`, ["policy", "managedNodePath", "process", "root", "execFileSync"])(policy, managedNodePath, process, "/owned", (_exe: string, args: string[], options: { env: Record<string, string> }) => { calls.push(options.env); return args[0] === "status" ? "" : "owned\n"; });
  const launchAt = source.indexOf("  function launch("); const launchEnd = source.indexOf("  async function waitFor(", launchAt);
  const launch = vm.compileFunction(`${source.slice(launchAt, launchEnd)}; return launch;`, ["policy", "managedNodePath", "process", "manifest", "environment", "control", "ledger", "root", "lifecycle", "realpathSync"])(policy, managedNodePath, process, { managedNodePath: null }, environment, { run: (fn: () => unknown) => fn() }, { launch: (_exe: string, _args: unknown, options: { env: Record<string, string> }) => { calls.push(options.env); return "owned"; } }, "/owned", {}, (value: string) => value);
  return { git, launch, calls };
}

it.each(["git", "server", "proxy", "browser", "capture"])("refuses added/deleted/changed live controls before %s delegates", role => {
  for (const change of ["add", "delete", "change"]) {
    const parent: Record<string, string> = { ...managed }; const environment = context(parent); const f = functions(parent, environment);
    if (change === "add") parent.CODEX_NEW = "late"; else if (change === "delete") delete parent.GNUPGHOME; else parent.CODEX_TOOL_CALL_ID = "late";
    expect(() => role === "git" ? f.git(["status"], environment) : f.launch(role, "/owned/node", [], { ...environment.gitEnv })).toThrow();
    expect(f.calls).toHaveLength(0);
  }
});

it.each(["git", "server", "proxy", "browser", "capture"])("refuses a late unsupported guard option before %s delegates", role => {
  const parent: Record<string, string> = { ...managed }; const environment = context(parent); const f = functions(parent, environment);
  parent.NODE_OPTIONS = "--require /managed-guard.cjs";
  expect(() => role === "git" ? f.git(["status"], environment) : f.launch(role, "/owned/node", [], { ...environment.gitEnv })).toThrow("website_child_options_unsupported");
  expect(f.calls).toHaveLength(0);
});

it("checks serialized child controls independently and retains all managed values for Git", () => {
  const parent = { ...managed }; const environment = context(parent); const f = functions(parent, environment);
  expect(f.git(["rev-parse"], environment)).toBe("owned"); expect(f.calls[0]).toMatchObject(managed);
  expect(f.calls[0]).toMatchObject({ GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null" });
  const altered = { ...environment.gitEnv, GNUPGHOME: "changed" };
  expect(() => f.launch("capture", "/owned/node", [], altered)).toThrow(); expect(f.calls).toHaveLength(1);
  for (const role of ["server", "proxy", "browser", "capture"]) f.launch(role, "/owned/node", [], { ...environment.gitEnv });
  expect(f.calls).toHaveLength(5);
});

it("uses captured controls for final source checks after cleanup waits, despite live drift", async () => {
  const parent = { ...managed }; const environment = context(parent); const f = functions(parent, environment);
  const start = source.indexOf("    cleaning = true;"); const end = source.indexOf("\n  }\n  if (result.status", start);
  let release: () => void = () => {}; const held = new Promise<void>(resolve => { release = resolve; });
  const writes: string[] = [];
  const run = vm.compileFunction(`return (async () => { let cleaning = false; const result = {}; ${source.slice(start, end)}; return result; })();`, ["ledger", "clearInterval", "disk", "readFileSync", "join", "directory", "nonce", "policy", "proxyPort", "writeFileSync", "logs", "git", "manifest", "environment", "control", "process"])(
    { cleanup: async () => { await held; return ["retained-unknown-owner"]; }, report: () => [] }, () => {}, 0, () => { throw Error("unavailable"); }, (...parts: string[]) => parts.join("/"), "/tmp/owned", "nonce", policy, 38001,
    (path: string) => { writes.push(path); }, [], f.git, { sourceHead: "owned", managedNodePath: null }, environment, { report: () => ({ failure: "first-failure" }) }, { stdout: { destroyed: true } },
  );
  parent.CODEX_TOOL_CALL_ID = "later"; parent.HOME = "later"; release();
  const result = await run; expect(result).toMatchObject({ status: "failed", error: "first-failure" });
  expect(f.calls).toHaveLength(2); for (const env of f.calls) expect(env).toMatchObject(managed);
  expect(writes).toContain("/tmp/owned/result.json");
});

it.each(["--require /guard.cjs", "--loader /guard.mjs", "--use-openssl-ca"])("continues to refuse unsupported %s before any helper delegate", option => {
  expect(() => policy.checkedEnvironment({ ...managed, NODE_OPTIONS: option }, [])).toThrow("website_child_options_unsupported");
  expect(() => policy.checkedEnvironment(managed, [option])).toThrow("website_child_options_unsupported");
});
