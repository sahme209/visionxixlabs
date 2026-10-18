import { describe, expect, it } from "vitest";
describe("owned bridge managed launcher policy (metadata only; no process)", () => {
  it.each(["NODE_USE_SYSTEM_CA", "NODE_V8_COVERAGE", "NODE_TLS_REJECT_UNAUTHORIZED", "LD_PRELOAD", "LD_LIBRARY_PATH", "DYLD_INSERT_LIBRARIES", "OPENSSL_CONF"])("refuses inherited %s rather than silently dropping it", async key => {
    const p = await import("./fixtures/ownedCheckoutLaunchPolicy"); expect(() => p.ownedCheckoutLaunchPolicy({ [key]: "opaque" }, [])).toThrow("owned_checkout_launch_policy_unsupported");
  });
  it("refuses production and Vercel launch contexts rather than manufacturing a development permit", async () => {
    const p = await import("./fixtures/ownedCheckoutLaunchPolicy");
    expect(() => p.ownedCheckoutLaunchPolicy({ NODE_ENV: "production" }, [])).toThrow(); expect(() => p.ownedCheckoutLaunchPolicy({ VERCEL: "1" }, [])).toThrow();
  });
  it("preserves HOME, proxy and trust selectors and revalidates the exact managed NODE_PATH metadata", async () => {
    const p = await import("./fixtures/ownedCheckoutLaunchPolicy");
    const env = { HOME: "/owned/home", HTTPS_PROXY: "opaque-proxy", NODE_EXTRA_CA_CERTS: "opaque-ca" }; const policy = p.ownedCheckoutLaunchPolicy(env, []);
    expect(policy.env).toMatchObject(env); policy.revalidate(env); policy.revalidate(policy.env, "child");
    for (const key of ["HOME", "HTTPS_PROXY", "NODE_EXTRA_CA_CERTS", "NODE_OPTIONS", "NODE_USE_SYSTEM_CA"]) expect(() => policy.revalidate({ ...env, [key]: "changed" })).toThrow();
    expect(() => policy.revalidate({ ...env, NODE_PATH: "/workspace/arbitrary" })).toThrow();
    expect(() => p.ownedCheckoutLaunchPolicy({ NODE_PATH: "/workspace/arbitrary" }, [])).toThrow();
  });
  const selectors = ["PATH", "HOME", "TMPDIR", "TMP", "TEMP", "LANG", "LC_ALL", "HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "NO_PROXY", "http_proxy", "https_proxy", "all_proxy", "no_proxy", "NODE_USE_ENV_PROXY", "NODE_EXTRA_CA_CERTS", "SSL_CERT_FILE", "SSL_CERT_DIR", "CODEX_PROXY_CERT", "REQUESTS_CA_BUNDLE", "CURL_CA_BUNDLE", "AWS_CA_BUNDLE"];
  it.each(selectors)("captures absent and exact present %s for parent and serialized child", async key => {
    const p = await import("./fixtures/ownedCheckoutLaunchPolicy");
    const absent = p.ownedCheckoutLaunchPolicy({}, []);
    expect(() => absent.revalidate({ [key]: "added" })).toThrow();
    expect(() => absent.revalidate({ ...absent.env, [key]: "added" }, "child")).toThrow();
    const inherited = { [key]: "original" }, present = p.ownedCheckoutLaunchPolicy(inherited, []);
    expect(present.env[key]).toBe("original"); present.revalidate(inherited); present.revalidate(present.env, "child");
    expect(() => present.revalidate({})).toThrow(); expect(() => present.revalidate({ [key]: "changed" })).toThrow();
    const removedChild: NodeJS.ProcessEnv = { ...present.env }; delete removedChild[key];
    expect(() => present.revalidate(removedChild, "child")).toThrow(); expect(() => present.revalidate({ ...present.env, [key]: "changed" }, "child")).toThrow();
  });
  it.each(["NODE_ENV", "NODE_OPTIONS"])("captures absent and exact %s without confusing parent and child normalization", async key => {
    const p = await import("./fixtures/ownedCheckoutLaunchPolicy"), absent = p.ownedCheckoutLaunchPolicy({}, []);
    const value = key === "NODE_ENV" ? "test" : "--max-old-space-size=4096", changed = key === "NODE_ENV" ? "development" : "--max-old-space-size=5120";
    expect(() => absent.revalidate({ [key]: value })).toThrow();
    const original = { [key]: value }, present = p.ownedCheckoutLaunchPolicy(original, []); present.revalidate(original); present.revalidate(present.env, "child");
    expect(() => present.revalidate({})).toThrow(); expect(() => present.revalidate({ [key]: changed })).toThrow();
    const removed: NodeJS.ProcessEnv = { ...present.env }; delete removed[key]; expect(() => present.revalidate(removed, "child")).toThrow();
    expect(() => present.revalidate({ ...present.env, [key]: key === "NODE_ENV" ? "test" : changed }, "child")).toThrow();
  });
  it.each(["VERCEL", "VERCEL_ENV"])("refuses %s initially and on final parent/child revalidation", async key => {
    const p = await import("./fixtures/ownedCheckoutLaunchPolicy"), absent = p.ownedCheckoutLaunchPolicy({}, []);
    for (const value of ["production", "preview", "development", "1", ""]) {
      expect(() => p.ownedCheckoutLaunchPolicy({ [key]: value }, [])).toThrow();
      expect(() => absent.revalidate({ [key]: value })).toThrow(); expect(() => absent.revalidate({ ...absent.env, [key]: value }, "child")).toThrow();
    }
    // Undefined is part of the input map domain but not a process.env value.
    // Even its own-property identity cannot be silently removed or changed.
    const mapped = p.ownedCheckoutLaunchPolicy({ [key]: undefined }, []);
    mapped.revalidate({ [key]: undefined }); expect(() => mapped.revalidate({})).toThrow();
    expect(() => mapped.revalidate({ [key]: "preview" })).toThrow();
  });
  it("distinguishes parent identity from the explicitly serialized child instead of accepting either snapshot", async () => {
    const p = await import("./fixtures/ownedCheckoutLaunchPolicy"), original = { NODE_ENV: "test" }, policy = p.ownedCheckoutLaunchPolicy(original, []);
    policy.revalidate(original); policy.revalidate(policy.env, "child");
    expect(() => policy.revalidate(policy.env)).toThrow(); expect(() => policy.revalidate(original, "child")).toThrow();
    expect(() => policy.revalidate({ ...original, NODE_ENV: "production" })).toThrow();
  });
  it.each(["CODEX_HOME", "CODEX_SANDBOX_NETWORK_DISABLED", "CODEX_FUTURE_MANAGED_CONTROL", "GNUPGHOME"])("retains %s before filtering and fences dynamic parent/child changes", async key => {
    const p = await import("./fixtures/ownedCheckoutLaunchPolicy");
    const inherited = { HOME: "owned-home", [key]: "original", CODEX_EMPTY_CONTROL: "", STRIPE_SECRET_KEY: "excluded-provider" };
    const policy = p.ownedCheckoutLaunchPolicy(inherited, []), env: NodeJS.ProcessEnv = policy.env;
    expect(env[key]).toBe("original"); expect(env.CODEX_EMPTY_CONTROL).toBe(""); expect(env.HOME).toBe("owned-home"); expect(env.STRIPE_SECRET_KEY).toBeUndefined();
    policy.revalidate(inherited); policy.revalidate(env, "child");
    for (const scope of ["parent", "child"] as const) {
      const before: Record<string, string | undefined> = { ...(scope === "parent" ? inherited : env) }, removed = { ...before }; delete removed[key];
      for (const current of [removed, { ...before, [key]: "changed" }, { ...before, CODEX_NEW_MANAGED_CONTROL: "new" }]) expect(() => policy.revalidate(current, scope)).toThrow();
    }
    const absent = p.ownedCheckoutLaunchPolicy({}, []); expect(() => absent.revalidate({ [key]: "added" })).toThrow(); expect(() => absent.revalidate({ ...absent.env, [key]: "added" }, "child")).toThrow();
  });
  it("composes selected28 Prisma and Next environments with exact managed controls and existing denials", async () => {
    const p = await import("./fixtures/ownedCheckoutLaunchPolicy"), original = await import("./fixtures/newTestChildEnvironment");
    const inherited = { CODEX_HOME: "owned-code-home", CODEX_SANDBOX_NETWORK_DISABLED: "1", GNUPGHOME: "owned-gpg", HOME: "owned-home" };
    const databaseUrl = "postgresql://postgres:opaque@127.0.0.1:5999/axiom_new_test_contract_rehearsal";
    const prisma = p.ownedCheckoutPrismaEnvironment(inherited, [], databaseUrl); expect(prisma).toMatchObject({ ...inherited, CHECKPOINT_DISABLE: "1", DATABASE_URL: databaseUrl, AXIOM_ISOLATED_PUBLIC_TEST_RUNTIME: "true" });
    const policy = p.ownedCheckoutLaunchPolicy(inherited, []), next = { ...policy.env, ...original.newTestChildEnvironment(inherited, [], { databaseUrl, appOrigin: "http://127.0.0.1:4100", fontResponses: "/owned/fonts.cjs", runtimeId: "runtime", accountId: "acct-test", organizationId: "org", authSecret: "synthetic-auth" }) };
    expect(next).toMatchObject(inherited); expect(next.AXIOM_ISOLATED_PUBLIC_TEST_RUNTIME).toBe("true"); policy.revalidate(next, "child");
    expect(() => p.ownedCheckoutPrismaEnvironment(inherited, [], "postgresql://foreign.invalid/prod")).toThrow();
    // The shared helper itself remains unchanged; only this owned composition adds controls.
    expect(original.newTestPrismaEnvironment(inherited, [], databaseUrl).CODEX_HOME).toBeUndefined();
  });
  it("requires nonwritable, same metadata on every managed path ancestor; never accepts a same-name arbitrary path", async () => {
    const p = await import("./fixtures/ownedCheckoutLaunchPolicy");
    let inode = 10; const io = { digest: () => "dbc7bc884f72c70bb3d320e868da710a56a621286fba48b3c6b610776b41b4fd", realpath: (s: string) => s, uid: () => 1000, writable: () => false, lstat: () => ({ isDirectory: () => true, isSymbolicLink: () => false, uid: 0, gid: 0, mode: 0o40755, dev: 1, ino: inode, ctimeMs: 1 }) };
    const original = p.captureOwnedNodePath("/opt/managed/node_modules", io); expect(original?.ancestors.length).toBe(4);
    inode++; expect(p.captureOwnedNodePath("/opt/managed/node_modules", io)).not.toEqual(original);
    expect(() => p.captureOwnedNodePath("/opt/managed/node_modules", { ...io, writable: () => true })).toThrow();
    expect(() => p.captureOwnedNodePath("/opt/managed/node_modules", { ...io, digest: () => "foreign" })).toThrow();
  });
});
