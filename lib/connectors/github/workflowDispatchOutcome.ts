/** Only explicit non-accepting GitHub responses justify releasing a dispatch hold. */
export function isDefiniteWorkflowDispatchRejection(error: string): boolean {
  // Keep network failures, timeouts, server errors and unfamiliar response
  // formats held. The provider may have accepted the request before failing.
  const match = /^workflow_dispatch_failed: github_(\d{3})(?::|$)/.exec(error);
  return Boolean(match && [400, 401, 403, 404, 405, 410, 422, 429].includes(Number(match[1])));
}
