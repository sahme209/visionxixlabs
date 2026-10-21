import { afterEach, describe, expect, it, vi } from "vitest";
import { DesktopClient } from "../../../desktop/src/lib/desktopClient";
import { agentMessageHttpStream } from "../agentMessageHttpStream";

afterEach(() => vi.unstubAllGlobals());
const answer = { reply: "Persisted explanation", proposal: null, usage: null };
const reply = () => Response.json({ ok: true, data: answer });
describe("actual desktop client to HTTP streaming response", () => {
  it("sends bearer and model/context once, publishes draft before completion, and returns verified data", async () => {
    let finish!: () => void, drafted!: () => void;
    const gate = new Promise<void>(resolve => { finish = resolve; });
    const firstDraft = new Promise<void>(resolve => { drafted = resolve; });
    const fetcher = vi.fn(async (_url: unknown, init?: RequestInit) => agentMessageHttpStream(init!.signal!, async streaming => {
      streaming.onDraft(""); streaming.onDraft("In progress"); await gate; return reply();
    }));
    vi.stubGlobal("fetch", fetcher);
    const client = new DesktopClient({ apiBase: "https://visionxixlabs.com", sessionToken: "synthetic-desktop-session" });
    const drafts: string[] = [];
    const pending = client.sendAgentMessage("conversation", "Inspect code", "vercel_gateway", { mode: "code", filePath: "src/app.ts" }, "vendor/approved", {
      signal: new AbortController().signal, onDraft(text) { drafts.push(text); if (text) drafted(); },
    });
    await firstDraft;
    expect(drafts).toEqual(["", "In progress"]);
    expect(fetcher.mock.calls[0][1]).toMatchObject({ method: "POST", headers: { Authorization: "Bearer synthetic-desktop-session" } });
    expect(new Headers(fetcher.mock.calls[0][1]!.headers).get("accept")).toBe("application/x-ndjson");
    expect(JSON.parse(fetcher.mock.calls[0][1]!.body as string)).toMatchObject({ preferredModel: "vendor/approved", workspaceContext: { mode: "code", filePath: "src/app.ts" } });
    finish(); expect(await pending).toEqual({ ok: true, data: answer }); expect(fetcher).toHaveBeenCalledOnce();
  });
  it("accepts the same legacy JSON response without a second paid request", async () => {
    const fetcher = vi.fn(async () => reply()); vi.stubGlobal("fetch", fetcher);
    const client = new DesktopClient({ sessionToken: "synthetic-session" });
    const activity = vi.fn();
    expect(await client.sendAgentMessage("conversation", "hello", undefined, undefined, undefined, { signal: new AbortController().signal, onDraft: vi.fn(), onActivity: activity })).toEqual({ ok: true, data: answer });
    expect(activity).not.toHaveBeenCalled();
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it("aborts immediately on workspace context change during a stalled read", async () => {
    let requestSignal!: AbortSignal, started!: () => void;
    const ready = new Promise<void>(resolve => { started = resolve; });
    vi.stubGlobal("fetch", vi.fn(async (_url, init: RequestInit) => {
      requestSignal = init.signal!;
      return agentMessageHttpStream(requestSignal, async stream => {
        stream.onDraft("partial"); started();
        await new Promise((_, reject) => stream.abortSignal.addEventListener("abort", () => reject(new Error("stopped")), { once: true }));
        return reply();
      });
    }));
    const client = new DesktopClient({ sessionToken: "synthetic-session" });
    const drafts: string[] = [];
    const pending = client.sendAgentMessage("conversation", "hello", undefined, undefined, undefined, { signal: new AbortController().signal, onDraft: text => drafts.push(text) });
    await ready; client.setApiBase("https://other-workspace.example.test");
    expect(requestSignal.aborted).toBe(true);
    expect(await pending).toMatchObject({ ok: false });
    expect(drafts).not.toContain("Persisted explanation");
  });
});

it("streams when the WebView lacks AbortSignal.throwIfAborted", async () => {
  const descriptor = Object.getOwnPropertyDescriptor(AbortSignal.prototype, "throwIfAborted")!;
  Object.defineProperty(AbortSignal.prototype, "throwIfAborted", { configurable: true, value: undefined });
  try {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ type: "result", data: answer }) + "\n", { headers: { "content-type": "application/x-ndjson" } }));
    vi.stubGlobal("fetch", fetcher);
    const client = new DesktopClient({ sessionToken: "synthetic-session" });
    expect(await client.sendAgentMessage("conversation", "hello", undefined, undefined, undefined, { signal: new AbortController().signal, onDraft: vi.fn() })).toEqual({ ok: true, data: answer });
    expect(fetcher).toHaveBeenCalledOnce();
  } finally { Object.defineProperty(AbortSignal.prototype, "throwIfAborted", descriptor); }
});
