import { describe, expect, it } from "vitest";
import { answerQuestion, buildIndex, guard, tokenize } from "../answerKernel";
import { knowledgeEntries, KNOWLEDGE_VERSION } from "../knowledgeBase";
import { FAQ_GROUPS } from "../faqData";

const index = buildIndex(knowledgeEntries());
const ask = (q: string) => answerQuestion(index, q);

describe("Ask Axiom knowledge base", () => {
  it("is versioned, public-only and every entry cites a public path", () => {
    expect(KNOWLEDGE_VERSION).toMatch(/^ask-axiom-kb-\d{4}-\d{2}-\d{2}$/);
    const entries = knowledgeEntries();
    expect(entries.length).toBeGreaterThan(40);
    for (const e of entries) { expect(e.href.startsWith("/")).toBe(true); expect(e.body.length).toBeGreaterThan(10); }
    expect(new Set(entries.map((e) => e.id)).size).toBe(entries.length);
  });

  it("never states the retired per-user pricing", () => {
    const all = JSON.stringify(FAQ_GROUPS) + JSON.stringify(knowledgeEntries());
    expect(all).not.toMatch(/\$29 per user|\$79 per user/);
  });
});

describe("Ask Axiom answers", () => {
  it.each([
    ["Can Axiom govern Cursor or Claude Code?", "fact-agent-gateway"],
    ["how much does it cost?", "fact-prepaid-ai"],
    ["Are my AWS credentials stored?", "faq-"],
    ["How do I revoke access?", "faq-"],
    ["can I prove the audit log was not tampered with", "fact-trust-tools"],
    ["does it work with dagster", "fact-batches"],
  ])("answers %s from a cited source", (q, idPrefix) => {
    const a = ask(q);
    expect(a.status).toBe("answered");
    expect(a.sources.length).toBeGreaterThan(0);
    const all = knowledgeEntries().find((e) => e.body === a.answer)!;
    expect(all.id.startsWith(idPrefix)).toBe(true);
  });

  it("offers suggestions instead of guessing", () => {
    expect(ask("zxqv flibbertigibbet").status).toBe("suggestions");
    expect(ask("the").status).toBe("suggestions");
  });

  it("refuses pasted secrets without echoing them", () => {
    for (const secret of ["my key is vxlk_live_abcdef1234567890", "AKIAABCDEFGHIJKLMNOP", "password: hunter2pass", "ghp_" + "a".repeat(30)]) {
      const a = ask(secret);
      expect(a).toMatchObject({ status: "guarded", guard: "secret_pasted" });
      expect(a.answer).not.toContain(secret);
    }
  });

  it("routes workspace-specific questions and action requests to the signed-in app", () => {
    expect(ask("why did my deployment fail?").guard).toBe("workspace_specific");
    expect(ask("what is my credit balance").guard).toBe("workspace_specific");
    expect(ask("deploy my app to production").guard).toBe("action_request");
    expect(guard("How does deployment work?")).toBeNull();
  });

  it("normalises synonyms and plurals", () => {
    expect(tokenize("Prices and deploys")).toEqual(["pricing", "deployment"]);
  });
});
