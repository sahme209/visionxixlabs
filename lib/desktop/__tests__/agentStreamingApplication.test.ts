/** @vitest-environment jsdom */
import { createElement } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { desktopClient } from "../../../desktop/src/lib/desktopClient";
import { AgentChatView } from "../../../desktop/src/views/AgentChatView";
import { agentMessageHttpStream } from "../agentMessageHttpStream";

// Only external HTTP data is synthetic. Composer, DesktopClient, HTTP framing,
// incremental decoder and approval rendering are the real application modules.
const summary = { id: "wire-conversation", title: "Wire acceptance", createdAt: "2026-10-20T00:00:00Z", updatedAt: "2026-10-20T00:00:00Z", turnCount: 0 };
const proposal = { id: "saved-proposal", toolName: "commit_github_file", argsJson: { repositoryFullName: "fixture/repository", branch: "main", path: "src/app.ts", content: "reviewed change" }, riskLevel: "medium", status: "proposed" };
const data = { reply: "Persisted reviewed change", proposal, usage: { decisionSteps: 1, inputTokens: 12, outputTokens: 8, totalTokens: 20 } };
const ok = (data: unknown) => Response.json({ ok: true, data });
function gate() { let release!: () => void; const promise = new Promise<void>(resolve => { release = resolve; }); return { promise, release }; }

beforeEach(() => {
  window.localStorage.clear(); Element.prototype.scrollTo = vi.fn();
  desktopClient.setApiBase("https://visionxixlabs.com"); desktopClient.setSession("synthetic-wire-session");
});
afterEach(() => { cleanup(); desktopClient.setSession(undefined); vi.unstubAllGlobals(); });

function fixture(interrupted = false) {
  const completion = gate();
  let saved = false;
  let signal: AbortSignal | undefined;
  const fetcher = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const path = new URL(String(url)).pathname;
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer synthetic-wire-session");
    if (path.endsWith("/messages")) {
      signal = init?.signal ?? undefined;
      expect(new Headers(init?.headers).get("accept")).toBe("application/x-ndjson");
      return agentMessageHttpStream(signal!, async stream => {
        stream.onDraft(""); stream.onDraft("Review draft before persistence");
        await completion.promise;
        // Represents completion of the existing persistence boundary, not SQL proof.
        saved = true;
        if (interrupted) throw new Error("synthetic stream interruption");
        return ok(data);
      });
    }
    if (path === "/api/desktop/ai-providers") return ok({ providers: [{ provider: "vercel_gateway", models: [{ id: "fixture/model", label: "Fixture model", tier: "standard" }] }], policy: { enabled: true, allowedProviders: ["vercel_gateway"], modelSelections: { vercel_gateway: "fixture/model" }, fallbackOrder: ["vercel_gateway"] } });
    if (path === "/api/desktop/agent/conversations") return ok({ conversations: [summary] });
    if (path === "/api/desktop/agent/conversations/wire-conversation") return ok({ ...summary, turns: saved ? [{ id: "saved-turn", role: "assistant", content: data.reply, actionProposalId: proposal.id }] : [], actions: saved ? [proposal] : [] });
    if (path === "/api/desktop/agent/skills") return ok({ skills: [] });
    if (path === "/api/desktop/github/repositories") return ok({ repositories: [{ id: "repo", fullName: "fixture/repository", defaultBranch: "main", visibility: "private" }], totalCount: 1, truncated: false });
    if (path === "/api/desktop/github/branches") return ok({ branches: [{ name: "main", protected: true }], truncated: false });
    if (path === "/api/desktop/github/files") return ok({ files: [{ path: "src/app.ts", size: 12 }], truncated: false });
    if (path === "/api/desktop/environments") return ok({ environments: [] });
    throw new Error(`Unexpected request: ${init?.method ?? "GET"} ${path}`);
  });
  vi.stubGlobal("fetch", fetcher);
  return { fetcher, completion, signal: () => signal, messages: () => fetcher.mock.calls.filter(([url]) => new URL(String(url)).pathname.endsWith("/messages")) };
}

async function compose(mode: "chat" | "code") {
  render(createElement(AgentChatView));
  await screen.findByRole("option", { name: "Fixture model" });
  await waitFor(() => expect((screen.getByRole("combobox", { name: "Agent conversation" }) as HTMLSelectElement).value).toBe(summary.id));
  if (mode === "code") {
    fireEvent.click(screen.getByRole("button", { name: "Edit repository file" }));
    await screen.findByRole("option", { name: "src/app.ts" });
    fireEvent.change(screen.getByRole("combobox", { name: "Repository file" }), { target: { value: "src/app.ts" } });
  }
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Review this change" } });
  await waitFor(() => expect((screen.getByRole("button", { name: "Send" }) as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  await screen.findByText("Review draft before persistence");
}

it.each(["chat", "code"] as const)("connects the actual %s composer and HTTP stream without granting draft authority", async mode => {
  const wire = fixture(); await compose(mode);
  expect(screen.getByText(/verification pending/)).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Approve & run" })).toBeNull();
  expect(wire.messages()).toHaveLength(1);
  expect(JSON.parse(wire.messages()[0][1]!.body as string)).toMatchObject({ preferredProvider: "vercel_gateway", preferredModel: "fixture/model", workspaceContext: { mode, ...(mode === "code" ? { filePath: "src/app.ts" } : {}) } });
  await act(async () => { wire.completion.release(); });
  await screen.findByText(data.reply);
  expect(screen.queryByText("Review draft before persistence")).toBeNull();
  expect(screen.getByRole("button", { name: "Approve & run" })).toBeTruthy();
  expect(wire.messages()).toHaveLength(1);
  expect(wire.fetcher.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1);
});

it("recovers a persisted interrupted response through GET without resending or approving", async () => {
  const wire = fixture(true); await compose("code");
  await act(async () => { wire.completion.release(); });
  const reload = await screen.findByRole("button", { name: "Reload saved conversation" });
  expect(screen.queryByRole("button", { name: "Approve & run" })).toBeNull();
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Unsent follow-up" } });
  fireEvent.click(reload); await screen.findByText(data.reply);
  expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("Unsent follow-up");
  expect(screen.getByRole("button", { name: "Approve & run" })).toBeTruthy();
  expect(wire.messages()).toHaveLength(1);
  expect(wire.fetcher.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1);
});
