/**
 * Cloud Connector Registry — unified access to AWS, Azure, and GCP connectors.
 * Axiom calls getConnector(provider) and uses the interface without knowing provider details.
 */

import type { CloudProvider, CloudConnectorInterface } from "./interface";
import { AWSConnector } from "./awsConnector";
import { AzureConnector } from "./azureConnector";
import { GCPConnector } from "./gcpConnector";

const connectors = new Map<CloudProvider, CloudConnectorInterface>([
  ["aws", new AWSConnector()],
  ["azure", new AzureConnector()],
  ["gcp", new GCPConnector()],
]);

/**
 * Get a cloud connector by provider. Use the returned interface to run operations
 * (validateConnection, discoverInfrastructure, runSecurityScan, applyFix) without
 * knowing which cloud is used.
 */
export function getConnector(provider: CloudProvider): CloudConnectorInterface {
  const connector = connectors.get(provider);
  if (!connector) {
    throw new Error(`Unknown cloud provider: ${provider}`);
  }
  return connector;
}

/**
 * List all registered cloud providers.
 */
export function getSupportedProviders(): CloudProvider[] {
  return Array.from(connectors.keys());
}
