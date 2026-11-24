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
  ["Where is the Apps and skills catalog?", "page:/docs/plugins"],
  ["How do I choose my active workspace?", "page:/docs/workspaces"],
  ["How does Microsoft Learn documentation search work?", "page:/docs/mcp-tools"],
  ["Where can I review my paired devices and display name?", "page:/docs/settings"],
];
const BAR = 0.9;

describe("Ask Axiom evaluation set", () => {
  it.each([
    ["how do I block a github actions deploy until someone approves", "/docs/approval-workflow"],
    ["how do I set up GCP", "/docs/gcp-setup"],
  ])("finds the documented next step for %s", (question, href) => {
    const answer = answerQuestion(buildIndex(knowledgeEntries()), question);
    expect(answer.status, JSON.stringify(answer.sources)).toBe("answered");
    if (answer.status === "answered") expect(answer.sources[0]?.href.split("#")[0]).toBe(href);
  });
  it.each(CASES.slice(-4))("cites the authored workspace guide for %s", (question, expected) => {
    const answer = answerQuestion(buildIndex(knowledgeEntries()), question);
    expect(answer.status).toBe("answered");
    if (answer.status === "answered") expect(answer.sources[0]?.href.split("#")[0]).toBe(expected.slice(5));
  });
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
    expect(misses).toEqual([]);
  });

  it("declines off-topic questions instead of guessing", () => {
    const index = buildIndex(knowledgeEntries());
    for (const q of ["what color is the sky", "tell me a joke", "who won the election", "asdf qwer", "weather tomorrow", "how do I set up a telescope", "how do I block someone on a social network", "can I set up GCP for quantum teleportation"]) expect(answerQuestion(index, q).status, q).toBe("suggestions");
  });

  it("never answers a guarded case with product text", () => {
    const index = buildIndex(knowledgeEntries());
    for (const [q, expected] of CASES.filter(([, e]) => e.startsWith("guard:"))) expect(answerQuestion(index, q).status).toBe("guarded");
  });
});

describe("Installer availability support", () => {
  const index = buildIndex(knowledgeEntries());
  it.each([
    ["Why does the page say Desktop downloads are temporarily paused?", "required service storage checks"],
    ["Why do I see Check Windows availability instead of Download?", "current release manifest"],
    ["How do I recheck installer availability?", "Recheck release status"],
    ["What does Release status unavailable mean on the download page?", "could not be verified"],
  ])("routes %s to the public availability guidance", (question, text) => {
    const answer = answerQuestion(index, question);
    expect({status: answer.status, href: answer.sources[0]?.href}).toEqual({status: "answered", href: "/docs/desktop-install#installer-availability"});
    expect(answer.answer).toContain(text);
  });
});

describe("AWS EC2 observation support", () => {
  const index = buildIndex(knowledgeEntries());
  it.each([
    ["How do I select an AWS account for the AWS EC2 observation skill?", "12-digit AWS account number"],
    ["How many instances can AWS EC2 observation read?", "at most five EC2 instances"],
    ["What does an empty AWS EC2 observation mean?", "does not establish that the account has no instances"],
  ])("cites the observation guide for %s", (question, expected) => {
    const answer = answerQuestion(index, question);
    expect({status: answer.status, href: answer.sources[0]?.href}).toEqual({status: "answered", href: "/docs/plugins#aws-ec2-observation"});
    expect(answer.answer).toContain(expected);
  });
});

describe("Desktop workflow map support", () => {
  const index = buildIndex(knowledgeEntries());

  it.each([
    "How do I use the step list in the desktop workflow map?",
    "How do I fit the overview and pan the workflow map canvas?",
  ])("cites the exact guide section for %s", question => {
    const answer = answerQuestion(index, question);
    expect(answer.status).toBe("answered");
    expect(answer.sources[0]?.href).toBe("/docs/surfaces#workflow-map");
    if (answer.status === "answered") expect(answer.answer).toContain("In desktop versions that include it");
  });

  it.each([
    ["How do I follow conditional Next steps in the desktop workflow map?", "Matching a condition is a navigation choice"],
    ["Which workflow map branch applies when approval expired?", "Rejected, expired or changed"],
    ["How do I return to the original map step after following a branch?", "returns keyboard focus to the step that opened the details"],
  ])("answers %s from the version-gated branch guide", (question, statement) => {
    const answer = answerQuestion(index, question);
    expect(answer.status).toBe("answered");
    expect(answer.sources[0]?.href).toBe("/docs/surfaces#workflow-map-next-steps");
    expect(answer.answer).toContain(statement);
  });

  it.each([
    ["How do I inspect a failed Airflow run in Batches release dependencies?", "Inspect failed run"],
    ["Why is Inspect failed run missing when the Airflow dependency is waiting?", "Waiting or unverified"],
    ["How do I retry reading tasks for a failed batch run?", "Retry tasks"],
  ])("cites the failed-run guide for %s", (question, statement) => {
    const answer = answerQuestion(index, question);
    expect(answer.status).toBe("answered");
    expect(answer.sources[0]?.href).toBe("/docs/surfaces#batch-failed-run");
    expect(answer.answer).toContain(statement);
  });

  it.each([
    ["Where are Execution requirements in desktop Deployments?", "exact approvals and verified evidence"],
    ["What does View release review open in Deployments?", "opens the merge review for that same release version"],
    ["Why is View release review unavailable in desktop Deployments?", "wait for the refresh"],
    ["Where is View release review in the wide Deployments inspector?", "below the scrolling evidence in the wide inspector"],
    ["Where is View release review in compact Deployments?", "in the toolbar beneath the section tabs"],
  ])("answers %s from the exact desktop approval guide", (question, statement) => {
    const answer = answerQuestion(index, question);
    expect(answer.status).toBe("answered");
    expect(answer.sources[0]?.href).toBe("/docs/approval-workflow#desktop-release-review");
    expect(answer.answer).toContain(statement);
  });

  it.each([
    ["Where do I find the workspace owner in desktop Settings?", "Settings → General"],
    ["Why are workspace members unavailable in desktop Settings?", "Refresh members"],
    ["What does Invite member open from desktop Settings?", "same account and workspace"],
  ])("answers %s from the exact membership guide", (question, statement) => {
    const answer = answerQuestion(index, question);
    expect(answer.status).toBe("answered");
    expect(answer.sources[0]?.href).toBe("/docs/settings#desktop-workspace-access");
    expect(answer.answer).toContain(statement);
  });

  it.each(["Who is my workspace owner?", "Who owns our workspace?", "List our current workspace members"])("keeps %s private", question => {
    const answer = answerQuestion(index, question);
    expect(answer).toMatchObject({status: "guarded", guard: "workspace_specific"});
    expect(answer.sources[0]?.href).toBe("/docs/settings#desktop-workspace-access");
  });

  it("keeps a production action request outside explanatory map guidance", () => {
    const answer = answerQuestion(index, "Deploy my app to production from the workflow map");
    expect(answer.status).toBe("guarded");
    if (answer.status === "guarded") expect(answer.guard).toBe("action_request");
  });
});

