import { expect, it } from "vitest";
import { inspect } from "node:util";
import { postgresConnectionOptions } from "../postgresConnectionPolicy";

const base = "postgresql://synthetic_user:synthetic_password@synthetic-host.invalid/synthetic_database";
const cases: ReadonlyArray<readonly [string, string]> = [
  ["PCP_001", `${base}\n`],
  ["PCP_002", "synthetic_unparseable_target"],
  ["PCP_003", base.replace("postgresql:", "https:")],
  ["PCP_004", `${base}?synthetic_unknown_parameter=synthetic_value`],
  ["PCP_004", `${base}?schema=public&schema=public`],
  ["PCP_005", `${base}?schema=synthetic_schema`],
  ["PCP_006", `${base}?sslaccept=synthetic_policy`],
  ["PCP_007", `${base}?channel_binding=synthetic_unsupported`],
  ["PCP_008", `${base}?pgbouncer=synthetic_choice`],
  ["PCP_009", base.replace(".invalid/", ".invalid:0/")],
  ["PCP_010", `${base}?host=%2Fsynthetic_socket`],
  ["PCP_011", `${base}?sslmode=disable`],
  ["PCP_012", base.replace("synthetic_password", "%ZZsynthetic_password")],
  ["PCP_013", base.replace("synthetic_password", "%00synthetic_password")],
  ["PCP_014", `${base}?application_name=synthetic_application%00`],
  ...([
    ["connection_limit", "PCP_020", "PCP_021"],
    ["connect_timeout", "PCP_022", "PCP_023"],
    ["pool_timeout", "PCP_024", "PCP_025"],
    ["socket_timeout", "PCP_026", "PCP_027"],
    ["max_idle_connection_lifetime", "PCP_028", "PCP_029"],
  ] as const).flatMap(([name, syntax, range]) => [
    [syntax, `${base}?${name}=0`] as const,
    [range, `${base}?${name}=999999999999999999999`] as const,
  ]),
];
function refusal(target: string): Error {
  try { postgresConnectionOptions(target); } catch (error) {
    if (error instanceof Error) return error;
    throw error;
  }
  throw new Error("expected_configuration_refusal");
}
it.each(cases.map(([code, target], index) => ({ code, target, index })))(
  "attaches only the opaque fixed cause for $code case $index",
  ({ code, target }) => {
    const error = refusal(target);
    expect(error.message).toBe("postgres_connection_configuration_unavailable");
    expect(error.cause).toBe(code);
    expect(Object.getOwnPropertyNames(error).sort()).toEqual(["cause", "message", "stack"]);
    // Check the same nested error inspection shape used by server diagnostics.
    const output = inspect(new Error("synthetic_build_failure", { cause: error }), { depth: 8 });
    for (const sensitive of [target, "synthetic_user", "synthetic_password", "synthetic-host.invalid", "synthetic_database", "synthetic_unknown_parameter", "synthetic_value", "synthetic_schema", "synthetic_policy", "synthetic_choice", "synthetic_socket", "synthetic_application", "schema", "sslaccept", "sslmode", "channel_binding", "pgbouncer", "connection_limit", "connect_timeout", "pool_timeout", "socket_timeout", "max_idle_connection_lifetime", "application_name"]) {
      expect(output).not.toContain(sensitive);
    }
    expect(output).toContain(code);
    expect(JSON.stringify(error)).toBe("{}");
  },
);
it("retains earlier refusal ordering when multiple invalid conditions coexist", () => {
  expect(refusal(`${base}?schema=synthetic_schema&sslmode=disable`).cause).toBe("PCP_005");
  expect(refusal(`${base}?socket_timeout=0&application_name=`).cause).toBe("PCP_026");
  expect(refusal(`${base}?application_name=&connection_limit=0`).cause).toBe("PCP_014");
  expect(refusal(`${base}?connection_limit=0&connect_timeout=0&pool_timeout=0`).cause).toBe("PCP_020");
  expect(refusal(`${base}?connect_timeout=0&pool_timeout=0&max_idle_connection_lifetime=0`).cause).toBe("PCP_022");
  expect(refusal(`${base}?pool_timeout=0&max_idle_connection_lifetime=0`).cause).toBe("PCP_024");
});
it("preserves explicit accepted identity, TLS, binding and time conversions", () => {
  const result = postgresConnectionOptions(`${base}?schema=public&sslaccept=strict&channel_binding=disable&pgbouncer=false&sslmode=verify-full&connection_limit=7&connect_timeout=4&pool_timeout=3&socket_timeout=2&max_idle_connection_lifetime=8&application_name=synthetic_app`);
  const { password, ...rest } = result;
  expect(password()).toBe("synthetic_password");
  expect(rest).toEqual({
    host: "synthetic-host.invalid", port: 5432, user: "synthetic_user", database: "synthetic_database",
    ssl: { rejectUnauthorized: true }, max: 7, connectionTimeoutMillis: 3000,
    idleTimeoutMillis: 8000, options: "-c search_path=public", application_name: "synthetic_app",
    client_encoding: "UTF8", enableChannelBinding: false, query_timeout: 2000, statement_timeout: 2000,
  });
});
it("preserves local defaults and previously accepted empty optional selectors", () => {
  const result = postgresConnectionOptions("postgresql://synthetic_user@localhost/synthetic_database?channel_binding=&pgbouncer=&sslmode=");
  expect(result.password()).toBe("");
  expect(result).toMatchObject({ ssl: false, max: 10, connectionTimeoutMillis: 5000, idleTimeoutMillis: 300000, enableChannelBinding: false });
});
