/**
 * integrationRegistry — Phase 645.
 *
 * Pure-function tests for the validators + the in-process credential
 * resolver. These guard the seams that decide whether the Phase 644
 * action executor can DO something with a customer-supplied config
 * (open a GitHub issue, post to Slack). A regression here means the
 * action layer either silently accepts garbage config or refuses
 * valid config.
 */

import { describe, it, expect, afterEach } from "vitest";
import {
  isValidCredentialReference,
  isValidGithubRepo,
  isValidSlackWebhookUrl,
  resolveCredentialReference,
  resolveCredentialReferenceAsync,
} from "../domains/integrationRegistry";
import { shouldDispatchApproval } from "../domains/actionExecutor";

describe("isValidGithubRepo", () => {
  it("accepts plain owner/repo", () => {
    expect(isValidGithubRepo("octocat/Hello-World")).toBe(true);
  });
  it("accepts repos with dots, underscores, hyphens", () => {
    expect(isValidGithubRepo("my_org/my.repo-name")).toBe(true);
  });
  it("rejects missing slash", () => {
    expect(isValidGithubRepo("octocat")).toBe(false);
  });
  it("rejects empty input", () => {
    expect(isValidGithubRepo("")).toBe(false);
  });
  it("rejects whitespace inside owner or repo", () => {
    expect(isValidGithubRepo("octo cat/Hello")).toBe(false);
    expect(isValidGithubRepo("octo/Hello World")).toBe(false);
  });
  it("rejects multi-segment paths", () => {
    expect(isValidGithubRepo("octocat/Hello/extra")).toBe(false);
  });
  it("rejects pathological long input", () => {
    expect(isValidGithubRepo(`${"a".repeat(150)}/${"b".repeat(150)}`)).toBe(false);
  });
  // Defensive — TypeScript types say `string` but runtime may not.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  it("rejects non-string input", () => {
    expect(isValidGithubRepo(null as unknown as string)).toBe(false);
    expect(isValidGithubRepo(undefined as unknown as string)).toBe(false);
    expect(isValidGithubRepo(42 as unknown as string)).toBe(false);
  });
});

describe("isValidCredentialReference", () => {
  it("accepts env:// references", () => {
    expect(isValidCredentialReference("env://GITHUB_ACTION_PAT")).toBe(true);
  });
  it("accepts vault:// references", () => {
    expect(isValidCredentialReference("vault://secret/data/github/pat")).toBe(true);
  });
  it("accepts secretsmanager:// references (AWS)", () => {
    expect(isValidCredentialReference("secretsmanager://prod/github-pat")).toBe(true);
  });
  it("accepts azurekeyvault:// references", () => {
    expect(isValidCredentialReference("azurekeyvault://my-vault/github-pat")).toBe(true);
  });
  it("accepts gcpsecretmanager:// references", () => {
    expect(isValidCredentialReference("gcpsecretmanager://projects/p/secrets/github-pat")).toBe(true);
  });
  it("rejects unknown schemes", () => {
    expect(isValidCredentialReference("http://example.com/secret")).toBe(false);
    expect(isValidCredentialReference("file:///etc/passwd")).toBe(false);
  });
  it("rejects raw secrets (no scheme)", () => {
    expect(isValidCredentialReference("ghp_FAKE123456")).toBe(false);
  });
  it("rejects empty + pathologically long input", () => {
    expect(isValidCredentialReference("")).toBe(false);
    expect(isValidCredentialReference(`env://${"X".repeat(500)}`)).toBe(false);
  });
});

describe("isValidSlackWebhookUrl", () => {
  it("accepts canonical hooks.slack.com URL", () => {
    expect(
      isValidSlackWebhookUrl(
        "https://hooks.slack.com/services/T0000/B0000/XXXXXXXXXXXXXXXXXXXXXXXX",
      ),
    ).toBe(true);
  });
  it("rejects http:// (must be https)", () => {
    expect(
      isValidSlackWebhookUrl(
        "http://hooks.slack.com/services/T0000/B0000/XXXXXXXXXXXXXXXXXXXXXXXX",
      ),
    ).toBe(false);
  });
  it("rejects look-alike hostnames (SSRF guard)", () => {
    expect(
      isValidSlackWebhookUrl(
        "https://hooks.slack.com.evil.example.com/services/T/B/X",
      ),
    ).toBe(false);
    expect(
      isValidSlackWebhookUrl(
        "https://attacker.com/services/T/B/X",
      ),
    ).toBe(false);
  });
  it("rejects URLs without the /services/ prefix", () => {
    expect(isValidSlackWebhookUrl("https://hooks.slack.com/api/T/B/X")).toBe(false);
  });
  it("rejects malformed URLs without throwing", () => {
    expect(isValidSlackWebhookUrl("not a url")).toBe(false);
    expect(isValidSlackWebhookUrl("")).toBe(false);
  });
});

