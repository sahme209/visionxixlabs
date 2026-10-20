import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
const require = createRequire(import.meta.url);
const root = process.cwd();
const policy = require("../../scripts/fixtures/ownedWebsitePolicy.cjs");
const framework = require("../../scripts/fixtures/ownedWebsiteFramework.cjs");
const origin = "http://127.0.0.1:38001";
const assets = ["/vision-xix-logo.png"];
const request = (raw: string, method = "GET") => policy.allowedRequest({ method, raw, origin, assets });

describe("owned website request boundary", () => {
  it("allows only the three review pages and local static/image assets", () => {
    for (const url of ["/", "/product", "/docs/approval-workflow", "/product?_rsc=fixture", "/_next/static/chunks/main.js", "/vision-xix-logo.png", "/_next/image?url=%2Fvision-xix-logo.png&w=64&q=75"]) expect(request(url), url).toBe(true);
  });
  it.each(["/api/auth/session", "/api/terraform/apply", "/api/approvals/decide", "/dashboard", "/demo/internal_growth_automation", "//external.example/", "/product#fragment", "/_next/static/../../api/terraform/apply", "/_next/static/%2e%2e/api", "/_next/image?url=https%3A%2F%2Fexternal.example%2Fx&w=64&q=75", "/product?callbackUrl=https://external.example", "/private.txt"])("refuses non-visual request %s", path => expect(request(path)).toBe(false));
  it.each(["POST", "PUT", "PATCH", "DELETE", "CONNECT", "OPTIONS"])("refuses %s even on allowed paths", method => expect(request("/product", method)).toBe(false));
});

it("strips ambient credentials while retaining managed proxy/CA configuration", () => {
  const env = policy.childEnvironment({ PATH: "/bin", HTTPS_PROXY: "managed-proxy", NODE_EXTRA_CA_CERTS: "/managed-ca", AWS_SECRET_ACCESS_KEY: "private", DATABASE_URL: "private", HOME: "/ambient-home", GITHUB_TOKEN: "private", NEXT_PUBLIC_API_URL: "external" }, { directory: "/tmp/axiom-website-test", configPath: "/tmp/axiom-website-test/config.json" }, []);
  expect(env.HTTPS_PROXY).toBe("managed-proxy"); expect(env.NODE_EXTRA_CA_CERTS).toBe("/managed-ca");
  expect(env.HOME).toBe("/ambient-home"); expect(env.TMPDIR).toBe("/tmp/axiom-website-test/tmp");
  for (const key of ["AWS_SECRET_ACCESS_KEY", "DATABASE_URL", "LD_PRELOAD", "GITHUB_TOKEN", "NEXT_PUBLIC_API_URL"]) expect(env[key]).toBeUndefined();
  expect(env.AWS_SHARED_CREDENTIALS_FILE).toBe("/dev/null");
});

it.each(["/operator/home", "", undefined])("preserves supplied, empty or absent HOME without mutating its parent (%s)", home => {
  const parent = Object.freeze({ PATH: "/bin", ...(home === undefined ? {} : { HOME: home }) });
  const before = { ...parent };
  const child = policy.childEnvironment(parent, { directory: "/tmp/axiom-website-test", configPath: "/tmp/axiom-website-test/config.json" }, []);
  expect(child.HOME).toBe(home); expect(Object.hasOwn(child, "HOME")).toBe(home !== undefined);
  expect(parent).toEqual(before); expect(child).not.toBe(parent);
  expect(child).toMatchObject({ XDG_CONFIG_HOME: "/tmp/axiom-website-test/config", XDG_CACHE_HOME: "/tmp/axiom-website-test/cache", TMPDIR: "/tmp/axiom-website-test/tmp", AWS_CONFIG_FILE: "/dev/null", AWS_SHARED_CREDENTIALS_FILE: "/dev/null" });
});

it("forces the isolated browser through its loopback proxy without a loopback bypass", () => {
  const args = policy.chromiumArgs({ profile: "/tmp/axiom-website-test/chromium", proxyPort: 38002, cdpPort: 38003 });
  expect(args).toContain("--proxy-server=http://127.0.0.1:38002"); expect(args).toContain("--proxy-bypass-list=<-loopback>");
  expect(args).toContain("--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1"); expect(args).toContain("--disable-quic");
  expect(args).toContain("--remote-debugging-address=127.0.0.1"); expect(args).toContain("about:blank");
  expect(args.some((value: string) => /ignore-certificate|no-proxy-server|disable-web-security/.test(value))).toBe(false);
});

it("rejects reused process identities during cleanup", () => {
  const owner = { pid: 123, group: 123, start: "100", executable: "/owned/node" };
  expect(policy.sameOwner(owner, owner)).toBe(true);
  for (const change of [{ start: "101" }, { executable: "/foreign/node" }, { group: 456 }, { pid: 456 }]) expect(policy.sameOwner(owner, { ...owner, ...change })).toBe(false);
});

