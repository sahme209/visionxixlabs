import { fileURLToPath, pathToFileURL } from "node:url";
import { resolve } from "node:path";
if (!process.argv[2]) throw new Error("Pass the installed PGlite 0.3.14 module path. This script never connects to production.");
const { PGlite } = await import(pathToFileURL(resolve(process.argv[2])).href);
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
const sql = readFileSync(fileURLToPath(new URL("../ops/recovery/20261022_billing_storage_repair.sql", import.meta.url)), "utf8");
assert.equal(createHash("sha256").update(sql).digest("hex"), "4fd39c5963aeb9988642bcbec0b7a09331d5e33c37b0042310d142a3812b5907");
const base = `CREATE TABLE "AddOnPurchase" (id TEXT PRIMARY KEY, "organizationId" TEXT NOT NULL, "stripeCheckoutSessionId" TEXT, "stripePaymentIntentId" TEXT); CREATE INDEX "AddOnPurchase_stripeCheckoutSessionId_idx" ON "AddOnPurchase"("stripeCheckoutSessionId"); CREATE TABLE "UntouchedSentinel" (id INTEGER PRIMARY KEY); INSERT INTO "UntouchedSentinel" VALUES (42);`;
const checks=[];
async function fixture(operation) { const db = new PGlite(); try { await db.exec(base); await operation(db); } finally { await db.close(); } }
await fixture(async db => {
  await db.exec(sql);
  const names = (await db.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name`)).rows.map(x=>x.table_name);
  assert.deepEqual(names,["AIUsageReservation","AddOnPurchase","StripeBillingEvent","UntouchedSentinel"]);
  assert.deepEqual((await db.query('SELECT * FROM "UntouchedSentinel"')).rows,[{id:42}]);
  checks.push("exact_repair_applies_and_preserves_unrelated_rows");
  await db.exec(`INSERT INTO "StripeBillingEvent" (id,type) VALUES ('evt_fixture','fixture');`);
  await assert.rejects(db.exec(`INSERT INTO "StripeBillingEvent" (id,type) VALUES ('evt_fixture','fixture');`), /duplicate key/);
  checks.push("duplicate_webhook_event_rejected");
  await db.exec(`INSERT INTO "AIUsageReservation" (id,"organizationId","idempotencyKey","reservedCents","expiresAt","updatedAt") VALUES ('hold1','org_fixture','key_fixture',10,now(),now());`);
  await assert.rejects(db.exec(`INSERT INTO "AIUsageReservation" (id,"organizationId","idempotencyKey","reservedCents","expiresAt","updatedAt") VALUES ('hold2','org_fixture','key_fixture',10,now(),now());`),/duplicate key/);
  checks.push("duplicate_reservation_key_rejected");
  await db.exec(`INSERT INTO "AddOnPurchase" (id,"organizationId","idempotencyKey","stripeCheckoutSessionId") VALUES ('addon1','org_fixture','addon_key1','session_fixture');`);
  await assert.rejects(db.exec(`INSERT INTO "AddOnPurchase" (id,"organizationId","idempotencyKey","stripeCheckoutSessionId") VALUES ('addon2','org_fixture','addon_key2','session_fixture');`),/duplicate key/);
  checks.push("duplicate_credit_checkout_rejected");
  await assert.rejects(db.exec(sql),/billing_repair_target_changed/); await db.exec("ROLLBACK");
  checks.push("second_application_fails_closed");
});
await fixture(async db => {
  await db.exec(`INSERT INTO "AddOnPurchase" (id,"organizationId") VALUES ('existing_fixture','org_fixture');`);
  await assert.rejects(db.exec(sql),/billing_repair_requires_empty_addons/); await db.exec("ROLLBACK");
  assert.equal((await db.query(`SELECT count(*)::int AS n FROM "AddOnPurchase"`)).rows[0].n,1);
  assert.equal((await db.query(`SELECT to_regclass('public."StripeBillingEvent"') AS name`)).rows[0].name,null);
  checks.push("nonempty_target_rejected_without_data_or_partial_schema_changes");
});
await fixture(async db => {
  await db.exec('ALTER TABLE "AddOnPurchase" ADD COLUMN "idempotencyKey" TEXT');
  await assert.rejects(db.exec(sql),/billing_repair_columns_changed/); await db.exec("ROLLBACK");
  assert.equal((await db.query(`SELECT to_regclass('public."AIUsageReservation"') AS name`)).rows[0].name,null);
  checks.push("partial_existing_schema_rejected_without_partial_writes");
});
const result={engine:"PostgreSQL via PGlite 0.3.14 (WASM)",schemaFixture:true,productionDataCopied:false,productionConnections:false,checks,passed:checks.length,limitations:["Not a Neon snapshot restore rehearsal","Does not validate live concurrent lock contention","Does not verify production subscription fulfillment or entitlements"]};
if (process.argv[3]) writeFileSync(resolve(process.argv[3]),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result));
