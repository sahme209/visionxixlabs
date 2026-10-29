/** Display-only callback values. Never forward OAuth codes, state or arbitrary URLs. */
const statuses: Record<string, readonly string[]> = {
  github: ["installation_recorded", "approval_requested", "missing_installation", "invalid_state", "error"],
  slack: ["consent_recorded", "declined", "invalid_state", "unavailable", "exchange_failed", "scope_insufficient", "record_failed", "authorization_required", "exchange_outcome_unknown", "record_outcome_unknown", "connection_changed"],
  teams: ["consent_recorded", "declined", "invalid_state", "unavailable", "exchange_failed", "scope_insufficient", "record_failed", "authorization_required", "exchange_outcome_unknown", "record_outcome_unknown", "connection_changed"],
  linear: ["consent_recorded", "declined", "invalid_state", "unavailable", "exchange_failed", "scope_insufficient", "record_failed", "authorization_required", "exchange_outcome_unknown", "record_outcome_unknown", "connection_changed"],
  jira: ["consent_recorded", "declined", "exchange_failed", "record_failed", "unavailable", "invalid_state", "authorization_required", "connection_exists"],
};
export type ConnectionReturnParams = { integration?: string | string[]; status?: string | string[] };
export function connectionReturnQuery(params: ConnectionReturnParams): URLSearchParams {
  const query = new URLSearchParams();
  if (typeof params.integration !== "string" || !Object.hasOwn(statuses, params.integration)) return query;
  query.set("integration", params.integration);
  if (typeof params.status === "string" && statuses[params.integration].includes(params.status)) query.set("status", params.status);
  return query;
}
