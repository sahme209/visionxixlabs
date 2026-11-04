import "server-only";
import type { PlatformGithubAppCredentialRow, SafePlatformGithubAppCredential } from "./platformGithubAppCredential";
import { PLATFORM_GITHUB_APP_SINGLETON_KEY, credentialContext } from "./platformGithubAppCredentialContext";

export interface PrivatePlatformGithubAppConfigurationDependencies {
  repo: { platformGithubAppCredential: { findUnique(args: {where: {singletonKey: string}}): Promise<PlatformGithubAppCredentialRow | null> } };
  vault: { decryptScopedCredential(encrypted: string, context: string): string };
}
/** Trusted, private composition only. No raw row or decrypted key is cached. */
export function createPrivatePlatformGithubAppConfiguration({repo,vault}: PrivatePlatformGithubAppConfigurationDependencies) {
  const findUnique = repo.platformGithubAppCredential.findUnique.bind(repo.platformGithubAppCredential);
  const decrypt = vault.decryptScopedCredential.bind(vault);
  async function row() {
    const value = await findUnique({where:{singletonKey:PLATFORM_GITHUB_APP_SINGLETON_KEY}});
    if (!value || !Number.isSafeInteger(value.appId) || value.appId < 1 || !value.encryptedPrivateKey) throw Error("private_github_configuration_unavailable");
    return value;
  }
  return Object.freeze({
    async resolveSigningConfiguration() {const value=await row();return {appConfigured:true,appId:value.appId,privateKey:decrypt(value.encryptedPrivateKey,credentialContext("privateKey"))};},
    async getGithubConfig() {const value=await row();return {appConfigured:true,appId:value.appId};},
    async readSafeConfiguration(): Promise<SafePlatformGithubAppCredential> {
      const value=await row();return {appId:value.appId,slug:value.slug,name:value.name,htmlUrl:value.htmlUrl,createdAt:value.createdAt.toISOString()};
    },
    async resolveGithubAppPrivateKey() {return decrypt((await row()).encryptedPrivateKey,credentialContext("privateKey"));},
  });
}
