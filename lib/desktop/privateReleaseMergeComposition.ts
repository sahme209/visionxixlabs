import "server-only";
import type { PrismaClient } from "@prisma/client";
import type { NextRequest } from "next/server";
import type { createPrivateCredentialVault } from "@/lib/security/privateCredentialVault";
import { createPrivateReleaseOperationPlanRepo } from "@/lib/security/privateReleaseOperationPlanRepo";
import { createPrivatePlatformGithubAppConfiguration } from "@/lib/connectors/github/privatePlatformGithubAppConfiguration";
import { createPrivateGithubAppAuth } from "@/lib/connectors/github/privateGithubAppAuth";
import { createPrivateGovernanceMergeRequestService } from "@/lib/governance/intelligence/privateGovernanceMergeRequestService";
import { createPrivateEnrollmentDrainAuthority } from "@/lib/governance/intelligence/enrollmentDrainAuthorityCore";
import { createPrivateDesktopTokenCodec } from "./privateDesktopToken";
import { createPrivateDesktopSessionService } from "./privateDesktopSession";
import { createPrivatePrismaDesktopSessionStore } from "./privateDesktopSessionStore.prisma";
import { createPrivateRequestDesktopSessionResolver } from "./privateRequestDesktopSessionResolver";
import { createPrivateDesktopCommercialAccessReader, type PrivateBillingConfiguration } from "./privateDesktopCommercialAccess";
import { createReleaseProviderMergeCoordinatorCore } from "./releaseProviderMergeCoordinatorCore";

export interface PrivateReleaseMergeResources {
  client: PrismaClient;
  vault: ReturnType<typeof createPrivateCredentialVault>;
  sessionSigningKey: Uint8Array;
  billing: PrivateBillingConfiguration;
  fetch: typeof fetch;
  now: () => number;
  enabled: () => boolean;
  governanceEnabled: () => boolean;
}

/** Trusted bootstrap composition, not a route or proof of executing custody.
 * No business request can select a repo, policy/credential adapter or transport.
 * The canonical issuer remains unavailable, including when both flags are true.
 */
export function createPrivateReleaseMergeComposition(resources: PrivateReleaseMergeResources) {
  const { client, vault, fetch: transport, now, enabled, governanceEnabled } = resources;
  const repo = createPrivateReleaseOperationPlanRepo(client);
  const tokenCodec = createPrivateDesktopTokenCodec(resources.sessionSigningKey);
  const sessions = createPrivateDesktopSessionService(createPrivatePrismaDesktopSessionStore(client), () => new Date(now()));
  const resolveSession = createPrivateRequestDesktopSessionResolver({
    repo: client, tokenCodec, sessions,
    readDesktopCommercialAccess: createPrivateDesktopCommercialAccessReader(client, resources.billing),
    selfHealPersonalWorkspaceMembership: null,
  });
  const githubAuth = createPrivateGithubAppAuth({
    configuration: createPrivatePlatformGithubAppConfiguration({ repo: client, vault }),
    fetch: transport, now,
  });
  return Object.freeze({
    forRequest(request: NextRequest) {
      return createReleaseProviderMergeCoordinatorCore(repo, request, {
        fetch: transport, now,
        useScopedInstallationTokens: true,
        useVerifiedLinearTopology: true,
        mergeTopologyPolicy: "empty_effective_target",
      }, {
        resolveSession, releaseAuth: githubAuth, fetch: transport, now, enabled, governanceEnabled,
        createDrainAuthority: req => createPrivateEnrollmentDrainAuthority(req, resolveSession, now),
        createGovernanceService: (req, suppliedRepo, scope, isEnabled) => {
          if (suppliedRepo !== repo) throw Error("private_merge_repository_changed");
          return createPrivateGovernanceMergeRequestService(req, repo, scope, isEnabled, { resolveSession, githubAuth, fetch: transport, now });
        },
      });
    },
  });
}