it("cites the exact Airflow setup for a public connection question", () => {
  const answer = answerQuestion(buildIndex(knowledgeEntries()), "Where is Validate and connect in the Airflow secure connection?");
  expect(answer.status).toBe("answered");
  expect(answer.sources[0]?.href).toBe("/docs/integration-setup#airflow");
  if (answer.status === "answered") expect(answer.answer).toContain("no automatic permission to start, retry or schedule a run");
});

describe("versioned setup and honest public support", () => {
  const index = buildIndex(knowledgeEntries());

  it.each([
    ["How do I view the audit log from desktop Settings?", "/docs/audit-logs#desktop-settings", "workspace selected in the browser"],
    ["Where can I watch an authentic desktop recording?", "/docs/surfaces#recordings", "currently unavailable"],
    ["Does the desktop installer update automatically?", "/docs/desktop-install#updates", "does not update automatically"],
    ["How do I install a newer V19 version?", "/docs/desktop-install#updates", "install it manually"],
    ["Does a website deployment update the desktop app?", "/docs/desktop-install#updates", "does not replace"],
    ["How do I connect a GitLab repository to V19?", "/docs/integration-setup#gitlab", "only where the workspace feature is enabled"],
    ["Does GitLab sign-in connect repositories?", "/docs/integration-setup#gitlab", "separate from repository consent"],
    ["Why does GitLab setup say it is bound to another repository?", "/docs/integration-setup#gitlab", "select that repository to manage the existing binding"],
    ["Does Revoke in V19 revoke my GitLab token?", "/docs/integration-setup#gitlab", "Manage the original token separately in GitLab"],
    ["GitLab setup says V19 could not confirm the update. What should I do?", "/docs/integration-setup#gitlab-status-recovery", "Refresh status"],
    ["How do I recover when GitLab setup status is unavailable after saving?", "/docs/integration-setup#gitlab-status-recovery", "Refresh GitLab status"],
    ["What is recorded for deferred validation?", "/docs/releaseops/readiness#deferred-validation", "owner, due time, expected check, and follow-up state"],
    ["What does unknown mean in readiness checks?", "/docs/releaseops/readiness#states", "no current evidence"],
  ])("answers %s from the relevant guide section", (question, href, statement) => {
    const answer = answerQuestion(index, question);
    expect(answer.status, JSON.stringify(answer.sources)).toBe("answered");
    expect(answer.sources[0]?.href).toBe(href);
    expect(answer.answer).toContain(statement);
  });

  it.each([
    ["Would you please approve the pending request?", "action_request"],
    ["Can you merge my release?", "action_request"],
    ["Please, could you roll back the release?", "action_request"],
    ["Retry the failed Airflow DAG", "action_request"],
    ["Could you start my Airflow run?", "action_request"],
    ["Please schedule a batch workflow", "action_request"],
    ["Please revoke my GitLab connection", "action_request"],
    ["What happened to my Airflow DAG?", "workspace_specific"],
    ["Show the status of our latest batch run", "workspace_specific"],
    ["Where is the backup or rollback for my production deployment?", "workspace_specific"],
  ])("refuses the live request %s", (question, expected) => {
    const answer = answerQuestion(index, question);
    expect(answer.status).toBe("guarded");
    expect(answer.guard).toBe(expected);
  });

  it.each(["Show our latest audit log entries", "What happened in my audit trail?"])("routes %s to the verified audit guide", (question) => {
    const answer = answerQuestion(index, question);
    expect(answer).toMatchObject({status:"guarded", guard:"workspace_specific"});
    expect(answer.answer).toContain("workspace owner or administrator");
    expect(answer.sources[0]?.href).toBe("/docs/audit-logs#desktop-settings");
  });

  it("routes a private batch lookup to the Batches workflow guide", () => {
    const answer = answerQuestion(index, "What happened to my Airflow DAG?");
    expect(answer).toMatchObject({status: "guarded", guard: "workspace_specific"});
    expect(answer.answer).toContain("V19 Batches");
    expect(answer.sources[0]?.href).toBe("/docs/surfaces#workflow-map");
  });

  it("allows explanatory questions that use similar verbs", () => {
    const answer = answerQuestion(index, "How do I roll back a deployment?");
    expect(answer.status).toBe("answered");
    expect(answer.sources[0]?.href.split("#")[0]).toBe("/docs/rollback");
  });
});
