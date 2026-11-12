import "server-only";
import {createPrivateFixtureScenario} from '@/lib/governance/qualification/privateFixtureScenario';
import {createPrivateFixtureProvider} from '@/lib/governance/qualification/privateFixtureProvider';
import type {FixedFixtureScenarioInputs} from '@/lib/governance/qualification/fixtureScenarioInputs';
import type { PrismaClient } from "@/lib/prismaClient";
import type { NextRequest } from "next/server";
import { consumeToken } from "@/lib/api/rateLimiter";
import { createReleaseProviderMergeExecutionHttp } from "./releaseProviderMergeExecutionHttpCore";
import { createReleaseProviderMergeOperationHttp } from "./releaseProviderMergeOperationHttpCore";
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
import {createPrivateMergeExecutionCoverage,PRIVATE_MERGE_EXECUTION_FACTORIES} from "@/lib/governance/intelligence/privateMergeExecutionCoverage";

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
function composePrivateReleaseMerge(resources: PrivateReleaseMergeResources,fixtureInputs?:FixedFixtureScenarioInputs) {
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
  function forRequest(request: NextRequest, expectedIdentity?: {id: string; userId: string; organizationId: string}) {
      return createReleaseProviderMergeCoordinatorCore(repo, request, Object.freeze({
        fetch: transport, now,
        useScopedInstallationTokens: true,
        useVerifiedLinearTopology: true,
        mergeTopologyPolicy: "empty_effective_target",
      }), {
        resolveSession, releaseAuth: githubAuth, fetch: transport, now, enabled, governanceEnabled,
        createDrainAuthority: req => createPrivateEnrollmentDrainAuthority(req, resolveSession, now),
        executionCoverage:coverage,
        createGovernanceService: (req, suppliedRepo, scope, isEnabled) => {
          if (suppliedRepo !== repo) throw Error("private_merge_repository_changed");
          return createPrivateGovernanceMergeRequestService(req, repo, scope, isEnabled, { resolveSession, githubAuth, fetch: transport, now,executionCoverage:coverage });
        },
      }, expectedIdentity);
  }
  const handleExecution = createReleaseProviderMergeExecutionHttp({
    repo, resolveSession, consumeToken,
    createCoordinator: (suppliedRepo, request, _ports, expectedIdentity) => {
      if (suppliedRepo !== repo) throw Error("private_merge_repository_changed");
      return forRequest(request, expectedIdentity);
    },
  });
  const handleOperation = createReleaseProviderMergeOperationHttp({repo, resolveSession, consumeToken});
  const coverage=createPrivateMergeExecutionCoverage(repo,{resolveSession,now},Object.freeze({
    repo,resolveSession,releaseAuth:githubAuth,transport,forRequest,
    handlers:Object.freeze({execution:handleExecution,operation:handleOperation}),factories:PRIVATE_MERGE_EXECUTION_FACTORIES,
  }));
  const graph=Object.freeze({
    forRequest: (request: NextRequest) => forRequest(request),
    handleExecution,
    handleOperation,
    /** Internal source-owned writer composition, never a native/public export.
     * Every operation still resolves this request's actual current authority. */
    async forGovernanceRequest(request:NextRequest){
      const principal=await resolveSession(request,{requiredScope:'pipeline:read',requiredCapability:'workspace:read',requireWorkspaceMembership:true,allowApiKey:false,recordHeartbeat:false,route:'private governance composition'});
      if(!principal||principal.credentialKind!=='desktop_session')throw Error('governance_authority_required');
      const scope={organizationId:principal.organizationId,actorUserId:principal.userId,sessionId:principal.id};
      return{scope,service:createPrivateGovernanceMergeRequestService(request,repo,scope,governanceEnabled,{resolveSession,githubAuth,fetch:transport,now,executionCoverage:coverage})};
    },
  });
  const scenario=fixtureInputs?createPrivateFixtureScenario({inputs:fixtureInputs,repo,resolveSession,mintToken:tokenCodec.mintDesktopToken,now,forRequest,governanceService:async request=>(await graph.forGovernanceRequest(request)).service}):undefined;
  return {graph,scenario};
}

/** Ordinary private composition keeps its existing transport/profile. */
export function createPrivateReleaseMergeComposition(resources:PrivateReleaseMergeResources){return composePrivateReleaseMerge(resources).graph;}
/** Fixed synthetic build entry only. No URL/environment/body selector and no
 * provider fallback; scenario/private resources never enter canonical exports. */
export function createPrivateFixtureReleaseMergeComposition(resources:PrivateReleaseMergeResources,schedule:Readonly<{inputs:FixedFixtureScenarioInputs;providerPublicKey:string}>){
 let captured:ReturnType<typeof createPrivateFixtureScenario>|undefined;
 const simulated=createPrivateFixtureProvider(schedule.inputs.groups.map(g=>g.plan),schedule.providerPublicKey,{beforeProviderRead:async(...args)=>{if(!captured)throw Error('fixed_fixture_scenario_unavailable:c01');await captured.beforeProviderRead(...args)}});
 const {graph,scenario}=composePrivateReleaseMerge({...resources,fetch:simulated},schedule.inputs);if(!scenario)throw Error('fixed_fixture_scenario_unavailable:c02');captured=scenario;
 return Object.freeze({...graph,initializeFixtureScenario:scenario.initialize,afterFixtureRequestSettled:scenario.afterSettled});
}
