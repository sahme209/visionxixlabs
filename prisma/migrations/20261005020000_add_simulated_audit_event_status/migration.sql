-- The original Phase 496 AuditEvent migration (20260526240000_add_audit_event)
-- never included the `status` column, even though schema.prisma has defined
-- `status AuditEventStatus @default(pending)` on this model since commit
-- 3701f96b (long before this migration was written). That gap meant
-- production never had either the enum type or the column at all — this
-- migration originally assumed both already existed and tried to ALTER TYPE
-- ADD VALUE, which fails outright against a type that was never created.
-- Corrected to create the type (with every value the schema currently
-- defines, including "simulated") and add the missing column in one step.
CREATE TYPE "AuditEventStatus" AS ENUM ('pending', 'precheck_failed', 'applied', 'simulated', 'verified', 'failed', 'rolled_back');

-- AlterTable
ALTER TABLE "AuditEvent" ADD COLUMN "status" "AuditEventStatus" NOT NULL DEFAULT 'pending';
