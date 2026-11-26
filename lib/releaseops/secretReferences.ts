/**
 * Secret references in configuration variables (parity: Vault, AWS Secrets Manager, Parameter Store,
 * Google Secret Manager, Azure Key Vault). Pure.
 *
 * A variable may hold a reference such as `secret://aws-sm/prod/db#password` instead of a value.
 * V19 stores and shows only the reference and never resolves it: the customer's CI reads the secret
 * from its own secret manager at deploy time with its own short-lived identity. That keeps secrets out
 * of V19 while letting environments differ by which secret they point to.
 */
export const SECRET_PROVIDERS = {
  "aws-sm": "AWS Secrets Manager",
  "aws-ssm": "AWS Systems Manager Parameter Store",
  "gcp-sm": "Google Secret Manager",
  "azure-kv": "Azure Key Vault",
  vault: "HashiCorp Vault",
} as const;
export type SecretProvider = keyof typeof SECRET_PROVIDERS;
export interface SecretReference { provider: SecretProvider; path: string; field: string | null }

const REF = /^secret:\/\/([a-z-]+)\/([A-Za-z0-9_./+=@-]{1,256})(?:#([A-Za-z0-9_.-]{1,64}))?$/;

export function parseSecretReference(value: string): SecretReference | null {
  const m = REF.exec(value.trim());
  if (!m || !(m[1] in SECRET_PROVIDERS) || m[2].includes("..") || m[2].startsWith("/") || m[2].endsWith("/")) return null;
  return { provider: m[1] as SecretProvider, path: m[2], field: m[3] ?? null };
}

/** A shell command the customer's CI can run to resolve one reference with its own identity. */
export function resolveCommandFor(ref: SecretReference): string {
  const q = (s: string) => `'${s.replace(/'/g, "")}'`;
  const field = ref.field ? ` | jq -r ${q(`.${ref.field}`)}` : "";
  switch (ref.provider) {
    case "aws-sm": return `aws secretsmanager get-secret-value --secret-id ${q(ref.path)} --query SecretString --output text${field}`;
    case "aws-ssm": return `aws ssm get-parameter --name ${q(`/${ref.path}`)} --with-decryption --query Parameter.Value --output text`;
    case "gcp-sm": return `gcloud secrets versions access latest --secret=${q(ref.path)}${field}`;
    case "azure-kv": { const [vault, ...name] = ref.path.split("/"); return `az keyvault secret show --vault-name ${q(vault)} --name ${q(name.join("-"))} --query value --output tsv`; }
    case "vault": return `vault kv get -field=${q(ref.field ?? "value")} ${q(ref.path)}`;
  }
}

/** References among resolved variables, keyed by variable name. */
export function secretReferencesIn(variables: ReadonlyArray<{ key: string; value: string }>): Record<string, SecretReference> {
  const out: Record<string, SecretReference> = {};
  for (const v of variables) { const ref = parseSecretReference(v.value); if (ref) out[v.key] = ref; }
  return out;
}
