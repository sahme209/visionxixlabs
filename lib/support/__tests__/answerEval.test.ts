/**
 * Ask Axiom evaluation set (roadmap step 5). Fixed, public questions only; no
 * customer data. Each case names the entry (or guard) the answer must come
 * from. CI fails if accuracy drops below the bar, so a knowledge or ranking
 * change cannot silently make support worse.
 */
import { describe, expect, it } from "vitest";
import { answerQuestion, buildIndex } from "../answerKernel";
import { knowledgeEntries } from "../knowledgeBase";

type Case = [question: string, expected: string];
const CASES: readonly Case[] = [
  ["What is Axiom?", "faq-0-0"],
  ["what does axiom agent do", "faq-0-0"],
  ["Can Axiom govern Cursor or Claude Code?", "fact-agent-gateway"],
  ["does it support MCP agents", "page:/docs/agent-gateway"],
  ["how do I block a github actions deploy until someone approves", "fact-ci-gate"],
  ["how much does it cost?", "fact-prepaid-ai"],
  ["is there a free plan", "fact-prepaid-ai"],
  ["Are my AWS credentials stored?", "faq-1-2"],
  ["How do I revoke access?", "faq-1-3"],
  ["What permissions does Axiom need?", "faq-1-1"],
  ["can I prove the audit log was not tampered with", "fact-trust-tools"],
  ["can I test a policy before enabling it", "fact-policy-replay"],
  ["does it work with dagster", "fact-batches"],
  ["prefect support?", "fact-batches"],
  ["Is my data used to train models?", "fact-model-training"],
  ["How do I install on Windows?", "page:/docs/desktop-install"],
  ["Is there a desktop app?", "faq-"],
  ["Can the Agent change a repository by itself?", "faq-"],
  ["what is recorded in the audit log", "faq-"],
  ["what happens if an execution fails", "faq-"],
  ["how do I talk to a human", "fact-support-contact"],
  ["why did my deployment fail?", "guard:workspace_specific"],
  ["what is my credit balance", "guard:workspace_specific"],
  ["deploy my app to production", "guard:action_request"],
  ["delete the staging cluster", "guard:action_request"],
  ["here is my key vxlk_live_abcdef1234567890 why does it fail", "guard:secret_pasted"],
  ["AKIAABCDEFGHIJKLMNOP", "guard:secret_pasted"],
  ["approve the pending request", "guard:action_request"],
  ["How does environment selection work?", "faq-"],
  ["How does Airflow participate?", "faq-"],
  // Answerable only from full docs section text (corpus).
  ["what counts as low risk", "page:/docs/approval-workflow"],
  ["what is a medium risk change", "page:/docs/approval-workflow"],
  ["how do I set up GCP", "page:/docs/gcp-setup"],
  ["how do I connect Azure", "page:/docs/azure-setup"],
  ["how do I roll back a deployment", "page:/docs/rollback"],
  ["what does the glossary say about evidence", "page:/docs/glossary"],
  ["troubleshooting sign in problems", "page:/docs/troubleshooting"],
  ["how do execution plans work", "page:/docs/execution-plans"],
];
const BAR = 0.9;

describe("Ask Axiom evaluation set", () => {
  it(`routes at least ${BAR * 100}% of ${CASES.length} questions to the expected source`, () => {
    const index = buildIndex(knowledgeEntries());
    const entries = knowledgeEntries();
    const misses: string[] = [];
    for (const [q, expected] of CASES) {
      const a = answerQuestion(index, q);
      const got = a.status === "guarded" ? `guard:${a.guard}` : a.status === "answered" ? entries.find((e) => e.body === a.answer)?.id ?? "?" : "suggestions";
      const page = a.status === "answered" ? a.sources[0]?.href.split("#")[0] : undefined;
      const ok = expected.startsWith("page:") ? page === expected.slice(5) : got === expected || (expected.endsWith("-") && got.startsWith(expected));
      if (!ok) misses.push(`${q} → ${got} ${page ?? ""} (expected ${expected})`);
    }
    const accuracy = 1 - misses.length / CASES.length;
    expect(accuracy, misses.join("\n")).toBeGreaterThanOrEqual(BAR);
  });

  it("declines off-topic questions instead of guessing", () => {
    const index = buildIndex(knowledgeEntries());
    for (const q of ["what color is the sky", "tell me a joke", "who won the election", "asdf qwer", "weather tomorrow"]) expect(answerQuestion(index, q).status).toBe("suggestions");
  });

  it("never answers a guarded case with product text", () => {
    const index = buildIndex(knowledgeEntries());
    for (const [q, expected] of CASES.filter(([, e]) => e.startsWith("guard:"))) expect(answerQuestion(index, q).status).toBe("guarded");
  });
});