describe("resolveCredentialReference", () => {
  const cleanup: string[] = [];
  afterEach(() => {
    for (const k of cleanup.splice(0)) delete process.env[k];
  });

  it("resolves env:// from process.env", () => {
    process.env.AXIOM_TEST_RESOLVE_OK = "ghp_resolved_secret";
    cleanup.push("AXIOM_TEST_RESOLVE_OK");
    expect(resolveCredentialReference("env://AXIOM_TEST_RESOLVE_OK")).toBe("ghp_resolved_secret");
  });
  it("returns null when the env var is unset", () => {
    expect(resolveCredentialReference("env://AXIOM_TEST_NEVER_SET_XYZ")).toBeNull();
  });
  it("returns null when the env var is empty string", () => {
    process.env.AXIOM_TEST_EMPTY = "";
    cleanup.push("AXIOM_TEST_EMPTY");
    expect(resolveCredentialReference("env://AXIOM_TEST_EMPTY")).toBeNull();
  });
  it("returns null for vault:// (external resolver not wired)", () => {
    process.env["secret/data/github/pat"] = "should-not-leak";
    cleanup.push("secret/data/github/pat");
    expect(resolveCredentialReference("vault://secret/data/github/pat")).toBeNull();
  });
  it("returns null for secretsmanager:// (external resolver not wired)", () => {
    expect(resolveCredentialReference("secretsmanager://prod/github-pat")).toBeNull();
  });
  it("returns null for malformed references without throwing", () => {
    expect(resolveCredentialReference("ghp_raw_no_scheme")).toBeNull();
    expect(resolveCredentialReference("")).toBeNull();
    expect(resolveCredentialReference("env://")).toBeNull();
  });
  it("only resolves uppercase A-Z, 0-9, _ env names (lowercase stripped)", () => {
    process.env.AXIOM_LOWER = "lower-value";
    cleanup.push("AXIOM_LOWER");
    // env:// sanitizes ref to [A-Z0-9_]; lowercase "axiom_lower"
    // strips entirely → empty name → null. Caller's UI placeholder
    // (env://GITHUB_ACTION_PAT) matches this contract.
    expect(resolveCredentialReference("env://axiom_lower")).toBeNull();
    expect(resolveCredentialReference("env://AXIOM_LOWER")).toBe("lower-value");
  });
});

describe("resolveCredentialReferenceAsync :: vault", () => {
  const realFetch = globalThis.fetch;
  const cleanup: string[] = [];

  afterEach(() => {
    globalThis.fetch = realFetch;
    for (const k of cleanup.splice(0)) delete process.env[k];
  });

  it("returns vault_unauthorized when VAULT_ADDR or VAULT_TOKEN is missing", async () => {
    const r = await resolveCredentialReferenceAsync("vault://secret/data/github/pat");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.errorCode).toBe("vault_unauthorized");
  });

  it("reads value from a KV v2 response", async () => {
    process.env.VAULT_ADDR = "https://vault.example.com";
    process.env.VAULT_TOKEN = "hvs.aaaaaaaaaaaa";
    cleanup.push("VAULT_ADDR", "VAULT_TOKEN");
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      expect(String(url)).toBe("https://vault.example.com/v1/secret/data/github/pat");
      const headers = (init?.headers ?? {}) as Record<string, string>;
      expect(headers["X-Vault-Token"]).toBe("hvs.aaaaaaaaaaaa");
      return new Response(JSON.stringify({ data: { data: { value: "ghp_resolved_vault" } } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;
    const r = await resolveCredentialReferenceAsync("vault://secret/data/github/pat");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe("ghp_resolved_vault");
  });

  it("falls back to KV v1 shape (data.value at top level)", async () => {
    process.env.VAULT_ADDR = "https://vault.example.com";
    process.env.VAULT_TOKEN = "hvs.x";
    cleanup.push("VAULT_ADDR", "VAULT_TOKEN");
    globalThis.fetch = (async () => new Response(JSON.stringify({ data: { value: "ghp_v1" } }), { status: 200 })) as typeof fetch;
    const r = await resolveCredentialReferenceAsync("vault://kv/github/pat");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe("ghp_v1");
  });

  it("surfaces 403 as vault_unauthorized", async () => {
    process.env.VAULT_ADDR = "https://vault.example.com";
    process.env.VAULT_TOKEN = "bad-token";
    cleanup.push("VAULT_ADDR", "VAULT_TOKEN");
    globalThis.fetch = (async () => new Response("permission denied", { status: 403 })) as typeof fetch;
    const r = await resolveCredentialReferenceAsync("vault://secret/data/github/pat");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.errorCode).toBe("vault_unauthorized");
  });

  it("surfaces 404 as vault_not_found", async () => {
    process.env.VAULT_ADDR = "https://vault.example.com";
    process.env.VAULT_TOKEN = "ok";
    cleanup.push("VAULT_ADDR", "VAULT_TOKEN");
    globalThis.fetch = (async () => new Response("{}", { status: 404 })) as typeof fetch;
    const r = await resolveCredentialReferenceAsync("vault://secret/data/missing");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.errorCode).toBe("vault_not_found");
  });

  it("surfaces vault_no_value when the JSON has no value field", async () => {
    process.env.VAULT_ADDR = "https://vault.example.com";
    process.env.VAULT_TOKEN = "ok";
    cleanup.push("VAULT_ADDR", "VAULT_TOKEN");
    globalThis.fetch = (async () => new Response(JSON.stringify({ data: { data: { wrong_field: "x" } } }), { status: 200 })) as typeof fetch;
    const r = await resolveCredentialReferenceAsync("vault://secret/data/odd");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.errorCode).toBe("vault_no_value");
  });

  it("treats fetch rejection as vault_unreachable (never throws)", async () => {
    process.env.VAULT_ADDR = "https://vault.example.com";
    process.env.VAULT_TOKEN = "ok";
    cleanup.push("VAULT_ADDR", "VAULT_TOKEN");
    globalThis.fetch = (async () => { throw new Error("ECONNREFUSED"); }) as typeof fetch;
    const r = await resolveCredentialReferenceAsync("vault://secret/data/x");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.errorCode).toBe("vault_unreachable");
  });
});

