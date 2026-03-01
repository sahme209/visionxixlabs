-- CreateTable
CREATE TABLE "ExecutionLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT,
    "leadId" TEXT,
    "action" TEXT NOT NULL,
    "pluginId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "params" JSONB,
    "result" JSONB,
    "error" TEXT,
    "rollbackSteps" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExecutionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExecutionLog_userId_idx" ON "ExecutionLog"("userId");

-- CreateIndex
CREATE INDEX "ExecutionLog_projectId_idx" ON "ExecutionLog"("projectId");

-- CreateIndex
CREATE INDEX "ExecutionLog_leadId_idx" ON "ExecutionLog"("leadId");

-- CreateIndex
CREATE INDEX "ExecutionLog_executedAt_idx" ON "ExecutionLog"("executedAt");
