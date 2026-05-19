/**
 * Vitest configuration.
 *
 * Two essentials:
 *   • Alias "@/" to the repo root so tests pick up the same module
 *     paths Next.js uses.
 *   • Alias "server-only" to a noop. The package throws at build-time
 *     when imported into client code; in test land we treat it as a
 *     marker, not a runtime guard.
 */

import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: [
      { find: "server-only", replacement: path.resolve(__dirname, "./test/serverOnlyStub.ts") },
      { find: /^@\/(.*)$/, replacement: path.resolve(__dirname, "./$1") },
    ],
  },
  test: {
    environment: "node",
    include: ["lib/**/__tests__/**/*.test.ts"],
    globals: false,
  },
});
