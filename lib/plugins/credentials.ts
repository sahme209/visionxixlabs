/**
 * Credential retrieval interface — no raw secrets stored.
 * Implement encrypted credential storage later; mock if not present.
 */

export interface AWSCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  region?: string;
}

export interface CredentialProvider {
  getAWSCredentials(userId: string, credentialsKey?: string): Promise<AWSCredentials | null>;
}

const mockProvider: CredentialProvider = {
  async getAWSCredentials(): Promise<AWSCredentials | null> {
    // Placeholder: would fetch from encrypted store by credentialsKey
    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
      return {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        region: process.env.AWS_REGION || "us-east-1",
      };
    }
    return null;
  },
};

let provider: CredentialProvider = mockProvider;

export function setCredentialProvider(p: CredentialProvider): void {
  provider = p;
}

export function getCredentialProvider(): CredentialProvider {
  return provider;
}
