/**
 * Vitest unit tests for the route → help-entry resolver.
 *
 * Hard rule the resolver must obey: longest-prefix match wins so
 * /runbooks/queue resolves to the queue entry, not the parent
 * runbooks entry. Unmapped routes must return undefined (no
 * guessing).
 */

import { describe, it, expect } from "vitest";
import { resolveHelpForPath } from "../helpRouteIndex";

describe("help route index", () => {
  it("resolves /dashboard/runbooks/queue to the queue entry, not the parent", () => {
    const entry = resolveHelpForPath("/dashboard/runbooks/queue");
    expect(entry?.id).toBe("runbook-queue");
  });

  it("resolves /dashboard/runbooks to the parent runbooks entry", () => {
    const entry = resolveHelpForPath("/dashboard/runbooks");
    expect(entry?.id).toBe("runbooks");
  });

  it("returns undefined for unmapped routes (no guessing)", () => {
    const entry = resolveHelpForPath("/dashboard/some-future-feature");
    expect(entry).toBeUndefined();
  });

  it("returns undefined for non-dashboard paths", () => {
    const entry = resolveHelpForPath("/auth/signin");
    expect(entry).toBeUndefined();
  });

  it("resolves leaf and parent routes deterministically", () => {
    expect(resolveHelpForPath("/dashboard/cost-overview")?.id).toBe("cost-overview");
    expect(resolveHelpForPath("/dashboard/cost-explainer")?.id).toBe("cost-explainer");
    expect(resolveHelpForPath("/dashboard/scp-simulator")?.id).toBe("scp-simulator");
    expect(resolveHelpForPath("/dashboard/charter")?.id).toBe("charter");
  });
});
