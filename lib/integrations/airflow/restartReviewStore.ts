import "server-only";
import { createHash } from "node:crypto";
import type { RestartReviewRecord } from "./restartReview";
export interface ReviewSql { $queryRawUnsafe<T = unknown>(sql: string, ...values: unknown[]): Promise<T> }
export const AIRFLOW_REVIEW_PROPOSAL_CHECKSUM = "4c251a03fa186aa03c8b16d6071307c3daa79290ff0d0547bf6444eaebf9b8a3";
const guardChecksum = "e583b3c26ae9cedad035f65e6ece36a121c44fecb9800faa7493e84de8586ea6";
const columns = ["AirflowExecutionReviewFeature:version:integer:true", "AirflowExecutionReviewFeature:proposalChecksum:text:true",
  ...["executionId:text", "organizationId:text", "automationId:text", "payload:jsonb", "digest:text", "createdAt:timestamp(3) without time zone"].map(c => `AirflowExecutionReview:${c}:true`)].sort();
const constraints = ['PRIMARY KEY (version)', `CHECK ((version = 1))`, `CHECK (("proposalChecksum" ~ '^[a-f0-9]{64}$'::text))`,
  'PRIMARY KEY ("executionId")', 'FOREIGN KEY ("executionId") REFERENCES "AirflowAutomationExecution"(id)', 'FOREIGN KEY ("automationId") REFERENCES "AirflowAutomation"(id)',
  'CHECK ((octet_length((payload)::text) <= 16384))', `CHECK ((digest ~ '^[a-f0-9]{64}$'::text))`].sort();
export async function restartReviewReadiness(db: ReviewSql): Promise<"ready" | "not_installed" | "drift" | "unavailable"> {
  try {
    const [tables] = await db.$queryRawUnsafe<Array<{ feature: boolean; review: boolean }>>(`SELECT to_regclass('public."AirflowExecutionReviewFeature"') IS NOT NULL AS feature,to_regclass('public."AirflowExecutionReview"') IS NOT NULL AS review`);
    if (!tables) return "unavailable";
    if (!tables.feature && !tables.review) return "not_installed";
    if (!tables.feature || !tables.review) return "drift";
    const markers = await db.$queryRawUnsafe<Array<{ version: number; proposalChecksum: string }>>('SELECT "version","proposalChecksum" FROM public."AirflowExecutionReviewFeature" LIMIT 2');
    if (markers.length !== 1 || markers[0].version !== 1 || markers[0].proposalChecksum !== AIRFLOW_REVIEW_PROPOSAL_CHECKSUM) return "drift";
    const [shape] = await db.$queryRawUnsafe<Array<{ columns: string[]; constraints: string[]; guard: string; config: string[]; triggers: number[] }>>(`SELECT
      ARRAY(SELECT c.relname||':'||a.attname||':'||format_type(a.atttypid,a.atttypmod)||':'||a.attnotnull::text FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid
        WHERE a.attrelid IN ('public."AirflowExecutionReview"'::regclass,'public."AirflowExecutionReviewFeature"'::regclass) AND a.attnum>0 AND NOT a.attisdropped ORDER BY 1) AS columns,
      ARRAY(SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid IN ('public."AirflowExecutionReview"'::regclass,'public."AirflowExecutionReviewFeature"'::regclass) ORDER BY 1) AS constraints,
      (SELECT prosrc FROM pg_proc WHERE oid='public.axiom_airflow_review_guard_v1()'::regprocedure) AS guard,
      (SELECT proconfig FROM pg_proc WHERE oid='public.axiom_airflow_review_guard_v1()'::regprocedure) AS config,
      ARRAY(SELECT tgtype::integer FROM pg_trigger WHERE tgrelid='public."AirflowExecutionReview"'::regclass AND NOT tgisinternal AND tgenabled='O'
        AND tgname='axiom_airflow_review_guard_v1' AND tgfoid='public.axiom_airflow_review_guard_v1()'::regprocedure) AS triggers`);
    return shape && JSON.stringify(shape.columns.slice().sort()) === JSON.stringify(columns)
      && JSON.stringify(shape.constraints.slice().sort()) === JSON.stringify(constraints)
      && createHash("sha256").update(shape.guard).digest("hex") === guardChecksum
      && JSON.stringify(shape.config) === '["search_path=pg_catalog, public"]' && JSON.stringify(shape.triggers) === "[31]" ? "ready" : "drift";
  } catch { return "unavailable"; }
}
export async function readRestartReview(db: ReviewSql, organizationId: string, executionId: string): Promise<RestartReviewRecord | null> {
  const rows = await db.$queryRawUnsafe<RestartReviewRecord[]>('SELECT "executionId","organizationId","automationId","payload","digest","createdAt" FROM public."AirflowExecutionReview" WHERE "organizationId"=$1 AND "executionId"=$2', organizationId, executionId);
  return rows.length === 1 ? rows[0] : null;
}
/** Internal scheduler transaction only. No upload/backfill mutation endpoint. */
export async function insertRestartReview(db: ReviewSql, row: RestartReviewRecord): Promise<void> {
  const rows = await db.$queryRawUnsafe<Array<{ executionId: string }>>('INSERT INTO public."AirflowExecutionReview" ("executionId","organizationId","automationId","payload","digest","createdAt") VALUES ($1,$2,$3,$4::jsonb,$5,$6) RETURNING "executionId"', row.executionId, row.organizationId, row.automationId, JSON.stringify(row.payload), row.digest, row.createdAt);
  if (rows.length !== 1 || rows[0].executionId !== row.executionId) throw new Error("airflow_restart_review_unavailable");
}
