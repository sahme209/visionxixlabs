-- Stabilization-phase persistence: five additive tables backing the
-- in-memory stores that were promoted to Prisma in the previous phases.
--
--   - SecureAuditRecord       — secure audit trail (lib/audit/auditStore.prisma.ts)
--   - OperationalMemoryRecord — long-term operational memory (lib/memory/memoryStore.prisma.ts)
--   - DesktopSessionRecord    — paired desktop sessions    (lib/desktop/desktopSessionStore.prisma.ts)
--   - DesktopHandoffRecord    — handoff bundle persistence (future use)
--   - OperationTraceSpan      — observability trace spans  (future use)
--
-- All tables are additive — no existing columns or rows are modified.
-- Safe to run via `prisma migrate deploy`.

-- ---------------------------------------------------------------------------
-- SecureAuditRecord
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "SecureAuditRecord" (
    "id"             TEXT PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "actorUserId"    TEXT,
    "actorKind"      TEXT NOT NULL,
    "action"         TEXT NOT NULL,
    "outcome"        TEXT NOT NULL,
    "entityRef"      TEXT,
    "correlationId"  TEXT NOT NULL,
    "source"         TEXT NOT NULL,
    "occurredAt"     TIMESTAMP(3) NOT NULL,
    "detail"         JSONB,
    "errorCode"      TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "SecureAuditRecord_organizationId_occurredAt_idx"
    ON "SecureAuditRecord"("organizationId", "occurredAt");
CREATE INDEX IF NOT EXISTS "SecureAuditRecord_action_idx"
    ON "SecureAuditRecord"("action");
CREATE INDEX IF NOT EXISTS "SecureAuditRecord_correlationId_idx"
    ON "SecureAuditRecord"("correlationId");

-- ---------------------------------------------------------------------------
-- OperationalMemoryRecord
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "OperationalMemoryRecord" (
    "id"             TEXT PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "actorId"        TEXT NOT NULL,
    "kind"           TEXT NOT NULL,
    "provider"       TEXT,
    "resources"      JSONB NOT NULL,
    "summary"        TEXT NOT NULL,
    "evidence"       JSONB NOT NULL,
    "outcome"        TEXT NOT NULL,
    "impact"         JSONB NOT NULL,
    "links"          JSONB NOT NULL,
    "nextAction"     JSONB,
    "occurredAt"     TIMESTAMP(3) NOT NULL,
    "recordedAt"     TIMESTAMP(3) NOT NULL
);

CREATE INDEX IF NOT EXISTS "OperationalMemoryRecord_organizationId_occurredAt_idx"
    ON "OperationalMemoryRecord"("organizationId", "occurredAt");
CREATE INDEX IF NOT EXISTS "OperationalMemoryRecord_organizationId_kind_idx"
    ON "OperationalMemoryRecord"("organizationId", "kind");
CREATE INDEX IF NOT EXISTS "OperationalMemoryRecord_organizationId_outcome_idx"
    ON "OperationalMemoryRecord"("organizationId", "outcome");

-- ---------------------------------------------------------------------------
-- DesktopSessionRecord
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "DesktopSessionRecord" (
    "id"                TEXT PRIMARY KEY,
    "userId"            TEXT NOT NULL,
    "organizationId"    TEXT NOT NULL,
    "deviceFingerprint" TEXT NOT NULL,
    "deviceLabel"       TEXT NOT NULL,
    "platform"          TEXT NOT NULL,
    "desktopVersion"    TEXT,
    "issuedAt"          TIMESTAMP(3) NOT NULL,
    "expiresAt"         TIMESTAMP(3) NOT NULL,
    "lastSeenAt"        TIMESTAMP(3) NOT NULL,
    "revokedAt"         TIMESTAMP(3),
    "revokeReason"      TEXT,
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "DesktopSessionRecord_userId_idx"
    ON "DesktopSessionRecord"("userId");
CREATE INDEX IF NOT EXISTS "DesktopSessionRecord_organizationId_idx"
    ON "DesktopSessionRecord"("organizationId");
CREATE INDEX IF NOT EXISTS "DesktopSessionRecord_expiresAt_idx"
    ON "DesktopSessionRecord"("expiresAt");

-- ---------------------------------------------------------------------------
-- DesktopHandoffRecord
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "DesktopHandoffRecord" (
    "id"              TEXT PRIMARY KEY,
    "organizationId"  TEXT NOT NULL,
    "userId"          TEXT NOT NULL,
    "executionPlanId" TEXT NOT NULL,
    "approver"        TEXT NOT NULL,
    "status"          TEXT NOT NULL,
    "rejectionReason" TEXT,
    "manifest"        JSONB NOT NULL,
    "payload"         JSONB NOT NULL,
    "preparedAt"      TIMESTAMP(3) NOT NULL,
    "expiresAt"       TIMESTAMP(3) NOT NULL,
    "deliveredAt"     TIMESTAMP(3),
    "rejectedAt"      TIMESTAMP(3),
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "DesktopHandoffRecord_organizationId_status_idx"
    ON "DesktopHandoffRecord"("organizationId", "status");
CREATE INDEX IF NOT EXISTS "DesktopHandoffRecord_userId_idx"
    ON "DesktopHandoffRecord"("userId");
CREATE INDEX IF NOT EXISTS "DesktopHandoffRecord_expiresAt_idx"
    ON "DesktopHandoffRecord"("expiresAt");

-- ---------------------------------------------------------------------------
-- OperationTraceSpan
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "OperationTraceSpan" (
    "id"             TEXT PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "traceId"        TEXT NOT NULL,
    "parentId"       TEXT,
    "name"           TEXT NOT NULL,
    "service"        TEXT NOT NULL,
    "startedAt"      TIMESTAMP(3) NOT NULL,
    "endedAt"        TIMESTAMP(3),
    "durationMs"     INTEGER,
    "status"         TEXT NOT NULL,
    "attributes"     JSONB,
    "errorMessage"   TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "OperationTraceSpan_organizationId_traceId_idx"
    ON "OperationTraceSpan"("organizationId", "traceId");
CREATE INDEX IF NOT EXISTS "OperationTraceSpan_organizationId_startedAt_idx"
    ON "OperationTraceSpan"("organizationId", "startedAt");
CREATE INDEX IF NOT EXISTS "OperationTraceSpan_traceId_idx"
    ON "OperationTraceSpan"("traceId");
