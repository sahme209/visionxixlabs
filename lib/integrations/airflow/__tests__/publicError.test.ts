import { expect, it } from "vitest";
import { publicAirflowError } from "../publicError";
it.each(['airflow_not_connected', 'airflow_connection_invalid', 'airflow_connection_changed', 'airflow_mutation_authority_unavailable', 'governance_execution_coverage_unavailable', 'airflow_url_invalid', 'airflow_https_url_required', 'airflow_deployment_url_invalid', 'airflow_private_host_blocked', 'airflow_host_not_allowed', 'airflow_auth_failed', 'airflow_auth_response_invalid', 'airflow_api_failed', 'airflow_run_response_invalid', 'airflow_task_selection_invalid', 'airflow_task_response_invalid', 'invalid_airflow_run_id', 'airflow_trigger_outcome_unknown', 'airflow_run_conflict_unconfirmed'])("preserves established code %s without its private suffix", code => {
 expect(publicAirflowError(Error(code), "airflow_unavailable")).toBe(code);
 expect(publicAirflowError(Error(`${code}:SYNTHETIC_PRIVATE`), "airflow_unavailable")).toBe(code);
});
it.each([undefined, null, "airflow_not_connected", {}, Error(""), Error("airflow_SYNTHETIC_PRIVATE"), Error("invalid_airflow_run_id_PRIVATE")])("uses only the supplied fallback for unknown input %s", error => {
 expect(publicAirflowError(error,"airflow_unavailable")).toBe("airflow_unavailable");
 expect(publicAirflowError(error,"airflow_trigger_failed")).toBe("airflow_trigger_failed");
});
