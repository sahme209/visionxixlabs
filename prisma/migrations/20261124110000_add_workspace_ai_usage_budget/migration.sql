CREATE TABLE "WorkspaceAIUsageBudget" (
    "organizationId" TEXT NOT NULL PRIMARY KEY,
    "monthlyLimitCents" INTEGER NOT NULL,
    "warningThresholdCents" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WorkspaceAIUsageBudget_amounts_check" CHECK (
        "monthlyLimitCents" >= 0 AND (
            "warningThresholdCents" IS NULL OR
            ("warningThresholdCents" > 0 AND "warningThresholdCents" <= "monthlyLimitCents")
        )
    )
);
