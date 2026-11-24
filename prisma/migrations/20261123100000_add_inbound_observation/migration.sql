CREATE TABLE "InboundObservation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "lane" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "deliveryDigest" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "evidence" JSONB NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InboundObservation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InboundObservation_delivery_item_key"
    ON "InboundObservation" ("organizationId", "lane", "provider", "deliveryDigest", "ordinal");

CREATE INDEX "InboundObservation_workspace_read_idx"
    ON "InboundObservation" ("organizationId", "lane", "receivedAt", "id");
