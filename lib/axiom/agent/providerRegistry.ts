import { getCredentialProvider } from "@/lib/plugins/credentials";
import type { CloudProvider, CloudSnapshot } from "../cloudSnapshot";
import { normalizeSnapshot, type NormalizedSnapshot } from "../normalizer";

// ---------------------------------------------------------------------------
// Provider snapshot adapters — dynamic imports to avoid loading all SDKs
// ---------------------------------------------------------------------------

type SnapshotAdapter = (userId: string, credentialRef: string) => Promise<CloudSnapshot>;

const ADAPTERS: Record<CloudProvider, () => Promise<SnapshotAdapter>> = {
  aws: async () => {
    const mod = await import("@/lib/plugins/aws/snapshot-generator");
    return async (userId, credentialRef) => {
      const creds = await getCredentialProvider().getAWSCredentials(userId, credentialRef);
      if (!creds) throw new Error("AWS credentials not found — check your cloud connector settings.");
      return mod.generateAWSSnapshot(creds);
    };
  },
  azure: async () => {
    const mod = await import("@/lib/plugins/azure/snapshot-generator");
    return async (userId, credentialRef) => {
      const creds = await getCredentialProvider().getAzureCredentials(userId, credentialRef);
      if (!creds) throw new Error("Azure credentials not found — check your cloud connector settings.");
      return mod.generateAzureSnapshot(creds.credential, creds.subscriptionId);
    };
  },
  gcp: async () => {
    const mod = await import("@/lib/plugins/gcp/snapshot-generator");
    return async (userId, credentialRef) => {
      const creds = await getCredentialProvider().getGCPCredentials(userId, credentialRef);
      if (!creds) throw new Error("GCP credentials not found — check your cloud connector settings.");
      return mod.generateGCPSnapshot(creds.credentials, creds.projectId);
    };
  },
};

// ---------------------------------------------------------------------------
// Public API — all snapshots are normalized before reaching agent core
// ---------------------------------------------------------------------------

export async function generateSnapshot(
  provider: CloudProvider,
  userId: string,
  credentialRef: string,
): Promise<NormalizedSnapshot> {
  const adapter = await ADAPTERS[provider]();
  const rawSnapshot = await adapter(userId, credentialRef);
  return normalizeSnapshot(rawSnapshot);
}

export type { SnapshotAdapter as SnapshotGenerator };
