-- Platform-level singleton GitHub App credential, produced by the GitHub
-- App Manifest flow. Not per-tenant (see TenantIntegrationConnection /
-- GitHubInstallation for those). singletonKey's unique constraint enforces
-- that only one row can ever exist.
CREATE TABLE "PlatformGithubAppCredential" (
  "id" TEXT NOT NULL,
  "singletonKey" TEXT NOT NULL DEFAULT 'platform_github_app',
  "appId" INTEGER NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "encryptedClientSecret" TEXT NOT NULL,
  "encryptedWebhookSecret" TEXT NOT NULL,
  "encryptedPrivateKey" TEXT NOT NULL,
  "htmlUrl" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdByUserId" TEXT NOT NULL,

  CONSTRAINT "PlatformGithubAppCredential_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlatformGithubAppCredential_singletonKey_key" ON "PlatformGithubAppCredential"("singletonKey");
