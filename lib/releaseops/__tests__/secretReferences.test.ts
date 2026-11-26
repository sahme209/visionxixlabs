import { describe, expect, it } from "vitest";
import { validateVariable } from "../scopedVariables";
import { parseSecretReference, resolveCommandFor, secretReferencesIn } from "../secretReferences";

describe("secret references", () => {
  it("parses references for each supported secret manager", () => {
    expect(parseSecretReference("secret://aws-sm/prod/db#password")).toEqual({ provider: "aws-sm", path: "prod/db", field: "password" });
    expect(parseSecretReference(" secret://vault/kv/data/app ")).toEqual({ provider: "vault", path: "kv/data/app", field: null });
    for (const bad of ["secret://nope/x", "secret://aws-sm/../x", "secret://aws-sm//x", "secret://aws-sm/x/", "https://aws-sm/x", "secret://aws-sm/x;rm"]) expect(parseSecretReference(bad)).toBeNull();
  });
  it("gives a quoted CI command per provider", () => {
    expect(resolveCommandFor({ provider: "aws-sm", path: "prod/db", field: "password" })).toBe("aws secretsmanager get-secret-value --secret-id 'prod/db' --query SecretString --output text | jq -r '.password'");
    expect(resolveCommandFor({ provider: "azure-kv", path: "shop-kv/db-url", field: null })).toBe("az keyvault secret show --vault-name 'shop-kv' --name 'db-url' --query value --output tsv");
    expect(resolveCommandFor({ provider: "aws-ssm", path: "prod/api/url", field: null })).toContain("--name '/prod/api/url' --with-decryption");
    expect(resolveCommandFor({ provider: "gcp-sm", path: "db-url", field: null })).toBe("gcloud secrets versions access latest --secret='db-url'");
    expect(resolveCommandFor({ provider: "vault", path: "kv/app", field: "token" })).toBe("vault kv get -field='token' 'kv/app'");
  });
  it("finds references among resolved variables and accepts them as variable values", () => {
    expect(secretReferencesIn([{ key: "DB_URL", value: "secret://gcp-sm/db-url" }, { key: "REGION", value: "eu" }])).toEqual({ DB_URL: { provider: "gcp-sm", path: "db-url", field: null } });
    expect(validateVariable({ key: "DB_URL", value: "secret://aws-sm/prod/db#url", scopeKey: "workspace" })).toEqual([]);
  });
});
