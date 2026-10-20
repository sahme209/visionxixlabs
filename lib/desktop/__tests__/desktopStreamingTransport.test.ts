import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const native = vi.hoisted(() => ({ invoke: vi.fn(), channel: undefined as undefined | { onmessage: (event: unknown) => void } }));
vi.mock("@tauri-apps/api/core", () => ({
  invoke: native.invoke,
  Channel: class {
    onmessage: (event: unknown) => void;
    constructor(onmessage: (event: unknown) => void) { this.onmessage = onmessage; native.channel = this; }
  },
}));
import { desktopFetch, setDesktopTransportCredential } from "../../../desktop/src/lib/desktopTransport";
import { DesktopClient } from "../../../desktop/src/lib/desktopClient";
const path = "/api/desktop/agent/conversations/conv_123/messages";
const headers = { accept: "application/x-ndjson", "content-type": "application/json" };
const emit = (event: unknown) => native.channel!.onmessage(event);
const tick = () => new Promise<void>(resolve => queueMicrotask(resolve));
function open(signal?: AbortSignal) { return desktopFetch(path, { method: "POST", headers, body: "{}", signal }); }
function responseHeaders(status = 200, type = "application/x-ndjson") { emit({ kind: "headers", status, headers: { "content-type": type } }); }

beforeEach(() => {
  vi.stubGlobal("window", { __TAURI_INTERNALS__: {} });
  native.invoke.mockReset().mockResolvedValue(undefined);
  native.channel = undefined;
  setDesktopTransportCredential("synthetic-desktop-token");
});
afterEach(() => { vi.unstubAllGlobals(); });

