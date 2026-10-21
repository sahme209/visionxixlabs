/** @vitest-environment jsdom */
import { createElement } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
const native = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({
  invoke: native.invoke,
  Channel: class { constructor(public onmessage: (event: unknown) => void) {} },
}));
import { desktopFetch } from "../../../desktop/src/lib/desktopTransport";
import { desktopClient } from "../../../desktop/src/lib/desktopClient";
import { AgentChatView } from "../../../desktop/src/views/AgentChatView";
import { agentMessageHttpStream } from "../agentMessageHttpStream";

// Only external HTTP data is synthetic. Composer, DesktopClient, HTTP framing,
// incremental decoder and approval rendering are the real application modules.
const summary = { id: "wire-conversation", title: "Wire acceptance", createdAt: "2026-10-20T00:00:00Z", updatedAt: "2026-10-20T00:00:00Z", turnCount: 0 };
const proposal = { id: "saved-proposal", toolName: "commit_github_file", argsJson: { repositoryFullName: "fixture/repository", branch: "main", path: "src/app.ts", content: "reviewed change" }, riskLevel: "medium", status: "proposed" };
const data = { reply: "Persisted reviewed change", proposal, usage: { decisionSteps: 1, inputTokens: 12, outputTokens: 8, totalTokens: 20 } };
const ok = (data: unknown) => Response.json({ ok: true, data });
const fixtureDisposals = new Set<() => void>();
function gate() { let release!: () => void; const promise = new Promise<void>(resolve => { release = resolve; }); return { promise, release }; }

beforeEach(() => {
  window.localStorage.clear(); Element.prototype.scrollTo = vi.fn();
  desktopClient.setApiBase("https://visionxixlabs.com"); desktopClient.setSession("synthetic-wire-session");
});
afterEach(() => { cleanup(); desktopClient.setSession(undefined); for (const dispose of fixtureDisposals) dispose(); fixtureDisposals.clear(); delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__; vi.unstubAllGlobals(); });

