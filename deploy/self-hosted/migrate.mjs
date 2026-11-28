// Database setup for a self-hosted V19.
//
// Existing install (has a migration ledger): `prisma migrate deploy` applies new migrations, as usual.
// Fresh install: the migration history cannot be replayed from an empty database (it starts from
// tables that pre-date it), so the schema is created from prisma/schema.prisma, then the integrity
// guards (immutable-history triggers) that migrations add are created, and every existing migration is
// recorded as applied with its real checksum. Later upgrades then use `prisma migrate deploy`.
import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";

const MIGRATIONS = "prisma/migrations";
const run = (args) => execFileSync("npx", ["prisma", ...args], { stdio: "inherit" });

/** CREATE FUNCTION and CREATE TRIGGER statements from the migrations, in migration order. */
export function guardStatements(read = (name) => readFileSync(join(MIGRATIONS, name, "migration.sql"), "utf8"), names = migrationNames()) {
  const out = [];
  for (const name of names) {
    const sql = read(name);
    for (const m of sql.matchAll(/CREATE (?:OR REPLACE )?FUNCTION[\s\S]*?(\$[A-Za-z_]*\$)[\s\S]*?\1[^;]*;/g)) out.push(m[0]);
    for (const m of sql.matchAll(/CREATE TRIGGER[^;]*;/g)) out.push(m[0]);
  }
  return out;
}

export function migrationNames() {
  return readdirSync(MIGRATIONS, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
}

export function checksum(name) {
  return createHash("sha256").update(readFileSync(join(MIGRATIONS, name, "migration.sql"))).digest("hex");
}

async function main() {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const { rows } = await client.query(`SELECT to_regclass('public."_prisma_migrations"') IS NOT NULL AS ledger, to_regclass('public."User"') IS NOT NULL AS users`);
    if (rows[0].ledger) { await client.end(); run(["migrate", "deploy"]); return; }
    if (rows[0].users) throw new Error("This database has V19 tables but no migration ledger. Refusing to guess; restore from a backup or start with an empty database.");
    await client.end();
    console.log("Fresh install: creating the schema.");
    run(["db", "push"]);
    const c2 = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await c2.connect();
    try {
      await c2.query("BEGIN");
      for (const statement of guardStatements()) await c2.query(statement);
      await c2.query(`CREATE TABLE "_prisma_migrations" (
        "id" VARCHAR(36) PRIMARY KEY NOT NULL, "checksum" VARCHAR(64) NOT NULL, "finished_at" TIMESTAMPTZ,
        "migration_name" VARCHAR(255) NOT NULL, "logs" TEXT, "rolled_back_at" TIMESTAMPTZ,
        "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(), "applied_steps_count" INTEGER NOT NULL DEFAULT 0)`);
      const names = migrationNames();
      for (const name of names) await c2.query(`INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, started_at, applied_steps_count) VALUES ($1, $2, now(), $3, now(), 1)`, [randomUUID(), checksum(name), name]);
      await c2.query("COMMIT");
      console.log(`Fresh install ready: ${guardStatements().length} integrity guards, ${names.length} migrations recorded.`);
    } catch (err) { await c2.query("ROLLBACK").catch(() => {}); throw err; }
    finally { await c2.end(); }
  } catch (err) { await client.end().catch(() => {}); throw err; }
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((err) => { console.error(err instanceof Error ? err.message : err); process.exit(1); });