it("pins the real source/dependency framework and refuses Agent-context reuse", () => {
  const identity = framework.captureOwnedWebsiteFramework(root);
  expect(identity.sourceHashes["next.config.ts"]).toBe("0e92d9076a0fde2e5523d86ff9024b727fdb5a272cb2d55e0159f7d693f1ab7d");
  expect(() => framework.installOwnedWebsiteFramework({ root, role: "server", environment: { AXIOM_NEXT_AGENT_MODE: "owned-scripted-core", NODE_ENV: "development" }, identity })).toThrow("owned_framework_context");
});

it("actual isolated guard denies captured transports, native spawn, DNS and listener APIs without sending", () => {
  const script = `
    const assert=require('node:assert/strict');
    const cp=require('node:child_process'), dns=require('node:dns'), http=require('node:http'), net=require('node:net');
    const captured={spawn:cp.spawnSync,lookup:dns.lookup,promiseLookup:dns.promises.lookup,request:http.request,connect:net.connect,fetch:globalThis.fetch};
    const guard=require(${JSON.stringify(join(root, "scripts/fixtures/ownedWebsiteGuard.cjs"))}).installOwnedWebsiteGuard();
    (async()=>{
      assert.throws(()=>captured.spawn(process.execPath,['-e','process.exit(0)']),/owned_website_process_denied/);
      assert.throws(()=>captured.lookup('external.invalid',()=>{}),/owned_website_transport_denied/);
      await assert.rejects(captured.promiseLookup('external.invalid'),/owned_website_transport_denied/);
      assert.throws(()=>captured.request('http://127.0.0.1:38001/'),/owned_website_transport_denied/);
      assert.throws(()=>captured.connect({host:'127.0.0.1',port:38001}),/owned_website_transport_denied/);
      await assert.rejects(captured.fetch('http://127.0.0.1:38001/'),/fetch failed|owned_website_transport_denied/);
      assert.throws(()=>net.createServer().listen(38001),/owned_website_listener_denied/);
      assert.throws(()=>new (require('node:worker_threads').Worker)(''),/owned_website_worker_denied/);
      console.log(JSON.stringify(guard.report()));
    })().catch(error=>{console.error(String(error));process.exitCode=1});`;
  const result = JSON.parse(execFileSync(process.execPath, ["-e", script], { cwd: root, env: { PATH: process.env.PATH, NODE_ENV: "test" }, encoding: "utf8", timeout: 10000 }));
  expect(result.transport).toBeGreaterThanOrEqual(5); expect(result.process).toBe(1); expect(result.worker).toBe(1); expect(result.listener).toBe(1);
  expect(result.productionEquivalent).toBe(false);
});

it("retains explicit source qualification and owned-only cleanup in the launcher", () => {
  const source = readFileSync(join(root, "scripts/run-owned-website-visual.mjs"), "utf8");
  expect(source).toContain("--execute-reviewed"); expect(source).toContain("website_review_manifest_digest");
  expect(source).toContain("sourceUnchanged"); expect(source).toContain("400 * 1024 * 1024");
  expect(source).not.toContain("rmSync(nextRoot");
});

it("uses the pinned in-process TS API with no new process and restores the precise default", () => {
  const script = `
    const assert=require('node:assert/strict');
    const guard=require(${JSON.stringify(join(root, "scripts/fixtures/ownedWebsiteGuard.cjs"))}).installOwnedWebsiteGuard();
    const framework=require(${JSON.stringify(join(root, "scripts/fixtures/ownedWebsiteFramework.cjs"))});
    const defaults=require('next/dist/server/config-shared').defaultConfig;
    const before=Object.getOwnPropertyDescriptor(defaults.experimental,'useTypeScriptCli');
    const mode=framework.installOwnedWebsiteFramework({root:process.cwd(),role:'website-server',environment:{AXIOM_WEBSITE_VISUAL_MODE:'owned-website-visual',NODE_ENV:'development'},identity:framework.captureOwnedWebsiteFramework(process.cwd())});
    (async()=>{
      const parsed=await require('next/dist/build/load-jsconfig').default(process.cwd(),{...defaults,typescript:{tsconfigPath:'tsconfig.next.json'}});
      assert.deepEqual(parsed.jsConfig.compilerOptions.paths['@/*'],['./*']);
      assert.equal(mode.report().productionEquivalent,false);
      assert.equal(mode.report().mode,'owned-website-typescript-api');
      assert.deepEqual(guard.report(),{transport:0,process:0,worker:0,listener:0,policy:'deny-all-outbound-and-new-processes',productionEquivalent:false});
      mode.restore();assert.deepEqual(Object.getOwnPropertyDescriptor(defaults.experimental,'useTypeScriptCli'),before);
      console.log('pinned_api_without_process');
    })().catch(error=>{console.error(String(error));process.exitCode=1});`;
  expect(execFileSync(process.execPath, ["-e", script], { cwd: root, env: { ...process.env, NODE_ENV: "test" }, encoding: "utf8", timeout: 10000 }).trim()).toContain("pinned_api_without_process");
});

it("preserves reviewed managed NODE_PATH without printing or substituting its value", () => {
  if (process.env.NODE_PATH === undefined) return;
  const child = policy.childEnvironment({ NODE_PATH: process.env.NODE_PATH }, { directory: "/tmp/axiom-website-test", configPath: "/tmp/axiom-website-test/config.json" }, []);
  expect(child.NODE_PATH === process.env.NODE_PATH).toBe(true);
});
