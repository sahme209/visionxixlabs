-- CreateTable
CREATE TABLE "AIInvocation" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "taskType" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "latencyMs" INTEGER,
    "success" BOOLEAN NOT NULL,
    "errorMessage" TEXT,
    "tokensIn" INTEGER,
    "tokensOut" INTEGER,
    "promptHash" TEXT,
    "promptPreview" VARCHAR(200),
    "requestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIInvocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AIInvocation_userId_idx" ON "AIInvocation"("userId");

-- CreateIndex
CREATE INDEX "AIInvocation_taskType_idx" ON "AIInvocation"("taskType");

-- CreateIndex
CREATE INDEX "AIInvocation_createdAt_idx" ON "AIInvocation"("createdAt");
