/** Pure context contract shared by legacy and explicitly provisioned vaults. */
export const PLATFORM_GITHUB_APP_SINGLETON_KEY = "platform_github_app";
export function credentialContext(field: "clientSecret" | "webhookSecret" | "privateKey"): string {
  return `platform_github_app:${PLATFORM_GITHUB_APP_SINGLETON_KEY}:${field}`;
}
