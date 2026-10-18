import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
const require = createRequire(import.meta.url);
const managed = require("../../scripts/fixtures/ownedWebsiteManagedNodePath.cjs");
const reviewedHash = "dbc7bc884f72c70bb3d320e868da710a56a621286fba48b3c6b610776b41b4fd";
const sample = "/usr/managed/modules";
const metadata = { dev: 1, ino: 11, mode: 0o40755, uid: 65534, gid: 65534, ctimeMs: 10, isDirectory: () => true, isSymbolicLink: () => false };
const io = (overrides = {}) => ({ digest: () => reviewedHash, realpath: (path: string) => path, lstat: () => metadata, writable: () => false, uid: () => 1000, ...overrides });

describe("exact managed NODE_PATH policy", () => {
  it("captures the approved raw-value hash, canonical path and every ancestor identity", () => {
    const identity = managed.capture(sample, io());
    expect(identity).toMatchObject({ valueSha256: reviewedHash, realpath: sample });
    expect(identity.ancestors.map((row: { path: string }) => row.path)).toEqual([sample, "/usr/managed", "/usr", "/"]);
    expect(managed.revalidate(sample, identity, io())).toEqual(identity);
  });
  it("keeps absent NODE_PATH distinct from a pinned managed selector", () => {
    expect(managed.capture(undefined, io())).toBeNull();
    expect(() => managed.revalidate(undefined, managed.capture(sample, io()), io())).toThrow("website_managed_node_path_changed");
  });
  it.each(["", ":", "/usr/managed/modules:", "/usr/managed/modules:/opt/other", "relative", "/tmp/managed", "/workspace/managed", "/usr/managed/../modules", "/usr//managed/modules"])("refuses malformed/out-of-class entry %s even with a claimed known hash", raw => expect(() => managed.capture(raw, io())).toThrow("website_managed_node_path_unsupported"));
  it("refuses foreign raw values before inspecting the filesystem", () => {
    let reads = 0;
    expect(() => managed.capture(sample, io({ digest: () => "0".repeat(64), lstat: () => { reads++; return metadata; } }))).toThrow("website_managed_node_path_unsupported");
    expect(reads).toBe(0);
  });
  it.each([
    { realpath: () => "/usr/replaced" },
    { lstat: () => ({ ...metadata, isSymbolicLink: () => true }) },
    { lstat: () => ({ ...metadata, isDirectory: () => false }) },
    { lstat: () => ({ ...metadata, mode: 0o40777 }) },
    { lstat: () => ({ ...metadata, uid: 1000 }) },
    { writable: () => true },
  ])("rejects substituted, writable or non-directory trees", changes => expect(() => managed.capture(sample, io(changes))).toThrow("website_managed_node_path_unsupported"));
  it("refuses writable ancestors even when the leaf passes", () => {
    expect(() => managed.capture(sample, io({ lstat: (path: string) => path === "/usr" ? { ...metadata, mode: 0o40775 } : metadata }))).toThrow("website_managed_node_path_unsupported");
  });
  it("binds reviewed inode/device/ownership metadata against later replacement", () => {
    const identity = managed.capture(sample, io());
    for (const mutation of [{ ino: 12 }, { dev: 2 }, { gid: 0 }, { ctimeMs: 20 }]) expect(() => managed.revalidate(sample, identity, io({ lstat: () => ({ ...metadata, ...mutation }) }))).toThrow();
  });
});

it("accepts the explicitly reviewed uid/gid0 profile and pins it distinctly", () => {
  const rootIO = io({ lstat: () => ({ ...metadata, uid: 0, gid: 0 }) });
  const identity = managed.capture(sample, rootIO);
  expect(identity.profile).toBe("system-0"); expect(managed.revalidate(sample, identity, rootIO)).toEqual(identity);
  expect(() => managed.revalidate(sample, managed.capture(sample, io()), rootIO)).toThrow("website_managed_node_path_changed");
});
it.each([{ uid: 0, gid: 65534 }, { uid: 65534, gid: 0 }])("refuses mixed system ownership profiles %o", pair => {
  expect(() => managed.capture(sample, io({ lstat: () => ({ ...metadata, ...pair }) }))).toThrow("website_managed_node_path_unsupported");
});
