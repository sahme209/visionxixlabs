import { describe, expect, it } from "vitest";
import { answerQuestion, buildIndex, guard, tokenize } from "../answerKernel";
import { knowledgeEntries, KNOWLEDGE_VERSION } from "../knowledgeBase";
import { FAQ_GROUPS } from "../faqData";

const index = buildIndex(knowledgeEntries());
const ask = (q: string) => answerQuestion(index, q);

describe("Ask Axiom knowledge base", () => {
  it("is versioned, public-only and every entry cites a public path", () => {
    expect(KNOWLEDGE_VERSION).toMatch(/^ask-axiom-kb-\d{4}-\d{2}-\d{2}(?:\.r[1-9]\d*)?$/);
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

// Preserve the historical evaluation questions above; test the new display
// name separately so a rename cannot hide a legacy retrieval regression.
describe("V19 display name and legacy support compatibility", () => {
  it.each(["What is V19?", "What is Axiom?", "What is Axiom Agent?", "WHAT IS V19?"])("routes %s to the same overview", question => {
    const answer = ask(question);
    expect(answer.status).toBe("answered");
    expect(answer.sources[0]?.href).toBe("/docs/faq");
    expect(answer.answer).toBe(knowledgeEntries().find(entry => entry.id === "faq-0-0")?.body);
  });
  it.each(["Can BRAND govern Cursor or Claude Code?", "What permissions does BRAND need?"])("normalizes current and legacy brands for %s", question => {
    expect(ask(question.replace("BRAND", "V19"))).toEqual(ask(question.replace("BRAND", "Axiom")));
    expect(tokenize("V19")).toEqual(tokenize("Axiom Agent"));
  });
  it("retains stable version format, IDs and public-only retrieval eligibility", () => {
    expect(KNOWLEDGE_VERSION).toBe("ask-axiom-kb-2026-11-24.r1");
    for (const entry of knowledgeEntries()) {
      expect(entry.href).toMatch(/^\/(?:docs(?:\/|#|$)|product#|integrations$|plans$|contact$|security$|trust$)/);
      expect(entry.href).not.toContain("/recovery/");
      expect(entry.href).not.toContain("/knowledge/");
      expect(entry.title).not.toMatch(/\bAxiom(?: Agent)?\b/);
      // Existing actual installer filenames remain truthful technical instructions.
      expect(entry.body).not.toMatch(/\bAxiom(?: Agent)?\b(?!\.Agent[_-])/);
    }
    expect(ask("here is my V19 key vxlk_live_abcdef1234567890").guard).toBe("secret_pasted");
  });
});
