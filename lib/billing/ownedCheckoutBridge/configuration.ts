// Pure server configuration checks; safe for the existing proxy's import graph.
// Header/body/query/cookie values are never inputs. Full server/IPC/DB checks
// still precede every handler; this selector alone grants no payment authority.
import type { Manifest } from "./protocol";
export type BridgeConfiguration = Manifest & { databaseUrl: string };
function denied(): never { throw new Error("owned_checkout_scope_required"); }
export function ownedCheckoutConfiguration(env: Readonly<Record<string, string | undefined>> = process.env): BridgeConfiguration | null {
  if (env.AXIOM_OWNED_CHECKOUT_BRIDGE === undefined || env.AXIOM_OWNED_CHECKOUT_BRIDGE === "false") return null;
  if (env.AXIOM_OWNED_CHECKOUT_BRIDGE !== "v1" || env.AXIOM_ISOLATED_PUBLIC_TEST_RUNTIME !== "true" || env.NODE_ENV === "production" || env.VERCEL || env.VERCEL_ENV) denied();
  const { DATABASE_URL: databaseUrl, NEXTAUTH_URL: origin, AXIOM_ISOLATED_TEST_RUNTIME_ID: runtimeId, AXIOM_ISOLATED_TEST_ACCOUNT_ID: accountId, AXIOM_ISOLATED_TEST_ORGANIZATIONS: organizationId, AXIOM_OWNED_CHECKOUT_DIRECTORY: directory, AXIOM_OWNED_CHECKOUT_SESSION: session, AXIOM_OWNED_CHECKOUT_CAPABILITY: capability } = env;
  if (!databaseUrl || !origin || !runtimeId || !accountId || !organizationId || !directory || !session || !capability) denied();
  if (![runtimeId, accountId, organizationId].every(v => /^[A-Za-z0-9_:@.-]{1,200}$/.test(v)) || !/^\/tmp\/axiom-owned-checkout-[a-f0-9]{32}$/.test(directory) || !/^[a-f0-9]{32}$/.test(session) || !/^[a-f0-9]{64}$/.test(capability)) denied();
  try {
    const db = new URL(databaseUrl), app = new URL(origin);
    if (!["postgresql:", "postgres:"].includes(db.protocol) || db.hostname !== "127.0.0.1" || !db.port || db.pathname !== "/axiom_new_test_contract_rehearsal" || db.search || db.hash || env.DIRECT_URL && env.DIRECT_URL !== databaseUrl) denied();
    if (app.protocol !== "http:" || app.hostname !== "127.0.0.1" || !app.port || app.pathname !== "/" || app.search || app.hash || app.username || app.password || app.origin !== origin) denied();
  } catch { denied(); }
  return Object.freeze({ version: "axiom_owned_checkout_v1", session, runtimeId, accountId, organizationId, origin, directory, capability, databaseUrl });
}
export function ownedCheckoutHttpAllowed(path: string, method: string, env: Readonly<Record<string, string | undefined>> = process.env): boolean {
  try {
    if (!ownedCheckoutConfiguration(env)) return false;
    return method === "GET" && path === "/plans" || method === "POST" && ["/api/billing/checkout-session", "/api/billing/stripe-webhook"].includes(path);
  } catch { return false; }
}
