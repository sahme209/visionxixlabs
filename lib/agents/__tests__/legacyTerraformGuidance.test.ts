import { beforeEach, expect, it, vi } from "vitest";

// Replace the external model, persistence and tool boundaries before loading
// the actual assistant; no model/provider or plugin registration is executed.
const m = vi.hoisted(() => ({ generate: vi.fn(), append: vi.fn(), conversation: vi.fn(), context: vi.fn(), plugin: vi.fn(), workflow: vi.fn() }));
vi.mock("@/lib/ai/orchestrator", () => ({ generate: m.generate }));
vi.mock("@/lib/axiomChat/storage", () => ({ appendMessage: m.append, getConversation: m.conversation }));
vi.mock("@/lib/axiom/contextBuilder", () => ({ buildAxiomEnvironmentContext: m.context }));
vi.mock("../axiomAssistantTools", () => ({ AXIOM_ASSISTANT_TOOLS: { runExecutionPlugin: m.plugin } }));
vi.mock("../intentToPluginMap", () => ({ mapIntentToPlugin: () => null, getMultiStepIntent: () => null }));
vi.mock("../axiomWorkflowExecutor", () => ({ executeWorkflow: m.workflow }));
import { runAxiomAssistantAgent } from "../axiomAssistantAgent";

beforeEach(() => {
  vi.clearAllMocks();
  m.generate.mockResolvedValue({ text: JSON.stringify({ assistantMessage: "Synthetic model boundary; no execution." }) });
  m.append.mockResolvedValue(undefined); m.conversation.mockResolvedValue({ messages: [] });
  m.context.mockResolvedValue({ connectors: {}, recentFindings: [], lastExecutions: [], environmentSummary: "Owned synthetic context" });
  m.plugin.mockResolvedValue({ ok: false, error: "owned_no_provider" });
});

it.each(["How do I deploy standby infrastructure with Terraform?", "CONFIRM APPLY the historical Terraform plan"])("actual assistant sends unavailable Terraform guidance for %s", async message => {
  await runAxiomAssistantAgent({ conversationId: "owned-conversation", leadId: "owned-lead", message });
  expect(m.generate).toHaveBeenCalledOnce();
  const system = m.generate.mock.calls[0][0].systemPrompt as string;
  const terraform = system.slice(system.indexOf("15. TERRAFORM SAFETY"));
  expect(terraform).toMatch(/live Terraform planning and approval are unavailable/i);
  expect(terraform).toMatch(/lead token.*historical approval.*not.*authority/i);
  expect(terraform).toMatch(/saved.plan inspection.*read.only/i);
  expect(terraform).toMatch(/resilience dashboard only for analysis and configuration generation/i);
  expect(terraform).toMatch(/do not suggest enabling apply flags/i);
  expect(terraform).not.toMatch(/tell them to use the dashboard Terraform execution panel|generate, plan, and approve|apply ALWAYS requires/i);
  expect(m.plugin).not.toHaveBeenCalled(); expect(m.workflow).not.toHaveBeenCalled();
});

it.each([{ message: "Disable the unused key", apply: false }, { message: "CONFIRM APPLY disable the unused key", apply: true }])("preserves the unrelated plugin confirmation behavior for $message", async ({ message, apply }) => {
  m.generate.mockResolvedValue({ text: JSON.stringify({ assistantMessage: "Synthetic fixture", toolCalls: [{ name: "runExecutionPlugin", arguments: { pluginId: "aws:disable-unused-access-key", apply: true } }] }) });
  await runAxiomAssistantAgent({ conversationId: "owned-conversation", leadId: "owned-lead", message });
  expect(m.plugin).toHaveBeenCalledOnce();
  expect(m.plugin.mock.calls[0][1]).toMatchObject({ pluginId: "aws:disable-unused-access-key", apply });
  if (!apply) expect(m.plugin.mock.calls[0][1].dryRun).toBe(true);
  expect(m.generate.mock.calls[0][0].systemPrompt).toContain('Destructive actions (apply=true) require "CONFIRM APPLY"');
});