describe("resolveCredentialReferenceAsync :: env + scheme dispatch", () => {
  const cleanup: string[] = [];
  afterEach(() => {
    for (const k of cleanup.splice(0)) delete process.env[k];
  });

  it("returns invalid_reference for garbage input", async () => {
    const r = await resolveCredentialReferenceAsync("not a real reference");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.errorCode).toBe("invalid_reference");
  });

  it("returns env_unset when the env var is missing", async () => {
    const r = await resolveCredentialReferenceAsync("env://AXIOM_ABSOLUTELY_UNSET_VAR");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.errorCode).toBe("env_unset");
  });

  it("resolves env:// successfully", async () => {
    process.env.AXIOM_ASYNC_OK = "ok-value";
    cleanup.push("AXIOM_ASYNC_OK");
    const r = await resolveCredentialReferenceAsync("env://AXIOM_ASYNC_OK");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe("ok-value");
  });

  it("returns scheme_not_wired for azurekeyvault://", async () => {
    const r = await resolveCredentialReferenceAsync("azurekeyvault://my-vault/secret");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.errorCode).toBe("scheme_not_wired");
  });

  it("returns scheme_not_wired for gcpsecretmanager://", async () => {
    const r = await resolveCredentialReferenceAsync("gcpsecretmanager://projects/p/secrets/x");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.errorCode).toBe("scheme_not_wired");
  });

  it("synchronous resolveCredentialReference still handles env:// only (back-compat)", () => {
    process.env.AXIOM_SYNC_OK = "sync-value";
    cleanup.push("AXIOM_SYNC_OK");
    expect(resolveCredentialReference("env://AXIOM_SYNC_OK")).toBe("sync-value");
    expect(resolveCredentialReference("vault://secret/data/x")).toBeNull();
  });
});

describe("shouldDispatchApproval", () => {
  const base = {
    recommendedDecision: "approve",
    impactRadius: "org",
    reversibility: "irreversible",
  };

  it("dispatches when signed + org impact + irreversible", () => {
    const r = shouldDispatchApproval(base);
    expect(r.dispatch).toBe(true);
    expect(r.reason).toBe("high_stakes_signed");
  });
  it("dispatches when signed + tenant impact (even if fully reversible)", () => {
    const r = shouldDispatchApproval({ ...base, impactRadius: "tenant", reversibility: "fully" });
    expect(r.dispatch).toBe(true);
  });
  it("dispatches when signed + workspace impact but irreversible", () => {
    const r = shouldDispatchApproval({ ...base, impactRadius: "workspace", reversibility: "irreversible" });
    expect(r.dispatch).toBe(true);
  });
  it("does not dispatch when decision is not approve", () => {
    expect(shouldDispatchApproval({ ...base, recommendedDecision: "reject" }).dispatch).toBe(false);
    expect(shouldDispatchApproval({ ...base, recommendedDecision: "revise" }).dispatch).toBe(false);
    expect(shouldDispatchApproval({ ...base, recommendedDecision: "escalate" }).dispatch).toBe(false);
  });
  it("does not dispatch on workspace + fully-reversible (low stakes)", () => {
    const r = shouldDispatchApproval({
      recommendedDecision: "approve",
      impactRadius: "workspace",
      reversibility: "fully",
    });
    expect(r.dispatch).toBe(false);
    expect(r.reason).toBe("low_stakes_workspace_reversible");
  });
  it("dispatches on workspace + partially-reversible (partial == not fully)", () => {
    const r = shouldDispatchApproval({
      recommendedDecision: "approve",
      impactRadius: "workspace",
      reversibility: "partially",
    });
    expect(r.dispatch).toBe(true);
  });
  it("dispatches on global impact regardless of reversibility", () => {
    expect(shouldDispatchApproval({
      recommendedDecision: "approve",
      impactRadius: "global",
      reversibility: "fully",
    }).dispatch).toBe(true);
  });
});
