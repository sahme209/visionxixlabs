-- A workspace-level kill switch for governed AI generation. Service credentials remain
-- server-managed; this only determines whether this organization may route a
-- request to any configured provider.
ALTER TABLE "OrganizationAIProviderPolicy"
  ADD COLUMN "enabled" BOOLEAN NOT NULL DEFAULT true;
