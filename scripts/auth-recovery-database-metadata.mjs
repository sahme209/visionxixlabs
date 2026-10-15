/** Classify configuration inside the protected runtime. Never return a URL,
 * hostname, resource identifier, username, password, query string or database. */
export function databaseHostingMetadata(connectionUrl) {
  const result = {
    configuredEndpointProvider: "unknown",
    endpointClassification: "unavailable",
    evidence: "connection_configuration_only",
    applicationDatabaseBinding: "not_verified",
    backupStatus: "unverified",
    restoreStatus: "unverified",
  };
  if (typeof connectionUrl !== "string" || !connectionUrl.trim()) return result;
  let url;
  try { url = new URL(connectionUrl); } catch { return result; }
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  const suffix = domain => host === domain || host.endsWith(`.${domain}`);
  if (["prisma:", "prisma+postgres:"].includes(url.protocol) || suffix("prisma-data.net")) {
    return { ...result, endpointClassification: "prisma_proxy_underlying_host_unverified" };
  }
  if (!["postgres:", "postgresql:"].includes(url.protocol)) return result;
  if (["localhost", "127.0.0.1", "[::1]"].includes(host)) {
    return { ...result, endpointClassification: "local_or_proxy_underlying_host_unverified" };
  }
  const providers = [
    ["neon", ["neon.tech"]],
    ["supabase", ["supabase.co", "pooler.supabase.com"]],
    ["aws_rds", ["rds.amazonaws.com", "rds.amazonaws.com.cn"]],
    ["azure_postgresql", ["postgres.database.azure.com"]],
    ["prisma_postgres", ["db.prisma.io"]],
    ["railway", ["proxy.rlwy.net", "railway.app", "railway.internal"]],
    ["render", ["render.com"]],
    ["aiven", ["aivencloud.com"]],
    ["digitalocean", ["db.ondigitalocean.com"]],
  ];
  const provider = providers.find(([, domains]) => domains.some(suffix));
  return {
    ...result,
    configuredEndpointProvider: provider?.[0] ?? "unknown",
    endpointClassification: provider ? "recognized_provider_hostname" : "unrecognized_hostname",
  };
}
