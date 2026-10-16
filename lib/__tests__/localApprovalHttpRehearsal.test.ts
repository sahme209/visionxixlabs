import { describe, expect, it } from "vitest";
import { localApprovalRequestMetadata } from "../../scripts/rehearse-local-approval-http.mjs";

describe("actual Next loopback normalization in the HTTP-only approval fixture", () => {
  it("keeps transport input literal127 while deriving the server's canonical Origin and Referer", () => {
    expect(localApprovalRequestMetadata("http://127.0.0.1:34801")).toEqual({ origin: "http://localhost:34801", referer: "http://localhost:34801/dashboard/approvals" });
  });
  it.each(["http://localhost:34801", "https://127.0.0.1:34801", "http://foreign.example.test:34801", "http://user:pass@127.0.0.1:34801", "http://127.0.0.1:34801/another", "http://127.0.0.1:34801?redirect=elsewhere"])("does not broaden allowed transport origins %s", (origin) => {
    expect(() => localApprovalRequestMetadata(origin)).toThrow("isolated_approval_http_origin_required");
  });
});
