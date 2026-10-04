/**
 * Vitest configuration.
 *
 * Essentials:
 *   • Alias "@/" to the repo root so tests pick up the same module
 *     paths Next.js uses.
 *   • Alias "server-only" to a noop. The package throws at build-time
 *     when imported into client code; in test land we treat it as a
 *     marker, not a runtime guard.
 *   • Alias the @tauri-apps/* packages the desktop app depends on to
 *     throwing stubs. They only exist in desktop/node_modules, never in
 *     the web root's, but a handful of root-level tests import pure
 *     logic (platform detection, session validation) that lives in the
 *     same desktop/src module as a top-level Tauri import. The aliases
 *     let those modules resolve so the pure logic under test actually
 *     runs under real CI, without ever needing the real native bridge.
 */

import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: [
      { find: "server-only", replacement: path.resolve(__dirname, "./test/serverOnlyStub.ts") },
      { find: "@tauri-apps/api/core", replacement: path.resolve(__dirname, "./test/tauriApiCoreStub.ts") },
      { find: "@tauri-apps/plugin-shell", replacement: path.resolve(__dirname, "./test/tauriPluginShellStub.ts") },
      { find: "@tauri-apps/plugin-store", replacement: path.resolve(__dirname, "./test/tauriPluginStoreStub.ts") },
      { find: /^@\/(.*)$/, replacement: path.resolve(__dirname, "./$1") },
    ],
  },
  test: {
    environment: "node",
    include: ["lib/**/__tests__/**/*.test.ts"],
    globals: false,
  },
});
