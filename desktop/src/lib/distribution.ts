/**
 * How this desktop build was distributed, fixed at build time. The Microsoft Store build is updated by
 * the Store, so it does not point people at the download page. Anything other than the exact value
 * "microsoft_store" is the direct download build.
 */
export type DesktopDistribution = "direct" | "microsoft_store";

export function distributionFrom(value: unknown): DesktopDistribution {
  return value === "microsoft_store" ? "microsoft_store" : "direct";
}

export const DESKTOP_DISTRIBUTION: DesktopDistribution = distributionFrom((import.meta as unknown as { env?: Record<string, unknown> }).env?.VITE_V19_DISTRIBUTION);
