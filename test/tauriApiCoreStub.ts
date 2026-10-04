/**
 * Vitest stub for `@tauri-apps/api/core`.
 *
 * Only present in the packaged desktop app's node_modules, never in the
 * web root's. Root-level tests reach it transitively (e.g. authSession
 * tests importing desktopClient -> desktopTransport) without ever
 * invoking it — they exercise pure logic that happens to live in the
 * same module. This satisfies the resolver; it is never meant to be
 * called from a Node test.
 */
export async function invoke(): Promise<never> {
  throw new Error("@tauri-apps/api/core is not available outside the packaged desktop app");
}
