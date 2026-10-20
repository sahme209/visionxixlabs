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
});
