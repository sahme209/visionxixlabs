/** Opt-in, disposable LOCAL PostgreSQL proof. No external URL or migration CLI. */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { Prisma, PrismaClient } from "@prisma/client";

assert.equal(process.env.AXIOM_RUN_OAUTH_PROJECTION_REHEARSAL, "1", "explicit_local_rehearsal_required");
assert.ok(!process.env.DATABASE_URL && !process.env.DIRECT_URL, "external_database_binding_forbidden");
assert.equal(Prisma.prismaVersion.client, "5.22.0", "reviewed_prisma_version_required");
const owner = randomBytes(16).toString("hex");
const name = `axiom-oauth-projection-${owner}`;
const label = "io.axiom.oauth-projection-owner";
const password = randomBytes(24).toString("hex");
const env = { ...process.env, POSTGRES_PASSWORD: password };
// Only Docker endpoint selectors are removed; managed/proxy/CA controls survive.
for (const key of ["DOCKER_HOST", "DOCKER_CONTEXT", "DOCKER_TLS", "DOCKER_TLS_VERIFY", "DOCKER_CERT_PATH"]) delete env[key];
function docker(args) {
  const result = spawnSync("docker", ["--host=unix:///var/run/docker.sock", ...args], { env, encoding: "utf8", timeout: 15000, maxBuffer: 65536 });
  assert.equal(result.status, 0, "local_docker_operation_failed");
  return result.stdout.trim();
}
async function run() {
let client;
let launchAttempted = false;
let proof;
try {
  docker(["image", "inspect", "--format", "{{.Id}}", "postgres:17-alpine"]);
  launchAttempted = true;
  docker(["run", "--detach", "--pull=never", "--name", name, "--label", `${label}=${owner}`, "--publish", "127.0.0.1::5432", "--tmpfs", "/var/lib/postgresql/data:rw,noexec,nosuid,size=256m", "--env", "POSTGRES_PASSWORD", "--env", "POSTGRES_USER=fixture", "--env", "POSTGRES_DB=axiom_oauth_projection", "postgres:17-alpine"]);
  const binding = docker(["port", name, "5432/tcp"]);
  assert.match(binding, /^127\.0\.0\.1:[1-9][0-9]{0,4}$/);
  const port = Number(binding.split(":")[1]); assert.ok(port <= 65535);
  client = new PrismaClient({ datasources: { db: { url: `postgresql://fixture:${password}@127.0.0.1:${port}/axiom_oauth_projection?connect_timeout=1&pool_timeout=1&socket_timeout=3` } } });
  let ready = false;
  for (let attempt = 0; attempt < 30; attempt++) {
    try { await client.$connect(); ready = true; break; } catch { await new Promise(resolve => setTimeout(resolve, 250)); }
  }
  assert.ok(ready, "owned_database_not_ready");
  const [server] = await client.$queryRawUnsafe("SELECT current_setting('server_version_num')::int AS version, current_database() AS database");
  assert.ok(server.version >= 170000 && server.version < 180000, "postgres_17_required");
  assert.equal(server.database, "axiom_oauth_projection");
  const missingVerification = error => error.code === "P2022" && error.meta?.modelName === "User" && error.meta?.column === "User.emailVerifiedAt";
  const [empty] = await client.$queryRawUnsafe("SELECT count(*)::int AS count FROM pg_tables WHERE schemaname='public'");
  assert.equal(empty.count, 0, "new_empty_database_required");
  await client.$executeRawUnsafe(`CREATE TABLE "User" (
    id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT, "passwordHash" TEXT,
    image TEXT, "stripeCustomerId" TEXT UNIQUE, "stripeSubscriptionId" TEXT,
    plan TEXT, "planExpiresAt" TIMESTAMP(3), modules JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
  )`);
  const existing = "existing@example.test";
  await client.$executeRaw`INSERT INTO "User" (id,email,"updatedAt") VALUES ('existing-user',${existing},CURRENT_TIMESTAMP)`;
  const args = email => ({ where: { email }, create: { email, name: "Fixture", image: null }, update: { image: "fixture-image" } });
  for (const email of [existing, "new@example.test"]) {
    await assert.rejects(client.user.upsert(args(email)), missingVerification, "unprojected_upsert_must_reproduce_missing_column");
    const [before] = await client.$queryRaw`SELECT count(*)::int AS count FROM "User" WHERE email=${email}`;
    assert.equal(before.count, email === existing ? 1 : 0, "projected_insert_requires_absent_new_identity");
    const user = await client.user.upsert({ ...args(email), select: { id: true, email: true } });
    const [after] = await client.$queryRaw`SELECT count(*)::int AS count FROM "User" WHERE email=${email}`;
    assert.equal(after.count, 1);
    assert.equal(user.email, email);
    assert.deepEqual(Object.keys(user).sort(), ["email", "id"]);
    if (email === existing) assert.equal(user.id, "existing-user");
  }
  await assert.rejects(client.user.findUnique({ where: { email: existing } }), missingVerification, "password_schema_requirement_must_remain");
  proof = { postgres: 17, prisma: "5.22.0", unprojectedExistingAndNew: "P2022", projectedExistingAndNew: "passed", missingVerificationSchemaStillDetected: true, scope: "disposable_local_prisma_database_only" };
} finally {
  try { await client?.$disconnect(); } finally {
  if (launchAttempted) {
    // Name exists before launch, so lost run output cannot lose the cleanup target.
    assert.equal(docker(["inspect", "--format", `{{index .Config.Labels "${label}"}}`, name]), owner, "cleanup_ownership_unverified");
    docker(["rm", "--force", "--volumes", name]);
    assert.equal(docker(["ps", "--all", "--filter", `label=${label}=${owner}`, "--format", "{{.ID}}"]), "", "cleanup_absence_unverified");
  }
  }
}
console.log(JSON.stringify({ ...proof, cleanup: "owned_container_removed" }));

}
await run().catch(error => {
  const code = typeof error?.code === "string" && /^[A-Z0-9_]+$/.test(error.code) ? error.code : "local_rehearsal_failed";
  console.error(JSON.stringify({ outcome: "failed", code }));
  process.exitCode = 1;
});
