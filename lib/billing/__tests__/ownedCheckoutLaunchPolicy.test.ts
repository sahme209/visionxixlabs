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
    expect(policy.env).toMatchObject(env); policy.revalidate(env); policy.revalidate(policy.env);
    for (const key of ["HOME", "HTTPS_PROXY", "NODE_EXTRA_CA_CERTS", "NODE_OPTIONS", "NODE_USE_SYSTEM_CA"]) expect(() => policy.revalidate({ ...env, [key]: "changed" })).toThrow();
    expect(() => policy.revalidate({ ...env, NODE_PATH: "/workspace/arbitrary" })).toThrow();
    expect(() => p.ownedCheckoutLaunchPolicy({ NODE_PATH: "/workspace/arbitrary" }, [])).toThrow();
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
