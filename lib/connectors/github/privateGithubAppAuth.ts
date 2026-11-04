import "server-only";
import { createGithubAppAuthCore, type GithubAppAuthDependencies, type GithubReadPermissionProfile } from "./githubAppAuthCore";

/** These dependencies are fixed by private composition, never business input. */
export function createPrivateGithubAppAuth(input: {
  configuration: Pick<GithubAppAuthDependencies,"getGithubConfig"|"resolveGithubAppPrivateKey"> & {resolveSigningConfiguration: NonNullable<GithubAppAuthDependencies["resolveSigningConfiguration"]>};
  fetch: typeof fetch;
  now: () => number;
}) {
  const core = createGithubAppAuthCore({getGithubConfig:input.configuration.getGithubConfig.bind(input.configuration),resolveGithubAppPrivateKey:input.configuration.resolveGithubAppPrivateKey.bind(input.configuration),fetch:input.fetch,now:input.now,strict:true,resolveSigningConfiguration:input.configuration.resolveSigningConfiguration.bind(input.configuration)});
  return Object.freeze({
    resolveGithubInstallationToken(request: {installationId: number; repositories: readonly string[]; permissionProfile: GithubReadPermissionProfile; signal?: AbortSignal}) {
      if (!request || request.installationId === undefined || !request.repositories || !request.permissionProfile) return Promise.resolve({ok:false as const,errorCode:"github.app_invalid_read_profile",message:"Explicit installation and repository read profile required."});
      const signal = request.signal ? AbortSignal.any([request.signal,AbortSignal.timeout(8000)]) : AbortSignal.timeout(8000);
      return core.resolveGithubInstallationToken({installationId:request.installationId,repositories:[...request.repositories],permissionProfile:request.permissionProfile,signal}).catch(() => ({ok:false as const,errorCode:signal.aborted ? "github.app_token_cancelled" : "github.app_not_configured",message:"Private installation token unavailable."}));
    },
    readGithubAppInstallation:core.readGithubAppInstallation,
    clearInstallationTokenCache:core.clearInstallationTokenCache,
    purgeInstallationTokenCache:core.purgeInstallationTokenCache,
  });
}
