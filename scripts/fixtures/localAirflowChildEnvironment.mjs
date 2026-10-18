import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
export function localAirflowChildEnvironment(base, { appOrigin, mailOrigin, fixture }) {
  assert.ok(!Object.keys(base).some(key => /^(NODE_OPTIONS|CREDENTIAL_ENCRYPTION_KEY|CRON_SECRET|AIRFLOW_|AXIOM_OWNED_|AWS_|AZURE_)/.test(key)), "inherited_airflow_fixture_configuration_forbidden");
  const db = new URL(base.DATABASE_URL);
  assert.ok(["postgres:", "postgresql:"].includes(db.protocol) && db.hostname === "127.0.0.1" && db.port && /^\/axiom_auth_http_[a-f0-9]{12}$/.test(db.pathname) && !db.search && !db.hash, "owned_airflow_database_required");
  for (const value of [appOrigin, mailOrigin, fixture.origin]) {
    const url = new URL(value);
    assert.ok(url.protocol === "http:" && url.hostname === "127.0.0.1" && url.port && url.pathname === "/" && !url.search && !url.hash && !url.username && !url.password, "owned_airflow_origin_required");
  }
  assert.ok(/^[a-f0-9]{32}$/.test(fixture.proof) && fixture.encryptionSecret.startsWith("synthetic-airflow-") && fixture.cronSecret.startsWith("synthetic-airflow-"), "synthetic_airflow_fixture_authority_required");
  const preload = fileURLToPath(new URL("./ownedAirflowHttpPreload.cjs", import.meta.url));
  assert.ok(!/\s/.test(preload), "fixture_preload_path_unsupported");
  const env = { ...base }; delete env.HOME;
  return { ...env, NODE_OPTIONS: `--require=${preload}`, AXIOM_OWNED_AIRFLOW_WIRE: "1", AXIOM_OWNED_AIRFLOW_HTTP_ORIGINS: JSON.stringify([appOrigin, mailOrigin]),
    AXIOM_OWNED_AIRFLOW_ORIGIN: fixture.origin, AXIOM_OWNED_AIRFLOW_PROOF: fixture.proof, AIRFLOW_ALLOWED_HOSTS: "airflow.fixture.example.test",
    CREDENTIAL_ENCRYPTION_KEY: fixture.encryptionSecret, CRON_SECRET: fixture.cronSecret };
}
