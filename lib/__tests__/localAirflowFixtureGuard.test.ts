import { createRequire } from "node:module";
import { describe, expect, it, vi } from "vitest";
import { localAirflowChildEnvironment } from "../../scripts/fixtures/localAirflowChildEnvironment.mjs";
import { airflowFixtureResponse, AIRFLOW_FIXTURE_DAG } from "../../scripts/fixtures/ownedAirflowWireFixture.mjs";
const require = createRequire(import.meta.url);
const { makeOwnedAirflowFetch, ownedAirflowLookup } = require("../../scripts/fixtures/ownedAirflowHttpPreload.cjs");
const configuration = { origins: ["http://127.0.0.1:31001", "http://127.0.0.1:31002"], wireOrigin: "http://127.0.0.1:31003", proof: "a".repeat(32) };
const fixture = { origin: configuration.wireOrigin, proof: configuration.proof, encryptionSecret: "synthetic-airflow-encryption-key-only", cronSecret: "synthetic-airflow-cron-key-only" };
describe("owned Airflow fixture fetch and DNS authority", () => {
  it("serves exact synthetic source run identity and refuses arbitrary writes, paths or credentials", () => {
    const run = { id: "synthetic-run", logicalDate: "2026-10-16T00:00:00Z" };
    expect(airflowFixtureResponse("GET", `/api/v2/dags/${AIRFLOW_FIXTURE_DAG}/dagRuns/synthetic-run`, "Bearer synthetic", "synthetic", run)).toMatchObject({ dag_id: AIRFLOW_FIXTURE_DAG, dag_run_id: run.id, state: "success" });
    expect(() => airflowFixtureResponse("POST", "/api/v2/dags", "Bearer synthetic", "synthetic", run)).toThrow("provider_writes_forbidden");
    expect(() => airflowFixtureResponse("GET", "/api/v2/variables", "Bearer synthetic", "synthetic", run)).toThrow("unknown_contract_request");
    expect(() => airflowFixtureResponse("GET", "/api/v2/dags", "Bearer foreign", "synthetic", run)).toThrow("synthetic_airflow_bearer_required");
  });
  it("maps only the fixed synthetic HTTPS GET to the literal owned wire and retains actual bearer authorization", async () => {
    const delegate = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>().mockResolvedValue(new Response("{}")); const guarded = makeOwnedAirflowFetch(configuration, delegate);
    await guarded("https://airflow.fixture.example.test/api/v2/dags?limit=1", { headers: { authorization: "Bearer synthetic-only" }, redirect: "manual" });
    expect(delegate.mock.calls[0][0]).toBe("http://127.0.0.1:31003/api/v2/dags?limit=1");
    expect(delegate.mock.calls[0][1]).toMatchObject({ method: "GET", redirect: "error", headers: { authorization: "Bearer synthetic-only", "x-axiom-fixture-guard": configuration.proof } });
    expect(ownedAirflowLookup("airflow.fixture.example.test", { all: true })).toEqual([{ address: "203.0.113.42", family: 4 }]);
  });
  it.each(["https://api.github.com/", "https://airflow.fixture.example.test.evil/api/v2/dags", "https://user@airflow.fixture.example.test/api/v2/dags", "http://airflow.fixture.example.test/api/v2/dags", "http://127.0.0.1:31003/api/v2/dags", "http://127.0.0.1:9999/", "https://airflow.fixture.example.test:444/api/v2/dags"])("refuses unmatched fetch destination %s before delegation", async url => {
    const delegate = vi.fn(); const guarded = makeOwnedAirflowFetch(configuration, delegate);
    await expect(guarded(url)).rejects.toThrow("owned_airflow_egress_denied"); expect(delegate).not.toHaveBeenCalled();
  });
  it("refuses all synthetic provider writes and unmatched DNS while allowing only the two owned local HTTP origins", async () => {
    const delegate = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>().mockResolvedValue(new Response("{}")); const guarded = makeOwnedAirflowFetch(configuration, delegate);
    await expect(guarded("https://airflow.fixture.example.test/api/v2/dags/dag/dagRuns", { method: "POST", body: "{}" })).rejects.toThrow("owned_airflow_egress_denied");
    expect(() => ownedAirflowLookup("api.github.com", {})).toThrow("owned_airflow_dns_denied");
    await guarded("http://127.0.0.1:31002/emails", { method: "POST", body: "{}" }); expect(delegate).toHaveBeenCalledOnce();
  });
});
describe("owned Airflow child environment", () => {
  const base = { DATABASE_URL: "postgresql://fixture:synthetic@127.0.0.1:31004/axiom_auth_http_0123456789ab", PATH: "/usr/bin:/bin", HOME: "/unchanged-parent", HTTPS_PROXY: "http://managed-proxy.invalid", NODE_EXTRA_CA_CERTS: "/managed/cert.pem" };
  const options = { appOrigin: configuration.origins[0], mailOrigin: configuration.origins[1], fixture };
  it("omits HOME, preserves proxy/CA and binds the exact synthetic Airflow host without inherited credentials", () => {
    const env = localAirflowChildEnvironment(base, options);
    expect(env.HOME).toBeUndefined(); expect(base.HOME).toBe("/unchanged-parent"); expect(env.HTTPS_PROXY).toBe(base.HTTPS_PROXY); expect(env.NODE_EXTRA_CA_CERTS).toBe(base.NODE_EXTRA_CA_CERTS);
    expect(env.AIRFLOW_ALLOWED_HOSTS).toBe("airflow.fixture.example.test"); expect(env.CRON_SECRET).toBe(fixture.cronSecret);
    expect(env.NODE_OPTIONS).toMatch(/--require=\/.*\/ownedAirflowHttpPreload\.cjs$/);
  });
  it.each(["NODE_OPTIONS", "CREDENTIAL_ENCRYPTION_KEY", "CRON_SECRET", "AIRFLOW_ALLOWED_HOSTS", "AWS_PROFILE", "AZURE_CLIENT_SECRET"])("rejects inherited authority override %s", key => {
    expect(() => localAirflowChildEnvironment({ ...base, [key]: "untrusted" }, options)).toThrow("inherited_airflow_fixture_configuration_forbidden");
  });
});
