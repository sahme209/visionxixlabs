import { describe, expect, it } from "vitest";
import { parseGcpSaJson } from "../cloudInputValidation";

/* ──────────────────────────────────────────────────────────────────
   GCP connector — input-shape regression suite.

   Pure JSON+regex validator the /api/gcp/validate-key route uses
   BEFORE delegating to the live Google Cloud Resource Manager
   call. Catches malformed pastes with structured errors + hints,
   never throws.

   No SDK imports — runs anywhere.
   ────────────────────────────────────────────────────────────── */

const VALID_KEY = {
  type: "service_account",
  project_id: "demo-project-123",
  private_key_id: "abcdef1234567890",
  private_key: "-----BEGIN PRIVATE KEY-----\nFAKE\n-----END PRIVATE KEY-----\n",
  client_email: "axiom-agent-reader@demo-project-123.iam.gserviceaccount.com",
  client_id: "111111111111111111111",
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
};
const VALID_JSON = JSON.stringify(VALID_KEY);

describe("parseGcpSaJson", () => {
  it("accepts a well-shaped service-account JSON key", () => {
    const r = parseGcpSaJson(VALID_JSON);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.projectId).toBe("demo-project-123");
      expect(r.clientEmail).toBe(VALID_KEY.client_email);
    }
  });

  it("prefers an explicitly-passed projectId over the one in the JSON (route override)", () => {
    const r = parseGcpSaJson(VALID_JSON, { requestedProjectId: "another-project-456" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.projectId).toBe("another-project-456");
  });

  it("trims surrounding whitespace", () => {
    const r = parseGcpSaJson(`\n  ${VALID_JSON}  \n`);
    expect(r.ok).toBe(true);
  });

  it("returns missing_key on empty payload", () => {
    const r = parseGcpSaJson("");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("missing_key");
  });

  it("returns malformed_json on non-JSON input — never throws", () => {
    const r = parseGcpSaJson("{ not really json");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("malformed_json");
  });

  it("returns wrong_key_type when type is not service_account", () => {
    const r = parseGcpSaJson(JSON.stringify({ ...VALID_KEY, type: "user_account" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("wrong_key_type");
  });

  it("returns missing_project_id when project_id is absent and not overridden", () => {
    const noProject = JSON.stringify({ ...VALID_KEY, project_id: undefined });
    const r = parseGcpSaJson(noProject);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("missing_project_id");
  });

  it("returns malformed_project_id when the project_id doesn't match GCP's naming pattern", () => {
    const r = parseGcpSaJson(JSON.stringify({ ...VALID_KEY, project_id: "Invalid With Spaces" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("malformed_project_id");
  });

  it("returns missing_client_email when client_email is absent", () => {
    const r = parseGcpSaJson(JSON.stringify({ ...VALID_KEY, client_email: undefined }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("missing_client_email");
  });

  it("returns incomplete_key when private_key or private_key_id is missing", () => {
    const noKey = JSON.stringify({ ...VALID_KEY, private_key: undefined });
    const r = parseGcpSaJson(noKey);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("incomplete_key");
  });

  it("every error path returns a hint string a customer can act on", () => {
    const cases = ["", "not json", JSON.stringify({}), JSON.stringify({ type: "wrong" })];
    for (const c of cases) {
      const r = parseGcpSaJson(c);
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(typeof r.hint).toBe("string");
        expect(r.hint.length).toBeGreaterThan(10);
      }
    }
  });
});
