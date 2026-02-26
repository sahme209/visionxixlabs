export type ConnectorType = "github" | "aws" | "azure" | "gcp";

export type ConnectorStatus = "pending" | "linked" | "error" | "disconnected";

export type ConnectorAuthMethod = "token" | "oauth" | "app";

export type ConnectorMetadata = {
  connectorType: ConnectorType;
  status: ConnectorStatus;
  linkedAt: string; // ISO8601
  authMethod: ConnectorAuthMethod;
  /** Reference to encrypted credential (opaque ref, not the credential itself) */
  encryptedCredRef?: string;
};
