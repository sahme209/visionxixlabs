import "server-only";
import { bytesDigest, type SavedPlanRecord } from "./savedPlanArtifact";

export const SAVED_PLAN_PROPOSAL_CHECKSUM = "127737f89aff3d46265fa52a431c6dea43d60ee2d06be376b98800e3e2e2b0a0";
const GUARD_CHECKSUM = "43b37cfcc4f702776beecd63c5aa5c356cd414c60a0d7dcb46f079bb728d7750";
export interface SavedPlanDatabase {
  $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
}
export type SavedPlanStorageReadiness = "not_installed" | "ready" | "drift" | "unavailable";

const expectedColumns = [
  "TerraformSavedPlanFeature:version:integer:true", "TerraformSavedPlanFeature:proposalChecksum:text:true",
  ...["id:text", "organizationId:text", "deploymentRequestId:text", "requestVersion:integer", "bindingJson:jsonb", "bindingDigest:text", "binaryDigest:text", "binaryBytes:integer", "showDigest:text", "encryptedBinary:text", "encryptedShow:text", "createdAt:timestamp(3) without time zone", "expiresAt:timestamp(3) without time zone"].map(c => `TerraformSavedPlanArtifact:${c}:true`),
].sort();

/** Never select a new model/column until explicit installer evidence and exact
 * optional table shape are present. Readiness failure grants no authority. */
export async function readSavedPlanStorageReadiness(db: SavedPlanDatabase): Promise<SavedPlanStorageReadiness> {
  try {
    const [tables] = await db.$queryRawUnsafe<Array<{ feature: boolean; artifact: boolean }>>(`SELECT to_regclass('public."TerraformSavedPlanFeature"') IS NOT NULL AS feature, to_regclass('public."TerraformSavedPlanArtifact"') IS NOT NULL AS artifact`);
    if (!tables) return "unavailable";
    if (!tables.feature && !tables.artifact) return "not_installed";
    if (!tables.feature || !tables.artifact) return "drift";
    const markers = await db.$queryRawUnsafe<Array<{ version: number; proposalChecksum: string }>>('SELECT "version","proposalChecksum" FROM public."TerraformSavedPlanFeature" LIMIT 2');
    if (markers.length !== 1 || markers[0].version !== 1 || markers[0].proposalChecksum !== SAVED_PLAN_PROPOSAL_CHECKSUM) return "drift";
    const [catalog] = await db.$queryRawUnsafe<Array<{ columns: string[]; constraints: string[]; guardSource: string | null; triggerTypes: number[] }>>(`SELECT
      ARRAY(SELECT c.relname||':'||a.attname||':'||format_type(a.atttypid,a.atttypmod)||':'||a.attnotnull::text
        FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid
        WHERE a.attrelid IN ('public."TerraformSavedPlanFeature"'::regclass,'public."TerraformSavedPlanArtifact"'::regclass)
          AND a.attnum>0 AND NOT a.attisdropped ORDER BY 1) AS columns,
      ARRAY(SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid IN
        ('public."TerraformSavedPlanFeature"'::regclass,'public."TerraformSavedPlanArtifact"'::regclass) ORDER BY 1) AS constraints,
      (SELECT p.prosrc FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
        WHERE p.proname='axiom_saved_plan_guard_v1' AND n.nspname='public' AND p.pronargs=0) AS "guardSource",
      ARRAY(SELECT tgtype::integer FROM pg_trigger WHERE tgrelid='public."TerraformSavedPlanArtifact"'::regclass
        AND tgname='axiom_saved_plan_guard_v1' AND tgenabled='O' AND NOT tgisinternal
        AND tgfoid='public.axiom_saved_plan_guard_v1()'::regprocedure) AS "triggerTypes"`);
    if (!catalog || JSON.stringify(catalog.columns.slice().sort()) !== JSON.stringify(expectedColumns)
      || !catalog.guardSource || bytesDigest(catalog.guardSource) !== GUARD_CHECKSUM || JSON.stringify(catalog.triggerTypes) !== "[31]") return "drift";
    const definitions = catalog.constraints.map(c => c.replace(/\s+/g, " "));
    if (definitions.length !== 12 || !definitions.includes('PRIMARY KEY (version)') || !definitions.includes('PRIMARY KEY (id)')
      || !definitions.includes('FOREIGN KEY ("deploymentRequestId") REFERENCES "TauriDeploymentRequest"(id)')
      || !definitions.includes('UNIQUE ("organizationId", "deploymentRequestId", "requestVersion", "bindingDigest", "binaryDigest")')
      || !["proposalChecksum", "bindingDigest", "binaryDigest", "showDigest"].every(c => definitions.some(d => d.includes(`"${c}" ~ '^[a-f0-9]{64}$'::text`)))
      || !definitions.some(d => d.includes('"binaryBytes" >= 1') && d.includes('"binaryBytes" <= 16777216'))
      || !definitions.some(d => d.includes('"expiresAt" > "createdAt"'))
      || !definitions.some(d => d.includes('"requestVersion" > 0')) || !definitions.some(d => /version = 1/.test(d))) return "drift";
    return "ready";
  } catch { return "unavailable"; }
}

/** Call only after readiness; the read responder owns that prerequisite. */
export function listSavedPlanRecords(db: SavedPlanDatabase, scope: { organizationId: string; requestId: string }, artifactId?: string): Promise<SavedPlanRecord[]> {
  return db.$queryRawUnsafe<SavedPlanRecord[]>(`SELECT "id","organizationId","deploymentRequestId","requestVersion","bindingJson","bindingDigest","binaryDigest","binaryBytes","createdAt","expiresAt"${artifactId === undefined ? "" : ',"showDigest","encryptedBinary","encryptedShow"'}
    FROM public."TerraformSavedPlanArtifact" WHERE "organizationId"=$1 AND "deploymentRequestId"=$2${artifactId === undefined ? "" : ' AND "id"=$3'} ORDER BY "createdAt" DESC,"id" LIMIT 21`,
  scope.organizationId, scope.requestId, ...(artifactId === undefined ? [] : [artifactId]));
}

/** Internal fixture/owned producer adapter only. No runtime mutation route. */
export async function insertSavedPlanRecord(db: SavedPlanDatabase, row: SavedPlanRecord): Promise<void> {
  const rows = await db.$queryRawUnsafe<Array<{ id: string }>>(`INSERT INTO public."TerraformSavedPlanArtifact"
    ("id","organizationId","deploymentRequestId","requestVersion","bindingJson","bindingDigest","binaryDigest","binaryBytes","showDigest","encryptedBinary","encryptedShow","createdAt","expiresAt")
    VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING "id"`, row.id, row.organizationId, row.deploymentRequestId, row.requestVersion, JSON.stringify(row.bindingJson), row.bindingDigest, row.binaryDigest, row.binaryBytes, row.showDigest, row.encryptedBinary, row.encryptedShow, row.createdAt, row.expiresAt);
  if (rows.length !== 1 || rows[0].id !== row.id) throw new Error("saved_plan_insert_unconfirmed");
}
