/**
 * Vitest stub for `@tauri-apps/plugin-shell`. See tauriApiCoreStub.ts for
 * why this exists — same transitive-import situation via desktopPairing.
 */
export async function open(): Promise<void> {
  throw new Error("@tauri-apps/plugin-shell is not available outside the packaged desktop app");
}
