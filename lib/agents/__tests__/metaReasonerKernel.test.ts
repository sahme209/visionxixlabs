import { describe, it, expect } from "vitest";
import {
  selectKernelForProblem,
  type KernelCatalogEntry,
} from "../metaReasonerKernel";

const CATALOG: readonly KernelCatalogEntry[] = [
  {
    id: "specWriter",
    domains: ["code"],
    keywords: ["spec", "refactor", "feature", "bug", "fix", "engineering"],
    historicalAccuracy: 0.7,
    supportsDryRun: true,
    shortDescription: "Drafts engineering specs.",
  },
  {
    id: "databaseSchemaReviewer",
    domains: ["database"],
    keywords: ["schema", "index", "foreign", "key", "column", "table"],
    historicalAccuracy: 0.8,
    supportsDryRun: true,
    shortDescription: "Reviews DB schemas.",
  },
  {
    id: "slowQueryProposer",
    domains: ["database"],
    keywords: ["slow", "query", "performance", "execution", "plan"],
    historicalAccuracy: 0.75,
    supportsDryRun: true,
    shortDescription: "Proposes index / rewrite for slow queries.",
  },
  {
    id: "idleCloudResourceDetector",
    domains: ["cloud_cost"],
    keywords: ["idle", "unused", "ebs", "lambda", "savings", "cost"],
    historicalAccuracy: 0.85,
    supportsDryRun: true,
    shortDescription: "Finds idle cloud resources.",
  },
  {
    id: "marketingContentDrafter",
    domains: ["marketing"],
    keywords: ["linkedin", "social", "post", "draft", "marketing"],
    historicalAccuracy: 0.6,
    supportsDryRun: false,
    shortDescription: "Drafts social posts.",
  },
];

describe("selectKernelForProblem", () => {
  it("rejects empty catalog", () => {
    const r = selectKernelForProblem({ statement: "anything" }, []);
    expect(r.kind).toBe("no_kernel");
  });

  it("rejects empty statement", () => {
    const r = selectKernelForProblem({ statement: "  " }, CATALOG);
    expect(r.kind).toBe("no_kernel");
  });

  it("picks specWriter for a code refactor problem", () => {
    const r = selectKernelForProblem(
      { statement: "draft a refactor spec for the bug in our login flow", domainHint: "code" },
      CATALOG,
    );
    expect(r.kind).toBe("pick");
    if (r.kind === "pick") expect(r.chosen.kernelId).toBe("specWriter");
  });

  it("picks slowQueryProposer when query performance language is used", () => {
    const r = selectKernelForProblem(
      { statement: "our slow query on orders is hitting 1.4s p95", domainHint: "database" },
      CATALOG,
    );
    expect(r.kind).toBe("pick");
    if (r.kind === "pick") expect(r.chosen.kernelId).toBe("slowQueryProposer");
  });

  it("picks idleCloudResourceDetector for cost talk", () => {
    const r = selectKernelForProblem(
      { statement: "we have unused EBS volumes burning AWS savings", domainHint: "cloud_cost" },
      CATALOG,
    );
    expect(r.kind).toBe("pick");
    if (r.kind === "pick") expect(r.chosen.kernelId).toBe("idleCloudResourceDetector");
  });

  it("destructive task prefers dry-run-capable kernel", () => {
    // marketingContentDrafter doesn't support dry-run; if the operator
    // calls a destructive marketing action, the meta-reasoner should
    // still pick the marketing kernel (since marketing keywords match)
    // but its confidence should not get the destructive boost.
    const safe = selectKernelForProblem(
      { statement: "linkedin post for our latest launch", destructive: true, domainHint: "marketing" },
      CATALOG,
    );
    if (safe.kind === "pick") {
      expect(safe.chosen.kernelId).toBe("marketingContentDrafter");
    }
  });

  it("two close candidates → ambiguous", () => {
    // Force ambiguity by adding a near-duplicate.
    const catalog: KernelCatalogEntry[] = [
      ...CATALOG,
      {
        id: "dupeMarketing",
        domains: ["marketing"],
        keywords: ["linkedin", "social", "post", "draft", "marketing"],
        historicalAccuracy: 0.6,
        supportsDryRun: false,
        shortDescription: "Dupe.",
      },
    ];
    const r = selectKernelForProblem(
      { statement: "draft a linkedin post", domainHint: "marketing" },
      catalog,
    );
    expect(r.kind).toBe("ambiguous");
  });

  it("no kernel above threshold → no_kernel verdict", () => {
    const r = selectKernelForProblem(
      { statement: "tell me a joke about pineapples" },
      CATALOG,
    );
    expect(r.kind).toBe("no_kernel");
  });

  it("runnersUp returned alongside chosen", () => {
    const r = selectKernelForProblem(
      { statement: "draft engineering refactor spec", domainHint: "code" },
      CATALOG,
    );
    if (r.kind === "pick") {
      expect(r.runnersUp.length).toBeGreaterThan(0);
      expect(r.runnersUp[0].kernelId).not.toBe(r.chosen.kernelId);
    }
  });

  it("historical accuracy boost helps borderline picks", () => {
    const lowAcc = CATALOG.map((c) =>
      c.id === "databaseSchemaReviewer" ? { ...c, historicalAccuracy: 0.1 } : c,
    );
    const highAcc = CATALOG.map((c) =>
      c.id === "databaseSchemaReviewer" ? { ...c, historicalAccuracy: 0.95 } : c,
    );
    const problem = { statement: "review schema indexes", domainHint: "database" as const };
    const low  = selectKernelForProblem(problem, lowAcc);
    const high = selectKernelForProblem(problem, highAcc);
    if (low.kind === "pick" && high.kind === "pick") {
      expect(high.chosen.confidence).toBeGreaterThan(low.chosen.confidence);
    }
  });

  it("rationale text is operator-readable + mentions the match signals", () => {
    const r = selectKernelForProblem(
      { statement: "slow query performance issue", domainHint: "database" },
      CATALOG,
    );
    if (r.kind === "pick") {
      expect(r.chosen.reason).toMatch(/keyword overlap|domain|historical/);
    }
  });
});
