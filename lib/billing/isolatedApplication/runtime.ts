/** Server-selected, default-off local application lane. No request value can
 * select this lane. Enabling it with an invalid target fails closed. */
export function isolatedRuntimeRequested(): boolean {
  const value = typeof process === "undefined" ? undefined : process.env.AXIOM_ISOLATED_PUBLIC_TEST_RUNTIME;
  return value !== undefined && value !== "false";
}
export function denyIsolatedExternalIO(): void {
  if (isolatedRuntimeRequested()) throw new Error("isolated_provider_io_disabled");
}
export function isolatedHttpAllowed(path: string, method: string): boolean {
  if (!isolatedRuntimeRequested()) return true;
  const auth: Record<string, readonly string[]> = {
    "/api/auth/csrf": ["GET"], "/api/auth/session": ["GET"], "/api/auth/providers": ["GET"],
    "/api/auth/callback/credentials": ["POST"], "/api/auth/signout": ["GET", "POST"],
  };
  if (Object.prototype.hasOwnProperty.call(auth, path)) return auth[path].includes(method);
  return method === "GET" && ["/auth/signin", "/auth/error", "/control/usage-billing"].includes(path)
    || method === "POST" && path === "/api/ai/generate";
}

export function denyIsolatedUnsupportedOperation(): void {
  if (isolatedRuntimeRequested()) throw new Error("isolated_entrypoint_unsupported");
}