describe("native Agent byte-stream transport", () => {
  it.each([
    { path: "/api/desktop/workspace-members", body: { userId: "other-member", role: "operator" } },
    { path: "/api/desktop/airflow/automations/automation_1", body: { enabled: false } },
  ])("preserves existing authenticated client PATCH operation $path", async expected => {
    vi.stubGlobal("fetch", desktopFetch);
    native.invoke.mockResolvedValue({ status: 200, body: '{"ok":true,"data":{}}', headers: { "content-type": "application/json" } });
    const client = new DesktopClient({ sessionToken: "synthetic-desktop-token" });
    const result = expected.path.endsWith("workspace-members")
      ? await client.updateWorkspaceMemberRole("other-member", "operator")
      : await client.setAirflowAutomationEnabled("automation_1", false);
    expect(result.ok).toBe(true);
    expect(native.invoke).toHaveBeenCalledWith("desktop_http_request", { request: expect.objectContaining({ method: "PATCH", path: expected.path,
      body: JSON.stringify(expected.body), headers: expect.objectContaining({ authorization: "Bearer synthetic-desktop-token" }) }) });
  });
  it.each([
    "/api/desktop/workspace-members/", "/api/desktop/workspace-members?role=owner", "/api/desktop/workspace-members#fragment",
    "/api/desktop/workspace-members\n", "/api/desktop/airflow/automations/a\n",
    "/api/desktop/airflow/automations/", "/api/desktop/airflow/automations/" + "a".repeat(201),
    "/api/desktop/airflow/automations/a/extra", "/api/desktop/airflow/automations/a%2fb", "/api/desktop/airflow/automations/é",
    "/api/desktop/airflow/automations/a b", "/api/desktop/airflow/automations/a\\b", "/api/desktop/airflow/automations/a\nb",
    "/api/desktop/agent/conversations/a/messages", "/api/desktop/other/../workspace-members",
    "https://visionxixlabs.com/api/desktop/other/../workspace-members",
    "https://visionxixlabs.com/api/desktop/workspace-members?query=1", "https://elsewhere.invalid/api/desktop/workspace-members",
  ])("refuses unsupported raw PATCH target before native invocation: %s", async target => {
    native.invoke.mockResolvedValue({ status: 200, body: "{}", headers: {} });
    await expect(desktopFetch(target, { method: "PATCH", body: "{}" })).rejects.toThrow();
    expect(native.invoke).not.toHaveBeenCalled();
  });
  it("routes the real DesktopClient through the streaming bridge and decodes its incremental result", async () => {
    vi.stubGlobal("fetch", desktopFetch);
    const client = new DesktopClient({ sessionToken: "synthetic-desktop-token" });
    const drafts: string[] = [];
    const pending = client.sendAgentMessage("conv_123", "Review code", "vercel_gateway", { mode: "code", filePath: "src/app.ts" }, "fixture/model", {
      signal: new AbortController().signal, onDraft: text => drafts.push(text),
    });
    expect(native.invoke).toHaveBeenCalledWith("desktop_http_stream", expect.objectContaining({ request: expect.objectContaining({
      path, headers: expect.objectContaining({ accept: "application/x-ndjson", authorization: "Bearer synthetic-desktop-token" }),
    }) }));
    expect(native.invoke.mock.calls.some(([name]) => name === "desktop_http_request")).toBe(false);
    responseHeaders();
    emit({ kind: "chunk", sequence: 0, bytes: [...new TextEncoder().encode('{"type":"draft_delta","text":"Real incremental draft"}\n')] });
    await vi.waitFor(() => expect(drafts).toEqual(["Real incremental draft"]));
    const data = { reply: "Verified terminal reply", proposal: null, usage: null };
    emit({ kind: "chunk", sequence: 1, bytes: [...new TextEncoder().encode(JSON.stringify({ type: "result", data }) + "\n")] });
    await vi.waitFor(() => expect(native.invoke).toHaveBeenCalledWith("desktop_http_stream_ack", expect.objectContaining({ sequence: 1 })));
    emit({ kind: "end" });
    expect(await pending).toEqual({ ok: true, data });
    expect(native.invoke.mock.calls.filter(([name]) => name === "desktop_http_stream")).toHaveLength(1);
  });
  it("resolves headers before completion and streams bytes with demand acknowledgements", async () => {
    const pending = open();
    responseHeaders();
    const response = await pending;
    expect(response.status).toBe(200);
    const call = native.invoke.mock.calls.find(([name]) => name === "desktop_http_stream");
    expect(call?.[1].request).toMatchObject({ method: "POST", path, headers: { authorization: "Bearer synthetic-desktop-token" } });
    emit({ kind: "chunk", sequence: 0, bytes: [65, 66] });
    expect(native.invoke.mock.calls.filter(([name]) => name === "desktop_http_stream_ack")).toHaveLength(0);
    const reader = response.body!.getReader();
    expect(await reader.read()).toEqual({ done: false, value: Uint8Array.from([65, 66]) });
    await tick();
    expect(native.invoke).toHaveBeenCalledWith("desktop_http_stream_ack", expect.objectContaining({ sequence: 0 }));
    emit({ kind: "end" });
    expect(await reader.read()).toEqual({ done: true, value: undefined });
  });
  it("aborts a pending read independently of iterator progress", async () => {
    const controller = new AbortController();
    const pending = open(controller.signal); responseHeaders();
    const response = await pending;
    const reading = response.body!.getReader().read();
    controller.abort();
    await expect(reading).rejects.toMatchObject({ name: "AbortError" });
    await tick();
    expect(native.invoke).toHaveBeenCalledWith("desktop_http_stream_cancel", expect.objectContaining({ requestId: expect.any(String) }));
  });
  it("closes the cancel-before-registration race", async () => {
    let registered!: () => void;
    native.invoke.mockImplementation((name: string) => name === "desktop_http_stream" ? new Promise<void>(resolve => { registered = resolve; }) : Promise.resolve());
    const controller = new AbortController();
    const pending = open(controller.signal);
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(native.invoke.mock.calls.filter(([name]) => name === "desktop_http_stream_cancel")).toHaveLength(0);
    registered(); await tick();
    expect(native.invoke.mock.calls.filter(([name]) => name === "desktop_http_stream_cancel")).toHaveLength(1);
  });
  it("cancels native work when the response consumer cancels", async () => {
    const pending = open(); responseHeaders(); const response = await pending;
    await response.body!.cancel(); await tick();
    expect(native.invoke).toHaveBeenCalledWith("desktop_http_stream_cancel", expect.anything());
  });
  it.each([
    { kind: "chunk", sequence: 1, bytes: [1] },
    { kind: "chunk", sequence: 0, bytes: new Array(16385).fill(1) },
    { kind: "chunk", sequence: 0, bytes: [-1] },
    { kind: "error" },
  ])("rejects malformed or failed IPC %j without raw details", async event => {
    const pending = open(); responseHeaders(); const response = await pending;
    const reading = response.body!.getReader().read();
    emit(event);
    await expect(reading).rejects.toThrow("without a verified response");
    expect(native.invoke).toHaveBeenCalledWith("desktop_http_stream_cancel", expect.anything());
  });
  it("refuses additional chunks without consumer demand", async () => {
    const pending = open(); responseHeaders(); const response = await pending;
    emit({ kind: "chunk", sequence: 0, bytes: [1] });
    emit({ kind: "chunk", sequence: 1, bytes: [2] });
    await expect(response.body!.getReader().read()).rejects.toThrow("without a verified response");
  });
  it("delivers ordinary authenticated HTTP errors as bounded JSON bodies", async () => {
    const pending = open(); responseHeaders(401, "application/json"); const response = await pending;
    const body = response.json();
    emit({ kind: "chunk", sequence: 0, bytes: [...new TextEncoder().encode('{"ok":false,"error":"desktop_session_required"}')] });
    await tick(); emit({ kind: "end" });
    expect(response.status).toBe(401);
    await expect(body).resolves.toMatchObject({ ok: false, error: "desktop_session_required" });
  });
  it("cancels old-credential streams before switching identity", async () => {
    const pending = open(); responseHeaders(); const response = await pending;
    const reading = response.body!.getReader().read();
    setDesktopTransportCredential("different-synthetic-token");
    await expect(reading).rejects.toMatchObject({ name: "AbortError" });
    await tick();
    expect(native.invoke).toHaveBeenCalledWith("desktop_http_stream_cancel", expect.anything());
  });
  it("refuses already canceled work without dispatch", async () => {
    const controller = new AbortController(); controller.abort();
    await expect(open(controller.signal)).rejects.toMatchObject({ name: "AbortError" });
    expect(native.invoke).not.toHaveBeenCalled();
  });
  it("does not surface native errors or accept late success after cancellation", async () => {
    native.invoke.mockRejectedValue(new Error("synthetic native credential detail"));
    const pending = open();
    await expect(pending).rejects.toThrow("without a verified response");
    responseHeaders();
    expect(native.invoke.mock.calls.filter(([name]) => name === "desktop_http_stream")).toHaveLength(1);
  });
  it("enforces the shared eight-MiB stream budget", async () => {
    const pending = open(); responseHeaders(); const response = await pending;
    const reader = response.body!.getReader();
    const bytes = new Array(16 * 1024).fill(65);
    for (let sequence = 0; sequence < 512; sequence++) {
      emit({ kind: "chunk", sequence, bytes });
      expect((await reader.read()).value?.byteLength).toBe(16 * 1024);
      await tick();
    }
    const reading = reader.read();
    emit({ kind: "chunk", sequence: 512, bytes: [65] });
    await expect(reading).rejects.toThrow("without a verified response");
  });
  it("retains the existing buffered path for ordinary API requests", async () => {
    native.invoke.mockResolvedValue({ status: 200, body: '{"ok":true}', headers: { "content-type": "application/json" } });
    const response = await desktopFetch("/api/v1/whoami");
    expect(await response.json()).toEqual({ ok: true });
    expect(native.invoke).toHaveBeenCalledWith("desktop_http_request", expect.anything());
  });
  it.each(["https://evil.example/api/desktop/agent/conversations/a/messages", "/api/v1/events/stream", path + "?target=other", "/api/desktop/agent/conversations/a%2fb/messages"])("rejects unapproved stream target %s", async target => {
    await expect(desktopFetch(target, { method: "POST", headers, body: "{}" })).rejects.toThrow();
    expect(native.invoke).not.toHaveBeenCalled();
  });
});
