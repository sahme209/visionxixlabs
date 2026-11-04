import { generateKeyPairSync, verify } from "node:crypto";
import { afterEach, expect, it, vi } from "vitest";
import { createPrivateCredentialVault } from "../privateCredentialVault";
import { createPrivatePlatformGithubAppConfiguration } from "@/lib/connectors/github/privatePlatformGithubAppConfiguration";
import { createPrivateGithubAppAuth } from "@/lib/connectors/github/privateGithubAppAuth";
import type { PlatformGithubAppCredentialRow } from "@/lib/connectors/github/platformGithubAppCredential";

afterEach(() => vi.unstubAllEnvs());

it("composes the real vault, database-row configuration and RS256 mint path without environment resources", async () => {
  vi.stubEnv("CREDENTIAL_ENCRYPTION_KEY", "");
  vi.stubEnv("STARTER_TOKEN_SECRET", "");
  vi.stubEnv("GITHUB_PRIVATE_KEY", "");
  const vault = createPrivateCredentialVault(new Uint8Array(32).fill(7));
  const keys = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const pem = keys.privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  const row: PlatformGithubAppCredentialRow = {
    id: "synthetic-row", appId: 123, slug: "owned", name: "Owned", clientId: "synthetic-client",
    encryptedClientSecret: "unused", encryptedWebhookSecret: "unused",
    encryptedPrivateKey: vault.encryptScopedCredential(pem, "platform_github_app:platform_github_app:privateKey"),
    htmlUrl: "https://example.invalid", createdAt: new Date(0), createdByUserId: "synthetic-user",
  };
  let stored: PlatformGithubAppCredentialRow | null = row;
  const configuration = createPrivatePlatformGithubAppConfiguration({
    repo: { platformGithubAppCredential: { findUnique: async () => stored } }, vault,
  });
  const now = Date.parse("2026-11-03T00:00:00Z");
  const transport = vi.fn(async (_url: Parameters<typeof fetch>[0], options?: RequestInit) => {
    const jwt = (options?.headers as Record<string, string>).Authorization.slice(7);
    const [header, claims, signature] = jwt.split(".");
    expect(verify("RSA-SHA256", Buffer.from(`${header}.${claims}`), keys.publicKey, Buffer.from(signature, "base64url"))).toBe(true);
    expect(JSON.parse(Buffer.from(claims, "base64url").toString()).iss).toBe(123);
    expect(JSON.parse(String(options?.body))).toEqual({ repositories: ["repo"], permissions: { contents: "read" } });
    return new Response(JSON.stringify({ token: "synthetic-token", expires_at: new Date(now + 3_600_000).toISOString(), permissions: { contents: "read", metadata: "read" }, repository_selection: "selected", repositories: [{ name: "repo" }] }), { status: 201 });
  });
  const auth = createPrivateGithubAppAuth({ configuration, fetch: transport as typeof fetch, now: () => now });
  const request = { installationId: 42, repositories: ["Repo"], permissionProfile: "contents_read" as const };
  expect(await auth.resolveGithubInstallationToken(request)).toMatchObject({ ok: true, token: "synthetic-token" });
  stored = null;
  expect((await auth.resolveGithubInstallationToken(request)).ok).toBe(false);
  expect(transport).toHaveBeenCalledTimes(1);
});
