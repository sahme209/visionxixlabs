import type { PrismaClient } from "@prisma/client";
import { createPrivatePlatformGithubAppConfiguration } from "@/lib/connectors/github/privatePlatformGithubAppConfiguration";
import { createPrivateCredentialVault } from "../privateCredentialVault";

// Compile-only: the actual generated database delegate is accepted without a cast.
export function composePrivateGithubConfiguration(repo: PrismaClient, key: Uint8Array) {
  return createPrivatePlatformGithubAppConfiguration({ repo, vault: createPrivateCredentialVault(key) });
}
