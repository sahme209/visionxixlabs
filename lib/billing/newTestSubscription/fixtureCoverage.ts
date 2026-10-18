import type { Prisma } from "@prisma/client";
import type { Contract, Intent } from "./service";
import { paidIdentity, validateEvidence, validateObservation, type CoverageObservation, type PaidInvoiceEvidence } from "./paidCoverage";

/** Explicitly executed only by owned-fixture setup, never a production migration. */
export const fixtureCoverageDDL = [
  `CREATE TABLE "NewTestPaidInvoiceEvidence" (digest text PRIMARY KEY, runtime text NOT NULL, account text NOT NULL, invoice text NOT NULL, org text NOT NULL, intent text NOT NULL, body jsonb NOT NULL, UNIQUE(runtime,account,invoice), UNIQUE(digest,org), FOREIGN KEY(intent,org) REFERENCES "RecurringSubscriptionIntent"(id,org), CHECK (body->>'digest' IS NOT DISTINCT FROM digest AND body->>'runtimeId' IS NOT DISTINCT FROM runtime AND body->>'accountId' IS NOT DISTINCT FROM account AND body->>'invoiceId' IS NOT DISTINCT FROM invoice AND body->>'organizationId' IS NOT DISTINCT FROM org AND body->>'originatingIntentId' IS NOT DISTINCT FROM intent))`,
  'CREATE TABLE "OrganizationTestCoverageObservation" (org text PRIMARY KEY REFERENCES "OrganizationTestSubscriptionContract"(org), "originalDigest" text NOT NULL, "evidenceDigest" text, revision integer NOT NULL CHECK(revision>0), body jsonb NOT NULL, FOREIGN KEY("originalDigest",org) REFERENCES "NewTestPaidInvoiceEvidence"(digest,org), FOREIGN KEY("evidenceDigest",org) REFERENCES "NewTestPaidInvoiceEvidence"(digest,org))',
  `CREATE FUNCTION freeze_test_paid_evidence() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'paid_evidence_immutable'; END $$`,
  'CREATE TRIGGER freeze_test_paid_evidence BEFORE UPDATE OR DELETE ON "NewTestPaidInvoiceEvidence" FOR EACH ROW EXECUTE FUNCTION freeze_test_paid_evidence()',
  `CREATE FUNCTION freeze_test_original_collection() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF TG_OP='DELETE' OR OLD.org IS DISTINCT FROM NEW.org OR OLD."originalDigest" IS DISTINCT FROM NEW."originalDigest" THEN RAISE EXCEPTION 'original_collection_immutable'; END IF; IF NEW.revision<>OLD.revision+1 THEN RAISE EXCEPTION 'coverage_revision_changed'; END IF; RETURN NEW; END $$`,
  'CREATE TRIGGER freeze_test_original_collection BEFORE UPDATE OR DELETE ON "OrganizationTestCoverageObservation" FOR EACH ROW EXECUTE FUNCTION freeze_test_original_collection()',
];
export async function readFixtureCoverage(tx: Prisma.TransactionClient, org: string): Promise<{ observation: CoverageObservation; originalEvidence: PaidInvoiceEvidence; revision: number } | null> {
  const rows = await tx.$queryRawUnsafe<Array<{ body: CoverageObservation; original: PaidInvoiceEvidence; current: PaidInvoiceEvidence | null; revision: number }>>('SELECT o.body,o.revision,e.body AS original,c.body AS "current" FROM "OrganizationTestCoverageObservation" o JOIN "NewTestPaidInvoiceEvidence" e ON e.digest=o."originalDigest" LEFT JOIN "NewTestPaidInvoiceEvidence" c ON c.digest=o."evidenceDigest" WHERE o.org=$1', org);
  const row = rows[0]; if (!row) return null;
  if (row.body.collection.kind === "collected" ? !row.current || JSON.stringify(row.current) !== JSON.stringify(row.body.collection.evidence) : row.current !== null) throw new Error("paid_coverage_unavailable");
  if (!Number.isSafeInteger(row.revision) || row.revision < 1) throw new Error("paid_coverage_unavailable");
  return { observation: row.body, originalEvidence: row.original, revision: row.revision };
}
export async function writeFixtureCoverage(tx: Prisma.TransactionClient, contract: Contract, intent: Intent, observation: CoverageObservation) {
  const identity = paidIdentity(contract, intent); validateObservation(identity, contract.eventToken, observation);
  const prior = await readFixtureCoverage(tx, contract.organizationId);
  if (prior) validateEvidence(identity, prior.originalEvidence);
  const evidence = observation.collection.kind === "collected" ? observation.collection.evidence : null;
  if (!prior && !evidence) throw new Error("initial_collection_required");
  if (evidence) {
    await tx.$executeRawUnsafe('INSERT INTO "NewTestPaidInvoiceEvidence" (digest,runtime,account,invoice,org,intent,body) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb) ON CONFLICT (runtime,account,invoice) DO NOTHING', evidence.digest, evidence.runtimeId, evidence.accountId, evidence.invoiceId, evidence.organizationId, evidence.originatingIntentId, JSON.stringify(evidence));
    const saved = await tx.$queryRawUnsafe<Array<{ digest: string }>>('SELECT digest FROM "NewTestPaidInvoiceEvidence" WHERE runtime=$1 AND account=$2 AND invoice=$3 AND org=$4 AND intent=$5', evidence.runtimeId, evidence.accountId, evidence.invoiceId, evidence.organizationId, evidence.originatingIntentId);
    if (saved[0]?.digest !== evidence.digest) throw new Error("paid_evidence_immutable");
  }
  const written = await tx.$executeRawUnsafe('INSERT INTO "OrganizationTestCoverageObservation" (org,"originalDigest","evidenceDigest",revision,body) VALUES ($1,$2,$3,1,$4::jsonb) ON CONFLICT(org) DO UPDATE SET "evidenceDigest"=EXCLUDED."evidenceDigest",body=EXCLUDED.body,revision="OrganizationTestCoverageObservation".revision+1 WHERE "OrganizationTestCoverageObservation".revision=$5', contract.organizationId, prior?.originalEvidence.digest ?? evidence!.digest, evidence?.digest ?? null, JSON.stringify(observation), prior?.revision ?? 0);
  if (written !== 1) throw new Error("coverage_snapshot_changed");
}
