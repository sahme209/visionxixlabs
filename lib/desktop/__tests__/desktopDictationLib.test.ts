import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("desktop dictation module", () => {
  it("stays identical to the web module", () => {
    const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
    expect(read("desktop/src/lib/dictation.ts")).toBe(read("lib/dictation/dictation.ts"));
  });
  it("the Agent composer adds dictated text to the draft and never submits it", () => {
    const view = readFileSync(join(process.cwd(), "desktop/src/views/AgentChatView.tsx"), "utf8");
    const line = view.split("\n").find((l) => l.includes("<DictationButton"))!;
    expect(line).toContain("setInput(current => appendTranscript(current, phrase))");
    expect(line).not.toMatch(/submitDraft|send/);
  });
});
