import { describe, expect, it } from "vitest";
import { agentMessageHttpStream } from "../agentMessageHttpStream";
import { readAgentMessageStream } from "../../../desktop/src/lib/agentMessageStream";

const result = { reply: "Verified answer", proposal: null, usage: null };
const reply = () => Response.json({ ok: true, data: result });

describe("real HTTP response stream and desktop decoder", () => {
  it("delivers a draft before completion, and only a terminal result returns data", async () => {
    let finish!: () => void;
    const gate = new Promise<void>(resolve => { finish = resolve; });
    let draftSeen!: () => void;
    const draftReady = new Promise<void>(resolve => { draftSeen = resolve; });
    const drafts: string[] = [];
    const response = agentMessageHttpStream(new AbortController().signal, async stream => {
      stream.onDraft(""); stream.onDraft("Draft"); await gate; return reply();
    });
    const pending = readAgentMessageStream(response, text => { drafts.push(text); if (text) draftSeen(); }, new AbortController().signal);
    await draftReady;
    expect(drafts).toEqual(["", "Draft"]);
    finish();
    expect(await pending).toEqual(result);
  });
  it("aborts the in-flight operation when the reader disconnects", async () => {
    let resolve!: () => void;
    const gate = new Promise<void>(r => { resolve = r; });
    let operationSignal!: AbortSignal;
    const response = agentMessageHttpStream(new AbortController().signal, async stream => {
      operationSignal = stream.abortSignal; stream.onDraft("partial"); await gate; return reply();
    });
    const reader = response.body!.getReader();
    await reader.read(); await reader.cancel();
    expect(operationSignal.aborted).toBe(true);
    resolve();
  });
  it("retains draft-only failure and does not leak underlying exception details", async () => {
    const response = agentMessageHttpStream(new AbortController().signal, async stream => {
      stream.onDraft("unverified"); throw new Error("synthetic private provider credential");
    });
    const text = await response.text();
    expect(text).toContain("agent_stream_interrupted");
    expect(text).not.toContain("credential");
    expect(text).not.toContain('"result"');
  });
  it("refuses a final response that did not pass the existing application contract", async () => {
    const response = agentMessageHttpStream(new AbortController().signal, async () => Response.json({ ok: true, data: { reply: "not approved", proposal: { status: "executed" } } }));
    await expect(readAgentMessageStream(response, () => undefined, new AbortController().signal)).rejects.toThrow("agent_stream_interrupted");
  });
});

it.each([false, true])("emits tool activity only when the client explicitly opts in (%s)", async enabled => {
  const response = agentMessageHttpStream(new AbortController().signal, async stream => {
    stream.onActivity?.({step: 1, toolName: "read_github_file", state: "running"});
    stream.onActivity?.({step: 1, toolName: "read_github_file", state: "completed"});
    return reply();
  }, {toolActivity: enabled});
  const events = (await response.text()).trim().split("\n").map(line => JSON.parse(line));
  expect(events.filter(event => event.type === "tool_activity")).toHaveLength(enabled ? 2 : 0);
  expect(events.at(-1)).toEqual({type: "result", data: result});
});

it("rejects secret-bearing activity instead of serializing extra tool fields", async () => {
  const response = agentMessageHttpStream(new AbortController().signal, async stream => {
    stream.onActivity?.({step: 1, toolName: "read_github_file", state: "running", args: {token: "synthetic-private-token"}} as never);
    return reply();
  }, {toolActivity: true});
  const text = await response.text();
  expect(text).toContain("agent_stream_interrupted");
  expect(text).not.toContain("synthetic-private-token");
  expect(text).not.toContain('"result"');
});
