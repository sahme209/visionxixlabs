/**
 * Vitest stub for `@tauri-apps/plugin-store`. See tauriApiCoreStub.ts for
 * why this exists — same transitive-import situation via handoffInbox.
 */
export class Store {
  static async load(): Promise<never> {
    throw new Error("@tauri-apps/plugin-store is not available outside the packaged desktop app");
  }
}
