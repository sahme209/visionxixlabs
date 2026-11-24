export const publicBillingTestSchema = `
CREATE TABLE "OrgMembership" ("userId" text,"organizationId" text,role text,"acceptedAt" timestamp,PRIMARY KEY("userId","organizationId"));
CREATE TABLE "TenantBillingPlan" ("organizationId" text PRIMARY KEY,tier text,status text,"trialEndsAt" timestamp,"currentPeriodEndsAt" timestamp,"stripeCustomerId" text,"stripeSubscriptionId" text,"seatQuantity" integer,"cancelAtPeriodEnd" boolean DEFAULT false,"lastStripeEventId" text,"createdAt" timestamp DEFAULT now(),"updatedAt" timestamp DEFAULT now());
CREATE TABLE "UsageEvent" (id text PRIMARY KEY,"organizationId" text,"eventKind" text,"billedCents" integer,"billingStatus" text DEFAULT 'settled',"createdAt" timestamp DEFAULT now());
CREATE TABLE "AIUsageReservation" (id text PRIMARY KEY,"organizationId" text,"idempotencyKey" text,"reservedCents" integer,"settledCents" integer,status text,"usageEventId" text UNIQUE,"expiresAt" timestamp,"createdAt" timestamp DEFAULT now(),"updatedAt" timestamp DEFAULT now(),"releasedAt" timestamp,"settledAt" timestamp,"correlationId" text,UNIQUE("organizationId","idempotencyKey"),UNIQUE("organizationId",id));
CREATE TABLE "PipelineAICallReservation" (
  id text PRIMARY KEY,
  "organizationId" text NOT NULL,
  "workspaceReservationId" text NOT NULL UNIQUE,
  FOREIGN KEY ("organizationId","workspaceReservationId") REFERENCES "AIUsageReservation" ("organizationId",id) ON DELETE RESTRICT
);
CREATE TABLE "AddOnPurchase" (id text PRIMARY KEY,"organizationId" text,status text,"deliveredAICreditsCents" integer,"reversedAICreditsCents" integer,"validFor" text,"periodMonth" text,"refundedAt" timestamp,"appliedAt" timestamp,"createdAt" timestamp DEFAULT now());
INSERT INTO "OrgMembership" VALUES ('owner','org','owner',now()),('member','org','member',now());
`;
