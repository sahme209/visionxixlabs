import { describe, expect, it } from "vitest";
import { redactSensitiveRepositoryEvidence } from "../repositoryEvidenceRedaction";

describe("structured legacy repository evidence", () => {
  it("redacts nested multi-file reviews and preserves ordinary source evidence", () => {
    const input = { files: [{ path: "src/app.ts", content: "source" }, { path: "config/credentials/prod.json", baseContent: "private fixture", baseSha: "fixture" }], _review: { files: [{ path: "keys/signing.pem", baseContent: "private key fixture" }] } };
    expect(redactSensitiveRepositoryEvidence(input)).toEqual({ files: [{ path: "src/app.ts", content: "source" }, { path: "config/credentials/prod.json", evidenceRestricted: true }], _review: { files: [{ path: "keys/signing.pem", evidenceRestricted: true }] } });
    expect(input.files[1].baseContent).toBe("private fixture");
  });
});