function fixture(interrupted = false, transport: "http" | "native" = "http", proposes = true) {
  const outcome = proposes ? data : {...data, proposal: null};
  const completion = gate();
  fixtureDisposals.add(completion.release);
  let saved = false;
  let signal: AbortSignal | undefined;
  const fetcher = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const path = new URL(String(url)).pathname;
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer synthetic-wire-session");
    if (path.endsWith("/messages")) {
      signal = init?.signal ?? undefined;
      expect(new Headers(init?.headers).get("accept")).toBe("application/x-ndjson");
      return agentMessageHttpStream(signal!, async stream => {
        stream.onActivity?.({step: 1, toolName: "read_github_file", state: "running"});
        stream.onDraft(""); stream.onDraft("Review draft before persistence");
        await completion.promise;
        if (!stream.abortSignal.aborted) stream.onActivity?.({step: 1, toolName: "read_github_file", state: "completed"});
        // Represents completion of the existing persistence boundary, not SQL proof.
        saved = true;
        if (interrupted) throw new Error("synthetic stream interruption");
        return ok(outcome);
      }, {toolActivity: JSON.parse(String(init?.body)).streamFeatures?.includes("tool_activity_v1") === true});
    }
    if (path === "/api/desktop/ai-providers") return ok({ providers: [{ provider: "vercel_gateway", models: [{ id: "fixture/model", label: "Fixture model", tier: "standard" }] }], policy: { enabled: true, allowedProviders: ["vercel_gateway"], modelSelections: { vercel_gateway: "fixture/model" }, fallbackOrder: ["vercel_gateway"] } });
    if (path === "/api/desktop/agent/conversations") return ok({ conversations: [summary] });
    if (path === "/api/desktop/agent/conversations/wire-conversation") return ok({ ...summary, turns: saved ? [{ id: "saved-turn", role: "assistant", content: data.reply, actionProposalId: proposes ? proposal.id : null }] : [], actions: saved && proposes ? [proposal] : [] });
    if (path === "/api/desktop/agent/skills") return ok({ skills: [] });
    if (path === "/api/desktop/github/repositories") return ok({ repositories: [{ id: "repo", fullName: "fixture/repository", defaultBranch: "main", visibility: "private" }], totalCount: 1, truncated: false });
    if (path === "/api/desktop/github/branches") return ok({ branches: [{ name: "main", protected: true }], truncated: false });
    if (path === "/api/desktop/github/files") return ok({ files: [{ path: "src/app.ts", size: 12 }], truncated: false });
    if (path === "/api/desktop/environments") return ok({ environments: [] });
    throw new Error(`Unexpected request: ${init?.method ?? "GET"} ${path}`);
  });
  if (transport === "native") {
    // Only the Rust IPC peer is synthetic. Exercise real renderer, client,
    // native JS transport, server framing and decoder together, with demand ACK.
    Object.defineProperty(window, "__TAURI_INTERNALS__", { configurable: true, value: {} });
    let stop: (() => void) | undefined;
    let acknowledge: (() => void) | undefined;
    native.invoke.mockReset().mockImplementation(async (command: string, payload: { request: { path: string; method: string; headers: Record<string, string>; body?: string }; onEvent: { onmessage(event: unknown): void } }) => {
      if (command === "desktop_http_stream_ack") { acknowledge?.(); return; }
      if (command === "desktop_http_stream_cancel") { stop?.(); acknowledge?.(); return; }
      if (command === "desktop_http_request") {
        const response = await fetcher("https://visionxixlabs.com" + payload.request.path, payload.request);
        return { status: response.status, headers: Object.fromEntries(response.headers), body: await response.text() };
      }
      if (command !== "desktop_http_stream") throw new Error("unexpected_native_command");
      const abort = new AbortController(); stop = () => abort.abort();
      void (async () => {
        const response = await fetcher("https://visionxixlabs.com" + payload.request.path, { ...payload.request, signal: abort.signal });
        const reader = response.body!.getReader();
        payload.onEvent.onmessage({ kind: "headers", status: response.status, headers: Object.fromEntries(response.headers) });
        let sequence = 0;
        try {
          while (!abort.signal.aborted) {
            const next = await reader.read();
            if (next.done) { payload.onEvent.onmessage({ kind: "end" }); return; }
            const demand = new Promise<void>(resolve => { acknowledge = resolve; });
            payload.onEvent.onmessage({ kind: "chunk", sequence: sequence++, bytes: [...next.value] });
            await demand;
          }
        } finally { await reader.cancel(); reader.releaseLock(); }
      })().catch(() => payload.onEvent.onmessage({ kind: "error" }));
    });
    vi.stubGlobal("fetch", desktopFetch);
  } else vi.stubGlobal("fetch", fetcher);
  return { fetcher, completion, signal: () => signal, messages: () => fetcher.mock.calls.filter(([url]) => new URL(String(url)).pathname.endsWith("/messages")) };
}

