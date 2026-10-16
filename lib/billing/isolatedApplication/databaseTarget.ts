import "server-only";
export function validatedIsolatedRuntime() {
  if (process.env.AXIOM_ISOLATED_PUBLIC_TEST_RUNTIME !== "true" || process.env.VERCEL || process.env.VERCEL_ENV || process.env.NODE_ENV === "production") throw new Error("isolated_runtime_unavailable");
  const target = process.env.DATABASE_URL;
  if (!target) throw new Error("isolated_database_required");
  const url = new URL(target);
  if (!["postgres:", "postgresql:"].includes(url.protocol) || url.hostname !== "127.0.0.1" || url.pathname !== "/axiom_new_test_contract_rehearsal" || url.search || url.hash) throw new Error("isolated_database_required");
  if (process.env.DIRECT_URL && process.env.DIRECT_URL !== target) throw new Error("isolated_database_binding_mismatch");
  const runtimeId = process.env.AXIOM_ISOLATED_TEST_RUNTIME_ID;
  const accountId = process.env.AXIOM_ISOLATED_TEST_ACCOUNT_ID;
  const organizations = (process.env.AXIOM_ISOLATED_TEST_ORGANIZATIONS ?? "").split(",").map(x => x.trim()).filter(Boolean);
  if (!runtimeId || !accountId || !organizations.length) throw new Error("isolated_runtime_binding_required");
  return { target, runtimeId, accountId, organizations };
}
