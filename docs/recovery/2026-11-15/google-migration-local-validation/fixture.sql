-- FICTIONAL owned fixture only; no provider/customer state is used.
CREATE TABLE public."_prisma_migrations" (
 id VARCHAR(36) PRIMARY KEY NOT NULL,checksum VARCHAR(64) NOT NULL,
 finished_at TIMESTAMPTZ,migration_name VARCHAR(255) NOT NULL,logs TEXT,
 rolled_back_at TIMESTAMPTZ,started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 applied_steps_count INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE public."User" (
 id TEXT PRIMARY KEY,email TEXT NOT NULL,name TEXT,"passwordHash" TEXT,
 "emailVerifiedAt" TIMESTAMP(3),image TEXT,"stripeCustomerId" TEXT,
 "stripeSubscriptionId" TEXT,plan TEXT,"planExpiresAt" TIMESTAMP(3),modules JSONB,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "User_email_key" ON public."User"(email);
CREATE UNIQUE INDEX "User_stripeCustomerId_key" ON public."User"("stripeCustomerId");
INSERT INTO public."User"(id,email,name,"passwordHash","emailVerifiedAt","updatedAt")
VALUES('fictional-user','fictional@example.invalid','Local synthetic account','unused-synthetic-hash',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
