// Only established Airflow recovery codes may cross the public route boundary.
// Provider details and arbitrary internal messages must remain private.
const publicCodes = new Set([
  "airflow_not_connected",
  "airflow_connection_invalid",
  "airflow_connection_changed",
  "airflow_mutation_authority_unavailable",
  "governance_execution_coverage_unavailable",
  "airflow_url_invalid",
  "airflow_https_url_required",
  "airflow_deployment_url_invalid",
  "airflow_private_host_blocked",
  "airflow_host_not_allowed",
  "airflow_auth_failed",
  "airflow_auth_response_invalid",
  "airflow_api_failed",
  "airflow_run_response_invalid",
  "airflow_task_selection_invalid",
  "airflow_task_response_invalid",
  "invalid_airflow_run_id",
  "airflow_trigger_outcome_unknown",
  "airflow_run_conflict_unconfirmed",
]);

export function publicAirflowError(error: unknown, fallback: "airflow_unavailable" | "airflow_trigger_failed"): string {
  if (!(error instanceof Error)) return fallback;
  const code = error.message.split(":", 1)[0];
  return publicCodes.has(code) ? code : fallback;
}
