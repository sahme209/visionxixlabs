import { describe, expect, it } from "vitest";
import { databaseHostingMetadata } from "../../scripts/auth-recovery-database-metadata.mjs";

describe("public-safe database hosting metadata", () => {
  it.each([
    ["ep-fixture-pooler.us-east-2.aws.neon.tech", "neon"],
    ["db.fixture.supabase.co", "supabase"],
    ["aws-0-us-east-1.pooler.supabase.com", "supabase"],
    ["fixture.cluster-example.us-east-1.rds.amazonaws.com", "aws_rds"],
    ["fixture.rds.amazonaws.com.cn", "aws_rds"],
    ["fixture.postgres.database.azure.com", "azure_postgresql"],
    ["db.prisma.io", "prisma_postgres"],
    ["fixture.proxy.rlwy.net", "railway"],
    ["fixture.oregon-postgres.render.com", "render"],
    ["fixture.aivencloud.com", "aiven"],
    ["fixture.db.ondigitalocean.com", "digitalocean"],
  ])("classifies configured endpoint %s without certifying backups", (host, provider) => {
    const metadata = databaseHostingMetadata(`postgresql://private-user:private-password@${host}:5432/private-db?sslmode=require&token=private-token`);
    expect(metadata.configuredEndpointProvider).toBe(provider);
    expect(metadata.backupStatus).toBe("unverified");
    expect(metadata.restoreStatus).toBe("unverified");
    expect(metadata.applicationDatabaseBinding).toBe("not_verified");
    const serialized = JSON.stringify(metadata);
    for (const value of [host, "private-user", "private-password", "private-db", "private-token", "5432", "sslmode"]) expect(serialized).not.toContain(value);
  });
  it.each([
    "postgresql://db.neon.tech.attacker.example/db",
    "postgresql://neon.tech@unrecognized.example/db",
    "postgresql://unknown.example/db?host=ep-fixture.neon.tech",
    "postgresql://192.0.2.1/db",
  ])("does not infer a provider from lookalikes, userinfo, parameters or IPs: %s", url => {
    expect(databaseHostingMetadata(url).configuredEndpointProvider).toBe("unknown");
  });
  it.each([undefined, null, "", "not a connection string", "https://ep-fixture.neon.tech/private"])('fails closed for unavailable/unsupported configuration: %s', value => {
    expect(databaseHostingMetadata(value).configuredEndpointProvider).toBe("unknown");
  });
  it.each(["postgresql://localhost/db", "postgresql://127.0.0.1/db", "postgresql://[::1]/db"])('does not identify the backing service of a local proxy: %s', url => {
    expect(databaseHostingMetadata(url).endpointClassification).toBe("local_or_proxy_underlying_host_unverified");
  });
  it("does not confuse Prisma Accelerate with the underlying database provider", () => {
    expect(databaseHostingMetadata("prisma://accelerate.prisma-data.net/?api_key=private-token").configuredEndpointProvider).toBe("unknown");
    expect(databaseHostingMetadata("prisma://accelerate.prisma-data.net/?api_key=private-token").endpointClassification).toBe("prisma_proxy_underlying_host_unverified");
  });
});
