-- Store one approved model per enabled provider family. Provider credentials
-- remain exclusively in service configuration and never enter this table.
ALTER TABLE "OrganizationAIProviderPolicy"
ADD COLUMN "modelSelections" JSONB NOT NULL DEFAULT '{}';
