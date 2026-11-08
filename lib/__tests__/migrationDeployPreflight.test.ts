import { expect, it } from "vitest";
import { readFileSync, mkdtempSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { parse } from "yaml";
import { migrationDeployProblems, inspectMigrationDeploy } from "../../scripts/migration-deploy-preflight.mjs";

const unsafe = "20261013172000_add_workspace_agent_identity";
const local = [{ name: "20260101000000_initial", checksum: "a" }, { name: unsafe, checksum: "b" }];
const applied = local.map(row => ({ ...row, finished: true, rolledBack: false }));

it("accepts matching complete history without rewriting historical evidence", () => {
  expect(migrationDeployProblems(local, applied, true)).toEqual([]);
});

it("blocks a new or rolled-back broad agent-permission backfill", () => {
  expect(migrationDeployProblems(local, applied.slice(0, 1), true)).toContain(`manual_recovery_required:${unsafe}`);
  expect(migrationDeployProblems(local, [applied[0], { ...applied[1], finished: false, rolledBack: true }], true)).toContain(`manual_recovery_required:${unsafe}`);
});

it("allows only the approved non-granting agent revision to re-run after an explicit rollback", () => {
  const approved = "fa3703cc048fe9f0f7c1285e44e01280725a2a39dd2a39e5411c52edbaca6ec4";
  const original = "761c693202763e71c7ee25f99e194fe010335cf902b5ed37124351a93d42e3f7";
  const withRevision = (checksum: string) => [local[0], { name: unsafe, checksum }];
  const rolledBack = [applied[0], { name: unsafe, checksum: original, finished: false, rolledBack: true }];
  expect(migrationDeployProblems(withRevision(approved), rolledBack, true)).toEqual([]);
  expect(migrationDeployProblems(withRevision(original), rolledBack, true)).toContain(`manual_recovery_required:${unsafe}`);
  expect(migrationDeployProblems(withRevision("other"), rolledBack, true)).toContain(`manual_recovery_required:${unsafe}`);
  const stillFailed = [...rolledBack, { name: unsafe, checksum: original, finished: false, rolledBack: false }];
  expect(migrationDeployProblems(withRevision(approved), stillFailed, true)).toContain(`manual_recovery_required:${unsafe}`);
  expect(migrationDeployProblems(withRevision(approved), [applied[0]], true)).toContain(`manual_recovery_required:${unsafe}`);
});

it("blocks unfinished, changed, unknown and absent history independently", () => {
  expect(migrationDeployProblems(local, [{ ...applied[0], finished: false }], true)).toContain(`unfinished:${local[0].name}`);
  expect(migrationDeployProblems(local, [{ ...applied[0], checksum: "modified" }, applied[1]], true)).toContain(`checksum_mismatch:${local[0].name}`);
  expect(migrationDeployProblems(local, [...applied, { name: "unknown", checksum: "c", finished: true, rolledBack: false }], true)).toContain("unknown_applied:unknown");
  expect(migrationDeployProblems(local, [], false)).toContain("migration_history_missing");
});

it("permits ordinary pending forward migrations after coherent history", () => {
  expect(migrationDeployProblems([...local, { name: "20261024000000_safe_forward", checksum: "c" }], applied, true)).toEqual([]);
});

it("checks the actual selected database in a read-only transaction without resolving or deploying", async () => {
  const statements: string[] = [];
  const tx = {
    $executeRawUnsafe: async (sql: string) => { statements.push(sql); },
    $queryRaw: async (parts: TemplateStringsArray) => {
      const sql = parts.join("?"); statements.push(sql);
      if (sql.includes("current_setting")) return [{ mode: "on" }];
      if (sql.includes("to_regclass")) return [{ present: true }];
      if (sql.includes('FROM public."_prisma_migrations"')) return applied;
      throw new Error("unexpected_query");
    },
  };
  const client = { $transaction: async (fn: (value: typeof tx) => unknown) => fn(tx) };
  expect(await inspectMigrationDeploy(client, local)).toEqual({ readOnly: true, problems: [], deployAllowed: true });
  expect(statements[0]).toBe("SET TRANSACTION READ ONLY");
  expect(statements.every(sql => /^(SET|\s*SELECT)/.test(sql))).toBe(true);
});

it("refuses a database read error instead of assuming deployable history", async () => {
  const client = { $transaction: async () => { throw Error("fixture_query_failure"); } };
  await expect(inspectMigrationDeploy(client, local)).rejects.toThrow("fixture_query_failure");
});

it("refuses a transaction which did not become read-only", async () => {
  let calls = 0;
  const client = { $transaction: async (fn: (tx: unknown) => unknown) => fn({
    $executeRawUnsafe: async () => {},
    $queryRaw: async () => { calls++; return [{ mode: "off" }]; },
  }) };
  await expect(inspectMigrationDeploy(client, local)).rejects.toThrow("read_only_transaction_required");
  expect(calls).toBe(1);
});

it("short-circuits a failed CLI preflight before any subsequent migration command", () => {
  const dir = mkdtempSync(join(tmpdir(), "axiom-migration-short-circuit-"));
  const sentinel = join(dir, "must-not-exist");
  try {
    const result = spawnSync("/bin/sh", ["-c", '"$AXIOM_FIXTURE_NODE" scripts/migration-deploy-preflight.mjs && touch "$AXIOM_FIXTURE_SENTINEL"'], {
      encoding: "utf8", timeout: 10000,
      env: { NODE_ENV: "test", PATH: "/usr/bin:/bin", AXIOM_FIXTURE_NODE: process.execPath, AXIOM_FIXTURE_SENTINEL: sentinel },
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("database_connection_unavailable");
    expect(existsSync(sentinel)).toBe(false);
  } finally { rmSync(dir, { recursive: true }); }
});

it("refuses an alternate schema before database access without exposing the URL", () => {
  const result = spawnSync(process.execPath, ["scripts/migration-deploy-preflight.mjs"], {
    encoding: "utf8", timeout: 10000,
    env: { NODE_ENV: "test", DATABASE_URL: "postgresql://private-user:private-password@127.0.0.1:1/private-db?schema=other" },
  });
  expect(result.status).toBe(1);
  expect(result.stderr).toContain("unsupported_migration_schema");
  expect(result.stderr).not.toMatch(/private-user|private-password|private-db/);
});

it("runs a read-only history preflight before the supported deployment command", () => {
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  expect(pkg.scripts["db:migrate:deploy"]).toBe("node scripts/migration-deploy-preflight.mjs && prisma migrate deploy");
});

it("never offers automatic rollback-and-replay of a partially applied production migration", () => {
  const workflow = parse(readFileSync(".github/workflows/production-db-migrate.yml", "utf8"));
  expect(workflow.on.workflow_dispatch.inputs).not.toHaveProperty("resolve_rolled_back_migration");
  const commands = workflow.jobs.migrate.steps.map((step: { run?: string }) => step.run ?? "").join("\n");
  expect(commands).not.toContain("migrate resolve");
  expect(commands).toContain("npm run db:migrate:deploy");
  expect(commands).not.toContain("npx prisma migrate deploy");
});
