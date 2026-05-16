/**
 * Next.js auto-loaded instrumentation hook.
 *
 * Runs exactly once per server instance at the very start of the
 * Node.js runtime. We use it to wire the persistence stores — when
 * `DATABASE_URL` is set, the Prisma-backed adapters take over for audit,
 * desktop sessions, and (via getMemoryStore()) operational memory.
 *
 * The hook is intentionally idempotent and best-effort: if anything fails
 * we log and fall back to the in-memory defaults rather than crash boot.
 */

export async function register(): Promise<void> {
  // Edge / browser bundles must not run server-only modules.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  try {
    const { configureStoresFromEnv } = await import("@/lib/platform/storeFactory");
    const result = await configureStoresFromEnv();
    if (result.mode === "prisma") {
      console.info(`[platform] Stores configured: prisma — ${JSON.stringify(result.wired)}`);
    } else {
      console.info(`[platform] Stores configured: in-memory — ${result.reason}`);
    }
  } catch (err) {
    console.error("[platform] Store factory failed to boot — falling back to in-memory defaults.", err);
  }
}
