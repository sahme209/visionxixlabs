import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
export function localAwsChildEnvironment(base, { appOrigin, mailOrigin, fixture }) {
  assert.ok(!Object.keys(base).some(key => key === "NODE_OPTIONS" || key === "CREDENTIAL_ENCRYPTION_KEY" || key.startsWith("AWS_")), "inherited_aws_fixture_configuration_forbidden");
  const origins = [appOrigin, mailOrigin, fixture.origin];
  for (const value of origins) {
    const url = new URL(value);
    assert.ok(url.protocol === "http:" && url.hostname === "127.0.0.1" && url.port && url.pathname === "/" && !url.search && !url.hash && !url.username && !url.password, "owned_aws_child_origins_required");
  }
  const preload = fileURLToPath(new URL("./ownedAwsHttpPreload.cjs", import.meta.url));
  assert.ok(!/\s/.test(preload), "fixture_preload_path_unsupported");
  const next = { ...base };
  delete next.HOME; // Omit inherited HOME; never alter parent environment.
  return { ...next, NODE_OPTIONS: `--require=${preload}`, AXIOM_OWNED_AWS_WIRE: "1", AXIOM_OWNED_HTTP_ORIGINS: JSON.stringify(origins), AXIOM_OWNED_AWS_ORIGIN: fixture.origin, AXIOM_OWNED_AWS_PROOF: fixture.proof,
    AWS_CONFIG_FILE: "/dev/null", AWS_SHARED_CREDENTIALS_FILE: "/dev/null", AWS_EC2_METADATA_DISABLED: "true", AWS_ENDPOINT_URL_STS: fixture.origin, AWS_ENDPOINT_URL_EC2: fixture.origin,
    AWS_SCAN_MODE: "live", AWS_CONNECTOR_BROKER_ACCESS_KEY_ID: fixture.brokerKey, AWS_CONNECTOR_BROKER_SECRET_ACCESS_KEY: fixture.secret, CREDENTIAL_ENCRYPTION_KEY: fixture.encryptionSecret };
}
