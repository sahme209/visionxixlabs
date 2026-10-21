import { describe, expect, it } from "vitest";
import { streamedDecisionMessage } from "../streamedDecisionMessage";

describe("display-only top-level decision message", () => {
  it.each([
    ['{"action":"respond","message":"hel', "hel"],
    ['{"args":{"message":"private args"},"message":"visible', "visible"],
    ['{"message":"escaped \\"quote\\" and \\nline', 'escaped "quote" and \nline'],
    ['{"message":"partial\\', "partial"],
    ['{"message":"partial\\u12', "partial"],
    ['{"message":"done","args":{"token":"not exposed"}}', "done"],
    ['{"args":{"message":"never draft args"}}', ""],
    ['[{"message":"wrong root"}]', ""],
    ['{"message":123}', ""],
    ['{"message":"hello\\uD83D', "hello"],
    ['{"message":"hello\\uD83D\\uDE42', "hello🙂"],
    ['{"message":"bad\\xescape', ""],
  ])("extracts %s safely", (source, expected) => expect(streamedDecisionMessage(source)).toBe(expected));
  it.each(["```json\n", "```\n", " \n```json\r\n"])("streams a fenced JSON message at every chunk boundary: %j", opener => {
    const source = opener + JSON.stringify({action: "call_tool", args: {message: "private tool args"}, message: "Visible reply 🙂"}) + "\n```";
    let prior = "";
    for (let end = 0; end <= source.length; end++) {
      const draft = streamedDecisionMessage(source.slice(0, end));
      expect(draft.startsWith(prior)).toBe(true);
      expect(draft).not.toContain("private tool args");
      prior = draft;
    }
    expect(prior).toBe("Visible reply 🙂");
  });
  it.each([
    '```json', '```j', '```json\n',
    '```javascript\n{"message":"not JSON"}',
    'Prose before JSON\n```json\n{"message":"not a root"}',
    '```json\n[{"message":"array"}]',
    '```json\n{"args":{"message":"private only"}}',
  ])("does not expose unsupported roots, partial fences or tool messages: %j", source => {
    expect(streamedDecisionMessage(source)).toBe("");
  });

});