async function compose(mode: "chat" | "code", agentProfile?: string) {
  render(createElement(AgentChatView));
  await screen.findByRole("option", { name: "Fixture model" });
  await waitFor(() => expect((screen.getByRole("combobox", { name: "Agent conversation" }) as HTMLSelectElement).value).toBe(summary.id));
  if (mode === "code") {
    fireEvent.click(screen.getByRole("button", { name: "Edit repository file" }));
    await screen.findByRole("option", { name: "src/app.ts" });
    fireEvent.change(screen.getByRole("combobox", { name: "Repository file" }), { target: { value: "src/app.ts" } });
  }
  if (agentProfile) fireEvent.change(screen.getByRole("combobox", { name: "Specialized Agent" }), { target: { value: agentProfile } });
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Review this change" } });
  await waitFor(() => expect((screen.getByRole("button", { name: "Send" }) as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  await screen.findByText("Review draft before persistence");
}

it.each([ ["chat", "http"], ["code", "http"], ["chat", "native"], ["code", "native"] ] as const)("connects the actual %s composer over %s without granting draft authority", async (mode, transport) => {
  const wire = fixture(false, transport); await compose(mode);
  expect(screen.getByText(/verification pending/)).toBeTruthy();
  expect(screen.getByRole("region", {name: "Agent task progress"}).textContent).toContain("Reading repository file · In progress");
  expect(JSON.parse(String(wire.messages()[0][1]?.body)).streamFeatures).toEqual(["tool_activity_v1"]);
  expect(screen.queryByRole("button", { name: "Approve & run" })).toBeNull();
  expect(wire.messages()).toHaveLength(1);
  expect(JSON.parse(wire.messages()[0][1]!.body as string)).toMatchObject({ preferredProvider: "vercel_gateway", preferredModel: "fixture/model", workspaceContext: { mode, ...(mode === "code" ? { filePath: "src/app.ts" } : {}) } });
  await act(async () => { wire.completion.release(); });
  await screen.findByText(data.reply);
  expect(screen.queryByText("Review draft before persistence")).toBeNull();
  expect(screen.queryByRole("region", {name: "Agent task progress"})).toBeNull();
  expect(screen.getByRole("button", { name: "Approve & run" })).toBeTruthy();
  expect(wire.messages()).toHaveLength(1);
  expect(wire.fetcher.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1);
});

it.each(["http", "native"] as const)("recovers a persisted interrupted %s response through GET without resending or approving", async transport => {
  const wire = fixture(true, transport); await compose("code");
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

it("stops a native composer response without accepting late proposal authority or sending again", async () => {
  const wire = fixture(false, "native"); await compose("code");
  fireEvent.click(screen.getByRole("button", { name: "Stop response" }));
  await screen.findByRole("button", { name: "Reload saved conversation" });
  expect(wire.signal()?.aborted).toBe(true);
  expect(screen.queryByRole("region", {name: "Agent task progress"})).toBeNull();
  expect(native.invoke.mock.calls.some(([command]) => command === "desktop_http_stream_cancel")).toBe(true);
  await act(async () => { wire.completion.release(); });
  expect(screen.queryByRole("button", { name: "Approve & run" })).toBeNull();
  expect(screen.queryByText(data.reply)).toBeNull();
  expect(wire.messages()).toHaveLength(1);
});

it.each(["coding", "debugging", "code_review", "terraform", "cloud_deployment"])("sends selected %s profile through the rendered composer and streaming client", async agentProfile => {
  const wire = fixture(); await compose("chat", agentProfile);
  expect(JSON.parse(wire.messages()[0][1]!.body as string)).toMatchObject({ workspaceContext: { agentProfile } });
  expect((screen.getByRole("combobox", { name: "Specialized Agent" }) as HTMLSelectElement).disabled).toBe(true);
  await act(async () => { wire.completion.release(); }); await screen.findByText(data.reply);
  expect(wire.messages()).toHaveLength(1);
});

// Composition confirmation must never become a paid Agent submission.
it.each([{ isComposing: true }, { keyCode: 229 }])("retains an IME draft on Enter (%j), then sends once on explicit Enter", async composition => {
  const wire = fixture();
  render(createElement(AgentChatView));
  await screen.findByRole("option", { name: "Fixture model" });
  await waitFor(() => expect((screen.getByRole("combobox", { name: "Agent conversation" }) as HTMLSelectElement).value).toBe(summary.id));
  const composer = screen.getByRole("textbox");
  fireEvent.change(composer, { target: { value: "未完成の入力" } });
  fireEvent.keyDown(composer, { key: "Enter", ...composition });
  expect(wire.messages()).toHaveLength(0);
  expect((composer as HTMLTextAreaElement).value).toBe("未完成の入力");
  fireEvent.keyDown(composer, { key: "Enter", shiftKey: true });
  expect(wire.messages()).toHaveLength(0);
  fireEvent.keyDown(composer, { key: "Enter" });
  await screen.findByText("Review draft before persistence");
  expect(wire.messages()).toHaveLength(1);
  await act(async () => { wire.completion.release(); });
  await screen.findByText(data.reply);
});

it.each(["http", "native"] as const)("requires saved-state review before another request after %s stream uncertainty", async transport => {
  const wire = fixture(true, transport, false); await compose("chat");
  await act(async () => { wire.completion.release(); });
  const reload = await screen.findByRole("button", {name: "Reload saved conversation"});
  const composer = screen.getByRole("textbox");
  fireEvent.change(composer, {target: {value: "Unsent follow-up"}});
  expect((screen.getByRole("button", {name: "Send"}) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.keyDown(composer, {key: "Enter"});
  expect(wire.messages()).toHaveLength(1);
  fireEvent.click(reload); await screen.findByText(data.reply);
  await waitFor(() => expect((screen.getByRole("button", {name: "Send"}) as HTMLButtonElement).disabled).toBe(false));
  expect((composer as HTMLTextAreaElement).value).toBe("Unsent follow-up");
  expect(wire.messages()).toHaveLength(1);
});
it("retains recovery and an unsent draft when saved-state reload fails", async () => {
  const wire = fixture(true, "http", false); await compose("chat");
  await act(async () => { wire.completion.release(); });
  const reload = await screen.findByRole("button", {name: "Reload saved conversation"});
  fireEvent.change(screen.getByRole("textbox"), {target: {value: "Keep my unsent draft"}});
  const original = wire.fetcher.getMockImplementation()!;
  wire.fetcher.mockImplementation(async (url, init) => new URL(String(url)).pathname === "/api/desktop/agent/conversations/wire-conversation"
    ? Response.json({ok: false, error: "unavailable"}, {status: 503}) : original(url, init));
  fireEvent.click(reload);
  await screen.findByText("The selected conversation could not be verified.");
  expect((screen.getByRole("button", {name: "Send"}) as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("Keep my unsent draft");
  fireEvent.keyDown(screen.getByRole("textbox"), {key: "Enter"});
  expect(wire.messages()).toHaveLength(1);
  wire.fetcher.mockImplementation(original);
  fireEvent.click(screen.getByRole("button", {name: "Reload saved conversation"}));
  await screen.findByText(data.reply);
  await waitFor(() => expect((screen.getByRole("button", {name: "Send"}) as HTMLButtonElement).disabled).toBe(false));
  expect(wire.messages()).toHaveLength(1);
});

it.each(["http", "native"] as const)("blocks another submission after explicit %s cancellation until review", async transport => {
  const wire = fixture(false, transport, false); await compose("chat");
  fireEvent.click(screen.getByRole("button", {name: "Stop response"}));
  // The synthetic in-memory HTTP body is released explicitly; real fetch owns abort teardown.
  await act(async () => { wire.completion.release(); });
  await screen.findByRole("button", {name: "Reload saved conversation"});
  fireEvent.change(screen.getByRole("textbox"), {target: {value: "Do not retry automatically"}});
  expect((screen.getByRole("button", {name: "Send"}) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.keyDown(screen.getByRole("textbox"), {key: "Enter"});
  expect(wire.messages()).toHaveLength(1);
  await act(async () => { wire.completion.release(); });
  expect(screen.queryByText(data.reply)).toBeNull();
  expect(wire.messages()).toHaveLength(1);
});
it("does not clear recovery from a different conversation response", async () => {
  const wire = fixture(true, "http", false); await compose("chat");
  await act(async () => { wire.completion.release(); });
  const reload = await screen.findByRole("button", {name: "Reload saved conversation"});
  fireEvent.change(screen.getByRole("textbox"), {target: {value: "Keep this conversation guarded"}});
  const original = wire.fetcher.getMockImplementation()!;
  wire.fetcher.mockImplementation(async (url, init) => new URL(String(url)).pathname === "/api/desktop/agent/conversations/wire-conversation"
    ? ok({...summary, id: "different-conversation", turns: [], actions: []}) : original(url, init));
  fireEvent.click(reload); await screen.findByText("The selected conversation could not be verified.");
  expect((screen.getByRole("button", {name: "Send"}) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.keyDown(screen.getByRole("textbox"), {key: "Enter"});
  expect(wire.messages()).toHaveLength(1);
});
