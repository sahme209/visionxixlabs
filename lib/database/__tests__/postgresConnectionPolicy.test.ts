import { expect, it, vi } from "vitest";
import { postgresConnectionOptions } from "../postgresConnectionPolicy";

it("binds explicit connection identity and never inherits PG environment credentials or targets", () => {
  vi.stubEnv("PGHOST", "ambient.invalid"); vi.stubEnv("PGUSER", "ambient"); vi.stubEnv("PGDATABASE", "ambient"); vi.stubEnv("PGPASSWORD", "ambient");
  try {
    const c = postgresConnectionOptions("postgresql://fixture@127.0.0.1:5433/owned_fixture");
    expect(c.host).toBe("127.0.0.1"); expect(c.port).toBe(5433); expect(c.user).toBe("fixture"); expect(c.database).toBe("owned_fixture");
    expect(c.password()).toBe(""); expect(c.ssl).toBe(false); expect(c.connectionString).toBeUndefined();
    expect(c.options).toBe("-c search_path=public");
  } finally { vi.unstubAllEnvs(); }
});
it("keeps remote TLS certificate checks enabled and maps finite pool/time limits", () => {
  const c=postgresConnectionOptions("postgresql://fixture:synthetic%40password@db.example/owned?sslmode=require&connection_limit=3&connect_timeout=5&pool_timeout=2&socket_timeout=7");
  expect(c.ssl).toEqual({rejectUnauthorized:true}); expect(c.password()).toBe("synthetic@password");
  expect(c.max).toBe(3); expect(c.connectionTimeoutMillis).toBe(2000); expect(c.query_timeout).toBe(7000); expect(c.statement_timeout).toBe(7000);
});
it("retains explicitly selected Unix socket and default PostgreSQL port", () => {
  const c=postgresConnectionOptions("postgresql://fixture@localhost/owned?host=%2Fprivate%2Ftmp%2Faxiom-owned");
  expect(c.host).toBe("/private/tmp/axiom-owned"); expect(c.port).toBe(5432); expect(c.ssl).toBe(false);
});
it.each([
  "postgresql://fixture@localhost:0/owned", "postgresql://host-only/owned", "postgresql://fixture@host-only/", "https://fixture:synthetic@db.example/owned",
  "postgresql://fixture:synthetic@db.example/owned?sslmode=disable", "postgresql://fixture:synthetic@db.example/owned?sslaccept=accept_invalid_certs",
  "postgresql://fixture:synthetic@db.example/owned?sslrootcert=/private/secret", "postgresql://fixture:synthetic@db.example/owned?host=other.invalid",
  "postgresql://fixture:synthetic@db.example/owned?user=other", "postgresql://fixture:synthetic@db.example/owned?schema=other",
  "postgresql://fixture:synthetic@db.example/owned?connect_timeout=0", "postgresql://fixture:synthetic@db.example/owned?connection_limit=-1",
  "postgresql://fixture:synthetic@db.example/owned?pool_timeout=1&pool_timeout=2", "postgresql://fixture:synthetic@db.example/owned?channel_binding=require",
])("refuses unsupported or ambiguous configuration without leaking it: %s", input => {
  try { postgresConnectionOptions(input); throw new Error("did_not_refuse"); } catch(error) { expect((error as Error).message).toBe("postgres_connection_configuration_unavailable"); }
});
